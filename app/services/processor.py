"""
Real document processing pipeline.
Reads the uploaded file from local storage, extracts text (PDF or image),
sends it to Ollama gemma4:e4b for structured extraction, then saves results.
"""
import os
import logging
from app.core.database import AsyncSessionLocal
from app.models.models import Document
from uuid import UUID
import boto3
import tempfile
from urllib.parse import urlparse

logger = logging.getLogger(__name__)


async def classify_document(document_id: str, firm_id: str) -> str:
    """Determine document type from mime type and file extension."""
    async with AsyncSessionLocal() as db:
        doc = await db.get(Document, UUID(document_id))
        if not doc:
            return "unknown"
        mime = (doc.mime_type or "").lower()
        if "pdf" in mime:
            doc_type = "pdf"
        elif any(x in mime for x in ["image", "jpg", "jpeg", "png"]):
            doc_type = "image"
        else:
            doc_type = "document"
        doc.doc_type = doc_type
        await db.commit()
    return doc_type


async def preprocess_document(document_id: str, firm_id: str) -> list:
    """
    Extract raw text from the document file.
    - PDF: use pdfminer / PyMuPDF if available, fallback to raw read
    - Image: return file path for vision model
    """
    async with AsyncSessionLocal() as db:
        doc = await db.get(Document, UUID(document_id))
        if not doc:
            return []

        file_path = doc.file_path
        doc_type = doc.doc_type or "document"

    is_s3 = file_path and file_path.startswith("s3://")
    if not is_s3 and (not file_path or not os.path.exists(file_path)):
        logger.error(f"File not found: {file_path}")
        return []

    if is_s3:
        from app.core.config import settings

        parsed = urlparse(file_path)
        bucket = parsed.netloc
        key = parsed.path.lstrip('/')
        
        _, ext = os.path.splitext(key)
        
        s3_client = boto3.client(
            's3',
            aws_access_key_id=settings.aws_access_key_id,
            aws_secret_access_key=settings.aws_secret_access_key,
            region_name=settings.aws_region
        )
        fd, temp_file_path = tempfile.mkstemp(suffix=ext)
        os.close(fd)
        s3_client.download_file(bucket, key, temp_file_path)
        file_path = temp_file_path

    pages = []

    if doc_type == "pdf":
        # Try PyMuPDF (fitz) first
        try:
            import fitz  # PyMuPDF
            pdf = fitz.open(file_path)
            for page_num in range(min(len(pdf), 20)):  # cap at 20 pages
                page = pdf[page_num]
                text = page.get_text("text")
                if text.strip():
                    pages.append({"page": page_num + 1, "text": text[:4000], "type": "text"})
                else:
                    # Scanned page — send image bytes
                    pix = page.get_pixmap(dpi=150)
                    fd, pix_path = tempfile.mkstemp(suffix=".png")
                    os.close(fd)
                    pix.save(pix_path)
                    pages.append({"page": page_num + 1, "image_path": pix_path, "type": "image", "page_num": page_num})
            pdf.close()
        except ImportError:
            # Fallback: read raw bytes as text attempt
            try:
                with open(file_path, "rb") as f:
                    raw = f.read(50000).decode("utf-8", errors="replace")
                pages.append({"page": 1, "text": raw, "type": "text"})
            except Exception as e:
                logger.error(f"Failed to read PDF: {e}")
                pages.append({"page": 1, "text": "", "type": "error"})
    elif doc_type == "image":
        pages.append({"page": 1, "image_path": file_path, "type": "image"})
    else:
        try:
            with open(file_path, "r", errors="replace") as f:
                text = f.read(20000)
            pages.append({"page": 1, "text": text, "type": "text"})
        except Exception as e:
            logger.error(f"Could not read file: {e}")

    return pages


async def classify_dates(document_id: str, firm_id: str, merged_data: dict) -> str:
    """Determine financial year from extracted data."""
    import datetime
    year_str = merged_data.get("financial_year") or merged_data.get("year")
    if year_str:
        return str(year_str)
    # Default to current Indian FY
    now = datetime.datetime.utcnow()
    if now.month >= 4:
        return f"{now.year}-{now.year + 1}"
    else:
        return f"{now.year - 1}-{now.year}"
