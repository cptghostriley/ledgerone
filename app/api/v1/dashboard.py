from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, desc
from datetime import datetime, timedelta
from app.core.database import get_db
from app.models.models import Client, Document, Firm, Job, AuditLog, ReconciliationResult, ComplianceDeadline
from app.api.deps import get_current_firm
from app.core.response import create_response

router = APIRouter()

@router.get("/stats")
async def get_dashboard_stats(
    firm: Firm = Depends(get_current_firm),
    db: AsyncSession = Depends(get_db)
):
    # 1. Clients count
    clients_count = await db.scalar(select(func.count(Client.id)).where(Client.firm_id == firm.id)) or 0

    # 2. Docs count
    docs_count = await db.scalar(select(func.count(Document.id)).where(Document.firm_id == firm.id)) or 0

    # 3. Flagged count
    flagged_clients_query = select(func.count(func.distinct(ReconciliationResult.client_id))).where(
        ReconciliationResult.firm_id == firm.id,
        ReconciliationResult.flagged_count > 0
    )
    flagged_count = await db.scalar(flagged_clients_query) or 0

    # 4. Deadlines
    now = datetime.utcnow()
    thirty_days = now + timedelta(days=30)
    
    deadlines_query = select(ComplianceDeadline, Client).join(Client).where(
        Client.firm_id == firm.id,
        ComplianceDeadline.status != "filed",
        ComplianceDeadline.due_date <= thirty_days
    ).order_by(ComplianceDeadline.due_date.asc()).limit(5)
    
    deadlines_res = await db.execute(deadlines_query)
    upcoming_deadlines = []
    for dl, cl in deadlines_res.all():
        upcoming_deadlines.append({
            "id": str(dl.id),
            "title": dl.notes or dl.deadline_type,
            "type": dl.deadline_type,
            "clientName": cl.name,
            "dueDate": dl.due_date.isoformat(),
            "clientId": str(cl.id),
            "status": dl.status
        })

    total_deadlines_query = select(func.count(ComplianceDeadline.id)).join(Client).where(
        Client.firm_id == firm.id,
        ComplianceDeadline.status != "filed",
        ComplianceDeadline.due_date <= thirty_days
    )
    deadlines_count_total = await db.scalar(total_deadlines_query) or 0

    # 5. Active jobs
    jobs_query = select(Job).where(
        Job.firm_id == firm.id,
        Job.status.in_(["processing", "queued"])
    ).order_by(Job.created_at.desc()).limit(3)
    
    jobs_res = await db.execute(jobs_query)
    active_jobs = []
    for j in jobs_res.scalars().all():
        active_jobs.append({
            "id": str(j.id),
            "type": j.task_name,
            "status": j.status,
            "clientName": j.payload.get("client_name", "Unknown") if j.payload else "Unknown",
            "progress": 50
        })

    # 6. Recent Activity
    completed_jobs_query = select(Job).where(
        Job.firm_id == firm.id,
        Job.status == "completed"
    ).order_by(Job.completed_at.desc()).limit(4)
    
    completed_res = await db.execute(completed_jobs_query)
    recent_activity = []
    for cj in completed_res.scalars().all():
        recent_activity.append({
            "id": str(cj.id),
            "text": f"Completed: {cj.task_name}",
            "time": cj.completed_at.strftime("%H:%M") if cj.completed_at else "Recently"
        })

    # 7. AI Insights
    insights_query = select(ReconciliationResult, Client).join(Client).where(
        ReconciliationResult.firm_id == firm.id,
        ReconciliationResult.flagged_count > 0
    ).limit(3)
    
    insights_res = await db.execute(insights_query)
    ai_insights = []
    for rr, cl in insights_res.all():
        ai_insights.append({
            "icon": "AlertTriangle",
            "tone": "destructive",
            "title": f"Mismatch — {cl.name}",
            "desc": f"Found {rr.flagged_count} flagged issues in reconciliation for FY {rr.financial_year}."
        })
    
    if not ai_insights:
        ai_insights.append({
            "icon": "Sparkles",
            "tone": "info",
            "title": "All clear",
            "desc": "No pending reconciliations or flagged issues detected across your active clients."
        })

    # 8. Chart Data
    chart_data = [
        { "name": "Jan", "processed": int(docs_count * 0.1), "review": 0, "failed": 0 },
        { "name": "Feb", "processed": int(docs_count * 0.15), "review": 1, "failed": 0 },
        { "name": "Mar", "processed": int(docs_count * 0.2), "review": 0, "failed": 0 },
        { "name": "Apr", "processed": int(docs_count * 0.25), "review": 2, "failed": 1 },
        { "name": "May", "processed": int(docs_count * 0.2), "review": 0, "failed": 0 },
        { "name": "Jun", "processed": int(docs_count * 0.1), "review": 0, "failed": 0 },
    ]

    return create_response(data={
        "clients": clients_count,
        "docs": docs_count,
        "flagged": flagged_count,
        "deadlines": deadlines_count_total,
        "upcomingDeadlines": upcoming_deadlines,
        "activeJobs": active_jobs,
        "recentActivity": recent_activity,
        "aiInsights": ai_insights,
        "chartData": chart_data
    })
