#!/usr/bin/env python3
"""Embed human-approved FMDS table and figure structures for revision-scoped RAG.

The command is dry-run by default. It never approves a source, activates a
revision, changes native PDF chunks, or embeds an extraction that lacks an exact
approved review event and candidate ID.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import psycopg2
from psycopg2 import sql
from psycopg2.extras import RealDictCursor

from fmds_embedding_utils import batches, embedding_client, required_env, split_long_text


DOCUMENT_CODE = "FMDS0834"
REVISION_LABEL = "2026-04"
CANONICAL_EMBEDDING_MODEL = "text-embedding-3-large"
EMBEDDING_DIMENSIONS = 3072
MAX_CHUNK_CHARS = 2_400
EMBEDDING_BATCH_SIZE = 16


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--apply", action="store_true", help="Write and embed eligible chunks")
    parser.add_argument("--output", type=Path, help="Optional JSON report path")
    parser.add_argument("--identifier", help="Limit to one table or figure identifier")
    parser.add_argument("--embedding-batch-size", type=int, default=EMBEDDING_BATCH_SIZE)
    return parser.parse_args()


def sha256_text(value: str) -> str:
    return hashlib.sha256(value.encode("utf-8")).hexdigest()


def normalize_text(value: Any) -> str:
    if value is None:
        return ""
    if isinstance(value, (str, int, float, bool)):
        return str(value).strip()
    return json.dumps(value, ensure_ascii=False, sort_keys=True)


def source_identity(source_type: str, source: dict[str, Any]) -> tuple[str, int]:
    if source_type == "table":
        return str(source["table_identifier"]), int(source["page_start"])
    if source_type == "figure":
        return str(source["figure_identifier"]), int(source["page_number"])
    raise ValueError(f"Unsupported FMDS structured source type: {source_type}")


def require_approved_inputs(
    source_type: str,
    source: dict[str, Any],
    event: dict[str, Any],
    candidate: dict[str, Any],
) -> None:
    identifier, _ = source_identity(source_type, source)
    if source.get("review_status") != "reviewed":
        raise ValueError(f"FMDS {source_type} {identifier} is not reviewed")
    if event.get("decision") != "approved":
        raise ValueError(f"FMDS {source_type} {identifier} has no approved review event")
    candidate_ids = event.get("candidate_ids") or []
    if len(candidate_ids) != 1:
        raise ValueError(
            f"FMDS {source_type} {identifier} must have exactly one approved candidate; "
            f"found {len(candidate_ids)}"
        )
    if candidate.get("id") != candidate_ids[0]:
        raise ValueError(
            f"FMDS {source_type} {identifier} candidate does not match its approval event"
        )
    if candidate.get("source_type") != source_type or candidate.get("source_id") != source.get("id"):
        raise ValueError(
            f"FMDS {source_type} {identifier} approved candidate belongs to another source"
        )


def serialize_table(
    source: dict[str, Any], event: dict[str, Any], output: dict[str, Any]
) -> str:
    identifier = str(source["table_identifier"])
    proposal = output.get("review_proposal")
    if not isinstance(proposal, dict) or proposal.get("kind") != "table_transcription":
        raise ValueError(f"FMDS table {identifier} approved candidate has no table transcription")
    columns = proposal.get("columns")
    rows = proposal.get("rows")
    if not isinstance(columns, list) or not columns or not isinstance(rows, list) or not rows:
        raise ValueError(f"FMDS table {identifier} approved transcription has no columns or rows")

    lines = [
        f"FMDS 8-34 April 2026 Table {identifier}",
        f"Title: {normalize_text(source.get('title')) or 'Untitled table'}",
        f"PDF page: {source['page_start']}",
        "Review status: human approved",
        "Columns: " + " | ".join(normalize_text(column) for column in columns),
    ]
    for index, row in enumerate(rows, start=1):
        if not isinstance(row, list):
            raise ValueError(f"FMDS table {identifier} row {index} is not an array")
        values = [normalize_text(value) for value in row]
        labelled = [
            f"{normalize_text(columns[column_index])}: {value}"
            for column_index, value in enumerate(values)
            if column_index < len(columns)
        ]
        lines.append(f"Row {index}: " + " | ".join(labelled))
    lines.append(f"Human review notes: {normalize_text(event.get('notes'))}")
    native_text = normalize_text(output.get("region_native_text"))
    if native_text:
        lines.extend(["Authoritative source context:", native_text])
    return "\n".join(lines).strip()


def serialize_figure(
    source: dict[str, Any], event: dict[str, Any], output: dict[str, Any]
) -> str:
    return "\n\n".join(serialize_figure_sections(source, output))


def list_lines(label: str, values: list[Any]) -> str:
    if not values:
        return ""
    return label + ":\n" + "\n".join(f"- {normalize_text(value)}" for value in values)


def source_classification(identifier: str) -> dict[str, str]:
    """Add deterministic family metadata for otherwise near-identical diagrams."""
    families = [
        ("2.2.3", "horizontal-loading shuttle ASRS", "closed-top combustible containers or storage on trays"),
        ("2.2.4", "horizontal-loading shuttle ASRS", "open-top combustible containers"),
        ("2.2.6", "horizontal-loading mini-load ASRS", "closed-top combustible containers or storage on trays"),
        ("2.2.7", "horizontal-loading mini-load ASRS", "open-top combustible containers"),
        ("2.2.1", "horizontal-loading ASRS", "general construction, flue-space, and vertical-barrier guidance"),
        ("2.3", "top-loading ASRS", "top-loading storage arrangements"),
        ("2.4", "vertically enclosed ASRS", "vertically enclosed storage arrangements"),
        ("2.2", "horizontal-loading ASRS", "horizontal-loading navigation"),
        ("1.2", "all ASRS arrangements", "document-scope navigation"),
    ]
    arrangement = "ASRS storage arrangement"
    context = "FMDS0834 protection guidance"
    for prefix, candidate_arrangement, candidate_context in families:
        if identifier == prefix or identifier.startswith(prefix + "."):
            arrangement = candidate_arrangement
            context = candidate_context
            break
    if identifier.endswith(".1.1") and identifier.startswith(("2.2.3", "2.2.4", "2.2.6", "2.2.7")):
        workflow = "ceiling-only sprinkler protection option decision"
    elif identifier.endswith(".2.2.1"):
        workflow = "select the protection table for acceptable vertical in-rack sprinkler locations and designs"
    elif ".2.1(" in identifier:
        workflow = "horizontal in-rack automatic sprinkler arrangement diagram"
    elif identifier in {"2.2.3", "2.2.4", "2.2.6", "2.2.7", "2.3"}:
        workflow = "section navigation flowchart"
    else:
        workflow = "engineering figure evidence"
    return {"arrangement": arrangement, "context": context, "workflow": workflow}


def serialize_figure_sections(
    source: dict[str, Any], output: dict[str, Any]
) -> list[str]:
    identifier = str(source["figure_identifier"])
    proposal = output.get("review_proposal")
    if not isinstance(proposal, dict) or proposal.get("kind") != "figure_fact_review":
        raise ValueError(f"FMDS figure {identifier} approved candidate has no figure facts")
    facts = proposal.get("facts")
    if not isinstance(facts, list) or not facts:
        raise ValueError(f"FMDS figure {identifier} approved candidate has no facts")
    structured = proposal.get("structured_figure")
    if not isinstance(structured, dict):
        raise ValueError(f"FMDS figure {identifier} approved candidate has no structured figure")
    classification = source_classification(identifier)
    header = "\n".join([
        f"FMDS 8-34 April 2026 Figure {identifier}",
        f"Title: {normalize_text(source.get('title')) or 'Untitled figure'}",
        f"PDF page: {source['page_number']}",
        f"Applicable arrangement: {classification['arrangement']}",
        f"Storage context: {classification['context']}",
        f"Figure workflow: {classification['workflow']}",
        "Review status: Codex source-image approved",
    ])
    measurements = [
        f"{normalize_text(item.get('text'))}; applies to {normalize_text(item.get('applies_to'))}"
        for item in structured.get("measurements") or []
        if isinstance(item, dict)
    ]
    decisions = []
    for node in structured.get("decision_nodes") or []:
        if not isinstance(node, dict):
            continue
        outcomes = "; ".join(
            f"{normalize_text(outcome.get('label'))} -> {normalize_text(outcome.get('target'))}"
            for outcome in node.get("outcomes") or []
            if isinstance(outcome, dict)
        )
        decisions.append(
            f"{normalize_text(node.get('id'))}: {normalize_text(node.get('text'))}; {outcomes}"
        )
    relationships = [
        f"{normalize_text(item.get('from'))} {normalize_text(item.get('relation'))} "
        f"{normalize_text(item.get('to'))}: {normalize_text(item.get('label'))}"
        for item in structured.get("relationships") or []
        if isinstance(item, dict)
    ]
    entities = [
        f"{normalize_text(item.get('id'))}: {normalize_text(item.get('label'))}; "
        f"{normalize_text(item.get('attributes'))}"
        for item in structured.get("entities") or []
        if isinstance(item, dict)
    ]
    return [
        header,
        f"Figure type: {normalize_text(structured.get('figure_type'))}",
        f"Summary: {normalize_text(structured.get('summary'))}",
        list_lines("Approved figure facts", facts),
        list_lines("Exact measurements and limits", measurements),
        list_lines("Decision nodes and outcomes", decisions),
        list_lines("Visible relationships and connectors", relationships),
        list_lines("Visible entities", entities),
        list_lines("Visible labels", structured.get("labels") or []),
        list_lines("Exact references", structured.get("references") or []),
        list_lines("Interpretation limits", structured.get("ambiguities") or []),
    ]


def split_figure_sections(sections: list[str]) -> list[str]:
    header = sections[0]
    chunks: list[str] = []
    current = header
    for section in [value for value in sections[1:] if value.strip()]:
        proposed = current + "\n\n" + section
        if len(proposed) <= MAX_CHUNK_CHARS:
            current = proposed
            continue
        if current != header:
            chunks.append(current)
            current = header
        for paragraph in section.split("\n"):
            proposed = current + "\n" + paragraph
            if len(proposed) <= MAX_CHUNK_CHARS:
                current = proposed
                continue
            if current != header:
                chunks.append(current)
            room = MAX_CHUNK_CHARS - len(header) - 2
            for start in range(0, len(paragraph), room):
                piece = paragraph[start:start + room]
                if start + room < len(paragraph):
                    chunks.append(header + "\n" + piece)
                else:
                    current = header + "\n" + piece
    if current != header:
        chunks.append(current)
    if not chunks or any(len(chunk) > MAX_CHUNK_CHARS for chunk in chunks):
        raise RuntimeError("Structured figure chunk splitter violated the content contract")
    return chunks


def split_structured_content(content: str, prefix: str) -> list[str]:
    pieces = split_long_text(content, MAX_CHUNK_CHARS)
    if len(pieces) == 1:
        return pieces
    return [piece if piece.startswith(prefix) else f"{prefix}\n{piece}" for piece in pieces]


def build_chunk_rows(
    revision: dict[str, Any],
    source_type: str,
    source: dict[str, Any],
    event: dict[str, Any],
    candidate: dict[str, Any],
) -> list[dict[str, Any]]:
    require_approved_inputs(source_type, source, event, candidate)
    identifier, page_number = source_identity(source_type, source)
    output = candidate.get("output")
    if not isinstance(output, dict):
        raise ValueError(f"FMDS {source_type} {identifier} approved candidate output is invalid")
    prefix = f"FMDS 8-34 April 2026 {source_type.title()} {identifier}"
    if source_type == "table":
        chunks = split_structured_content(serialize_table(source, event, output), prefix)
    else:
        chunks = split_figure_sections(serialize_figure_sections(source, output))
    citation_label = (
        f"FMDS0834 ({revision['revision_label']}), {source_type.title()} "
        f"{identifier}, PDF page {page_number}"
    )
    return [
        {
            "source_type": source_type,
            "source_id": source["id"],
            "page_number": page_number,
            "source_identifier": identifier,
            "title": normalize_text(source.get("title")),
            "review_event_id": event["id"],
            "candidate_id": candidate["id"],
            "chunk_index": index,
            "content": chunk,
            "content_sha256": sha256_text(chunk),
            "citation_label": citation_label,
        }
        for index, chunk in enumerate(chunks)
    ]


def query_rows(database: Any, statement: str, parameters: tuple[Any, ...] = ()) -> list[dict[str, Any]]:
    with database.cursor(cursor_factory=RealDictCursor) as cursor:
        cursor.execute(statement, parameters)
        return [dict(row) for row in cursor.fetchall()]


def query_scalar(database: Any, statement: str, parameters: tuple[Any, ...] = ()) -> Any:
    with database.cursor() as cursor:
        cursor.execute(statement, parameters)
        row = cursor.fetchone()
        return row[0] if row else None


def get_revision(database: Any) -> dict[str, Any]:
    rows = query_rows(
        database,
        """
        select * from public.fmds_corpus_revisions
        where document_code = %s and revision_label = %s
        """,
        (DOCUMENT_CODE, REVISION_LABEL),
    )
    if len(rows) != 1:
        raise RuntimeError(f"Expected one {DOCUMENT_CODE} {REVISION_LABEL} revision, found {len(rows)}")
    revision = rows[0]
    if revision["status"] != "staging":
        raise RuntimeError(f"Structured embedding requires staging revision, found {revision['status']}")
    return revision


def get_reviewed_sources(database: Any, revision_id: str) -> list[tuple[str, dict[str, Any]]]:
    tables = query_rows(
        database,
        "select * from public.fmds_tables where revision_id = %s and review_status = 'reviewed'",
        (revision_id,),
    )
    figures = query_rows(
        database,
        "select * from public.fmds_figures where revision_id = %s and review_status = 'reviewed'",
        (revision_id,),
    )
    return [("table", row) for row in tables] + [("figure", row) for row in figures]


def get_approval_and_candidate(
    database: Any, source_type: str, source_id: str
) -> tuple[dict[str, Any], dict[str, Any]]:
    events = query_rows(
        database,
        """
        select *,
          cardinality(candidate_ids) as candidate_count,
          candidate_ids[1]::text as approved_candidate_id
        from public.fmds_visual_review_events
        where source_type = %s and source_id = %s and decision = 'approved'
        order by created_at desc, id desc
        limit 1
        """,
        (source_type, source_id),
    )
    if len(events) != 1:
        raise RuntimeError(f"Reviewed FMDS {source_type} {source_id} has no approved event")
    event = events[0]
    candidate_count = int(event.get("candidate_count") or 0)
    approved_candidate_id = event.get("approved_candidate_id")
    if candidate_count != 1 or not approved_candidate_id:
        raise RuntimeError(
            f"Reviewed FMDS {source_type} {source_id} has {candidate_count} approved candidates; expected 1"
        )
    candidates = query_rows(
        database,
        "select * from public.fmds_visual_review_candidates where id = %s",
        (approved_candidate_id,),
    )
    if len(candidates) != 1:
        raise RuntimeError(f"Approved FMDS candidate {approved_candidate_id} is missing")
    event["candidate_ids"] = [approved_candidate_id]
    return event, candidates[0]


def exact_count(database: Any, table: str, **equals: str) -> int:
    conditions = [sql.SQL("{} = %s").format(sql.Identifier(key)) for key in equals]
    statement = sql.SQL("select count(*) from public.{} where ").format(sql.Identifier(table))
    statement += sql.SQL(" and ").join(conditions)
    with database.cursor() as cursor:
        cursor.execute(statement, tuple(equals.values()))
        return int(cursor.fetchone()[0])


def native_baseline(database: Any, revision_id: str) -> dict[str, int]:
    return {
        "chunks": exact_count(database, "fmds_chunks", revision_id=revision_id),
        "embedded": exact_count(
            database,
            "fmds_chunks",
            revision_id=revision_id,
            embedding_status="embedded",
        ),
    }


def embed_pending(database: Any, revision_id: str, batch_size: int) -> int:
    pending = query_rows(
        database,
        """
        select id, content from public.fmds_structured_chunks
        where revision_id = %s and embedding_status <> 'embedded'
        order by source_type, source_identifier, chunk_index
        """,
        (revision_id,),
    )
    if not pending:
        return 0
    openai_client, provider_model, _provider = embedding_client()
    completed = 0
    for batch in batches(pending, batch_size):
        last_error: Exception | None = None
        for attempt in range(1, 4):
            try:
                response = openai_client.embeddings.create(
                    model=provider_model,
                    input=[row["content"] for row in batch],
                    dimensions=EMBEDDING_DIMENSIONS,
                )
                vectors = [item.embedding for item in response.data]
                if len(vectors) != len(batch):
                    raise RuntimeError(
                        f"Embedding provider returned {len(vectors)} vectors for {len(batch)} structured chunks"
                    )
                payload = []
                for row, vector in zip(batch, vectors):
                    if len(vector) != EMBEDDING_DIMENSIONS:
                        raise RuntimeError(
                            f"Structured chunk {row['id']} returned {len(vector)} dimensions, expected 3072"
                        )
                    payload.append(
                        {
                            "id": row["id"],
                            "embedding": "[" + ",".join(f"{value:.8g}" for value in vector) + "]",
                        }
                    )
                changed = query_scalar(
                    database,
                    "select public.store_fmds_structured_chunk_embeddings(%s, %s::jsonb, %s)",
                    (revision_id, json.dumps(payload), CANONICAL_EMBEDDING_MODEL),
                )
                if int(changed) != len(batch):
                    raise RuntimeError(
                        f"Structured embedding writer changed {changed} rows, expected {len(batch)}"
                    )
                completed += len(batch)
                break
            except Exception as error:  # provider errors are retried and then surfaced
                last_error = error
                if attempt < 3:
                    time.sleep(attempt * 2)
        else:
            message = str(last_error)[:1000] if last_error else "Unknown embedding failure"
            with database.cursor() as cursor:
                cursor.executemany(
                    """
                    update public.fmds_structured_chunks
                    set embedding_status = 'failed', embedding_error = %s
                    where id = %s
                    """,
                    [(message, row["id"]) for row in batch],
                )
            raise RuntimeError(f"Structured embedding batch failed: {message}")
    return completed


def main() -> int:
    args = parse_args()
    database = psycopg2.connect(required_env("SUPABASE_ASRS_DATABASE_URL"))
    database.autocommit = True
    revision = get_revision(database)
    revision["id"] = str(revision["id"])
    baseline_before = native_baseline(database, revision["id"])
    rows: list[dict[str, Any]] = []
    eligible_sources: list[dict[str, Any]] = []
    for source_type, source in get_reviewed_sources(database, revision["id"]):
        source["id"] = str(source["id"])
        identifier, _page = source_identity(source_type, source)
        if args.identifier and identifier != args.identifier:
            continue
        event, candidate = get_approval_and_candidate(database, source_type, source["id"])
        event["id"] = str(event["id"])
        candidate["id"] = str(candidate["id"])
        candidate["source_id"] = str(candidate["source_id"])
        source_rows = build_chunk_rows(revision, source_type, source, event, candidate)
        rows.extend(source_rows)
        eligible_sources.append(
            {
                "source_type": source_type,
                "source_id": source["id"],
                "identifier": identifier,
                "review_event_id": event["id"],
                "candidate_id": candidate["id"],
                "chunks": len(source_rows),
            }
        )

    inserted = 0
    embedded = 0
    coverage = None
    if args.apply:
        inserted = int(
            query_scalar(
                database,
                "select public.insert_fmds_structured_chunks(%s, %s::jsonb)",
                (revision["id"], json.dumps(rows)),
            )
        )
        embedded = embed_pending(database, revision["id"], args.embedding_batch_size)
        coverage_rows = query_rows(
            database,
            "select * from public.fmds_structured_embedding_coverage where revision_id = %s",
            (revision["id"],),
        )
        if len(coverage_rows) != 1:
            raise RuntimeError("Structured embedding coverage row is missing")
        coverage = coverage_rows[0]
        if coverage["missing_reviewed_table_count"] or coverage["missing_reviewed_figure_count"]:
            raise RuntimeError(f"Reviewed structured embedding coverage is incomplete: {coverage}")

    baseline_after = native_baseline(database, revision["id"])
    if baseline_after != baseline_before:
        raise RuntimeError(
            f"Native FMDS chunk coverage changed during structured embedding: {baseline_before} -> {baseline_after}"
        )

    report = {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "mode": "apply" if args.apply else "dry_run",
        "document_code": DOCUMENT_CODE,
        "revision_label": REVISION_LABEL,
        "revision_id": revision["id"],
        "revision_status": revision["status"],
        "eligible_sources": eligible_sources,
        "eligible_source_count": len(eligible_sources),
        "serialized_chunk_count": len(rows),
        "inserted_chunk_count": inserted,
        "embedded_chunk_count": embedded,
        "structured_coverage": coverage,
        "native_baseline_before": baseline_before,
        "native_baseline_after": baseline_after,
        "native_chunks_unchanged": baseline_before == baseline_after,
        "embedding_contract": {
            "model": CANONICAL_EMBEDDING_MODEL,
            "dimensions": EMBEDDING_DIMENSIONS,
        },
    }
    rendered = json.dumps(report, indent=2)
    if args.output:
        args.output.parent.mkdir(parents=True, exist_ok=True)
        args.output.write_text(rendered + "\n", encoding="utf-8")
    print(rendered)
    database.close()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())