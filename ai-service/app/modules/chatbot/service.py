"""Service layer for the chatbot module.

Stateless RAG over kb_master with optional live-web augmentation. When
`include_live_web=True` (default), the service ALSO fires DuckDuckGo + a
few public-source fetches at query time and merges the live hits into the
LLM context alongside the company's own KB. Mirrors the Day-2 / Day-3 pattern:
Context dataclass + Service class + ChatError hierarchy with status_code
+ code + per-stage JSON logs.
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
from app.core.groq_client import GroqUnavailable
from app.core.qdrant import COLLECTION_KB_MASTER, COLLECTION_LIVE_RESEARCH, COLLECTION_WEBSITE_PAGES
from app.modules.chatbot.errors import (
    BusinessNotFound,
    ChatError,
    LLMNotConfigured,
    UpstreamLLMFailed,
    VectorDBUnreachable,
)
from app.modules.chatbot.prompts import (
    ADVISOR_SYSTEM_PROMPT,
    DEFAULT_NO_HITS_ANSWER,
    GENERAL_SYSTEM_PROMPT,
    LIVE_WEB_ONLY_SYSTEM_PROMPT,
    build_advisor_system_prompt,
    build_user_prompt,
    is_small_talk,
    small_talk_reply,
)
from app.modules.chatbot.schemas import ChatResponse, Citation
from app.modules.live_research.public_sources import (
    build_live_source_queries,
    fetch_url_text,
    multi_source_search,
)

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
    def stream_chat(self, system: str, user: str): ...


@dataclass
class ChatContext:
    business_id: str
    question: str
    top_k: int
    score_threshold: float
    embedding_model: EmbeddingLike
    qdrant: QdrantLike
    groq: GroqLike | None
    include_live_web: bool = True
    company_name: str | None = None
    company_url: str | None = None
    widget_id: str | None = None
    widget_name: str | None = None
    widget_description: str | None = None
    recent_messages: list[dict] | None = None
    chat_mode: str = "text"


def _requires_live_web(question: str, groq_client: GroqLike | None) -> bool:
    """Fast check to see if the query actually needs web research."""
    if not groq_client:
        return False
    if len(question.strip()) < 5:
        return False
    prompt = (
        "Does this user query require searching the live internet for external "
        "competitors, reviews, news, recent events, or tech stacks? Answer ONLY 'YES' or 'NO'.\n"
        f"Query: {question}"
    )
    try:
        ans = groq_client.complete_chat("You are a classification bot.", prompt)
        return "YES" in ans.strip().upper()
    except Exception:
        return False


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

        # ------------------------------------------------------------------
        # Short-circuit on small talk ("hi", "hello", "thanks") — no LLM
        # call, no live-web search, no Qdrant hits. Just a friendly reply
        # that points the user at what they can actually ask.
        # ------------------------------------------------------------------
        if not (self.ctx.widget_name or self.ctx.widget_description) and is_small_talk(self.ctx.question):
            return ChatResponse(
                answer=small_talk_reply(
                    self.ctx.question, self.ctx.company_name
                ),
                citations=[],
                model="",
                asked_at=datetime.now(timezone.utc),
            )

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
        live_web_possible = (
            self.ctx.include_live_web
            and settings.live_web_enabled
            and self.ctx.embedding_model is not None
        )

        # ------------------------------------------------------------------
        # Empty-KB fallthrough. Three cases:
        #
        #   1. total > 0  → normal path, just do the Qdrant search below.
        #   2. total == 0 AND live_web_possible AND chat_auto_crawl_on_empty_kb
        #      AND a URL was supplied → fire a one-shot auto-crawl so
        #      the chatbot has first-party data on the very first chat.
        #      If the crawl succeeds, fall through to the normal path.
        #      If it fails, fall through to live-web only.
        #   3. total == 0 AND live_web_possible → skip the failure
        #      entirely and run on live-web (DuckDuckGo + Wikipedia)
        #      alone. The LLM gets a brief explanation prompt about
        #      the situation so it doesn't pretend to know the business.
        #
        # Only raise BusinessNotFound when the user has explicitly opted
        # out of live-web AND has nothing indexed — that preserves the
        # existing 404 contract for callers that want to know.
        # ------------------------------------------------------------------
        # When the user has no vectors AND a URL was supplied, kick off
        # a one-shot auto-crawl so the chatbot has first-party data on
        # the very first chat. Same logic as before, except we now do
        # the delete-then-insert via analyze_website's service path so
        # any previously-indexed chunks for this business get cleared
        # too (otherwise switching URLs leaves ghost Bookzstore hits in
        # the KB even after the user pastes a new website URL).
        if total == 0 and settings.chat_auto_crawl_on_empty_kb and self.ctx.company_url:
            seeded = self._auto_crawl(self.ctx.company_url, log_ctx)
            if seeded:
                total = seeded  # re-count after seed
            elif total == 0 and live_web_possible:
                # The auto-crawl returned 0 pages. If there ARE old
                # website vectors in kb_master from a previous
                # business (e.g. the user re-used this business_id after
                # switching websites), they would still match and we'd
                # answer from stale data. Wipe them so the live-web
                # fallback is the only context we send the LLM.
                self._wipe_website_vectors(log_ctx)

        if total == 0 and not live_web_possible:
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

        if not hits and not live_web_possible:
            return ChatResponse(
                answer=DEFAULT_NO_HITS_ANSWER,
                citations=[],
                model=settings.groq_model if self.ctx.groq else "",
                asked_at=datetime.now(timezone.utc),
            )

        # (Grounding guard moved to after live-web)

        hit_dicts = [_hit_to_dict(h) for h in hits]
        context_hits, _chars = _cap_context(hit_dicts, settings.chat_max_context_chars)

        # Save the kb hits so we can return citations for them AFTER the
        # live-web merge below. Otherwise, _cap_context() may have dropped
        # some of them and we'd lose the matching citation.
        kb_hits = list(context_hits)

        # ------------------------------------------------------------------
        # Live-web augmentation (DuckDuckGo + public-source fetches).
        # Runs INLINE here (not in a separate endpoint) so every /v1/chat
        # call can be web-augmented by default. Failures are non-fatal.
        # ------------------------------------------------------------------
        if (
            self.ctx.include_live_web
            and settings.live_web_enabled
            and self.ctx.embedding_model is not None
            and _requires_live_web(self.ctx.question, self.ctx.groq)
        ):
            try:
                # ChatService runs in a worker thread (via run_in_executor),
                # so there's no running event loop here — we can call
                # asyncio.run() directly. We import the helper locally to
                # avoid touching the module-level imports of _run_async.
                live_hits, live_strategy = asyncio.run(self._fetch_live_web())
                if live_hits:
                    # Tag each live hit so the LLM prompt + citations
                    # distinguish them from the company's own KB.
                    for lh in live_hits:
                        lh["source_type"] = "live_web"
                    context_hits = context_hits + live_hits
                    log.info(
                        "live-web augmentation",
                        extra={
                            **log_ctx, "stage": "live_web",
                            "live_hits": len(live_hits),
                            "strategy": live_strategy,
                            "duration_ms": int(
                                (time.perf_counter() - self._t0) * 1000
                            ),
                        },
                    )
                    # Persist into live_research collection (best effort).
                    self._mirror_live_hits(live_hits)
            except Exception as exc:  # noqa: BLE001
                log.warning(
                    "live-web fetch failed (continuing with KB only): %s",
                    exc, extra={**log_ctx, "stage": "live_web"},
                )

        # ------------------------------------------------------------------
        # Empty-context grounding guard.
        # If we found no KB hits AND no live-web hits, we risk LLM hallucination.
        # For onboarding (generic), we bail out. For custom widgets, we allow
        # empty context so the LLM can still chat using its Persona/Skill.
        # ------------------------------------------------------------------
        if not context_hits:
            is_widget = bool(self.ctx.widget_name or self.ctx.widget_description)
            if not is_widget:
                name = (self.ctx.company_name or "this business").strip() or "this business"
                return ChatResponse(
                    answer=(
                        f"I don't have any indexed information about {name} yet. "
                        "Try re-crawling the website from the onboarding page or "
                        "uploading a document — then ask again."
                    ),
                    citations=[],
                    model=settings.groq_model if self.ctx.groq else "",
                    asked_at=datetime.now(timezone.utc),
                )

        if self.ctx.groq is None:
            raise LLMNotConfigured("GROQ_API_KEY not set")

        # Re-cap the merged context so live-web hits don't blow the
        # context budget. Without this, 12 live hits at 2000 chars each
        # = 24000 chars, way over chat_max_context_chars.
        context_hits, _ = _cap_context(
            context_hits, settings.chat_max_context_chars
        )

        # Choose the system prompt based on whether the user has
        # indexed their own site/docs. If they DO, force the advisor
        # persona (anchors to the user's data, suppresses generic
        # Wikipedia noise). If they DON'T, use the live-web-only prompt
        # when we have live_web hits (warns the LLM that there's no
        # first-party data and the whole context is from the open web),
        # otherwise the general research-assistant prompt.
        has_own_data = any(
            h.get("source_type") in ("website", "document")
            for h in context_hits
        )
        has_live_hits = any(
            h.get("source_type") == "live_web" for h in context_hits
        )
        if has_own_data:
            base_prompt = ADVISOR_SYSTEM_PROMPT
        elif has_live_hits:
            base_prompt = LIVE_WEB_ONLY_SYSTEM_PROMPT
        else:
            base_prompt = GENERAL_SYSTEM_PROMPT

        system_prompt = build_advisor_system_prompt(
            base_prompt=base_prompt,
            company_name=self.ctx.company_name,
            company_url=self.ctx.company_url,
            chat_mode=self.ctx.chat_mode,
            widget_name=self.ctx.widget_name,
            widget_description=self.ctx.widget_description,
        )

        user_prompt = build_user_prompt(self.ctx.question, context_hits)
        # Prepend the last few messages from this same session so the
        # advisor remembers what the user just asked. Without this the
        # advisor answers each turn in isolation and can't tie
        # "what was my second question?" back to its history.
        if self.ctx.recent_messages:
            history = list(self.ctx.recent_messages)
            tail = "\n\n".join(
                f"{m.get('role', 'user').upper()}: {(m.get('content') or '').strip()}"
                for m in history
                if (m.get("content") or "").strip()
            )
            if tail:
                user_prompt = f"CONVERSATION SO FAR:\n{tail}\n\n{user_prompt}"
        t = time.perf_counter()
        if self.ctx.groq is None:
            raise LLMNotConfigured("GROQ_API_KEY not set")
        try:
            # stream_chat() is a generator — the route consumes it as a
            # StreamingResponse so the first token reaches the browser
            # in ~0.6s. We collect tokens here only to (a) log the
            # final length + (b) persist the full reply back to Postgres
            # via the gateway. The user-facing response is streamed.
            tokens: list[str] = []
            for delta in self.ctx.groq.stream_chat(system_prompt, user_prompt):
                tokens.append(delta)
            answer_text = "".join(tokens).strip()
            if not answer_text:
                # Stream produced nothing — surface as upstream failure.
                raise UpstreamLLMFailed("groq returned empty stream")
        except GroqUnavailable as exc:
            raise UpstreamLLMFailed(str(exc)) from exc

        log.info(
            "llm answered",
            extra={**log_ctx, "stage": "llm", "answer_chars": len(answer_text),
                   "duration_ms": int((time.perf_counter() - t) * 1000)},
        )

        # Stash the final text on the context so the route (which
        # also streamed it) can persist + build the response object.
        self._final_answer = answer_text
        self._system_prompt = system_prompt
        self._user_prompt = user_prompt
        self._context_hits = context_hits
        self._kb_hits = kb_hits

        # Build citations from BOTH the kb_master hits AND the live-web hits
        # (live_hits were already merged into context_hits above).
        citations: list[Citation] = []
        # De-dupe by source_id so the same URL doesn't appear twice
        # (once in kb_hits and once in live hits with the same URL).
        seen_source_ids: set[str] = set()
        # Walk the ORIGINAL kb hits first so the company-own-KB citations
        # come out on top of the list — these are the most trustworthy.
        for h in kb_hits:
            st = h.get("source_type", "website")
            sid = h.get("source_id") or h.get("url") or ""
            if sid in seen_source_ids:
                continue
            seen_source_ids.add(sid)
            citations.append(_hit_to_citation(h))
        # Then the live-web hits, with FULL text (no truncation — the
        # LLM needs to see the full extract to answer questions like
        # "what is the capital of X" where the answer lives mid-paragraph).
        # Only cite hits we actually KEPT in the context after the
        # re-cap — otherwise the citation snippet is from a longer
        # extract than the LLM saw.
        for h in context_hits:
            st = h.get("source_type", "website")
            if st != "live_web":
                continue
            sid = h.get("source_id") or h.get("url") or ""
            if sid in seen_source_ids:
                continue
            seen_source_ids.add(sid)
            text = h.get("text") or h.get("snippet") or ""
            citations.append(Citation(
                source_type="live_web",
                source_id=sid,
                section_title=h.get("title") or h.get("section_title"),
                filename=None,
                page_number=None,
                score=float(h.get("score", 0.5)),
                # Cap the citation snippet at the same per-hit cap the
                # LLM saw — no point shipping a 6000-char snippet when
                # the LLM only got 2500 chars.
                snippet=text[: settings.live_web_per_hit_context_cap],
            ))

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

    # ------------------------------------------------------------------
    # Tiny dataclass so the auto-crawl helper can share the heavy
    # collaborators (qdrant, embedder, logger) without re-typing the
    # protocol dance.
    # ------------------------------------------------------------------
    def _auto_crawl(self, url: str, log_ctx: dict) -> int:
        """One-shot BFS crawl of `url` when the user has no indexed
        content yet. Embeds each page section and mirrors into
        kb_master so the chatbot has data on the very first chat.

        Best-effort: any failure is logged and swallowed (returns 0).
        """
        from pathlib import Path

        from app.core.config import settings as cfg
        from app.core.kb_mirror import mirror_to_kb_master
        from app.modules.analyze_website.crawler import Crawler

        cache_dir = Path(cfg.cache_dir) / self.ctx.business_id
        pages_indexed = 0
        try:
            with Crawler(
                user_agent=cfg.crawler_user_agent,
                timeout=cfg.crawler_timeout_seconds,
                max_pages=cfg.crawler_max_pages,
                cache_dir=cache_dir,
            ) as crawler:
                pages, _warnings = crawler.fetch_all(url)
            if not pages:
                log.warning(
                    "auto_crawl returned no pages",
                    extra={**log_ctx, "stage": "auto_crawl", "url": url},
                )
                return 0

            # Chunk by paragraph so we mirror the same shape that
            # analyze_website/service.py uses.
            chunks: list[tuple[str, str, str]] = []
            for p in pages:
                text = (p.get("cleaned_text") or "").strip() if isinstance(p, dict) else (p.cleaned_text or "").strip()
                if not text:
                    continue
                title = (p.get("title") if isinstance(p, dict) else p.title) or url
                paras = [par.strip() for par in text.split("\n\n") if par.strip()]
                buf: list[str] = []
                buf_len = 0
                for par in paras:
                    if buf_len + len(par) > 1500 and buf:
                        chunks.append((url, title, "\n\n".join(buf)))
                        buf, buf_len = [], 0
                    buf.append(par)
                    buf_len += len(par)
                if buf:
                    chunks.append((url, title, "\n\n".join(buf)))

            if not chunks:
                return 0

            texts = [c[2] for c in chunks]
            vectors = self.ctx.embedding_model.embed(texts)
            for (u, title, text), vec in zip(chunks, vectors):
                mirror_to_kb_master(
                    self.ctx.qdrant,
                    business_id=self.ctx.business_id,
                    source_type="website",
                    source_id=u,
                    origin_collection=COLLECTION_WEBSITE_PAGES,
                    vector=vec,
                    extra_payload={"url": u, "section_title": title, "text": text[:2000]},
                )
                pages_indexed += 1
            log.info(
                "auto_crawl seeded kb_master",
                extra={
                    **log_ctx, "stage": "auto_crawl", "url": url,
                    "pages": len(pages), "chunks": pages_indexed,
                },
            )
        except Exception as exc:  # noqa: BLE001
            log.warning(
                "auto_crawl failed (continuing with live-web only): %s",
                exc, extra={**log_ctx, "stage": "auto_crawl", "url": url},
            )
        return pages_indexed

    def _wipe_website_vectors(self, log_ctx: dict) -> int:
        """Delete any website vectors that already exist for this
        business. Called from the empty-KB branch in run() when the
        user re-pastes a brand-new URL but the same business_id still
        has stale Bookzstore/etc chunks. Same delete-by-filter pattern
        as analyze_website/service.py uses on a real recrawl.
        """
        if self.ctx.qdrant is None:
            return 0
        try:
            self.ctx.qdrant.delete(
                collection_name=COLLECTION_KB_MASTER,
                points_selector=qmodels.Filter(must=[
                    qmodels.FieldCondition(
                        key="business_id",
                        match=qmodels.MatchValue(value=self.ctx.business_id),
                    ),
                    qmodels.FieldCondition(
                        key="source_type",
                        match=qmodels.MatchValue(value="website"),
                    ),
                ]),
                wait=True,
            )
            self.ctx.qdrant.delete(
                collection_name=COLLECTION_WEBSITE_PAGES,
                points_selector=qmodels.Filter(must=[
                    qmodels.FieldCondition(
                        key="business_id",
                        match=qmodels.MatchValue(value=self.ctx.business_id),
                    ),
                ]),
                wait=True,
            )
            log.info(
                "wiped stale website vectors before live-web fallback",
                extra={**log_ctx, "stage": "wipe"},
            )
        except Exception as exc:  # noqa: BLE001
            log.warning(
                "stale-vector wipe failed: %s", exc,
                extra={**log_ctx, "stage": "wipe"},
            )
        return 0

    # ------------------------------------------------------------------
    # Live-web fetch (Wikipedia + DuckDuckGo)
    # ------------------------------------------------------------------
    async def _fetch_live_web(self) -> tuple[list[dict], str]:
        """Run multi-source web queries + fetch top pages. Native async
        — the route wraps us with asyncio.run() in a worker thread.

        Hits go into context_hits AND get mirrored into the
        live_research Qdrant collection so future chats (and future
        re-crawls) can re-use them — this is our "long-term memory" of
        what we've learned from the web for this business.
        """
        queries = build_live_source_queries(
            self.ctx.company_name, self.ctx.company_url, self.ctx.question
        )[: settings.live_web_max_queries]
        strategy = f"live web ({len(queries)} queries)"
        all_hits: list[dict] = []

        for q in queries:
            try:
                results = await multi_source_search(
                    q, limit_per_backend=4
                )
            except Exception as exc:  # noqa: BLE001
                log.warning("multi_source_search failed for %r: %s", q, exc)
                continue
            for hit in results[: settings.live_web_per_query_fetch]:
                try:
                    body = await fetch_url_text(
                        hit.url, max_chars=settings.live_web_fetch_chars
                    )
                except Exception as exc:  # noqa: BLE001
                    log.warning("fetch_url_text failed for %s: %s", hit.url, exc)
                    body = None
                if not body:
                    all_hits.append({
                        "title": hit.title,
                        "url": hit.url,
                        "text": (hit.snippet or "")[
                            : settings.live_web_snippet_chars
                        ],
                        "source_id": hit.url,
                        "score": 0.5,
                    })
                else:
                    title, text = body
                    all_hits.append({
                        "title": title or hit.title,
                        "url": hit.url,
                        "text": text[: settings.live_web_snippet_chars],
                        "source_id": hit.url,
                        "score": 0.5,
                    })
            if len(all_hits) >= settings.live_web_max_hits:
                break
        return all_hits, strategy

    @staticmethod
    def _run_async(coro):
        """Run an awaitable from sync code, even when an event loop is
        already running (FastAPI). Uses a dedicated worker thread so we
        don't fight the main loop.
        """
        import concurrent.futures
        with concurrent.futures.ThreadPoolExecutor(max_workers=1) as pool:
            future = pool.submit(asyncio.run, coro)
            return future.result()

    def _mirror_live_hits(self, live_hits: list[dict]) -> None:
        """Best-effort: persist each live hit into the live_research Qdrant
        collection so future chats can re-use them. Failures are silent
        — chat still succeeds even if Qdrant rejects the upsert.
        """
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
                        id=_live_id(self.ctx.business_id, self.ctx.question, i),
                        vector=vec,
                        payload={
                            "business_id": self.ctx.business_id,
                            "url": hit.get("url"),
                            "title": hit.get("title"),
                            "text": (hit.get("text") or "")[:1500],
                            "source_type": "live_web",
                            "fetched_at": datetime.now(timezone.utc).isoformat(),
                        },
                    )],
                    wait=False,
                )
            except Exception as exc:  # noqa: BLE001
                log.debug("mirror_live_hits upsert failed: %s", exc)


def _live_id(business_id: str, question: str, idx: int) -> str:
    raw = f"{business_id}|{question}|{idx}"
    return hashlib.sha1(raw.encode("utf-8")).hexdigest()[:32]


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
    """Greedily include hits until the context budget is exhausted.

    Each live-web hit may contain a multi-paragraph Wikipedia extract
    (e.g. "Its capital, largest city and main cultural and economic
    centre is Paris." lives 3 paragraphs into the France extract). We
    cap each hit at live_web_per_hit_context_cap so a single huge
    extract doesn't starve the rest of the context, but we still keep
    enough text for the LLM to find the answer mid-paragraph.
    """
    per_hit_cap = settings.live_web_per_hit_context_cap
    out: list[dict] = []
    used = 0
    for h in hits:
        text = h.get("text") or ""
        # Truncate the TEXT inside the hit (not the hit itself) so the
        # LLM sees the first per_hit_cap chars of each hit.
        truncated = text[:per_hit_cap]
        if len(text) > per_hit_cap and not truncated.endswith((".", "!", "?")):
            # Try to cut on a sentence boundary so we don't end mid-word.
            last = max(
                truncated.rfind(". "),
                truncated.rfind("! "),
                truncated.rfind("? "),
            )
            if last > per_hit_cap // 2:
                truncated = truncated[: last + 1]
        h_copy = dict(h)
        h_copy["text"] = truncated
        cost = len(truncated) + 50
        if used + cost > max_chars and out:
            break
        out.append(h_copy)
        used += cost
    return out, used
