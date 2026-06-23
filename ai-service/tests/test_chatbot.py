from __future__ import annotations

from types import SimpleNamespace
from typing import Any

import pytest

from app.modules.chatbot.errors import (
    BusinessNotFound,
    LLMNotConfigured,
    UpstreamLLMFailed,
    VectorDBUnreachable,
)
from app.modules.chatbot.schemas import ChatResponse
from app.modules.chatbot.service import ChatContext, ChatService


# ---------- Fakes ----------

class FakeEmbedder:
    def __init__(self, dim: int = 4):
        self.dim = dim
        self.last_query = None

    def embed_query(self, query: str) -> list[float]:
        self.last_query = query
        return [0.1] * self.dim


class FakeQdrant:
    """Records calls and returns canned results.

    Pass `count` to control `count(...)`, `hits` for `search(...)`, or
    `raises` to make either method blow up.
    """

    def __init__(
        self,
        *,
        count: int = 3,
        hits: list[Any] | None = None,
        count_raises: Exception | None = None,
        search_raises: Exception | None = None,
    ):
        self.count_value = count
        self.hits = hits or []
        self.count_raises = count_raises
        self.search_raises = search_raises
        self.search_calls: list[dict[str, Any]] = []
        self.count_calls: list[dict[str, Any]] = []

    def count(self, *, collection_name, count_filter):
        self.count_calls.append({"collection_name": collection_name, "filter": count_filter})
        if self.count_raises:
            raise self.count_raises
        return SimpleNamespace(count=self.count_value)

    def search(self, *, collection_name, query_vector, query_filter, limit, score_threshold, with_payload):
        self.search_calls.append({
            "collection_name": collection_name,
            "query_vector": query_vector,
            "filter": query_filter,
            "limit": limit,
            "score_threshold": score_threshold,
            "with_payload": with_payload,
        })
        if self.search_raises:
            raise self.search_raises
        return self.hits


class FakeGroq:
    def __init__(self, payload: str = ""):
        self.payload = payload
        self.last_system = None
        self.last_user = None

    def complete_chat(self, system: str, user: str) -> str:
        self.last_system = system
        self.last_user = user
        return self.payload


# ---------- Helpers ----------

def _hit(source_type: str, source_id: str, text: str, score: float = 0.8, **extra) -> SimpleNamespace:
    payload = {"source_type": source_type, "source_id": source_id, "text": text, **extra}
    return SimpleNamespace(id="pt-1", score=score, payload=payload, vector=[0.0])


def _ctx(
    *,
    business_id: str = "biz-1",
    question: str = "Do you ship to Canada?",
    top_k: int = 6,
    score_threshold: float = 0.30,
    qdrant: FakeQdrant | None = None,
    embedder: FakeEmbedder | None = None,
    groq: FakeGroq | None = None,
    include_live_web: bool = False,
) -> ChatContext:
    """`include_live_web` defaults to False in tests so the existing
    scenarios (no live-web setup) keep the original semantics. Tests
    that specifically exercise the live-web path opt in explicitly.
    """
    return ChatContext(
        business_id=business_id,
        question=question,
        top_k=top_k,
        score_threshold=score_threshold,
        embedding_model=embedder or FakeEmbedder(),
        qdrant=qdrant or FakeQdrant(),
        groq=groq,
        include_live_web=include_live_web,
    )


# ---------- Tests ----------

def test_happy_path_answer_with_citations():
    hits = [
        _hit("website", "https://example.com/shipping", "We ship to Canada in 5-7 days.", 0.78, section_title="International shipping"),
        _hit("document", "doc-1", "Canadian orders arrive in 5-7 days.", 0.61, filename="FAQ.pdf", page_number=3),
    ]
    qdrant = FakeQdrant(count=5, hits=hits)
    groq = FakeGroq(payload="Yes — we ship to Canada in 5-7 business days.")
    ctx = _ctx(qdrant=qdrant, groq=groq)

    result = ChatService(ctx).run()

    assert isinstance(result, ChatResponse)
    assert "Canada" in result.answer
    assert len(result.citations) == 2
    assert {c.source_type for c in result.citations} == {"website", "document"}
    assert result.citations[0].section_title == "International shipping"
    assert result.citations[1].filename == "FAQ.pdf"
    assert result.citations[1].page_number == 3
    assert result.citations[0].score == 0.78
    # Default model in app/core/config.py is llama-3.3-70b-versatile.
    assert result.model == "llama-3.3-70b-versatile"


def test_no_relevant_chunks_returns_default_answer():
    qdrant = FakeQdrant(count=10, hits=[])  # count > 0 but no hits above threshold
    groq = FakeGroq(payload="SHOULD NOT BE CALLED")
    ctx = _ctx(qdrant=qdrant, groq=groq)
    ctx.include_live_web = False  # opt out so we get the no-hits default

    result = ChatService(ctx).run()

    assert result.answer == "I don't have that information in your indexed content."
    assert result.citations == []
    assert groq.last_user is None  # LLM never called


def test_business_not_found_when_no_vectors_and_no_live_web():
    qdrant = FakeQdrant(count=0, hits=[])
    groq = FakeGroq(payload="SHOULD NOT BE CALLED")
    ctx = _ctx(qdrant=qdrant, groq=groq)
    # Default include_live_web=True on ChatContext. We must explicitly
    # opt out to keep the legacy "404 when no KB" behaviour.
    ctx.include_live_web = False

    with pytest.raises(BusinessNotFound):
        ChatService(ctx).run()


def test_empty_kb_falls_through_to_live_web():
    """No indexed content, but include_live_web=True. The chatbot
    should NOT raise BusinessNotFound — it should run the live-web
    augmentation and call the LLM with whatever DDG/Wikipedia return.
    """
    qdrant = FakeQdrant(count=0, hits=[])
    groq = FakeGroq(payload="Based on common industry practice: ...")
    ctx = _ctx(qdrant=qdrant, groq=groq)
    # Provide a company_name so the live-web queries have something to
    # build against. No company_url → no auto-crawl.
    ctx.include_live_web = True
    ctx.company_name = "TestCo"

    result = ChatService(ctx).run()

    assert isinstance(result, ChatResponse)
    # LLM must have been called even though kb_master was empty.
    assert groq.last_system is not None
    assert "live-web-only" in groq.last_system.lower() or "no indexed" in groq.last_system.lower() or "public web" in groq.last_system.lower()
    assert groq.last_user is not None
    assert "TestCo" in groq.last_user or "Do you ship to Canada" in groq.last_user


def test_empty_kb_no_url_no_company_name_runs_live_web():
    """No KB, no company_url, no company_name. We still try DDG
    (which will probably return []), but the chatbot must NOT 404 —
    the question is still answered via the general prompt if anything
    came back, otherwise we just hit the no-hits default."""
    qdrant = FakeQdrant(count=0, hits=[])
    groq = FakeGroq(payload="general answer")
    ctx = _ctx(qdrant=qdrant, groq=groq)
    ctx.include_live_web = True

    # Should not raise — either runs live-web and answers, or returns
    # the no-hits default. Either way the chatbot is alive.
    try:
        result = ChatService(ctx).run()
        assert isinstance(result, ChatResponse)
    except BusinessNotFound:
        pytest.fail("Chatbot must not raise BusinessNotFound when live-web is enabled")


def test_llm_not_configured():
    qdrant = FakeQdrant(count=3, hits=[_hit("website", "u", "hi", 0.9)])
    ctx = _ctx(qdrant=qdrant, groq=None)

    with pytest.raises(LLMNotConfigured):
        ChatService(ctx).run()


def test_qdrant_search_failure_raises_503():
    qdrant = FakeQdrant(count=3, search_raises=RuntimeError("network down"))
    groq = FakeGroq()
    ctx = _ctx(qdrant=qdrant, groq=groq)

    with pytest.raises(VectorDBUnreachable):
        ChatService(ctx).run()


def test_qdrant_count_failure_raises_503():
    qdrant = FakeQdrant(count_raises=RuntimeError("boom"))
    groq = FakeGroq()
    ctx = _ctx(qdrant=qdrant, groq=groq)

    with pytest.raises(VectorDBUnreachable):
        ChatService(ctx).run()


def test_top_k_and_score_threshold_passed_to_search():
    hits = [_hit("website", "u", "x", 0.9)]
    qdrant = FakeQdrant(count=1, hits=hits)
    groq = FakeGroq(payload="ok")
    ctx = _ctx(qdrant=qdrant, groq=groq, top_k=3, score_threshold=0.5)

    ChatService(ctx).run()

    call = qdrant.search_calls[0]
    assert call["limit"] == 3
    assert call["score_threshold"] == 0.5
    assert call["collection_name"] == "kb_master"
    # Filter must pin business_id.
    conds = call["filter"].must
    assert any(c.key == "business_id" for c in conds)


def test_website_citation_has_section_title_no_filename():
    hits = [_hit("website", "https://e.com/about", "x", 0.9, section_title="About")]
    qdrant = FakeQdrant(count=1, hits=hits)
    groq = FakeGroq(payload="ok")
    ctx = _ctx(qdrant=qdrant, groq=groq)

    result = ChatService(ctx).run()

    c = result.citations[0]
    assert c.source_type == "website"
    assert c.section_title == "About"
    assert c.filename is None
    assert c.page_number is None


def test_document_citation_has_filename_no_section_title():
    hits = [_hit("document", "doc-1", "x", 0.9, filename="FAQ.pdf")]
    qdrant = FakeQdrant(count=1, hits=hits)
    groq = FakeGroq(payload="ok")
    ctx = _ctx(qdrant=qdrant, groq=groq)

    result = ChatService(ctx).run()

    c = result.citations[0]
    assert c.source_type == "document"
    assert c.filename == "FAQ.pdf"
    assert c.section_title is None


def test_snippet_is_truncated_to_300_chars():
    long_text = "word " * 200  # 1000 chars
    hits = [_hit("website", "u", long_text, 0.9)]
    qdrant = FakeQdrant(count=1, hits=hits)
    groq = FakeGroq(payload="ok")
    ctx = _ctx(qdrant=qdrant, groq=groq)

    result = ChatService(ctx).run()

    assert len(result.citations[0].snippet) <= 300


def test_llm_called_with_system_prompt_and_user_prompt():
    hits = [_hit("website", "u", "Canada shipping info", 0.9, section_title="Shipping")]
    qdrant = FakeQdrant(count=1, hits=hits)
    groq = FakeGroq(payload="answer")
    ctx = _ctx(qdrant=qdrant, groq=groq, question="Do you ship to Canada?")

    ChatService(ctx).run()

    # The advisor prompt is what's selected when the user has indexed
    # data — verify it's in the system prompt and the question makes
    # it through to the user prompt.
    assert "aibridge advisor" in groq.last_system.lower()
    assert "Do you ship to Canada?" in groq.last_user
    assert "Shipping" in groq.last_user


def test_no_embedder_raises_llm_not_configured():
    # Question is real (not small-talk) so we get past the greeting
    # short-circuit and into the embedding check.
    qdrant = FakeQdrant()
    ctx = ChatContext(
        business_id="biz-1",
        question="What do you sell?",
        top_k=6,
        score_threshold=0.3,
        embedding_model=None,
        qdrant=qdrant,
        groq=FakeGroq(),
        include_live_web=False,
    )

    with pytest.raises(LLMNotConfigured):
        ChatService(ctx).run()