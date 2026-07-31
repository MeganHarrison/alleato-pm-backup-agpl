"""Client for the sole durable document-pipeline owner."""
from __future__ import annotations

import os
from typing import Any, Dict, Optional

import httpx

DEFAULT_WORKFLOW_URL = (
    "https://frontend-iota-ochre-85.vercel.app/api/rag-pipeline/process"
)


def _workflow_secret() -> str:
    """Resolve the server-to-server credential, preferring the scoped key."""
    secret = (
        os.getenv("RAG_PIPELINE_WORKFLOW_SECRET", "").strip()
        or os.getenv("ADMIN_API_KEY", "").strip()
    )
    if not secret:
        raise RuntimeError(
            "RAG Workflow authentication is not configured. Set "
            "RAG_PIPELINE_WORKFLOW_SECRET or ADMIN_API_KEY."
        )
    return secret


def _workflow_url() -> str:
    configured = os.getenv("RAG_PIPELINE_WORKFLOW_URL", "").strip()
    if configured:
        return configured.rstrip("/")

    frontend_url = os.getenv("FRONTEND_URL", "").strip().rstrip("/")
    if frontend_url:
        return f"{frontend_url}/api/rag-pipeline/process"

    # Render is managed through its API and can drift from render.yaml. Keep
    # the stable Vercel production-project alias as a final operational
    # fallback so ingestion does not become unavailable solely because the
    # optional URL override is absent.
    return DEFAULT_WORKFLOW_URL


def enqueue_document_workflow(
    metadata_id: str,
    *,
    source_type: Optional[str] = None,
    project_hint: Optional[int] = None,
) -> Dict[str, Any]:
    secret = _workflow_secret()

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
