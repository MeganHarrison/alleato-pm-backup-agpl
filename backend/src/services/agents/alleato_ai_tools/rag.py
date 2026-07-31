"""Retrieval over the unstructured corpus (meeting transcripts, emails, Teams, docs).

Connects to the AI Database (Supabase project `fqcvmfqldlewvbsuxdvz`) via the
`RAG_DATABASE_URL` environment variable and queries the existing
`search_document_chunks` RPC (pgvector cosine similarity over halfvec embeddings).

The corpus was embedded by alleato-pm's Microsoft Graph sync using OpenAI
`text-embedding-3-large` (3072 dims). We embed the user query with the same model
and pass it to the RPC.

The RPC natively accepts only `source_types` and `project_id` filters. Date range
and `version_status` filters are applied in-process after the RPC returns; to avoid
losing hits to post-filtering we over-fetch (3× `match_count`) and truncate.
"""

from __future__ import annotations

import json
import logging
import os
import time
from datetime import date, datetime, timedelta, timezone
from functools import lru_cache
from typing import Any

from langchain_core.tools import tool
from openai import OpenAI

from src.services.supabase_helpers import get_rag_read_client
from src.services.ai_transport import get_openai_client
from ._retry import with_db_retry

logger = logging.getLogger(__name__)

_EMBEDDING_MODEL = "text-embedding-3-large"
_MATCH_THRESHOLD = 0.3
_OVERFETCH_MULTIPLIER = 3
_RERANK_CANDIDATE_FLOOR = 30

# --- Degraded-search guardrail -------------------------------------------------
# A vector search returning zero rows is normally a genuine "no matching passages".
# But it is ALSO what a degraded embedding/search backend looks like: if the live
# provider drifts (wrong key, wrong model, incompatible embedding space — a
# recurring failure class in this stack), every query embeds into a space that
# does not match the stored corpus, so EVERYTHING falls below threshold and every
# search silently returns empty. An agent then reports a confident false negative
# ("no evidence of a resignation") over a corpus that actually contains the answer.
#
# Guard: on an empty RPC result, run a cached sentinel probe — embed a generic
# in-domain phrase that is guaranteed to have a strong neighbour in a healthy
# index. If even the sentinel cannot clear a floor, the backend is degraded and we
# raise instead of returning a clean empty. Bounded cost: only on empty results,
# verdict cached for a short TTL.
_SEARCH_HEALTHCHECK_ENABLED_DEFAULT = "true"
_HEALTH_SENTINEL_QUERY = "weekly project meeting budget schedule update and action items"
_HEALTH_MIN_SIMILARITY = 0.15
_HEALTH_TTL_SECONDS = 120.0
_health_cache: dict[str, float | bool] = {"checked_at": 0.0, "healthy": True}


class CorpusSearchDegradedError(RuntimeError):
    """Vector search returned empty AND a sentinel probe confirms the embedding /
    search backend is degraded (provider/key/model drift). Distinguishes a true
    'no matching passages' from a silent search outage so callers fail loudly."""


def _search_healthcheck_enabled() -> bool:
    return os.environ.get(
        "RAG_SEARCH_HEALTHCHECK_ENABLED", _SEARCH_HEALTHCHECK_ENABLED_DEFAULT
    ).strip().lower() not in {"0", "false", "no", "off"}


def _corpus_search_healthy(rpc_name: str) -> bool:
    """Sentinel probe: is the embedding+search backend producing usable results?

    Cached for `_HEALTH_TTL_SECONDS`. Returns True when a generic in-domain query
    retrieves a neighbour above `_HEALTH_MIN_SIMILARITY`; False when the probe
    returns nothing or only near-zero similarities (incompatible embedding space)
    or the probe itself errors.
    """
    now = time.monotonic()
    if now - float(_health_cache["checked_at"]) < _HEALTH_TTL_SECONDS:
        return bool(_health_cache["healthy"])

    healthy = False
    try:
        probe_embedding = _embed_query(_HEALTH_SENTINEL_QUERY)
        client = get_rag_read_client()
        response = client.rpc(
            rpc_name,
            {
                "query_embedding": probe_embedding,
                "filter_source_types": None,
                "filter_project_id": None,
                "match_count": 1,
                "match_threshold": 0.0,
            },
        ).execute()
        rows = list(response.data or [])
        top = rows[0].get("similarity") if rows else None
        healthy = isinstance(top, (int, float)) and float(top) >= _HEALTH_MIN_SIMILARITY
    except Exception as exc:  # noqa: BLE001
        logger.warning("corpus search healthcheck probe failed: %s", exc)
        healthy = False

    _health_cache["checked_at"] = now
    _health_cache["healthy"] = healthy
    return healthy

_SEARCH_RPC = "search_document_chunks"

MEETING_SOURCE_TYPES = [
    "meeting_transcript",
    "meeting_summary",
    "meeting_segment_summary",
    "meeting_section",
    "meeting_summary_embed",
    "meeting_notes",
]


@lru_cache(maxsize=1)
def _openai_client() -> OpenAI:
    return get_openai_client()


def _embed_query(query: str) -> str:
    response = _openai_client().embeddings.create(
        model=_EMBEDDING_MODEL,
        input=query[:8000],
        dimensions=3072,
    )
    vec = response.data[0].embedding
    return json.dumps([float(x) for x in vec])


def _parse_iso_date(s: str | None) -> datetime | None:
    if not s:
        return None
    try:
        return datetime.fromisoformat(s.replace("Z", "+00:00"))
    except ValueError:
        try:
            return datetime.combine(date.fromisoformat(s), datetime.min.time())
        except ValueError:
            return None


def _coerce_project_id(project_id: str | int | None) -> int | None:
    if project_id is None or project_id == "":
        return None
    try:
        return int(project_id)
    except (TypeError, ValueError):
        return None


def _excerpt(s: str | None, limit: int = 400) -> str:
    if not s:
        return ""
    s = " ".join(s.split())
    return s if len(s) <= limit else s[: limit - 1] + "…"


def _format_results(rows: list[dict[str, Any]]) -> str:
    if not rows:
        return "_(no matching passages)_"
    lines: list[str] = []
    for i, r in enumerate(rows, start=1):
        title = r.get("doc_title") or r.get("document_id") or "(untitled)"
        src = r.get("source_type") or "?"
        d = r.get("doc_date")
        when = ""
        if isinstance(d, datetime):
            when = d.date().isoformat()
        elif isinstance(d, date):
            when = d.isoformat()
        elif d:
            when = str(d)[:10]
        sim = r.get("similarity")
        sim_str = f" · sim={sim:.2f}" if isinstance(sim, (int, float)) else ""
        header = f"**{i}. {title}** — _{src}_"
        if when:
            header += f" · {when}"
        header += sim_str
        lines.append(header)
        lines.append(f"> {_excerpt(r.get('chunk_text'))}")
        lines.append("")
    return "\n".join(lines).rstrip()


def retrieve(
    query: str,
    source_types: list[str] | None = None,
    project_id: str | int | None = None,
    date_from: str | None = None,
    date_to: str | None = None,
    version_status: str | None = None,
    max_results: int = 8,
    rerank: bool | None = None,
) -> list[dict[str, Any]]:
    """Retrieve ranked chunks. Returns raw rows so callers (tools, evals) can format as needed.

    Args:
        query: Natural language query.
        source_types: Optional filter list passed to the RPC.
        project_id: Optional project filter (coerced to bigint).
        date_from, date_to: ISO dates; applied in-process after the RPC.
        version_status: Match `doc_metadata->>'version_status'`; applied in-process.
        max_results: Final result count returned.
        rerank: Force rerank on/off. If None, enabled when COHERE_API_KEY is set.

    Returns:
        Ordered list of result dicts (most relevant first). Each row includes
        `similarity` (vector cosine sim) and, when reranked, `rerank_score`.

    Raises:
        ValueError on bad input. SQLAlchemy errors propagate.
    """
    if not query or not query.strip():
        raise ValueError("empty query")
    if max_results <= 0:
        raise ValueError("max_results must be positive")

    rpc_name = _SEARCH_RPC
    embedding = _embed_query(query)
    pid = _coerce_project_id(project_id)
    df = _parse_iso_date(date_from)
    dt = _parse_iso_date(date_to)

    do_rerank = rerank if rerank is not None else bool(
        os.environ.get("COHERE_API_KEY") or os.environ.get("OPENAI_API_KEY")
    )
    if do_rerank:
        fetch_count = max(max_results * _OVERFETCH_MULTIPLIER, _RERANK_CANDIDATE_FLOOR)
    else:
        fetch_count = max_results * _OVERFETCH_MULTIPLIER

    @with_db_retry
    def _run() -> list[dict[str, Any]]:
        client = get_rag_read_client()
        response = client.rpc(
            rpc_name,
            {
                "query_embedding": embedding,
                "filter_source_types": source_types,
                "filter_project_id": pid,
                "match_count": fetch_count,
                "match_threshold": _MATCH_THRESHOLD,
            },
        ).execute()
        return list(response.data or [])

    rows = _run()

    # Degraded-search guardrail: an empty RPC result is either a true negative or a
    # silent backend outage. Probe to tell them apart, and fail loudly on outage so
    # no caller can report a false "no matching passages" over a populated corpus.
    if not rows and _search_healthcheck_enabled() and not _corpus_search_healthy(rpc_name):
        raise CorpusSearchDegradedError(
            "Vector search returned no rows and the sentinel health probe failed — "
            "the embedding/search backend appears degraded (likely provider/key/model "
            "drift). Treating this as a capability failure, not 'no results'."
        )

    def keep(row: dict[str, Any]) -> bool:
        d = row.get("doc_date")
        if isinstance(d, datetime):
            d_naive = d.replace(tzinfo=None)
        elif isinstance(d, date):
            d_naive = datetime.combine(d, datetime.min.time())
        else:
            d_naive = None
        if df and (d_naive is None or d_naive < df.replace(tzinfo=None)):
            return False
        if dt and (d_naive is None or d_naive > dt.replace(tzinfo=None)):
            return False
        if version_status:
            md = row.get("doc_metadata") or {}
            if isinstance(md, dict):
                if (md.get("version_status") or "").lower() != version_status.lower():
                    return False
            else:
                return False
        return True

    filtered = [r for r in rows if keep(r)]

    if do_rerank and filtered:
        from .rerank import rerank_results

        filtered = rerank_results(query, filtered, top_n=max_results)
    else:
        filtered = filtered[:max_results]

    return filtered


def _search(
    query: str,
    source_types: list[str] | None,
    project_id: str | int | None,
    date_from: str | None,
    date_to: str | None,
    version_status: str | None,
    max_results: int,
) -> str:
    try:
        rows = retrieve(
            query=query,
            source_types=source_types,
            project_id=project_id,
            date_from=date_from,
            date_to=date_to,
            version_status=version_status,
            max_results=max_results,
        )
    except CorpusSearchDegradedError as exc:
        return f"SEARCH_BACKEND_DEGRADED: search unavailable — {exc}"
    except ValueError as exc:
        return f"Error: {exc}."
    except Exception as exc:  # noqa: BLE001
        return f"Error executing retrieval: {exc}"
    return _format_results(rows)


@tool
def search_meeting_transcripts(
    query: str,
    project_id: str | None = None,
    date_from: str | None = None,
    date_to: str | None = None,
    max_results: int = 8,
) -> str:
    """Search across meeting transcripts and meeting summaries.

    Use this when the question is about what was discussed, decided, or raised in
    meetings. Backed by pgvector cosine similarity over the embedded corpus.

    Args:
        query: Natural language search query.
        project_id: Optional — restrict to a project (numeric ID).
        date_from: Optional ISO date — restrict to meetings on/after this date.
        date_to: Optional ISO date — restrict to meetings on/before this date.
        max_results: Max passages to return (default 8).

    Returns:
        Markdown list of ranked passages: title, source, date, excerpt.
    """
    return _search(
        query=query,
        source_types=MEETING_SOURCE_TYPES,
        project_id=project_id,
        date_from=date_from,
        date_to=date_to,
        version_status=None,
        max_results=max_results,
    )


@tool
def list_recent_meetings(
    project_id: str | None = None,
    days_back: int = 30,
    max_results: int = 10,
) -> str:
    """List the most recently ingested meetings, ordered by ingestion date.

    Use this instead of `search_meeting_transcripts` when the question is about what
    is happening *right now* — "this week", "recent OACs", "latest update",
    "what happened last week" — whether portfolio-wide or for a single project.
    Vector search ranks by topical similarity, not recency, and the upstream
    ingestion reuses one `file_date` across every occurrence of a recurring
    meeting series, so date-filtered semantic search misses the freshest
    content. This tool pulls by ingestion date (`created_at`) directly,
    bypassing both issues.

    Args:
        project_id: Optional — numeric project ID. Omit to list recent meetings
            across the entire portfolio (use this for questions like "what
            meetings happened last week" with no project named).
        days_back: Look back this many days from today (default 30).
        max_results: Max meetings to return (default 10).

    Returns:
        Markdown list of recent meetings: title, ingestion date, project ID
        (when portfolio-wide), and summary excerpt. One row per meeting
        occurrence (deduped by document_id).
    """
    if days_back <= 0 or max_results <= 0:
        return "Error: days_back and max_results must be positive."

    pid: int | None = None
    if project_id not in (None, ""):
        pid = _coerce_project_id(project_id)
        if pid is None:
            return "Error: project_id must be numeric when provided."

    # Prefer summary chunks (richest content) over transcript chunks when both
    # exist for a meeting. Within source_type, pick the lowest chunk_index so we
    # get the opening of the transcript when no summary is available.
    @with_db_retry
    def _run() -> list[dict[str, Any]]:
        since = datetime.now(timezone.utc) - timedelta(days=days_back)
        query = (
            get_rag_read_client()
            .table("document_chunks")
            .select("document_id, chunk_index, text, metadata, source_type, created_at")
            .in_(
                "source_type",
                [
                    "meeting_summary",
                    "meeting_segment_summary",
                    "meeting_section",
                    "meeting_transcript",
                ],
            )
            .gte("created_at", since.isoformat())
            .order("created_at", desc=True)
            .order("chunk_index", desc=False)
            .limit(max_results * 4)
        )
        if pid is not None:
            query = query.eq("metadata->>project_id", str(pid))
        response = query.execute()
        return list(response.data or [])

    raw_rows = _run()
    rows_by_document: dict[str, dict[str, Any]] = {}
    source_rank = {
        "meeting_summary": 1,
        "meeting_segment_summary": 2,
        "meeting_section": 3,
        "meeting_transcript": 4,
    }
    for raw in raw_rows:
        document_id = str(raw.get("document_id") or "")
        if not document_id:
            continue
        metadata = raw.get("metadata") if isinstance(raw.get("metadata"), dict) else {}
        row = {
            "document_id": document_id,
            "title": metadata.get("title"),
            "project_id": metadata.get("project_id"),
            "source_type": raw.get("source_type"),
            "summary": raw.get("text"),
            "ingested_at": _parse_iso_date(raw.get("created_at")),
            "_rank": source_rank.get(str(raw.get("source_type")), 99),
            "_chunk_index": raw.get("chunk_index") or 0,
        }
        previous = rows_by_document.get(document_id)
        if previous is None or (row["_rank"], row["_chunk_index"]) < (
            previous["_rank"],
            previous["_chunk_index"],
        ):
            rows_by_document[document_id] = row

    rows = sorted(
        rows_by_document.values(),
        key=lambda item: item["ingested_at"] or datetime.min,
        reverse=True,
    )[:max_results]

    if not rows:
        scope = f"for project {pid}" if pid is not None else "across the portfolio"
        return f"_(no meetings ingested in the last {days_back} days {scope})_"

    # Resolve project IDs → names so the output cites "Vermilion Rise" instead of
    # "project 869". Lookup is best-effort: if it fails, fall back to the ID.
    from .db import get_project_names

    referenced: set[int] = set()
    for r in rows:
        raw = r.get("project_id")
        if raw is None or raw == "":
            continue
        try:
            referenced.add(int(raw))
        except (TypeError, ValueError):
            pass
    project_names = get_project_names(list(referenced)) if referenced else {}

    lines: list[str] = []
    for i, r in enumerate(rows, start=1):
        title = r["title"] or "(untitled)"
        ingested_at = r.get("ingested_at")
        when = ingested_at.date().isoformat() if isinstance(ingested_at, datetime) else ""
        header = f"**{i}. {title}** — _{r['source_type']}_ · ingested {when}"
        raw_pid = r.get("project_id")
        if pid is None and raw_pid:
            name = None
            try:
                name = project_names.get(int(raw_pid))
            except (TypeError, ValueError):
                pass
            header += f" · {name}" if name else f" · project {raw_pid}"
        lines.append(header)
        lines.append(f"> {_excerpt(r['summary'], limit=500)}")
        lines.append("")
    return "\n".join(lines).rstrip()


@tool
def search_unstructured(
    query: str,
    source_types: list[str] | None = None,
    project_id: str | None = None,
    date_from: str | None = None,
    date_to: str | None = None,
    version_status: str | None = None,
    max_results: int = 8,
) -> str:
    """Search across the full unstructured corpus: emails, Teams, OneDrive docs, meetings.

    Args:
        query: Natural language search query.
        source_types: Optional filter. Common values: "email", "teams_dm",
            "teams_channel", "onedrive_document", "document", "meeting_transcript",
            "meeting_summary", "meeting_segment_summary", "meeting_section",
            "meeting_notes". Omit to search everything.
        project_id: Optional — restrict to a project (numeric ID).
        date_from: Optional ISO date — on/after.
        date_to: Optional ISO date — on/before.
        version_status: Optional — match `doc_metadata->>'version_status'`.
        max_results: Max passages to return (default 8).

    Returns:
        Markdown list of ranked passages: title, source, date, excerpt.
    """
    return _search(
        query=query,
        source_types=source_types,
        project_id=project_id,
        date_from=date_from,
        date_to=date_to,
        version_status=version_status,
        max_results=max_results,
    )
