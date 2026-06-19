"""Groq client with a failover pool across multiple API keys."""
from __future__ import annotations

import json
import logging
from functools import lru_cache
from typing import Any

from groq import (
    APIConnectionError,
    APITimeoutError,
    AuthenticationError,
    PermissionDeniedError,
    RateLimitError,
)
from tenacity import retry, stop_after_attempt, wait_exponential

from app.core.config import settings

log = logging.getLogger(__name__)


class GroqUnavailable(RuntimeError):
    """Raised when every key in the pool has been exhausted."""


class GroqClient:
    """One Groq API key. Use `GroqKeyPool` to fail over across several."""

    def __init__(self, api_key: str, model: str, temperature: float, max_tokens: int, timeout: int) -> None:
        if not api_key:
            raise ValueError("api_key is required")
        from groq import Groq  # noqa: WPS433

        self.api_key = api_key
        self._client = Groq(api_key=api_key, timeout=timeout)
        self._model = model
        self._temperature = temperature
        self._max_tokens = max_tokens
        log.info("groq client initialised", extra={"model": model, "key_suffix": api_key[-4:]})

    @retry(reraise=True, stop=stop_after_attempt(2), wait=wait_exponential(multiplier=0.5, min=0.5, max=4))
    def complete_json(self, system: str, user: str) -> dict[str, Any]:
        """Chat completion with JSON-mode forced output."""
        try:
            response = self._client.chat.completions.create(
                model=self._model,
                messages=[
                    {"role": "system", "content": system},
                    {"role": "user", "content": user},
                ],
                temperature=self._temperature,
                max_tokens=self._max_tokens,
                response_format={"type": "json_object"},
            )
        except (RateLimitError, AuthenticationError, PermissionDeniedError,
                APIConnectionError, APITimeoutError) as exc:
            # Transient — let the pool try the next key.
            log.warning("groq call failed (transient)", extra={"error": str(exc), "key_suffix": self.api_key[-4:]})
            raise
        except Exception as exc:  # noqa: BLE001
            log.warning("groq call failed", extra={"error": str(exc), "key_suffix": self.api_key[-4:]})
            raise GroqUnavailable(str(exc)) from exc

        content = response.choices[0].message.content or "{}"
        try:
            return json.loads(content)
        except json.JSONDecodeError as exc:
            raise GroqUnavailable(f"Groq returned non-JSON: {content[:200]}") from exc

    @retry(reraise=True, stop=stop_after_attempt(2), wait=wait_exponential(multiplier=0.5, min=0.5, max=4))
    def complete_chat(self, system: str, user: str) -> str:
        """Plain chat completion. Returns the assistant text."""
        try:
            response = self._client.chat.completions.create(
                model=self._model,
                messages=[
                    {"role": "system", "content": system},
                    {"role": "user", "content": user},
                ],
                temperature=self._temperature,
                max_tokens=self._max_tokens,
            )
        except (RateLimitError, AuthenticationError, PermissionDeniedError,
                APIConnectionError, APITimeoutError) as exc:
            log.warning("groq chat failed (transient)", extra={"error": str(exc), "key_suffix": self.api_key[-4:]})
            raise
        except Exception as exc:  # noqa: BLE001
            log.warning("groq chat call failed", extra={"error": str(exc), "key_suffix": self.api_key[-4:]})
            raise GroqUnavailable(str(exc)) from exc

        return (response.choices[0].message.content or "").strip()


_FAILOVER_EXCEPTIONS = (
    RateLimitError,
    AuthenticationError,
    PermissionDeniedError,
    APIConnectionError,
    APITimeoutError,
)


class GroqKeyPool:
    """Holds one GroqClient per key. Rotates on transient errors."""

    def __init__(self, clients: list[GroqClient]) -> None:
        if not clients:
            raise ValueError("GroqKeyPool needs at least one client")
        self._clients = clients
        log.info("groq key pool initialised", extra={"n_keys": len(clients)})

    @property
    def n_keys(self) -> int:
        return len(self._clients)

    def complete_json(self, system: str, user: str) -> dict[str, Any]:
        return self._run("complete_json", system, user)

    def complete_chat(self, system: str, user: str) -> str:
        return self._run("complete_chat", system, user)

    def _run(self, method: str, system: str, user: str) -> Any:
        last_exc: Exception | None = None
        for idx, client in enumerate(self._clients):
            try:
                result = getattr(client, method)(system, user)
                if idx > 0:
                    log.info(
                        "groq failover succeeded",
                        extra={"method": method, "key_index": idx, "n_keys": self.n_keys},
                    )
                return result
            except _FAILOVER_EXCEPTIONS as exc:
                last_exc = exc
                log.warning(
                    "groq key exhausted, rotating",
                    extra={"method": method, "key_index": idx, "n_keys": self.n_keys,
                           "error_class": exc.__class__.__name__, "error": str(exc)[:160]},
                )
                continue
            except GroqUnavailable:
                raise
        raise GroqUnavailable(f"all {self.n_keys} groq key(s) failed: {last_exc}") from last_exc


@lru_cache(maxsize=1)
def get_groq() -> GroqKeyPool | None:
    """Return a singleton GroqKeyPool, or None if no keys are configured."""
    keys = settings.groq_api_key_list
    if not keys:
        log.warning("no Groq API keys configured — LLM endpoints will return 503")
        return None
    clients = [
        GroqClient(
            api_key=k,
            model=settings.groq_model,
            temperature=settings.groq_temperature,
            max_tokens=settings.groq_max_tokens,
            timeout=settings.groq_timeout_seconds,
        )
        for k in keys
    ]
    return GroqKeyPool(clients)
