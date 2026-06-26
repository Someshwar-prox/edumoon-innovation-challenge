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


SYSTEM_PROMPT = """You are an AI clarity analyst for a B2B consulting platform.

You will receive normalized text extracted from a business's website. Your ONLY job is to evaluate the "Content Clarity" and "Information Density" of the text to determine how easily an AI Answer Engine (like ChatGPT or Perplexity) can understand the business.

Rules:
1. Evaluate 5 sub-metrics on a scale of 0 to 5 (integers only):
   - who_score: Is it immediately clear WHO the company is?
   - what_score: Is it clear WHAT products/services they offer?
   - where_score: Is it clear WHERE they operate (location/online)?
   - why_score: Is their value proposition (WHY choose them) obvious?
   - overall_clarity: Is the text clean, well-structured, and devoid of marketing fluff?
2. Do NOT calculate the total score. Do NOT evaluate SEO or schema.
3. Identify 2-3 "strengths" (e.g., "Clear product descriptions").
4. Identify 2-3 "weaknesses" (e.g., "Fails to mention service locations").
5. Output ONLY the JSON object matching the schema below. No prose.
"""

JSON_SCHEMA_SPEC = """{
  "who_score": <0-5>,
  "what_score": <0-5>,
  "where_score": <0-5>,
  "why_score": <0-5>,
  "overall_clarity": <0-5>,
  "strengths": ["<phrase>", ...],
  "weaknesses": ["<phrase>", ...]
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
