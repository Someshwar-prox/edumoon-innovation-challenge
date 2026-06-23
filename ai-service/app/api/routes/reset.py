"""POST /v1/reset-knowledge — wipe a business's vectors + chat history.

Called from fixed-backend whenever a business.websiteUrl changes, so a
fresh URL never inherits the previous site's context. Idempotent.
"""
from __future__ import annotations

import logging
from typing import Any

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
from qdrant_client.http import models as qmodels

from app.core.qdrant import (
    ALL_COLLECTIONS,
    COLLECTION_LIVE_RESEARCH,
    get_qdrant,
)

log = logging.getLogger(__name__)
router = APIRouter(prefix="/reset-knowledge", tags=["knowledge"])


class ResetKnowledgeRequest(BaseModel):
    business_id: str = Field(..., min_length=1)


def _business_filter(business_id: str) -> qmodels.Filter:
    return qmodels.Filter(
        must=[
            qmodels.FieldCondition(
                key="business_id",
                match=qmodels.MatchValue(value=business_id),
            )
        ]
    )


@router.post("")
def reset_knowledge(body: ResetKnowledgeRequest) -> dict[str, Any]:
    """Wipe all vector memory tied to a business_id.

    Hits every per-business collection, plus `live_research` (which is
    not in ALL_COLLECTIONS but is also business-scoped). Returns the
    per-collection delete counts so the caller can log them.
    """
    qdrant = get_qdrant()
    flt = _business_filter(body.business_id)
    wiped: dict[str, int] = {}
    collections = list(ALL_COLLECTIONS) + [COLLECTION_LIVE_RESEARCH]
    for name in collections:
        try:
            # delete() returns an UpdateResult — count is None for some
            # client versions, so we report 0 rather than fail.
            res = qdrant.delete(
                collection_name=name,
                points_selector=qmodels.FilterSelector(filter=flt),
                wait=True,
            )
            wiped[name] = int(getattr(res, "deleted", 0) or 0)
        except Exception as exc:  # noqa: BLE001
            log.warning("reset-knowledge failed for %s: %s", name, exc)
            wiped[name] = -1
    log.info("reset-knowledge done", extra={"business_id": body.business_id, "wiped": wiped})
    return {"business_id": body.business_id, "wiped": wiped}