"""Recent-activity digest across the structured PM corpus.

Single tool that answers "what changed lately" / "what happened last week" /
"anything new on this project" without forcing the agent to compose a dozen
SQL queries. Reads multiple tables (RFIs, change orders, change events, sub
invoices, owner invoices, submittals, emails, daily logs) and returns a
markdown digest grouped by category.

Design notes:

- Self-introspecting: queries `information_schema.columns` at call time to
  discover which tables exist and which timestamp column they use
  (`updated_at` preferred, then `created_at`, then domain-specific like
  `received_at` / `submitted_at`). Tolerates schema drift on the alleato-pm
  side without breaking.
- Per-table errors are swallowed and rendered as "_(query failed: ...)_" so
  one bad table never blocks the whole digest.
- Portfolio-wide when `project_id` is None — exactly mirrors the
  `list_recent_meetings` shape the orchestrator already knows.
- Uses NullPool because parallel sub-agents share the same engine and the
  Supabase pgbouncer pool is what should be doing the pooling, not us.

This pairs with `list_recent_meetings` to cover the full "what's new" surface:
that one handles meetings, this one handles everything else.
"""

from __future__ import annotations

import os
from functools import lru_cache
from typing import Any

from langchain_core.tools import tool
from sqlalchemy import create_engine, text
from sqlalchemy.engine import Engine
from sqlalchemy.pool import NullPool

from ._retry import is_connection_error
from .db_health import degraded_db_banner, format_db_tool_error


@lru_cache(maxsize=1)
def _engine() -> Engine:
    url = os.environ.get("DATABASE_URL")
    if not url:
        raise RuntimeError("DATABASE_URL is not set")
    return create_engine(
        url,
        poolclass=NullPool,
        connect_args={"connect_timeout": 10, "application_name": "alleato-ai-recent"},
    )


def _coerce_project_id(project_id: str | int | None) -> int | None:
    if project_id in (None, ""):
        return None
    try:
        return int(project_id)
    except (TypeError, ValueError):
        return None


# Each entry: (label, table, candidate_timestamp_columns_in_priority_order,
# candidate_label_columns_in_priority_order, candidate_status_columns)
# Timestamp columns are tried in order — first match wins.
_TABLE_SPEC: list[tuple[str, str, list[str], list[str], list[str]]] = [
    (
        "RFIs",
        "rfis",
        ["updated_at", "created_at", "submitted_at", "date_initiated"],
        ["rfi_number", "number", "subject", "title", "question"],
        ["status", "ball_in_court"],
    ),
    (
        "Change orders",
        "change_orders",
        ["updated_at", "created_at", "approved_at", "submitted_at", "date"],
        ["co_number", "number", "title", "description"],
        ["status"],
    ),
    (
        "Change events",
        "change_events",
        ["updated_at", "created_at", "event_date", "date"],
        ["number", "title", "description"],
        ["status"],
    ),
    (
        "Submittals",
        "submittals",
        ["updated_at", "created_at", "submitted_at", "received_at", "date"],
        ["submittal_number", "number", "title", "description"],
        ["status", "ball_in_court"],
    ),
    (
        "Owner invoices (pay apps)",
        "owner_invoices",
        ["updated_at", "created_at", "submitted_at", "date", "invoice_date"],
        ["invoice_number", "number", "title"],
        ["status"],
    ),
    (
        "Sub invoices (pay apps)",
        "subcontractor_invoices",
        ["updated_at", "created_at", "submitted_at", "date", "invoice_date"],
        ["invoice_number", "number", "vendor_name"],
        ["status"],
    ),
    (
        "Emails",
        "outlook_email_intake",
        ["received_at", "sent_at", "updated_at", "created_at", "date"],
        ["subject", "from_address", "from_email", "from_name", "sender"],
        ["status"],
    ),
    (
        "Daily logs",
        "daily_logs",
        ["log_date", "updated_at", "created_at", "date"],
        ["title", "description", "summary"],
        [],
    ),
]

_PROJECT_FK_CANDIDATES = ["project_id", "project"]


@lru_cache(maxsize=1)
def _table_columns() -> dict[str, set[str]]:
    """One-shot introspection of which (table, column) pairs exist.

    Cached for the life of the process — schema changes are rare relative to
    tool-call cadence, and a wrong cache only causes us to skip a category,
    not return wrong data.
    """
    table_names = [spec[1] for spec in _TABLE_SPEC]
    sql = text(
        """
        SELECT table_name, column_name
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = ANY(:tables)
        """
    )
    eng = _engine()
    out: dict[str, set[str]] = {t: set() for t in table_names}
    with eng.connect() as conn:
        for row in conn.execute(sql, {"tables": table_names}):
            out.setdefault(row.table_name, set()).add(row.column_name)
    return out


def _pick(candidates: list[str], available: set[str]) -> str | None:
    for c in candidates:
        if c in available:
            return c
    return None


def _truncate(s: Any, limit: int = 80) -> str:
    if s is None:
        return ""
    s = str(s).replace("\n", " ").replace("|", "\\|").strip()
    return s if len(s) <= limit else s[: limit - 1] + "…"


def _query_one_table(
    spec: tuple[str, str, list[str], list[str], list[str]],
    available: set[str],
    days_back: int,
    project_id: int | None,
    per_table_limit: int,
) -> tuple[str, list[dict[str, Any]] | None, str | None, bool]:
    """Run the recent-activity query for one table.

    Returns (label, rows or None on error, error_message or None,
    is_connectivity_error). The connectivity flag lets the caller tell a real
    outage (every table unreachable) apart from a benign per-table skip.
    """
    label, table, ts_candidates, label_candidates, status_candidates = spec

    if not available:
        return label, None, "table not present in schema", False

    ts_col = _pick(ts_candidates, available)
    if ts_col is None:
        return label, None, f"no recognized timestamp column in {table}", False

    fk_col = _pick(_PROJECT_FK_CANDIDATES, available) if project_id is not None else None
    if project_id is not None and fk_col is None:
        return label, None, f"no project FK column in {table}", False

    label_col = _pick(label_candidates, available)
    status_col = _pick(status_candidates, available)
    project_fk_for_display = _pick(_PROJECT_FK_CANDIDATES, available)

    select_parts = [f'"{ts_col}" AS ts']
    if label_col:
        select_parts.append(f'"{label_col}" AS label')
    if status_col:
        select_parts.append(f'"{status_col}" AS status')
    if project_id is None and project_fk_for_display:
        select_parts.append(f'"{project_fk_for_display}" AS project_id')

    where_parts = [
        f"\"{ts_col}\" >= NOW() - (:days_back || ' days')::interval",
        f'"{ts_col}" IS NOT NULL',
    ]
    params: dict[str, Any] = {"days_back": days_back, "limit": per_table_limit}
    if project_id is not None:
        where_parts.append(f'"{fk_col}" = :project_id')
        params["project_id"] = project_id

    sql = text(
        f"""
        SELECT {", ".join(select_parts)}
        FROM public."{table}"
        WHERE {" AND ".join(where_parts)}
        ORDER BY "{ts_col}" DESC
        LIMIT :limit
        """
    )

    try:
        eng = _engine()
        with eng.connect() as conn:
            conn.execute(text("SET LOCAL statement_timeout = 10000"))
            rows = [dict(r._mapping) for r in conn.execute(sql, params)]
        return label, rows, None, False
    except Exception as exc:  # noqa: BLE001
        return label, None, str(exc), is_connection_error(exc)


def _format_section(
    label: str,
    rows: list[dict[str, Any]] | None,
    error: str | None,
    portfolio_mode: bool,
    project_names: dict[int, str],
) -> str:
    if error:
        return f"### {label}\n_(skipped: {error})_"
    if not rows:
        return f"### {label}\n_(no activity in window)_"

    lines = [f"### {label} ({len(rows)})"]
    for r in rows:
        ts = r.get("ts")
        when = ""
        if ts is not None:
            try:
                when = ts.date().isoformat()  # type: ignore[union-attr]
            except AttributeError:
                when = str(ts)[:10]
        pieces = [when] if when else []
        if r.get("label"):
            pieces.append(_truncate(r["label"], 80))
        if r.get("status"):
            pieces.append(f"_{_truncate(r['status'], 30)}_")
        if portfolio_mode and r.get("project_id") is not None:
            raw_pid = r["project_id"]
            try:
                name = project_names.get(int(raw_pid))
            except (TypeError, ValueError):
                name = None
            pieces.append(name if name else f"project {raw_pid}")
        lines.append("- " + " · ".join(pieces))
    return "\n".join(lines)


@tool
def recent_activity(
    days_back: int = 7,
    project_id: str | None = None,
    per_category_limit: int = 8,
) -> str:
    """Digest of what changed lately across the structured PM corpus.

    Use this for any "what happened / what changed / what's new / anything
    overnight / weekly scan" question whether portfolio-wide or for one
    project. Pairs with `list_recent_meetings` (which covers meetings) to
    answer the full "what's new" surface — call both in parallel when the
    question is broad.

    Returns recent rows from: RFIs, change orders, change events, submittals,
    owner invoices (pay apps), sub invoices, emails, daily logs. Each
    category is queried independently — if one table fails, the rest still
    return.

    Args:
        days_back: Look back this many days (default 7).
        project_id: Optional — numeric project ID. Omit for portfolio-wide.
        per_category_limit: Max rows per category (default 8).

    Returns:
        Markdown digest grouped by category, ordered most-recent-first within
        each category. Each row shows date, label, status, and (in portfolio
        mode) the project ID.
    """
    if days_back <= 0 or per_category_limit <= 0:
        return "Error: days_back and per_category_limit must be positive."

    pid: int | None = None
    if project_id not in (None, ""):
        pid = _coerce_project_id(project_id)
        if pid is None:
            return "Error: project_id must be numeric when provided."

    try:
        schema = _table_columns()
    except Exception as exc:  # noqa: BLE001
        # First DB touch — a connectivity failure here means the whole digest is
        # bogus. Surface it loudly instead of an "Error introspecting schema".
        return format_db_tool_error(exc, tool_hint="recent_activity")

    section_data: list[tuple[str, list[dict[str, Any]] | None, str | None]] = []
    referenced_pids: set[int] = set()
    attempted = 0
    connectivity_failures = 0
    for spec in _TABLE_SPEC:
        label, rows, err, is_conn = _query_one_table(
            spec=spec,
            available=schema.get(spec[1], set()),
            days_back=days_back,
            project_id=pid,
            per_table_limit=per_category_limit,
        )
        # Only count sections that actually ran a query (a present table with a
        # usable timestamp column), so schema-shape skips don't look like an outage.
        if rows is not None or is_conn or (err and "not present" not in err and "no " not in err):
            attempted += 1
        if is_conn:
            connectivity_failures += 1
        section_data.append((label, rows, err))
        if rows and pid is None:
            for r in rows:
                raw = r.get("project_id")
                if raw is None:
                    continue
                try:
                    referenced_pids.add(int(raw))
                except (TypeError, ValueError):
                    pass

    # Every table that actually ran failed with a connectivity error → this is a
    # database outage, not a quiet week. Never render an all-empty digest here.
    if attempted > 0 and connectivity_failures == attempted:
        return (
            degraded_db_banner()
            + "\nRecent-activity digest is unavailable because the project database "
            "is unreachable. This is NOT an indication that nothing happened."
        )

    # Resolve raw project_id → name once across all sections, then format.
    from .db import get_project_names

    project_names: dict[int, str] = {}
    if pid is None and referenced_pids:
        project_names = get_project_names(list(referenced_pids))
    elif pid is not None:
        project_names = get_project_names([pid])

    if pid is not None:
        scope = project_names.get(pid) or f"project {pid}"
    else:
        scope = "portfolio-wide"
    header = f"# Recent activity — last {days_back} days, {scope}\n"

    sections = []
    any_rows = False
    for label, rows, err in section_data:
        if rows:
            any_rows = True
        sections.append(
            _format_section(
                label, rows, err, portfolio_mode=(pid is None), project_names=project_names
            )
        )

    if not any_rows:
        sections.append(
            "\n_No recent rows surfaced across structured tables. Try widening "
            "`days_back`, removing the project filter, or calling "
            "`list_recent_meetings` for meeting activity._"
        )

    return header + "\n\n".join(sections)
