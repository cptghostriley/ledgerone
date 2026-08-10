from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc
from sqlalchemy.orm import selectinload
from app.core.database import get_db
from app.models.models import AuditLog, Job, Firm, User
from app.api.deps import get_current_firm, get_current_user
from app.core.response import create_response

router = APIRouter()

@router.get("/firm")
async def get_firm_activity(
    firm: Firm = Depends(get_current_firm),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    if current_user.active_role != "Admin/Owner":
        raise HTTPException(status_code=403, detail="Not authorized")
        
    # Fetch recent jobs and audit logs
    jobs_result = await db.execute(
        select(Job)
        .where(Job.firm_id == firm.id)
        .options(selectinload(Job.user))
        .order_by(desc(Job.created_at))
        .limit(100)
    )
    jobs = jobs_result.scalars().all()
    
    audit_result = await db.execute(
        select(AuditLog)
        .where(AuditLog.firm_id == firm.id)
        .options(selectinload(AuditLog.user))
        .order_by(desc(AuditLog.created_at))
        .limit(100)
    )
    audits = audit_result.scalars().all()
    
    feed = []
    for j in jobs:
        task_desc = "AI Document Extraction" if j.task_name == "process_document" else j.task_name.replace("_", " ").title()
        if j.status == "completed":
            type_val = "ai"
            text_val = f"{task_desc} completed successfully"
        elif j.status in ["queued", "processing"]:
            type_val = "processing"
            text_val = f"{task_desc} is currently processing"
        else:
            type_val = "alert"
            text_val = f"{task_desc} failed: {j.error or 'Unknown error'}"

        feed.append({
            "id": f"job-{j.id}",
            "type": type_val,
            "text": text_val,
            "timestamp": j.created_at.isoformat() if j.created_at else None,
            "actor": j.user.email if j.user else "Pipeline",
            "client": j.payload.get("clientName", "Unknown") if j.payload else "Unknown"
        })
        
    for a in audits:
        type_val = "system"
        if a.action.startswith("Uploaded"):
            type_val = "upload"
        elif a.action.startswith("Updated"):
            type_val = "edit"
        elif a.action.startswith("Retried"):
            type_val = "retry"

        feed.append({
            "id": str(a.id),
            "type": type_val,
            "text": a.action,
            "timestamp": a.created_at.isoformat() if a.created_at else None,
            "actor": a.user.email if a.user else "System",
            "client": None
        })
        
    # Sort feed
    feed = sorted(feed, key=lambda x: x["timestamp"] or "", reverse=True)
    
    return create_response(data=feed)

@router.get("/me")
async def get_my_activity(
    firm: Firm = Depends(get_current_firm),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    # Fetch recent jobs for the user
    jobs_result = await db.execute(
        select(Job)
        .where(Job.firm_id == firm.id, Job.user_id == current_user.id)
        .options(selectinload(Job.user))
        .order_by(desc(Job.created_at))
        .limit(100)
    )
    jobs = jobs_result.scalars().all()
    
    audit_result = await db.execute(
        select(AuditLog)
        .where(AuditLog.firm_id == firm.id, AuditLog.user_id == current_user.id)
        .options(selectinload(AuditLog.user))
        .order_by(desc(AuditLog.created_at))
        .limit(100)
    )
    audits = audit_result.scalars().all()
    
    feed = []
    for j in jobs:
        task_desc = "AI Document Extraction" if j.task_name == "process_document" else j.task_name.replace("_", " ").title()
        if j.status == "completed":
            type_val = "ai"
            text_val = f"{task_desc} completed successfully"
        elif j.status in ["queued", "processing"]:
            type_val = "processing"
            text_val = f"{task_desc} is currently processing"
        else:
            type_val = "alert"
            text_val = f"{task_desc} failed: {j.error or 'Unknown error'}"

        feed.append({
            "id": f"job-{j.id}",
            "type": type_val,
            "text": text_val,
            "timestamp": j.created_at.isoformat() if j.created_at else None,
            "actor": j.user.email if j.user else "You",
            "client": j.payload.get("clientName", "Unknown") if j.payload else "Unknown"
        })
        
    for a in audits:
        type_val = "system"
        if a.action.startswith("Uploaded"):
            type_val = "upload"
        elif a.action.startswith("Updated"):
            type_val = "edit"
        elif a.action.startswith("Retried"):
            type_val = "retry"

        feed.append({
            "id": str(a.id),
            "type": type_val,
            "text": a.action,
            "timestamp": a.created_at.isoformat() if a.created_at else None,
            "actor": a.user.email if a.user else "You",
            "client": None
        })
        
    feed = sorted(feed, key=lambda x: x["timestamp"] or "", reverse=True)
    return create_response(data=feed)
