"""App-database connectivity health: probe, host-parity, loud error messaging.

Guardrail for the 2026-07-09 incident where the Render `DATABASE_URL` pointed at
the Supabase IPv6-only *direct* host (`db.<ref>.supabase.co`). psycopg2 raised
"Network is unreachable", every structured DB tool caught the error and let the
agent answer "no portfolio data" — a confidently-wrong silent degradation.

This module is the single source of truth for:

- `is_connection_error` (re-exported from `_retry`) — network/outage vs SQL error.
- `probe_app_db()` — a `SELECT 1` liveness probe against the app DB via the pooler.
- `database_url_host_status()` — env-parity check: is the configured host the
  known-good IPv4 pooler, or has it drifted back to a direct/unknown host?
- `format_db_tool_error()` — the loud message a DB tool returns on an outage so
  the model cannot mistake it for "no data".
- `degraded_db_banner()` — the banner the deep-agent runtime prepends to an
  answer produced while the DB was unreachable.
- `emit_db_connectivity_alert()` — a deduped Sentry/log alert.

Kept dependency-light and side-effect-free at import time so `/health` and the
agent runtimes can call it cheaply.
"""

from __future__ import annotations

import logging
import os
import time
from dataclasses import dataclass
from functools import lru_cache
from urllib.parse import urlsplit

from sqlalchemy import create_engine, text
from sqlalchemy.engine import Engine
from sqlalchemy.pool import NullPool

from ._retry import is_connection_error  # re-exported for callers

__all__ = [
    "is_connection_error",
    "DbProbe",
    "HostParity",
    "probe_app_db",
    "classify_host",
    "database_url_host_status",
    "format_db_tool_error",
    "degraded_db_banner",
    "emit_db_connectivity_alert",
]

logger = logging.getLogger(__name__)

# Supabase's IPv4 session/transaction pooler. The known-good host after the
# 2026-07-09 fix looks like `aws-1-us-east-2.pooler.supabase.com`. The direct
# host `db.<ref>.supabase.co` is IPv6-only from Render and is what broke.
_POOLER_HOST_SUFFIX = ".pooler.supabase.com"
_DIRECT_HOST_PREFIX = "db."
_DIRECT_HOST_SUFFIX = ".supabase.co"

_PROBE_TIMEOUT_S = 3


def _probe_timeout_s() -> int:
    raw = os.getenv("APP_DB_PROBE_TIMEOUT_S")
    if not raw:
        return _PROBE_TIMEOUT_S
    try:
        return max(1, min(int(raw), 30))
    except ValueError:
        return _PROBE_TIMEOUT_S


@lru_cache(maxsize=1)
def _probe_engine() -> Engine:
    """A dedicated short-timeout engine for liveness probing.

    Separate from the tool engine (`db._engine`) so a probe never waits the
    tool's longer `connect_timeout`, and so a down DB fails the probe fast
    instead of stalling `/health`.

    `connect_timeout` only bounds the initial TCP handshake — once connected,
    a blocking psycopg2 call has no notion of asyncio cancellation (wrapping
    it in `asyncio.wait_for`/`asyncio.to_thread` cannot preempt it; the caller
    just blocks until the underlying call itself returns). The probe must
    therefore bound itself at the connection level:
    - `statement_timeout` makes Postgres itself abort a hung/blocked query
      (e.g. lock contention) after this many milliseconds. Caveat: this app
      connects through Supabase's pooler, and pgbouncer in transaction mode
      can silently ignore/inconsistently apply extra libpq startup options —
      `keepalives_*` below is the pooler-agnostic layer that still bounds a
      dead connection even if `statement_timeout` doesn't reach Postgres.
    - `keepalives_*` makes the OS detect a dead TCP connection (network
      partition, server vanished mid-round-trip with no RST) within a bounded
      time instead of blocking in `recv()` indefinitely.
    """
    url = os.environ.get("DATABASE_URL")
    if not url:
        raise RuntimeError("DATABASE_URL is not set")
    timeout_s = _probe_timeout_s()
    return create_engine(
        url,
        poolclass=NullPool,
        connect_args={
            "connect_timeout": timeout_s,
            "application_name": "alleato-ai-db-probe",
            "options": f"-c statement_timeout={timeout_s * 1000}",
            "keepalives": 1,
            "keepalives_idle": 1,
            "keepalives_interval": 1,
            "keepalives_count": 2,
        },
    )


@dataclass(frozen=True)
class DbProbe:
    """Result of a `SELECT 1` liveness probe against the app DB."""

    reachable: bool
    latency_ms: int | None
    error: str | None
    is_connectivity: bool  # error was a network/outage error (vs config/other)

    def as_dict(self) -> dict[str, object]:
        return {
            "reachable": self.reachable,
            "latency_ms": self.latency_ms,
            "error": self.error,
            "is_connectivity": self.is_connectivity,
        }


def probe_app_db() -> DbProbe:
    """Run a fast `SELECT 1` against the app DB via the pooler.

    Never raises — connectivity failures are the thing we are detecting, so they
    are captured into the returned `DbProbe`.
    """
    start = time.perf_counter()
    try:
        eng = _probe_engine()
        with eng.connect() as conn:
            conn.execute(text("SELECT 1"))
        latency_ms = max(0, int((time.perf_counter() - start) * 1000))
        return DbProbe(reachable=True, latency_ms=latency_ms, error=None, is_connectivity=False)
    except Exception as exc:  # noqa: BLE001 — probe must swallow to classify
        first_line = str(exc).splitlines()[0][:300] if str(exc) else exc.__class__.__name__
        return DbProbe(
            reachable=False,
            latency_ms=None,
            error=first_line,
            is_connectivity=is_connection_error(exc),
        )


@dataclass(frozen=True)
class HostParity:
    """Whether the configured DATABASE_URL host matches the known-good pooler."""

    host: str | None
    kind: str  # "pooler" | "direct" | "unknown" | "missing"
    ok: bool
    detail: str

    def as_dict(self) -> dict[str, object]:
        return {"host": self.host, "kind": self.kind, "ok": self.ok, "detail": self.detail}


def classify_host(host: str | None) -> str:
    if not host:
        return "missing"
    lowered = host.lower()
    if lowered.endswith(_POOLER_HOST_SUFFIX):
        return "pooler"
    if lowered.startswith(_DIRECT_HOST_PREFIX) and lowered.endswith(_DIRECT_HOST_SUFFIX):
        return "direct"
    return "unknown"


def _host_from_database_url() -> str | None:
    url = os.environ.get("DATABASE_URL")
    if not url:
        return None
    try:
        return urlsplit(url).hostname
    except ValueError:
        return None


def database_url_host_status() -> HostParity:
    """Env-parity check on the configured `DATABASE_URL` host.

    Flags the exact regression that caused the outage: the host silently
    drifting from the IPv4 pooler back to the IPv6-only direct host. `ok` is
    True only for the known-good pooler host.
    """
    host = _host_from_database_url()
    kind = classify_host(host)
    if kind == "missing":
        return HostParity(host=None, kind=kind, ok=False, detail="DATABASE_URL is not set.")
    if kind == "pooler":
        return HostParity(host=host, kind=kind, ok=True, detail="Using the Supabase IPv4 pooler host (expected).")
    if kind == "direct":
        return HostParity(
            host=host,
            kind=kind,
            ok=False,
            detail=(
                "DATABASE_URL points at the Supabase DIRECT host "
                f"({host}), which is IPv6-only and unreachable from Render. "
                "Switch to the IPv4 pooler host (*.pooler.supabase.com)."
            ),
        )
    return HostParity(
        host=host,
        kind=kind,
        ok=False,
        detail=(
            f"DATABASE_URL host ({host}) is neither the known-good pooler "
            "(*.pooler.supabase.com) nor a recognized direct host — verify it."
        ),
    )


_UNREACHABLE_SENTINEL = "DATABASE UNREACHABLE"


def format_db_tool_error(exc: BaseException, *, tool_hint: str | None = None) -> str:
    """The string a DB-backed tool should return when a query fails.

    On a connectivity error this returns a loud, unambiguous message so the
    model reports "the database is unreachable", never "no data found". On any
    other error it preserves the original generic message.
    """
    if is_connection_error(exc):
        parity = database_url_host_status()
        drift = f" {parity.detail}" if not parity.ok else ""
        scope = f" ({tool_hint})" if tool_hint else ""
        return (
            f"{_UNREACHABLE_SENTINEL}: the project database could not be reached{scope}. "
            "This is a connectivity/network failure, NOT an empty result — do not report "
            "'no data' or 'no projects found'. Tell the user the project database is "
            f"currently unreachable and the answer is incomplete.{drift} Detail: "
            f"{str(exc).splitlines()[0][:200]}"
        )
    return f"Error: {exc}"


def is_unreachable_tool_result(result: str) -> bool:
    """True if a tool result was produced by `format_db_tool_error` on an outage."""
    return isinstance(result, str) and _UNREACHABLE_SENTINEL in result


def degraded_db_banner(probe: DbProbe | None = None) -> str:
    """Banner the agent runtime prepends when it ran while the DB was unreachable."""
    parity = database_url_host_status()
    detail = ""
    if probe is not None and probe.error:
        detail = f" Probe error: {probe.error}."
    if not parity.ok:
        detail += f" {parity.detail}"
    return (
        "> ⚠️ **Degraded mode — project database unreachable.** Structured project "
        "data (portfolio, budgets, commitments, RFIs, recent activity) could not be "
        "loaded for this answer, so any statement implying there is *no* such data is "
        "unreliable. This is an infrastructure/connectivity issue, not missing data."
        + detail
        + "\n"
    )


# Dedupe Sentry noise: a down DB otherwise fires an alert on every request.
_ALERT_TTL_S = 300
_last_alert_at: dict[str, float] = {}


def emit_db_connectivity_alert(*, source: str, probe: DbProbe | None = None) -> None:
    """Log + Sentry-report a DB connectivity outage, deduped per source.

    Best-effort: never raises. Sentry is optional (only fires if the SDK is
    installed and a DSN is configured, which `init_sentry` handles elsewhere).
    """
    now = time.monotonic()
    last = _last_alert_at.get(source)
    if last is not None and (now - last) < _ALERT_TTL_S:
        return
    _last_alert_at[source] = now

    parity = database_url_host_status()
    msg = (
        f"[db-connectivity] app database unreachable (source={source}); "
        f"host={parity.host} kind={parity.kind} ok={parity.ok}"
    )
    if probe is not None and probe.error:
        msg += f" probe_error={probe.error!r}"
    logger.error(msg)

    try:
        import sentry_sdk

        with sentry_sdk.push_scope() as scope:
            scope.set_tag("db_connectivity", "unreachable")
            scope.set_tag("db_host_kind", parity.kind)
            scope.set_tag("alert_source", source)
            scope.set_context(
                "app_db",
                {
                    "host": parity.host,
                    "host_kind": parity.kind,
                    "host_parity_ok": parity.ok,
                    "host_parity_detail": parity.detail,
                    "probe_error": None if probe is None else probe.error,
                },
            )
            sentry_sdk.capture_message(
                f"App database unreachable (source={source})", level="error"
            )
    except Exception:  # noqa: BLE001 — alerting must never break the request
        pass
