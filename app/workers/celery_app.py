from celery import Celery
from app.core.config import settings

celery_app = Celery(
    "ca_intelligence_worker",
    broker=settings.redis_url,
    backend=settings.redis_url
)

celery_app.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="UTC",
    enable_utc=True,
    # Celery task reliability requirements from Section 5:
    task_acks_late=True,
    worker_prefetch_multiplier=1,
    worker_concurrency=settings.celery_workers,
)

celery_app.autodiscover_tasks(["app.workers.tasks"], force=True)
