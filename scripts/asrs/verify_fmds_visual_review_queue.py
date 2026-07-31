#!/usr/bin/env python3
"""Verify FMDS 8-34 2026 visual-review coverage and isolation."""

from __future__ import annotations

import argparse
import csv
import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from supabase import Client, create_client

from ingest_fmds0834 import BUCKET, DOCUMENT_CODE, REVISION_LABEL, required_env


EXPECTED_TABLES = 58
EXPECTED_FIGURES = 60
EXPECTED_TOTAL = EXPECTED_TABLES + EXPECTED_FIGURES


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", type=Path)
    parser.add_argument("--queue-csv", type=Path)
    return parser.parse_args()


def exact_count(
    client: Client, table: str, equals: dict[str, Any] | None = None
) -> int:
    query = client.table(table).select("id", count="exact")
    for column, value in (equals or {}).items():
        query = query.eq(column, value)
    response = query.limit(1).execute()
    return int(response.count or 0)


def require_family(queue: list[dict[str, Any]], prefix: str, reason_fragment: str) -> int:
    matches = [
        row
        for row in queue
        if row["identifier"].startswith(prefix)
        and row["review_priority"] == 1
        and reason_fragment.lower() in row["review_reason"].lower()
    ]
    if not matches:
        raise RuntimeError(
            f"Tier 1 review family {prefix} missing reason fragment: {reason_fragment}"
        )
    return len(matches)


def main() -> int:
    args = parse_args()
    client = create_client(
        required_env("SUPABASE_ASRS_URL"), required_env("SUPABASE_ASRS_SECRET_KEY")
    )
    revisions = (
        client.table("fmds_corpus_revisions")
        .select("id,status,source_storage_path")
        .eq("document_code", DOCUMENT_CODE)
        .eq("revision_label", REVISION_LABEL)
        .execute()
        .data
    )
    if len(revisions) != 1 or revisions[0]["status"] != "staging":
        raise RuntimeError(f"Expected one staging revision, found: {revisions}")
    revision = revisions[0]

    queue = (
        client.table("fmds_visual_review_queue")
        .select("*")
        .eq("revision_id", revision["id"])
        .order("review_priority")
        .order("page_number")
        .execute()
        .data
    )
    table_rows = [row for row in queue if row["source_type"] == "table"]
    figure_rows = [row for row in queue if row["source_type"] == "figure"]
    if len(table_rows) != EXPECTED_TABLES or len(figure_rows) != EXPECTED_FIGURES:
        raise RuntimeError(
            f"Queue type coverage mismatch: tables={len(table_rows)}, figures={len(figure_rows)}"
        )
    keys = {(row["source_type"], row["source_id"]) for row in queue}
    if len(queue) != EXPECTED_TOTAL or len(keys) != EXPECTED_TOTAL:
        raise RuntimeError(f"Queue contains omissions or duplicates: rows={len(queue)}, keys={len(keys)}")
    if any(not row["evidence_image_path"] for row in queue):
        raise RuntimeError("A review queue item is missing rendered evidence")
    if any(row["candidate_count"] < 1 for row in queue):
        raise RuntimeError("A review queue item is missing candidate evidence")
    if any(row["review_status"] != "needs_review" for row in queue):
        raise RuntimeError("A source object changed status before attributed review")
    if any(row["latest_decision"] is not None for row in queue):
        raise RuntimeError("Unexpected review event exists before human review")

    candidates = (
        client.table("fmds_visual_review_candidates")
        .select("id,source_type,source_id,status,output")
        .eq("revision_id", revision["id"])
        .execute()
        .data
    )
    if len(candidates) != EXPECTED_TOTAL:
        raise RuntimeError(f"Candidate count mismatch: {len(candidates)}/{EXPECTED_TOTAL}")
    if any(row["status"] != "candidate" for row in candidates):
        raise RuntimeError("An automated candidate was silently promoted or rejected")
    if any(not (row["output"] or {}).get("candidate_only") for row in candidates):
        raise RuntimeError("A candidate record lacks the candidate-only safety marker")

    family_counts = {
        "table_2_1_4_5_4": require_family(queue, "2.1.4.5.4", "format changed"),
        "transverse_flue": require_family(queue, "2.2.1.4", "transverse flue"),
        "vertical_barriers": require_family(queue, "2.2.1.5", "vertical barrier"),
        "in_rack": sum(
            require_family(queue, f"2.2.{number}", "in-rack")
            for number in (3, 4, 6, 7)
        ),
        "top_loading": require_family(queue, "2.3", "top-loading"),
        "vertically_enclosed": require_family(queue, "2.4", "vertically enclosed"),
    }
    tier_counts = {
        "1": sum(row["review_priority"] == 1 for row in queue),
        "2": sum(row["review_priority"] == 2 for row in queue),
        "3": sum(row["review_priority"] == 3 for row in queue),
    }
    if tier_counts["1"] == 0 or tier_counts["2"] == 0:
        raise RuntimeError(f"Priority coverage is incomplete: {tier_counts}")

    unique_evidence = sorted({row["evidence_image_path"] for row in queue})
    sampled_paths = [unique_evidence[0], unique_evidence[len(unique_evidence) // 2], unique_evidence[-1]]
    storage_samples = {
        path: client.storage.from_(BUCKET).exists(path) for path in sampled_paths
    }
    if not all(storage_samples.values()):
        raise RuntimeError(f"Rendered evidence sample missing: {storage_samples}")

    active_count = exact_count(client, "fmds_active_chunks")
    legacy_count = exact_count(client, "fm_text_chunks")
    review_event_count = exact_count(
        client,
        "fmds_visual_review_events",
        equals={"revision_id": revision["id"]},
    )
    if active_count != 0:
        raise RuntimeError(f"Active retrieval exposed staging chunks: {active_count}")
    if legacy_count != 43:
        raise RuntimeError(f"Legacy corpus changed: {legacy_count}/43")
    if review_event_count != 0:
        raise RuntimeError(f"Expected zero committed human review events, found {review_event_count}")

    report = {
        "verified_at": datetime.now(timezone.utc).isoformat(),
        "revision_id": revision["id"],
        "revision_status": revision["status"],
        "queue": {
            "total": len(queue),
            "tables": len(table_rows),
            "figures": len(figure_rows),
            "unique_source_keys": len(keys),
            "tier_counts": tier_counts,
            "family_counts": family_counts,
            "candidate_coverage": len(candidates),
            "rendered_evidence_coverage": len(queue),
            "committed_review_events": review_event_count,
        },
        "storage_samples": storage_samples,
        "active_retrieval_chunk_count": active_count,
        "legacy_fm_text_chunk_count": legacy_count,
        "approval_ready": True,
        "activation_ready": False,
    }
    rendered = json.dumps(report, indent=2)
    if args.output:
        args.output.parent.mkdir(parents=True, exist_ok=True)
        args.output.write_text(rendered + "\n", encoding="utf-8")
    if args.queue_csv:
        args.queue_csv.parent.mkdir(parents=True, exist_ok=True)
        with args.queue_csv.open("w", encoding="utf-8", newline="") as handle:
            writer = csv.DictWriter(
                handle,
                fieldnames=(
                    "review_priority",
                    "source_type",
                    "identifier",
                    "page_number",
                    "title",
                    "review_reason",
                    "review_status",
                    "evidence_image_path",
                    "candidate_count",
                ),
            )
            writer.writeheader()
            writer.writerows(
                {key: row.get(key) for key in writer.fieldnames} for row in queue
            )
    print(rendered)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())