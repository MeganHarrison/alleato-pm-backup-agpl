"""Entity / scope resolution.

These tools exist for one purpose: turn an ambiguous string into a clean ID with a
confidence score. They do NOT answer substantive business questions.

Why this layer exists at all:
The single biggest failure mode of an enterprise advisor is wrong-entity-resolution —
the user asks about "Riverside" and the agent silently picks project ID 47 (Riverside
Tower) when they meant project ID 92 (Riverside Crossings). Every downstream answer is
then wrong but confident.

The orchestrator MUST resolve entities through this layer before any sub-agent
investigation begins. If confidence is low or multiple alternatives are returned, the
orchestrator should ask a clarifying question rather than guessing.

Implementation notes:
- Uses pg_trgm similarity() when the extension is enabled (it is, in the Main App DB).
- Falls back to ILIKE with simple normalization (lowercase, strip punctuation) if not.
- All queries are read-only and parameterized.
"""

from __future__ import annotations

import re
from functools import lru_cache
from typing import TypedDict

from langchain_core.tools import tool
from sqlalchemy import text

from .db import _engine

_TOP_N = 5
_TOKEN_MIN_LEN = 4
_STOPWORDS = {"the", "and", "job", "project", "company", "llc", "inc", "ave", "st", "rd"}


class ResolverResult(TypedDict):
    """Output of any resolver tool.

    `confidence` is 0.0-1.0. `status` summarizes the resolver's read on the result so the
    orchestrator can branch on intent rather than on a magic float:

    - "confident": top match >= 0.85 — proceed silently.
    - "single_weak": top match between 0.5 and 0.85 AND no rival within 0.15 of it —
      proceed but open with one sentence disclosing the assumed entity.
    - "ambiguous": multiple candidates within 0.15 of the top, OR top < 0.5 with rivals —
      ask the user which one.
    - "no_match": no candidate cleared the floor (top < 0.3 or empty) — proceed
      portfolio-wide if the question allows it; otherwise ask for an identifier.
    """

    id: str | None
    label: str | None
    confidence: float
    status: str
    alternatives: list[dict]


@lru_cache(maxsize=1)
def _pg_trgm_enabled() -> bool:
    with _engine().connect() as conn:
        return conn.execute(text("SELECT 1 FROM pg_extension WHERE extname = 'pg_trgm'")).first() is not None


def _normalize(s: str) -> str:
    return re.sub(r"[^\w\s]", " ", s.lower()).strip()


def _ilike_confidence(query: str, label: str) -> float:
    q = _normalize(query)
    lbl = _normalize(label)
    if q == lbl:
        return 0.95
    if lbl.startswith(q) or q.startswith(lbl):
        return 0.6
    return 0.4


def _classify(rows: list[dict]) -> str:
    if not rows:
        return "no_match"
    top = float(rows[0].get("confidence", 0.0))
    second = float(rows[1].get("confidence", 0.0)) if len(rows) > 1 else 0.0
    rival_close = (top - second) < 0.15 and second >= 0.3
    if top < 0.3:
        return "no_match"
    if rival_close and top < 0.85:
        return "ambiguous"
    if top >= 0.85:
        return "confident"
    if top >= 0.5:
        return "single_weak"
    return "ambiguous"


def _build_result(rows: list[dict]) -> ResolverResult:
    if not rows:
        return {
            "id": None,
            "label": None,
            "confidence": 0.0,
            "status": "no_match",
            "alternatives": [],
        }
    top = rows[0]
    return {
        "id": str(top["id"]) if top.get("id") is not None else None,
        "label": top.get("label"),
        "confidence": float(top.get("confidence", 0.0)),
        "status": _classify(rows),
        "alternatives": rows[:_TOP_N],
    }


def _trgm_search(
    sql: str,
    params: dict,
) -> list[dict]:
    """Run a pg_trgm-based similarity query that returns (id, label, similarity, ...) rows."""
    with _engine().connect() as conn:
        conn.execute(text("SET LOCAL statement_timeout = 15000"))
        result = conn.execute(text(sql), params)
        cols = list(result.keys())
        out = []
        for row in result.fetchall():
            d = dict(zip(cols, row))
            d["confidence"] = float(d.pop("similarity", 0.0) or 0.0)
            out.append(d)
        return out


def _tokens(query: str) -> list[str]:
    """Decompose a query into discriminating tokens (>= _TOKEN_MIN_LEN, not stopwords)."""
    return [
        t
        for t in re.findall(r"\w+", query.lower())
        if len(t) >= _TOKEN_MIN_LEN and t not in _STOPWORDS
    ]


def _merge_by_id(primary: list[dict], extra: list[dict]) -> list[dict]:
    """Merge two ranked lists; keep the higher-confidence row per id."""
    by_id: dict = {}
    for row in [*primary, *extra]:
        rid = row.get("id")
        if rid is None:
            continue
        prev = by_id.get(rid)
        if prev is None or float(row.get("confidence", 0.0)) > float(prev.get("confidence", 0.0)):
            by_id[rid] = row
    out = list(by_id.values())
    out.sort(key=lambda r: float(r.get("confidence", 0.0)), reverse=True)
    return out[:_TOP_N]


def _ilike_search(
    sql: str,
    params: dict,
    query: str,
) -> list[dict]:
    with _engine().connect() as conn:
        conn.execute(text("SET LOCAL statement_timeout = 15000"))
        result = conn.execute(text(sql), params)
        cols = list(result.keys())
        out = []
        for row in result.fetchall():
            d = dict(zip(cols, row))
            d["confidence"] = _ilike_confidence(query, d.get("label") or "")
            out.append(d)
        out.sort(key=lambda r: r["confidence"], reverse=True)
        return out


@tool
def resolve_project_by_name(query: str) -> ResolverResult:
    """Resolve a fuzzy project reference to a project ID.

    Use this BEFORE any project-scoped investigation. The string the user typed may be
    a partial name, a nickname, a job number, or an address fragment. Matches against
    the `projects` table on `name`, `aliases`, `job number`, and `address`.

    Args:
        query: The user's reference (e.g. "Riverside", "the Madison job", "1742").

    Returns:
        A ResolverResult. If confidence < 0.85, the orchestrator should ask the user
        to pick from `alternatives` instead of guessing.
    """
    q = query.strip()
    if not q:
        return _build_result([])

    if _pg_trgm_enabled():
        sql = """
            SELECT
                id,
                COALESCE(name, "job number") AS label,
                GREATEST(
                    similarity(COALESCE(name, ''), :q),
                    similarity(COALESCE("job number", ''), :q),
                    similarity(COALESCE(address, ''), :q),
                    COALESCE((
                        SELECT MAX(similarity(a, :q))
                        FROM unnest(COALESCE(aliases, ARRAY[]::text[])) AS a
                    ), 0)
                ) AS similarity,
                "job number" AS job_number,
                phase,
                state
            FROM projects
            WHERE
                name % :q
                OR "job number" % :q
                OR address % :q
                OR EXISTS (SELECT 1 FROM unnest(COALESCE(aliases, ARRAY[]::text[])) a WHERE a % :q)
            ORDER BY similarity DESC
            LIMIT :n
        """
        rows = _trgm_search(sql, {"q": q, "n": _TOP_N})

        # Token fallback: if the full-string match is weak or empty, try each
        # discriminating token (>= 4 chars, non-stopword) and merge results.
        # This catches cases like "Madison Avenue" → "1742 Madison Ave Office"
        # where the full string scores low but a token scores high.
        top_conf = float(rows[0].get("confidence", 0.0)) if rows else 0.0
        if top_conf < 0.5:
            for token in _tokens(q):
                token_rows = _trgm_search(sql, {"q": token, "n": _TOP_N})
                rows = _merge_by_id(rows, token_rows)
    else:
        pattern = f"%{_normalize(q)}%"
        sql = """
            SELECT id, COALESCE(name, "job number") AS label,
                   "job number" AS job_number, phase, state
            FROM projects
            WHERE lower(COALESCE(name, '')) LIKE :p
               OR lower(COALESCE("job number", '')) LIKE :p
               OR lower(COALESCE(address, '')) LIKE :p
            LIMIT :n
        """
        rows = _ilike_search(sql, {"p": pattern, "n": _TOP_N}, q)

    return _build_result(rows)


@tool
def resolve_vendor_by_name(query: str) -> ResolverResult:
    """Resolve a fuzzy vendor / subcontractor reference to a vendor ID.

    Matches against the `subcontractors` table on `company_name`,
    `legal_business_name`, and `dba_name`.

    Args:
        query: User's vendor reference (e.g. "NorCal", "the electrical sub").

    Returns:
        A ResolverResult.
    """
    q = query.strip()
    if not q:
        return _build_result([])

    if _pg_trgm_enabled():
        sql = """
            SELECT
                id,
                COALESCE(company_name, legal_business_name, dba_name) AS label,
                GREATEST(
                    similarity(COALESCE(company_name, ''), :q),
                    similarity(COALESCE(legal_business_name, ''), :q),
                    similarity(COALESCE(dba_name, ''), :q)
                ) AS similarity,
                company_type,
                city,
                state_province
            FROM subcontractors
            WHERE
                company_name % :q
                OR legal_business_name % :q
                OR dba_name % :q
            ORDER BY similarity DESC
            LIMIT :n
        """
        rows = _trgm_search(sql, {"q": q, "n": _TOP_N})
    else:
        pattern = f"%{_normalize(q)}%"
        sql = """
            SELECT id, COALESCE(company_name, legal_business_name, dba_name) AS label,
                   company_type, city, state_province
            FROM subcontractors
            WHERE lower(COALESCE(company_name, '')) LIKE :p
               OR lower(COALESCE(legal_business_name, '')) LIKE :p
               OR lower(COALESCE(dba_name, '')) LIKE :p
            LIMIT :n
        """
        rows = _ilike_search(sql, {"p": pattern, "n": _TOP_N}, q)

    return _build_result(rows)


@tool
def resolve_contract(
    query: str,
    project_id: str | None = None,
) -> ResolverResult:
    """Resolve a fuzzy contract or commitment reference to its ID.

    Searches the `commitments_unified` view (which combines `subcontracts` and
    `prime_contracts`) on `contract_number` and `title`. Optionally narrowed by
    project_id.

    Args:
        query: User's reference (e.g. "CMT-1042", "the electrical commitment", "the prime").
        project_id: Optional project scope to narrow the search.

    Returns:
        A ResolverResult.
    """
    q = query.strip()
    if not q:
        return _build_result([])

    project_filter = ""
    params: dict = {"q": q, "n": _TOP_N}
    if project_id is not None:
        project_filter = " AND project_id = :pid"
        try:
            params["pid"] = int(project_id)
        except (TypeError, ValueError):
            params["pid"] = project_id  # type: ignore[assignment]

    if _pg_trgm_enabled():
        sql = f"""
            SELECT
                id,
                COALESCE(contract_number || ' — ' || title, contract_number, title) AS label,
                GREATEST(
                    similarity(COALESCE(contract_number, ''), :q),
                    similarity(COALESCE(title, ''), :q)
                ) AS similarity,
                commitment_type,
                project_id,
                status
            FROM commitments_unified
            WHERE (contract_number % :q OR title % :q){project_filter}
            ORDER BY similarity DESC
            LIMIT :n
        """
        rows = _trgm_search(sql, params)
    else:
        pattern = f"%{_normalize(q)}%"
        params["p"] = pattern
        sql = f"""
            SELECT id,
                   COALESCE(contract_number || ' — ' || title, contract_number, title) AS label,
                   commitment_type, project_id, status
            FROM commitments_unified
            WHERE (lower(COALESCE(contract_number, '')) LIKE :p
                   OR lower(COALESCE(title, '')) LIKE :p){project_filter}
            LIMIT :n
        """
        rows = _ilike_search(sql, params, q)

    return _build_result(rows)


@tool
def resolve_cost_code(
    query: str,
    project_id: str | None = None,
) -> ResolverResult:
    """Resolve a fuzzy cost-code reference (number or description) to a cost code.

    Searches the `cost_codes` table on `id` (the code itself), `title`, and
    `division_title`. The `project_id` argument is accepted for API symmetry but is
    not currently used — cost codes are global in this schema.

    Args:
        query: User's reference (e.g. "electrical", "03-30-00", "labor in division 5").
        project_id: Optional — accepted but not used in current schema.

    Returns:
        A ResolverResult.
    """
    del project_id  # cost codes are global in this schema

    q = query.strip()
    if not q:
        return _build_result([])

    if _pg_trgm_enabled():
        sql = """
            SELECT
                id,
                COALESCE(id || ' — ' || title, title, id) AS label,
                GREATEST(
                    similarity(COALESCE(id, ''), :q),
                    similarity(COALESCE(title, ''), :q),
                    similarity(COALESCE(division_title, ''), :q)
                ) AS similarity,
                division_title,
                status
            FROM cost_codes
            WHERE id % :q OR title % :q OR division_title % :q
            ORDER BY similarity DESC
            LIMIT :n
        """
        rows = _trgm_search(sql, {"q": q, "n": _TOP_N})
    else:
        pattern = f"%{_normalize(q)}%"
        sql = """
            SELECT id,
                   COALESCE(id || ' — ' || title, title, id) AS label,
                   division_title, status
            FROM cost_codes
            WHERE lower(COALESCE(id, '')) LIKE :p
               OR lower(COALESCE(title, '')) LIKE :p
               OR lower(COALESCE(division_title, '')) LIKE :p
            LIMIT :n
        """
        rows = _ilike_search(sql, {"p": pattern, "n": _TOP_N}, q)

    return _build_result(rows)
