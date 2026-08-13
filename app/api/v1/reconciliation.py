import logging
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import desc, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_firm, get_current_user, get_or_404
from app.core.database import get_db
from app.models.models import (
    BankTransaction,
    Client,
    ClientHistory,
    Firm,
    LedgerEntry,
    ReconMatch,
    ReconPeriodLock,
    User,
)
from app.services.client_context import fetch_recon_recommendations
from app.services.recon_engine import ReconEngine

logger = logging.getLogger(__name__)
router = APIRouter()


class RunReconReq(BaseModel):
    client_id: str
    month_year: Optional[str] = None


class ManualMatchReq(BaseModel):
    bank_txn_id: str
    ledger_entry_id: str
    note: Optional[str] = None


class AskClientReq(BaseModel):
    client_id: str
    bank_txn_id: Optional[str] = None
    ledger_entry_id: Optional[str] = None
    message: Optional[str] = None


class LockReq(BaseModel):
    client_id: str
    month_year: str


async def _record_history(db: AsyncSession, client_id: str, user_id: str | None, action: str, detail: dict) -> None:
    db.add(
        ClientHistory(
            client_id=client_id,
            user_id=user_id,
            action=action,
            detail=detail,
        )
    )


@router.post("/run")
async def run_reconciliation(
    req: RunReconReq,
    firm: Firm = Depends(get_current_firm),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    client = await get_or_404(db, Client, req.client_id, firm_id=firm.id)

    engine = ReconEngine(db, req.client_id)
    summary = await engine.run_all()

    await _record_history(
        db,
        client_id=req.client_id,
        user_id=str(user.id),
        action="recon_run",
        detail={"month_year": req.month_year, "summary": summary},
    )
    await db.commit()

    return {
        "status": "success",
        "message": "Reconciliation engine completed matching.",
        "summary": summary,
        "client": {"id": str(client.id), "name": client.name},
    }


@router.get("/{client_id}/unmatched")
async def get_unmatched(
    client_id: str,
    firm: Firm = Depends(get_current_firm),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await get_or_404(db, Client, client_id, firm_id=firm.id)

    bank_q = await db.execute(
        select(BankTransaction)
        .where(BankTransaction.client_id == client_id, BankTransaction.status == "unmatched")
        .order_by(BankTransaction.date)
    )
    ledger_q = await db.execute(
        select(LedgerEntry)
        .where(LedgerEntry.client_id == client_id, LedgerEntry.status == "unmatched")
        .order_by(LedgerEntry.date)
    )

    bank_txns = bank_q.scalars().all()
    ledger_entries = ledger_q.scalars().all()

    return {
        "bank_transactions": [
            {
                "id": str(bank.id),
                "date": bank.date.isoformat() if bank.date else None,
                "description": bank.description,
                "amount": bank.amount,
                "type": bank.type,
                "status": bank.status,
            }
            for bank in bank_txns
        ],
        "ledger_entries": [
            {
                "id": str(ledger.id),
                "date": ledger.date.isoformat() if ledger.date else None,
                "description": ledger.description,
                "amount": ledger.amount,
                "type": ledger.type,
                "status": ledger.status,
            }
            for ledger in ledger_entries
        ],
    }


@router.get("/{client_id}/recommendations")
async def get_recommendations(
    client_id: str,
    bank_txn_id: str,
    firm: Firm = Depends(get_current_firm),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    recommendations = await fetch_recon_recommendations(db, firm.id, client_id, bank_txn_id)
    return {"recommendations": recommendations}


@router.post("/match")
async def manual_match(
    req: ManualMatchReq,
    firm: Firm = Depends(get_current_firm),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    bank_q = await db.execute(select(BankTransaction).where(BankTransaction.id == req.bank_txn_id))
    bt = bank_q.scalar_one_or_none()
    ledger_q = await db.execute(select(LedgerEntry).where(LedgerEntry.id == req.ledger_entry_id))
    le = ledger_q.scalar_one_or_none()

    if not bt or not le:
        raise HTTPException(status_code=404, detail="Transaction or Entry not found")

    if bt.client_id != le.client_id:
        raise HTTPException(status_code=400, detail="Cannot match transactions across different clients")

    bt.status = "matched"
    le.status = "matched"

    match_record = ReconMatch(
        bank_txn_id=bt.id,
        ledger_entry_id=le.id,
        match_tier="manual",
        confidence_score=1.0,
        created_by=user.id,
        match_meta={"note": req.note, "resolved_by": str(user.id), "resolved_at": datetime.utcnow().isoformat()},
    )
    db.add(match_record)
    await _record_history(
        db,
        client_id=str(bt.client_id),
        user_id=str(user.id),
        action="recon_manual_match",
        detail={"bank_txn_id": req.bank_txn_id, "ledger_entry_id": req.ledger_entry_id, "note": req.note},
    )
    await db.commit()

    return {"status": "success"}


@router.post("/ask-client")
async def ask_client(
    req: AskClientReq,
    firm: Firm = Depends(get_current_firm),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    client = await get_or_404(db, Client, req.client_id, firm_id=firm.id)
    token = f"recon-{client.id}-{datetime.utcnow().timestamp():.0f}"
    link = f"/clients/{client.id}/recon/follow-up?token={token}"
    message = req.message or "Please clarify this unmatched transaction and upload the supporting receipt if available."

    await _record_history(
        db,
        client_id=req.client_id,
        user_id=str(user.id),
        action="recon_ask_client",
        detail={
            "bank_txn_id": req.bank_txn_id,
            "ledger_entry_id": req.ledger_entry_id,
            "message": message,
            "link": link,
        },
    )
    await db.commit()

    return {
        "status": "success",
        "client_name": client.name,
        "message": message,
        "link": link,
    }


@router.post("/lock")
async def lock_period(
    req: LockReq,
    firm: Firm = Depends(get_current_firm),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    client = await get_or_404(db, Client, req.client_id, firm_id=firm.id)

    existing = await db.execute(
        select(ReconPeriodLock).where(
            ReconPeriodLock.client_id == req.client_id,
            ReconPeriodLock.month_year == req.month_year,
        )
    )
    lock = existing.scalar_one_or_none()
    if lock:
        lock.locked_by = user.id
        lock.locked_at = datetime.utcnow()
        lock.status = "locked"
    else:
        lock = ReconPeriodLock(
            client_id=req.client_id,
            month_year=req.month_year,
            locked_by=user.id,
            locked_at=datetime.utcnow(),
            status="locked",
        )
        db.add(lock)

    await _record_history(
        db,
        client_id=req.client_id,
        user_id=str(user.id),
        action="recon_lock",
        detail={"month_year": req.month_year, "status": "locked"},
    )
    await db.commit()

    return {"status": "success", "client_name": client.name, "month_year": req.month_year}


@router.get("/{client_id}/summary")
async def get_recon_summary(
    client_id: str,
    firm: Firm = Depends(get_current_firm),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await get_or_404(db, Client, client_id, firm_id=firm.id)

    total_bank_q = await db.execute(select(func.count(BankTransaction.id)).where(BankTransaction.client_id == client_id))
    total_ledger_q = await db.execute(select(func.count(LedgerEntry.id)).where(LedgerEntry.client_id == client_id))
    matched_bank_q = await db.execute(
        select(func.count(BankTransaction.id)).where(BankTransaction.client_id == client_id, BankTransaction.status == "matched")
    )
    matched_ledger_q = await db.execute(
        select(func.count(LedgerEntry.id)).where(LedgerEntry.client_id == client_id, LedgerEntry.status == "matched")
    )
    unmatched_bank_q = await db.execute(
        select(func.count(BankTransaction.id)).where(BankTransaction.client_id == client_id, BankTransaction.status == "unmatched")
    )
    unmatched_ledger_q = await db.execute(
        select(func.count(LedgerEntry.id)).where(LedgerEntry.client_id == client_id, LedgerEntry.status == "unmatched")
    )
    lock_q = await db.execute(
        select(ReconPeriodLock)
        .where(ReconPeriodLock.client_id == client_id)
        .order_by(desc(ReconPeriodLock.locked_at))
        .limit(1)
    )
    latest_lock = lock_q.scalar_one_or_none()

    total_bank = total_bank_q.scalar_one_or_none() or 0
    total_ledger = total_ledger_q.scalar_one_or_none() or 0
    matched_bank = matched_bank_q.scalar_one_or_none() or 0
    matched_ledger = matched_ledger_q.scalar_one_or_none() or 0
    unmatched_bank = unmatched_bank_q.scalar_one_or_none() or 0
    unmatched_ledger = unmatched_ledger_q.scalar_one_or_none() or 0

    return {
        "total_bank": total_bank,
        "total_ledger": total_ledger,
        "matched_bank": matched_bank,
        "matched_ledger": matched_ledger,
        "unmatched_bank": unmatched_bank,
        "unmatched_ledger": unmatched_ledger,
        "matched_total": matched_bank + matched_ledger,
        "flagged_total": unmatched_bank + unmatched_ledger,
        "latest_lock": (
            {
                "month_year": latest_lock.month_year,
                "locked_at": latest_lock.locked_at.isoformat() if latest_lock.locked_at else None,
                "status": latest_lock.status,
            }
            if latest_lock
            else None
        ),
    }
