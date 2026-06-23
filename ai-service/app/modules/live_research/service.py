"""Service layer for the live research module.

Combines:
  1. The company's own knowledge base (existing kb_master RAG).
  2. Fresh public web results fetched at query time.
  3. Industry-best-practice fallback for advice-mode questions.

The LLM is told the current date and is given two prompt strategies
(answer vs advice) — see prompts.py.
"""
from __future__ import annotations

import asyncio
import hashlib
import logging
import time
import uuid
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Any, Protocol

from qdrant_client.http import models as qmodels

from app.core.config import settings
from app.core.kb_mirror import mirror_to_kb_master
from app.core.qdrant import COLLECTION_KB_MASTER, COLLECTION_LIVE_RESEARCH
from app.modules.live_research.errors import (
    LiveResearchError,
    LLMNotConfigured,
    UpstreamSearchFailed,
)
from app.modules.live_research.prompts import (
    ADVICE_SYSTEM,
    ANSWER_SYSTEM,
    build_context_block,
    is_advice_question,
)
from app.modules.live_research.public_sources import (
    build_live_source_queries,
    fetch_url_text,
    multi_source_search,
)
from app.modules.live_research.schemas import (
    LiveResearchCitation,
    LiveResearchResponse,
)

log = logging.getLogger(__name__)

SNIPPET_MAX_CHARS = 400


class EmbeddingLike(Protocol):
    def embed_query(self, query: str) -> list[float]: ...


class QdrantLike(Protocol):
    def search(self, *, collection_name: str, query_vector: list[float], query_filter: Any,
               limit: int, score_threshold: float, with_payload: bool) -> list: ...
    def upsert(self, *, collection_name: str, points: list, wait: bool) -> None: ...


class GroqLike(Protocol):
    def complete_chat(self, system: str, user: str) -> str: ...


@dataclass
class LiveResearchContext:
    business_id: str
    question: str
    company_name: str | None
    company_url: str | None
    include_live_web: bool
    top_k: int
    embedding_model: EmbeddingLike
    qdrant: QdrantLike
    groq: GroqLike | None


class LiveResearchService:
    def __init__(self, ctx: LiveResearchContext) -> None:
        self.ctx = ctx
        self.research_id = str(uuid.uuid4())
        self._t0 = time.perf_counter()

    # ------------------------------------------------------------------
    # Main entrypoint
    # ------------------------------------------------------------------
    def run(self) -> LiveResearchResponse:
        advice_mode = is_advice_question(self.ctx.question)
        log_ctx = {
            "research_id": self.research_id,
            "business_id": self.ctx.business_id,
            "advice_mode": advice_mode,
        }
        log.info("live research started", extra=log_ctx)

        # 1) Pull the company's own knowledge (cheap, always)
        own_hits = self._fetch_own_kb()
        # 2) Optionally pull live public web (slower, network-bound)
        live_hits: list[dict] = []
        sources_scanned = len(own_hits)
        strategy_parts = ["own knowledge base"]

        if self.ctx.include_live_web:
            try:
                live_hits, strategy = asyncio.run(
                    self._fetch_live_web()
                )
                sources_scanned += len(live_hits)
                strategy_parts.append(strategy)
            except Exception as exc:  # noqa: BLE001
                log.warning("live web fetch failed: %s", exc)
                # Non-fatal — fall back to own KB only.

        # 3) If we have absolutely nothing, give the LLM a chance to
        #    use pure industry best practice.
        if not own_hits and not live_hits and not advice_mode:
            advice_mode = True  # force advice mode so user gets SOMETHING

        # 4) Build the prompt
        context_block = build_context_block(
            self.ctx.question, own_hits, live_hits
        )
        system = ADVICE_SYSTEM if advice_mode else ANSWER_SYSTEM

        # 5) Call the LLM
        if self.ctx.groq is None:
            raise LLMNotConfigured("groq not configured")
        try:
            answer = self.ctx.groq.complete_chat(system, context_block)
        except Exception as exc:  # noqa: BLE001
            log.exception("groq call failed", extra=log_ctx)
            raise UpstreamSearchFailed(str(exc)) from exc

        # 6) Build citations from both sources
        citations = self._build_citations(own_hits, live_hits)

        # 7) Persist the live_web hits into kb_master with a special
        #    source_type so future chats can re-use them.
        if self.ctx.include_live_web and live_hits:
            self._mirror_live_hits(live_hits)

        log.info(
            "live research done",
            extra={
                **log_ctx,
                "duration_ms": int((time.perf_counter() - self._t0) * 1000),
                "own_hits": len(own_hits),
                "live_hits": len(live_hits),
            },
        )

        return LiveResearchResponse(
            answer=answer,
            citations=citations,
            model=settings.groq_model,
            asked_at=datetime.now(timezone.utc),
            sources_scanned=sources_scanned,
            research_strategy=" + ".join(strategy_parts),
            is_advice_mode=advice_mode,
        )

    # ------------------------------------------------------------------
    # Step 1 — own KB
    # ------------------------------------------------------------------
    def _fetch_own_kb(self) -> list[dict]:
        if self.ctx.embedding_model is None or self.ctx.qdrant is None:
            return []
        try:
            qvec = self.ctx.embedding_model.embed_query(self.ctx.question)
        except Exception as exc:  # noqa: BLE001
            log.warning("embed failed: %s", exc)
            return []
        flt = qmodels.Filter(must=[
            qmodels.FieldCondition(
                key="business_id",
                match=qmodels.MatchValue(value=self.ctx.business_id),
            )
        ])
        try:
            hits = self.ctx.qdrant.search(
                collection_name=COLLECTION_KB_MASTER,
                query_vector=qvec,
                query_filter=flt,
                limit=self.ctx.top_k,
                score_threshold=0.20,  # lower than chatbot's 0.30 — we want
                # looser matches so advice mode has something to work with
                with_payload=True,
            )
        except Exception as exc:  # noqa: BLE001
            log.warning("own kb search failed: %s", exc)
            return []
        return [self._hit_to_dict(h) for h in hits]

    # ------------------------------------------------------------------
    # Step 2 — live public web
    # ------------------------------------------------------------------
    async def _fetch_live_web(self) -> tuple[list[dict], str]:
        queries = build_live_source_queries(
            self.ctx.company_name, self.ctx.company_url, self.ctx.question
        )
        strategy = f"live web ({len(queries)} queries)"
        all_hits: list[dict] = []
        for q in queries:
            try:
                results = await multi_source_search(q, limit_per_backend=4)
            except Exception as exc:  # noqa: BLE001
                log.warning("multi_source_search failed for %r: %s", q, exc)
                continue
            for hit in results[:4]:
                body = await fetch_url_text(hit.url, max_chars=2500)
                if not body:
                    # fall back to whatever the search engine gave us
                    all_hits.append({
                        "title": hit.title,
                        "url": hit.url,
                        "text": (hit.snippet or "")[:SNIPPET_MAX_CHARS],
                        "source_type": "live_web",
                    })
                else:
                    title, text = body
                    all_hits.append({
                        "title": title or hit.title,
                        "url": hit.url,
                        "text": text[:SNIPPET_MAX_CHARS],
                        "source_type": "live_web",
                    })
            # Keep total under control
            if len(all_hits) >= 12:
                break
        return all_hits, strategy

    # ------------------------------------------------------------------
    # Citations
    # ------------------------------------------------------------------
    def _build_citations(
        self, own_hits: list[dict], live_hits: list[dict]
    ) -> list[LiveResearchCitation]:
        cites: list[LiveResearchCitation] = []
        for h in own_hits:
            cites.append(
                LiveResearchCitation(
                    source_type=h.get("source_type", "website"),
                    source_id=h.get("source_id", ""),
                    section_title=h.get("section_title"),
                    filename=h.get("filename"),
                    page_number=h.get("page_number"),
                    score=float(h.get("score", 0.0)),
                    snippet=(h.get("text") or "")[:SNIPPET_MAX_CHARS],
                )
            )
        for h in live_hits:
            cites.append(
                LiveResearchCitation(
                    source_type="live_web",
                    source_id=h.get("url", ""),
                    section_title=h.get("title"),
                    score=0.5,  # flat — we didn't rank these
                    snippet=(h.get("text") or h.get("snippet") or "")[:SNIPPET_MAX_CHARS],
                )
            )
        return cites

    # ------------------------------------------------------------------
    # Mirror live results into kb_master so future chats can use them
    # ------------------------------------------------------------------
    def _mirror_live_hits(self, live_hits: list[dict]) -> None:
        if self.ctx.qdrant is None or self.ctx.embedding_model is None:
            return
        for i, hit in enumerate(live_hits):
            try:
                vec = self.ctx.embedding_model.embed_query(
                    (hit.get("text") or "")[:1000]
                )
            except Exception:
                continue
            try:
                self.ctx.qdrant.upsert(
                    collection_name=COLLECTION_LIVE_RESEARCH,
                    points=[qmodels.PointStruct(
                        id=self._live_id(i),
                        vector=vec,
                        payload={
                            "business_id": self.ctx.business_id,
                            "url": hit.get("url"),
                            "title": hit.get("title"),
                            "text": (hit.get("text") or "")[:1500],
                            "fetched_at": datetime.now(timezone.utc).isoformat(),
                        },
                    )],
                    wait=False,
                )
            except Exception as exc:  # noqa: BLE001
                log.debug("mirror_live_hits upsert failed: %s", exc)

    def _live_id(self, idx: int) -> str:
        raw = f"{self.ctx.business_id}|{self.ctx.question}|{idx}"
        return hashlib.sha1(raw.encode("utf-8")).hexdigest()[:32]

    @staticmethod
    def _hit_to_dict(hit) -> dict:
        payload = getattr(hit, "payload", {}) or {}
        return {
            "text": payload.get("text") or payload.get("chunk_text") or "",
            "source_id": payload.get("source_id") or "",
            "source_type": payload.get("source_type", "website"),
            "section_title": payload.get("section_title"),
            "filename": payload.get("filename"),
            "page_number": payload.get("page_number"),
            "score": float(getattr(hit, "score", 0.0) or 0.0),
        }


def ensure_live_collection(qdrant) -> None:
    """Create the live_research collection on first use.

    Idempotent — safe to call on every request.
    """
    try:
        from app.core.config import settings as cfg
        qdrant.create_collection(
            collection_name=COLLECTION_LIVE_RESEARCH,
            vectors_config=qmodels.VectorParams(
                size=cfg.embedding_dim,
                distance=qmodels.Distance.COSINE,
            ),
        )
    except Exception:
        # Collection already exists — that's the common case.
        pass
