import time
import logging
from uuid import UUID
from datetime import datetime, timezone
import asyncio

from celery import shared_task
from app.workers.celery_app import celery_app
from app.core.database import AsyncSessionLocal
from app.models.models import Job, Document

logger = logging.getLogger(__name__)

async def _update_job_status(job_id: str, status: str, result: dict = None, error: str = None):
    async with AsyncSessionLocal() as db:
        job = await db.get(Job, UUID(job_id))
        if job:
            job.status = status
            if result is not None:
                job.result = result
            if error is not None:
                job.error = error
            if status in ["completed", "failed"]:
                job.completed_at = datetime.now(timezone.utc)
            await db.commit()

async def run_pipeline(document_id: str, firm_id: str, job_id: str):
    pipeline_start = time.time()
    
    # 1. Classify
    from app.services.processor import classify_document
    start = time.time()
    doc_type = await classify_document(document_id, firm_id)
    logger.info(f"Stage 1 (Classify) took {time.time() - start:.2f}s")
    if not doc_type:
        raise Exception("Classification failed")
        
    # 2. Pre-process
    from app.services.processor import preprocess_document
    start = time.time()
    pages_or_chunks = await preprocess_document(document_id, firm_id)
    logger.info(f"Stage 2 (Pre-process) took {time.time() - start:.2f}s")
    
    # 3. Extract
    from app.services.extraction import extract_data
    start = time.time()
    extracted_chunks = await extract_data(document_id, firm_id, pages_or_chunks)
    logger.info(f"Stage 3 (Extract) took {time.time() - start:.2f}s")
    
    # 4. Merge
    from app.services.extraction import merge_results
    start = time.time()
    merged_data = await merge_results(document_id, firm_id, extracted_chunks)
    logger.info(f"Stage 4 (Merge) took {time.time() - start:.2f}s")
    
    # 5. Validate
    from app.services.extraction import validate_data
    start = time.time()
    confidence, anomalies = await validate_data(document_id, firm_id, merged_data)
    logger.info(f"Stage 5 (Validate) took {time.time() - start:.2f}s")
    
    # 6. Embed
    from app.services.extraction import generate_embeddings
    start = time.time()
    await generate_embeddings(document_id, firm_id, extracted_chunks)
    logger.info(f"Stage 6 (Embed) took {time.time() - start:.2f}s")
    
    # 7. Classify dates
    from app.services.processor import classify_dates
    start = time.time()
    financial_year = await classify_dates(document_id, firm_id, merged_data)
    logger.info(f"Stage 7 (Classify dates) took {time.time() - start:.2f}s")
    
    # 8. Trigger recon
    from app.services.reconciliation import trigger_reconciliation
    start = time.time()
    await trigger_reconciliation(document_id, firm_id, financial_year)
    logger.info(f"Stage 8 (Trigger recon) took {time.time() - start:.2f}s")
    
    async with AsyncSessionLocal() as db:
        doc = await db.get(Document, UUID(document_id))
        doc.status = "processed"
        doc.processing_ms = int((time.time() - pipeline_start) * 1000)
        doc.extracted_data = merged_data
        doc.confidence = confidence
        doc.anomalies = anomalies
        await db.commit()

@celery_app.task(bind=True, max_retries=3)
def process_document_task(self, document_id: str, firm_id: str, job_id: str):
    logger.info(f"Starting pipeline for document {document_id}")
    try:
        asyncio.run(_update_job_status(job_id, "processing"))
        asyncio.run(run_pipeline(document_id, firm_id, job_id))
        asyncio.run(_update_job_status(job_id, "completed", result={"document_id": document_id}))
    except Exception as exc:
        logger.error(f"Pipeline failed: {exc}")
        asyncio.run(_update_job_status(job_id, "failed", error=str(exc)))
        
        async def _mark_doc_failed():
            async with AsyncSessionLocal() as db:
                doc = await db.get(Document, UUID(document_id))
                if doc:
                    doc.status = "failed"
                    await db.commit()
        asyncio.run(_mark_doc_failed())
        # We don't automatically retry on business logic failure unless it was a network drop
