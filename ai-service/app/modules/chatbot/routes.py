"""Module 4 router — POST /v1/chat."""
from __future__ import annotations

import logging

from fastapi import APIRouter, Request
from fastapi.responses import JSONResponse

from app.api.schemas import ChatRequest, ErrorResponse
from app.modules.chatbot.errors import ChatError
from app.modules.chatbot.schemas import ChatResponse
from app.modules.chatbot.service import ChatContext, ChatService

log = logging.getLogger(__name__)

router = APIRouter(tags=["chatbot"])


@router.post(
    "/chat",
    summary="Answer a user question using RAG over the business knowledge base.",
    description="Embeds the question with BGE, searches kb_master filtered by business_id, and uses Groq to answer grounded in the retrieved context. Returns citations. See docs/API_CONTRACTS.md §4.",
    response_model=ChatResponse,
    responses={
        404: {"model": ErrorResponse, "description": "No indexed content for this business."},
        502: {"model": ErrorResponse, "description": "Upstream LLM failure."},
        503: {"model": ErrorResponse, "description": "LLM not configured or Qdrant unreachable."},
    },
)
async def chat(body: ChatRequest, request: Request) -> ChatResponse | JSONResponse:
    ctx = ChatContext(
        business_id=body.business_id,
        question=body.question,
        top_k=body.top_k,
        score_threshold=body.score_threshold,
        embedding_model=request.app.state.embedding_model,
        qdrant=request.app.state.qdrant,
        groq=request.app.state.groq,
    )
    try:
        result = ChatService(ctx).run()
    except ChatError as exc:
        return _error_response(exc)
    except Exception as exc:  # noqa: BLE001
        log.exception("chat crashed", extra={"business_id": body.business_id})
        return JSONResponse(
            status_code=500,
            content={"error": {"code": "internal_error", "message": str(exc)}},
        )
    return result


def _error_response(exc: ChatError) -> JSONResponse:
    log.warning(
        "chat failed: %s",
        str(exc),
        extra={"code": exc.code, "status": exc.status_code},
    )
    return JSONResponse(
        status_code=exc.status_code,
        content={"error": {"code": exc.code, "message": str(exc)}},
    )
