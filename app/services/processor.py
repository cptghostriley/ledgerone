import logging

logger = logging.getLogger(__name__)

async def classify_document(document_id: str, firm_id: str) -> str:
    # 1. Classify: Read MIME type + first 512 bytes. Detect: scanned PDF, digital PDF, image, audio. Store doc_type.
    # Stub implementation.
    return "digital_pdf"

async def preprocess_document(document_id: str, firm_id: str) -> list:
    # 2. Pre-process: PDF to images or text, audio to chunks.
    # Stub implementation. Returns list of page paths/texts.
    return ["page1_text_or_path"]

async def classify_dates(document_id: str, firm_id: str, merged_data: dict) -> str:
    # 7. Classify dates: extract dates, map to financial year. Default to current FY.
    current_year = 2024
    return f"{current_year}-{current_year+1}"
