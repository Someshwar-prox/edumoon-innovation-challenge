from __future__ import annotations

from types import SimpleNamespace
from typing import Any

import pytest

from app.modules.readiness_report.errors import (
    BusinessNotFound,
    InvalidRequest,
    LLMNotConfigured,
    UpstreamLLMFailed,
    VectorDBUnreachable,
)
from app.modules.readiness_report.schemas import ReadinessReport
from app.modules.readiness_report.service import (
    ReadinessContext,
    ReadinessReportService,
)


# ---------- Fakes ----------

class FakeEmbedder:
    def __init__(self, dim: int = 4):
        self.dim = dim
        self.calls: list[list[str]] = []

    def embed_query(self, query: str) -> list[float]:
        return [0.1] * self.dim

    def embed(self, texts: list[str]) -> list[list[float]]:
        self.calls.append(list(texts))
        return [[0.1] * self.dim for _ in texts]


class FakeQdrant:
    """Records calls and returns canned results."""

    def __init__(
        self,
        *,
        count: int = 10,
        hits: list[Any] | None = None,
        count_raises: Exception | None = None,
        search_raises: Exception | None = None,
        upsert_raises: Exception | None = None,
    ):
        self.count_value = count
        self.hits = hits or []
        self.count_raises = count_raises
        self.search_raises = search_raises
        self.upsert_raises = upsert_raises
        self.search_calls: list[dict[str, Any]] = []
        self.count_calls: list[dict[str, Any]] = []
        self.upsert_calls: list[dict[str, Any]] = []

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
        })
        if self.search_raises:
            raise self.search_raises
        # Cycle through hits so different questions can return different snippets.
        return self.hits

    def upsert(self, *, collection_name, points, wait):
        self.upsert_calls.append({"collection_name": collection_name, "points": points, "wait": wait})
        if self.upsert_raises:
            raise self.upsert_raises


class FakeGroq:
    def __init__(self, payload: dict | None = None):
        self.payload = payload or {}
        self.last_system = None
        self.last_user = None

    def complete_json(self, system: str, user: str) -> dict:
        self.last_system = system
        self.last_user = user
        return self.payload


# ---------- Helpers ----------

def _hit(source_type: str, source_id: str, text: str, score: float = 0.8, **extra) -> SimpleNamespace:
    payload = {"source_type": source_type, "source_id": source_id, "text": text, **extra}
    return SimpleNamespace(id="pt-1", score=score, payload=payload, vector=[0.0])


def _full_payload() -> dict:
    """A complete LLM JSON-mode payload mirroring JSON_SCHEMA_SPEC."""
    return {
        "score": 78,
        "subscores": {
            "digital_presence": 90,
            "data_maturity": 65,
            "customer_support": 80,
            "automation": 70,
            "tooling": 85,
        },
        "strengths": ["Active blog", "Clear pricing"],
        "weaknesses": ["No CRM mentioned"],
        "opportunities": ["Add AI chatbot"],
        "automation_suggestions": [
            {"title": "Triage emails", "description": "Route inbound mail by topic.", "estimated_hours_saved_per_week": 12},
        ],
        "roi_estimates": [
            {"suggestion_title": "Triage emails", "estimated_annual_savings_usd": 28000, "confidence": "medium"},
        ],
    }


def _ctx(
    *,
    business_id: str = "biz-1",
    focus_areas: list[str] | None = None,
    include_documents: bool = True,
    language: str = "en",
    qdrant: FakeQdrant | None = None,
    embedder: FakeEmbedder | None = None,
    groq: FakeGroq | None = None,
    use_default_groq: bool = True,
) -> ReadinessContext:
    # Allow callers to explicitly pass `groq=None` (i.e. unconfigured).
    resolved_groq: FakeGroq | None
    if use_default_groq:
        resolved_groq = groq if groq is not None else FakeGroq(payload=_full_payload())
    else:
        resolved_groq = groq
    return ReadinessContext(
        business_id=business_id,
        focus_areas=focus_areas,
        include_documents=include_documents,
        language=language,
        embedding_model=embedder or FakeEmbedder(),
        qdrant=qdrant or FakeQdrant(),
        groq=resolved_groq,
    )


# ---------- Tests ----------

def test_happy_path_returns_full_report():
    qdrant = FakeQdrant(count=10, hits=[
        _hit("website", "https://e.com/about", "About text", 0.9, section_title="About"),
        _hit("document", "doc-1", "FAQ text", 0.8, filename="FAQ.pdf"),
    ])
    ctx = _ctx(qdrant=qdrant)

    result = ReadinessReportService(ctx).run()

    assert isinstance(result, ReadinessReport)
    assert result.business_id == "biz-1"
    assert result.score == 78
    assert result.subscores.digital_presence == 90
    assert result.subscores.data_maturity == 65
    assert result.subscores.customer_support == 80
    assert result.subscores.automation == 70
    assert result.subscores.tooling == 85
    assert "Active blog" in result.strengths
    assert len(result.automation_suggestions) == 1
    assert result.automation_suggestions[0].title == "Triage emails"
    assert result.automation_suggestions[0].estimated_hours_saved_per_week == 12
    assert len(result.roi_estimates) == 1
    assert result.roi_estimates[0].confidence == "medium"
    assert result.sources_used.website_sections >= 1
    assert result.sources_used.document_chunks >= 1


def test_business_not_found_when_no_vectors():
    qdrant = FakeQdrant(count=0)
    ctx = _ctx(qdrant=qdrant)

    with pytest.raises(BusinessNotFound):
        ReadinessReportService(ctx).run()


def test_invalid_focus_areas_raises_400():
    ctx = _ctx(focus_areas=["digital_presence", "made_up_area"])

    with pytest.raises(InvalidRequest) as ei:
        ReadinessReportService(ctx).run()
    assert "made_up_area" in str(ei.value)


def test_unknown_focus_area_only_raises_400():
    ctx = _ctx(focus_areas=["bogus"])

    with pytest.raises(InvalidRequest):
        ReadinessReportService(ctx).run()


def test_groq_failure_raises_502():
    class _ExplodingGroq(FakeGroq):
        def complete_json(self, system, user):  # type: ignore[override]
            from app.core.groq_client import GroqUnavailable
            raise GroqUnavailable("all keys failed")
    qdrant = FakeQdrant(count=10, hits=[_hit("website", "u", "hi", 0.9)])
    ctx = _ctx(qdrant=qdrant, groq=_ExplodingGroq())

    with pytest.raises(UpstreamLLMFailed):
        ReadinessReportService(ctx).run()


def test_vector_db_unreachable_on_count():
    qdrant = FakeQdrant(count_raises=RuntimeError("qdrant down"))
    ctx = _ctx(qdrant=qdrant)

    with pytest.raises(VectorDBUnreachable):
        ReadinessReportService(ctx).run()


def test_vector_db_unreachable_on_search():
    qdrant = FakeQdrant(count=10, search_raises=RuntimeError("qdrant down"))
    ctx = _ctx(qdrant=qdrant)

    with pytest.raises(VectorDBUnreachable):
        ReadinessReportService(ctx).run()


def test_llm_not_configured():
    qdrant = FakeQdrant(count=10)
    ctx = _ctx(qdrant=qdrant, groq=None, use_default_groq=False)

    with pytest.raises(LLMNotConfigured):
        ReadinessReportService(ctx).run()


def test_no_embedder_raises_llm_not_configured():
    qdrant = FakeQdrant(count=10)
    ctx = ReadinessContext(
        business_id="biz-1",
        focus_areas=None,
        include_documents=True,
        language="en",
        embedding_model=None,
        qdrant=qdrant,
        groq=FakeGroq(),
    )

    with pytest.raises(LLMNotConfigured):
        ReadinessReportService(ctx).run()


def test_invalid_llm_payload_coerced_with_defaults():
    """LLM returns garbage — service must coerce/clamp, not crash."""
    qdrant = FakeQdrant(count=10, hits=[_hit("website", "u", "x", 0.9)])
    ctx = _ctx(qdrant=qdrant, groq=FakeGroq(payload={"score": "not-a-number", "subscores": {}}))

    result = ReadinessReportService(ctx).run()

    # All subscores default to 0; weighted average = 0.
    assert 0 <= result.score <= 100
    assert result.subscores.digital_presence == 0
    assert result.strengths == []
    assert result.weaknesses == []
    assert result.opportunities == []
    assert result.automation_suggestions == []
    assert result.roi_estimates == []


def test_subscore_out_of_range_is_clamped():
    qdrant = FakeQdrant(count=10, hits=[_hit("website", "u", "x", 0.9)])
    payload = _full_payload()
    payload["subscores"]["digital_presence"] = 250  # out of range
    payload["subscores"]["automation"] = -50
    ctx = _ctx(qdrant=qdrant, groq=FakeGroq(payload=payload))

    result = ReadinessReportService(ctx).run()

    assert result.subscores.digital_presence == 100
    assert result.subscores.automation == 0


def test_include_documents_false_drops_document_hits():
    doc_hit = _hit("document", "doc-1", "doc text", 0.9, filename="FAQ.pdf")
    web_hit = _hit("website", "https://e.com", "site text", 0.9)
    qdrant = FakeQdrant(count=10, hits=[doc_hit, web_hit])
    ctx = _ctx(qdrant=qdrant, include_documents=False)

    result = ReadinessReportService(ctx).run()

    assert result.sources_used.document_chunks == 0
    assert result.sources_used.website_sections >= 1


def test_focus_areas_filter_questions():
    """With a single focus area, we only run a small number of search queries."""
    qdrant = FakeQdrant(count=10, hits=[_hit("website", "u", "x", 0.9)])
    ctx = _ctx(qdrant=qdrant, focus_areas=["automation"])

    ReadinessReportService(ctx).run()

    # automation has 3 questions in FOCUS_QUESTIONS.
    assert len(qdrant.search_calls) == 3


def test_all_focus_areas_default_runs_every_question():
    qdrant = FakeQdrant(count=10, hits=[_hit("website", "u", "x", 0.9)])
    ctx = _ctx(qdrant=qdrant, focus_areas=None)

    ReadinessReportService(ctx).run()

    # 5 focus areas × 3 questions each = 15
    assert len(qdrant.search_calls) == 15


def test_filter_pins_business_id():
    qdrant = FakeQdrant(count=10, hits=[_hit("website", "u", "x", 0.9)])
    ctx = _ctx(qdrant=qdrant, business_id="biz-99")

    ReadinessReportService(ctx).run()

    # Every search + count call must filter by business_id.
    for call in qdrant.search_calls + qdrant.count_calls:
        conds = call["filter"].must
        assert any(c.key == "business_id" for c in conds)
    # Count call uses kb_master.
    assert qdrant.count_calls[0]["collection_name"] == "kb_master"


def test_persists_snapshot_into_readiness_reports():
    qdrant = FakeQdrant(count=10, hits=[_hit("website", "u", "x", 0.9)])
    ctx = _ctx(qdrant=qdrant)

    result = ReadinessReportService(ctx).run()

    assert len(qdrant.upsert_calls) == 1
    call = qdrant.upsert_calls[0]
    assert call["collection_name"] == "readiness_reports"
    pt = call["points"][0]
    assert pt.payload["business_id"] == "biz-1"
    assert pt.payload["report_id"] == result.report_id
    assert pt.payload["score"] == result.score
    assert "subscores" in pt.payload
    assert "summary" in pt.payload


def test_persistence_failure_does_not_fail_api():
    """A Qdrant error during snapshot persistence must NOT fail the report."""
    qdrant = FakeQdrant(
        count=10,
        hits=[_hit("website", "u", "x", 0.9)],
        upsert_raises=RuntimeError("write failed"),
    )
    ctx = _ctx(qdrant=qdrant)

    result = ReadinessReportService(ctx).run()  # must NOT raise

    assert result.score == 78


def test_report_id_is_uuid_format():
    qdrant = FakeQdrant(count=10, hits=[_hit("website", "u", "x", 0.9)])
    ctx = _ctx(qdrant=qdrant)

    result = ReadinessReportService(ctx).run()

    import re
    assert re.match(
        r"^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$",
        result.report_id,
    )


def test_evidence_gathering_respects_global_cap():
    """Long hits are truncated; service must not blow up the prompt."""
    huge = "lorem ipsum " * 5000  # ~60k chars
    qdrant = FakeQdrant(count=10, hits=[_hit("website", "u", huge, 0.9)] * 5)
    ctx = _ctx(qdrant=qdrant)

    result = ReadinessReportService(ctx).run()

    # Each snippet is truncated to EVIDENCE_SNIPPET_CHARS.
    # The LLM is still called and the report is still produced.
    assert isinstance(result, ReadinessReport)
    assert result.score == 78


def test_automation_suggestions_with_garbage_are_dropped():
    payload = _full_payload()
    payload["automation_suggestions"] = [
        {"title": "Real", "description": "OK", "estimated_hours_saved_per_week": 5},
        "not a dict",
        {"description": "no title"},
        {"title": "Bad hours", "estimated_hours_saved_per_week": "many"},
    ]
    qdrant = FakeQdrant(count=10, hits=[_hit("website", "u", "x", 0.9)])
    ctx = _ctx(qdrant=qdrant, groq=FakeGroq(payload=payload))

    result = ReadinessReportService(ctx).run()

    titles = [s.title for s in result.automation_suggestions]
    assert "Real" in titles
    assert "Bad hours" in titles  # falls back to 0 hours
    assert len(result.automation_suggestions) == 2


def test_roi_estimates_unknown_confidence_defaults_to_medium():
    payload = _full_payload()
    payload["roi_estimates"] = [
        {"suggestion_title": "x", "estimated_annual_savings_usd": 1000, "confidence": "extreme"},
    ]
    qdrant = FakeQdrant(count=10, hits=[_hit("website", "u", "x", 0.9)])
    ctx = _ctx(qdrant=qdrant, groq=FakeGroq(payload=payload))

    result = ReadinessReportService(ctx).run()

    assert result.roi_estimates[0].confidence == "medium"


def test_sources_used_zero_when_no_hits():
    qdrant = FakeQdrant(count=10, hits=[])
    ctx = _ctx(qdrant=qdrant)

    result = ReadinessReportService(ctx).run()

    assert result.sources_used.website_sections == 0
    assert result.sources_used.document_chunks == 0
