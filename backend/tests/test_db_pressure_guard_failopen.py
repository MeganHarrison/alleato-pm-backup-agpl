"""Regression tests for the App DB pressure guard's connection-failure handling.

The guard opens a direct psycopg2 connection to the app DB to measure pressure.
When that connection itself fails (e.g. the direct host db.<ref>.supabase.co
became IPv6-only after Supabase's IPv4 deprecation and is unreachable from the
host network), the guard must NOT hard-abort every background job unless it is
explicitly required to fail closed. Otherwise a single infra change silently
halts all embedding/task/intelligence processing.
"""
import pytest

from services.ops import db_pressure_guard as guard


@pytest.fixture(autouse=True)
def _force_url_and_break_connection(monkeypatch):
    monkeypatch.setenv("DATABASE_URL", "postgresql://u:p@db.example.supabase.co:5432/postgres")
    monkeypatch.delenv("DISABLE_APP_DB_PRESSURE_GUARD", raising=False)
    monkeypatch.delenv("APP_DB_PRESSURE_GUARD_DISABLED", raising=False)

    def _boom(_url):
        raise OSError("connection to server at \"db.example.supabase.co\" ... Network is unreachable")

    monkeypatch.setattr(guard, "_fetch_pressure_snapshot", _boom)


def test_unreachable_guard_fails_open_when_not_required(monkeypatch):
    monkeypatch.setenv("APP_DB_PRESSURE_GUARD_REQUIRED", "false")
    # Must not raise: a guard that cannot even connect should let the job run
    # rather than silently halting all background processing.
    assert guard.enforce_app_db_pressure_guard("graph_embedding") is None


def test_unreachable_guard_still_fails_closed_when_required(monkeypatch):
    monkeypatch.setenv("APP_DB_PRESSURE_GUARD_REQUIRED", "true")
    with pytest.raises(guard.AppDbPressureError):
        guard.enforce_app_db_pressure_guard("graph_embedding")


def test_disable_override_short_circuits(monkeypatch):
    monkeypatch.setenv("APP_DB_PRESSURE_GUARD_REQUIRED", "true")
    monkeypatch.setenv("DISABLE_APP_DB_PRESSURE_GUARD", "true")
    # Disable override wins even over REQUIRED.
    assert guard.enforce_app_db_pressure_guard("graph_embedding") is None
