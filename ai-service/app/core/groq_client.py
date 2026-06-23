"""Groq client with a failover pool across multiple API keys."""
from __future__ import annotations

import json
import logging
import re
import time as _time
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

    def stream_chat(self, system: str, user: str):
        """Streaming variant of complete_chat — yields token deltas.

        Used by the chatbot route so the first token reaches the browser
        in ~0.6s instead of waiting 3-6s for the full completion.
        No retry decorator (the streaming response can't be replayed).
        """
        try:
            stream = self._client.chat.completions.create(
                model=self._model,
                messages=[
                    {"role": "system", "content": system},
                    {"role": "user", "content": user},
                ],
                temperature=self._temperature,
                max_tokens=self._max_tokens,
                stream=True,
            )
        except (RateLimitError, AuthenticationError, PermissionDeniedError,
                APIConnectionError, APITimeoutError) as exc:
            log.warning("groq stream failed (transient)", extra={"error": str(exc), "key_suffix": self.api_key[-4:]})
            raise
        except Exception as exc:  # noqa: BLE001
            log.warning("groq stream call failed", extra={"error": str(exc), "key_suffix": self.api_key[-4:]})
            raise GroqUnavailable(str(exc)) from exc
        for chunk in stream:
            try:
                delta = chunk.choices[0].delta.content
            except (AttributeError, IndexError):
                continue
            if delta:
                yield delta

    @retry(reraise=True, stop=stop_after_attempt(2), wait=wait_exponential(multiplier=0.5, min=0.5, max=4))
    def transcribe_audio(self, file_name: str, file_bytes: bytes, language: str) -> str:
        """Transcribe audio using Whisper model."""
        try:
            response = self._client.audio.transcriptions.create(
                file=(file_name, file_bytes),
                model="whisper-large-v3",
                language=language,
                temperature=0.0,
                prompt="The user is asking a business-related question in English, Hindi, or Telugu.",
            )
        except (RateLimitError, AuthenticationError, PermissionDeniedError,
                APIConnectionError, APITimeoutError) as exc:
            log.warning("groq audio failed (transient)", extra={"error": str(exc), "key_suffix": self.api_key[-4:]})
            raise
        except Exception as exc:  # noqa: BLE001
            log.warning("groq audio call failed", extra={"error": str(exc), "key_suffix": self.api_key[-4:]})
            raise GroqUnavailable(str(exc)) from exc

        return response.text.strip()


_FAILOVER_EXCEPTIONS = (
    RateLimitError,
    AuthenticationError,
    PermissionDeniedError,
    APIConnectionError,
    APITimeoutError,
)


class GroqKeyPool:
    """Holds one GroqClient per key. Rotates on transient errors.

    Two layers of protection:
      1. Per-call rotation: when one key raises RateLimitError /
         AuthenticationError / etc., move to the next key.
      2. Per-key cooldown: when a key 429s with a "tokens per day" or
         "requests per minute" message, mark that key as cooling down
         for the suggested duration and skip it for subsequent calls.
         Without this, the loop burns through the pool by re-trying
         keys that we *just* learned are at their daily quota — and
         the next chat from the same user hits the same wall.
    """

    # Cooldown durations (seconds) per error signature. The Groq API
    # surfaces the wait window in its error text ("Please try again in
    # 23m25.728s", "Rate limit reached for model X ... TPD", etc.).
    # We do best-effort regex extraction; falling back to a sensible
    # default is fine because the cooldown is a hint, not a contract.
    DEFAULT_TPD_COOLDOWN_S = 60 * 60  # tokens-per-day: assume up to 1h
    DEFAULT_RPM_COOLDOWN_S = 60       # requests-per-minute: 1 min
    DEFAULT_COOLDOWN_S = 30

    def __init__(self, clients: list[GroqClient]) -> None:
        if not clients:
            raise ValueError("GroqKeyPool needs at least one client")
        self._clients = clients
        # cooldown_until[idx] = monotonic timestamp until which the key
        # at idx should be skipped.
        self._cooldown_until: list[float] = [0.0] * len(clients)
        log.info("groq key pool initialised", extra={"n_keys": len(clients)})

    @property
    def n_keys(self) -> int:
        return len(self._clients)

    def complete_json(self, system: str, user: str) -> dict[str, Any]:
        return self._run("complete_json", system, user)

    def complete_chat(self, system: str, user: str) -> str:
        return self._run("complete_chat", system, user)

    def transcribe_audio(self, file_name: str, file_bytes: bytes, language: str) -> str:
        return self._run("transcribe_audio", file_name, file_bytes, language)

    def stream_chat(self, system: str, user: str):
        """Best-effort streaming — fail over across keys on transient
        errors. The first non-empty delta wins; subsequent keys are
        not tried because the response is already in flight.
        """
        last_exc: Exception | None = None
        now = _time.monotonic()
        for idx, client in enumerate(self._clients):
            if self._cooldown_until[idx] > now:
                continue
            try:
                yielded = False
                for delta in client.stream_chat(system, user):
                    yielded = True
                    yield delta
                if yielded:
                    return
            except _FAILOVER_EXCEPTIONS as exc:
                last_exc = exc
                self._mark_cooldown(idx, exc)
                log.warning(
                    "groq stream key exhausted, rotating",
                    extra={"key_index": idx, "n_keys": self.n_keys,
                           "error_class": exc.__class__.__name__},
                )
                continue
            except GroqUnavailable:
                raise
        if last_exc is not None:
            raise GroqUnavailable(f"all {self.n_keys} groq key(s) failed: {last_exc}") from last_exc

    def _run(self, method: str, *args, **kwargs) -> Any:
        last_exc: Exception | None = None
        now = _time.monotonic()
        # First pass: only try keys that aren't currently cooling down.
        # We loop twice because a key that just failed should be marked
        # cooling-down before we re-encounter it on the next iteration.
        tried: list[int] = []
        for idx, client in enumerate(self._clients):
            if self._cooldown_until[idx] > now:
                continue
            tried.append(idx)
            try:
                result = getattr(client, method)(*args, **kwargs)
                if idx > 0:
                    log.info(
                        "groq failover succeeded",
                        extra={"method": method, "key_index": idx, "n_keys": self.n_keys},
                    )
                return result
            except _FAILOVER_EXCEPTIONS as exc:
                last_exc = exc
                self._mark_cooldown(idx, exc)
                log.warning(
                    "groq key exhausted, rotating",
                    extra={"method": method, "key_index": idx, "n_keys": self.n_keys,
                           "error_class": exc.__class__.__name__, "error": str(exc)[:160]},
                )
                continue
            except GroqUnavailable:
                raise

        # Second pass: if every key was in cooldown, retry the soonest-
        # to-expire one anyway. Better a 429 the user can see than a
        # blanket "service unavailable" with no signal.
        if not tried:
            idx = min(range(len(self._clients)),
                      key=lambda i: self._cooldown_until[i])
            try:
                return getattr(self._clients[idx], method)(*args, **kwargs)
            except _FAILOVER_EXCEPTIONS as exc:
                last_exc = exc
                self._mark_cooldown(idx, exc)
            except GroqUnavailable:
                raise

        raise GroqUnavailable(f"all {self.n_keys} groq key(s) failed: {last_exc}") from last_exc

    def _mark_cooldown(self, idx: int, exc: Exception) -> None:
        """Mark the key at idx as cooling down for a duration derived
        from the Groq error message. Falls back to a default when the
        message doesn't match our regex.
        """
        msg = str(exc)
        m = re.search(r"try again in\s+(\d+)m([\d.]+)s", msg, flags=re.I)
        if m:
            secs = int(m.group(1)) * 60 + float(m.group(2))
        elif "tokens per day" in msg.lower() or "TPD" in msg:
            secs = self.DEFAULT_TPD_COOLDOWN_S
        elif "requests per minute" in msg.lower() or "RPM" in msg:
            secs = self.DEFAULT_RPM_COOLDOWN_S
        else:
            secs = self.DEFAULT_COOLDOWN_S
        # Cap so a misread can't lock the key for a day.
        secs = min(secs, 30 * 60)
        self._cooldown_until[idx] = _time.monotonic() + secs
        log.warning(
            "groq key marked cooldown",
            extra={"key_index": idx, "cooldown_s": int(secs)},
        )


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
