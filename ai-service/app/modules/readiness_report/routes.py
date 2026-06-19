"""Module 3 router — POST /v1/generate-report."""
from __future__ import annotations

import logging

from fastapi import APIRouter, Request
from fastapi.responses import JSONResponse

from app.api.schemas import GenerateReportRequest
from app.modules.readiness_report.errors import ReadinessError, InvalidRequest
from app.modules.readiness_report.prompts import ALL_FOCUS_AREAS
from app.modules.readiness_report.schemas import ReadinessReport
from app.modules.readiness_report.service import (
    ReadinessContext,
    ReadinessReportService,
)

log = logging.getLogger(__name__)

router = APIRouter(tags=["readiness-report"])


@router.post(
    "/generate-report",
    summary="Generate an AI readiness report from website + document content.",
    description="Gathers evidence from kb_master via a curated question bank, calls Groq in JSON-mode, returns a structured report, and persists a snapshot into readiness_reports. See docs/API_CONTRACTS.md §3.",
    response_model=ReadinessReport,
    responses={
        400: {"description": "Invalid request (bad focus_areas)."},
        404: {"description": "No indexed content for this business."},
        502: {"description": "Upstream LLM failure."},
        503: {"description": "LLM not configured or Qdrant unreachable."},
    },
)
async def generate_report(
    body: GenerateReportRequest, request: Request
) -> ReadinessReport | JSONResponse:
    # Belt-and-braces: pydantic already enforces the literal FocusArea set,
    # but if a caller bypasses validation we still want our error envelope.
    if body.focus_areas:
        bad = [a for a in body.focus_areas if a not in ALL_FOCUS_AREAS]
        if bad:
            return _error_response(
                InvalidRequest(
                    f"unknown focus_areas: {bad}; allowed: {list(ALL_FOCUS_AREAS)}"
                )
            )

    ctx = ReadinessContext(
        business_id=body.business_id,
        focus_areas=list(body.focus_areas) if body.focus_areas else None,
        include_documents=body.include_documents,
        language=body.language,
        embedding_model=request.app.state.embedding_model,
        qdrant=request.app.state.qdrant,
        groq=request.app.state.groq,
    )
    try:
        result = ReadinessReportService(ctx).run()
    except ReadinessError as exc:
        return _error_response(exc)
    except Exception as exc:  # noqa: BLE001
        log.exception("generate_report crashed", extra={"business_id": body.business_id})
        return JSONResponse(
            status_code=500,
            content={"error": {"code": "internal_error", "message": str(exc)}},
        )
    return result


def _error_response(exc: ReadinessError) -> JSONResponse:
    log.warning(
        "generate_report failed: %s",
        str(exc),
        extra={"code": exc.code, "status": exc.status_code},
    )
    return JSONResponse(
        status_code=exc.status_code,
        content={"error": {"code": exc.code, "message": str(exc)}},
    )
