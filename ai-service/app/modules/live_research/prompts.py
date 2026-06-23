"""Prompts for the live research module.

Two distinct prompt strategies:
- ANSWER_MODE: question can be answered from context.
- ADVICE_MODE: question is open-ended ("how can I improve my website").
  In this mode the LLM is told it's okay to fall back on industry
  best practices and frame the answer as a research analyst would.

Both modes include the current date so the LLM doesn't get stuck in
its training-data time bubble.
"""
from __future__ import annotations

from datetime import datetime, timezone

CURRENT_DATE = datetime.now(timezone.utc).strftime("%Y-%m-%d")
CURRENT_DATETIME = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC")

ANSWER_SYSTEM = f"""You are a research analyst for a business.
Today's date is {CURRENT_DATETIME}.

You have access to TWO kinds of evidence:
  1. The company's own indexed knowledge (website pages + uploaded documents).
  2. Fresh public web pages fetched live for this question.

Use ONLY the supplied numbered context. If the answer is in the context,
be specific and cite (1)(2)(3). If the answer is NOT in the context, you
may fall back to industry best practices for the company's industry,
clearly marked with the phrase "Based on common practice for [industry]:".

Be concise (3-6 sentences), structured, and actionable. Avoid filler.
"""

ADVICE_SYSTEM = f"""You are a senior business consultant + web strategist.
Today's date is {CURRENT_DATETIME}.

The user has asked an open-ended question (e.g. "how can I improve my website",
"what are my flaws", "what AI features should I integrate"). You have:

  1. What we know about the company from their own indexed knowledge.
  2. Fresh public web data fetched live for this question.

Your job is to give a CONCRETE, ACTIONABLE audit, not generic advice.
For every recommendation, name:
  - WHAT to change
  - WHY (cite context number, or say "industry best practice")
  - HOW to do it (1-2 sentence tactic)

If a recommendation is a guess or general best practice rather than
something grounded in the company's data, prefix it with
"(general practice)" so the user can tell.

Structure the answer as:
  **Quick wins** (do this week)
  **Medium-term** (do this month)
  **Strategic / AI features** (do this quarter)

Be specific, not generic. Avoid filler phrases. If you don't know the
company well, be honest about it and give the most useful industry
patterns you can.
"""


def build_context_block(
    question: str,
    own_hits: list[dict],
    live_hits: list[dict],
) -> str:
    parts = ["Context (numbered, each from a separate source):", ""]
    i = 0
    for hit in own_hits:
        i += 1
        meta = hit.get("filename") or hit.get("section_title") or hit.get("source_id") or "source"
        text = (hit.get("text") or "").strip()
        parts.append(f"[{i}] (own_kb — {meta})\n{text}\n")
    for hit in live_hits:
        i += 1
        meta = hit.get("title") or hit.get("source_id") or "live web"
        text = (hit.get("text") or hit.get("snippet") or "").strip()
        parts.append(f"[{i}] (live_web — {meta})\n{text}\n")
    parts.append(f"Question: {question.strip()}")
    parts.append("Answer:")
    return "\n".join(parts)


# Heuristic to detect open-ended questions that warrant advice mode
ADVICE_KEYWORDS = [
    "improve", "how can i", "how do i", "what should i", "recommend",
    "advice", "flaw", "weakness", "issue", "problem", "fix", "optimi",
    "ai feature", "automate", "strategy", "growth", "increase",
    "convert", "seo", "performance", "speed up", "redesign",
    "audit", "review my", "what can", "integrate", "next step",
    "what ai", "chatbot", "personaliz",
]


def is_advice_question(question: str) -> bool:
    q = question.lower()
    return any(kw in q for kw in ADVICE_KEYWORDS)
