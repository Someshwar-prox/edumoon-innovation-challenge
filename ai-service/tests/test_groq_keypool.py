"""Unit tests for the GroqKeyPool failover behavior."""
from __future__ import annotations

from unittest.mock import MagicMock, patch

import pytest
from groq import APIConnectionError, APITimeoutError, AuthenticationError, RateLimitError

from app.core.groq_client import GroqClient, GroqKeyPool, GroqUnavailable


# ---------- Helpers ----------

def _make_client(label: str, *, raises: Exception | None = None, returns: object = None) -> GroqClient:
    """Build a GroqClient without instantiating the real groq.Groq SDK."""
    c = GroqClient.__new__(GroqClient)
    c.api_key = f"gsk_{label}"
    c._model = "test-model"
    c._temperature = 0.2
    c._max_tokens = 1024
    c._calls: list[tuple[str, str]] = []

    def _complete_json(system: str, user: str):
        c._calls.append(("json", user))
        if raises is not None:
            raise raises
        return returns or {"ok": True}

    def _complete_chat(system: str, user: str):
        c._calls.append(("chat", user))
        if raises is not None:
            raise raises
        return returns if isinstance(returns, str) else "answer"

    # Bind as bound methods
    c.complete_json = _complete_json  # type: ignore[method-assign]
    c.complete_chat = _complete_chat  # type: ignore[method-assign]
    return c


def _rate_limit_error():
    # groq's RateLimitError requires an SDK response object; build a minimal stand-in.
    fake_response = MagicMock()
    fake_response.status_code = 429
    fake_response.headers = {}
    return RateLimitError(
        message="rate limited",
        body={"error": {"message": "rate limited"}},
        response=fake_response,
    )


def _auth_error():
    fake_response = MagicMock()
    fake_response.status_code = 401
    return AuthenticationError(
        message="bad key",
        body={"error": {"message": "bad key"}},
        response=fake_response,
    )


# ---------- Tests ----------

def test_first_key_succeeds_no_failover():
    c1 = _make_client("1", returns={"x": 1})
    c2 = _make_client("2", returns={"x": 2})
    pool = GroqKeyPool([c1, c2])

    result = pool.complete_json("sys", "user")

    assert result == {"x": 1}
    assert len(c1._calls) == 1
    assert c2._calls == []  # never tried


def test_failover_to_second_key_on_rate_limit():
    c1 = _make_client("1", raises=_rate_limit_error())
    c2 = _make_client("2", returns={"x": "second"})
    pool = GroqKeyPool([c1, c2])

    result = pool.complete_json("sys", "user")

    assert result == {"x": "second"}
    assert len(c1._calls) == 1
    assert len(c2._calls) == 1


def test_failover_on_auth_error():
    c1 = _make_client("1", raises=_auth_error())
    c2 = _make_client("2", returns="ok")
    pool = GroqKeyPool([c1, c2])

    result = pool.complete_chat("sys", "user")

    assert result == "ok"
    assert len(c1._calls) == 1
    assert len(c2._calls) == 1


def test_failover_on_connection_and_timeout_errors():
    c1 = _make_client("1", raises=APIConnectionError(request=MagicMock()))
    c2 = _make_client("2", raises=APITimeoutError(request=MagicMock()))
    c3 = _make_client("3", returns="third")
    pool = GroqKeyPool([c1, c2, c3])

    result = pool.complete_chat("sys", "user")

    assert result == "third"
    assert len(c1._calls) == 1
    assert len(c2._calls) == 1
    assert len(c3._calls) == 1


def test_all_keys_exhausted_raises_groq_unavailable():
    c1 = _make_client("1", raises=_rate_limit_error())
    c2 = _make_client("2", raises=_rate_limit_error())
    c3 = _make_client("3", raises=_auth_error())
    pool = GroqKeyPool([c1, c2, c3])

    with pytest.raises(GroqUnavailable) as excinfo:
        pool.complete_json("sys", "user")
    assert "all 3 groq key(s) failed" in str(excinfo.value)
    # Original last error is preserved as __cause__
    assert isinstance(excinfo.value.__cause__, AuthenticationError)


def test_permanent_error_does_not_failover():
    """GroqUnavailable from inner client (e.g. bad request) propagates immediately."""
    c1 = _make_client("1", raises=GroqUnavailable("permanent: bad request"))
    c2 = _make_client("2", returns={"x": 2})
    pool = GroqKeyPool([c1, c2])

    with pytest.raises(GroqUnavailable) as excinfo:
        pool.complete_json("sys", "user")
    assert "permanent" in str(excinfo.value)
    # Critical: c2 was NOT called.
    assert c2._calls == []


def test_single_key_pool_works():
    c1 = _make_client("only", returns={"x": 1})
    pool = GroqKeyPool([c1])

    assert pool.complete_json("sys", "user") == {"x": 1}
    assert pool.n_keys == 1


def test_pool_rejects_empty():
    with pytest.raises(ValueError):
        GroqKeyPool([])


# ---------- Backward-compat: settings still produce a working pool ----------

def test_settings_legacy_groq_api_key_becomes_single_key_pool():
    """GROQ_API_KEY (singular) should still produce a working pool."""
    from app.core.config import Settings

    s = Settings(groq_api_key="gsk_legacy", groq_api_keys="")
    assert s.groq_api_key_list == ["gsk_legacy"]


def test_settings_groq_api_keys_wins_over_legacy():
    from app.core.config import Settings

    s = Settings(groq_api_key="gsk_old", groq_api_keys="gsk_new1, gsk_new2")
    assert s.groq_api_key_list == ["gsk_new1", "gsk_new2", "gsk_old"]


def test_settings_filters_empty_and_placeholder():
    from app.core.config import Settings

    s = Settings(groq_api_key="replace-me", groq_api_keys="gsk_real,,")
    assert s.groq_api_key_list == ["gsk_real"]


def test_get_groq_returns_none_when_no_keys():
    with patch("app.core.groq_client.settings") as mock_settings:
        mock_settings.groq_api_key_list = []
        # Bust the lru_cache
        from app.core.groq_client import get_groq
        get_groq.cache_clear()
        assert get_groq() is None
        get_groq.cache_clear()


def test_get_groq_returns_pool_when_keys_set():
    with patch("app.core.groq_client.settings") as mock_settings:
        mock_settings.groq_api_key_list = ["gsk_a", "gsk_b"]
        mock_settings.groq_model = "m"
        mock_settings.groq_temperature = 0.2
        mock_settings.groq_max_tokens = 1024
        mock_settings.groq_timeout_seconds = 30
        from app.core.groq_client import get_groq
        get_groq.cache_clear()
        pool = get_groq()
        assert isinstance(pool, GroqKeyPool)
        assert pool.n_keys == 2
        get_groq.cache_clear()