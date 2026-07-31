"""Tests for with_db_retry transient classification.

Regression coverage for the 2026-06-24 degraded-search incident: a concurrent
`search_document_chunks` RPC returned HTTP 500 / "canceling statement due to
statement timeout" and was NOT retried (the old wrapper only caught SQLAlchemy
OperationalError), so the failure was swallowed into a false "no matching
passages". The wrapper must retry load-induced RPC timeouts/5xx while still
propagating genuine errors immediately.
"""
import pytest

from src.services.agents.alleato_ai_tools._retry import with_db_retry


class _ApiError(Exception):
    """Stand-in for postgrest.exceptions.APIError (message-based detection)."""


def test_retries_statement_timeout_then_succeeds(monkeypatch):
    monkeypatch.setattr("time.sleep", lambda *_: None)
    calls = {"n": 0}

    @with_db_retry
    def flaky():
        calls["n"] += 1
        if calls["n"] < 3:
            raise _ApiError("canceling statement due to statement timeout")
        return "ok"

    assert flaky() == "ok"
    assert calls["n"] == 3


def test_retries_rpc_500(monkeypatch):
    monkeypatch.setattr("time.sleep", lambda *_: None)
    calls = {"n": 0}

    @with_db_retry
    def flaky():
        calls["n"] += 1
        if calls["n"] < 2:
            raise _ApiError("{'message': 'Internal Server Error'}")
        return "rows"

    assert flaky() == "rows"
    assert calls["n"] == 2


def test_does_not_retry_real_error():
    calls = {"n": 0}

    @with_db_retry
    def broken():
        calls["n"] += 1
        raise _ApiError('column "content" does not exist')

    with pytest.raises(_ApiError):
        broken()
    assert calls["n"] == 1  # no retry — propagates immediately


def test_gives_up_after_max_attempts(monkeypatch):
    monkeypatch.setattr("time.sleep", lambda *_: None)
    calls = {"n": 0}

    @with_db_retry
    def always_times_out():
        calls["n"] += 1
        raise _ApiError("57014: canceling statement due to statement timeout")

    with pytest.raises(_ApiError):
        always_times_out()
    assert calls["n"] == 3
