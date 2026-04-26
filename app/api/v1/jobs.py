from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc
from app.core.database import get_db
from app.models.models import Job, Firm
from app.api.deps import get_current_firm
from app.core.response import create_response

router = APIRouter()

@router.get("")
async def get_jobs(
    firm: Firm = Depends(get_current_firm),
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(select(Job).where(Job.firm_id == firm.id).order_by(desc(Job.created_at)).limit(50))
    jobs = result.scalars().all()
    out = []
    for j in jobs:
        out.append({
            "id": str(j.id),
            "type": j.task_name,
            "status": j.status,
            "clientName": j.payload.get("clientName", "Unknown") if j.payload else "Unknown",
            "progress": 100 if j.status == 'completed' else 50,
            "created_at": j.created_at.isoformat() if j.created_at else None
        })
    return create_response(data=out)
