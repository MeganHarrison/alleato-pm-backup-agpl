#!/usr/bin/env python3
"""Prioritize and seed the FMDS 8-34 2026 visual review queue.

This command is idempotent. It never changes review_status. Existing PyMuPDF
table/caption extraction is stored as candidate evidence only.
"""

from __future__ import annotations

import argparse
import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from supabase import Client, create_client

from ingest_fmds0834 import apply_document_config, required_env
from fmds_corpus_config import FmdsCorpusConfig, FMDS0834_2026_04, load_config


ACTIVE_CONFIG: FmdsCorpusConfig = FMDS0834_2026_04
POLICY_VERSION = "appendix-b-2026-04-v1"
CANDIDATE_VERSION = "queue-seed-2026-07-20.1"


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", type=Path)
    parser.add_argument("--document-config", default="fmds0834-2026-04")
    return parser.parse_args()


def classify(identifier: str) -> tuple[int, str]:
    normalized = identifier.strip()
    if normalized == "2.1.4.5.4":
        return 1, "Appendix B: Table 2.1.4.5.4 format changed in April 2026"
    if normalized.startswith("2.2.1.4"):
        return 1, "Appendix B: transverse flue measurement and minimum width guidance changed"
    if normalized.startswith("2.2.1.5"):
        return 1, "Appendix B: vertical barrier guidance added in Section 2.2.1.5"
    if any(normalized.startswith(f"2.2.{number}") for number in range(3, 8)):
        return 1, "Appendix B: in-rack sprinkler protection arrangements modified"
    if normalized.startswith("2.3"):
        return 1, "Appendix B: top-loading ASRS guidance modified and expanded"
    if normalized.startswith("2.4"):
        return 1, "Appendix B: vertically enclosed ASRS protection enhanced above 55 ft"
    return 2, "Appendix B: editorial renumbering requires table and figure identity verification"


def revision(client: Client) -> dict[str, Any]:
    rows = (
        client.table("fmds_corpus_revisions")
        .select("*")
        .eq("document_code", ACTIVE_CONFIG.document_code)
        .eq("revision_label", ACTIVE_CONFIG.revision_label)
        .execute()
        .data
    )
    if len(rows) != 1:
        raise RuntimeError(
            f"Expected one {ACTIVE_CONFIG.document_code} {ACTIVE_CONFIG.revision_label} revision, "
            f"found {len(rows)}"
        )
    if rows[0]["status"] != "staging":
        raise RuntimeError(f"Review queue requires staging status, found {rows[0]['status']}")
    return rows[0]


def seed_table(
    client: Client, revision_row: dict[str, Any], row: dict[str, Any]
) -> tuple[int, str]:
    priority, reason = classify(row["table_identifier"])
    client.table("fmds_tables").update(
        {"review_priority": priority, "review_reason": reason}
    ).eq("id", row["id"]).execute()
    client.table("fmds_visual_review_candidates").upsert(
        {
            "revision_id": revision_row["id"],
            "source_type": "table",
            "source_id": row["id"],
            "candidate_kind": "native_grid",
            "provider": "pymupdf",
            "model": "find_tables",
            "prompt_version": CANDIDATE_VERSION,
            "input_sha256": revision_row["source_sha256"],
            "output": {
                "table_identifier": row["table_identifier"],
                "caption_text": row.get("caption_text"),
                "bounding_box": row.get("bounding_box"),
                "extracted_structure": row.get("extracted_structure") or {},
                "evidence_image_path": row.get("evidence_image_path"),
                "candidate_only": True,
                "requires_visual_validation": True,
            },
            "confidence": row.get("extraction_confidence"),
            "status": "candidate",
        },
        on_conflict=(
            "source_type,source_id,candidate_kind,provider,model,"
            "prompt_version,input_sha256"
        ),
    ).execute()
    return priority, reason


def seed_figure(
    client: Client, revision_row: dict[str, Any], row: dict[str, Any]
) -> tuple[int, str]:
    priority, reason = classify(row["figure_identifier"])
    client.table("fmds_figures").update(
        {"review_priority": priority, "review_reason": reason}
    ).eq("id", row["id"]).execute()
    client.table("fmds_visual_review_candidates").upsert(
        {
            "revision_id": revision_row["id"],
            "source_type": "figure",
            "source_id": row["id"],
            "candidate_kind": "manual_import",
            "provider": "pymupdf",
            "model": "caption-inventory",
            "prompt_version": CANDIDATE_VERSION,
            "input_sha256": revision_row["source_sha256"],
            "output": {
                "figure_identifier": row["figure_identifier"],
                "caption_text": row.get("caption_text"),
                "bounding_box": row.get("bounding_box"),
                "extracted_description": row.get("extracted_description") or {},
                "evidence_image_path": row.get("evidence_image_path"),
                "candidate_only": True,
                "requires_visual_validation": True,
            },
            "confidence": row.get("extraction_confidence"),
            "status": "candidate",
        },
        on_conflict=(
            "source_type,source_id,candidate_kind,provider,model,"
            "prompt_version,input_sha256"
        ),
    ).execute()
    return priority, reason


def main() -> int:
    global ACTIVE_CONFIG
    args = parse_args()
    ACTIVE_CONFIG = load_config(args.document_config)
    apply_document_config(ACTIVE_CONFIG)
    client = create_client(
        required_env("SUPABASE_ASRS_URL"), required_env("SUPABASE_ASRS_SECRET_KEY")
    )
    revision_row = revision(client)
    tables = (
        client.table("fmds_tables")
        .select(
            "id,table_identifier,caption_text,bounding_box,extracted_structure,"
            "evidence_image_path,extraction_confidence,review_status"
        )
        .eq("revision_id", revision_row["id"])
        .order("page_start")
        .execute()
        .data
    )
    figures = (
        client.table("fmds_figures")
        .select(
            "id,figure_identifier,caption_text,bounding_box,extracted_description,"
            "evidence_image_path,extraction_confidence,review_status"
        )
        .eq("revision_id", revision_row["id"])
        .order("page_number")
        .execute()
        .data
    )
    if not tables or not figures:
        raise RuntimeError(
            "Source evidence inventory is incomplete before review seeding: "
            f"tables={len(tables)}, figures={len(figures)}"
        )
    if (
        ACTIVE_CONFIG.expected_table_count is not None
        and len(tables) != ACTIVE_CONFIG.expected_table_count
    ):
        raise RuntimeError(
            f"Table coverage mismatch: {len(tables)}/{ACTIVE_CONFIG.expected_table_count}"
        )
    if (
        ACTIVE_CONFIG.expected_figure_count is not None
        and len(figures) != ACTIVE_CONFIG.expected_figure_count
    ):
        raise RuntimeError(
            f"Figure coverage mismatch: {len(figures)}/{ACTIVE_CONFIG.expected_figure_count}"
        )
    if any(row["review_status"] != "needs_review" for row in tables + figures):
        raise RuntimeError("Refusing queue reseed because a source object has left needs_review")

    priority_counts = {1: 0, 2: 0, 3: 0}
    reason_counts: dict[str, int] = {}
    for row in tables:
        priority, reason = seed_table(client, revision_row, row)
        priority_counts[priority] += 1
        reason_counts[reason] = reason_counts.get(reason, 0) + 1
    for row in figures:
        priority, reason = seed_figure(client, revision_row, row)
        priority_counts[priority] += 1
        reason_counts[reason] = reason_counts.get(reason, 0) + 1

    queue = (
        client.table("fmds_visual_review_queue")
        .select("source_type,source_id,identifier,review_priority,review_reason,evidence_image_path,candidate_count")
        .eq("revision_id", revision_row["id"])
        .execute()
        .data
    )
    report = {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "policy_version": POLICY_VERSION,
        "candidate_version": CANDIDATE_VERSION,
        "revision_id": revision_row["id"],
        "status": revision_row["status"],
        "source_counts": {"tables": len(tables), "figures": len(figures)},
        "queue_count": len(queue),
        "priority_counts": {str(key): value for key, value in priority_counts.items()},
        "reason_counts": reason_counts,
        "candidate_coverage": sum(1 for row in queue if row["candidate_count"] > 0),
        "evidence_coverage": sum(1 for row in queue if row["evidence_image_path"]),
        "reviewed_count": 0,
        "activation_ready": False,
    }
    expected_queue_count = len(tables) + len(figures)
    if len(queue) != expected_queue_count:
        raise RuntimeError(f"Queue coverage mismatch: {len(queue)}/{expected_queue_count}")
    if report["candidate_coverage"] != len(queue):
        raise RuntimeError(
            f"Candidate coverage mismatch: {report['candidate_coverage']}/{len(queue)}"
        )
    if report["evidence_coverage"] != len(queue):
        raise RuntimeError(
            f"Evidence coverage mismatch: {report['evidence_coverage']}/{len(queue)}"
        )
    if ACTIVE_CONFIG.document_code == "FMDS0834" and (
        priority_counts[1] == 0 or priority_counts[2] == 0
    ):
        raise RuntimeError(f"Priority policy failed to produce Tier 1 and Tier 2 items: {priority_counts}")

    rendered = json.dumps(report, indent=2)
    if args.output:
        args.output.parent.mkdir(parents=True, exist_ok=True)
        args.output.write_text(rendered + "\n", encoding="utf-8")
    print(rendered)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
