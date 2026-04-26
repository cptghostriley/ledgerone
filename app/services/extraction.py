import logging

logger = logging.getLogger(__name__)

async def extract_data(document_id: str, firm_id: str, pages: list) -> list:
    # 3. Extract: Call Gemma4OllamaService. Retry page up to 3x. Store extracted_data with error flag if fail.
    # Stub
    return [{"page_index": 0, "text": "stub", "data": {"field": "value"}}]

async def merge_results(document_id: str, firm_id: str, chunks: list) -> dict:
    # 4. Merge: Gemma4 merge_results with all page extractions.
    # Stub
    return {"field": "value_merged"}

async def validate_data(document_id: str, firm_id: str, data: dict) -> tuple[float, dict]:
    # 5. Validate: Check against schema, compute confidence 0-1, anomalies.
    # Stub
    return 0.95, {}

async def generate_embeddings(document_id: str, firm_id: str, chunks: list):
    # 6. Embed: Set raw_text + extracted_data as string, get vector via nomic-embed-text, save to DocumentChunk.
    # Stub
    pass
