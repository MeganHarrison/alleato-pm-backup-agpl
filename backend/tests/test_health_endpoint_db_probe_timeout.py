import time

from src.services.agents.alleato_ai_tools import db_health


def test_probe_engine_bounds_query_execution_and_dead_connections(monkeypatch):
    """Guardrail: `/health` is Render's `healthCheckPath` with a 5s HTTP
    timeout. `connect_timeout` only bounds the initial TCP handshake — once
    connected, a blocking psycopg2 call has no notion of asyncio cancellation,
    so wrapping it in `asyncio.wait_for`/`asyncio.to_thread` cannot preempt a
    call that is already running (confirmed empirically: a mocked
    `time.sleep(10)` blocked a `wait_for(timeout=3.0)`-wrapped call for the
    full 10s). The probe must therefore bound itself at the connection level
    via `statement_timeout` (server aborts a hung query) and `keepalives_*`
    (OS detects a dead TCP connection). This test guards against that
    connect_args config being silently stripped again.
    """
    monkeypatch.setenv("DATABASE_URL", "postgresql://user:pass@example.pooler.supabase.com:5432/postgres")
    monkeypatch.setenv("APP_DB_PROBE_TIMEOUT_S", "3")
    db_health._probe_engine.cache_clear()

    captured = {}
    real_create_engine = db_health.create_engine

    def _fake_create_engine(url, **kwargs):
        captured.update(kwargs)
        return real_create_engine(url, **kwargs)

    monkeypatch.setattr(db_health, "create_engine", _fake_create_engine)

    try:
        engine = db_health._probe_engine()
        connect_args = captured["connect_args"]

        assert connect_args["connect_timeout"] == 3
        assert connect_args["options"] == "-c statement_timeout=3000"
        assert connect_args["keepalives"] == 1
        assert connect_args["keepalives_idle"] <= 2
        assert connect_args["keepalives_interval"] <= 2
        assert connect_args["keepalives_count"] >= 1

        engine.dispose()
    finally:
        db_health._probe_engine.cache_clear()


def test_health_endpoint_reports_degraded_when_probe_raises_quickly(client, monkeypatch):
    """A probe that fails fast (e.g. connection refused) must still produce a
    clean, fast, degraded /health response — the exception-handling path
    around the new asyncio.wait_for wrapper must not regress this."""

    def _failing_probe():
        raise OSError("Connection refused")

    monkeypatch.setattr(db_health, "probe_app_db", _failing_probe)

    start = time.monotonic()
    response = client.get("/health")
    elapsed = time.monotonic() - start

    assert response.status_code == 200
    assert elapsed < 2.0
    body = response.json()
    assert body["app_db"]["reachable"] is None
    assert "Connection refused" in body["app_db"]["error"]
