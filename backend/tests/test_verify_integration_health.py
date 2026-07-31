"""Regression tests for the dual-database integration health verifier."""

from __future__ import annotations

import importlib.util
import sys
from pathlib import Path

import pytest


SCRIPT_PATH = (
    Path(__file__).resolve().parents[2]
    / "scripts"
    / "verify"
    / "verify_integration_health.py"
)
SPEC = importlib.util.spec_from_file_location("verify_integration_health", SCRIPT_PATH)
assert SPEC and SPEC.loader
health = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(health)


class _CountResult:
    count = 12
    data = []


class _Query:
    def select(self, *_args, **_kwargs):
        return self

    def eq(self, *_args, **_kwargs):
        return self

    def in_(self, *_args, **_kwargs):
        return self

    def execute(self):
        return _CountResult()


class _Client:
    def __init__(self, name: str):
        self.name = name
        self.tables: list[str] = []

    def table(self, name: str):
        self.tables.append(name)
        return _Query()


def test_get_rag_client_requires_dedicated_rag_credentials(monkeypatch):
    monkeypatch.delenv("RAG_SUPABASE_URL", raising=False)
    monkeypatch.delenv("RAG_SUPABASE_SECRET_KEY", raising=False)
    monkeypatch.delenv("RAG_SUPABASE_SERVICE_ROLE_KEY", raising=False)

    with pytest.raises(SystemExit) as error:
        health.get_rag_client()

    assert error.value.code == 1


def test_main_uses_rag_database_only_for_chunk_coverage(monkeypatch):
    pm_client = _Client("pm")
    rag_client = _Client("rag")
    chunk_clients: list[_Client] = []
    snapshot_clients: list[_Client] = []

    monkeypatch.setattr(health, "get_pm_client", lambda: pm_client)
    monkeypatch.setattr(health, "get_rag_client", lambda: rag_client)
    monkeypatch.setattr(health, "SOURCE_CHECKS", [])
    monkeypatch.setattr(health, "check_graph_sync_state", lambda client: [])
    monkeypatch.setattr(
        health,
        "check_ai_source_health_snapshots",
        lambda client: snapshot_clients.append(client) or [],
    )
    monkeypatch.setattr(
        health,
        "check_chunk_coverage",
        lambda client: chunk_clients.append(client) or [],
    )
    monkeypatch.setattr(sys, "argv", [str(SCRIPT_PATH), "--skip-env", "--json"])

    assert health.main() == 0
    assert snapshot_clients == [rag_client]
    assert chunk_clients == [rag_client]


def test_json_mode_returns_nonzero_for_unhealthy_check(monkeypatch, capsys):
    pm_client = _Client("pm")
    rag_client = _Client("rag")

    monkeypatch.setattr(health, "get_pm_client", lambda: pm_client)
    monkeypatch.setattr(health, "get_rag_client", lambda: rag_client)
    monkeypatch.setattr(health, "SOURCE_CHECKS", [])
    monkeypatch.setattr(health, "check_graph_sync_state", lambda client: [])
    monkeypatch.setattr(health, "check_ai_source_health_snapshots", lambda client: [])
    monkeypatch.setattr(
        health,
        "check_chunk_coverage",
        lambda client: [{"name": "Email chunks", "status": "missing"}],
    )
    monkeypatch.setattr(sys, "argv", [str(SCRIPT_PATH), "--skip-env", "--json"])

    assert health.main() == 1
    assert '"status": "missing"' in capsys.readouterr().out


def test_chunk_query_failure_is_loud_and_critical():
    class _BrokenClient:
        def table(self, _name: str):
            raise RuntimeError("unavailable")

    checks = health.check_chunk_coverage(_BrokenClient())

    assert checks
    assert all(check["status"] == "error" for check in checks)
    assert all(check["critical"] is True for check in checks)
    assert all("query failed" in check["error"] for check in checks)
