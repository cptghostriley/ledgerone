import json
import logging
from typing import Dict, Any
from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from pydantic import BaseModel
import ollama

from app.core.database import get_db
from app.api.deps import get_current_firm, get_current_user
from app.models.models import Firm, User, Client, MissingDocument, ReconciliationResult, ComplianceDeadline, BankTransaction
from app.core.config import settings

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
        # Gather all clients data for the firm
        clients_query = await db.execute(select(Client).where(Client.firm_id == firm.id))
        clients = clients_query.scalars().all()
        
        firm_summary = {
            "total_clients": len(clients),
            "client_summaries": []
        }
        
        for c in clients:
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
            
            # Get deadlines
            deadlines_query = await db.execute(
                select(func.count(ComplianceDeadline.id))
                .where(ComplianceDeadline.client_id == c.id, ComplianceDeadline.status != "completed")
            )
            pending_deadlines = deadlines_query.scalar_one_or_none() or 0
            
            if missing_docs > 0 or unmatched_txns > 0 or pending_deadlines > 0:
                firm_summary["client_summaries"].append({
                    "name": c.name,
                    "missing_documents": missing_docs,
                    "unmatched_reconciliation_txns": unmatched_txns,
                    "pending_deadlines": pending_deadlines
                })
        
        # Build prompt for LLM
        prompt = f"""
        You are an AI assistant for a Chartered Accountant (CA) firm.
        Analyze the following data about the firm's clients and provide a concise, professional summary 
        highlighting the most critical action items (flagged data, progress). 
        Do not output markdown lists if not necessary, just a solid 2-3 paragraph professional brief.
        Data: {json.dumps(firm_summary, indent=2)}
        """
        
        response = ollama.chat(
            model=settings.ollama_model,
            messages=[{"role": "user", "content": prompt}],
            options={"temperature": 0.2}
        )
        
        insight_text = response['message']['content']
        
        return InsightResponse(insight=insight_text, status="success")
        
    except Exception as e:
        logger.error(f"Error generating insights: {e}")
        return InsightResponse(insight="Failed to generate AI insights at this time.", status="error")
