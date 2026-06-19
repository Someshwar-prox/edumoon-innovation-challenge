"""Exception hierarchy for the chatbot module."""
from __future__ import annotations


class ChatError(Exception):
    status_code: int = 500
    code: str = "internal_error"


class BusinessNotFound(ChatError):
    status_code = 404
    code = "business_not_found"


class LLMNotConfigured(ChatError):
    status_code = 503
    code = "llm_not_configured"


class UpstreamLLMFailed(ChatError):
    status_code = 502
    code = "upstream_llm_failed"


class VectorDBUnreachable(ChatError):
    status_code = 503
    code = "vector_db_unreachable"
