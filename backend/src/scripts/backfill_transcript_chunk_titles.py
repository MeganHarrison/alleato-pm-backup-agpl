#!/usr/bin/env python3
"""Backfill missing ``title``/``captured_at``/``fireflies_id`` on transcript chunks.

Background
----------
``FirefliesIngestionPipeline._build_chunk`` historically built ``document_chunks``
metadata for ``source_type='meeting_transcript'`` without copying the parent
transcript's ``title``, ``captured_at``, or ``fireflies_id`` keys into the
chunk-level JSON. Sibling source types written by ``pipeline/embedder.py``
(``meeting_summary``, ``meeting_segment_summary``, ``meeting_section``) carry
those fields, so the absence on transcript chunks breaks RAG title/date filters
and any UI that surfaces "Meeting: <title>" from the chunk row directly.

The code fix in ``fireflies_pipeline.py`` plugs the leak going forward. This
script repairs the ~15k existing chunks already in the AI Database.

What it does
------------
1. Reads ``document_metadata`` from the Main App DB for rows where
   ``source = 'fireflies'`` AND ``deleted_at IS NULL``. These rows carry the
   authoritative ``title``, ``captured_at``/``date``, and ``fireflies_id``.
2. For each meeting, UPDATEs rows in the AI Database ``document_chunks`` table
   where ``document_id = <metadata.id>`` AND ``source_type = 'meeting_transcript'``
   AND the chunk metadata is missing ``title`` (NULL or empty string), patching
   ``title``, ``captured_at``, ``file_date``, and ``fireflies_id`` into the
   existing metadata JSON via ``metadata = metadata || jsonb_build_object(...)``.
3. Batches UPDATEs (~500 chunk_ids per statement) to keep transactions short.

Idempotent: chunks that already have a non-empty ``title`` are skipped, so
re-running this script is safe.

The ``file_date`` written here is sourced from the per-meeting ``captured_at``
(falling back to ``date``) on ``document_metadata`` — NOT from any series-level
recurring-meeting field — to avoid stamping every occurrence of a weekly series
with the same date.

Usage
-----
    cd backend
    .venv/bin/python src/scripts/backfill_transcript_chunk_titles.py --dry-run
    .venv/bin/python src/scripts/backfill_transcript_chunk_titles.py
    .venv/bin/python src/scripts/backfill_transcript_chunk_titles.py --limit 100
"""

from __future__ import annotations

import argparse
import logging
import sys
import time
from pathlib import Path
from typing import Any, Dict, Iterable, List, Optional


logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(message)s",
)
logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Path / env bootstrap for direct script execution.
# ---------------------------------------------------------------------------
def _load_backend() -> None:
    backend_root = Path(__file__).resolve().parents[2]
    if str(backend_root) not in sys.path:
        sys.path.append(str(backend_root))

    from src.services.env_loader import load_env

    load_env()


_UPDATE_BATCH_SIZE = 500
_PAGE_SIZE = 1000


def _fetch_meeting_metadata(
    main_client,
    limit: Optional[int],
) -> List[Dict[str, Any]]:
    """Return ``document_metadata`` rows for live Fireflies meetings."""
    rows: List[Dict[str, Any]] = []
    offset = 0
    while True:
        page_size = _PAGE_SIZE
        if limit is not None:
            remaining = limit - len(rows)
            if remaining <= 0:
                break
            page_size = min(page_size, remaining)

        query = (
            main_client.table("document_metadata")
            .select("id, title, captured_at, date, fireflies_id")
            .eq("source", "fireflies")
            .is_("deleted_at", "null")
            .order("captured_at", desc=True)
            .range(offset, offset + page_size - 1)
        )
        resp = query.execute()
        page = resp.data or []
        if not page:
            break
        rows.extend(page)
        if len(page) < page_size:
            break
        offset += page_size

    return rows


def _coerce_iso(value: Any) -> Optional[str]:
    if value is None:
        return None
    if isinstance(value, str):
        return value or None
    # supabase-py usually returns timestamps as strings, but be defensive.
    iso = getattr(value, "isoformat", None)
    if callable(iso):
        return iso()
    return str(value)


def _stale_chunk_ids_for_document(
    rag_client,
    document_id: str,
) -> List[str]:
    """Return chunk_ids for transcript chunks missing a populated ``title``."""
    # Pull chunk metadata and filter client-side. ``document_chunks.metadata`` is
    # JSONB; supabase-py's ``or_`` builder is awkward for "key missing OR empty
    # string" so we apply the predicate in Python after a narrow fetch.
    stale: List[str] = []
    offset = 0
    while True:
        resp = (
            rag_client.table("document_chunks")
            .select("chunk_id, metadata")
            .eq("document_id", document_id)
            .eq("source_type", "meeting_transcript")
            .range(offset, offset + _PAGE_SIZE - 1)
            .execute()
        )
        page = resp.data or []
        if not page:
            break
        for row in page:
            meta = row.get("metadata") or {}
            title = meta.get("title") if isinstance(meta, dict) else None
            if not title:
                stale.append(row["chunk_id"])
        if len(page) < _PAGE_SIZE:
            break
        offset += _PAGE_SIZE
    return stale


def _batched(items: List[str], size: int) -> Iterable[List[str]]:
    for i in range(0, len(items), size):
        yield items[i : i + size]


def _apply_patch(
    rag_client,
    chunk_ids: List[str],
    patch: Dict[str, Any],
) -> int:
    """Merge ``patch`` into ``metadata`` for the supplied chunk_ids.

    Uses the PostgREST RPC ``patch_chunk_metadata`` when available; otherwise
    falls back to a per-row read-modify-write loop. We avoid the RPC dependency
    by always doing the read-modify-write path — chunk counts are bounded and
    the merge is a single JSON dict update.
    """
    if not chunk_ids:
        return 0

    # Fetch current metadata for this batch so we can preserve unrelated keys.
    resp = (
        rag_client.table("document_chunks")
        .select("chunk_id, metadata")
        .in_("chunk_id", chunk_ids)
        .execute()
    )
    current = {row["chunk_id"]: (row.get("metadata") or {}) for row in (resp.data or [])}

    updated = 0
    for chunk_id in chunk_ids:
        existing = current.get(chunk_id) or {}
        merged = dict(existing)
        for key, value in patch.items():
            # Only overwrite when the existing value is missing/empty so the
            # script is safe to re-run and never clobbers a real value with a
            # null fallback.
            if value is None:
                continue
            if not merged.get(key):
                merged[key] = value
        if merged == existing:
            continue
        rag_client.table("document_chunks").update({"metadata": merged}).eq(
            "chunk_id", chunk_id
        ).execute()
        updated += 1
    return updated


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Report counts of chunks that would be patched without writing.",
    )
    parser.add_argument(
        "--limit",
        type=int,
        default=None,
        help="Process at most N meetings (most recent first). Default: all.",
    )
    args = parser.parse_args()

    _load_backend()

    from src.services.supabase_helpers import (
        get_rag_write_client,
        get_supabase_client,
    )

    main_client = get_supabase_client()
    rag_client = get_rag_write_client()

    started = time.time()
    meetings = _fetch_meeting_metadata(main_client, args.limit)
    logger.info("Found %d Fireflies meetings in document_metadata", len(meetings))

    total_stale = 0
    total_patched = 0
    meetings_with_stale = 0

    for idx, meeting in enumerate(meetings, start=1):
        document_id = meeting["id"]
        title = meeting.get("title")
        captured_at = _coerce_iso(meeting.get("captured_at") or meeting.get("date"))
        fireflies_id = meeting.get("fireflies_id")

        if not title:
            logger.debug("Skipping %s: no title on document_metadata", document_id)
            continue

        stale_ids = _stale_chunk_ids_for_document(rag_client, document_id)
        if not stale_ids:
            continue

        meetings_with_stale += 1
        total_stale += len(stale_ids)

        patch: Dict[str, Any] = {
            "title": title,
            "captured_at": captured_at,
            "file_date": captured_at,
            "fireflies_id": fireflies_id,
        }

        if args.dry_run:
            logger.info(
                "[dry-run] %s (%s): %d transcript chunks would be patched",
                document_id,
                title,
                len(stale_ids),
            )
            continue

        for batch in _batched(stale_ids, _UPDATE_BATCH_SIZE):
            total_patched += _apply_patch(rag_client, batch, patch)

        if idx % 25 == 0:
            elapsed = time.time() - started
            logger.info(
                "Progress: %d/%d meetings scanned, %d chunks patched (%.1fs elapsed)",
                idx,
                len(meetings),
                total_patched,
                elapsed,
            )

    elapsed = time.time() - started
    mode = "dry-run" if args.dry_run else "live"
    logger.info(
        "Done (%s) in %.1fs: %d meetings had stale transcript chunks, "
        "%d stale chunks found, %d patched.",
        mode,
        elapsed,
        meetings_with_stale,
        total_stale,
        total_patched,
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
