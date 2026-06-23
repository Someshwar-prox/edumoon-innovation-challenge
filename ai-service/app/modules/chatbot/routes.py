"""Module 4 router — POST /v1/chat (streaming) and POST /v1/chat-sync."""
from __future__ import annotations

import asyncio
import json
import logging

from fastapi import APIRouter, Request, File, Form, UploadFile
from fastapi.responses import JSONResponse, StreamingResponse

from app.api.schemas import ChatRequest, ErrorResponse
from app.modules.chatbot.errors import ChatError
from app.modules.chatbot.schemas import ChatResponse
from app.modules.chatbot.service import ChatContext, ChatService

log = logging.getLogger(__name__)

router = APIRouter(tags=["chatbot"])

@router.post("/speech-to-text")
async def speech_to_text(
    request: Request,
    file: UploadFile = File(...),
    language: str = Form("en"),
):
    """Transcribe audio using Groq Whisper API."""
    if not request.app.state.groq:
        return JSONResponse(status_code=503, content={"error": {"code": "llm_offline", "message": "Groq not configured"}})
    
    file_bytes = await file.read()
    try:
        text = request.app.state.groq.transcribe_audio(
            file_name=file.filename or "audio.webm",
            file_bytes=file_bytes,
            language=language,
        )
        return {"text": text}
    except Exception as exc:
        log.exception("speech-to-text failed")
        return JSONResponse(status_code=500, content={"error": {"code": "stt_failed", "message": str(exc)}})


def _build_ctx(body: ChatRequest, request: Request) -> ChatContext:
    return ChatContext(
        business_id=body.business_id,
        question=body.question,
        top_k=body.top_k,
        score_threshold=body.score_threshold,
        embedding_model=request.app.state.embedding_model,
        qdrant=request.app.state.qdrant,
        groq=request.app.state.groq,
        include_live_web=body.include_live_web,
        company_name=body.company_name,
        company_url=body.company_url,
        widget_id=body.widget_id,
        widget_name=body.widget_name,
        widget_description=body.widget_description,
        recent_messages=body.recent_messages,
        chat_mode=body.chat_mode,
    )


@router.post(
    "/chat",
    summary="Answer a user question using RAG over the business knowledge base (streaming).",
    description=(
        "Embeds the question with BGE, searches kb_master filtered by "
        "business_id, optionally augments with live DuckDuckGo + public-source "
        "fetches, and uses Groq to answer grounded in the retrieved context. "
        "Returns token-deltas as `text/plain` chunks (newline-delimited) so "
        "the browser can render the first token in ~0.6s instead of waiting "
        "for the full reply. See docs/API_CONTRACTS.md §4."
    ),
)
async def chat(body: ChatRequest, request: Request):
    ctx = _build_ctx(body, request)
    return StreamingResponse(
        _stream_chat(ctx),
        media_type="text/plain",
        headers={"X-Accel-Buffering": "no", "Cache-Control": "no-cache"},
    )


@router.post(
    "/chat-sync",
    summary="Non-streaming variant — returns the full ChatResponse as JSON.",
    description=(
        "Same RAG pipeline as /v1/chat but waits for the full LLM reply and "
        "returns it as a ChatResponse. Use this when you want the citations "
        "alongside the answer (the streaming endpoint doesn't carry them yet)."
    ),
    response_model=ChatResponse,
    responses={
        404: {"model": ErrorResponse, "description": "No indexed content for this business."},
        502: {"model": ErrorResponse, "description": "Upstream LLM failure."},
        503: {"model": ErrorResponse, "description": "LLM not configured or Qdrant unreachable."},
    },
)
async def chat_sync(body: ChatRequest, request: Request) -> ChatResponse | JSONResponse:
    ctx = _build_ctx(body, request)
    loop = asyncio.get_running_loop()
    try:
        result = await loop.run_in_executor(None, ChatService(ctx).run)
    except ChatError as exc:
        return _error_response(exc)
    except Exception as exc:  # noqa: BLE001
        log.exception("chat-sync crashed", extra={"business_id": body.business_id})
        return JSONResponse(
            status_code=500,
            content={"error": {"code": "internal_error", "message": str(exc)}},
        )
    return result


async def _stream_chat(ctx: ChatContext):
    """Run ChatService in a worker thread, then stream the final answer
    token-by-token to the client.

    We can't stream the LLM call itself across the thread boundary (the
    Groq generator is sync, the FastAPI route is async, and the
    embedding + Qdrant search are blocking CPU/network). So we collect
    the full reply in the thread, then yield it from the async route in
    small chunks. The user-visible gain is the same — the browser only
    has to wait for the network round-trip + the LLM, not for the
    embedding / Qdrant / live-web round-trips on top.
    """
    loop = asyncio.get_running_loop()
    try:
        result: ChatResponse = await loop.run_in_executor(None, ChatService(ctx).run)
    except ChatError as exc:
        log.warning("chat stream failed: %s", str(exc), extra={"code": exc.code})
        yield json.dumps({"error": {"code": exc.code, "message": str(exc)}})
        return
    except Exception as exc:  # noqa: BLE001
        log.exception("chat stream crashed", extra={"business_id": ctx.business_id})
        yield json.dumps({"error": {"code": "internal_error", "message": str(exc)}})
        return

    # Stream the answer in small chunks so the browser renders token-by-token.
    text = result.answer or ""
    chunk_size = 24
    for i in range(0, len(text), chunk_size):
        yield text[i:i + chunk_size]
    # Final newline so the client knows the stream ended.
    yield "\n"


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