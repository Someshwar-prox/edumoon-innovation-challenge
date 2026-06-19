"""Module 1 router — POST /v1/analyze-website."""
from __future__ import annotations

import logging
from pathlib import Path

from fastapi import APIRouter, Request
from fastapi.responses import JSONResponse

from app.api.schemas import AnalyzeWebsiteRequest, ErrorResponse
from app.core.config import settings
from app.modules.analyze_website.crawler import Crawler
from app.modules.analyze_website.schemas import WebsiteAnalysisResult
from app.modules.analyze_website.service import (
    AnalysisError,
    LLMNotConfigured,
    UpstreamLLMFailed,
    WebsiteAnalysisContext,
    WebsiteAnalysisService,
    WebsiteUnreachable,
)

log = logging.getLogger(__name__)

router = APIRouter(tags=["website-analysis"])


@router.post(
    "/analyze-website",
    summary="Crawl a business website and extract a structured profile.",
    description="Returns a structured profile, embeds each page section, and stores vectors in Qdrant. See docs/API_CONTRACTS.md.",
    response_model=WebsiteAnalysisResult,
    responses={
        502: {"model": ErrorResponse, "description": "Upstream failure (website or LLM)."},
        503: {"model": ErrorResponse, "description": "Empty extraction or LLM not configured."},
    },
)
async def analyze_website(body: AnalyzeWebsiteRequest, request: Request) -> WebsiteAnalysisResult | JSONResponse:
    cache_dir = Path(settings.cache_dir) / body.business_id

    with Crawler(
        user_agent=settings.crawler_user_agent,
        timeout=settings.crawler_timeout_seconds,
        max_pages=body.max_pages,
        cache_dir=cache_dir,
    ) as crawler:
        ctx = WebsiteAnalysisContext(
            business_id=body.business_id,
            url=str(body.url),
            max_pages=body.max_pages,
            force_recrawl=body.force_recrawl,
            crawler=crawler,
            embedding_model=request.app.state.embedding_model,
            qdrant=request.app.state.qdrant,
            groq=request.app.state.groq,
        )
        try:
            result = WebsiteAnalysisService(ctx).run()
        except AnalysisError as exc:
            return _error_response(exc)
        except Exception as exc:  # noqa: BLE001
            log.exception("analyze_website crashed", extra={"business_id": body.business_id})
            return JSONResponse(
                status_code=500,
                content={"error": {"code": "internal_error", "message": str(exc)}},
            )

    return result


def _error_response(exc: AnalysisError) -> JSONResponse:
    log.warning(
        "analysis failed: %s",
        str(exc),
        extra={"code": exc.code, "status": exc.status_code},
    )
    return JSONResponse(
        status_code=exc.status_code,
        content={"error": {"code": exc.code, "message": str(exc)}},
    )
