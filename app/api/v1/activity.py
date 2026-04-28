from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc
from app.core.database import get_db
from app.models.models import AuditLog, Job, Firm
from app.api.deps import get_current_firm
from app.core.response import create_response

router = APIRouter()

@router.get("")
async def get_activity(
    firm: Firm = Depends(get_current_firm),
    db: AsyncSession = Depends(get_db)
):
    # Fetch recent jobs and audit logs
    jobs_result = await db.execute(
        select(Job).where(Job.firm_id == firm.id).order_by(desc(Job.created_at)).limit(20)
    )
    jobs = jobs_result.scalars().all()
    
    audit_result = await db.execute(
        select(AuditLog).where(AuditLog.firm_id == firm.id).order_by(desc(AuditLog.id)).limit(20) # No created_at on AuditLog, sorting by id works if UUIDs are v7 or we can just return nothing for now
    )
    audits = audit_result.scalars().all()
    
    # Map to frontend expected FeedItem structure
    # id, type (upload, system, alert, processing), text, timestamp, actor, client
    
    feed = []
    for j in jobs:
        feed.append({
            "id": f"job-{j.id}",
            "type": "processing" if j.status in ["queued", "processing"] else ("system" if j.status == "completed" else "alert"),
            "text": f"{j.task_name} · {j.status}",
            "timestamp": j.created_at.isoformat() if j.created_at else None,
            "actor": "Pipeline",
            "client": j.payload.get("clientName", "Unknown") if j.payload else "Unknown"
        })
        
    for a in audits:
        feed.append({
            "id": str(a.id),
            "type": "alert",
            "text": a.action,
            "timestamp": None, # AuditLog doesn't have created_at yet!
            "actor": "System",
            "client": None
        })
        
    # Sort feed
    feed = sorted(feed, key=lambda x: x["timestamp"] or "", reverse=True)
    
    return create_response(data=feed[:50])
