#!/usr/bin/env python3
"""Validate or transactionally apply the approved FMDS0834 figure review ledger.

The workflow is locked to the April 2026 FMDS 8-34 revision and source hash.
It is read-only unless ``--apply-ledger`` is supplied. A successful apply:

* creates or reuses one fingerprint-validated vision candidate per real figure;
* supersedes every other active candidate for that figure;
* appends an attributed approval event using the authoritative page evidence;
* removes the single proven table-cell false positive after dependency checks;
* leaves native PDF chunks and the staging revision status unchanged.

The apply is one database transaction. Any mismatch rolls back every write.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import os
from datetime import datetime
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
EXPECTED_REAL_FIGURES = 60
EXPECTED_NATIVE_CHUNKS = 225
EXPECTED_NATIVE_EMBEDDED = 225
REVIEWER_ID = "codex-s212"
REVIEWER_ROLE = "independent_ai_vision_reviewer"
CANDIDATE_PROVIDER = "openai"
CANDIDATE_MODEL = "gpt-5.4-mini+gpt-5.4"
CANDIDATE_PROMPT_VERSION = "fmds0834-figure-review.2"
REVIEW_NOTES = (
    "Approved against the exact FMDS0834 April 2026 source image using a primary "
    "vision extraction, independent verifier, remediation, and final adjudication."
)
FALSE_POSITIVE = {
    "id": "2a151e37-d826-48cc-bc8d-a2e1df46869e",
    "identifier": "2.2.3.2.1(c)",
    "page_number": 43,
    "title": "Class 3 25 (7.6) 30 (9.1) 30 (115) 5.6 (80) 6 if one IRAS level or 10 (5 on top 2 levels)",
    "caption_text": "Figure 2.2.3.2.1(c). Class 3 25 (7.6) 30 (9.1) 30 (115) 5.6 (80) 6 if one IRAS level or 10 (5 on top 2 levels)",
}


def arguments() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    action = parser.add_mutually_exclusive_group(required=True)
    action.add_argument("--validate-ledger", type=Path)
    action.add_argument("--validate-live", type=Path)
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


def query_scalar(database: Any, statement: str, parameters: tuple[Any, ...] = ()) -> Any:
    with database.cursor() as cursor:
        cursor.execute(statement, parameters)
        row = cursor.fetchone()
        return row[0] if row else None


def get_revision(database: Any, *, lock: bool = False) -> dict[str, Any]:
    rows = query_rows(
        database,
        f"""
        select id, document_code, revision_label, status, source_sha256
        from public.fmds_corpus_revisions
        where id = %s
        {'for update' if lock else ''}
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
        raise RuntimeError(f"FMDS revision identity mismatch: expected {expected}, found {actual}")
    return revision


def validate_ledger(ledger: dict[str, Any]) -> dict[str, Any]:
    if ledger.get("schema_version") != "fmds0834-figure-review-ledger.1":
        raise RuntimeError("Unsupported FMDS0834 figure review ledger schema")
    if ledger.get("revision_id") != REVISION_ID or ledger.get("source_sha256") != SOURCE_SHA256:
        raise RuntimeError("Ledger is not locked to FMDS0834 April 2026")
    if ledger.get("figure_count") != EXPECTED_REAL_FIGURES or ledger.get("approved_count") != EXPECTED_REAL_FIGURES:
        raise RuntimeError("Ledger must contain exactly 60 approved real figures")
    if ledger.get("title_corrections"):
        raise RuntimeError("Unexpected figure title correction; stored captions must remain source-authentic")
    review_completed_at = ledger.get("review_completed_at")
    if not review_completed_at:
        raise RuntimeError("Ledger is missing its review completion timestamp")
    datetime.fromisoformat(review_completed_at)

    entries = ledger.get("entries") or []
    if len(entries) != EXPECTED_REAL_FIGURES:
        raise RuntimeError(f"Expected 60 ledger entries; found {len(entries)}")
    if len({entry.get("source_id") for entry in entries}) != EXPECTED_REAL_FIGURES:
        raise RuntimeError("Ledger source IDs are not unique")
    identities = {
        (entry.get("identifier"), entry.get("page_number")) for entry in entries
    }
    if len(identities) != EXPECTED_REAL_FIGURES:
        raise RuntimeError("Ledger figure/page identities are not unique")
    if FALSE_POSITIVE["id"] in {entry.get("source_id") for entry in entries}:
        raise RuntimeError("Proven page-43 table-cell false positive is present in the review ledger")

    for entry in entries:
        output = entry.get("candidate_output")
        if not isinstance(output, dict):
            raise RuntimeError(f"Figure {entry.get('identifier')} has invalid candidate output")
        proposal = output.get("review_proposal")
        structured = proposal.get("structured_figure") if isinstance(proposal, dict) else None
        if (
            proposal.get("kind") != "figure_fact_review"
            or not proposal.get("facts")
            or not isinstance(structured, dict)
            or not structured.get("summary")
            or not structured.get("figure_type")
        ):
            raise RuntimeError(f"Figure {entry.get('identifier')} has incomplete approved facts")
        if output.get("figure_identifier") != entry.get("identifier"):
            raise RuntimeError(f"Figure {entry.get('identifier')} output identifier changed")
        if output.get("page_number") != entry.get("page_number"):
            raise RuntimeError(f"Figure {entry.get('identifier')} output page changed")
        if output.get("source_sha256") != SOURCE_SHA256:
            raise RuntimeError(f"Figure {entry.get('identifier')} output source hash changed")
        if output.get("prompt_version") != CANDIDATE_PROMPT_VERSION:
            raise RuntimeError(f"Figure {entry.get('identifier')} prompt version changed")
        if entry.get("candidate_fingerprint") != sha256_json(output):
            raise RuntimeError(f"Figure {entry.get('identifier')} candidate fingerprint changed")
        if entry.get("stored_title") != entry.get("approved_title") or entry.get("title_changed"):
            raise RuntimeError(f"Figure {entry.get('identifier')} title does not match the source caption")
        if entry.get("prior_review_status") not in {"needs_review", "reviewed"}:
            raise RuntimeError(f"Figure {entry.get('identifier')} has an invalid prior status")
    if ledger.get("ledger_sha256") != sha256_json(entries):
        raise RuntimeError("Review ledger entry fingerprint changed")
    return {
        "valid": True,
        "figure_count": len(entries),
        "approved_count": len(entries),
        "ledger_sha256": ledger["ledger_sha256"],
        "review_completed_at": review_completed_at,
    }


def native_baseline(database: Any) -> dict[str, int]:
    rows = query_rows(
        database,
        """
        select count(*)::integer as chunks,
          count(*) filter (where embedding_status = 'embedded')::integer as embedded
        from public.fmds_chunks where revision_id = %s
        """,
        (REVISION_ID,),
    )[0]
    baseline = {"chunks": rows["chunks"], "embedded": rows["embedded"]}
    expected = {"chunks": EXPECTED_NATIVE_CHUNKS, "embedded": EXPECTED_NATIVE_EMBEDDED}
    if baseline != expected:
        raise RuntimeError(f"Native FMDS chunk baseline changed: expected {expected}, found {baseline}")
    return baseline


def source_rows(database: Any, *, lock: bool = False) -> dict[str, dict[str, Any]]:
    rows = query_rows(
        database,
        f"""
        select id::text, figure_identifier, title, page_number, caption_text,
          evidence_image_path, source_sha256, review_status, updated_at
        from public.fmds_figures
        where revision_id = %s
        order by page_number, figure_identifier
        {'for update' if lock else ''}
        """,
        (REVISION_ID,),
    )
    return {row["id"]: row for row in rows}


def validate_false_positive(database: Any, rows: dict[str, dict[str, Any]]) -> str:
    row = rows.get(FALSE_POSITIVE["id"])
    if row is None:
        return "absent"
    expected = (
        FALSE_POSITIVE["identifier"],
        FALSE_POSITIVE["title"],
        FALSE_POSITIVE["page_number"],
        FALSE_POSITIVE["caption_text"],
        SOURCE_SHA256,
        "needs_review",
    )
    actual = (
        row["figure_identifier"],
        row["title"],
        row["page_number"],
        row["caption_text"],
        row["source_sha256"],
        row["review_status"],
    )
    if actual != expected:
        raise RuntimeError(f"Page-43 false-positive identity changed: expected {expected}, found {actual}")
    dependencies = query_rows(
        database,
        """
        select
          (select count(*) from public.fmds_visual_review_candidates where source_type='figure' and source_id=%s)::integer as candidates,
          (select count(*) from public.fmds_visual_review_events where source_type='figure' and source_id=%s)::integer as events,
          (select count(*) from public.fmds_structured_chunks where source_type='figure' and source_id=%s)::integer as chunks
        """,
        (FALSE_POSITIVE["id"], FALSE_POSITIVE["id"], FALSE_POSITIVE["id"]),
    )[0]
    if dependencies["events"] or dependencies["chunks"]:
        raise RuntimeError(f"Page-43 false positive gained immutable dependencies: {dependencies}")
    return "present"


def exact_latest_approval(database: Any, source_id: str) -> dict[str, Any] | None:
    rows = query_rows(
        database,
        """
        select id::text, decision, reviewer_id, reviewer_role, notes,
          evidence_paths, candidate_ids::text[] as candidate_ids, created_at
        from public.fmds_visual_review_events
        where revision_id=%s and source_type='figure' and source_id=%s
        order by created_at desc, id desc limit 1
        """,
        (REVISION_ID, source_id),
    )
    return rows[0] if rows else None


def validate_live(database: Any, ledger: dict[str, Any], *, require_applied: bool) -> dict[str, Any]:
    ledger_result = validate_ledger(ledger)
    get_revision(database)
    baseline = native_baseline(database)
    rows = source_rows(database)
    false_state = validate_false_positive(database, rows)
    real_ids = {entry["source_id"] for entry in ledger["entries"]}
    unexpected = set(rows) - real_ids - {FALSE_POSITIVE["id"]}
    missing = real_ids - set(rows)
    if unexpected or missing:
        raise RuntimeError(
            f"FMDS0834 figure inventory changed; unexpected={sorted(unexpected)}, missing={sorted(missing)}"
        )

    exact_approvals = 0
    active_candidate_counts: dict[int, int] = {}
    for entry in ledger["entries"]:
        source = rows[entry["source_id"]]
        identity = (
            source["figure_identifier"], source["title"], source["page_number"], source["source_sha256"]
        )
        expected = (
            entry["identifier"], entry["stored_title"], entry["page_number"], SOURCE_SHA256
        )
        if identity != expected:
            raise RuntimeError(f"Figure {entry['identifier']} live identity changed: {identity}")
        active = int(
            query_scalar(
                database,
                """
                select count(*) from public.fmds_visual_review_candidates
                where revision_id=%s and source_type='figure' and source_id=%s and status='candidate'
                """,
                (REVISION_ID, entry["source_id"]),
            )
        )
        active_candidate_counts[active] = active_candidate_counts.get(active, 0) + 1
        latest = exact_latest_approval(database, entry["source_id"])
        if (
            latest
            and latest["decision"] == "approved"
            and latest["reviewer_id"] == REVIEWER_ID
            and latest["reviewer_role"] == REVIEWER_ROLE
            and latest["notes"] == REVIEW_NOTES
            and len(latest["candidate_ids"] or []) == 1
        ):
            candidate = query_rows(
                database,
                "select output, status from public.fmds_visual_review_candidates where id=%s",
                (latest["candidate_ids"][0],),
            )
            if (
                len(candidate) == 1
                and candidate[0]["status"] == "candidate"
                and sha256_json(candidate[0]["output"]) == entry["candidate_fingerprint"]
                and source["evidence_image_path"] in (latest["evidence_paths"] or [])
            ):
                exact_approvals += 1
    if require_applied:
        if false_state != "absent":
            raise RuntimeError("Proven page-43 false-positive row still exists")
        if len(rows) != EXPECTED_REAL_FIGURES:
            raise RuntimeError(f"Expected 60 figures after apply; found {len(rows)}")
        if exact_approvals != EXPECTED_REAL_FIGURES:
            raise RuntimeError(f"Exact latest approval coverage is {exact_approvals}/60")
        if active_candidate_counts != {1: EXPECTED_REAL_FIGURES}:
            raise RuntimeError(f"Active candidate coverage is invalid: {active_candidate_counts}")
        statuses = {row["review_status"] for row in rows.values()}
        if statuses != {"reviewed"}:
            raise RuntimeError(f"Not all real figures are reviewed: {statuses}")
    return {
        **ledger_result,
        "live_figure_count": len(rows),
        "false_positive_state": false_state,
        "exact_latest_approval_count": exact_approvals,
        "active_candidate_distribution": active_candidate_counts,
        "native_baseline": baseline,
        "revision_status": "staging",
    }


def create_or_reuse_candidate(database: Any, entry: dict[str, Any]) -> str:
    structured = entry["candidate_output"]["review_proposal"]["structured_figure"]
    confidence = structured.get("confidence")
    with database.cursor() as cursor:
        cursor.execute(
            """
            insert into public.fmds_visual_review_candidates (
              revision_id, source_type, source_id, candidate_kind, provider,
              model, prompt_version, input_sha256, output, confidence, status
            ) values (%s, 'figure', %s, 'vision', %s, %s, %s, %s, %s, %s, 'candidate')
            on conflict (
              source_type, source_id, candidate_kind, provider, model, prompt_version, input_sha256
            ) do nothing
            returning id::text
            """,
            (
                REVISION_ID,
                entry["source_id"],
                CANDIDATE_PROVIDER,
                CANDIDATE_MODEL,
                CANDIDATE_PROMPT_VERSION,
                entry["input_sha256"],
                Json(entry["candidate_output"]),
                confidence,
            ),
        )
        row = cursor.fetchone()
    if row:
        candidate_id = row[0]
    else:
        candidates = query_rows(
            database,
            """
            select id::text, revision_id::text, source_type, source_id::text,
              output, status
            from public.fmds_visual_review_candidates
            where source_type='figure' and source_id=%s and candidate_kind='vision'
              and provider=%s and model=%s and prompt_version=%s and input_sha256=%s
            """,
            (
                entry["source_id"],
                CANDIDATE_PROVIDER,
                CANDIDATE_MODEL,
                CANDIDATE_PROMPT_VERSION,
                entry["input_sha256"],
            ),
        )
        if len(candidates) != 1:
            raise RuntimeError(f"Figure {entry['identifier']} exact candidate lookup failed")
        candidate = candidates[0]
        if (
            candidate["revision_id"] != REVISION_ID
            or candidate["source_type"] != "figure"
            or candidate["source_id"] != entry["source_id"]
            or sha256_json(candidate["output"]) != entry["candidate_fingerprint"]
        ):
            raise RuntimeError(f"Figure {entry['identifier']} existing candidate differs from the ledger")
        if candidate["status"] == "rejected":
            raise RuntimeError(
                f"Figure {entry['identifier']} exact candidate was explicitly rejected; refusing reactivation"
            )
        candidate_id = candidate["id"]

    with database.cursor() as cursor:
        cursor.execute(
            """
            update public.fmds_visual_review_candidates
            set status = case when id=%s then 'candidate' else 'superseded' end
            where revision_id=%s and source_type='figure' and source_id=%s
              and status in ('candidate', 'superseded')
            """,
            (candidate_id, REVISION_ID, entry["source_id"]),
        )
    return candidate_id


def apply_ledger(database: Any, ledger: dict[str, Any]) -> dict[str, Any]:
    validate_ledger(ledger)
    query_scalar(database, "select pg_advisory_xact_lock(hashtext(%s))", ("AAI-1235",))
    get_revision(database, lock=True)
    baseline_before = native_baseline(database)
    rows = source_rows(database, lock=True)
    false_state = validate_false_positive(database, rows)

    own_events = int(
        query_scalar(
            database,
            """
            select count(*) from public.fmds_visual_review_events
            where revision_id=%s and source_type='figure' and reviewer_id=%s
            """,
            (REVISION_ID, REVIEWER_ID),
        )
    )
    if own_events == 0:
        if false_state != "present" or len(rows) != EXPECTED_REAL_FIGURES + 1:
            raise RuntimeError("Refusing first apply because the pre-review figure inventory changed")
        newer_events = int(
            query_scalar(
                database,
                """
                select count(*) from public.fmds_visual_review_events
                where revision_id=%s and source_type='figure' and created_at > %s::timestamptz
                """,
                (REVISION_ID, ledger["review_completed_at"]),
            )
        )
        if newer_events:
            raise RuntimeError(
                f"{newer_events} figure review event(s) were created after the review ledger completed"
            )
        for entry in ledger["entries"]:
            source = rows.get(entry["source_id"])
            if source is None or source["review_status"] != entry["prior_review_status"]:
                raise RuntimeError(f"Figure {entry['identifier']} status changed after visual review")
    elif own_events != EXPECTED_REAL_FIGURES:
        raise RuntimeError(f"Partial prior AAI-1235 apply detected: {own_events}/60 events")

    results = []
    for entry in ledger["entries"]:
        source = rows.get(entry["source_id"])
        if source is None:
            raise RuntimeError(f"Figure {entry['identifier']} is missing")
        identity = (
            source["figure_identifier"], source["title"], source["page_number"], source["source_sha256"]
        )
        expected = (
            entry["identifier"], entry["stored_title"], entry["page_number"], SOURCE_SHA256
        )
        if identity != expected:
            raise RuntimeError(f"Figure {entry['identifier']} live identity changed: {identity}")
        evidence_path = source["evidence_image_path"]
        if not evidence_path:
            raise RuntimeError(f"Figure {entry['identifier']} has no authoritative page evidence")
        candidate_id = create_or_reuse_candidate(database, entry)
        latest = exact_latest_approval(database, entry["source_id"])
        if (
            latest
            and latest["decision"] == "approved"
            and latest["reviewer_id"] == REVIEWER_ID
            and latest["reviewer_role"] == REVIEWER_ROLE
            and latest["notes"] == REVIEW_NOTES
            and latest["evidence_paths"] == [evidence_path]
            and latest["candidate_ids"] == [candidate_id]
        ):
            results.append({"source_id": entry["source_id"], "identifier": entry["identifier"], "status": "already_applied"})
            continue
        with database.cursor() as cursor:
            cursor.execute(
                """
                select public.record_fmds_visual_review(
                  'figure', %s::uuid, 'approved', %s, %s, %s, %s::text[], %s::uuid[]
                )::text
                """,
                (
                    entry["source_id"],
                    REVIEWER_ID,
                    REVIEWER_ROLE,
                    REVIEW_NOTES,
                    [evidence_path],
                    [candidate_id],
                ),
            )
            event_id = cursor.fetchone()[0]
        results.append(
            {
                "source_id": entry["source_id"],
                "identifier": entry["identifier"],
                "status": "applied",
                "candidate_id": candidate_id,
                "event_id": event_id,
            }
        )

    if false_state == "present":
        with database.cursor() as cursor:
            cursor.execute(
                "delete from public.fmds_visual_review_candidates where source_type='figure' and source_id=%s",
                (FALSE_POSITIVE["id"],),
            )
            deleted_candidates = cursor.rowcount
            cursor.execute(
                "delete from public.fmds_figures where id=%s and revision_id=%s",
                (FALSE_POSITIVE["id"], REVISION_ID),
            )
            if cursor.rowcount != 1:
                raise RuntimeError("Proven page-43 false-positive delete did not affect exactly one row")
    else:
        deleted_candidates = 0

    baseline_after = native_baseline(database)
    if baseline_after != baseline_before:
        raise RuntimeError(f"Native FMDS chunks changed: {baseline_before} -> {baseline_after}")
    # Assert the complete target state before the single transaction commits.
    precommit = validate_live(database, ledger, require_applied=True)
    database.commit()
    # Read the committed state back through the same connection as proof that
    # the transaction is visible after commit, not only inside its snapshot.
    postflight = validate_live(database, ledger, require_applied=True)
    return {
        **postflight,
        "precommit_validation": precommit,
        "applied_count": sum(item["status"] == "applied" for item in results),
        "already_applied_count": sum(item["status"] == "already_applied" for item in results),
        "false_positive_deleted": false_state == "present",
        "false_positive_candidate_rows_deleted": deleted_candidates,
        "results": results,
    }


def write_result(result: Any, output: Path | None) -> None:
    rendered = json.dumps(result, default=json_default, ensure_ascii=False, indent=2)
    if output:
        output.parent.mkdir(parents=True, exist_ok=True)
        output.write_text(rendered + "\n", encoding="utf-8")
    print(rendered)


def main() -> int:
    args = arguments()
    path = args.validate_ledger or args.validate_live or args.apply_ledger
    assert path is not None
    ledger = json.loads(path.read_text(encoding="utf-8"))
    if args.validate_ledger:
        result = validate_ledger(ledger)
    else:
        database = psycopg2.connect(required_env("SUPABASE_ASRS_DATABASE_URL"))
        try:
            if args.apply_ledger:
                result = apply_ledger(database, ledger)
            else:
                result = validate_live(database, ledger, require_applied=False)
        except Exception:
            database.rollback()
            raise
        finally:
            database.close()
    write_result(result, args.output)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())