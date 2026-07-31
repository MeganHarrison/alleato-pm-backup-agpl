"""Fail-fast app database pressure guard for background jobs.

High-churn sync/RAG jobs are allowed to read small app-DB catalog and
operational-control rows, but they must not compete with employee app traffic
when the app database or Supabase pooler is already saturated.
"""

from __future__ import annotations

import logging
import os
from dataclasses import dataclass
from typing import Any, Dict

import psycopg2

logger = logging.getLogger(__name__)


class AppDbPressureError(RuntimeError):
    """Raised when a background job must not start because app DB is unsafe."""


class AppDbHighChurnWriteError(RuntimeError):
    """Raised when high-churn AI writes would target the PM app database."""


class AppDbProjectionError(RuntimeError):
    """Raised when a PM app projection write is not explicitly bounded."""


def _env_flag(name: str, default: str = "false") -> bool:
    return (os.getenv(name, default) or "").strip().lower() in {"1", "true", "yes", "on"}


def _env_int(name: str, default: int, *, minimum: int = 0) -> int:
    raw = os.getenv(name)
    if raw is None or raw == "":
        return default
    try:
        return max(minimum, int(raw))
    except ValueError:
        logger.warning("[DBPressureGuard] Invalid integer for %s=%r; using %d", name, raw, default)
        return default


def _projection_table_env_key(table_name: str) -> str:
    normalized = "".join(char if char.isalnum() else "_" for char in table_name.upper())
    return f"PM_APP_PROJECTION_MAX_{normalized}_ROWS"


def _database_url() -> str | None:
    return (
        os.getenv("APP_DATABASE_URL")
        or os.getenv("DATABASE_URL")
        or os.getenv("SUPABASE_DB_URL")
        or None
    )


@dataclass(frozen=True)
class AppDbPressureSnapshot:
    total_connections: int
    active_connections: int
    idle_in_transaction_connections: int
    long_running_active_connections: int
    max_query_age_seconds: int
    app_client_connections: int = 0
    app_active_connections: int = 0
    app_idle_in_transaction_connections: int = 0
    app_long_running_active_connections: int = 0
    platform_connections: int = 0
    connection_buckets: Dict[str, int] | None = None

    def to_dict(self) -> dict[str, Any]:
        return {
            "total_connections": self.total_connections,
            "active_connections": self.active_connections,
            "idle_in_transaction_connections": self.idle_in_transaction_connections,
            "long_running_active_connections": self.long_running_active_connections,
            "max_query_age_seconds": self.max_query_age_seconds,
            "app_client_connections": self.app_client_connections,
            "app_active_connections": self.app_active_connections,
            "app_idle_in_transaction_connections": self.app_idle_in_transaction_connections,
            "app_long_running_active_connections": self.app_long_running_active_connections,
            "platform_connections": self.platform_connections,
            "connection_buckets": self.connection_buckets or {},
        }


def _snapshot_from_row(row: dict[str, Any]) -> AppDbPressureSnapshot:
    return AppDbPressureSnapshot(
        total_connections=int(row.get("total_connections") or 0),
        active_connections=int(row.get("active_connections") or 0),
        idle_in_transaction_connections=int(row.get("idle_in_transaction_connections") or 0),
        long_running_active_connections=int(row.get("long_running_active_connections") or 0),
        max_query_age_seconds=int(float(row.get("max_query_age_seconds") or 0)),
        app_client_connections=int(row.get("app_client_connections") or 0),
        app_active_connections=int(row.get("app_active_connections") or 0),
        app_idle_in_transaction_connections=int(row.get("app_idle_in_transaction_connections") or 0),
        app_long_running_active_connections=int(row.get("app_long_running_active_connections") or 0),
        platform_connections=int(row.get("platform_connections") or 0),
        connection_buckets=dict(row.get("connection_buckets") or {}),
    )


def _fetch_pressure_snapshot(database_url: str) -> AppDbPressureSnapshot:
    checkout_timeout = _env_int("APP_DB_PRESSURE_CONNECT_TIMEOUT_SECONDS", 5, minimum=1)
    statement_timeout_ms = _env_int("APP_DB_PRESSURE_STATEMENT_TIMEOUT_MS", 5000, minimum=1000)
    long_running_seconds = _env_int("APP_DB_PRESSURE_LONG_RUNNING_SECONDS", 120, minimum=1)

    connection = None
    try:
        connection = psycopg2.connect(database_url, connect_timeout=checkout_timeout, sslmode="require")
        with connection.cursor() as cursor:
            cursor.execute("set statement_timeout = %s", (statement_timeout_ms,))
            cursor.execute(
                """
                with activity as (
                  select
                    *,
                    case
                      when backend_type <> 'client backend' then 'postgres_internal'
                      when application_name = 'postgrest' then 'supabase_postgrest_pool'
                      when application_name like 'realtime%%' then 'supabase_realtime'
                      when application_name = 'Supabase Storage API' then 'supabase_storage'
                      when application_name like 'Supavisor%%' then 'supabase_supavisor'
                      when usename in ('supabase_admin', 'pgbouncer', 'authenticator', 'supabase_storage_admin')
                        then 'supabase_platform_other'
                      else 'app_or_external'
                    end as pressure_bucket
                  from pg_stat_activity
                  where pid <> pg_backend_pid()
                ),
                bucket_counts as (
                  select pressure_bucket, count(*)::int as bucket_count
                  from activity
                  group by pressure_bucket
                )
                select
                  count(*)::int as total_connections,
                  count(*) filter (where state = 'active')::int as active_connections,
                  count(*) filter (where state = 'idle in transaction')::int as idle_in_transaction_connections,
                  count(*) filter (
                    where state = 'active'
                      and query_start is not null
                      and now() - query_start > make_interval(secs => %s)
                  )::int as long_running_active_connections,
                  count(*) filter (where pressure_bucket = 'app_or_external')::int as app_client_connections,
                  count(*) filter (
                    where pressure_bucket = 'app_or_external'
                      and state = 'active'
                  )::int as app_active_connections,
                  count(*) filter (
                    where pressure_bucket = 'app_or_external'
                      and state = 'idle in transaction'
                  )::int as app_idle_in_transaction_connections,
                  count(*) filter (
                    where pressure_bucket = 'app_or_external'
                      and state = 'active'
                      and query_start is not null
                      and now() - query_start > make_interval(secs => %s)
                  )::int as app_long_running_active_connections,
                  count(*) filter (where pressure_bucket <> 'app_or_external')::int as platform_connections,
                  coalesce(
                    (
                      select jsonb_object_agg(pressure_bucket, bucket_count)
                      from bucket_counts
                    ),
                    '{}'::jsonb
                  ) as connection_buckets,
                  coalesce(
                    max(extract(epoch from now() - query_start))
                      filter (where query_start is not null),
                    0
                  )::int as max_query_age_seconds
                from activity
                """,
                (long_running_seconds, long_running_seconds),
            )
            row = cursor.fetchone()
            if not row:
                return _snapshot_from_row({})
            if isinstance(row, dict):
                return _snapshot_from_row(row)
            columns = [column[0] for column in cursor.description]
            return _snapshot_from_row(dict(zip(columns, row)))
    finally:
        if connection is not None:
            connection.close()


def enforce_app_db_pressure_guard(job_name: str) -> AppDbPressureSnapshot | None:
    """Block background work when the app DB/pooler is already under pressure.

    Local ad-hoc runs without a database URL are allowed to skip the guard unless
    ``APP_DB_PRESSURE_GUARD_REQUIRED=true`` is set. Render cron blueprints set
    that flag so production jobs fail closed if the guard cannot run.
    """

    if _env_flag("DISABLE_APP_DB_PRESSURE_GUARD") or _env_flag("APP_DB_PRESSURE_GUARD_DISABLED"):
        logger.warning("[DBPressureGuard] Disabled for %s by env override", job_name)
        return None

    database_url = _database_url()
    required = _env_flag("APP_DB_PRESSURE_GUARD_REQUIRED")
    if not database_url:
        message = (
            f"App DB pressure guard could not run for {job_name}: "
            "APP_DATABASE_URL, DATABASE_URL, or SUPABASE_DB_URL is missing."
        )
        if required:
            raise AppDbPressureError(message)
        logger.warning("[DBPressureGuard] %s", message)
        return None

    max_total = _env_int("APP_DB_PRESSURE_MAX_TOTAL_CONNECTIONS", 35, minimum=1)
    block_on_raw_total = _env_flag("APP_DB_PRESSURE_BLOCK_ON_RAW_TOTAL")
    max_app_client = _env_int("APP_DB_PRESSURE_MAX_APP_CLIENT_CONNECTIONS", 12, minimum=1)
    max_active = _env_int("APP_DB_PRESSURE_MAX_ACTIVE_CONNECTIONS", 8, minimum=1)
    max_idle_txn = _env_int("APP_DB_PRESSURE_MAX_IDLE_IN_TXN_CONNECTIONS", 0, minimum=0)
    max_long_running = _env_int("APP_DB_PRESSURE_MAX_LONG_RUNNING_ACTIVE_CONNECTIONS", 2, minimum=0)

    try:
        snapshot = _fetch_pressure_snapshot(database_url)
    except Exception as exc:  # noqa: BLE001
        message = f"App DB pressure guard could not run for {job_name}: {exc}"
        if required:
            raise AppDbPressureError(message) from exc
        # The guard is a safety check, not a hard dependency. If we cannot even
        # connect to run it — e.g. the direct DB host (db.<ref>.supabase.co)
        # became IPv6-only after Supabase's IPv4 deprecation and is unreachable
        # from this network — failing closed would silently halt ALL background
        # processing (embedding, task extraction, intelligence compilation).
        # Degrade to "guard skipped" and let the job run via its normal
        # REST/pooler data paths. Set APP_DB_PRESSURE_GUARD_REQUIRED=true with a
        # reachable APP_DATABASE_URL (e.g. the Supavisor pooler) to fail closed.
        logger.warning("[DBPressureGuard] %s — proceeding without guard", message)
        return None

    reasons: list[str] = []
    diagnostics: list[str] = []
    if snapshot.total_connections > max_total and block_on_raw_total:
        reasons.append(f"total_connections={snapshot.total_connections}>{max_total}")
    elif snapshot.total_connections > max_total:
        diagnostics.append(f"raw_total_connections={snapshot.total_connections}>{max_total}")
    if snapshot.app_client_connections > max_app_client:
        reasons.append(f"app_client_connections={snapshot.app_client_connections}>{max_app_client}")
    if snapshot.active_connections > max_active:
        reasons.append(f"active_connections={snapshot.active_connections}>{max_active}")
    if snapshot.app_idle_in_transaction_connections > max_idle_txn:
        reasons.append(
            f"app_idle_in_transaction_connections={snapshot.app_idle_in_transaction_connections}>{max_idle_txn}"
        )
    if snapshot.app_long_running_active_connections > max_long_running:
        reasons.append(
            f"app_long_running_active_connections={snapshot.app_long_running_active_connections}>{max_long_running}"
        )

    if reasons:
        diagnostic_suffix = f"; diagnostics: {', '.join(diagnostics)}" if diagnostics else ""
        raise AppDbPressureError(
            f"App DB pressure guard blocked {job_name}: {', '.join(reasons)}{diagnostic_suffix}"
        )

    logger.info(
        (
            "[DBPressureGuard] %s allowed: total=%d platform=%d app_client=%d "
            "active=%d app_idle_in_txn=%d app_long_running=%d max_age=%ds buckets=%s"
        ),
        job_name,
        snapshot.total_connections,
        snapshot.platform_connections,
        snapshot.app_client_connections,
        snapshot.active_connections,
        snapshot.app_idle_in_transaction_connections,
        snapshot.app_long_running_active_connections,
        snapshot.max_query_age_seconds,
        snapshot.connection_buckets or {},
    )
    return snapshot


def enforce_no_pm_app_high_churn_writes(job_name: str, *, tables: list[str] | None = None) -> None:
    """Fail closed for high-churn AI/intelligence writes against PM Supabase.

    The RAG database split removed vector/chunk churn from the PM app, but
    intelligence compilers can still write app-facing projection tables such as
    ``insight_cards`` and ``intelligence_packets``. Those writes must stay
    disabled until they are moved behind a bounded projection path or an
    operator intentionally sets ``ALLOW_PM_APP_HIGH_CHURN_WRITES=true`` for a
    controlled one-off run.
    """

    if _env_flag("ALLOW_PM_APP_HIGH_CHURN_WRITES"):
        logger.warning(
            "[DBPressureGuard] PM app high-churn writes explicitly allowed for %s",
            job_name,
        )
        return

    table_list = ", ".join(tables or [])
    suffix = f" Target tables: {table_list}." if table_list else ""
    raise AppDbHighChurnWriteError(
        f"Blocked {job_name}: high-churn AI/intelligence writes to the PM app "
        "database are disabled after the Supabase health incident. Move this "
        "writer to the AI database or set ALLOW_PM_APP_HIGH_CHURN_WRITES=true "
        f"only for a controlled one-off run.{suffix}"
    )


def enforce_pm_app_final_projection_guard(
    job_name: str,
    *,
    row_counts: dict[str, int],
) -> None:
    """Allow only explicitly enabled, bounded final projections into PM tables.

    This guard is for the narrow final-projection path after high-churn staging
    and synthesis have happened elsewhere. It is intentionally separate from
    ``ALLOW_PM_APP_HIGH_CHURN_WRITES``: an operator may permit one final packet
    projection without reopening arbitrary compiler churn against the PM app DB.
    """

    cleaned_counts = {
        table: max(0, int(count or 0))
        for table, count in row_counts.items()
        if int(count or 0) > 0
    }
    total_rows = sum(cleaned_counts.values())

    if not _env_flag("ALLOW_PM_APP_FINAL_PROJECTIONS"):
        tables = ", ".join(f"{table}={count}" for table, count in sorted(cleaned_counts.items()))
        suffix = f" Requested rows: {tables}." if tables else ""
        raise AppDbProjectionError(
            f"Blocked {job_name}: PM app final projection writes are disabled. "
            "Set ALLOW_PM_APP_FINAL_PROJECTIONS=true only for bounded card/packet "
            f"projection runs after high-churn work is isolated from the PM DB.{suffix}"
        )

    max_total = _env_int("PM_APP_PROJECTION_MAX_TOTAL_ROWS", 200, minimum=1)
    if total_rows > max_total:
        raise AppDbProjectionError(
            f"Blocked {job_name}: projection row count {total_rows}>{max_total} "
            "(PM_APP_PROJECTION_MAX_TOTAL_ROWS)."
        )

    for table, count in cleaned_counts.items():
        max_for_table = _env_int(_projection_table_env_key(table), max_total, minimum=1)
        if count > max_for_table:
            raise AppDbProjectionError(
                f"Blocked {job_name}: {table} row count {count}>{max_for_table} "
                f"({_projection_table_env_key(table)})."
            )

    logger.info(
        "[DBPressureGuard] %s final projection allowed: rows=%d tables=%s",
        job_name,
        total_rows,
        cleaned_counts,
    )


def reserve_pm_app_projection_budget(
    job_name: str,
    current: Dict[str, int],
    additional: Dict[str, int],
) -> Dict[str, int]:
    """Reserve rows against one cumulative final-projection run budget.

    ``enforce_pm_app_final_projection_guard`` validates a single count snapshot.
    Scheduled runners must use this helper so multiple targets or batches cannot
    evade that ceiling by validating each write independently.
    """

    projected = {
        table: max(0, int(count or 0))
        for table, count in current.items()
        if int(count or 0) > 0
    }
    for table, count in additional.items():
        normalized = max(0, int(count or 0))
        if normalized:
            projected[table] = projected.get(table, 0) + normalized

    if projected == current:
        return current

    enforce_pm_app_final_projection_guard(job_name, row_counts=projected)
    current.clear()
    current.update(projected)
    return current
