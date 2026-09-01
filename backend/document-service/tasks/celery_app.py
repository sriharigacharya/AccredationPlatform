"""Celery app configuration for document-service."""

import os
from celery import Celery

REDIS_URL = os.getenv("REDIS_URL", "redis://redis:6379/0")

celery_app = Celery(
    "document_service",
    broker=REDIS_URL,
    backend=REDIS_URL,
    include=["tasks.ocr_pipeline"],
)

celery_app.conf.update(
    task_serializer="json",
    result_serializer="json",
    accept_content=["json"],
    timezone="UTC",
    enable_utc=True,
    task_routes={
        "tasks.ocr_pipeline.process_document": {"queue": "ocr_queue"},
    },
)
