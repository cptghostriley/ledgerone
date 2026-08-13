import logging
from datetime import datetime
from difflib import SequenceMatcher
from typing import Any
from uuid import UUID

from sqlalchemy import desc, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_or_404
from app.models.models import (
    BankTransaction,
    Client,
    ComplianceDeadline,
    Document,
    DocumentChunk,
    LedgerEntry,
    MissingDocument,
    QnAMessage,
    QnASession,
    ReconciliationResult,
    ReconPeriodLock,
)
from app.services.llm import Gemma4OllamaService

logger = logging.getLogger(__name__)


def _normalize_text(value: str | None) -> str:
    if not value:
        return ""
    return "".join(ch.lower() for ch in value if ch.isalnum() or ch.isspace()).strip()


def _heuristic_flags(question: str) -> dict[str, bool]:
    text = question.lower()
    return {
        "requires_profile": any(token in text for token in ["client", "profile", "metadata", "contact", "pan", "gstin"]),
        "requires_documents": any(token in text for token in ["document", "upload", "file", "statement", "invoice", "return"]),
        "requires_deadlines": any(token in text for token in ["deadline", "due", "filing", "compliance"]),
        "requires_missing_docs": any(token in text for token in ["missing", "pending document", "pending docs", "receipt", "ask client"]),
        "requires_recon": any(token in text for token in ["recon", "reconciliation", "match", "bank", "ledger", "journal"]),
        "requires_history": any(token in text for token in ["history", "timeline", "activity", "audit trail", "who changed"]),
        "requires_locks": any(token in text for token in ["lock", "freeze", "period", "locked"]),
    }


async def classify_query(question: str, llm_service: Gemma4OllamaService | None = None) -> dict[str, bool]:
    flags = {
        "requires_profile": False,
        "requires_documents": False,
        "requires_deadlines": False,
        "requires_missing_docs": False,
        "requires_recon": False,
        "requires_history": False,
        "requires_locks": False,
    }

    llm_service = llm_service or Gemma4OllamaService()
    prompt = f"""
You are a strict query classifier for a Chartered Accountant workspace.
Read the user question and return ONLY valid JSON.

Question: {question}

Return this exact schema:
{{
  "requires_profile": true/false,
  "requires_documents": true/false,
  "requires_deadlines": true/false,
  "requires_missing_docs": true/false,
  "requires_recon": true/false,
  "requires_history": true/false,
  "requires_locks": true/false
}}
""".strip()

    try:
        response = await llm_service.chat_json([{"role": "user", "content": prompt}])
        for key in flags:
            flags[key] = bool(response.get(key, flags[key]))
    except Exception as exc:
        logger.debug("Query classifier fallback used: %s", exc)
        flags.update(_heuristic_flags(question))

    return flags


async def fetch_client_context(
    db: AsyncSession,
    firm_id: UUID,
    client_id: UUID,
    question: str | None = None,
    include_documents: bool = True,
    include_chunks: bool = False,
) -> dict[str, Any]:
    client = await get_or_404(db, Client, client_id, firm_id)

    docs_result = await db.execute(
        select(Document)
        .where(Document.client_id == client_id)
        .order_by(desc(Document.uploaded_at))
    )
    documents = docs_result.scalars().all()

    doc_summary = {
        "total": len(documents),
        "processed": sum(1 for doc in documents if (doc.status or "").lower() == "processed"),
        "pending": sum(1 for doc in documents if (doc.status or "").lower() == "pending"),
        "failed": sum(1 for doc in documents if (doc.status or "").lower() == "failed"),
        "review": sum(1 for doc in documents if (doc.status or "").lower() == "review"),
        "latest": [
            {
                "id": str(doc.id),
                "filename": doc.original_filename,
                "status": doc.status,
                "doc_type": doc.doc_type,
                "financial_year": doc.financial_year,
                "confidence": doc.confidence,
                "uploaded_at": doc.uploaded_at.isoformat() if doc.uploaded_at else None,
                "extracted_keys": list((doc.extracted_data or {}).keys())[:8],
            }
            for doc in documents[:6]
        ],
    }

    deadlines_result = await db.execute(
        select(ComplianceDeadline)
        .where(ComplianceDeadline.client_id == client_id)
        .order_by(ComplianceDeadline.due_date)
    )
    deadlines = deadlines_result.scalars().all()

    missing_result = await db.execute(
        select(MissingDocument)
        .where(MissingDocument.client_id == client_id)
        .order_by(MissingDocument.due_date.nullslast())
    )
    missing_documents = missing_result.scalars().all()

    recon_results = await db.execute(
        select(ReconciliationResult)
        .where(ReconciliationResult.client_id == client_id)
        .order_by(desc(ReconciliationResult.created_at))
        .limit(3)
    )
    recon_history = recon_results.scalars().all()

    bank_stats = await db.execute(
        select(
            func.count(BankTransaction.id),
            func.count().filter(BankTransaction.status == "matched"),
            func.count().filter(BankTransaction.status == "unmatched"),
            func.count().filter(BankTransaction.status == "queried"),
        ).where(BankTransaction.client_id == client_id)
    )
    bank_total, bank_matched, bank_unmatched, bank_queried = bank_stats.one()

    ledger_stats = await db.execute(
        select(
            func.count(LedgerEntry.id),
            func.count().filter(LedgerEntry.status == "matched"),
            func.count().filter(LedgerEntry.status == "unmatched"),
        ).where(LedgerEntry.client_id == client_id)
    )
    ledger_total, ledger_matched, ledger_unmatched = ledger_stats.one()

    lock_result = await db.execute(
        select(ReconPeriodLock)
        .where(ReconPeriodLock.client_id == client_id)
        .order_by(desc(ReconPeriodLock.locked_at))
        .limit(1)
    )
    latest_lock = lock_result.scalar_one_or_none()

    history_result = await db.execute(
        select(QnAMessage, QnASession)
        .join(QnASession, QnAMessage.session_id == QnASession.id)
        .where(QnASession.client_id == client_id, QnASession.user_id == client.user_id)
        .order_by(desc(QnAMessage.created_at))
        .limit(10)
    )
    history_rows = history_result.all()

    context: dict[str, Any] = {
        "client_profile": {
            "id": str(client.id),
            "name": client.name,
            "pan": client.pan,
            "gstin": client.gstin,
            "filing_type": client.filing_type,
            "ay": client.ay,
            "contact_info": client.contact_info,
            "metadata": client.client_metadata,
        },
        "documents": doc_summary if include_documents else {"total": 0, "latest": []},
        "deadlines": [
            {
                "id": str(deadline.id),
                "type": deadline.deadline_type,
                "due_date": deadline.due_date.isoformat() if deadline.due_date else None,
                "status": deadline.status,
                "notes": deadline.notes,
            }
            for deadline in deadlines
        ],
        "missing_documents": [
            {
                "id": str(item.id),
                "document_type": item.document_type,
                "required_for": item.required_for,
                "status": item.status,
                "notes": item.notes,
                "due_date": item.due_date.isoformat() if item.due_date else None,
            }
            for item in missing_documents
        ],
        "reconciliation": {
            "bank": {
                "total": bank_total,
                "matched": bank_matched,
                "unmatched": bank_unmatched,
                "queried": bank_queried,
            },
            "ledger": {
                "total": ledger_total,
                "matched": ledger_matched,
                "unmatched": ledger_unmatched,
            },
            "latest_results": [
                {
                    "id": str(result.id),
                    "financial_year": result.financial_year,
                    "status": result.status,
                    "flagged_count": result.flagged_count,
                    "summary": result.summary,
                    "created_at": result.created_at.isoformat() if result.created_at else None,
                }
                for result in recon_history
            ],
        },
        "period_lock": (
            {
                "id": str(latest_lock.id),
                "month_year": latest_lock.month_year,
                "locked_at": latest_lock.locked_at.isoformat() if latest_lock.locked_at else None,
                "status": latest_lock.status,
            }
            if latest_lock
            else None
        ),
        "history": [
            {
                "id": str(message.id),
                "role": message.role,
                "content": message.content,
                "created_at": message.created_at.isoformat() if message.created_at else None,
                "session_name": session.session_name,
            }
            for message, session in history_rows
        ],
        "assembled_at": datetime.utcnow().isoformat(),
    }

    if include_chunks and question:
        context["document_chunks"] = await fetch_document_chunks(db, firm_id, client_id, question)
    else:
        context["document_chunks"] = []

    return context


async def fetch_document_chunks(
    db: AsyncSession,
    firm_id: UUID,
    client_id: UUID,
    question: str,
    limit: int = 6,
) -> list[dict[str, Any]]:
    llm_service = Gemma4OllamaService()
    try:
        query_vector = await llm_service.embed_text(question)
    except Exception as exc:
        logger.debug("Skipping semantic document retrieval: %s", exc)
        return []

    embedding_column = getattr(DocumentChunk, "embedding", None)
    if embedding_column is None or not hasattr(embedding_column, "cosine_distance"):
        return []

    stmt = (
        select(
            DocumentChunk,
            DocumentChunk.embedding.cosine_distance(query_vector).label("distance"),
            Document.original_filename,
            Document.id.label("document_id"),
        )
        .join(Document, Document.id == DocumentChunk.document_id)
        .where(Document.firm_id == firm_id, Document.client_id == client_id)
        .order_by("distance")
        .limit(limit)
    )

    result = await db.execute(stmt)
    chunks: list[dict[str, Any]] = []
    for chunk, distance, original_filename, document_id in result.all():
        if distance is None or distance > 0.35:
            continue
        chunks.append(
            {
                "chunk_id": str(chunk.id),
                "document_id": str(document_id),
                "filename": original_filename,
                "distance": float(distance),
                "text": chunk.raw_text,
            }
        )

    return chunks


async def fetch_recon_recommendations(
    db: AsyncSession,
    firm_id: UUID,
    client_id: UUID,
    bank_txn_id: UUID,
    limit: int = 3,
) -> list[dict[str, Any]]:
    await get_or_404(db, Client, client_id, firm_id)

    bank_result = await db.execute(
        select(BankTransaction).where(BankTransaction.id == bank_txn_id, BankTransaction.client_id == client_id)
    )
    bank_txn = bank_result.scalar_one_or_none()
    if not bank_txn:
        return []

    ledger_result = await db.execute(
        select(LedgerEntry).where(LedgerEntry.client_id == client_id, LedgerEntry.status == "unmatched")
    )
    ledger_entries = ledger_result.scalars().all()

    recommendations: list[dict[str, Any]] = []
    bank_desc = _normalize_text(bank_txn.description)
    for entry in ledger_entries:
        day_distance = abs((bank_txn.date.date() - entry.date.date()).days)
        amount_gap = abs(float(bank_txn.amount) - float(entry.amount))
        description_score = SequenceMatcher(None, bank_desc, _normalize_text(entry.description)).ratio()
        amount_score = max(0.0, 1.0 - min(amount_gap / max(abs(float(bank_txn.amount)), 1.0), 1.0))
        time_score = max(0.0, 1.0 - (day_distance / 10.0))
        confidence = round((amount_score * 0.45) + (time_score * 0.25) + (description_score * 0.30), 3)
        recommendations.append(
            {
                "ledger_entry_id": str(entry.id),
                "date": entry.date.isoformat() if entry.date else None,
                "description": entry.description,
                "amount": entry.amount,
                "type": entry.type,
                "confidence": confidence,
                "day_distance": day_distance,
                "amount_gap": round(amount_gap, 2),
            }
        )

    recommendations.sort(key=lambda item: (item["confidence"], -item["day_distance"]), reverse=True)
    return recommendations[:limit]


async def build_report_payload(db: AsyncSession, firm_id: UUID, client_id: UUID) -> dict[str, Any]:
    return await fetch_client_context(
        db,
        firm_id,
        client_id,
        question=None,
        include_documents=True,
        include_chunks=False,
    )
