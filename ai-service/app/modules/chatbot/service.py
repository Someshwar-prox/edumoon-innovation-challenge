"""Service layer for the chatbot module.

Stateless RAG over kb_master. Mirrors the Day-2 / Day-3 pattern:
Context dataclass + Service class + ChatError hierarchy with
status_code + code + per-stage JSON logs.
"""
from __future__ import annotations

import logging
import time
import uuid
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Any, Protocol

from qdrant_client.http import models as qmodels

from app.core.config import settings
from app.core.groq_client import GroqUnavailable
from app.core.qdrant import COLLECTION_KB_MASTER
from app.modules.chatbot.errors import (
    BusinessNotFound,
    ChatError,
    LLMNotConfigured,
    UpstreamLLMFailed,
    VectorDBUnreachable,
)
from app.modules.chatbot.prompts import (
    DEFAULT_NO_HITS_ANSWER,
    SYSTEM_PROMPT,
    build_user_prompt,
)
from app.modules.chatbot.schemas import ChatResponse, Citation

log = logging.getLogger(__name__)

SNIPPET_MAX_CHARS = 300


class EmbeddingLike(Protocol):
    def embed_query(self, query: str) -> list[float]: ...


class QdrantLike(Protocol):
    def search(self, *, collection_name: str, query_vector: list[float], query_filter: Any,
               limit: int, score_threshold: float, with_payload: bool) -> list: ...
    def count(self, *, collection_name: str, count_filter: Any) -> Any: ...


class GroqLike(Protocol):
    def complete_chat(self, system: str, user: str) -> str: ...


@dataclass
class ChatContext:
    business_id: str
    question: str
    top_k: int
    score_threshold: float
    embedding_model: EmbeddingLike
    qdrant: QdrantLike
    groq: GroqLike | None


class ChatService:
    def __init__(self, ctx: ChatContext) -> None:
        self.ctx = ctx
        self.chat_id = str(uuid.uuid4())
        self._t0 = time.perf_counter()

    def run(self) -> ChatResponse:
        log_ctx = {
            "chat_id": self.chat_id,
            "business_id": self.ctx.business_id,
            "top_k": self.ctx.top_k,
            "score_threshold": self.ctx.score_threshold,
            "stage": "start",
        }
        log.info("chat started", extra=log_ctx)

        t = time.perf_counter()
        if self.ctx.embedding_model is None:
            raise LLMNotConfigured("embedding model not configured")
        query_vec = self.ctx.embedding_model.embed_query(self.ctx.question)
        log.info(
            "embedded query",
            extra={**log_ctx, "stage": "embed", "dim": len(query_vec),
                   "duration_ms": int((time.perf_counter() - t) * 1000)},
        )

        if self.ctx.qdrant is None:
            raise VectorDBUnreachable("qdrant client not configured")

        flt = qmodels.Filter(must=[
            qmodels.FieldCondition(
                key="business_id",
                match=qmodels.MatchValue(value=self.ctx.business_id),
            )
        ])

        t = time.perf_counter()
        try:
            count_result = self.ctx.qdrant.count(
                collection_name=COLLECTION_KB_MASTER,
                count_filter=flt,
            )
        except Exception as exc:  # noqa: BLE001
            raise VectorDBUnreachable(f"qdrant count failed: {exc}") from exc

        total = getattr(count_result, "count", None) or 0
        if total == 0:
            log.info(
                "business has no vectors",
                extra={**log_ctx, "stage": "count", "count": 0,
                       "duration_ms": int((time.perf_counter() - t) * 1000)},
            )
            raise BusinessNotFound(f"no indexed content for business_id={self.ctx.business_id}")

        t = time.perf_counter()
        try:
            hits = self.ctx.qdrant.search(
                collection_name=COLLECTION_KB_MASTER,
                query_vector=query_vec,
                query_filter=flt,
                limit=self.ctx.top_k,
                score_threshold=self.ctx.score_threshold,
                with_payload=True,
            )
        except Exception as exc:  # noqa: BLE001
            raise VectorDBUnreachable(f"qdrant search failed: {exc}") from exc

        log.info(
            "search done",
            extra={**log_ctx, "stage": "search", "hits": len(hits),
                   "duration_ms": int((time.perf_counter() - t) * 1000)},
        )

        if not hits:
            return ChatResponse(
                answer=DEFAULT_NO_HITS_ANSWER,
                citations=[],
                model=settings.groq_model if self.ctx.groq else "",
                asked_at=datetime.now(timezone.utc),
            )

        hit_dicts = [_hit_to_dict(h) for h in hits]
        context_hits, _chars = _cap_context(hit_dicts, settings.chat_max_context_chars)

        if self.ctx.groq is None:
            raise LLMNotConfigured("GROQ_API_KEY not set")

        user_prompt = build_user_prompt(self.ctx.question, context_hits)
        t = time.perf_counter()
        try:
            answer_text = self.ctx.groq.complete_chat(SYSTEM_PROMPT, user_prompt)
        except GroqUnavailable as exc:
            raise UpstreamLLMFailed(str(exc)) from exc

        log.info(
            "llm answered",
            extra={**log_ctx, "stage": "llm", "answer_chars": len(answer_text),
                   "duration_ms": int((time.perf_counter() - t) * 1000)},
        )

        citations = [_hit_to_citation(h) for h in hits]

        response = ChatResponse(
            answer=answer_text,
            citations=citations,
            model=settings.groq_model,
            asked_at=datetime.now(timezone.utc),
        )
        log.info(
            "chat done",
            extra={
                **log_ctx,
                "stage": "done",
                "citations": len(citations),
                "duration_ms": int((time.perf_counter() - self._t0) * 1000),
            },
        )
        return response


def _hit_to_dict(hit) -> dict:
    """Coerce a ScoredPoint (or a plain dict in tests) into a flat dict."""
    if isinstance(hit, dict):
        return hit
    payload = getattr(hit, "payload", {}) or {}
    return {
        "score": float(getattr(hit, "score", 0.0)),
        "source_type": payload.get("source_type", "website"),
        "source_id": payload.get("source_id", ""),
        "section_title": payload.get("section_title"),
        "filename": payload.get("filename"),
        "page_number": payload.get("page_number"),
        "text": payload.get("text", ""),
        **{k: v for k, v in payload.items() if k not in {
            "score", "source_type", "source_id", "section_title",
            "filename", "page_number", "text",
        }},
    }


def _hit_to_citation(hit) -> Citation:
    d = _hit_to_dict(hit)
    text = (d.get("text") or "")[:SNIPPET_MAX_CHARS]
    return Citation(
        source_type=d.get("source_type", "website"),
        source_id=d.get("source_id", ""),
        section_title=d.get("section_title"),
        filename=d.get("filename"),
        page_number=d.get("page_number"),
        score=float(d.get("score", 0.0)),
        snippet=text,
    )


def _cap_context(hits: list[dict], max_chars: int) -> tuple[list[dict], int]:
    """Greedily include hits until the context budget is exhausted."""
    out: list[dict] = []
    used = 0
    for h in hits:
        text = h.get("text") or ""
        cost = len(text) + 50
        if used + cost > max_chars and out:
            break
        out.append(h)
        used += cost
    return out, used
