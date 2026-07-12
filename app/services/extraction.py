"""
Real extraction pipeline using Ollama gemma4:e4b.
Sends document text (or image) to Ollama and parses structured JSON output.
"""
import json
import logging
import httpx
import base64
import io
from PIL import Image
from app.core.config import settings
from app.core.database import AsyncSessionLocal
from app.models.models import Document, DocumentChunk
from uuid import UUID

logger = logging.getLogger(__name__)

# Prompt template for structured extraction
EXTRACTION_PROMPT = """You are an expert Indian CA (Chartered Accountant) document analyzer.
Analyze the following document text and extract key financial information.

Return your response ONLY as a valid JSON object with these fields (use null for missing):
{{
  "document_type": "string (e.g. GSTR-3B, Form-16, Bank Statement, Trial Balance, ITR, TDS Certificate, Invoice, etc.)",
  "financial_year": "string (e.g. 2024-2025)",
  "entity_name": "string",
  "pan": "string",
  "gstin": "string",
  "total_amount": "number or null",
  "tax_amount": "number or null",
  "key_fields": {{
    "any other important field": "value"
  }},
  "line_items": [
    {{ "description": "string", "amount": "number" }}
  ],
  "dates": ["list of important dates found"],
  "summary": "brief one-sentence summary of the document"
}}

Document text:
{text}"""


async def call_ollama(prompt: str, image_path: str = None) -> str:
    """Call Ollama API and return the raw text response."""
    url = f"{settings.ollama_base_url}/api/generate"

    payload = {
        "model": settings.ollama_model,
        "prompt": prompt,
        "stream": False,
        "format": "json",
        "options": {
            "temperature": 0.1,
            "num_predict": 1024,
            "num_ctx": 4096,
        }
    }

    # Add image if it's a vision request
    if image_path:
        try:
            with Image.open(image_path) as img:
                if img.mode != 'RGB':
                    img = img.convert('RGB')
                img.thumbnail((1200, 1200), Image.Resampling.LANCZOS)
                buffer = io.BytesIO()
                img.save(buffer, format="JPEG", quality=85)
                img_b64 = base64.b64encode(buffer.getvalue()).decode()
            payload["images"] = [img_b64]
        except Exception as e:
            logger.warning(f"Could not encode image: {e}")

    try:
        async with httpx.AsyncClient(timeout=settings.ollama_timeout) as client:
            resp = await client.post(url, json=payload)
            resp.raise_for_status()
            data = resp.json()
            return data.get("response", "")
    except Exception as e:
        logger.error(f"Ollama call failed: {e}")
        raise


def parse_json_from_response(text: str) -> dict:
    """Extract JSON from Ollama response, tolerating surrounding text."""
    # Try direct parse
    try:
        return json.loads(text)
    except Exception:
        pass
    # Try to find JSON block
    start = text.find("{")
    end = text.rfind("}") + 1
    if start != -1 and end > start:
        try:
            return json.loads(text[start:end])
        except Exception:
            pass
    logger.warning("Could not parse JSON from Ollama response, returning raw")
    return {"raw_response": text, "summary": text[:500]}


async def extract_data(document_id: str, firm_id: str, pages: list, schema_id: str = None) -> list:
    """
    For each page, send text/image to Ollama and collect extracted JSON chunks.
    """
    schema_fields_str = ""
    if schema_id:
        from app.models.models import SchemaDef
        async with AsyncSessionLocal() as db:
            schema = await db.get(SchemaDef, UUID(schema_id))
            if schema and schema.fields:
                schema_fields_str = "    // You MUST extract these specific fields requested by the user. If not found, output 'Not found' for strings, or null for numbers:\n"
                for f in schema.fields:
                    schema_fields_str += f'    "{f.get("name")}": "{f.get("type")} - {f.get("description")}",\n'
                schema_fields_str = schema_fields_str.replace("{", "{{").replace("}", "}}")

    results = []
    for page in pages:
        page_num = page.get("page", 1)
        text = page.get("text", "")
        image_path = page.get("image_path")
        page_type = page.get("type", "text")

        if not text and not image_path:
            continue
            
        base_prompt = EXTRACTION_PROMPT
        if schema_fields_str:
            base_prompt = base_prompt.replace('"key_fields": {{', f'"key_fields": {{{{\n{schema_fields_str}')

        if page_type == "image" and image_path:
            prompt = base_prompt.format(text="[Image document - analyze visually]")
        else:
            # Shorten truncation to 4000 chars (safe context for gemma4)
            truncated = text[:4000] if len(text) > 4000 else text
            prompt = base_prompt.format(text=truncated)

        try:
            raw = await call_ollama(prompt, image_path if page_type == "image" else None)
            parsed = parse_json_from_response(raw)
            results.append({
                "page": page_num,
                "text": text[:500],  # store snippet only
                "data": parsed
            })
        except Exception as e:
            logger.error(f"Extraction failed for page {page_num}: {e}")
            results.append({
                "page": page_num,
                "text": text[:500],
                "data": {"error": str(e)},
                "failed": True
            })

    return results


async def merge_results(document_id: str, firm_id: str, chunks: list) -> dict:
    """
    Merge multi-page extraction results into a single coherent document.
    Uses Ollama to intelligently reconcile if multiple pages, otherwise uses single result.
    """
    if not chunks:
        return {}

    if len(chunks) == 1:
        return chunks[0].get("data", {})

    # For multi-page: combine all page data and ask Ollama to merge
    pages_summary = []
    for c in chunks:
        pages_summary.append(f"Page {c['page']}: {json.dumps(c.get('data', {}), default=str)[:1000]}")

    merge_prompt = f"""You are merging extracted data from multiple pages of the same document.
Combine these page extractions into ONE coherent JSON object. Take the most complete values across pages.
Use the same JSON schema as each page. Return ONLY valid JSON.

Pages:
{chr(10).join(pages_summary)}"""

    try:
        raw = await call_ollama(merge_prompt)
        return parse_json_from_response(raw)
    except Exception as e:
        logger.error(f"Merge failed, using first page: {e}")
        return chunks[0].get("data", {})


async def validate_data(document_id: str, firm_id: str, data: dict) -> tuple:
    """
    Compute confidence score and detect anomalies.
    Simple heuristic: missing key fields lower confidence, known bad values flag anomalies.
    """
    required_fields = ["document_type", "entity_name", "financial_year"]
    filled = sum(1 for f in required_fields if data.get(f))
    confidence = filled / len(required_fields)

    anomalies = []
    total = data.get("total_amount")
    tax = data.get("tax_amount")
    if total and tax and isinstance(total, (int, float)) and isinstance(tax, (int, float)):
        if tax > total:
            anomalies.append({"type": "tax_exceeds_total", "detail": f"Tax {tax} > Total {total}"})

    if not data.get("entity_name"):
        anomalies.append({"type": "missing_entity", "detail": "Entity name not found"})

    confidence = max(0.1, confidence)
    return round(confidence, 2), anomalies


async def generate_embeddings(document_id: str, firm_id: str, chunks: list):
    """
    Generate text embeddings for each chunk using Ollama nomic-embed-text.
    Saves DocumentChunk records to the database.
    """
    url = f"{settings.ollama_base_url}/api/embeddings"

    async with AsyncSessionLocal() as db:
        for i, chunk in enumerate(chunks):
            text = chunk.get("text", "") or json.dumps(chunk.get("data", {}))[:1000]
            if not text.strip():
                continue

            embedding = None
            try:
                async with httpx.AsyncClient(timeout=60) as client:
                    resp = await client.post(url, json={
                        "model": settings.ollama_embedding_model,
                        "prompt": text
                    })
                    if resp.status_code == 200:
                        embedding_data = resp.json()
                        embedding = embedding_data.get("embedding")
            except Exception as e:
                logger.warning(f"Embedding failed for chunk {i}: {e}")

            db_chunk = DocumentChunk(
                document_id=UUID(document_id),
                chunk_index=i,
                raw_text=text[:2000],
                extracted_data=chunk.get("data", {}),
                embedding=embedding  # None if embedding failed — OK for now
            )
            db.add(db_chunk)

        await db.commit()
