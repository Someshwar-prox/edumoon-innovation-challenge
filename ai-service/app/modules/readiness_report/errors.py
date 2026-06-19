"""Exception hierarchy for the readiness report module."""
from __future__ import annotations


class ReadinessError(Exception):
    status_code: int = 500
    code: str = "internal_error"


class BusinessNotFound(ReadinessError):
    status_code = 404
    code = "business_not_found"


class LLMNotConfigured(ReadinessError):
    status_code = 503
    code = "llm_not_configured"


class UpstreamLLMFailed(ReadinessError):
    status_code = 502
    code = "upstream_llm_failed"


class VectorDBUnreachable(ReadinessError):
    status_code = 503
    code = "vector_db_unreachable"


class InvalidRequest(ReadinessError):
    status_code = 400
    code = "invalid_request"
