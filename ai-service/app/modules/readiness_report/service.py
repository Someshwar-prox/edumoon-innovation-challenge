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
import json
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
    SYSTEM_PROMPT,
)
from app.modules.readiness_report.schemas import (
    AutomationSuggestion,
    Breakdown,
    ReadinessReport,
)
from app.modules.readiness_report.collection import collect_evidence, ExtractionFailure, AuditEvidence
from app.modules.readiness_report.rule_engine import analyze_rules

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
    url: str | None
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

    async def run(self) -> ReadinessReport:
        log_ctx = {
            "report_id": self.report_id,
            "business_id": self.ctx.business_id,
            "url": self.ctx.url,
            "stage": "start",
        }
        log.info("report started", extra=log_ctx)

        if self.ctx.embedding_model is None:
            raise LLMNotConfigured("embedding model not configured")
        if self.ctx.qdrant is None:
            raise VectorDBUnreachable("qdrant client not configured")
        if self.ctx.groq is None:
            raise LLMNotConfigured("GROQ_API_KEY not set")

        if not self.ctx.url:
            raise InvalidRequest("A valid url must be provided to generate a report.")

        t = time.perf_counter()
        
        # 1. Collection Layer
        try:
            evidence = await collect_evidence(self.ctx.url)
        except ExtractionFailure as exc:
            log.warning(f"Extraction failed: {exc}", extra=log_ctx)
            # Produce a 0 score report gracefully
            return self._empty_report(log_ctx, str(exc))
        except Exception as exc:
            log.error(f"Collection failed: {exc}", extra=log_ctx)
            return self._empty_report(log_ctx, str(exc))

        # 2. Rule Engine
        analyze_rules(evidence)
        
        # 3. AI Analysis
        user_prompt = f"Analyze this content for clarity:\n\n{evidence.markdown[:10000]}"
        t_llm = time.perf_counter()
        try:
            raw = self.ctx.groq.complete_json(SYSTEM_PROMPT, user_prompt)
        except GroqUnavailable as exc:
            raise UpstreamLLMFailed(str(exc)) from exc
            
        log.info(
            "llm answered",
            extra={**log_ctx, "stage": "llm",
                   "prompt_chars": len(user_prompt),
                   "duration_ms": int((time.perf_counter() - t_llm) * 1000)},
        )
        
        # 4. Weighted Scoring (75% Deterministic, 25% AI)
        if isinstance(raw, dict):
            who = _clamp_score(raw.get("who_score"), 5)
            what = _clamp_score(raw.get("what_score"), 5)
            where = _clamp_score(raw.get("where_score"), 5)
            why = _clamp_score(raw.get("why_score"), 5)
            overall = _clamp_score(raw.get("overall_clarity"), 5)
            
            ai_clarity_score = (who + what + where + why + overall) / 25.0 * 25.0
            evidence.ai_score = ai_clarity_score
            evidence.ai_clarity_scores = {
                "who": who, "what": what, "where": where, "why": why, "overall": overall
            }
        else:
            evidence.ai_score = 12.5 # default 50%
            
        evidence.final_score = evidence.deterministic_score + evidence.ai_score
        
        # 5. Recommendation Engine
        recommendations = [
            AutomationSuggestion(
                title=r["title"],
                description=r["fix"],
                severity=r["severity"]
            )
            for r in getattr(evidence, "rule_recommendations", [])
        ]

        report = ReadinessReport(
            report_id=self.report_id,
            business_id=self.ctx.business_id,
            score=int(round(evidence.final_score)),
            breakdown=Breakdown(
                accessibility=int(round(evidence.accessibility.get("score", 0))),
                structured_data=int(round(evidence.schema_analysis.get("score", 0))),
                semantic_structure=int(round(evidence.semantic_structure.get("score", 0))),
                content_clarity=int(round(evidence.ai_score)),
            ),
            confidence=evidence.extraction_confidence,
            strengths=_clean_strings(raw.get("strengths") if isinstance(raw, dict) else []),
            weaknesses=_clean_strings(raw.get("weaknesses") if isinstance(raw, dict) else []),
            recommendations=recommendations,
            created_at=datetime.now(timezone.utc),
            llm_model=settings.groq_model,
        )
        
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

    def _empty_report(self, log_ctx: dict, reason: str) -> ReadinessReport:
        report = ReadinessReport(
            report_id=self.report_id,
            business_id=self.ctx.business_id,
            score=0,
            breakdown=Breakdown(accessibility=0, structured_data=0, semantic_structure=0, content_clarity=0),
            confidence=0,
            strengths=[],
            weaknesses=[reason],
            recommendations=[],
            created_at=datetime.now(timezone.utc),
            llm_model=settings.groq_model,
        )
        self._persist(report, log_ctx)
        return report

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
            "subscores": report.breakdown.model_dump(),
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


def _clamp_score(value: Any, max_val: int) -> int:
    try:
        n = int(round(float(value)))
    except (TypeError, ValueError):
        return 0
    return max(0, min(max_val, n))


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



