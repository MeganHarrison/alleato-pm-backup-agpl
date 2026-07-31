"""Client for the sole durable document-pipeline owner."""
from __future__ import annotations

import os
from typing import Any, Dict, Optional

import httpx


def _workflow_url() -> str:
    configured = os.getenv("RAG_PIPELINE_WORKFLOW_URL", "").strip()
    if configured:
        return configured.rstrip("/")

    frontend_url = os.getenv("FRONTEND_URL", "").strip().rstrip("/")
    if frontend_url:
        return f"{frontend_url}/api/rag-pipeline/process"

    raise RuntimeError(
        "RAG workflow URL is not configured. Set RAG_PIPELINE_WORKFLOW_URL "
        "or FRONTEND_URL."
    )


def enqueue_document_workflow(
    metadata_id: str,
    *,
    source_type: Optional[str] = None,
    project_hint: Optional[int] = None,
) -> Dict[str, Any]:
    secret = os.getenv("RAG_PIPELINE_WORKFLOW_SECRET", "").strip()
    if not secret:
        raise RuntimeError("RAG_PIPELINE_WORKFLOW_SECRET is not configured.")

    response = httpx.post(
        _workflow_url(),
        headers={
            "Authorization": f"Bearer {secret}",
            "Content-Type": "application/json",
        },
        json={
            "documentId": metadata_id,
            "sourceType": source_type,
            "projectHint": project_hint,
        },
        timeout=20.0,
    )
    response.raise_for_status()
    result = response.json()
    if not result.get("runId"):
        raise RuntimeError("RAG workflow accepted the request without a runId.")
    return result
