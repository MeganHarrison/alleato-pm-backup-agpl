"""Guardrails for the read-only `query_db` SQL gate.

The forbidden-keyword check runs before any database connection, so these tests
exercise the gate without needing `DATABASE_URL`. They lock in that the gate
rejects writes that still *start* with SELECT — most importantly
`SELECT … INTO newtable`, which creates a table and previously slipped past the
keyword filter.
"""

from __future__ import annotations

from src.services.agents.alleato_ai_tools.db import query_db


def _run(sql: str) -> str:
    return query_db.invoke({"sql": sql})


def test_select_into_creates_table_is_rejected():
    # `SELECT … INTO foo` creates a table — it must not pass the read-only gate.
    out = _run("SELECT id, name INTO leaked_projects FROM projects")
    assert "forbidden keyword" in out


def test_plain_write_statements_are_rejected():
    # These don't start with SELECT/WITH, so they're caught by the prefix guard
    # rather than the keyword guard — either way the result is a rejection.
    for sql in (
        "INSERT INTO projects (name) VALUES ('x')",
        "UPDATE projects SET name = 'x' WHERE id = 1",
        "DELETE FROM projects WHERE id = 1",
        "DROP TABLE projects",
        "TRUNCATE projects",
    ):
        assert _run(sql).startswith("Error:"), sql


def test_data_modifying_cte_is_rejected():
    out = _run(
        "WITH gone AS (DELETE FROM projects WHERE id = 1 RETURNING *) SELECT * FROM gone"
    )
    assert "forbidden keyword" in out


def test_non_select_statement_is_rejected():
    out = _run("EXPLAIN ANALYZE SELECT 1")
    assert "only SELECT" in out


def test_empty_sql_is_rejected():
    assert "empty SQL" in _run("   ")
