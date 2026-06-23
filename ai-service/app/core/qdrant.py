"""Qdrant client + collection-name constants used everywhere."""
from __future__ import annotations

import logging
from functools import lru_cache

from qdrant_client import QdrantClient

from app.core.config import settings

log = logging.getLogger(__name__)

COLLECTION_WEBSITE_PAGES = "website_pages"
COLLECTION_DOCUMENT_CHUNKS = "document_chunks"
COLLECTION_REPORTS = "readiness_reports"
COLLECTION_KB_MASTER = "kb_master"
COLLECTION_CHAT_LOGS = "chat_logs"
COLLECTION_ANALYTICS = "analytics_events"
COLLECTION_LIVE_RESEARCH = "live_research"

ALL_COLLECTIONS = [
    COLLECTION_WEBSITE_PAGES,
    COLLECTION_DOCUMENT_CHUNKS,
    COLLECTION_REPORTS,
    COLLECTION_KB_MASTER,
    COLLECTION_CHAT_LOGS,
    COLLECTION_ANALYTICS,
]


@lru_cache(maxsize=1)
def get_qdrant() -> QdrantClient:
    client = QdrantClient(
        url=settings.qdrant_url,
        api_key=settings.qdrant_api_key or None,
        timeout=30,
    )
    log.info("qdrant client initialised", extra={"url": settings.qdrant_url})
    return client