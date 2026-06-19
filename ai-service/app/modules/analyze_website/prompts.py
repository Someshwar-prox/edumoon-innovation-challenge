"""Prompts and chunking helpers used by the analyze-website service."""
from __future__ import annotations

SYSTEM_PROMPT = """You are a structured-information extractor for a B2B onboarding system.

Given the text of a business website, emit a single JSON object that matches the
schema below. Rules:

1. Use ONLY information present in the supplied text. Do not invent or assume.
2. Keep each string under ~300 characters.
3. If a field cannot be determined, use empty string "" (or [] for arrays).
4. The "company_summary" must be 2-4 sentences describing what the business does,
   who it serves, and what makes it distinctive.
5. "services" are intangible capabilities the business sells.
6. "products" are tangible / named offerings.
7. "faqs" are question/answer pairs that appear on the site (FAQ pages, schema,
   or clearly phrased as Q&A in body text). If none exist, return [].
8. Output ONLY the JSON object. No prose, no markdown fences.
"""

JSON_SCHEMA_SPEC = """{
  "company_summary": "<2-4 sentences>",
  "services": [{"name": "<service>", "description": "<one-line>"}],
  "products": [{"name": "<product>", "description": "<one-line>"}],
  "faqs": [{"question": "<q>", "answer": "<a>"}]
}
"""


def build_user_prompt(long_text: str, structured_hints: dict) -> str:
    parts: list[str] = [
        "Output exactly one JSON object with this shape:",
        JSON_SCHEMA_SPEC,
        "",
        "Reference material (may be empty):",
    ]
    if structured_hints.get("organization"):
        parts.append(f"- Organization hints: {structured_hints['organization']}")
    if structured_hints.get("faqs"):
        parts.append("- FAQ hints (you may keep, edit, or drop):")
        for faq in structured_hints["faqs"][:20]:
            parts.append(f"  Q: {faq.get('question')}\n  A: {faq.get('answer')}")
    parts.append("")
    parts.append("Website text:")
    parts.append(long_text)
    return "\n".join(parts)


def pick_top_pages(pages: list[dict], k: int = 5, max_chars: int = 12000) -> list[dict]:
    """Pick the longest `k` pages, fitting under `max_chars`, to send to the LLM."""
    ranked = sorted(pages, key=lambda p: len(p.get("cleaned_text") or ""), reverse=True)
    chosen: list[dict] = []
    used = 0
    for p in ranked:
        text = p.get("cleaned_text") or ""
        if not text:
            continue
        if used + len(text) > max_chars and chosen:
            break
        chosen.append(p)
        used += len(text)
        if len(chosen) >= k:
            break
    return chosen


def join_pages_for_prompt(pages: list[dict]) -> str:
    chunks: list[str] = []
    for p in pages:
        chunks.append(f"[PAGE url={p.get('url')} title={p.get('title', '')}]")
        chunks.append(p.get("cleaned_text", ""))
        chunks.append("")
    return "\n".join(chunks).strip()
