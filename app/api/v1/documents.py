import uuid
import os
import shutil
from fastapi import APIRouter, Depends, UploadFile, File, Form, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.core.database import get_db
from app.core.response import create_response
from app.models.models import Document, Job, Firm, User
from app.api.deps import get_current_firm, get_or_404
from app.workers.tasks import process_document_task
from app.core.config import settings

router = APIRouter()

@router.post("/upload")
async def upload_document(
    client_id: uuid.UUID = Form(...),
    file: UploadFile = File(...),
    schema_id: str = Form(None),
    firm: Firm = Depends(get_current_firm),
    db: AsyncSession = Depends(get_db)
):
    storage_path = os.path.abspath(settings.storage_path)
    os.makedirs(storage_path, exist_ok=True)
    file_ext = os.path.splitext(file.filename)[1]
    safe_name = f"{uuid.uuid4()}{file_ext}"
    file_path = os.path.join(storage_path, safe_name)

    # Save physical file
    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    # Create Document record
    doc = Document(
        firm_id=firm.id,
        client_id=client_id,
        original_filename=file.filename,
        file_path=file_path,
        mime_type=file.content_type,
        status="pending"
    )
    db.add(doc)
    await db.flush()

    # Create Job record
    job = Job(
        firm_id=firm.id,
        task_name="process_document",
        status="pending",
        payload={"document_id": str(doc.id), "schema_id": schema_id}
    )
    db.add(job)
    await db.commit()

    # Trigger Celery
    process_document_task.delay(str(doc.id), str(firm.id), str(job.id), schema_id)

    return create_response(data={"job_id": str(job.id), "document_id": str(doc.id)})

@router.get("/client/{client_id}")
async def get_client_documents(
    client_id: uuid.UUID,
    firm: Firm = Depends(get_current_firm),
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(select(Document).where(Document.client_id == client_id, Document.firm_id == firm.id))
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
    db: AsyncSession = Depends(get_db)
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
    })
