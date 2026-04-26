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
from app.schemas.document import DocumentUploadResponse
from app.workers.tasks import process_document_task
from app.core.config import settings

router = APIRouter()

@router.post("/upload")
async def upload_document(
    client_id: uuid.UUID = Form(...),
    file: UploadFile = File(...),
    firm: Firm = Depends(get_current_firm),
    db: AsyncSession = Depends(get_db)
):
    # Setup storage
    os.makedirs(settings.storage_path, exist_ok=True)
    file_path = os.path.join(settings.storage_path, f"{uuid.uuid4()}_{file.filename}")
    
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
        payload={"document_id": str(doc.id)}
    )
    db.add(job)
    await db.commit()
    
    # Trigger Celery
    process_document_task.delay(str(doc.id), str(firm.id), str(job.id))
    
    return create_response(data={"job_id": str(job.id)})

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
        out.append({
            "id": str(d.id),
            "clientId": str(d.client_id),
            "filename": d.original_filename,
            "size": "2.4 MB", # Mocked size
            "docType": d.doc_type or "Unknown",
            "financialYear": d.financial_year or "2024-25",
            "status": d.status,
            "confidence": d.confidence or 0.95,
            "anomalies": 0,
            "uploadedAt": "2026-04-26T10:00:00Z"
        })
    return create_response(data=out)
