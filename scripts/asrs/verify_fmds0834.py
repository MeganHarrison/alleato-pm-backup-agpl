#!/usr/bin/env python3
"""Verify the staged FMDS 8-34 2026 corpus without activating it."""

from __future__ import annotations

import argparse
import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from openai import OpenAI
import psycopg2
from psycopg2 import sql
from psycopg2.extras import RealDictCursor

from fmds_corpus_config import FMDS0834_2026_04, FmdsCorpusConfig, load_config
from fmds_embedding_utils import embedding_client, required_env


ACTIVE_CONFIG: FmdsCorpusConfig = FMDS0834_2026_04
DOCUMENT_CODE = ACTIVE_CONFIG.document_code
REVISION_LABEL = ACTIVE_CONFIG.revision_label
BUCKET = "fmds-source-evidence"
EMBEDDING_DIMENSIONS = 3072


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", type=Path)
    parser.add_argument("--document-config", default="fmds0834-2026-04")
    return parser.parse_args()


def query_rows(database: Any, statement: str, parameters: tuple[Any, ...] = ()) -> list[dict[str, Any]]:
    with database.cursor(cursor_factory=RealDictCursor) as cursor:
        cursor.execute(statement, parameters)
        return [dict(row) for row in cursor.fetchall()]


def query_scalar(database: Any, statement: str, parameters: tuple[Any, ...] = ()) -> Any:
    with database.cursor() as cursor:
        cursor.execute(statement, parameters)
        row = cursor.fetchone()
        return row[0] if row else None


def exact_count(
    database: Any,
    table: str,
    equals: dict[str, Any] | None = None,
    not_null: tuple[str, ...] = (),
) -> int:
    filters = [
        sql.SQL("{} = %s").format(sql.Identifier(column))
        for column in (equals or {})
    ]
    filters.extend(
        sql.SQL("{} is not null").format(sql.Identifier(column)) for column in not_null
    )
    statement = sql.SQL("select count(*) from public.{}").format(sql.Identifier(table))
    if filters:
        statement += sql.SQL(" where ") + sql.SQL(" and ").join(filters)
    with database.cursor() as cursor:
        cursor.execute(statement, tuple((equals or {}).values()))
        return int(cursor.fetchone()[0])


def verify_retrieval(
    database: Any,
    openai_client: OpenAI,
    model: str,
    revision_id: str,
) -> list[dict[str, Any]]:
    checks: list[dict[str, Any]] = []
    for query in ACTIVE_CONFIG.representative_queries:
        response = openai_client.embeddings.create(
            model=model,
            input=[query],
            dimensions=EMBEDDING_DIMENSIONS,
        )
        vector = response.data[0].embedding
        if len(vector) != EMBEDDING_DIMENSIONS:
            raise RuntimeError(
                f"Retrieval query embedding returned {len(vector)} dimensions; expected 3072"
            )
        encoded = "[" + ",".join(f"{value:.8g}" for value in vector) + "]"
        staged = query_rows(
            database,
            "select * from public.match_staging_fmds_chunks(%s, %s::public.halfvec, 5, 0.0)",
            (revision_id, encoded),
        )
        if not staged:
            raise RuntimeError(f"Staging retrieval returned no evidence for: {query}")
        if any(str(row["revision_id"]) != revision_id for row in staged):
            raise RuntimeError(f"Staging retrieval mixed revisions for: {query}")
        active = query_rows(
            database,
            "select * from public.match_active_fmds_chunks(%s::public.halfvec, 5, 0.0)",
            (encoded,),
        )
        if active:
            raise RuntimeError(
                "Active retrieval exposed FMDS chunks while the only canonical revision is staging"
            )
        checks.append(
            {
                "query": query,
                "staging_result_count": len(staged),
                "top_citations": [row["citation_label"] for row in staged[:3]],
                "structured_result_count": sum(
                    1 for row in staged if row["source_type"] in ("table", "figure")
                ),
                "active_result_count": 0,
            }
        )
    structured_expectations = [
        (
            "standard-coverage 12 sprinklers 250 gpm 60 minute water supply",
            "table",
            "2.1.4.5.4",
        ),
        (
            "gross transverse flue space horizontal distance between containers or trays",
            "figure",
            "2.2.1.4.1.1",
        ),
        (
            "exactly 1.5 inch transverse flue space qualifies",
            "figure",
            "2.2.1.4.2.1",
        ),
    ]
    for query, expected_source_type, expected_identifier in structured_expectations:
        response = openai_client.embeddings.create(
            model=model,
            input=[query],
            dimensions=EMBEDDING_DIMENSIONS,
        )
        vector = response.data[0].embedding
        encoded = "[" + ",".join(f"{value:.8g}" for value in vector) + "]"
        staged = query_rows(
            database,
            "select * from public.match_staging_fmds_chunks(%s, %s::public.halfvec, 12, 0.0)",
            (revision_id, encoded),
        )
        exact_matches = [
            row
            for row in staged
            if row["source_type"] == expected_source_type
            and row["source_identifier"] == expected_identifier
        ]
        if not exact_matches:
            raise RuntimeError(
                f"Structured retrieval did not return {expected_source_type} {expected_identifier} for: {query}"
            )
        checks.append(
            {
                "query": query,
                "expected_source_type": expected_source_type,
                "expected_identifier": expected_identifier,
                "exact_source_match": True,
                "similarity": exact_matches[0]["similarity"],
                "citation": exact_matches[0]["citation_label"],
                "active_result_count": 0,
            }
        )
    return checks


def main() -> int:
    global ACTIVE_CONFIG, DOCUMENT_CODE, REVISION_LABEL
    args = parse_args()
    config = load_config(args.document_config)
    ACTIVE_CONFIG = config
    DOCUMENT_CODE = config.document_code
    REVISION_LABEL = config.revision_label
    database = psycopg2.connect(
        required_env("SUPABASE_ASRS_DATABASE_URL")
    )
    database.autocommit = True
    revisions = query_rows(
        database,
        """
        select * from public.fmds_corpus_revisions
        where document_code = %s and revision_label = %s
        """,
        (DOCUMENT_CODE, REVISION_LABEL),
    )
    if len(revisions) != 1:
        raise RuntimeError(f"Expected one {REVISION_LABEL} revision, found {len(revisions)}")
    revision = revisions[0]
    revision["id"] = str(revision["id"])
    if revision["status"] != "staging":
        raise RuntimeError(f"Expected staging revision, found {revision['status']}")

    coverage_rows = query_rows(
        database,
        "select * from public.fmds_revision_coverage where revision_id = %s",
        (revision["id"],),
    )
    if len(coverage_rows) != 1:
        raise RuntimeError("FMDS revision coverage row is missing")
    coverage = coverage_rows[0]
    coverage["revision_id"] = str(coverage["revision_id"])
    structured_coverage_rows = query_rows(
        database,
        "select * from public.fmds_structured_embedding_coverage where revision_id = %s",
        (revision["id"],),
    )
    if len(structured_coverage_rows) != 1:
        raise RuntimeError("FMDS structured embedding coverage row is missing")
    structured_coverage = structured_coverage_rows[0]
    structured_coverage["revision_id"] = str(structured_coverage["revision_id"])
    assertions = {
        "page_manifest_complete": coverage["page_count"] == ACTIVE_CONFIG.expected_page_count,
        "all_chunks_embedded": coverage["chunk_count"]
        == coverage["embedded_chunk_count"],
        "tables_inventoried": coverage["table_count"] > 0,
        "figures_inventoried": coverage["figure_count"] > 0,
        "revision_is_staging": coverage["status"] == "staging",
        "reviewed_tables_embedded": structured_coverage["missing_reviewed_table_count"] == 0,
        "reviewed_figures_embedded": structured_coverage["missing_reviewed_figure_count"] == 0,
    }
    failed = [name for name, passed in assertions.items() if not passed]
    if failed:
        raise RuntimeError(f"Coverage assertions failed: {', '.join(failed)}")

    rendered_page_count = exact_count(
        database,
        "fmds_pages",
        equals={"revision_id": revision["id"]},
        not_null=("rendered_image_path", "rendered_image_sha256"),
    )
    pending_table_reviews = exact_count(
        database,
        "fmds_tables",
        equals={"revision_id": revision["id"], "review_status": "needs_review"},
    )
    pending_figure_reviews = exact_count(
        database,
        "fmds_figures",
        equals={"revision_id": revision["id"], "review_status": "needs_review"},
    )
    if rendered_page_count != ACTIVE_CONFIG.expected_page_count:
        raise RuntimeError(
            "Rendered page evidence incomplete: "
            f"{rendered_page_count}/{ACTIVE_CONFIG.expected_page_count}"
        )
    if pending_table_reviews + coverage["reviewed_table_count"] != coverage["table_count"]:
        raise RuntimeError("FMDS table review-state coverage does not equal the table inventory")
    if pending_figure_reviews + coverage["reviewed_figure_count"] != coverage["figure_count"]:
        raise RuntimeError("FMDS figure review-state coverage does not equal the figure inventory")
    if structured_coverage["reviewed_table_count"] != coverage["reviewed_table_count"]:
        raise RuntimeError("FMDS reviewed table count differs from structured embedding coverage")
    if structured_coverage["reviewed_figure_count"] != coverage["reviewed_figure_count"]:
        raise RuntimeError("FMDS reviewed figure count differs from structured embedding coverage")

    source_path = revision["source_storage_path"]
    prefix = source_path.split("/source/", 1)[0]
    def storage_object_exists(path: str) -> bool:
        return bool(
            query_scalar(
                database,
                "select exists(select 1 from storage.objects where bucket_id = %s and name = %s)",
                (BUCKET, path),
            )
        )

    object_checks = {
        "source_pdf": storage_object_exists(source_path),
        "first_rendered_page": storage_object_exists(f"{prefix}/pages/page-001.png"),
        "last_rendered_page": storage_object_exists(
            f"{prefix}/pages/page-{ACTIVE_CONFIG.expected_page_count:03d}.png"
        ),
    }
    if not all(object_checks.values()):
        raise RuntimeError(f"Storage evidence missing: {object_checks}")

    legacy_chunk_count = exact_count(database, "fm_text_chunks")
    legacy_versions = [
        row["doc_version"]
        for row in query_rows(
            database,
            "select distinct doc_version from public.fm_text_chunks where doc_version is not null order by doc_version",
        )
    ]
    if legacy_chunk_count != 43 or legacy_versions != ["2024-07"]:
        raise RuntimeError(
            "Legacy FM corpus changed unexpectedly: "
            f"count={legacy_chunk_count}, versions={legacy_versions}"
        )

    openai_client, model, provider = embedding_client()
    retrieval = verify_retrieval(database, openai_client, model, revision["id"])
    activation_ready = (
        pending_table_reviews == 0
        and pending_figure_reviews == 0
        and structured_coverage["missing_reviewed_table_count"] == 0
        and structured_coverage["missing_reviewed_figure_count"] == 0
        and coverage["rule_card_count"] > 0
        and coverage["reviewed_rule_card_count"] == coverage["rule_card_count"]
    )
    activation_blockers = []
    if pending_table_reviews:
        activation_blockers.append(
            f"{pending_table_reviews} table occurrences require visual review"
        )
    if pending_figure_reviews:
        activation_blockers.append(
            f"{pending_figure_reviews} figure occurrences require visual review"
        )
    if coverage["reviewed_rule_card_count"] != coverage["rule_card_count"]:
        activation_blockers.append(
            f"{coverage['rule_card_count'] - coverage['reviewed_rule_card_count']} rule cards require review"
        )

    report = {
        "verified_at": datetime.now(timezone.utc).isoformat(),
        "document_code": DOCUMENT_CODE,
        "revision_label": REVISION_LABEL,
        "revision_id": revision["id"],
        "source_sha256": revision["source_sha256"],
        "coverage": coverage,
        "structured_embedding_coverage": structured_coverage,
        "rendered_page_count": rendered_page_count,
        "pending_table_reviews": pending_table_reviews,
        "pending_figure_reviews": pending_figure_reviews,
        "storage_objects": object_checks,
        "embedding_provider": provider,
        "embedding_contract": {
            "model": "text-embedding-3-large",
            "dimensions": EMBEDDING_DIMENSIONS,
        },
        "retrieval_checks": retrieval,
        "active_retrieval_excludes_staging": True,
        "legacy_corpus": {
            "fm_text_chunks": legacy_chunk_count,
            "document_versions": legacy_versions,
            "unchanged": True,
        },
        "activation_ready": activation_ready,
        "activation_blockers": activation_blockers,
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
