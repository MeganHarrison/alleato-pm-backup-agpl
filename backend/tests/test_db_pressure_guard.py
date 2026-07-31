import pytest

from src.services.ops import db_pressure_guard


def test_pressure_guard_fails_closed_when_required_url_missing(monkeypatch):
    monkeypatch.setenv("APP_DB_PRESSURE_GUARD_REQUIRED", "true")
    monkeypatch.delenv("APP_DATABASE_URL", raising=False)
    monkeypatch.delenv("DATABASE_URL", raising=False)
    monkeypatch.delenv("SUPABASE_DB_URL", raising=False)

    with pytest.raises(db_pressure_guard.AppDbPressureError, match="is missing"):
        db_pressure_guard.enforce_app_db_pressure_guard("graph_sync")


def test_pressure_guard_can_skip_local_runs_without_database_url(monkeypatch):
    monkeypatch.delenv("APP_DB_PRESSURE_GUARD_REQUIRED", raising=False)
    monkeypatch.delenv("APP_DATABASE_URL", raising=False)
    monkeypatch.delenv("DATABASE_URL", raising=False)
    monkeypatch.delenv("SUPABASE_DB_URL", raising=False)

    assert db_pressure_guard.enforce_app_db_pressure_guard("local_debug") is None


def test_pressure_guard_blocks_high_connection_pressure(monkeypatch):
    class FakeCursor:
        def __enter__(self):
            return self

        def __exit__(self, *_args):
            return False

        def execute(self, *_args):
            return None

        def fetchone(self):
            return {
                "total_connections": 99,
                "active_connections": 2,
                "idle_in_transaction_connections": 0,
                "long_running_active_connections": 0,
                "max_query_age_seconds": 4,
            }

    class FakeConnection:
        def cursor(self, *_args, **_kwargs):
            return FakeCursor()

        def close(self):
            return None

    monkeypatch.setenv("DATABASE_URL", "postgresql://example")
    monkeypatch.setenv("APP_DB_PRESSURE_MAX_TOTAL_CONNECTIONS", "10")
    monkeypatch.setenv("APP_DB_PRESSURE_BLOCK_ON_RAW_TOTAL", "true")
    monkeypatch.setattr(
        db_pressure_guard.psycopg2,
        "connect",
        lambda *_args, **_kwargs: FakeConnection(),
        raising=False,
    )

    with pytest.raises(db_pressure_guard.AppDbPressureError, match="total_connections=99>10"):
        db_pressure_guard.enforce_app_db_pressure_guard("graph_sync")


def test_fetch_pressure_snapshot_uses_psycopg_safe_like_patterns(monkeypatch):
    executed_sql = []

    class FakeCursor:
        description = [
            ("total_connections",),
            ("active_connections",),
            ("idle_in_transaction_connections",),
            ("long_running_active_connections",),
            ("app_client_connections",),
            ("app_active_connections",),
            ("app_idle_in_transaction_connections",),
            ("app_long_running_active_connections",),
            ("platform_connections",),
            ("connection_buckets",),
            ("max_query_age_seconds",),
        ]

        def __enter__(self):
            return self

        def __exit__(self, *_args):
            return False

        def execute(self, sql, *_args):
            executed_sql.append(sql)

        def fetchone(self):
            return (42, 1, 0, 1, 1, 0, 0, 0, 41, {"supabase_realtime": 6}, 120)

    class FakeConnection:
        def cursor(self, *_args, **_kwargs):
            return FakeCursor()

        def close(self):
            return None

    monkeypatch.setattr(
        db_pressure_guard.psycopg2,
        "connect",
        lambda *_args, **_kwargs: FakeConnection(),
        raising=False,
    )

    snapshot = db_pressure_guard._fetch_pressure_snapshot("postgresql://example")

    assert snapshot.connection_buckets == {"supabase_realtime": 6}
    assert "realtime%%" in executed_sql[-1]
    assert "Supavisor%%" in executed_sql[-1]


def test_pressure_guard_allows_high_platform_baseline_without_app_pressure(monkeypatch):
    monkeypatch.setenv("DATABASE_URL", "postgresql://example")
    monkeypatch.setenv("APP_DB_PRESSURE_MAX_TOTAL_CONNECTIONS", "10")
    monkeypatch.setattr(
        db_pressure_guard,
        "_fetch_pressure_snapshot",
        lambda _url: db_pressure_guard.AppDbPressureSnapshot(
            total_connections=42,
            active_connections=1,
            idle_in_transaction_connections=0,
            long_running_active_connections=1,
            max_query_age_seconds=120,
            app_client_connections=1,
            app_active_connections=0,
            app_idle_in_transaction_connections=0,
            app_long_running_active_connections=0,
            platform_connections=41,
            connection_buckets={
                "supabase_postgrest_pool": 11,
                "supabase_realtime": 6,
                "postgres_internal": 9,
                "app_or_external": 1,
            },
        ),
    )

    snapshot = db_pressure_guard.enforce_app_db_pressure_guard("graph_sync")

    assert snapshot is not None
    assert snapshot.total_connections == 42
    assert snapshot.platform_connections == 41


def test_pressure_guard_blocks_app_client_connection_pressure(monkeypatch):
    monkeypatch.setenv("DATABASE_URL", "postgresql://example")
    monkeypatch.setenv("APP_DB_PRESSURE_MAX_APP_CLIENT_CONNECTIONS", "3")
    monkeypatch.setattr(
        db_pressure_guard,
        "_fetch_pressure_snapshot",
        lambda _url: db_pressure_guard.AppDbPressureSnapshot(
            total_connections=20,
            active_connections=2,
            idle_in_transaction_connections=0,
            long_running_active_connections=0,
            max_query_age_seconds=5,
            app_client_connections=4,
            app_active_connections=2,
            app_idle_in_transaction_connections=0,
            app_long_running_active_connections=0,
            platform_connections=16,
            connection_buckets={"app_or_external": 4, "supabase_postgrest_pool": 11},
        ),
    )

    with pytest.raises(db_pressure_guard.AppDbPressureError, match="app_client_connections=4>3"):
        db_pressure_guard.enforce_app_db_pressure_guard("graph_sync")


def test_pressure_guard_raw_total_block_is_explicit_opt_in(monkeypatch):
    monkeypatch.setenv("DATABASE_URL", "postgresql://example")
    monkeypatch.setenv("APP_DB_PRESSURE_MAX_TOTAL_CONNECTIONS", "10")
    monkeypatch.setenv("APP_DB_PRESSURE_BLOCK_ON_RAW_TOTAL", "true")
    monkeypatch.setattr(
        db_pressure_guard,
        "_fetch_pressure_snapshot",
        lambda _url: db_pressure_guard.AppDbPressureSnapshot(
            total_connections=42,
            active_connections=1,
            idle_in_transaction_connections=0,
            long_running_active_connections=0,
            max_query_age_seconds=5,
            app_client_connections=1,
            app_active_connections=0,
            app_idle_in_transaction_connections=0,
            app_long_running_active_connections=0,
            platform_connections=41,
            connection_buckets={"app_or_external": 1, "supabase_postgrest_pool": 11},
        ),
    )

    with pytest.raises(db_pressure_guard.AppDbPressureError, match="total_connections=42>10"):
        db_pressure_guard.enforce_app_db_pressure_guard("graph_sync")


def test_pressure_snapshot_to_dict_includes_bucket_diagnostics():
    snapshot = db_pressure_guard.AppDbPressureSnapshot(
        total_connections=34,
        active_connections=1,
        idle_in_transaction_connections=0,
        long_running_active_connections=1,
        max_query_age_seconds=60,
        app_client_connections=1,
        app_active_connections=0,
        app_idle_in_transaction_connections=0,
        app_long_running_active_connections=0,
        platform_connections=33,
        connection_buckets={"supabase_postgrest_pool": 11, "app_or_external": 1},
    )

    payload = snapshot.to_dict()

    assert payload["platform_connections"] == 33
    assert payload["connection_buckets"]["supabase_postgrest_pool"] == 11


def test_high_churn_pm_app_write_guard_fails_closed(monkeypatch):
    monkeypatch.delenv("ALLOW_PM_APP_HIGH_CHURN_WRITES", raising=False)

    with pytest.raises(db_pressure_guard.AppDbHighChurnWriteError, match="Blocked project_synthesizer"):
        db_pressure_guard.enforce_no_pm_app_high_churn_writes(
            "project_synthesizer",
            tables=["insight_cards", "intelligence_packets"],
        )


def test_high_churn_pm_app_write_guard_requires_explicit_override(monkeypatch):
    monkeypatch.setenv("ALLOW_PM_APP_HIGH_CHURN_WRITES", "true")

    assert (
        db_pressure_guard.enforce_no_pm_app_high_churn_writes(
            "controlled_backfill",
            tables=["insight_cards"],
        )
        is None
    )


def test_pm_app_final_projection_guard_fails_closed(monkeypatch):
    monkeypatch.delenv("ALLOW_PM_APP_FINAL_PROJECTIONS", raising=False)

    with pytest.raises(db_pressure_guard.AppDbProjectionError, match="final projection writes are disabled"):
        db_pressure_guard.enforce_pm_app_final_projection_guard(
            "project_packet_projection",
            row_counts={"intelligence_packets": 1},
        )


def test_pm_app_final_projection_guard_allows_bounded_projection(monkeypatch):
    monkeypatch.setenv("ALLOW_PM_APP_FINAL_PROJECTIONS", "true")
    monkeypatch.setenv("PM_APP_PROJECTION_MAX_TOTAL_ROWS", "10")
    monkeypatch.setenv("PM_APP_PROJECTION_MAX_INSIGHT_CARDS_ROWS", "3")

    assert (
        db_pressure_guard.enforce_pm_app_final_projection_guard(
            "project_packet_projection",
            row_counts={
                "intelligence_packets": 1,
                "insight_cards": 3,
                "insight_card_evidence": 4,
            },
        )
        is None
    )


def test_pm_app_final_projection_guard_blocks_total_budget(monkeypatch):
    monkeypatch.setenv("ALLOW_PM_APP_FINAL_PROJECTIONS", "true")
    monkeypatch.setenv("PM_APP_PROJECTION_MAX_TOTAL_ROWS", "2")

    with pytest.raises(db_pressure_guard.AppDbProjectionError, match="projection row count 3>2"):
        db_pressure_guard.enforce_pm_app_final_projection_guard(
            "project_packet_projection",
            row_counts={"intelligence_packets": 1, "insight_cards": 2},
        )


def test_pm_app_final_projection_guard_blocks_table_budget(monkeypatch):
    monkeypatch.setenv("ALLOW_PM_APP_FINAL_PROJECTIONS", "true")
    monkeypatch.setenv("PM_APP_PROJECTION_MAX_TOTAL_ROWS", "10")
    monkeypatch.setenv("PM_APP_PROJECTION_MAX_INSIGHT_CARD_EVIDENCE_ROWS", "2")

    with pytest.raises(db_pressure_guard.AppDbProjectionError, match="insight_card_evidence row count 3>2"):
        db_pressure_guard.enforce_pm_app_final_projection_guard(
            "project_packet_projection",
            row_counts={"intelligence_packets": 1, "insight_card_evidence": 3},
        )


def test_projection_budget_reservation_is_cumulative_across_batches(monkeypatch):
    monkeypatch.setenv("ALLOW_PM_APP_FINAL_PROJECTIONS", "true")
    monkeypatch.setenv("PM_APP_PROJECTION_MAX_TOTAL_ROWS", "3")
    budget = {}

    db_pressure_guard.reserve_pm_app_projection_budget(
        "scheduled_projection",
        budget,
        {"intelligence_packets": 1},
    )
    db_pressure_guard.reserve_pm_app_projection_budget(
        "scheduled_projection",
        budget,
        {"insight_cards": 2},
    )

    assert budget == {"intelligence_packets": 1, "insight_cards": 2}
    with pytest.raises(db_pressure_guard.AppDbProjectionError, match="projection row count 4>3"):
        db_pressure_guard.reserve_pm_app_projection_budget(
            "scheduled_projection",
            budget,
            {"insight_card_evidence": 1},
        )
    assert budget == {"intelligence_packets": 1, "insight_cards": 2}
