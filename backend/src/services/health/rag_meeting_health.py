"""
RAG Meeting Vectorization Health Check

Canary for the AI Strategist's meeting recall path.
Fails loudly if:
  1. PM APP database (lgveqfnpkxvzbnnwuled) is unreachable
  2. No meeting document_metadata rows exist
  3. Recent meetings (last 14 days) have <50% chunk coverage in AI Database
  4. Recent meetings have <90% full transcript chunk coverage in AI Database
  5. The embedding endpoint cannot embed a probe string
  6. >100 Fireflies ingestion jobs stuck at raw_ingested
  7. Any quota-error ingestion jobs exist

Note: summary_embedding was removed from PM APP on 2026-05-17 (caused OOM crash loop).
Meeting embedding health is now measured via document_chunks in the AI Database only.

Returns a dict with keys: passed (bool), failures (list), warnings (list), stats (dict).
Exits non-zero when called as __main__, posts Slack alert on failure if
SLACK_WEBHOOK_URL is set.
"""
from __future__ import annotations

import json
import logging
import os
import sys
from datetime import datetime, timedelta, timezone
from urllib.parse import quote
from typing import Any

import httpx

logger = logging.getLogger(__name__)

RECENT_WINDOW_DAYS = 14
MEETING_SIGNAL_LIMIT = 2_000
RECENT_MIN_CHUNK_RATIO = 0.5
RECENT_MIN_TRANSCRIPT_CHUNK_RATIO = 0.9
BATCH_SIZE = 500


def _probe_embedding_provider() -> dict:
    """Probe direct OpenAI embeddings endpoint; return whether it is working."""
    successes: list[str] = []
    warnings: list[str] = []

    openai_key = os.getenv("OPENAI_API_KEY")

    if not openai_key:
        warnings.append("OPENAI_API_KEY is not set — embedding probe skipped")
        return {"ok": False, "providers": successes, "warnings": warnings}

    try:
        resp = httpx.post(
            "https://api.openai.com/v1/embeddings",
            headers={"Authorization": f"Bearer {openai_key}", "Content-Type": "application/json"},
            json={"model": "text-embedding-3-large", "input": "alleato meeting health probe", "dimensions": 3072},
            timeout=15,
        )
        if resp.is_success:
            successes.append("openai-direct")
        else:
            warnings.append(f"OpenAI embedding probe returned {resp.status_code}: {resp.text[:300]}")
    except Exception as exc:
        warnings.append(f"OpenAI embedding probe threw: {exc}")

    return {"ok": len(successes) > 0, "providers": successes, "warnings": warnings}


def _parse_timestamp(value: Any) -> datetime | None:
    if not value:
        return None
    try:
        parsed = datetime.fromisoformat(str(value).replace("Z", "+00:00"))
        return parsed if parsed.tzinfo else parsed.replace(tzinfo=timezone.utc)
    except ValueError:
        return None


def _row_timestamp(row: dict[str, Any], keys: list[str]) -> datetime | None:
    for key in keys:
        parsed = _parse_timestamp(row.get(key))
        if parsed:
            return parsed
    return None


def _batched(values: list[str], size: int = BATCH_SIZE) -> list[list[str]]:
    return [values[index:index + size] for index in range(0, len(values), size)]


def _postgrest_in(values: list[str]) -> str:
    return "(" + ",".join(f'"{value.replace(chr(34), chr(34) + chr(34))}"' for value in values) + ")"


def _rag_credentials(
    supabase_url: str,
    supabase_service_key: str,
    rag_url: str | None = None,
    rag_service_key: str | None = None,
) -> tuple[str, str, bool]:
    reads_enabled = (os.getenv("RAG_DATABASE_READS_ENABLED") or "").strip().lower() in {
        "1",
        "true",
        "yes",
        "on",
    }
    resolved_url = rag_url or os.getenv("RAG_SUPABASE_URL")
    resolved_key = (
        rag_service_key
        or os.getenv("RAG_SUPABASE_SERVICE_ROLE_KEY")
    )

    if reads_enabled:
        if not resolved_url or not resolved_key:
            raise RuntimeError(
                "RAG_DATABASE_READS_ENABLED=true but RAG_SUPABASE_URL / RAG_SUPABASE_SERVICE_ROLE_KEY are not set"
            )
        return resolved_url, resolved_key, True

    return supabase_url, supabase_service_key, False


def run_health_check(
    supabase_url: str,
    supabase_service_key: str,
    *,
    rag_url: str | None = None,
    rag_service_key: str | None = None,
) -> dict:
    """Run all health checks and return results. Does not raise."""
    failures: list[str] = []
    warnings: list[str] = []
    stats: dict[str, Any] = {}

    try:
        from src.services.ops.db_pressure_guard import enforce_app_db_pressure_guard

        enforce_app_db_pressure_guard("rag_meeting_health")
    except Exception as exc:
        return {
            "passed": False,
            "failures": [f"App DB pressure guard blocked RAG meeting health: {exc}"],
            "warnings": warnings,
            "stats": stats,
            "checked_at": datetime.now(timezone.utc).isoformat(),
        }

    try:
        rag_url, rag_service_key, rag_reads_enabled = _rag_credentials(
            supabase_url,
            supabase_service_key,
            rag_url=rag_url,
            rag_service_key=rag_service_key,
        )
    except Exception as exc:
        return {
            "passed": False,
            "failures": [str(exc)],
            "warnings": warnings,
            "stats": stats,
            "checked_at": datetime.now(timezone.utc).isoformat(),
        }

    stats["database_routing"] = {
        "app_database": supabase_url,
        "rag_database": rag_url,
        "rag_reads_enabled": rag_reads_enabled,
    }

    app_headers = {
        "apikey": supabase_service_key,
        "Authorization": f"Bearer {supabase_service_key}",
        "Content-Type": "application/json",
    }
    rag_headers = {
        "apikey": rag_service_key,
        "Authorization": f"Bearer {rag_service_key}",
        "Content-Type": "application/json",
    }

    def rest_rows(
        base_url: str,
        headers: dict[str, str],
        table: str,
        params: dict[str, str],
        *,
        limit: int | None = None,
    ) -> list[dict[str, Any]]:
        rows: list[dict[str, Any]] = []
        page_size = min(limit or 1000, 1000)
        offset = 0
        while True:
            query_value_safe_chars = "().,\":*"
            query = "&".join(
                f"{quote(key)}={quote(value, safe=query_value_safe_chars)}"
                for key, value in params.items()
            )
            url = f"{base_url}/rest/v1/{table}?{query}"
            request_headers = dict(headers)
            request_headers["Range-Unit"] = "items"
            request_headers["Range"] = f"{offset}-{offset + page_size - 1}"
            try:
                resp = httpx.get(url, headers=request_headers, timeout=60)
            except Exception as exc:
                raise RuntimeError(f"{table} REST query timed out/failed on {base_url}: {exc}") from exc
            if not resp.is_success:
                raise RuntimeError(
                    f"{table} REST query failed on {base_url}: {resp.status_code} {resp.text[:300]}"
                )
            data = resp.json() or []
            rows.extend(dict(row) for row in data)
            if len(data) < page_size or (limit and len(rows) >= limit):
                break
            offset += page_size
        return rows[:limit] if limit else rows

    try:
        # ── 1. PM APP connectivity check ─────────────────────────────────────
        # Must pass before anything else — a crash loop here means all checks fail.
        try:
            resp = httpx.get(
                f"{supabase_url}/rest/v1/projects?select=id&limit=1",
                headers=app_headers,
                timeout=10,
            )
            if not resp.is_success:
                failures.append(
                    f"PM APP database unreachable: HTTP {resp.status_code}. "
                    f"Check lgveqfnpkxvzbnnwuled in Supabase dashboard immediately."
                )
                stats["pm_app_connectivity"] = {"ok": False, "status": resp.status_code}
            else:
                stats["pm_app_connectivity"] = {"ok": True}
        except Exception as exc:
            failures.append(
                f"PM APP database connection failed: {exc}. "
                f"The database may be in a crash loop — check lgveqfnpkxvzbnnwuled."
            )
            stats["pm_app_connectivity"] = {"ok": False, "error": str(exc)}

        # ── 2. Meeting document_metadata inventory ───────────────────────────
        # Fetch meeting rows WITHOUT summary_embedding — that column was cleared
        # from PM APP on 2026-05-17 (it caused OOM via HNSW index on startup).
        # Embedding health is measured via document_chunks in the AI Database below.
        signal_cutoff = datetime.now(timezone.utc) - timedelta(days=max(RECENT_WINDOW_DAYS * 2, 60))
        meeting_rows = rest_rows(
            supabase_url,
            app_headers,
            "document_metadata",
            {
                "select": "id,title,status,captured_at,date,created_at",
                "or": "(source.eq.fireflies,type.in.(meeting,meeting_transcript),category.eq.meeting,fireflies_id.not.is.null)",
                "created_at": f"gte.{signal_cutoff.isoformat()}",
                "order": "created_at.desc",
            },
            limit=MEETING_SIGNAL_LIMIT,
        )
        meeting_rows = [
            row
            for row in meeting_rows
            if "interview" not in str(row.get("title") or "").lower()
            and str(row.get("status") or "") != "intentionally_excluded"
        ]
        meeting_timestamps = [
            timestamp
            for row in meeting_rows
            if (timestamp := _row_timestamp(row, ["captured_at", "date", "created_at"]))
        ]
        metadata = {
            "total_meetings": len(meeting_rows),
            "latest_meeting_at": max(meeting_timestamps).isoformat() if meeting_timestamps else None,
            "sample_limit": MEETING_SIGNAL_LIMIT,
        }
        stats["metadata"] = metadata

        if metadata.get("total_meetings", 0) == 0:
            failures.append("No meeting document_metadata rows matched the Fireflies/meeting health filter.")

        # ── 3. Chunk coverage ────────────────────────────────────────────────
        cutoff = datetime.now(timezone.utc).timestamp() - RECENT_WINDOW_DAYS * 86400
        recent_rows = [
            row
            for row in meeting_rows
            if (timestamp := _row_timestamp(row, ["captured_at", "date", "created_at"]))
            and timestamp.timestamp() >= cutoff
        ]
        stats["recent"] = {"recent_meetings": len(recent_rows)}

        recent_meeting_ids = [str(row.get("id")) for row in recent_rows if row.get("id")]
        with_embedded_chunk_ids: set[str] = set()
        with_embedded_transcript_chunk_ids: set[str] = set()
        for batch in _batched(recent_meeting_ids):
            chunk_rows = rest_rows(
                rag_url,
                rag_headers,
                "document_chunks",
                {
                    "select": "document_id",
                    "embedding": "not.is.null",
                    "document_id": f"in.{_postgrest_in(batch)}",
                },
            )
            with_embedded_chunk_ids.update(
                str(row.get("document_id")) for row in chunk_rows if row.get("document_id")
            )
            transcript_chunk_rows = rest_rows(
                rag_url,
                rag_headers,
                "document_chunks",
                {
                    "select": "document_id",
                    "embedding": "not.is.null",
                    "source_type": "eq.meeting_transcript",
                    "document_id": f"in.{_postgrest_in(batch)}",
                },
            )
            with_embedded_transcript_chunk_ids.update(
                str(row.get("document_id")) for row in transcript_chunk_rows if row.get("document_id")
            )

        chunk_coverage = {
            "recent_meetings": len(recent_meeting_ids),
            "with_embedded_chunks": len(with_embedded_chunk_ids),
            "with_embedded_transcript_chunks": len(with_embedded_transcript_chunk_ids),
        }
        stats["chunk_coverage"] = chunk_coverage

        if chunk_coverage and chunk_coverage.get("recent_meetings", 0) > 0:
            ratio = chunk_coverage["with_embedded_chunks"] / chunk_coverage["recent_meetings"]
            if ratio < RECENT_MIN_CHUNK_RATIO:
                failures.append(
                    f"Only {chunk_coverage['with_embedded_chunks']}/{chunk_coverage['recent_meetings']} "
                    f"recent meetings have embedded chunks ({ratio*100:.1f}%, need ≥{RECENT_MIN_CHUNK_RATIO*100:.0f}%). "
                    f"SemanticSearch is missing recent meeting context."
                )
            transcript_ratio = (
                chunk_coverage["with_embedded_transcript_chunks"] / chunk_coverage["recent_meetings"]
            )
            if transcript_ratio < RECENT_MIN_TRANSCRIPT_CHUNK_RATIO:
                failures.append(
                    f"Only {chunk_coverage['with_embedded_transcript_chunks']}/{chunk_coverage['recent_meetings']} "
                    f"recent meetings have embedded full transcript chunks "
                    f"({transcript_ratio*100:.1f}%, need ≥{RECENT_MIN_TRANSCRIPT_CHUNK_RATIO*100:.0f}%). "
                    f"Meeting summaries may exist, but full-transcript RAG coverage is incomplete."
                )

        # ── 4. Fireflies pipeline job health ─────────────────────────────────
        job_rows = rest_rows(
            rag_url,
            rag_headers,
            "fireflies_ingestion_jobs",
            {
                "select": "stage,error_message",
                "updated_at": f"gte.{signal_cutoff.isoformat()}",
                "order": "updated_at.desc",
            },
            limit=5_000,
        )
        counts_by_stage: dict[str, int] = {}
        for row in job_rows:
            stage = str(row.get("stage") or "unknown")
            counts_by_stage[stage] = counts_by_stage.get(stage, 0) + 1
        rows = [
            {"stage": stage, "count": count}
            for stage, count in sorted(counts_by_stage.items(), key=lambda item: item[1], reverse=True)
        ]
        stats["pipeline_jobs"] = rows
        raw_ingested = next((r["count"] for r in rows if r["stage"] == "raw_ingested"), 0)
        error_count = next((r["count"] for r in rows if r["stage"] == "error"), 0)

        if raw_ingested > 100:
            failures.append(f"{raw_ingested} Fireflies jobs stuck at raw_ingested — not embedded.")
        if error_count > 100:
            warnings.append(f"{error_count} Fireflies jobs in error state.")

        quota_errors = sum(
            1
            for row in job_rows
            if row.get("stage") == "error" and "quota" in str(row.get("error_message") or "").lower()
        )
        if quota_errors > 0:
            failures.append(f"{quota_errors} Fireflies jobs failed with quota/provider errors.")

    except Exception as exc:
        failures.append(f"DB health check threw: {exc}")

    # ── 5. Embedding provider probe ──────────────────────────────────────────
    provider = _probe_embedding_provider()
    stats["embedding_provider"] = provider
    warnings.extend(provider.get("warnings", []))
    if not provider["ok"]:
        failures.append("OpenAI embedding probe failed — check OPENAI_API_KEY and api.openai.com availability.")

    return {
        "passed": len(failures) == 0,
        "failures": failures,
        "warnings": warnings,
        "stats": stats,
        "checked_at": datetime.now(timezone.utc).isoformat(),
    }


def _post_slack(webhook_url: str, result: dict) -> None:
    pm_down = any("PM APP database" in f for f in result.get("failures", []))
    icon = ":fire:" if pm_down else ":rotating_light:"
    title = "*PM APP DATABASE DOWN*" if pm_down else "*RAG Meeting Health FAILED*"
    failure_lines = "\n".join(f"• {f}" for f in result["failures"])
    try:
        httpx.post(
            webhook_url,
            json={"text": f"{icon} {title}\n{failure_lines}"},
            timeout=10,
        )
    except Exception as exc:
        logger.warning("Slack notification failed: %s", exc)


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO, stream=sys.stderr)

    supabase_url = os.getenv("SUPABASE_URL")
    supabase_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")

    if not supabase_url or not supabase_key:
        print(json.dumps({"passed": False, "failures": ["SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY not set"]}))
        sys.exit(1)

    result = run_health_check(supabase_url, supabase_key)
    print(json.dumps(result, indent=2))

    if result["warnings"]:
        for w in result["warnings"]:
            print(f"  WARN: {w}", file=sys.stderr)

    if not result["passed"]:
        print("\nMEETING VECTORIZATION HEALTH: FAIL", file=sys.stderr)
        for f in result["failures"]:
            print(f"  FAIL: {f}", file=sys.stderr)
        slack_url = os.getenv("SLACK_WEBHOOK_URL")
        if slack_url:
            _post_slack(slack_url, result)
        sys.exit(1)

    print("\nMeeting vectorization health: PASS", file=sys.stderr)
