from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, desc
from app.core.database import get_db
from app.models.models import Client, Document, Firm, Job, AuditLog
from app.api.deps import get_current_firm
from app.core.response import create_response

router = APIRouter()

@router.get("/stats")
async def get_dashboard_stats(
    firm: Firm = Depends(get_current_firm),
    db: AsyncSession = Depends(get_db)
):
    clients_count = await db.execute(select(func.count(Client.id)).where(Client.firm_id == firm.id))
    clients_count = clients_count.scalar()

    docs_count = await db.execute(select(func.count(Document.id)).where(Document.firm_id == firm.id))
    docs_count = docs_count.scalar()

    # Mocked data format for the rest of UI
    recent_activity = [
        {"id": "a-1", "text": "Extracted GSTR-3B for Mehta & Co.", "time": "2 mins ago"},
        {"id": "a-2", "text": "Reconciled March inputs", "time": "15 mins ago"}
    ]

    return create_response(data={
        "clients": clients_count,
        "docs": docs_count,
        "flagged": 0,
        "deadlines": 12, # mock
        "recentActivity": recent_activity
    })
