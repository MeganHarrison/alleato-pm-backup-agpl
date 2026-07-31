#!/usr/bin/env python3
"""Verify the FMDS 8-34 April 2026 review batch 1 packet and safety gates."""

from __future__ import annotations

import argparse
import hashlib
import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from supabase import Client, create_client

from generate_fmds_review_batch_1 import (
    BATCH_ID,
    BATCH_VERSION,
    EXPECTED_OBJECTS,
    EXPECTED_PAGES,
    REVIEW_PROPOSALS,
    is_batch_identifier,
)
from ingest_fmds0834 import BUCKET, DOCUMENT_CODE, REVISION_LABEL, required_env


EXPECTED_TABLES = 2
EXPECTED_FIGURES = 7
MODEL = "review-packet-native-geometry"


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--evidence-dir", type=Path, required=True)
    parser.add_argument("--output", type=Path)
    return parser.parse_args()


def exact_count(
    client: Client, table: str, equals: dict[str, Any] | None = None
) -> int:
    query = client.table(table).select("id", count="exact")
    for column, value in (equals or {}).items():
        query = query.eq(column, value)
    response = query.limit(1).execute()
    return int(response.count or 0)


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def main() -> int:
    args = parse_args()
    manifest_path = args.evidence_dir / "manifest.json"
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    items = manifest["items"]

    if manifest["batch_id"] != BATCH_ID or manifest["batch_version"] != BATCH_VERSION:
        raise RuntimeError("Manifest batch identity does not match the verifier contract")
    if manifest["document_code"] != DOCUMENT_CODE or manifest["revision_label"] != REVISION_LABEL:
        raise RuntimeError("Manifest corpus identity does not match FMDS 8-34 April 2026")
    if manifest["revision_status"] != "staging":
        raise RuntimeError("Manifest crossed the staging revision boundary")
    if len(items) != EXPECTED_OBJECTS:
        raise RuntimeError(f"Review item count mismatch: {len(items)}/{EXPECTED_OBJECTS}")
    if set(manifest["pages"]) != EXPECTED_PAGES:
        raise RuntimeError(f"Review page coverage mismatch: {manifest['pages']}")
    if manifest["table_count"] != EXPECTED_TABLES or manifest["figure_count"] != EXPECTED_FIGURES:
        raise RuntimeError("Review object type coverage mismatch")
    if len({(row["source_type"], row["source_id"]) for row in items}) != EXPECTED_OBJECTS:
        raise RuntimeError("Manifest contains duplicate review objects")
    if any(row["review_status"] not in {"needs_review", "reviewed"} for row in items):
        raise RuntimeError("A batch object has an unsupported review status")
    reviewed_items = [row for row in items if row["review_status"] == "reviewed"]
    pending_items = [row for row in items if row["review_status"] == "needs_review"]
    expected_approval_status = (
        "approved" if len(reviewed_items) == EXPECTED_OBJECTS
        else "partially_reviewed" if reviewed_items
        else "not_approved"
    )
    if manifest["approval_status"] != expected_approval_status:
        raise RuntimeError("Manifest approval summary does not match item review states")
    if any(row.get("latest_decision") != "approved" for row in reviewed_items):
        raise RuntimeError("A reviewed manifest item lacks an approved decision")
    if any(row["discrepancy_state"] != "manual_validation_required" for row in items):
        raise RuntimeError("A batch object bypassed qualified manual validation")
    if any(not row["region_native_text"].strip() for row in items):
        raise RuntimeError("A batch crop has no native text evidence")
    proposal_keys = {(row["source_type"], row["identifier"]) for row in items}
    if proposal_keys != set(REVIEW_PROPOSALS):
        raise RuntimeError("Manifest review-proposal coverage is incomplete or contains extras")
    for row in items:
        proposal = row.get("review_proposal") or {}
        if not proposal.get("verify") or "questions" not in proposal:
            raise RuntimeError(f"Review instructions are incomplete for {row['identifier']}")
        if row["source_type"] == "table":
            expected_columns = 4 if row["identifier"] == "2.1.4.5.4" else 2
            if proposal.get("kind") != "table_transcription" or len(proposal.get("columns", [])) != expected_columns:
                raise RuntimeError(f"Clean logical table columns are invalid for {row['identifier']}")
            if any(len(values) != expected_columns for values in proposal.get("rows", [])):
                raise RuntimeError(f"Clean table rows are invalid for {row['identifier']}")
        elif proposal.get("kind") != "figure_fact_review" or not proposal.get("facts"):
            raise RuntimeError(f"Figure facts are incomplete for {row['identifier']}")

    html_path = args.evidence_dir / "review-packet.html"
    packet_html = html_path.read_text(encoding="utf-8")
    if packet_html.count("Reviewer decision") != len(pending_items):
        raise RuntimeError("Reviewer decision coverage is incomplete in the HTML packet")
    if packet_html.count("Approve as transcribed") != len(pending_items):
        raise RuntimeError("Approve/correct/reject choices are incomplete in the HTML packet")
    if packet_html.count("Recorded decision") != len(reviewed_items):
        raise RuntimeError("Recorded decisions are incomplete in the HTML packet")
    if "Table extraction diagnostics" in packet_html:
        raise RuntimeError("Malformed table diagnostics remain on the reviewer-facing surface")
    appendix_position = packet_html.find("Technical appendix")
    last_decision_position = packet_html.rfind("Reviewer decision")
    if appendix_position < last_decision_position:
        raise RuntimeError("Technical diagnostics appear before reviewer decisions")

    local_files: dict[str, bool] = {}
    for row in items:
        crop_path = args.evidence_dir / row["crop_relative_path"]
        page_path = args.evidence_dir / row["page_relative_path"]
        local_files[str(crop_path.relative_to(args.evidence_dir))] = crop_path.is_file()
        local_files[str(page_path.relative_to(args.evidence_dir))] = page_path.is_file()
        if not crop_path.is_file() or sha256_file(crop_path) != row["crop_sha256"]:
            raise RuntimeError(f"Crop file or digest mismatch: {crop_path}")
        if not page_path.is_file():
            raise RuntimeError(f"Full-page evidence missing: {page_path}")
    packet_pdf = args.evidence_dir / "review-packet.pdf"
    cover_png = args.evidence_dir / "review-packet-cover.png"
    if not packet_pdf.is_file() or not cover_png.is_file():
        raise RuntimeError("Rendered reviewer PDF or screenshot is missing")

    client = create_client(
        required_env("SUPABASE_ASRS_URL"), required_env("SUPABASE_ASRS_SECRET_KEY")
    )
    revision = (
        client.table("fmds_corpus_revisions")
        .select("id,status,source_storage_path")
        .eq("document_code", DOCUMENT_CODE)
        .eq("revision_label", REVISION_LABEL)
        .single()
        .execute()
        .data
    )
    if revision["id"] != manifest["revision_id"] or revision["status"] != "staging":
        raise RuntimeError(f"Live revision boundary mismatch: {revision}")

    queue = (
        client.table("fmds_visual_review_queue")
        .select("source_type,source_id,identifier,page_number,review_status,latest_decision")
        .eq("revision_id", revision["id"])
        .execute()
        .data
    )
    batch_queue = [row for row in queue if is_batch_identifier(row["identifier"])]
    if len(batch_queue) != EXPECTED_OBJECTS:
        raise RuntimeError(f"Live batch queue coverage mismatch: {len(batch_queue)}")
    live_reviewed = [
        row for row in batch_queue
        if row["review_status"] == "reviewed" and row["latest_decision"] == "approved"
    ]
    live_pending = [
        row for row in batch_queue
        if row["review_status"] == "needs_review" and row["latest_decision"] is None
    ]
    if len(live_reviewed) != len(reviewed_items) or len(live_pending) != len(pending_items):
        raise RuntimeError("Live review state does not match the generated packet")
    if {(row["source_type"], row["source_id"]) for row in live_reviewed} != {
        (row["source_type"], row["source_id"]) for row in reviewed_items
    }:
        raise RuntimeError("Live approved objects do not match the generated packet")

    candidates = (
        client.table("fmds_visual_review_candidates")
        .select("id,source_type,source_id,status,output")
        .eq("revision_id", revision["id"])
        .eq("model", MODEL)
        .eq("prompt_version", BATCH_VERSION)
        .eq("status", "candidate")
        .execute()
        .data
    )
    if len(candidates) != EXPECTED_OBJECTS:
        raise RuntimeError(f"Active batch candidate count mismatch: {len(candidates)}/{EXPECTED_OBJECTS}")
    if len({(row["source_type"], row["source_id"]) for row in candidates}) != EXPECTED_OBJECTS:
        raise RuntimeError("Active batch candidates contain duplicate source objects")
    if any(
        not (row["output"] or {}).get("candidate_only")
        or not (row["output"] or {}).get("requires_qualified_review")
        or (row["output"] or {}).get("batch_id") != BATCH_ID
        or not (row["output"] or {}).get("review_proposal")
        for row in candidates
    ):
        raise RuntimeError("A batch candidate lacks the candidate-only qualified-review guard")
    active_geometry_candidates = (
        client.table("fmds_visual_review_candidates")
        .select("id,prompt_version")
        .eq("revision_id", revision["id"])
        .eq("model", MODEL)
        .eq("status", "candidate")
        .execute()
        .data
    )
    if len(active_geometry_candidates) != EXPECTED_OBJECTS or any(
        row["prompt_version"] != BATCH_VERSION for row in active_geometry_candidates
    ):
        raise RuntimeError("A superseded reviewer-packet version remains active")

    storage_paths = sorted(
        {row["storage_crop_path"] for row in items}
        | {row["storage_page_path"] for row in items}
    )
    packet_storage_path = (
        items[0]["storage_crop_path"].split("/objects/", 1)[0] + "/review-packet.pdf"
    )
    storage_paths.append(packet_storage_path)
    storage_exists = {
        path: client.storage.from_(BUCKET).exists(path) for path in storage_paths
    }
    if not all(storage_exists.values()):
        missing = [path for path, exists in storage_exists.items() if not exists]
        raise RuntimeError(f"Private review evidence missing from storage: {missing}")

    review_event_count = exact_count(
        client,
        "fmds_visual_review_events",
        equals={"revision_id": revision["id"]},
    )
    active_count = exact_count(client, "fmds_active_chunks")
    legacy_count = exact_count(client, "fm_text_chunks")
    if review_event_count < len(reviewed_items):
        raise RuntimeError(
            f"Review event coverage is incomplete: events={review_event_count}, reviewed={len(reviewed_items)}"
        )
    if active_count != 0:
        raise RuntimeError(f"Staging chunks leaked into active retrieval: {active_count}")
    if legacy_count != 43:
        raise RuntimeError(f"Legacy corpus count changed: {legacy_count}/43")

    report = {
        "verified_at": datetime.now(timezone.utc).isoformat(),
        "batch_id": BATCH_ID,
        "batch_version": BATCH_VERSION,
        "revision_id": revision["id"],
        "revision_status": revision["status"],
        "packet": {
            "objects": len(items),
            "pages": len(EXPECTED_PAGES),
            "tables": manifest["table_count"],
            "figures": manifest["figure_count"],
            "manual_validation_required": sum(
                row["discrepancy_state"] == "manual_validation_required" for row in items
            ),
            "clean_table_transcriptions": sum(
                row["review_proposal"]["kind"] == "table_transcription" for row in items
            ),
            "figure_fact_reviews": sum(
                row["review_proposal"]["kind"] == "figure_fact_review" for row in items
            ),
            "source_consistency_questions": sum(
                bool(row["review_proposal"]["questions"]) for row in items
            ),
            "decision_forms": packet_html.count("Reviewer decision"),
            "recorded_decisions": packet_html.count("Recorded decision"),
            "local_files_checked": len(local_files) + 2,
            "private_storage_objects_checked": len(storage_exists),
        },
        "live_state": {
            "batch_queue_items_needing_review": len(live_pending),
            "batch_queue_items_reviewed": len(live_reviewed),
            "reviewed_identifiers": [row["identifier"] for row in live_reviewed],
            "active_batch_candidates": len(candidates),
            "committed_review_events": review_event_count,
            "active_retrieval_chunks": active_count,
            "legacy_fm_text_chunks": legacy_count,
        },
        "approval_status": manifest["approval_status"],
        "activation_ready": False,
    }
    rendered = json.dumps(report, indent=2)
    if args.output:
        args.output.parent.mkdir(parents=True, exist_ok=True)
        args.output.write_text(rendered + "\n", encoding="utf-8")
    print(rendered)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
