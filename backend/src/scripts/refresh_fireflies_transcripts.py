#!/usr/bin/env python3
"""Force-refresh Fireflies transcript markdown + chunks for specific IDs.

This script refreshes transcript content from Fireflies API and re-ingests it.
Unlike embedding-only scripts, this updates:
1) `document_metadata.content` (raw markdown)
2) Storage markdown file URL content
3) `document_chunks` (fully replaced)
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path
from typing import Optional


def _bootstrap_imports() -> None:
    backend_src = Path(__file__).resolve().parents[1]
    if str(backend_src) not in sys.path:
        sys.path.insert(0, str(backend_src))


def _resolve_project_id(
    client,
    fireflies_id: str,
    explicit_project_id: Optional[int],
) -> Optional[int]:
    if explicit_project_id is not None:
        return explicit_project_id

    result = (
        client.table("document_metadata")
        .select("project_id")
        .eq("fireflies_id", fireflies_id)
        .limit(1)
        .execute()
    )
    row = (result.data or [None])[0]
    project_id = row.get("project_id") if isinstance(row, dict) else None
    if isinstance(project_id, int):
        return project_id
    return None


def _refresh_one(
    pipeline,
    fireflies_id: str,
    project_id: Optional[int],
    dry_run: bool,
) -> dict:
    transcript = pipeline._fetch_transcript(fireflies_id)  # noqa: SLF001 (intentional script-level access)
    apps_outputs = pipeline._fetch_apps_outputs(fireflies_id)  # noqa: SLF001
    markdown = pipeline._format_transcript_markdown(transcript, apps_outputs)  # noqa: SLF001

    captured_at = pipeline._parse_datetime(transcript.get("dateString") or transcript.get("date"))  # noqa: SLF001
    storage_path = pipeline._build_storage_path(transcript.get("title") or fireflies_id, captured_at)  # noqa: SLF001

    storage_url = None
    if not dry_run:
        storage_url = pipeline.store.upload_public_text("transcripts", storage_path, markdown)

    ingestion = pipeline.ingest_markdown_text(
        markdown,
        project_id=project_id,
        dry_run=dry_run,
        storage_url=storage_url,
    )

    return {
        "fireflies_id": fireflies_id,
        "project_id": project_id,
        "markdown_chars": len(markdown),
        "storage_path": storage_path,
        "storage_url": storage_url,
        "document_id": ingestion.document_id,
        "chunk_count": ingestion.chunk_count,
        "content_hash": ingestion.content_hash,
        "dry_run": ingestion.dry_run,
    }


def main() -> int:
    _bootstrap_imports()

    from services.env_loader import load_env, verify_required_vars
    from services.ingestion.fireflies_pipeline import FirefliesIngestionPipeline
    from services.pipeline.workflow_client import enqueue_document_workflow
    from services.supabase_helpers import SupabaseRagStore, get_supabase_client

    load_env()
    verify_required_vars("SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY", "FIREFLIES_API_KEY")

    parser = argparse.ArgumentParser(description="Force-refresh Fireflies transcripts by ID")
    parser.add_argument(
        "--fireflies-id",
        action="append",
        required=True,
        help="Fireflies transcript ID (repeat flag for multiple IDs)",
    )
    parser.add_argument(
        "--project-id",
        type=int,
        default=None,
        help="Optional project_id override for all IDs",
    )
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument(
        "--skip-pipeline",
        action="store_true",
        help="Only refresh markdown/chunks; do not run parser/embedder/extractor/digest",
    )
    args = parser.parse_args()

    client = get_supabase_client()
    store = SupabaseRagStore(client)
    pipeline = FirefliesIngestionPipeline(store=store)

    failures = 0
    for ff_id in args.fireflies_id:
        ff_id = ff_id.strip()
        if not ff_id:
            continue
        try:
            effective_project_id = _resolve_project_id(client, ff_id, args.project_id)
            result = _refresh_one(
                pipeline=pipeline,
                fireflies_id=ff_id,
                project_id=effective_project_id,
                dry_run=args.dry_run,
            )
            pipeline_result = None
            if not args.dry_run and not args.skip_pipeline:
                pipeline_result = enqueue_document_workflow(
                    result["document_id"],
                    source_type="fireflies",
                    project_hint=effective_project_id,
                )
            print(f"[ok] {ff_id} -> doc={result['document_id']} chunks={result['chunk_count']} chars={result['markdown_chars']}")
            print(f"     storage={result['storage_url'] or '(dry-run)'}")
            if pipeline_result:
                print(
                    "     pipeline=queued "
                    f"run_id={pipeline_result.get('runId', 'unknown')}"
                )
        except Exception as exc:
            failures += 1
            print(f"[error] {ff_id}: {exc}")

    return 1 if failures else 0


if __name__ == "__main__":
    raise SystemExit(main())
