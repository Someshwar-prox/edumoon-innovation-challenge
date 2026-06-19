"""kb_master mirror helper. Writes one point into kb_master per chunk."""
from __future__ import annotations

import hashlib
import logging

from qdrant_client.http import models as qmodels

from app.core.qdrant import COLLECTION_KB_MASTER

log = logging.getLogger(__name__)


def _kb_id(business_id: str, source_type: str, source_id: str, chunk_index: int) -> str:
    raw = f"{business_id}|{source_type}|{source_id}|{chunk_index}"
    return hashlib.sha1(raw.encode("utf-8")).hexdigest()[:32]


def mirror_to_kb_master(
    qdrant,
    *,
    business_id: str,
    source_type: str,
    source_id: str,
    origin_collection: str,
    vector: list[float],
    extra_payload: dict | None = None,
    chunk_index: int = 0,
) -> None:
    """Idempotent: same inputs produce the same point id, so re-runs upsert."""
    sid = _kb_id(business_id, source_type, source_id, chunk_index)
    payload: dict = {
        "business_id": business_id,
        "source_type": source_type,
        "source_id": source_id,
        "origin_collection": origin_collection,
        "chunk_index": chunk_index,
    }
    if extra_payload:
        payload.update(extra_payload)
    qdrant.upsert(
        collection_name=COLLECTION_KB_MASTER,
        points=[qmodels.PointStruct(id=sid, vector=vector, payload=payload)],
        wait=True,
    )
