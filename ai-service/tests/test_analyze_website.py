from __future__ import annotations

from typing import Any
from unittest.mock import MagicMock

import pytest

from app.modules.analyze_website.schemas import WebsiteAnalysisResult
from app.modules.analyze_website.service import (
    EmptyExtraction,
    LLMNotConfigured,
    UpstreamLLMFailed,
    WebsiteAnalysisContext,
    WebsiteAnalysisService,
    WebsiteUnreachable,
)


class FakeCrawler:
    def __init__(self, pages: list[dict], warnings: list[dict] | None = None):
        self.pages = pages
        self.warnings = warnings or []

    def fetch_all(self, start_url: str) -> tuple[list[dict], list[dict]]:
        return self.pages, self.warnings


class FakeGroq:
    def __init__(self, payload: dict | None = None, raises: Exception | None = None):
        self.payload = payload or {}
        self.raises = raises
        self.last_user = None

    def complete_json(self, system: str, user: str) -> dict:
        self.last_user = user
        if self.raises:
            raise self.raises
        return self.payload


def _ctx(**overrides) -> WebsiteAnalysisContext:
    base = dict(
        business_id="biz-1",
        url="https://example.com",
        crawler=FakeCrawler([
            {"url": "https://example.com", "title": "Home", "cleaned_text": "We do AI consulting for SMBs. Email: hello@aibridgesample.com."},
            {"url": "https://example.com/about", "title": "About", "cleaned_text": "Founded in 2020, we ship AI products to retail and SaaS."},
        ]),
        embedding_model=MagicMock(embed=MagicMock(return_value=[[0.0] * 4])),
        qdrant=MagicMock(upsert=MagicMock(return_value=MagicMock())),
        groq=FakeGroq(payload={
            "company_summary": "Example helps SMBs adopt AI.",
            "services": [{"name": "AI consulting", "description": "Hands-on help"}],
            "products": [{"name": "AIWidget", "description": "Embeddable assistant"}],
            "faqs": [{"question": "What is AIWidget?", "answer": "An embeddable AI assistant."}],
        }),
    )
    base.update(overrides)
    return WebsiteAnalysisContext(**base)


def test_happy_path_returns_result():
    svc = WebsiteAnalysisService(_ctx())
    result = svc.run()
    assert isinstance(result, WebsiteAnalysisResult)
    assert result.business_id == "biz-1"
    assert result.pages_crawled == 2
    assert result.profile.company_summary.startswith("Example")
    assert len(result.profile.services) == 1
    assert len(result.profile.products) == 1
    assert len(result.profile.faqs) == 1
    assert result.profile.contact.email == "hello@aibridgesample.com"
    assert result.crawled_urls == ["https://example.com", "https://example.com/about"]


def test_no_pages_raises_empty_extraction():
    ctx = _ctx(crawler=FakeCrawler(pages=[]))
    with pytest.raises(EmptyExtraction):
        WebsiteAnalysisService(ctx).run()


def test_crawler_exception_maps_to_website_unreachable():
    class BoomCrawler:
        def fetch_all(self, start_url):
            raise RuntimeError("network is dead")

    ctx = _ctx(crawler=BoomCrawler())
    with pytest.raises(WebsiteUnreachable):
        WebsiteAnalysisService(ctx).run()


def test_groq_unavailable_maps_to_upstream_llm_failed():
    from app.core.groq_client import GroqUnavailable

    ctx = _ctx(groq=FakeGroq(raises=GroqUnavailable("timeout")))
    with pytest.raises(UpstreamLLMFailed):
        WebsiteAnalysisService(ctx).run()


def test_groq_none_raises_llm_not_configured():
    ctx = _ctx(groq=None)
    with pytest.raises(LLMNotConfigured):
        WebsiteAnalysisService(ctx).run()


def test_warning_propagates_to_result():
    ctx = _ctx(crawler=FakeCrawler(
        pages=[{"url": "https://example.com", "title": "Home", "cleaned_text": "Hello."}],
        warnings=[{"url": "https://example.com/about", "reason": "timeout"}],
    ))
    result = WebsiteAnalysisService(ctx).run()
    assert len(result.warnings) == 1
    assert result.warnings[0].reason == "timeout"


def test_embedding_model_called_with_chunks():
    emb = MagicMock()
    emb.embed = MagicMock(return_value=[[0.0, 0.1], [0.2, 0.3]])
    ctx = _ctx(
        embedding_model=emb,
        crawler=FakeCrawler([
            {"url": "https://example.com", "title": "Home", "cleaned_text": "Para one. " * 200},
        ]),
    )
    WebsiteAnalysisService(ctx).run()
    assert emb.embed.called
    # 1 page, <= 5 chunks expected
    assert len(emb.embed.call_args.args[0]) >= 1
    assert ctx.qdrant.upsert.called