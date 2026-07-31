"""Single-stage adapters used by the durable Vercel document workflow.

The Python service still owns the proven parsing, vision, embedding, and
extraction implementations. It no longer owns ordering, retries, or durable
execution; those concerns belong to the Vercel Workflow.
"""
from __future__ import annotations

from typing import Any, Dict, Literal

from .document_parser import run_document_parser
from .embedder import run_embedder
from .extractor import run_extractor
from .financial_parser import run_financial_parser
from .parser import run_parser
from .vision_analyzer import run_vision_analyzer
from ..supabase_helpers import get_rag_read_client, get_supabase_client

PipelineStage = Literal["load", "parse", "vision", "embed", "extract"]

_MEETING_CATEGORIES = {"meeting", "transcript", "meeting_transcript"}
_FINANCIAL_EXTENSIONS = (".csv", ".tsv", ".xls", ".xlsx")
_GRAPH_SOURCES = {
    "microsoft_graph",
    "outlook",
    "outlook_email",
    "outlook_attachment",
    "email",
    "teams",
    "teams_dm",
    "onedrive",
    "sharepoint",
}


def _load_document(client: Any, metadata_id: str) -> Dict[str, Any]:
    try:
        response = (
            client.table("document_metadata")
            .select(
                "id, category, file_name, file_path, source, source_system, "
                "status, project_id"
            )
            .eq("id", metadata_id)
            .single()
            .execute()
        )
        row = response.data
    except Exception:
        response = (
            get_rag_read_client()
            .table("rag_document_metadata")
            .select(
                "id, category, file_name, file_path, source, source_system, "
                "embedding_status, project_id"
            )
            .eq("id", metadata_id)
            .single()
            .execute()
        )
        row = response.data
        if row:
            row["status"] = row.get("embedding_status")
    if not row:
        raise ValueError(f"Document metadata row not found: {metadata_id}")
    return row


def _classify_document(row: Dict[str, Any]) -> Dict[str, Any]:
    category = str(row.get("category") or "").lower().strip()
    source = str(row.get("source_system") or row.get("source") or "").lower().strip()
    file_name = str(row.get("file_name") or row.get("file_path") or "").lower()

    is_financial = file_name.endswith(_FINANCIAL_EXTENSIONS)

    is_meeting = category in _MEETING_CATEGORIES or source == "fireflies"
    is_document = (
        not is_meeting
        and (
            file_name.endswith((".pdf", ".docx", ".doc"))
            or bool(category)
        )
    )

    parser_kind = (
        "financial"
        if is_financial
        else "document"
        if is_document
        else "meeting"
    )
    return {
        "parserKind": parser_kind,
        "isDocument": is_document,
        "source": source or None,
        "category": category or None,
    }


def run_pipeline_stage(
    metadata_id: str,
    stage: PipelineStage,
    *,
    source_type: str | None = None,
) -> Dict[str, Any]:
    """Run exactly one idempotent document-processing stage."""
    client = get_supabase_client()
    row = _load_document(client, metadata_id)
    classification = _classify_document(row)
    effective_source = (source_type or classification["source"] or "").lower()

    if stage == "load":
        return {
            "metadataId": metadata_id,
            "status": row.get("status"),
            "projectId": row.get("project_id"),
            **classification,
        }

    if stage == "parse":
        if effective_source in _GRAPH_SOURCES:
            return {
                "metadataId": metadata_id,
                "stage": stage,
                "skipped": True,
                "reason": "Microsoft Graph ingestion already materialized normalized content.",
            }
        parser_kind = classification["parserKind"]
        if parser_kind == "financial":
            result = run_financial_parser(metadata_id)
        elif parser_kind == "document":
            result = run_document_parser(metadata_id)
        else:
            result = run_parser(metadata_id)
        return {"metadataId": metadata_id, "stage": stage, "result": result}

    if stage == "vision":
        if not classification["isDocument"]:
            return {
                "metadataId": metadata_id,
                "stage": stage,
                "skipped": True,
                "reason": "Vision applies only to generic documents.",
            }
        result = run_vision_analyzer(metadata_id, client)
        return {"metadataId": metadata_id, "stage": stage, "result": result}

    if stage == "embed":
        if effective_source in _GRAPH_SOURCES:
            from ..integrations.microsoft_graph.embed import embed_graph_document

            chunk_count = embed_graph_document(client, metadata_id)
            if chunk_count <= 0:
                raise RuntimeError(
                    f"Graph embedding produced no chunks for {metadata_id}."
                )
            return {
                "metadataId": metadata_id,
                "stage": stage,
                "result": {"chunkCount": chunk_count},
            }
        return {
            "metadataId": metadata_id,
            "stage": stage,
            "result": run_embedder(metadata_id),
        }

    if stage == "extract":
        if effective_source in _GRAPH_SOURCES:
            return {
                "metadataId": metadata_id,
                "stage": stage,
                "skipped": True,
                "reason": "Graph communications intelligence is promoted by source projections.",
            }
        return {
            "metadataId": metadata_id,
            "stage": stage,
            "result": run_extractor(metadata_id),
        }

    raise ValueError(f"Unsupported pipeline stage: {stage}")
