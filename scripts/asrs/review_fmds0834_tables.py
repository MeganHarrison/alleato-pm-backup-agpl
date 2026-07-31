#!/usr/bin/env python3
"""Export, validate, and safely replay the FMDS0834 table review ledger.

The command is read-only unless ``--apply-ledger`` is supplied. Every mode is
locked to the April 2026 FMDS0834 source hash and dedicated ASRS revision. A
replay never overwrites a newer decision and skips an already-recorded event.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import os
from datetime import datetime, timezone
from decimal import Decimal
from pathlib import Path
from typing import Any
from uuid import UUID

import psycopg2
from psycopg2.extras import RealDictCursor


DOCUMENT_CODE = "FMDS0834"
REVISION_LABEL = "2026-04"
REVISION_ID = "65306e47-c25a-4397-92a0-c44c03903d0f"
SOURCE_SHA256 = "c6f78457ac452c1c4c95b8d195ab5f33a5a772a4ebaf7d0e5ff28c055d8411ed"
REVIEWER_ID = "codex-s210"
EXPECTED_REVIEW_COUNTS = {"approved": 13, "changes_requested": 43}


def arguments() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    action = parser.add_mutually_exclusive_group()
    action.add_argument("--export-live-ledger", action="store_true")
    action.add_argument("--validate-live", action="store_true")
    action.add_argument("--validate-ledger", type=Path)
    action.add_argument("--apply-ledger", type=Path)
    parser.add_argument("--output", type=Path)
    return parser.parse_args()


def required_env(name: str) -> str:
    value = os.environ.get(name, "").strip()
    if not value:
        raise RuntimeError(f"Missing required environment variable: {name}")
    return value


def json_default(value: Any) -> Any:
    if isinstance(value, (datetime, UUID, Decimal)):
        return str(value)
    raise TypeError(f"Unsupported JSON value: {type(value).__name__}")


def canonical_json(value: Any) -> str:
    return json.dumps(value, default=json_default, ensure_ascii=False, sort_keys=True, separators=(",", ":"))


def sha256_json(value: Any) -> str:
    return hashlib.sha256(canonical_json(value).encode("utf-8")).hexdigest()


def query_rows(
    database: Any, statement: str, parameters: tuple[Any, ...] = ()
) -> list[dict[str, Any]]:
    with database.cursor(cursor_factory=RealDictCursor) as cursor:
        cursor.execute(statement, parameters)
        return [dict(row) for row in cursor.fetchall()]


def get_revision(database: Any) -> dict[str, Any]:
    rows = query_rows(
        database,
        """
        select id, document_code, revision_label, status, source_sha256
        from public.fmds_corpus_revisions
        where id = %s
        """,
        (REVISION_ID,),
    )
    if len(rows) != 1:
        raise RuntimeError(f"Expected revision {REVISION_ID}; found {len(rows)}")
    revision = rows[0]
    actual = (
        str(revision["id"]),
        revision["document_code"],
        revision["revision_label"],
        revision["source_sha256"],
    )
    expected = (REVISION_ID, DOCUMENT_CODE, REVISION_LABEL, SOURCE_SHA256)
    if actual != expected:
        raise RuntimeError(f"FMDS revision identity mismatch: expected {expected}, found {actual}")
    if revision["status"] != "staging":
        raise RuntimeError(
            f"FMDS review ledger requires staging revision; found {revision['status']}"
        )
    return revision


def get_live_events(database: Any) -> list[dict[str, Any]]:
    return query_rows(
        database,
        """
        select
          e.id as event_id,
          e.created_at,
          e.decision,
          e.reviewer_id,
          e.reviewer_role,
          e.notes,
          e.evidence_paths,
          e.candidate_ids::text[] as candidate_ids,
          t.id as source_id,
          t.table_identifier as identifier,
          t.title,
          t.page_start as page_number,
          t.review_status,
          t.evidence_image_path,
          t.source_sha256
        from public.fmds_visual_review_events e
        join public.fmds_tables t on t.id = e.source_id
        where e.revision_id = %s
          and e.source_type = 'table'
          and e.reviewer_id = %s
        order by t.page_start, t.table_identifier, e.created_at
        """,
        (REVISION_ID, REVIEWER_ID),
    )


def candidate_snapshot(database: Any, candidate_id: Any) -> dict[str, Any]:
    rows = query_rows(
        database,
        """
        select id, revision_id, source_type, source_id, candidate_kind,
          provider, model, prompt_version, input_sha256, output, confidence,
          status, extraction_error, created_at
        from public.fmds_visual_review_candidates
        where id = %s
        """,
        (candidate_id,),
    )
    if len(rows) != 1:
        raise RuntimeError(f"Review candidate {candidate_id} is missing")
    return rows[0]


def build_entry(database: Any, event: dict[str, Any]) -> dict[str, Any]:
    candidates = [candidate_snapshot(database, value) for value in event["candidate_ids"]]
    entry = {
        **event,
        "candidates": candidates,
    }
    entry["decision_fingerprint"] = sha256_json(
        {
            "revision_id": REVISION_ID,
            "source_id": event["source_id"],
            "decision": event["decision"],
            "reviewer_id": event["reviewer_id"],
            "reviewer_role": event["reviewer_role"],
            "notes": event["notes"],
            "evidence_paths": event["evidence_paths"],
            "candidate_ids": event["candidate_ids"],
            "candidate_snapshots": candidates,
        }
    )
    return entry


def build_live_ledger(database: Any) -> dict[str, Any]:
    revision = get_revision(database)
    entries = [build_entry(database, event) for event in get_live_events(database)]
    ledger = {
        "schema_version": "fmds-table-review-ledger.1",
        "exported_at": datetime.now(timezone.utc).isoformat(),
        "revision": revision,
        "reviewer_id": REVIEWER_ID,
        "entries": entries,
    }
    ledger["ledger_sha256"] = sha256_json(entries)
    return ledger


def validate_entry(entry: dict[str, Any]) -> None:
    candidate_ids = [str(value) for value in entry.get("candidate_ids") or []]
    candidates = entry.get("candidates") or []
    if len(candidate_ids) != 1 or len(candidates) != 1:
        raise RuntimeError(
            f"Table {entry.get('identifier')} must reference exactly one candidate"
        )
    candidate = candidates[0]
    if str(candidate.get("id")) != candidate_ids[0]:
        raise RuntimeError(f"Table {entry['identifier']} candidate snapshot does not match event")
    if (
        str(candidate.get("revision_id")) != REVISION_ID
        or candidate.get("source_type") != "table"
        or str(candidate.get("source_id")) != str(entry.get("source_id"))
    ):
        raise RuntimeError(f"Table {entry['identifier']} candidate belongs to another source")
    if entry.get("evidence_image_path") not in (entry.get("evidence_paths") or []):
        raise RuntimeError(f"Table {entry['identifier']} event omits authoritative evidence")
    if entry.get("source_sha256") != SOURCE_SHA256:
        raise RuntimeError(f"Table {entry['identifier']} source hash is not FMDS0834 April 2026")

    decision = entry.get("decision")
    expected_status = "reviewed" if decision == "approved" else "needs_review"
    if entry.get("review_status") != expected_status:
        raise RuntimeError(
            f"Table {entry['identifier']} status {entry.get('review_status')} does not match {decision}"
        )
    if decision == "approved":
        output = candidate.get("output") or {}
        proposal = output.get("review_proposal") if isinstance(output, dict) else None
        if not isinstance(proposal, dict) or proposal.get("kind") != "table_transcription":
            raise RuntimeError(f"Approved table {entry['identifier']} lacks a table transcription")
        if not proposal.get("columns") or not proposal.get("rows"):
            raise RuntimeError(f"Approved table {entry['identifier']} transcription is empty")

    expected_fingerprint = sha256_json(
        {
            "revision_id": REVISION_ID,
            "source_id": entry["source_id"],
            "decision": entry["decision"],
            "reviewer_id": entry["reviewer_id"],
            "reviewer_role": entry["reviewer_role"],
            "notes": entry["notes"],
            "evidence_paths": entry["evidence_paths"],
            "candidate_ids": entry["candidate_ids"],
            "candidate_snapshots": candidates,
        }
    )
    if entry.get("decision_fingerprint") != expected_fingerprint:
        raise RuntimeError(f"Table {entry['identifier']} decision fingerprint changed")


def validate_ledger(database: Any, ledger: dict[str, Any]) -> dict[str, Any]:
    get_revision(database)
    if ledger.get("schema_version") != "fmds-table-review-ledger.1":
        raise RuntimeError("Unsupported FMDS table review ledger schema")
    revision = ledger.get("revision") or {}
    if str(revision.get("id")) != REVISION_ID or revision.get("source_sha256") != SOURCE_SHA256:
        raise RuntimeError("Ledger is not locked to FMDS0834 April 2026")
    entries = ledger.get("entries") or []
    for entry in entries:
        validate_entry(entry)
    counts: dict[str, int] = {}
    for entry in entries:
        counts[entry["decision"]] = counts.get(entry["decision"], 0) + 1
    if counts != EXPECTED_REVIEW_COUNTS:
        raise RuntimeError(f"Decision coverage mismatch: expected {EXPECTED_REVIEW_COUNTS}, found {counts}")
    if ledger.get("ledger_sha256") != sha256_json(entries):
        raise RuntimeError("Ledger fingerprint changed")

    embedded = query_rows(
        database,
        """
        select count(distinct source_id)::integer as source_count,
          count(*)::integer as chunk_count
        from public.fmds_structured_chunks
        where revision_id = %s and source_type = 'table' and embedding is not null
        """,
        (REVISION_ID,),
    )[0]
    reviewed_count = query_rows(
        database,
        "select count(*)::integer as count from public.fmds_tables where revision_id = %s and review_status = 'reviewed'",
        (REVISION_ID,),
    )[0]["count"]
    if embedded["source_count"] != reviewed_count:
        raise RuntimeError(
            f"Structured embedding gap: {embedded['source_count']}/{reviewed_count} reviewed tables"
        )
    active_candidate_coverage = query_rows(
        database,
        """
        select count(*)::integer as table_count,
          count(*) filter (where active_candidate_count = 1)::integer as exactly_one_active,
          count(*) filter (where active_candidate_count <> 1)::integer as invalid_active_count
        from (
          select t.id, count(c.id) as active_candidate_count
          from public.fmds_tables t
          left join public.fmds_visual_review_candidates c
            on c.source_type = 'table' and c.source_id = t.id and c.status = 'candidate'
          where t.revision_id = %s
          group by t.id
        ) scoped
        """,
        (REVISION_ID,),
    )[0]
    if active_candidate_coverage["invalid_active_count"] != 0:
        raise RuntimeError(
            "Every FMDS0834 table must have exactly one active review candidate; "
            f"found {active_candidate_coverage['invalid_active_count']} invalid source(s)"
        )
    active_candidate_inventory = query_rows(
        database,
        """
        select t.review_status, c.candidate_kind, c.provider, count(*)::integer as sources
        from public.fmds_tables t
        join public.fmds_visual_review_candidates c
          on c.source_type = 'table' and c.source_id = t.id and c.status = 'candidate'
        where t.revision_id = %s
        group by t.review_status, c.candidate_kind, c.provider
        order by t.review_status, c.candidate_kind, c.provider
        """,
        (REVISION_ID,),
    )
    if any(row["candidate_kind"] == "native_grid" for row in active_candidate_inventory):
        raise RuntimeError("Malformed native-grid candidates remain active in FMDS0834")
    return {
        "valid": True,
        "entry_count": len(entries),
        "decision_counts": counts,
        "reviewed_table_count": reviewed_count,
        "embedded_table_source_count": embedded["source_count"],
        "embedded_table_chunk_count": embedded["chunk_count"],
        "active_candidate_coverage": active_candidate_coverage,
        "active_candidate_inventory": active_candidate_inventory,
        "ledger_sha256": ledger["ledger_sha256"],
    }


def matching_event_exists(database: Any, entry: dict[str, Any]) -> bool:
    rows = query_rows(
        database,
        """
        select id from public.fmds_visual_review_events
        where revision_id = %s and source_type = 'table' and source_id = %s
          and decision = %s and reviewer_id = %s and reviewer_role = %s
          and notes = %s and evidence_paths = %s::text[] and candidate_ids = %s::uuid[]
        limit 1
        """,
        (
            REVISION_ID,
            entry["source_id"],
            entry["decision"],
            entry["reviewer_id"],
            entry["reviewer_role"],
            entry["notes"],
            entry["evidence_paths"],
            [str(value) for value in entry["candidate_ids"]],
        ),
    )
    return bool(rows)


def apply_ledger(database: Any, ledger: dict[str, Any]) -> dict[str, Any]:
    validation = validate_ledger(database, ledger)
    results = []
    for entry in ledger["entries"]:
        if matching_event_exists(database, entry):
            results.append({"source_id": entry["source_id"], "status": "already_applied"})
            continue
        latest = query_rows(
            database,
            """
            select id, reviewer_id, decision, created_at
            from public.fmds_visual_review_events
            where revision_id = %s and source_type = 'table' and source_id = %s
            order by created_at desc limit 1
            """,
            (REVISION_ID, entry["source_id"]),
        )
        if latest:
            raise RuntimeError(
                f"Table {entry['identifier']} has a different existing review event; refusing replay"
            )
        with database.cursor() as cursor:
            cursor.execute(
                """
                select public.record_fmds_visual_review(
                  %s::text, %s::uuid, %s::text, %s::text, %s::text, %s::text,
                  %s::text[], %s::uuid[]
                )
                """,
                (
                    "table",
                    entry["source_id"],
                    entry["decision"],
                    entry["reviewer_id"],
                    entry["reviewer_role"],
                    entry["notes"],
                    entry["evidence_paths"],
                    [str(value) for value in entry["candidate_ids"]],
                ),
            )
            event_id = cursor.fetchone()[0]
        results.append({"source_id": entry["source_id"], "status": "applied", "event_id": event_id})
    database.commit()
    return {**validation, "results": results}


def write_result(result: Any, output: Path | None) -> None:
    rendered = json.dumps(result, default=json_default, ensure_ascii=False, indent=2)
    if output:
        output.parent.mkdir(parents=True, exist_ok=True)
        output.write_text(rendered + "\n", encoding="utf-8")
    else:
        print(rendered)


def main() -> int:
    args = arguments()
    database = psycopg2.connect(required_env("SUPABASE_ASRS_DATABASE_URL"))
    try:
        if args.validate_ledger or args.apply_ledger:
            path = args.validate_ledger or args.apply_ledger
            assert path is not None
            ledger = json.loads(path.read_text(encoding="utf-8"))
        else:
            ledger = build_live_ledger(database)

        if args.apply_ledger:
            result = apply_ledger(database, ledger)
        elif args.validate_ledger or args.validate_live:
            result = validate_ledger(database, ledger)
        else:
            result = ledger
        write_result(result, args.output)
    finally:
        database.close()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
