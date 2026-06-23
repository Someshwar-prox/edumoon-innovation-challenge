"""Module 5 router — POST /v1/live-research.

Live web + multi-source + advice-mode fallback. See service.py for
the architecture and prompts.py for the prompt strategies.
"""
from __future__ import annotations

import logging

from fastapi import APIRouter, Request
from fastapi.responses import JSONResponse

from app.api.schemas import ErrorResponse
from app.modules.live_research.errors import LiveResearchError
from app.modules.live_research.schemas import (
    LiveResearchRequest,
    LiveResearchResponse,
)
from app.modules.live_research.service import LiveResearchContext, LiveResearchService

log = logging.getLogger(__name__)

router = APIRouter(tags=["live-research"])


@router.post(
    "/live-research",
    summary=(
        "Answer a question with the company's own KB + fresh public web + "
        "industry best-practice fallback."
    ),
    description=(
        "Combines the company's indexed knowledge (kb_master) with live "
        "DuckDuckGo + public-source fetches at query time, and falls back "
        "to industry best practices for open-ended questions like 'how can "
        "I improve my website'. Returns answer + citations from all sources."
    ),
    response_model=LiveResearchResponse,
    responses={
        502: {"model": ErrorResponse, "description": "Upstream search or LLM failure."},
        503: {"model": ErrorResponse, "description": "LLM not configured."},
    },
)
async def live_research(
    body: LiveResearchRequest, request: Request
) -> LiveResearchResponse | JSONResponse:
    ctx = LiveResearchContext(
        business_id=body.business_id,
        question=body.question,
        company_name=body.company_name,
        company_url=body.company_url,
        include_live_web=body.include_live_web,
        top_k=body.top_k,
        embedding_model=request.app.state.embedding_model,
        qdrant=request.app.state.qdrant,
        groq=request.app.state.groq,
    )
    try:
        result = LiveResearchService(ctx).run()
    except LiveResearchError as exc:
        log.warning(
            "live research failed: %s", str(exc),
            extra={"code": exc.code, "status": exc.status_code},
        )
        return JSONResponse(
            status_code=exc.status_code,
            content={"error": {"code": exc.code, "message": str(exc)}},
        )
    except Exception as exc:  # noqa: BLE001
        log.exception("live research crashed", extra={"business_id": body.business_id})
        return JSONResponse(
            status_code=500,
            content={"error": {"code": "internal_error", "message": str(exc)}},
        )
    return result
