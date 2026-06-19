"""Service layer for the readiness report module.

Stateless, testable. Aggregates evidence from kb_master via a curated
question bank, calls Groq in JSON-mode, returns a ReadinessReport,
and persists a snapshot into readiness_reports.
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
from app.core.groq_client import GroqUnavailable
from app.core.qdrant import (
    COLLECTION_KB_MASTER,
    COLLECTION_REPORTS,
)
from app.modules.readiness_report.errors import (
    BusinessNotFound,
    InvalidRequest,
    LLMNotConfigured,
    UpstreamLLMFailed,
    VectorDBUnreachable,
)
from app.modules.readiness_report.prompts import (
    ALL_FOCUS_AREAS,
    SYSTEM_PROMPT,
    build_user_prompt,
    questions_for,
)
from app.modules.readiness_report.schemas import (
    AutomationSuggestion,
    ReadinessReport,
    ROIEstimate,
    SourcesUsed,
    Subscores,
)

log = logging.getLogger(__name__)

EVIDENCE_PER_QUESTION = 3
EVIDENCE_SNIPPET_CHARS = 600
MAX_TOTAL_EVIDENCE_CHARS = 12_000


class EmbeddingLike(Protocol):
    def embed_query(self, query: str) -> list[float]: ...
    def embed(self, texts: list[str]) -> list[list[float]]: ...


class QdrantLike(Protocol):
    def search(self, *, collection_name: str, query_vector: list[float], query_filter: Any,
               limit: int, score_threshold: float, with_payload: bool) -> list: ...
    def count(self, *, collection_name: str, count_filter: Any) -> Any: ...
    def upsert(self, *, collection_name: str, points: list, wait: bool) -> Any: ...


class GroqLike(Protocol):
    def complete_json(self, system: str, user: str) -> dict: ...


@dataclass
class ReadinessContext:
    business_id: str
    focus_areas: list[str] | None
    include_documents: bool
    language: str
    embedding_model: EmbeddingLike | None
    qdrant: QdrantLike | None
    groq: GroqLike | None


class ReadinessReportService:
    def __init__(self, ctx: ReadinessContext) -> None:
        self.ctx = ctx
        self.report_id = str(uuid.uuid4())
        self._t0 = time.perf_counter()

    def run(self) -> ReadinessReport:
        log_ctx = {
            "report_id": self.report_id,
            "business_id": self.ctx.business_id,
            "focus_areas": self.ctx.focus_areas,
            "include_documents": self.ctx.include_documents,
            "stage": "start",
        }
        log.info("report started", extra=log_ctx)

        self._validate_focus_areas()

        if self.ctx.embedding_model is None:
            raise LLMNotConfigured("embedding model not configured")
        if self.ctx.qdrant is None:
            raise VectorDBUnreachable("qdrant client not configured")
        if self.ctx.groq is None:
            raise LLMNotConfigured("GROQ_API_KEY not set")

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

        pairs = questions_for(self.ctx.focus_areas)
        evidence_by_area, sources_used = self._gather_evidence(pairs, flt, log_ctx)

        user_prompt = build_user_prompt(
            evidence_by_area,
            language=self.ctx.language,
            business_id=self.ctx.business_id,
        )
        t = time.perf_counter()
        try:
            raw = self.ctx.groq.complete_json(SYSTEM_PROMPT, user_prompt)
        except GroqUnavailable as exc:
            raise UpstreamLLMFailed(str(exc)) from exc

        log.info(
            "llm answered",
            extra={**log_ctx, "stage": "llm",
                   "prompt_chars": len(user_prompt),
                   "duration_ms": int((time.perf_counter() - t) * 1000)},
        )

        report = self._coerce_report(raw, sources_used)
        self._persist(report, log_ctx)

        log.info(
            "report done",
            extra={
                **log_ctx,
                "stage": "done",
                "score": report.score,
                "duration_ms": int((time.perf_counter() - self._t0) * 1000),
            },
        )
        return report

    def _validate_focus_areas(self) -> None:
        if not self.ctx.focus_areas:
            return
        bad = [a for a in self.ctx.focus_areas if a not in ALL_FOCUS_AREAS]
        if bad:
            raise InvalidRequest(
                f"unknown focus_areas: {bad}; allowed: {list(ALL_FOCUS_AREAS)}"
            )

    def _gather_evidence(
        self,
        pairs: list[tuple[str, str]],
        flt: qmodels.Filter,
        log_ctx: dict,
    ) -> tuple[dict[str, list[str]], SourcesUsed]:
        """Embed each question, search kb_master, group snippets by focus area."""
        evidence: dict[str, list[str]] = {}
        for area in (self.ctx.focus_areas or list(ALL_FOCUS_AREAS)):
            evidence.setdefault(area, [])

        website_sections = 0
        document_chunks = 0
        used_chars = 0

        t = time.perf_counter()
        for area, question in pairs:
            if used_chars >= MAX_TOTAL_EVIDENCE_CHARS:
                break
            try:
                vec = self.ctx.embedding_model.embed_query(question)
                hits = self.ctx.qdrant.search(
                    collection_name=COLLECTION_KB_MASTER,
                    query_vector=vec,
                    query_filter=flt,
                    limit=EVIDENCE_PER_QUESTION,
                    score_threshold=settings.chat_score_threshold,
                    with_payload=True,
                )
            except Exception as exc:  # noqa: BLE001
                raise VectorDBUnreachable(f"qdrant search failed: {exc}") from exc

            for hit in hits:
                payload = getattr(hit, "payload", {}) or {}
                st = payload.get("source_type", "website")
                if not self.ctx.include_documents and st == "document":
                    continue
                if st == "website":
                    website_sections += 1
                elif st == "document":
                    document_chunks += 1
                text = (payload.get("text") or "").strip()
                if not text:
                    continue
                text = text[:EVIDENCE_SNIPPET_CHARS]
                evidence.setdefault(area, []).append(text)
                used_chars += len(text)
                if used_chars >= MAX_TOTAL_EVIDENCE_CHARS:
                    break

        log.info(
            "evidence gathered",
            extra={
                **log_ctx,
                "stage": "evidence",
                "questions": len(pairs),
                "website_sections": website_sections,
                "document_chunks": document_chunks,
                "evidence_chars": used_chars,
                "duration_ms": int((time.perf_counter() - t) * 1000),
            },
        )
        return evidence, SourcesUsed(
            website_sections=website_sections,
            document_chunks=document_chunks,
        )

    def _coerce_report(self, raw: dict, sources_used: SourcesUsed) -> ReadinessReport:
        if not isinstance(raw, dict):
            raw = {}

        sub_raw = raw.get("subscores") or {}
        subscores = Subscores(
            digital_presence=_clamp(sub_raw.get("digital_presence"), default=0),
            data_maturity=_clamp(sub_raw.get("data_maturity"), default=0),
            customer_support=_clamp(sub_raw.get("customer_support"), default=0),
            automation=_clamp(sub_raw.get("automation"), default=0),
            tooling=_clamp(sub_raw.get("tooling"), default=0),
        )
        score = _clamp(raw.get("score"), default=_average_subscores(subscores))

        return ReadinessReport(
            report_id=self.report_id,
            business_id=self.ctx.business_id,
            score=score,
            subscores=subscores,
            strengths=_clean_strings(raw.get("strengths")),
            weaknesses=_clean_strings(raw.get("weaknesses")),
            opportunities=_clean_strings(raw.get("opportunities")),
            automation_suggestions=_clean_automation(raw.get("automation_suggestions")),
            roi_estimates=_clean_roi(raw.get("roi_estimates")),
            sources_used=sources_used,
            created_at=datetime.now(timezone.utc),
            llm_model=settings.groq_model,
        )

    def _persist(self, report: ReadinessReport, log_ctx: dict) -> None:
        """Upsert a small vector snapshot of the report into readiness_reports.

        A Qdrant failure here must NOT fail the API call — the caller already
        has the report payload and can re-persist later.
        """
        assert self.ctx.qdrant is not None

        summary = (
            f"AI readiness score {report.score}/100. "
            f"Strengths: {'; '.join(report.strengths[:3]) or '(none)'}. "
            f"Weaknesses: {'; '.join(report.weaknesses[:3]) or '(none)'}."
        ).strip()

        try:
            vectors = self.ctx.embedding_model.embed([summary])
            vec = vectors[0]
        except Exception:  # noqa: BLE001
            log.warning("report summary embedding failed — skipping persistence",
                        extra=log_ctx)
            return

        sid = hashlib.sha1(
            f"{self.ctx.business_id}|{report.report_id}|{report.score}".encode("utf-8")
        ).hexdigest()[:32]

        payload = {
            "business_id": self.ctx.business_id,
            "report_id": report.report_id,
            "score": report.score,
            "subscores": report.subscores.model_dump(),
            "sources_used": report.sources_used.model_dump(),
            "summary": summary,
            "created_at": report.created_at.isoformat(),
        }

        t = time.perf_counter()
        try:
            self.ctx.qdrant.upsert(
                collection_name=COLLECTION_REPORTS,
                points=[qmodels.PointStruct(id=sid, vector=vec, payload=payload)],
                wait=True,
            )
            log.info(
                "report persisted",
                extra={**log_ctx, "stage": "persist",
                       "duration_ms": int((time.perf_counter() - t) * 1000)},
            )
        except Exception as exc:  # noqa: BLE001
            log.warning(
                "report persistence failed",
                extra={**log_ctx, "stage": "persist", "error": str(exc)},
            )


def _clamp(value: Any, *, default: int) -> int:
    try:
        n = int(round(float(value)))
    except (TypeError, ValueError):
        return default
    return max(0, min(100, n))


def _average_subscores(s: Subscores) -> int:
    vals = [s.digital_presence, s.data_maturity, s.customer_support, s.automation, s.tooling]
    return int(round(sum(vals) / len(vals))) if vals else 0


def _clean_strings(value: Any) -> list[str]:
    if not isinstance(value, list):
        return []
    out: list[str] = []
    for v in value:
        if isinstance(v, str):
            stripped = v.strip()
            if stripped:
                out.append(stripped[:400])
    return out


def _clean_automation(value: Any) -> list[AutomationSuggestion]:
    if not isinstance(value, list):
        return []
    out: list[AutomationSuggestion] = []
    for v in value:
        if not isinstance(v, dict):
            continue
        title = str(v.get("title", "")).strip()
        if not title:
            continue
        try:
            hours = int(round(float(v.get("estimated_hours_saved_per_week", 0) or 0)))
        except (TypeError, ValueError):
            hours = 0
        out.append(AutomationSuggestion(
            title=title[:200],
            description=str(v.get("description", "")).strip()[:400],
            estimated_hours_saved_per_week=max(0, hours),
        ))
    return out


def _clean_roi(value: Any) -> list[ROIEstimate]:
    if not isinstance(value, list):
        return []
    out: list[ROIEstimate] = []
    for v in value:
        if not isinstance(v, dict):
            continue
        title = str(v.get("suggestion_title", "")).strip()
        if not title:
            continue
        try:
            usd = int(round(float(v.get("estimated_annual_savings_usd", 0) or 0)))
        except (TypeError, ValueError):
            usd = 0
        conf = str(v.get("confidence", "medium")).lower()
        if conf not in {"low", "medium", "high"}:
            conf = "medium"
        out.append(ROIEstimate(
            suggestion_title=title[:200],
            estimated_annual_savings_usd=max(0, usd),
            confidence=conf,  # type: ignore[arg-type]
        ))
    return out
