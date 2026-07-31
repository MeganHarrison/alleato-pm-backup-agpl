"""Guardrail coverage: DB-connectivity failures must surface loudly.

Regression coverage for the 2026-07-09 incident where `DATABASE_URL` pointed at
the Supabase IPv6-only direct host, psycopg2 raised "Network is unreachable",
every structured DB tool swallowed it, and the AI answered "no portfolio data".

These tests assert that:
- a connectivity error is distinguished from a SQL / statement-timeout error,
- DB tools return a loud "DATABASE UNREACHABLE" message on an outage,
- `recent_activity` returns a degraded banner when every table is unreachable,
- the research runtime prepends a degraded-mode banner (never a silent answer),
- host-parity flags a drift back to the direct host.
"""

from __future__ import annotations

from typing import Any

import pytest

from src.services.agents.alleato_ai_tools import _retry, db_health
from src.services.agents.alleato_ai_tools._retry import is_connection_error


class _OperationalError(RuntimeError):
    """Stand-in for a psycopg2/SQLAlchemy OperationalError (message-based)."""


# --------------------------------------------------------------------------- #
# Connection-error classification
# --------------------------------------------------------------------------- #

def test_is_connection_error_detects_network_unreachable():
    exc = _OperationalError(
        "(psycopg2.OperationalError) connection to server at "
        '"db.abc.supabase.co" failed: Network is unreachable'
    )
    assert is_connection_error(exc) is True


def test_is_connection_error_walks_cause_chain():
    root = _OperationalError("could not translate host name to address")
    wrapper = RuntimeError("query failed")
    wrapper.__cause__ = root
    assert is_connection_error(wrapper) is True


def test_is_connection_error_ignores_statement_timeout():
    # A statement timeout is transient-but-connected — NOT an outage.
    assert is_connection_error(_OperationalError("canceling statement due to statement timeout")) is False


def test_is_connection_error_ignores_plain_sql_error():
    assert is_connection_error(_OperationalError('column "foo" does not exist')) is False


# --------------------------------------------------------------------------- #
# Host parity (env-parity check)
# --------------------------------------------------------------------------- #

@pytest.mark.parametrize(
    "host,expected",
    [
        ("aws-1-us-east-2.pooler.supabase.com", "pooler"),
        ("db.lgveqfnpkxvzbnnwuled.supabase.co", "direct"),
        ("some.random.host", "unknown"),
        (None, "missing"),
    ],
)
def test_classify_host(host, expected):
    assert db_health.classify_host(host) == expected


def test_database_url_host_status_flags_direct_host(monkeypatch):
    monkeypatch.setenv(
        "DATABASE_URL",
        "postgresql://postgres:pw@db.lgveqfnpkxvzbnnwuled.supabase.co:5432/postgres",
    )
    parity = db_health.database_url_host_status()
    assert parity.ok is False
    assert parity.kind == "direct"
    assert "IPv6" in parity.detail


def test_database_url_host_status_ok_for_pooler(monkeypatch):
    monkeypatch.setenv(
        "DATABASE_URL",
        "postgresql://postgres.ref:pw@aws-1-us-east-2.pooler.supabase.com:6543/postgres",
    )
    parity = db_health.database_url_host_status()
    assert parity.ok is True
    assert parity.kind == "pooler"


# --------------------------------------------------------------------------- #
# Loud tool error messaging
# --------------------------------------------------------------------------- #

def test_format_db_tool_error_is_loud_on_connection_failure():
    msg = db_health.format_db_tool_error(
        _OperationalError("Network is unreachable"), tool_hint="portfolio_overview"
    )
    assert "DATABASE UNREACHABLE" in msg
    assert "do not report" in msg.lower()
    assert "portfolio_overview" in msg


def test_format_db_tool_error_is_generic_on_sql_error():
    msg = db_health.format_db_tool_error(_OperationalError('relation "x" does not exist'))
    assert "DATABASE UNREACHABLE" not in msg
    assert msg.startswith("Error:")


# --------------------------------------------------------------------------- #
# Probe
# --------------------------------------------------------------------------- #

class _FakeConn:
    def __enter__(self):
        return self

    def __exit__(self, *args):
        return False

    def execute(self, *_args, **_kwargs):
        return None


class _FakeEngine:
    def connect(self):
        return _FakeConn()


class _DeadEngine:
    def connect(self):
        raise _OperationalError(
            "(psycopg2.OperationalError) connection failed: Network is unreachable"
        )


def test_probe_app_db_reachable(monkeypatch):
    monkeypatch.setattr(db_health, "_probe_engine", lambda: _FakeEngine())
    probe = db_health.probe_app_db()
    assert probe.reachable is True
    assert probe.is_connectivity is False


def test_probe_app_db_unreachable_is_connectivity(monkeypatch):
    monkeypatch.setattr(db_health, "_probe_engine", lambda: _DeadEngine())
    probe = db_health.probe_app_db()
    assert probe.reachable is False
    assert probe.is_connectivity is True
    assert probe.error and "Network is unreachable" in probe.error


# --------------------------------------------------------------------------- #
# recent_activity full-outage banner
# --------------------------------------------------------------------------- #

def test_recent_activity_returns_banner_when_all_tables_unreachable(monkeypatch):
    from src.services.agents.alleato_ai_tools import recent

    # Every table present with a usable timestamp + project FK column, so each
    # section actually attempts a query.
    schema = {spec[1]: {"updated_at", "project_id"} for spec in recent._TABLE_SPEC}
    monkeypatch.setattr(recent, "_table_columns", lambda: schema)
    monkeypatch.setattr(recent, "_engine", lambda: _DeadEngine())

    out = recent.recent_activity.func(days_back=7)  # unwrap the @tool wrapper
    assert "Degraded mode" in out
    assert "unreachable" in out.lower()
    assert "no activity" not in out.lower()


def test_recent_activity_schema_introspection_outage_is_loud(monkeypatch):
    from src.services.agents.alleato_ai_tools import recent

    def _boom():
        raise _OperationalError("connection failed: Network is unreachable")

    monkeypatch.setattr(recent, "_table_columns", _boom)
    out = recent.recent_activity.func(days_back=7)
    assert "DATABASE UNREACHABLE" in out


# --------------------------------------------------------------------------- #
# Research runtime degraded banner
# --------------------------------------------------------------------------- #

class _FakeAgent:
    def invoke(self, payload: dict[str, Any], config: dict[str, Any] | None = None):
        return {
            "messages": [
                {"content": "Portfolio looks quiet. No project data was found."}
            ]
        }


def test_run_research_agent_prepends_degraded_banner_when_db_unreachable(monkeypatch):
    from src.services.agents import research_agent
    from src.services.agents.research_agent import ResearchRequest, run_research_agent

    banner = db_health.degraded_db_banner()
    monkeypatch.setattr(
        research_agent.agent,
        "_app_db_degraded_banner_if_unreachable",
        lambda *, source: banner,
    )

    response = run_research_agent(
        ResearchRequest(userId="u1", question="What's happening across the portfolio?"),
        create_agent=lambda **_kwargs: _FakeAgent(),
    )

    assert response.mode == "deep_agents_degraded"
    assert response.answer.startswith(banner.split("\n", 1)[0])
    assert "Degraded mode" in response.answer
    assert any(item.status == "degraded" for item in response.tool_trace)


def test_run_research_agent_stays_normal_when_db_reachable(monkeypatch):
    from src.services.agents import research_agent
    from src.services.agents.research_agent import ResearchRequest, run_research_agent

    monkeypatch.setattr(
        research_agent.agent,
        "_app_db_degraded_banner_if_unreachable",
        lambda *, source: None,
    )

    response = run_research_agent(
        ResearchRequest(userId="u1", question="What's happening across the portfolio?"),
        create_agent=lambda **_kwargs: _FakeAgent(),
    )
    assert response.mode == "deep_agents"
    assert "Degraded mode" not in response.answer
