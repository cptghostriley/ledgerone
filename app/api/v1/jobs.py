from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc
from uuid import UUID

from app.core.database import get_db
from app.models.models import Job, Firm, Document
from app.api.deps import get_current_firm
from app.core.response import create_response

router = APIRouter()


@router.get("")
async def get_jobs(
    firm: Firm = Depends(get_current_firm),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Job).where(Job.firm_id == firm.id).order_by(desc(Job.created_at)).limit(50)
    )
    jobs = result.scalars().all()
    out = []
    for j in jobs:
        out.append({
            "id": str(j.id),
            "type": j.task_name,
            "status": j.status,
            "clientName": j.payload.get("client_name", "Unknown") if j.payload else "Unknown",
            "progress": 100 if j.status == "completed" else (50 if j.status == "processing" else 0),
            "created_at": j.created_at.isoformat() if j.created_at else None,
            "completed_at": j.completed_at.isoformat() if j.completed_at else None,
            "document_id": j.result.get("document_id") if j.result else None,
            "error": j.error,
        })
    return create_response(data=out)


@router.get("/{job_id}")
async def get_job(
    job_id: UUID,
    firm: Firm = Depends(get_current_firm),
    db: AsyncSession = Depends(get_db),
):
    """Poll a single job for status. Used by the Upload page to detect completion."""
    result = await db.execute(
        select(Job).where(Job.id == job_id, Job.firm_id == firm.id)
    )
    job = result.scalar_one_or_none()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    document_id = None
    if job.result and isinstance(job.result, dict):
        document_id = job.result.get("document_id")

    return create_response(data={
        "id": str(job.id),
        "status": job.status,
        "task_name": job.task_name,
        "document_id": document_id,
        "error": job.error,
        "created_at": job.created_at.isoformat() if job.created_at else None,
        "completed_at": job.completed_at.isoformat() if job.completed_at else None,
    })
