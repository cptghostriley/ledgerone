import logging
from typing import Any
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import desc, select, func
from pydantic import BaseModel

from app.core.database import get_db
from app.api.deps import get_current_firm, get_current_user
from app.models.models import Firm, User, Client, MissingDocument, ReconciliationResult, ComplianceDeadline, BankTransaction, LedgerEntry
from app.services.llm import Gemma4OllamaService

logger = logging.getLogger(__name__)
router = APIRouter()

class InsightResponse(BaseModel):
    insight: str
    status: str

@router.post("/scan", response_model=InsightResponse)
async def scan_insights(
    firm: Firm = Depends(get_current_firm),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    try:
        llm_service = Gemma4OllamaService()

        # Gather all clients data for the firm
        clients_query = await db.execute(select(Client).where(Client.firm_id == firm.id))
        clients = clients_query.scalars().all()
        
        firm_summary = {
            "total_clients": len(clients),
            "client_summaries": []
        }
        
        for c in clients:
            latest_recon_q = await db.execute(
                select(ReconciliationResult)
                .where(ReconciliationResult.client_id == c.id)
                .order_by(desc(ReconciliationResult.created_at))
                .limit(1)
            )
            latest_recon = latest_recon_q.scalar_one_or_none()

            # Get missing docs
            md_query = await db.execute(
                select(func.count(MissingDocument.id))
                .where(MissingDocument.client_id == c.id, MissingDocument.status != "resolved")
            )
            missing_docs = md_query.scalar_one_or_none() or 0
            
            # Get reconciliation issues (from legacy result table or new bank transactions)
            unmatched_txns_query = await db.execute(
                select(func.count(BankTransaction.id))
                .where(BankTransaction.client_id == c.id, BankTransaction.status == "unmatched")
            )
            unmatched_txns = unmatched_txns_query.scalar_one_or_none() or 0

            unmatched_ledger_query = await db.execute(
                select(func.count(LedgerEntry.id))
                .where(LedgerEntry.client_id == c.id, LedgerEntry.status == "unmatched")
            )
            unmatched_ledger = unmatched_ledger_query.scalar_one_or_none() or 0
            
            # Get deadlines
            deadlines_query = await db.execute(
                select(func.count(ComplianceDeadline.id))
                .where(ComplianceDeadline.client_id == c.id, ComplianceDeadline.status != "completed")
            )
            pending_deadlines = deadlines_query.scalar_one_or_none() or 0
            
            if missing_docs > 0 or unmatched_txns > 0 or unmatched_ledger > 0 or pending_deadlines > 0:
                firm_summary["client_summaries"].append({
                    "name": c.name,
                    "pan": c.pan,
                    "gstin": c.gstin,
                    "missing_documents": missing_docs,
                    "unmatched_reconciliation_txns": unmatched_txns,
                    "unmatched_ledger_entries": unmatched_ledger,
                    "pending_deadlines": pending_deadlines
                    ,
                    "latest_recon_status": latest_recon.status if latest_recon else None,
                    "latest_recon_flags": latest_recon.flagged_count if latest_recon else None,
                    "client_metadata": c.client_metadata,
                })
        
        # Build prompt for LLM
        prompt = (
            "You are an AI assistant for a Chartered Accountant (CA) firm. "
            "Analyze the firm summary and provide a concise, professional summary highlighting the most critical action items, matched work, locked periods, and client risks. "
            "Prefer a tight executive brief over a bullet list unless a list materially improves clarity.\n\n"
            f"Data: {firm_summary}"
        )

        insight_text = await llm_service.chat(
            [{"role": "user", "content": prompt}],
            temperature=0.2,
            num_ctx=8192,
        )
        
        return InsightResponse(insight=insight_text, status="success")
        
    except Exception as e:
        logger.error(f"Error generating insights: {e}")
        return InsightResponse(insight="Failed to generate AI insights at this time.", status="error")
