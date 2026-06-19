"""Prompt templates and the default no-hits answer."""
from __future__ import annotations


SYSTEM_PROMPT = (
    "You are a helpful support assistant for a business. "
    "Answer ONLY using the supplied numbered context. "
    "If the answer is not in the context, reply exactly: "
    "\"I don't have that information in my current knowledge base.\" "
    "Be concise (2-4 sentences). Do not invent facts, prices, dates, or policies. "
    "Cite the relevant context numbers in parentheses when useful, e.g. \"(1)(2)\"."
)

DEFAULT_NO_HITS_ANSWER = "I don't have that information in my current knowledge base."


def build_user_prompt(question: str, hits: list[dict]) -> str:
    parts: list[str] = ["Context (numbered, each from a separate source):", ""]
    for i, hit in enumerate(hits, 1):
        meta = (
            hit.get("filename")
            or hit.get("section_title")
            or hit.get("source_id")
            or "source"
        )
        text = (hit.get("text") or "").strip()
        parts.append(f"[{i}] ({hit.get('source_type', 'source')} — {meta})\n{text}")
        parts.append("")
    parts.append(f"Question: {question.strip()}")
    parts.append("Answer:")
    return "\n".join(parts)
