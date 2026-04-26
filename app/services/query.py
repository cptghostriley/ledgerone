import logging
from typing import List
from uuid import UUID
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.models.models import DocumentChunk, Document
from app.services.llm import Gemma4OllamaService

logger = logging.getLogger(__name__)

async def answer_client_query(db: AsyncSession, firm_id: UUID, client_id: UUID, question: str) -> dict:
    llm_service = Gemma4OllamaService()
    
    # 1. Embed query
    query_vector = await llm_service.embed_text(question)
    
    # 2. Run pgvector cosine similarity search
    # pgvector operator `<=>` implies cosine distance (where lower is closer).
    stmt = (
        select(DocumentChunk, DocumentChunk.embedding.cosine_distance(query_vector).label('distance'))
        .join(Document, Document.id == DocumentChunk.document_id)
        .where(
            Document.firm_id == firm_id,
            Document.client_id == client_id
        )
        .order_by('distance')
        .limit(8)
    )
    
    result = await db.execute(stmt)
    rows = result.all()
    
    # max distance 0.35 roughly aligns with >0.65 similarity
    valid_chunks = []
    chunk_references = []
    for chunk, distance in rows:
        if distance <= 0.35:
            valid_chunks.append(chunk)
            chunk_references.append(str(chunk.document_id))
            
    if not valid_chunks:
        return {
            "answer": "I could not find any relevant information in the documents submitted by this client.",
            "sources": []
        }
        
    # 3. Build Grounded Prompt
    context_blocks = []
    for idx, chunk in enumerate(valid_chunks, 1):
        context_blocks.append(f"--- Document Content [{idx}] ---\n{chunk.raw_text}")
        
    grounded_prompt = f"Use the following document chunks to answer the question. Only use the provided context.\n\nContext:\n{chr(10).join(context_blocks)}\n\nQuestion: {question}"
    
    # 4. Generate answer dynamically from context rules via Ollama API
    payload = {
        "model": llm_service.model,
        "messages": [
            {"role": "system", "content": "You are a helpful CA assistant answering specific client queries strictly and only based on extracted document facts. Be concise."},
            {"role": "user", "content": grounded_prompt}
        ],
        "stream": False,
        "options": {
            "temperature": 0.3,
            "num_ctx": 32768
        }
    }
    
    import httpx
    from app.core.config import settings
    async with httpx.AsyncClient(timeout=settings.ollama_timeout) as client:
        response = await client.post(f"{settings.ollama_base_url}/api/chat", json=payload)
        response.raise_for_status()
        data = response.json()
        answer = data.get("message", {}).get("content", "Failed to generate answer.")
        
    return {
        "answer": answer,
        "sources": list(set(chunk_references))
    }
