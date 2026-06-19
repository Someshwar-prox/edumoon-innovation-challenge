"""Service layer for the website analysis module.

Stateless, testable. Takes a WebsiteAnalysisContext with all collaborators
so unit tests can pass fakes.
"""
from __future__ import annotations

import hashlib
import logging
import time
import uuid
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Any, Protocol

from qdrant_client.http import models as qmodels

from app.core.config import settings
from app.core.embedding import EmbeddingModel
from app.core.groq_client import GroqClient, GroqUnavailable
from app.core.kb_mirror import mirror_to_kb_master
from app.core.qdrant import COLLECTION_WEBSITE_PAGES
from app.modules.analyze_website.extractors import (
    extract_contact,
    extract_jsonld,
    extract_social,
)
from app.modules.analyze_website.prompts import (
    SYSTEM_PROMPT,
    build_user_prompt,
    join_pages_for_prompt,
    pick_top_pages,
)
from app.modules.analyze_website.schemas import (
    ContactInfo,
    CrawlWarning,
    FAQ,
    Product,
    Service,
    WebsiteAnalysisResult,
    WebsiteProfile,
)

log = logging.getLogger(__name__)


class AnalysisError(Exception):
    status_code: int = 500
    code: str = "internal_error"


class WebsiteUnreachable(AnalysisError):
    status_code = 502
    code = "website_unreachable"


class EmptyExtraction(AnalysisError):
    status_code = 503
    code = "empty_extraction"


class UpstreamLLMFailed(AnalysisError):
    status_code = 502
    code = "upstream_llm_failed"


class LLMNotConfigured(AnalysisError):
    status_code = 503
    code = "llm_not_configured"


class CrawlerLike(Protocol):
    def fetch_all(self, start_url: str) -> tuple[list[dict], list[dict]]: ...


class QdrantLike(Protocol):
    def upsert(self, *, collection_name: str, points: list, wait: bool) -> Any: ...


class GroqLike(Protocol):
    def complete_json(self, system: str, user: str) -> dict: ...


@dataclass
class WebsiteAnalysisContext:
    business_id: str
    url: str
    max_pages: int = 8
    force_recrawl: bool = False
    crawler: CrawlerLike | None = None
    embedding_model: EmbeddingModel | None = None
    qdrant: QdrantLike | None = None
    groq: GroqLike | None = None


class WebsiteAnalysisService:
    def __init__(self, ctx: WebsiteAnalysisContext) -> None:
        self.ctx = ctx
        self.analysis_id = str(uuid.uuid4())
        self._t0 = time.perf_counter()

    def run(self) -> WebsiteAnalysisResult:
        log_ctx = {
            "analysis_id": self.analysis_id,
            "business_id": self.ctx.business_id,
            "url": self.ctx.url,
            "stage": "start",
        }
        log.info("analysis started", extra=log_ctx)

        if self.ctx.crawler is None:
            raise WebsiteUnreachable("crawler not configured")

        t = time.perf_counter()
        try:
            pages, raw_warnings = self.ctx.crawler.fetch_all(self.ctx.url)
        except Exception as exc:  # noqa: BLE001
            raise WebsiteUnreachable(str(exc)) from exc

        crawl_ms = int((time.perf_counter() - t) * 1000)
        log.info(
            "crawl done",
            extra={**log_ctx, "stage": "crawl", "pages": len(pages), "duration_ms": crawl_ms},
        )

        if not pages:
            raise EmptyExtraction("no pages yielded text")

        warnings: list[CrawlWarning] = [CrawlWarning(**w) for w in raw_warnings]

        page_dicts = [_page_to_dict(p) for p in pages]
        contact = extract_contact(page_dicts)
        social = extract_social(page_dicts)
        jsonld = extract_jsonld(page_dicts)
        log.info(
            "extract deterministic",
            extra={**log_ctx, "stage": "extract", "jsonld_keys": list(jsonld.keys())},
        )

        profile = self._llm_structure(page_dicts, jsonld, contact, social, log_ctx)
        sections_indexed = self._embed_and_upsert(page_dicts, log_ctx)

        result = WebsiteAnalysisResult(
            analysis_id=self.analysis_id,
            business_id=self.ctx.business_id,
            url=self.ctx.url,
            pages_crawled=len(pages),
            sections_indexed=sections_indexed,
            profile=profile,
            crawled_urls=[_page_to_dict(p)["url"] for p in pages],
            warnings=warnings,
            created_at=datetime.now(timezone.utc),
            llm_model=settings.groq_model if self.ctx.groq else None,
        )
        log.info(
            "analysis done",
            extra={
                **log_ctx,
                "stage": "done",
                "pages_crawled": result.pages_crawled,
                "sections_indexed": result.sections_indexed,
                "duration_ms": int((time.perf_counter() - self._t0) * 1000),
            },
        )
        return result

    def _llm_structure(self, pages, jsonld, contact, social, log_ctx) -> WebsiteProfile:
        if self.ctx.groq is None:
            raise LLMNotConfigured("GROQ_API_KEY not set")

        top_pages = pick_top_pages(pages, k=5)
        long_text = join_pages_for_prompt(top_pages)
        user_prompt = build_user_prompt(long_text, jsonld)

        try:
            raw = self.ctx.groq.complete_json(SYSTEM_PROMPT, user_prompt)
        except GroqUnavailable as exc:
            raise UpstreamLLMFailed(str(exc)) from exc

        org = jsonld.get("organization") or {}
        profile = self._profile_from_llm(raw)
        profile.contact = self._merge_contact(profile.contact, contact, social, org)
        if not profile.faqs and jsonld.get("faqs"):
            profile.faqs = [FAQ(**f) for f in jsonld["faqs"]]
        if not profile.company_summary and org.get("description"):
            profile.company_summary = org["description"]

        log.info(
            "llm structured",
            extra={
                **log_ctx,
                "stage": "llm",
                "services": len(profile.services),
                "products": len(profile.products),
                "faqs": len(profile.faqs),
            },
        )
        return profile

    @staticmethod
    def _profile_from_llm(raw: dict) -> WebsiteProfile:
        def _list_of(key, model_cls):
            items = raw.get(key) or []
            out = []
            if not isinstance(items, list):
                return out
            for it in items:
                if not isinstance(it, dict):
                    continue
                try:
                    out.append(model_cls(name=str(it.get("name", "")).strip() or "(unnamed)",
                                         description=str(it.get("description", "")).strip()))
                except Exception:  # noqa: BLE001
                    continue
            return out

        def _faqs():
            items = raw.get("faqs") or []
            out: list[FAQ] = []
            for it in items:
                if not isinstance(it, dict):
                    continue
                q = str(it.get("question", "")).strip()
                a = str(it.get("answer", "")).strip()
                if q and a:
                    out.append(FAQ(question=q, answer=a))
            return out

        return WebsiteProfile(
            company_summary=str(raw.get("company_summary", "")).strip(),
            services=_list_of("services", Service),
            products=_list_of("products", Product),
            faqs=_faqs(),
            contact=ContactInfo(),
        )

    @staticmethod
    def _merge_contact(base: ContactInfo, det: Any, social: dict, org: dict) -> ContactInfo:
        return ContactInfo(
            email=det.email or org.get("email") or base.email,
            phone=det.phone or org.get("phone") or base.phone,
            address=det.address or org.get("address") or base.address,
            social={**(base.social or {}), **social},
        )

    def _embed_and_upsert(self, pages, log_ctx) -> int:
        if not (self.ctx.embedding_model and self.ctx.qdrant):
            return 0

        chunks: list[tuple[str, str, str]] = []
        for p in pages:
            text = p.get("cleaned_text") or ""
            if not text:
                continue
            paras = [par.strip() for par in text.split("\n\n") if par.strip()]
            title = p.get("title") or p["url"]
            buf: list[str] = []
            buf_len = 0
            for par in paras:
                if buf_len + len(par) > 1500 and buf:
                    chunks.append((p["url"], title, "\n\n".join(buf)))
                    buf, buf_len = [], 0
                buf.append(par)
                buf_len += len(par)
            if buf:
                chunks.append((p["url"], title, "\n\n".join(buf)))

        if not chunks:
            return 0

        texts = [c[2] for c in chunks]
        vectors = self.ctx.embedding_model.embed(texts)

        points = []
        for (url, title, text), vec in zip(chunks, vectors):
            sid = hashlib.sha1(f"{self.ctx.business_id}|{url}|{title}|{text[:80]}".encode()).hexdigest()[:32]
            points.append(qmodels.PointStruct(
                id=sid,
                vector=vec,
                payload={
                    "business_id": self.ctx.business_id,
                    "source_type": "website",
                    "url": url,
                    "section_title": title,
                    "text": text[:2000],
                },
            ))

        self.ctx.qdrant.upsert(
            collection_name=COLLECTION_WEBSITE_PAGES,
            points=points,
            wait=True,
        )
        for (url, title, text), vec in zip(chunks, vectors):
            mirror_to_kb_master(
                self.ctx.qdrant,
                business_id=self.ctx.business_id,
                source_type="website",
                source_id=url,
                origin_collection=COLLECTION_WEBSITE_PAGES,
                vector=vec,
                extra_payload={"url": url, "section_title": title, "text": text[:2000]},
            )
        log.info(
            "vectors upserted",
            extra={**log_ctx, "stage": "embed", "count": len(points)},
        )
        return len(points)


def _page_to_dict(p: Any) -> dict:
    if isinstance(p, dict):
        return p
    return {
        "url": p.url,
        "title": p.title,
        "cleaned_text": p.cleaned_text,
        "raw_html_path": p.raw_html_path,
    }
