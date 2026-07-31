"""Canonical Project Intelligence target resolution."""

from __future__ import annotations

import re
from typing import Any, Dict, Optional

INTELLIGENCE_TARGET_COLUMNS = (
    "id,target_type,name,slug,description,status,priority,owner_person_id,"
    "project_id,metadata,last_signal_at,created_at,updated_at"
)


def _single_row(response: Any) -> Optional[Dict[str, Any]]:
    data = getattr(response, "data", None) or []
    if isinstance(data, dict):
        return data
    return data[0] if data else None


def _slugify(value: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", value.lower()).strip("-")[:120] or "project"


def _duplicate_slug_error(exc: Exception) -> bool:
    message = str(exc)
    return (
        "duplicate key value violates unique constraint" in message
        and "intelligence_targets_slug_key" in message
    ) or ("23505" in message and "slug" in message)


def _fetch_project(client: Any, project_id: int) -> Dict[str, Any]:
    row = _single_row(
        client.table("projects")
        .select("id,name,project_number")
        .eq("id", int(project_id))
        .limit(1)
        .execute()
    )
    if not row:
        raise ValueError(f"projects row not found: {project_id}")
    return row


def ensure_client_project_target(
    client: Any,
    project_id: int,
    *,
    compiler_version: str,
) -> Dict[str, Any]:
    """Return or create the canonical client-project target."""
    existing = _single_row(
        client.table("intelligence_targets")
        .select(INTELLIGENCE_TARGET_COLUMNS)
        .eq("target_type", "client_project")
        .eq("project_id", int(project_id))
        .limit(1)
        .execute()
    )
    if existing:
        return existing

    project = _fetch_project(client, project_id)
    name = project.get("name") or f"Project {project_id}"
    base_slug = _slugify(
        " ".join(str(part) for part in (project.get("project_number"), name) if part)
    )
    slug_row = _single_row(
        client.table("intelligence_targets")
        .select("id,project_id")
        .eq("slug", base_slug)
        .limit(1)
        .execute()
    )
    slug = base_slug if not slug_row or slug_row.get("project_id") == int(project_id) else f"{base_slug}-{project_id}"
    payload = {
        "target_type": "client_project",
        "name": name,
        "slug": slug,
        "status": "active",
        "project_id": int(project_id),
        "metadata": {
            "created_by": "project_intelligence",
            "projection_version": compiler_version,
        },
    }
    try:
        return _single_row(client.table("intelligence_targets").insert(payload).execute()) or payload
    except Exception as exc:
        if not _duplicate_slug_error(exc):
            raise

    existing = _single_row(
        client.table("intelligence_targets")
        .select(INTELLIGENCE_TARGET_COLUMNS)
        .eq("target_type", "client_project")
        .eq("project_id", int(project_id))
        .limit(1)
        .execute()
    )
    if existing:
        return existing

    payload["slug"] = f"{base_slug}-{project_id}"
    try:
        return _single_row(client.table("intelligence_targets").insert(payload).execute()) or payload
    except Exception as exc:
        if not _duplicate_slug_error(exc):
            raise
        existing_by_slug = _single_row(
            client.table("intelligence_targets")
            .select(INTELLIGENCE_TARGET_COLUMNS)
            .eq("slug", payload["slug"])
            .limit(1)
            .execute()
        )
        if existing_by_slug:
            return existing_by_slug
        raise
