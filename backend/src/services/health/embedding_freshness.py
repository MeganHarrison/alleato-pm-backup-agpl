"""Guardrail: detect when the graph embedding stage is actively failing.

The 2026-06-24 incident: the embedding provider key hit a 401 auth wall and ~all
graph embeddings failed for hours (234 errors in a day). It did NOT page, because
`pipeline_alert_notifier` only fires when a source is fully "dark" (0 successes AND
0 partial-successes) — and interleaved partial-success ("warning") runs kept the
gate shut. The promotion guardrail (`outlook_promotion_freshness`) watches a
different stage (intake → document store), so neither alarm caught an embedding
outage that left promotion healthy.

This check reads the embedding bookkeeping directly off `rag_document_metadata`
(AI DB): a burst of recent `embedding_status='error'` rows means embedding is
failing right now, regardless of whether some runs partially succeeded. Kept
independent of the run-ledger gate so an embedding-stage auth/credit wall pages
on its own signal.

Run standalone:  ``python3 -m src.services.health.embedding_freshness``
Exit code: 0 healthy, 2 blocked (critical), 3 unknown.
"""

from __future__ import annotations

import json
import sys
from datetime import datetime, timezone
from typing import Any, Dict

from src.services.supabase_helpers import get_rag_read_client

# A burst of this many embedding errors in the window => the stage is failing now.
# 25 = one full GRAPH_EMBEDDING_LIMIT batch; a single bad batch shouldn't page,
# a sustained wall should.
ERROR_BURST_THRESHOLD = 40
WINDOW_MINUTES = 180


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def _window_start_iso() -> str:
    from datetime import timedelta

    return (_utcnow() - timedelta(minutes=WINDOW_MINUTES)).isoformat()


def check_embedding_freshness() -> Dict[str, Any]:
    now = _utcnow()
    window_start = _window_start_iso()
    try:
        resp = (
            get_rag_read_client()
            .from_("rag_document_metadata")
            .select("id", count="exact")
            .eq("embedding_status", "error")
            .gte("embedding_last_attempt_at", window_start)
            .execute()
        )
        recent_errors = resp.count if resp.count is not None else len(resp.data or [])
    except Exception as exc:  # noqa: BLE001
        return {
            "status": "unknown",
            "exit_code": 3,
            "detail": f"Could not read rag_document_metadata: {exc}",
            "checked_at": now.isoformat(),
        }

    if recent_errors >= ERROR_BURST_THRESHOLD:
        status, exit_code = "blocked", 2
        detail = (
            f"{recent_errors} documents failed embedding in the last "
            f"{WINDOW_MINUTES} min (threshold {ERROR_BURST_THRESHOLD}). The embedding "
            "provider is likely down — check the AI_GATEWAY_API_KEY / OPENAI_API_KEY "
            "auth + credit on the graph-sync cron."
        )
    else:
        status, exit_code = "healthy", 0
        detail = f"Embedding is healthy ({recent_errors} errors in the last {WINDOW_MINUTES} min)."

    return {
        "status": status,
        "exit_code": exit_code,
        "detail": detail,
        "recent_embedding_errors": recent_errors,
        "window_minutes": WINDOW_MINUTES,
        "error_burst_threshold": ERROR_BURST_THRESHOLD,
        "checked_at": now.isoformat(),
    }


def main() -> int:
    try:
        from dotenv import load_dotenv

        load_dotenv(".env")
    except ImportError:
        pass
    result = check_embedding_freshness()
    print(json.dumps(result, indent=2, sort_keys=True))
    return int(result["exit_code"])


if __name__ == "__main__":
    sys.exit(main())
