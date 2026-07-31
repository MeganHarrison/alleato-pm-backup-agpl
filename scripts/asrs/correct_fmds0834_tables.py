#!/usr/bin/env python3
"""Validate and transactionally apply source-locked FMDS0834 table corrections.

The command is read-only unless ``--apply-ledger`` is provided. Corrections
supersede the exact active candidate named in the ledger, create one manual
candidate, and record one attributed approval event. Replays are idempotent.
"""

from __future__ import annotations

import argparse
import copy
import hashlib
import json
import os
from datetime import date, datetime, timezone
from decimal import Decimal
from pathlib import Path
from typing import Any
from uuid import UUID

import psycopg2
from psycopg2.extras import Json, RealDictCursor


DOCUMENT_CODE = "FMDS0834"
REVISION_LABEL = "2026-04"
REVISION_ID = "65306e47-c25a-4397-92a0-c44c03903d0f"
SOURCE_SHA256 = "c6f78457ac452c1c4c95b8d195ab5f33a5a772a4ebaf7d0e5ff28c055d8411ed"
PROMPT_VERSION = "fmds-table-correction-2026-07-21.1"
ALLOWED_CELL_PATCH_FIELDS = {
    "text",
    "unit",
    "is_blank",
    "row_span",
    "column_span",
    "normalized_value",
}
ALLOWED_COLUMN_PATCH_FIELDS = {"label", "unit", "notes"}
ALLOWED_CELL_INSERTION_FIELDS = ALLOWED_CELL_PATCH_FIELDS | {"confidence"}
ALLOWED_ROW_INSERTION_FIELDS = {"kind", "cells", "row_index"}


def arguments() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    action = parser.add_mutually_exclusive_group(required=True)
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
    if isinstance(value, (date, datetime, Decimal, UUID)):
        return str(value)
    raise TypeError(type(value).__name__)


def canonical_json(value: Any) -> str:
    return json.dumps(
        value,
        default=json_default,
        ensure_ascii=False,
        sort_keys=True,
        separators=(",", ":"),
    )


def sha256_json(value: Any) -> str:
    return hashlib.sha256(canonical_json(value).encode("utf-8")).hexdigest()


def query_rows(
    database: Any, statement: str, parameters: tuple[Any, ...] = ()
) -> list[dict[str, Any]]:
    with database.cursor(cursor_factory=RealDictCursor) as cursor:
        cursor.execute(statement, parameters)
        return [dict(row) for row in cursor.fetchall()]


def get_revision(database: Any, *, lock: bool = False) -> dict[str, Any]:
    rows = query_rows(
        database,
        f"""
        select id, document_code, revision_label, status, source_sha256
        from public.fmds_corpus_revisions where id=%s
        {"for update" if lock else ""}
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
        revision["status"],
    )
    expected = (REVISION_ID, DOCUMENT_CODE, REVISION_LABEL, SOURCE_SHA256, "staging")
    if actual != expected:
        raise RuntimeError(
            f"FMDS revision identity mismatch: expected {expected}, found {actual}"
        )
    return revision


def body_proposal(structure: dict[str, Any], questions: list[str]) -> dict[str, Any]:
    columns = structure.get("columns")
    rows = structure.get("rows")
    if not isinstance(columns, list) or not columns or not isinstance(rows, list):
        raise RuntimeError("Corrected table candidate lacks source columns or rows")
    labels = [column.get("label") for column in columns]
    if any(not isinstance(label, str) or not label for label in labels):
        raise RuntimeError("Corrected table candidate has an invalid column label")
    body_rows: list[list[str]] = []
    for row in rows:
        if row.get("kind") != "body":
            continue
        cells = row.get("cells")
        if not isinstance(cells, list) or len(cells) != len(labels):
            raise RuntimeError("Corrected table candidate has an invalid body row")
        values = [cell.get("text") for cell in cells]
        if any(not isinstance(value, str) for value in values):
            raise RuntimeError("Corrected table candidate has a non-text cell")
        body_rows.append(values)
    if not body_rows:
        raise RuntimeError("Corrected table proposal cannot be empty")
    return {
        "kind": "table_transcription",
        "columns": labels,
        "rows": body_rows,
        "questions": questions,
    }


def build_corrected_output(
    source_output: dict[str, Any], entry: dict[str, Any]
) -> dict[str, Any]:
    corrected = copy.deepcopy(source_output)
    structure = corrected.get("extracted_structure")
    if not isinstance(structure, dict):
        raise RuntimeError(
            f"Table {entry['identifier']} source candidate lacks extracted_structure"
        )
    correction = entry.get("correction")
    if not isinstance(correction, dict):
        raise RuntimeError(f"Table {entry['identifier']} lacks a correction object")
    governing_text = correction.get("governing_text")
    if (
        not isinstance(governing_text, list)
        or not governing_text
        or any(
            not isinstance(value, str) or not value.strip() for value in governing_text
        )
    ):
        raise RuntimeError(f"Table {entry['identifier']} governing_text is invalid")
    structure["governing_text"] = governing_text
    source_title = correction.get("source_title")
    if source_title is not None:
        if not isinstance(source_title, str) or not source_title.strip():
            raise RuntimeError(f"Table {entry['identifier']} source_title is invalid")
        structure["title"] = source_title
    columns = structure.get("columns")
    if not isinstance(columns, list):
        raise RuntimeError(f"Table {entry['identifier']} source columns are invalid")
    for patch in correction.get("column_patches") or []:
        column_index = patch.get("column_index")
        if not isinstance(column_index, int):
            raise RuntimeError(
                f"Table {entry['identifier']} column patch lacks an integer index"
            )
        try:
            column = columns[column_index]
        except IndexError as error:
            raise RuntimeError(
                f"Table {entry['identifier']} column patch points outside the source grid"
            ) from error
        changes = patch.get("changes")
        if not isinstance(changes, dict) or not changes:
            raise RuntimeError(
                f"Table {entry['identifier']} column patch has no changes"
            )
        unsupported = set(changes) - ALLOWED_COLUMN_PATCH_FIELDS
        if unsupported:
            raise RuntimeError(
                f"Table {entry['identifier']} column patch has unsupported fields: {sorted(unsupported)}"
            )
        column.update(changes)
    rows = structure.get("rows")
    if not isinstance(rows, list):
        raise RuntimeError(f"Table {entry['identifier']} source rows are invalid")
    for insertion in correction.get("row_insertions") or []:
        row_index = insertion.get("row_index")
        row = insertion.get("row")
        if not isinstance(row_index, int) or row_index < 0 or row_index > len(rows):
            raise RuntimeError(
                f"Table {entry['identifier']} row insertion points outside the source grid"
            )
        if not isinstance(row, dict) or set(row) - ALLOWED_ROW_INSERTION_FIELDS:
            raise RuntimeError(
                f"Table {entry['identifier']} row insertion has invalid fields"
            )
        if row.get("kind") not in {"header", "body", "note", "footer"}:
            raise RuntimeError(
                f"Table {entry['identifier']} row insertion has an invalid kind"
            )
        cells = row.get("cells")
        if not isinstance(cells, list) or not cells:
            raise RuntimeError(
                f"Table {entry['identifier']} row insertion has no cells"
            )
        for cell in cells:
            if not isinstance(cell, dict) or not isinstance(cell.get("text"), str):
                raise RuntimeError(
                    f"Table {entry['identifier']} row insertion has an invalid cell"
                )
            unsupported = set(cell) - ALLOWED_CELL_INSERTION_FIELDS
            if unsupported:
                raise RuntimeError(
                    f"Table {entry['identifier']} row insertion cell has unsupported fields: {sorted(unsupported)}"
                )
            if not isinstance(cell.get("row_span", 1), int) or not isinstance(
                cell.get("column_span", 1), int
            ):
                raise RuntimeError(
                    f"Table {entry['identifier']} row insertion cell spans must be integers"
                )
        rows.insert(row_index, copy.deepcopy(row))
    for row_index, row in enumerate(rows):
        if isinstance(row, dict) and "row_index" in row:
            row["row_index"] = row_index
    cell_deletions = correction.get("cell_deletions") or []
    deletion_keys: list[tuple[int, int]] = []
    for deletion in cell_deletions:
        if not isinstance(deletion, dict) or set(deletion) != {
            "row_index",
            "cell_index",
        }:
            raise RuntimeError(
                f"Table {entry['identifier']} cell deletion is invalid"
            )
        row_index = deletion.get("row_index")
        cell_index = deletion.get("cell_index")
        if not isinstance(row_index, int) or not isinstance(cell_index, int):
            raise RuntimeError(
                f"Table {entry['identifier']} cell deletion lacks integer indexes"
            )
        deletion_keys.append((row_index, cell_index))
    if len(deletion_keys) != len(set(deletion_keys)):
        raise RuntimeError(
            f"Table {entry['identifier']} cell deletions contain duplicates"
        )
    for row_index, cell_index in sorted(deletion_keys, reverse=True):
        try:
            cells = rows[row_index]["cells"]
        except (IndexError, KeyError, TypeError) as error:
            raise RuntimeError(
                f"Table {entry['identifier']} cell deletion points outside the source grid"
            ) from error
        if not isinstance(cells, list) or cell_index < 0 or cell_index >= len(cells):
            raise RuntimeError(
                f"Table {entry['identifier']} cell deletion points outside the source row"
            )
        cells.pop(cell_index)
    for insertion in correction.get("cell_insertions") or []:
        row_index = insertion.get("row_index")
        cell_index = insertion.get("cell_index")
        if not isinstance(row_index, int) or not isinstance(cell_index, int):
            raise RuntimeError(
                f"Table {entry['identifier']} cell insertion lacks integer indexes"
            )
        try:
            cells = rows[row_index]["cells"]
        except (IndexError, KeyError, TypeError) as error:
            raise RuntimeError(
                f"Table {entry['identifier']} cell insertion points outside the source grid"
            ) from error
        if not isinstance(cells, list) or cell_index < 0 or cell_index > len(cells):
            raise RuntimeError(
                f"Table {entry['identifier']} cell insertion points outside the source row"
            )
        cell = insertion.get("cell")
        if not isinstance(cell, dict) or not isinstance(cell.get("text"), str):
            raise RuntimeError(
                f"Table {entry['identifier']} cell insertion is not a valid cell"
            )
        unsupported = set(cell) - ALLOWED_CELL_INSERTION_FIELDS
        if unsupported:
            raise RuntimeError(
                f"Table {entry['identifier']} cell insertion has unsupported fields: {sorted(unsupported)}"
            )
        if not isinstance(cell.get("row_span", 1), int) or not isinstance(
            cell.get("column_span", 1), int
        ):
            raise RuntimeError(
                f"Table {entry['identifier']} cell insertion spans must be integers"
            )
        cells.insert(cell_index, copy.deepcopy(cell))
    for patch in correction.get("cell_patches") or []:
        row_index = patch.get("row_index")
        cell_index = patch.get("cell_index")
        if not isinstance(row_index, int) or not isinstance(cell_index, int):
            raise RuntimeError(
                f"Table {entry['identifier']} cell patch lacks integer indexes"
            )
        try:
            cell = rows[row_index]["cells"][cell_index]
        except (IndexError, KeyError, TypeError) as error:
            raise RuntimeError(
                f"Table {entry['identifier']} cell patch points outside the source grid"
            ) from error
        changes = patch.get("changes")
        if not isinstance(changes, dict) or not changes:
            raise RuntimeError(f"Table {entry['identifier']} cell patch has no changes")
        unsupported = set(changes) - ALLOWED_CELL_PATCH_FIELDS
        if unsupported:
            raise RuntimeError(
                f"Table {entry['identifier']} cell patch has unsupported fields: {sorted(unsupported)}"
            )
        cell.update(changes)
    questions = correction.get("questions") or []
    if not isinstance(questions, list) or any(
        not isinstance(value, str) for value in questions
    ):
        raise RuntimeError(f"Table {entry['identifier']} questions are invalid")
    explicit_proposal = correction.get("review_proposal")
    proposal = explicit_proposal or body_proposal(structure, questions)
    if (
        proposal.get("kind") != "table_transcription"
        or not proposal.get("columns")
        or not proposal.get("rows")
    ):
        raise RuntimeError(f"Table {entry['identifier']} review proposal is invalid")
    fingerprint_input = {
        "revision_id": REVISION_ID,
        "source_id": entry["source_id"],
        "source_candidate_id": entry["source_candidate_id"],
        "source_candidate_output_sha256": entry["source_candidate_output_sha256"],
        "reviewed_at": entry["reviewed_at"],
        "notes": entry["notes"],
        "correction": correction,
    }
    review_fingerprint = sha256_json(fingerprint_input)
    corrected.update(
        {
            "candidate_only": True,
            "requires_visual_validation": False,
            "source_candidate_id": entry["source_candidate_id"],
            "source_candidate_output_sha256": entry["source_candidate_output_sha256"],
            "region_native_text": "\n".join(governing_text),
            "review_proposal": proposal,
            "review_fingerprint": review_fingerprint,
            "audit_override": {
                "reviewer": "Codex source-image correction",
                "reviewed_at": entry["reviewed_at"],
                "reason": entry["notes"],
            },
            "adjudication": {
                "exact_match": True,
                "completeness": "complete",
                "confidence": 1.0,
                "discrepancies": [],
                "visual_semantics_captured": True,
                "notes": entry["notes"],
            },
        }
    )
    verification = corrected.get("verification")
    if isinstance(verification, dict):
        verification.update(
            {
                "exact_match": True,
                "completeness": "complete",
                "confidence": 1.0,
                "discrepancies": [],
            }
        )
    return corrected


def source_state(database: Any, entry: dict[str, Any], *, lock: bool) -> dict[str, Any]:
    rows = query_rows(
        database,
        f"""
        select t.id::text as source_id, t.table_identifier, t.title as source_title, t.page_start,
          t.review_status, t.evidence_image_path, t.source_sha256,
          c.id::text as candidate_id, c.output as candidate_output,
          c.status as candidate_status, c.input_sha256 as candidate_input_sha256,
          latest.id::text as latest_event_id, latest.decision as latest_decision,
          latest.reviewer_id as latest_reviewer_id, latest.notes as latest_notes
        from public.fmds_tables t
        left join public.fmds_visual_review_candidates c
          on c.source_type='table' and c.source_id=t.id and c.status='candidate'
        left join lateral (
          select e.id,e.decision,e.reviewer_id,e.notes
          from public.fmds_visual_review_events e
          where e.revision_id=t.revision_id and e.source_type='table' and e.source_id=t.id
          order by e.created_at desc,e.id desc limit 1
        ) latest on true
        where t.revision_id=%s and t.id=%s
        {"for update of t" if lock else ""}
        """,
        (REVISION_ID, entry["source_id"]),
    )
    if len(rows) != 1:
        raise RuntimeError(
            f"Table {entry['identifier']} must have exactly one active candidate; found {len(rows)}"
        )
    return rows[0]


def validate_ledger_identity(ledger: dict[str, Any]) -> None:
    if ledger.get("schema_version") != "fmds-table-correction-ledger.1":
        raise RuntimeError("Unsupported FMDS table correction ledger schema")
    revision = ledger.get("revision") or {}
    actual = (
        revision.get("id"),
        revision.get("document_code"),
        revision.get("revision_label"),
        revision.get("source_sha256"),
    )
    expected = (REVISION_ID, DOCUMENT_CODE, REVISION_LABEL, SOURCE_SHA256)
    if actual != expected:
        raise RuntimeError(
            f"Correction ledger revision mismatch: expected {expected}, found {actual}"
        )
    reviewer = ledger.get("reviewer") or {}
    if not reviewer.get("id") or not reviewer.get("role"):
        raise RuntimeError("Correction ledger requires reviewer identity and role")
    entries = ledger.get("entries")
    if not isinstance(entries, list) or not entries:
        raise RuntimeError("Correction ledger has no entries")
    identities = [
        (entry.get("source_id"), entry.get("source_candidate_id")) for entry in entries
    ]
    if len(set(identities)) != len(identities):
        raise RuntimeError("Correction ledger contains duplicate source candidates")


def validate_entry(
    database: Any, ledger: dict[str, Any], entry: dict[str, Any], *, lock: bool
) -> dict[str, Any]:
    state = source_state(database, entry, lock=lock)
    correction = entry.get("correction") or {}
    expected_source_title = entry.get("expected_source_title")
    corrected_source_title = correction.get("source_title")
    valid_source_titles = {
        value
        for value in (expected_source_title, corrected_source_title)
        if isinstance(value, str)
    }
    if (
        state["source_id"] != entry.get("source_id")
        or state["table_identifier"] != entry.get("identifier")
        or state["page_start"] != entry.get("page_number")
        or state["evidence_image_path"] != entry.get("evidence_image_path")
        or state["source_sha256"] != SOURCE_SHA256
        or (valid_source_titles and state["source_title"] not in valid_source_titles)
    ):
        raise RuntimeError(f"Table {entry.get('identifier')} source identity changed")
    current_output = state.get("candidate_output") or {}
    desired_fingerprint = sha256_json(
        {
            "revision_id": REVISION_ID,
            "source_id": entry["source_id"],
            "source_candidate_id": entry["source_candidate_id"],
            "source_candidate_output_sha256": entry["source_candidate_output_sha256"],
            "reviewed_at": entry["reviewed_at"],
            "notes": entry["notes"],
            "correction": entry["correction"],
        }
    )
    if (
        current_output.get("review_fingerprint") == desired_fingerprint
        and state.get("latest_decision") == "approved"
        and state.get("latest_reviewer_id") == ledger["reviewer"]["id"]
    ):
        return {
            "status": "already_applied",
            "state": state,
            "review_fingerprint": desired_fingerprint,
        }
    if state.get("candidate_id") != entry.get("source_candidate_id"):
        raise RuntimeError(
            f"Table {entry['identifier']} active candidate changed: expected {entry['source_candidate_id']}, found {state.get('candidate_id')}"
        )
    if sha256_json(current_output) != entry.get("source_candidate_output_sha256"):
        raise RuntimeError(
            f"Table {entry['identifier']} source candidate output changed"
        )
    if state.get("latest_event_id") != entry.get(
        "expected_latest_event_id"
    ) or state.get("latest_decision") != entry.get("expected_latest_decision"):
        raise RuntimeError(
            f"Table {entry['identifier']} latest review decision changed"
        )
    if state.get("review_status") != "needs_review":
        raise RuntimeError(
            f"Table {entry['identifier']} is no longer pending correction"
        )
    corrected_output = build_corrected_output(current_output, entry)
    if corrected_output["review_fingerprint"] != desired_fingerprint:
        raise RuntimeError(
            f"Table {entry['identifier']} correction fingerprint is unstable"
        )
    return {
        "status": "ready",
        "state": state,
        "corrected_output": corrected_output,
        "review_fingerprint": desired_fingerprint,
    }


def apply_entry(
    database: Any, ledger: dict[str, Any], entry: dict[str, Any]
) -> dict[str, Any]:
    validation = validate_entry(database, ledger, entry, lock=True)
    if validation["status"] == "already_applied":
        return {
            "identifier": entry["identifier"],
            "page_number": entry["page_number"],
            "status": "already_applied",
            "candidate_id": validation["state"]["candidate_id"],
            "event_id": validation["state"]["latest_event_id"],
            "review_fingerprint": validation["review_fingerprint"],
        }
    corrected_output = validation["corrected_output"]
    correction_input_sha256 = sha256_json(
        {
            "source_candidate_id": entry["source_candidate_id"],
            "source_candidate_output_sha256": entry["source_candidate_output_sha256"],
            "review_fingerprint": validation["review_fingerprint"],
        }
    )
    with database.cursor() as cursor:
        corrected_source_title = entry["correction"].get("source_title")
        if corrected_source_title is not None:
            cursor.execute(
                """
                update public.fmds_tables
                set title=%s
                where id=%s and revision_id=%s and title=%s
                """,
                (
                    corrected_source_title,
                    entry["source_id"],
                    REVISION_ID,
                    entry.get("expected_source_title"),
                ),
            )
            if cursor.rowcount != 1:
                raise RuntimeError(
                    f"Table {entry['identifier']} source title was not corrected"
                )
        cursor.execute(
            """
            update public.fmds_visual_review_candidates
            set status='superseded'
            where id=%s and source_type='table' and source_id=%s and status='candidate'
            """,
            (entry["source_candidate_id"], entry["source_id"]),
        )
        if cursor.rowcount != 1:
            raise RuntimeError(
                f"Table {entry['identifier']} source candidate was not superseded"
            )
        cursor.execute(
            """
            insert into public.fmds_visual_review_candidates (
              revision_id,source_type,source_id,candidate_kind,provider,model,
              prompt_version,input_sha256,output,confidence,status
            ) values (%s,'table',%s,'manual_import','openai','gpt-5.4',%s,%s,%s,1.0,'candidate')
            returning id
            """,
            (
                REVISION_ID,
                entry["source_id"],
                PROMPT_VERSION,
                correction_input_sha256,
                Json(
                    corrected_output,
                    dumps=lambda value: json.dumps(value, ensure_ascii=False),
                ),
            ),
        )
        candidate_id = str(cursor.fetchone()[0])
        notes = (
            f"{entry['notes']} review_fingerprint={validation['review_fingerprint']}"
        )
        cursor.execute(
            """
            select public.record_fmds_visual_review(
              'table',%s,'approved',%s,%s,%s,%s::text[],%s::uuid[]
            )
            """,
            (
                entry["source_id"],
                ledger["reviewer"]["id"],
                ledger["reviewer"]["role"],
                notes,
                [entry["evidence_image_path"]],
                [candidate_id],
            ),
        )
        event_id = str(cursor.fetchone()[0])
    postflight = source_state(database, entry, lock=False)
    if (
        postflight["review_status"] != "reviewed"
        or postflight["candidate_id"] != candidate_id
        or postflight["latest_event_id"] != event_id
        or postflight["latest_decision"] != "approved"
        or (
            entry["correction"].get("source_title") is not None
            and postflight["source_title"] != entry["correction"]["source_title"]
        )
    ):
        raise RuntimeError(f"Table {entry['identifier']} postflight readback failed")
    return {
        "identifier": entry["identifier"],
        "page_number": entry["page_number"],
        "status": "applied",
        "source_candidate_id": entry["source_candidate_id"],
        "candidate_id": candidate_id,
        "event_id": event_id,
        "review_fingerprint": validation["review_fingerprint"],
    }


def coverage(database: Any) -> dict[str, Any]:
    return query_rows(
        database,
        """
        select count(*)::integer as total_tables,
          count(*) filter (where t.review_status='reviewed')::integer as reviewed,
          count(*) filter (where t.review_status='needs_review')::integer as needs_review,
          count(*) filter (where active_count=1)::integer as exactly_one_active_candidate,
          count(*) filter (where active_count<>1)::integer as invalid_active_candidate_count
        from public.fmds_tables t
        left join lateral (
          select count(*)::integer as active_count
          from public.fmds_visual_review_candidates c
          where c.source_type='table' and c.source_id=t.id and c.status='candidate'
        ) candidates on true
        where t.revision_id=%s
        """,
        (REVISION_ID,),
    )[0]


def main() -> int:
    options = arguments()
    ledger_path = options.validate_ledger or options.apply_ledger
    ledger = json.loads(ledger_path.read_text(encoding="utf-8"))
    validate_ledger_identity(ledger)
    apply = options.apply_ledger is not None
    with psycopg2.connect(required_env("SUPABASE_ASRS_DATABASE_URL")) as database:
        get_revision(database, lock=apply)
        if apply:
            results = [
                apply_entry(database, ledger, entry) for entry in ledger["entries"]
            ]
        else:
            results = []
            for entry in ledger["entries"]:
                validation = validate_entry(database, ledger, entry, lock=False)
                results.append(
                    {
                        "identifier": entry["identifier"],
                        "page_number": entry["page_number"],
                        "status": validation["status"],
                        "review_fingerprint": validation["review_fingerprint"],
                    }
                )
        report = {
            "schema_version": "fmds-table-correction-result.1",
            "generated_at": datetime.now(timezone.utc).isoformat(),
            "mode": "apply" if apply else "validate",
            "revision_id": REVISION_ID,
            "ledger_sha256": sha256_json(ledger),
            "results": results,
            "coverage": coverage(database),
        }
    rendered = (
        json.dumps(report, indent=2, default=json_default, ensure_ascii=False) + "\n"
    )
    if options.output:
        options.output.write_text(rendered, encoding="utf-8")
    print(rendered, end="")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
