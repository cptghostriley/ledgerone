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
from app.models.models import Document, Job, Firm
from app.api.deps import get_current_firm
from app.core.config import settings

logger = logging.getLogger(__name__)
router = APIRouter()


async def _run_pipeline_background(document_id: str, firm_id: str, job_id: str):
    """
    Inline pipeline runner used as a fallback when Celery is unavailable.
    Runs inside the FastAPI process as a background asyncio task.
    """
    from app.workers.tasks import run_pipeline, _update_job_status
    from app.core.database import AsyncSessionLocal, engine
    from app.models.models import Document as Doc
    try:
        await _update_job_status(job_id, "processing")
        await run_pipeline(document_id, firm_id, job_id)
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
    db: AsyncSession = Depends(get_db),
):
    storage_path = os.path.abspath(settings.storage_path)
    os.makedirs(storage_path, exist_ok=True)

    file_ext = os.path.splitext(file.filename or "file")[1]
    safe_name = f"{uuid.uuid4()}{file_ext}"
    file_path = os.path.join(storage_path, safe_name)

    # Save physical file
    try:
        contents = await file.read()
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
        task_name="process_document",
        status="pending",
        payload={"document_id": str(doc.id), "schema_id": schema_id},
    )
    db.add(job)
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
            _run_pipeline_background, str(doc.id), str(firm.id), str(job.id)
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
            if d.file_path and os.path.exists(d.file_path):
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

    await db.commit()
    return create_response(data={"status": "success"})
