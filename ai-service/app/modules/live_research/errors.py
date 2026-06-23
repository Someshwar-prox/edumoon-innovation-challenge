"""Exception hierarchy for the live research module."""
from __future__ import annotations


class LiveResearchError(Exception):
    status_code: int = 500
    code: str = "internal_error"


class UpstreamSearchFailed(LiveResearchError):
    status_code = 502
    code = "upstream_search_failed"


class LLMNotConfigured(LiveResearchError):
    status_code = 503
    code = "llm_not_configured"
