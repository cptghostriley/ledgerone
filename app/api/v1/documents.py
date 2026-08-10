import uuid
import os
import asyncio
import logging
import shutil
from fastapi import APIRouter, Depends, UploadFile, File, Form, HTTPException, BackgroundTasks
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.core.database import get_db
from app.core.response import create_response
from app.models.models import Document, Job, Firm, User, AuditLog
from app.api.deps import get_current_firm, get_current_user
from app.core.config import settings

logger = logging.getLogger(__name__)
router = APIRouter()


async def _run_pipeline_background(document_id: str, firm_id: str, job_id: str, schema_id: str = None):
    """
    Inline pipeline runner used as a fallback when Celery is unavailable.
    Runs inside the FastAPI process as a background asyncio task.
    """
    from app.workers.tasks import run_pipeline, _update_job_status
    from app.core.database import AsyncSessionLocal, engine
    from app.models.models import Document as Doc
    try:
        await _update_job_status(job_id, "processing")
        await run_pipeline(document_id, firm_id, job_id, schema_id)
        await _update_job_status(job_id, "completed", result={"document_id": document_id})
    except Exception as exc:
        logger.error(f"Inline pipeline failed: {exc}")
        await _update_job_status(job_id, "failed", error=str(exc))
        async with AsyncSessionLocal() as db:
            doc = await db.get(Doc, uuid.UUID(document_id))
            if doc:
                doc.status = "failed"
                await db.commit()


@router.post("/upload")
async def upload_document(
    background_tasks: BackgroundTasks,
    client_id: uuid.UUID = Form(...),
    file: UploadFile = File(...),
    schema_id: str = Form(None),
    firm: Firm = Depends(get_current_firm),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    file_ext = os.path.splitext(file.filename or "file")[1]
    safe_name = f"{uuid.uuid4()}{file_ext}"

    # Save file to S3 or locally
    try:
        contents = await file.read()
        if settings.use_s3 and settings.s3_bucket_name:
            import boto3
            s3_client = boto3.client(
                's3',
                aws_access_key_id=settings.aws_access_key_id,
                aws_secret_access_key=settings.aws_secret_access_key,
                region_name=settings.aws_region
            )
            s3_key = f"documents/{firm.id}/{client_id}/{safe_name}"
            s3_client.put_object(
                Bucket=settings.s3_bucket_name,
                Key=s3_key,
                Body=contents,
                ContentType=file.content_type
            )
            file_path = f"s3://{settings.s3_bucket_name}/{s3_key}"
        else:
            storage_path = os.path.abspath(settings.storage_path)
            os.makedirs(storage_path, exist_ok=True)
            file_path = os.path.join(storage_path, safe_name)
            with open(file_path, "wb") as buffer:
                buffer.write(contents)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Failed to save file: {exc}")

    # Create Document record
    doc = Document(
        firm_id=firm.id,
        client_id=client_id,
        original_filename=file.filename,
        file_path=file_path,
        mime_type=file.content_type,
        status="pending",
    )
    db.add(doc)
    await db.flush()

    # Create Job record
    job = Job(
        firm_id=firm.id,
        user_id=current_user.id,
        task_name="process_document",
        status="pending",
        payload={"document_id": str(doc.id), "schema_id": schema_id},
    )
    db.add(job)

    # Create AuditLog record
    audit = AuditLog(
        firm_id=firm.id,
        user_id=current_user.id,
        action=f"Uploaded document '{file.filename}'",
        resource_type="document",
        resource_id=str(doc.id),
    )
    db.add(audit)
    await db.commit()

    # Try Celery first; fall back to inline background task if unavailable
    celery_dispatched = False
    try:
        from app.workers.tasks import process_document_task
        process_document_task.delay(str(doc.id), str(firm.id), str(job.id), schema_id)
        celery_dispatched = True
        logger.info(f"Celery task dispatched for doc {doc.id}")
    except Exception as celery_err:
        logger.warning(f"Celery unavailable ({celery_err}), falling back to inline pipeline")

    if not celery_dispatched:
        # Run the pipeline as a FastAPI background task (asyncio-based)
        background_tasks.add_task(
            _run_pipeline_background, str(doc.id), str(firm.id), str(job.id), schema_id
        )

    return create_response(data={"job_id": str(job.id), "document_id": str(doc.id)})


@router.get("/client/{client_id}")
async def get_client_documents(
    client_id: uuid.UUID,
    firm: Firm = Depends(get_current_firm),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Document).where(Document.client_id == client_id, Document.firm_id == firm.id)
    )
    docs = result.scalars().all()
    out = []
    for d in docs:
        size_bytes = 0
        try:
            if d.file_path:
                if d.file_path.startswith("s3://"):
                    # We can't efficiently get S3 size here without a boto3 call for every file
                    pass
                elif os.path.exists(d.file_path):
                    size_bytes = os.path.getsize(d.file_path)
        except Exception:
            pass
        out.append({
            "id": str(d.id),
            "clientId": str(d.client_id),
            "filename": d.original_filename,
            "size": f"{size_bytes / 1024 / 1024:.2f} MB" if size_bytes else "—",
            "docType": d.doc_type or "Unknown",
            "financialYear": d.financial_year or "2024-25",
            "status": d.status,
            "confidence": d.confidence,
            "anomalies": len(d.anomalies) if isinstance(d.anomalies, list) else 0,
            "uploadedAt": d.uploaded_at.isoformat() if d.uploaded_at else None,
            "extractedData": d.extracted_data,
        })
    return create_response(data=out)


@router.get("/{document_id}")
async def get_document(
    document_id: uuid.UUID,
    firm: Firm = Depends(get_current_firm),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Document).where(Document.id == document_id, Document.firm_id == firm.id)
    )
    doc = result.scalar_one_or_none()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    return create_response(data={
        "id": str(doc.id),
        "clientId": str(doc.client_id),
        "filename": doc.original_filename,
        "status": doc.status,
        "docType": doc.doc_type,
        "financialYear": doc.financial_year,
        "confidence": doc.confidence,
        "extractedData": doc.extracted_data,
        "anomalies": doc.anomalies,
        "processingMs": doc.processing_ms,
        "mimeType": doc.mime_type,
        "uploadedAt": doc.uploaded_at.isoformat() if doc.uploaded_at else None,
    })


@router.patch("/{document_id}")
async def update_document(
    document_id: uuid.UUID,
    updates: dict,
    firm: Firm = Depends(get_current_firm),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Update document extraction results or status.
    Used for human-in-the-loop corrections.
    """
    result = await db.execute(
        select(Document).where(Document.id == document_id, Document.firm_id == firm.id)
    )
    doc = result.scalar_one_or_none()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")

    if "extractedData" in updates:
        doc.extracted_data = updates["extractedData"]
    if "docType" in updates:
        doc.doc_type = updates["docType"]
    if "financialYear" in updates:
        doc.financial_year = updates["financialYear"]
    if "status" in updates:
        doc.status = updates["status"]

    # Create AuditLog record
    audit = AuditLog(
        firm_id=firm.id,
        user_id=current_user.id,
        action=f"Updated extraction details for document '{doc.original_filename}'",
        resource_type="document",
        resource_id=str(doc.id),
    )
    db.add(audit)

    await db.commit()
    return create_response(data={"status": "success"})



@router.post("/{document_id}/reprocess")
async def reprocess_document(
    document_id: uuid.UUID,
    background_tasks: BackgroundTasks,
    firm: Firm = Depends(get_current_firm),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    # Check if document exists and belongs to firm
    result = await db.execute(
        select(Document).where(Document.id == document_id, Document.firm_id == firm.id)
    )
    doc = result.scalar_one_or_none()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")

    # Find the schema_id from the last job associated with this document
    job_result = await db.execute(
        select(Job)
        .where(Job.firm_id == firm.id, Job.task_name == "process_document")
        .order_by(Job.created_at.desc())
    )
    jobs = job_result.scalars().all()
    schema_id = None
    for j in jobs:
        if j.payload and j.payload.get("document_id") == str(document_id):
            schema_id = j.payload.get("schema_id")
            break

    # Reset document status and metadata
    doc.status = "pending"
    doc.doc_type = None
    doc.confidence = None
    doc.extracted_data = {}
    doc.anomalies = []
    doc.processing_ms = None
    await db.flush()

    # Create new Job record
    job = Job(
        firm_id=firm.id,
        user_id=current_user.id,
        task_name="process_document",
        status="pending",
        payload={"document_id": str(doc.id), "schema_id": schema_id},
    )
    db.add(job)

    # Create AuditLog record
    audit = AuditLog(
        firm_id=firm.id,
        user_id=current_user.id,
        action=f"Retried extraction for document '{doc.original_filename}'",
        resource_type="document",
        resource_id=str(doc.id),
    )
    db.add(audit)
    await db.commit()

    # Try Celery first; fall back to inline background task if unavailable
    celery_dispatched = False
    try:
        from app.workers.tasks import process_document_task
        process_document_task.delay(str(doc.id), str(firm.id), str(job.id), schema_id)
        celery_dispatched = True
        logger.info(f"Celery task dispatched for reprocessing doc {doc.id}")
    except Exception as celery_err:
        logger.warning(f"Celery unavailable ({celery_err}), falling back to inline pipeline for reprocessing")

    if not celery_dispatched:
        background_tasks.add_task(
            _run_pipeline_background, str(doc.id), str(firm.id), str(job.id), schema_id
        )

    return create_response(data={"job_id": str(job.id), "document_id": str(doc.id)})

