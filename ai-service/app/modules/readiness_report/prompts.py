"""Prompt templates for the AI readiness report."""
from __future__ import annotations

from typing import Iterable

FOCUS_QUESTIONS: dict[str, list[str]] = {
    "digital_presence": [
        "company overview and value proposition",
        "website navigation, blog, or content marketing",
        "social media presence and contact channels",
    ],
    "data_maturity": [
        "data collection, analytics, or reporting mentioned",
        "dashboards, KPIs, or metrics tracked",
        "CRM, data warehouse, or customer database",
    ],
    "customer_support": [
        "customer support channels and help center",
        "FAQ page or knowledge base",
        "service-level commitments or response times",
    ],
    "automation": [
        "automated workflows, integrations, or APIs",
        "marketing automation, email sequences, or chatbots",
        "internal process automation or RPA tools",
    ],
    "tooling": [
        "software tools, platforms, or technology stack",
        "cloud services, infrastructure, or hosting",
        "collaboration, project management, or productivity tools",
    ],
}

ALL_FOCUS_AREAS: tuple[str, ...] = (
    "digital_presence",
    "data_maturity",
    "customer_support",
    "automation",
    "tooling",
)


SYSTEM_PROMPT = """You are an AI readiness analyst for a B2B consulting platform.

You will receive evidence excerpts gathered from a business's website and
uploaded documents, grouped by focus area. Produce a single JSON object
matching the schema below.

Rules:
1. Use ONLY information present in the supplied evidence. Do not invent.
2. Every integer score MUST be in [0, 100] (whole numbers). The top-level
   "score" should be a weighted average of the subscores.
3. "strengths" and "weaknesses" each contain 2-5 short bullet phrases.
4. "opportunities" lists 2-5 concrete AI/automation opportunities the
   business could pursue.
5. "automation_suggestions" each have a "title", a one-sentence
   "description", and an integer "estimated_hours_saved_per_week".
6. "roi_estimates" is OPTIONAL and may be an empty list. Each entry ties a
   suggestion_title to an integer "estimated_annual_savings_usd" and a
   "confidence" of "low" | "medium" | "high". Do NOT fabricate precise
   dollar figures — if unsure, leave the list empty.
7. If evidence for a focus area is sparse, score it conservatively (lower).
8. Output ONLY the JSON object. No prose, no markdown fences.
"""


JSON_SCHEMA_SPEC = """{
  "score": <0-100>,
  "subscores": {
    "digital_presence": <0-100>,
    "data_maturity": <0-100>,
    "customer_support": <0-100>,
    "automation": <0-100>,
    "tooling": <0-100>
  },
  "strengths": ["<phrase>", ...],
  "weaknesses": ["<phrase>", ...],
  "opportunities": ["<phrase>", ...],
  "automation_suggestions": [
    {"title": "...", "description": "...", "estimated_hours_saved_per_week": <int>}
  ],
  "roi_estimates": [
    {"suggestion_title": "...", "estimated_annual_savings_usd": <int>, "confidence": "low"|"medium"|"high"}
  ]
}
"""


def questions_for(focus_areas: Iterable[str] | None) -> list[tuple[str, str]]:
    """Return [(focus_area, question), ...] for the requested focus areas.

    When `focus_areas` is None or empty, returns questions for ALL areas.
    Unknown areas are silently dropped.
    """
    areas = list(focus_areas) if focus_areas else list(ALL_FOCUS_AREAS)
    pairs: list[tuple[str, str]] = []
    for area in areas:
        for q in FOCUS_QUESTIONS.get(area, []):
            pairs.append((area, q))
    return pairs


def build_user_prompt(
    evidence_by_area: dict[str, list[str]],
    *,
    language: str,
    business_id: str,
) -> str:
    parts: list[str] = [
        f"Business ID: {business_id}",
        f"Output language for prose: {language}",
        "",
        "Output exactly one JSON object matching this schema:",
        JSON_SCHEMA_SPEC,
        "",
        "Evidence (grouped by focus area):",
    ]
    for area in ALL_FOCUS_AREAS:
        snippets = evidence_by_area.get(area) or []
        parts.append("")
        parts.append(f"### {area}")
        if not snippets:
            parts.append("(no evidence found)")
        else:
            for i, snip in enumerate(snippets, 1):
                parts.append(f"  [{i}] {snip}")
    return "\n".join(parts)
