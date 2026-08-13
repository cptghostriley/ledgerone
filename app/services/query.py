import json
import logging
from typing import Any
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from app.services.client_context import classify_query, fetch_client_context, fetch_document_chunks
from app.services.llm import Gemma4OllamaService
from app.core.config import settings

logger = logging.getLogger(__name__)


async def answer_client_query(
    db: AsyncSession,
    firm_id: UUID,
    client_id: UUID | None,
    question: str,
    model: str | None = None,
) -> dict[str, Any]:
    qna_model = model or settings.ollama_qna_model
    llm_service = Gemma4OllamaService(model_name=qna_model)
    flags = await classify_query(question, llm_service)

    context: dict[str, Any] = {
        "question": question,
        "flags": flags,
        "retrieved_at": None,
    }

    if client_id:
        fetched_context = await fetch_client_context(
            db,
            firm_id=firm_id,
            client_id=client_id,
            question=question,
            include_documents=flags.get("requires_documents", True),
            include_chunks=flags.get("requires_documents", True),
        )
        context.update(fetched_context)
    else:
        context["client_profile"] = None
        context["documents"] = {"total": 0, "latest": []}
        context["deadlines"] = []
        context["missing_documents"] = []
        context["reconciliation"] = {"bank": {}, "ledger": {}, "latest_results": []}
        context["period_lock"] = None
        context["history"] = []
        context["document_chunks"] = []

    if client_id and not context.get("document_chunks"):
        context["document_chunks"] = await fetch_document_chunks(db, firm_id, client_id, question)

    if not context.get("document_chunks") and not flags.get("requires_profile") and not flags.get("requires_recon"):
        context["document_chunks"] = []

    system_prompt = (
        "You are a professional Chartered Accountant assistant. "
        "Use only the provided structured client context and document evidence. "
        "When the answer depends on unavailable data, explicitly say so. "
        "Prioritize factual accuracy, deadlines, reconciliation status, audit trail data, and client metadata."
    )

    prompt_payload = json.dumps(context, indent=2, default=str)
    user_prompt = (
        f"Client context:\n{prompt_payload}\n\n"
        f"Question: {question}\n\n"
        "Answer in concise professional language. If you infer a likely next step, label it as a recommendation."
    )

    try:
        answer = await llm_service.chat(
            [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
            temperature=0.25,
            num_ctx=32768,
            model=qna_model,
        )
    except Exception as exc:
        logger.error("Query generation failed: %s", exc)
        answer = "I could not generate an answer for this client query right now."

    return {
        "answer": answer,
        "sources": [chunk.get("document_id") for chunk in context.get("document_chunks", [])],
        "context": context,
    }
