"""Read-only access to the PM platform Postgres database.

The agent uses these tools for any quantitative question (budget, commitments, RFIs, etc.).
Always prefer specific SQL over broad table scans.

Connects to the Main App DB (Supabase project `lgveqfnpkxvzbnnwuled`) via the
`DATABASE_URL` environment variable. Connection is intended to be a read-only role —
`query_db` rejects anything that is not a SELECT/WITH statement, but the database
role should also be locked down.
"""

from __future__ import annotations

import os
import re
from functools import lru_cache

from langchain_core.tools import tool
from sqlalchemy import create_engine, text
from sqlalchemy.engine import Engine
from sqlalchemy.pool import NullPool

from ._retry import with_db_retry
from .db_health import format_db_tool_error

_MAX_ROWS = 200
_STATEMENT_TIMEOUT_MS = 30_000


@lru_cache(maxsize=1)
def _engine() -> Engine:
    url = os.environ.get("DATABASE_URL")
    if not url:
        raise RuntimeError("DATABASE_URL is not set")
    # NullPool: each call gets a fresh connection that closes on release. Supabase's
    # pgbouncer pooler does the actual pooling on the server side. With SQLAlchemy
    # pooling layered on top, parallel sub-agents exhaust the client-side pool
    # before pgbouncer is ever consulted, causing ECHECKOUTTIMEOUT cascades.
    return create_engine(
        url,
        poolclass=NullPool,
        connect_args={"connect_timeout": 10, "application_name": "alleato-ai-db"},
    )


def get_project_names(project_ids: list[int] | list[str]) -> dict[int, str]:
    """Resolve numeric project IDs to human project names.

    Used by recency tools to enrich digests so they cite "Vermilion Rise"
    instead of "project 869". Never expose raw IDs to the user.

    Args:
        project_ids: Iterable of numeric project IDs (ints or numeric strings).

    Returns:
        Dict mapping `int(id) -> name`. IDs that don't resolve are omitted.
        Returns empty dict on database failure rather than raising — the
        caller should fall back to displaying the raw ID gracefully.
    """
    cleaned: list[int] = []
    for pid in project_ids:
        try:
            cleaned.append(int(pid))
        except (TypeError, ValueError):
            continue
    if not cleaned:
        return {}

    try:
        eng = _engine()
        with eng.connect() as conn:
            rows = conn.execute(
                text("SELECT id, name FROM projects WHERE id = ANY(:ids)"),
                {"ids": list(set(cleaned))},
            ).fetchall()
        return {int(r[0]): r[1] for r in rows if r[1]}
    except Exception:  # noqa: BLE001
        return {}


def _format_markdown_table(columns: list[str], rows: list[tuple]) -> str:
    if not rows:
        return f"_(0 rows)_\n\nColumns: {', '.join(columns)}"
    header = "| " + " | ".join(columns) + " |"
    sep = "| " + " | ".join("---" for _ in columns) + " |"
    body = []
    for row in rows:
        cells = []
        for val in row:
            if val is None:
                cells.append("")
            else:
                s = str(val).replace("|", "\\|").replace("\n", " ")
                if len(s) > 200:
                    s = s[:197] + "..."
                cells.append(s)
        body.append("| " + " | ".join(cells) + " |")
    return "\n".join([header, sep, *body])


@tool
def describe_schema(table_name: str | None = None) -> str:
    """Describe the database schema.

    Call with no argument to list all tables in the public schema. Call with a
    table name to get its column definitions and two sample rows.

    Notable tables in this database include: projects, subcontractors,
    subcontracts, prime_contracts, commitments_unified (view combining both),
    cost_codes, cost_code_divisions, budget_lines, change_events, rfis,
    submittals, daily_logs, schedule_tasks, purchase_orders, owner_invoices,
    subcontractor_invoices, meeting_segments, outlook_email_intake,
    insight_cards, ai_memories, conversation summaries, and the acumatica_*
    mirror tables. The database has ~445 tables/views total — use this tool
    with no argument to list them all.

    Args:
        table_name: Optional table to describe. Omit to list all tables.

    Returns:
        Markdown description of the schema or table.
    """

    @with_db_retry
    def _run() -> str:
        eng = _engine()
        with eng.connect() as conn:
            if table_name is None:
                rows = conn.execute(
                    text(
                        "SELECT table_name, table_type "
                        "FROM information_schema.tables "
                        "WHERE table_schema = 'public' "
                        "ORDER BY table_name"
                    )
                ).fetchall()
                lines = [f"# Public schema — {len(rows)} tables/views", ""]
                lines.append("| table | type |")
                lines.append("| --- | --- |")
                for name, kind in rows:
                    lines.append(f"| {name} | {kind} |")
                return "\n".join(lines)

            cols = conn.execute(
                text(
                    "SELECT column_name, data_type, is_nullable, column_default "
                    "FROM information_schema.columns "
                    "WHERE table_schema = 'public' AND table_name = :t "
                    "ORDER BY ordinal_position"
                ),
                {"t": table_name},
            ).fetchall()
            if not cols:
                return f"Table `{table_name}` not found in public schema."

            col_names = [c[0] for c in cols]
            lines = [
                f"# `{table_name}`",
                "",
                "## Columns",
                "",
                "| column | type | nullable | default |",
                "| --- | --- | --- | --- |",
            ]
            for name, dtype, nullable, default in cols:
                lines.append(f"| {name} | {dtype} | {nullable} | {default or ''} |")

            try:
                quoted_cols = ", ".join(f'"{c}"' for c in col_names)
                sample = conn.execute(
                    text(f'SELECT {quoted_cols} FROM public."{table_name}" LIMIT 2')
                ).fetchall()
                lines += [
                    "",
                    "## Sample rows (up to 2)",
                    "",
                    _format_markdown_table(col_names, sample),
                ]
            except Exception as exc:
                lines += ["", f"_(sample query failed: {exc})_"]
            return "\n".join(lines)

    try:
        return _run()
    except Exception as exc:
        return format_db_tool_error(exc, tool_hint="describe_schema")


_SELECT_RE = re.compile(r"^\s*(select|with)\b", re.IGNORECASE)
_FORBIDDEN_RE = re.compile(
    # `into` blocks `SELECT … INTO newtable` (creates a table) — it slips past the
    # other keywords because the statement still starts with SELECT. `INSERT INTO`
    # is already caught by `insert`, and a read-only top-level SELECT never needs
    # a bare INTO, so blocking it has no legitimate-query cost.
    r"\b(insert|update|delete|drop|truncate|alter|create|grant|revoke|comment|vacuum|copy|call|do|merge|reindex|cluster|refresh|into)\b",
    re.IGNORECASE,
)
_HAS_LIMIT_RE = re.compile(r"\blimit\s+\d+\s*(;)?\s*$", re.IGNORECASE)


@tool
def query_db(sql: str) -> str:
    """Run a read-only SQL query against the PM platform database.

    Restrictions:
    - SELECT (or WITH ... SELECT) only. Writes are blocked.
    - Statement timeout: 30 seconds.
    - Results are capped at 200 rows. If `LIMIT` is missing it is added.

    Args:
        sql: A SELECT (or CTE) statement.

    Returns:
        Markdown table of results, or an error message.
    """
    stmt = sql.strip().rstrip(";").strip()
    if not stmt:
        return "Error: empty SQL."
    if not _SELECT_RE.match(stmt):
        return "Error: only SELECT (or WITH … SELECT) statements are permitted."
    if _FORBIDDEN_RE.search(stmt):
        return "Error: statement contains a forbidden keyword. Only read-only SELECT is allowed."

    if not _HAS_LIMIT_RE.search(stmt):
        stmt = f"{stmt}\nLIMIT {_MAX_ROWS}"

    @with_db_retry
    def _run() -> tuple[list[str], list[tuple]]:
        eng = _engine()
        with eng.connect() as conn:
            conn.execute(text(f"SET LOCAL statement_timeout = {_STATEMENT_TIMEOUT_MS}"))
            result = conn.execute(text(stmt))
            columns = list(result.keys())
            rows = result.fetchmany(_MAX_ROWS)
        return columns, rows

    try:
        columns, rows = _run()
    except Exception as exc:
        return format_db_tool_error(exc, tool_hint="query_db")

    table = _format_markdown_table(columns, rows)
    suffix = f"\n\n_{len(rows)} row(s)_"
    if len(rows) == _MAX_ROWS:
        suffix += f" — capped at {_MAX_ROWS}, refine the query if you need more."
    return table + suffix
