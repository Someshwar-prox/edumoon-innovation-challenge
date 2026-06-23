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

@router.post(
    "/generate-description",
    summary="Generate a business description from a URL and/or Name.",
    response_model=dict,
)
async def generate_description(
    body: dict, request: Request
) -> JSONResponse:
    from app.api.schemas import GenerateDescriptionRequest, GenerateDescriptionResponse
    req_body = GenerateDescriptionRequest(**body)
    if not request.app.state.groq:
        return JSONResponse(status_code=503, content={"error": {"code": "llm_unavailable", "message": "Groq LLM is not configured"}})

    text = ""
    if req_body.url:
        import httpx
        from bs4 import BeautifulSoup
        try:
            resp = httpx.get(req_body.url, timeout=10, follow_redirects=True)
            soup = BeautifulSoup(resp.text, "html.parser")
            text = soup.get_text(separator=" ", strip=True)[:5000]
        except Exception as e:
            log.warning(f"Failed to fetch {req_body.url} for description gen: {e}")

    system = "You are an expert business analyst and copywriter."
    company_name = req_body.name or 'this company'
    prompt = f"Write a professional 2-sentence business description for '{company_name}'. Do not say 'Here is a description' or anything else, just return the raw description text. "
    if text:
        prompt += f"Base it accurately on this website text: {text}"
    else:
        prompt += "Base it purely on the company name."

    try:
        desc = request.app.state.groq.complete_chat(system, prompt)
        return JSONResponse(status_code=200, content={"description": desc})
    except Exception as exc:
        return JSONResponse(status_code=502, content={"error": {"code": "groq_failed", "message": str(exc)}})
