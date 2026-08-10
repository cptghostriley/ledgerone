import logging
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, desc, func
from pydantic import BaseModel

from app.core.database import get_db
from app.api.deps import get_current_firm, get_current_user
from app.models.models import Firm, User, Client, BankTransaction, LedgerEntry, ReconMatch, ReconPeriodLock
from app.services.recon_engine import ReconEngine

logger = logging.getLogger(__name__)
router = APIRouter()

class RunReconReq(BaseModel):
    client_id: str

@router.post("/run")
async def run_reconciliation(
    req: RunReconReq,
    firm: Firm = Depends(get_current_firm),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    # Basic validation
    client_q = await db.execute(select(Client).where(Client.id == req.client_id, Client.firm_id == firm.id))
    if not client_q.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Client not found")
        
    engine = ReconEngine(db, req.client_id)
    await engine.run_all()
    
    return {"status": "success", "message": "Reconciliation engine completed matching."}

@router.get("/{client_id}/unmatched")
async def get_unmatched(
    client_id: str,
    firm: Firm = Depends(get_current_firm),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    bank_q = await db.execute(select(BankTransaction).where(BankTransaction.client_id == client_id, BankTransaction.status == "unmatched").order_by(BankTransaction.date))
    ledger_q = await db.execute(select(LedgerEntry).where(LedgerEntry.client_id == client_id, LedgerEntry.status == "unmatched").order_by(LedgerEntry.date))
    
    bank_txns = bank_q.scalars().all()
    ledger_entries = ledger_q.scalars().all()
    
    return {
        "bank_transactions": [{"id": str(b.id), "date": str(b.date), "description": b.description, "amount": b.amount, "type": b.type} for b in bank_txns],
        "ledger_entries": [{"id": str(l.id), "date": str(l.date), "description": l.description, "amount": l.amount, "type": l.type} for l in ledger_entries]
    }

class ManualMatchReq(BaseModel):
    bank_txn_id: str
    ledger_entry_id: str

@router.post("/match")
async def manual_match(
    req: ManualMatchReq,
    firm: Firm = Depends(get_current_firm),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    bank_q = await db.execute(select(BankTransaction).where(BankTransaction.id == req.bank_txn_id))
    bt = bank_q.scalar_one_or_none()
    ledger_q = await db.execute(select(LedgerEntry).where(LedgerEntry.id == req.ledger_entry_id))
    le = ledger_q.scalar_one_or_none()
    
    if not bt or not le:
        raise HTTPException(status_code=404, detail="Transaction or Entry not found")
        
    bt.status = "matched"
    le.status = "matched"
    
    match_record = ReconMatch(
        bank_txn_id=bt.id,
        ledger_entry_id=le.id,
        match_tier="manual",
        confidence_score=1.0,
        created_by=user.id
    )
    db.add(match_record)
    await db.commit()
    
    return {"status": "success"}

@router.get("/{client_id}/summary")
async def get_recon_summary(
    client_id: str,
    firm: Firm = Depends(get_current_firm),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    total_bank_q = await db.execute(select(func.count(BankTransaction.id)).where(BankTransaction.client_id == client_id))
    total_bank = total_bank_q.scalar_one_or_none() or 0
    
    matched_bank_q = await db.execute(select(func.count(BankTransaction.id)).where(BankTransaction.client_id == client_id, BankTransaction.status == "matched"))
    matched_bank = matched_bank_q.scalar_one_or_none() or 0
    
    # We can fake the UI checks based on the new logic or return raw numbers
    return {
        "total_checks": total_bank,
        "passed": matched_bank,
        "flagged": total_bank - matched_bank
    }
