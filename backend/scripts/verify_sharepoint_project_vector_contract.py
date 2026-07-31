#!/usr/bin/env python3
"""Verify governed SharePoint project scopes through searchable vector chunks."""

from __future__ import annotations

import argparse
from collections import Counter
import hashlib
import json
import os
from pathlib import Path
import re
import sys
from typing import Any
from urllib.parse import unquote

from dotenv import load_dotenv


BACKEND_ROOT = Path(__file__).resolve().parents[1]
REPO_ROOT = BACKEND_ROOT.parent
sys.path.insert(0, str(BACKEND_ROOT))

from src.services.integrations.microsoft_graph.client import get_graph_client
from src.services.integrations.microsoft_graph.sharepoint_scopes import (
    discover_sharepoint_project_scopes,
)
from src.services.supabase_helpers import (
    get_rag_read_client,
    get_supabase_client,
)


TERMINAL_EXCLUSIONS = {
    "intentionally_excluded",
    "graph_content_empty",
    "graph_content_missing",
    "metadata_only",
    "no_chunks",
    "not_vectorizable",
    "ocr_failed",
    "skipped",
    "skipped_low_content",
}


def _paged(
    client: Any,
    table: str,
    columns: str,
    *,
    source_system: str,
    limit: int = 50000,
) -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    for offset in range(0, limit, 1000):
        page = (
            client.table(table)
            .select(columns)
            .eq("source_system", source_system)
            .range(offset, offset + 999)
            .execute()
        ).data or []
        rows.extend(dict(row) for row in page)
        if len(page) < 1000:
            return rows
    raise RuntimeError(
        f"{table} exceeded the {limit}-row governed verifier limit"
    )


def _id_hash(values: set[str]) -> str:
    return hashlib.sha256("|".join(sorted(values)).encode()).hexdigest()[:24]


def _is_project_path(
    row: dict[str, Any],
    active_scope_paths: set[str],
) -> bool:
    metadata = (
        row.get("source_metadata")
        if isinstance(row.get("source_metadata"), dict)
        else {}
    )
    candidates = (
        row.get("source_path"),
        row.get("source_web_url"),
        metadata.get("source_folder"),
        metadata.get("source_path"),
        metadata.get("source_web_url"),
        metadata.get("web_url"),
    )
    decoded_candidates = [
        unquote(str(value or "")).rstrip("/") for value in candidates
    ]
    return any(
        re.search(r"/20\d{2} Jobs(?:/|$)", candidate)
        for candidate in decoded_candidates
    ) or any(
        scope_path == candidate
        or f"{scope_path}/" in f"{candidate}/"
        for scope_path in active_scope_paths
        for candidate in decoded_candidates
    )


def verify(*, allow_bootstrap_pending: bool) -> tuple[dict[str, Any], list[str]]:
    graph = get_graph_client()
    if not graph.is_configured():
        raise RuntimeError("Microsoft Graph credentials are not configured")
    discovery = discover_sharepoint_project_scopes(graph)
    resource_ids = [scope.resource_id for scope in discovery.scopes]
    active_scope_paths = {
        scope.folder_path.rstrip("/") for scope in discovery.scopes
    }

    rag = get_rag_read_client()
    app = get_supabase_client()
    state_rows: list[dict[str, Any]] = []
    for start in range(0, len(resource_ids), 100):
        state_rows.extend(
            (
                rag.table("graph_sync_state")
                .select(
                    "resource_id,resource_name,delta_token,last_sync_at,"
                    "sync_status,error_message,items_synced"
                )
                .eq("source", "sharepoint_file")
                .in_("resource_id", resource_ids[start : start + 100])
                .execute()
            ).data
            or []
        )
    states = {
        str(row.get("resource_id")): row
        for row in state_rows
        if row.get("resource_id")
    }
    missing_state = sorted(set(resource_ids) - set(states))
    missing_cursor = sorted(
        resource_id
        for resource_id in resource_ids
        if not str((states.get(resource_id) or {}).get("delta_token") or "")
    )
    failed_scopes = sorted(
        resource_id
        for resource_id in resource_ids
        if str((states.get(resource_id) or {}).get("sync_status") or "")
        in {"error", "warning"}
    )

    app_rows = _paged(
        app,
        "document_metadata",
        (
            "id,source_item_id,status,source_etag,source_path,"
            "source_web_url,source_metadata,deleted_at"
        ),
        source_system="sharepoint",
    )
    app_rows = [
        row
        for row in app_rows
        if not row.get("deleted_at")
        and _is_project_path(row, active_scope_paths)
    ]
    rag_rows = _paged(
        rag,
        "rag_document_metadata",
        "id,source_item_id,embedding_status,parsing_status,source_metadata",
        source_system="sharepoint",
    )
    app_by_id = {
        str(row["id"]): row for row in app_rows if row.get("id")
    }
    rag_by_id = {
        str(row["id"]): row
        for row in rag_rows
        if row.get("id")
        and (
            str(row["id"]) in app_by_id
            or _is_project_path(row, active_scope_paths)
        )
    }
    terminal_ids = {
        row_id
        for row_id, row in app_by_id.items()
        if str(row.get("status") or "").lower() in TERMINAL_EXCLUSIONS
    }
    required_ids = set(app_by_id) - terminal_ids

    chunked_ids: set[str] = set()
    ordered_app_ids = sorted(app_by_id)
    for start in range(0, len(ordered_app_ids), 100):
        batch = ordered_app_ids[start : start + 100]
        offset = 0
        while True:
            page = (
                rag.table("document_chunks")
                .select("document_id")
                .in_("document_id", batch)
                .range(offset, offset + 999)
                .execute()
            ).data or []
            chunked_ids.update(
                str(row.get("document_id"))
                for row in page
                if row.get("document_id")
            )
            if len(page) < 1000:
                break
            offset += 1000

    missing_rag = sorted(required_ids - set(rag_by_id))
    missing_chunks = sorted(required_ids - chunked_ids)
    terminal_with_chunks = sorted(terminal_ids & chunked_ids)
    rag_only = sorted(set(rag_by_id) - set(app_by_id))
    missing_etag = sorted(
        row_id
        for row_id in required_ids
        if not str(app_by_id[row_id].get("source_etag") or "")
    )
    embedding_statuses = Counter(
        str(row.get("embedding_status") or "unset")
        for row in rag_rows
    )

    failures: list[str] = []
    if missing_state:
        failures.append(
            f"{len(missing_state)} discovered scope(s) have no sync-state receipt"
        )
    if missing_cursor and not allow_bootstrap_pending:
        failures.append(
            f"{len(missing_cursor)} discovered scope(s) have not completed bootstrap"
        )
    if failed_scopes:
        failures.append(
            f"{len(failed_scopes)} discovered scope(s) are warning/error"
        )
    if missing_rag:
        failures.append(
            f"{len(missing_rag)} vector-required catalog row(s) lack RAG metadata"
        )
    if missing_chunks:
        failures.append(
            f"{len(missing_chunks)} vector-required catalog row(s) lack chunks"
        )
    if terminal_with_chunks:
        failures.append(
            f"{len(terminal_with_chunks)} terminal SharePoint document(s) retain stale chunks"
        )
    if rag_only:
        failures.append(
            f"{len(rag_only)} SharePoint RAG row(s) lack an app catalog owner"
        )
    if missing_etag:
        failures.append(
            f"{len(missing_etag)} catalog row(s) lack a SharePoint revision marker"
        )

    report = {
        "passed": not failures,
        "discovery": {
            **discovery.receipt(),
            "initialized": len(resource_ids) - len(missing_cursor),
            "missingState": len(missing_state),
            "bootstrapPending": len(missing_cursor),
            "failedScopes": len(failed_scopes),
            "missingStateExamples": missing_state[:10],
            "bootstrapPendingExamples": missing_cursor[:10],
            "failedScopeExamples": failed_scopes[:10],
        },
        "vectorContract": {
            "cataloged": len(app_by_id),
            "vectorRequired": len(required_ids),
            "ragMetadata": len(rag_by_id),
            "withChunks": len(required_ids & chunked_ids),
            "terminalExcluded": len(terminal_ids),
            "terminalWithChunks": len(terminal_with_chunks),
            "missingRagMetadata": len(missing_rag),
            "missingChunks": len(missing_chunks),
            "ragOnly": len(rag_only),
            "missingEtag": len(missing_etag),
            "catalogIdHash": _id_hash(set(app_by_id)),
            "ragIdHash": _id_hash(set(rag_by_id)),
            "chunkedRequiredIdHash": _id_hash(required_ids & chunked_ids),
            "embeddingStatuses": dict(embedding_statuses),
            "missingRagExamples": missing_rag[:10],
            "missingChunkExamples": missing_chunks[:10],
            "terminalWithChunkExamples": terminal_with_chunks[:10],
            "ragOnlyExamples": rag_only[:10],
            "missingEtagExamples": missing_etag[:10],
        },
        "failures": failures,
    }
    return report, failures


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--env-file",
        default=str(REPO_ROOT / ".env"),
        help="Optional dotenv file for local verification",
    )
    parser.add_argument(
        "--allow-bootstrap-pending",
        action="store_true",
        help="Diagnostic mode only; production closeout remains strict",
    )
    args = parser.parse_args()
    env_path = Path(args.env_file)
    if env_path.exists():
        load_dotenv(env_path)
    os.environ.setdefault("RAG_DATABASE_READS_ENABLED", "true")

    try:
        report, failures = verify(
            allow_bootstrap_pending=args.allow_bootstrap_pending
        )
    except Exception as exc:
        print(
            json.dumps(
                {
                    "passed": False,
                    "failures": [f"verifier_exception: {exc}"],
                },
                indent=2,
            )
        )
        return 1
    print(json.dumps(report, indent=2, sort_keys=True))
    return 1 if failures else 0


if __name__ == "__main__":
    raise SystemExit(main())
