"""Backfill project_id for OneDrive/SharePoint documents that have no project assigned.

For each unassigned document we try two strategies in order:
1. Folder-name match — extract the first subfolder below the configured root and do a
   case-insensitive lookup against projects.name.  This is high-confidence (1.0).
2. Content inference — pass title + content to ProjectAssigner (same path as live sync).

Documents that get assigned are updated in document_metadata and a tag is appended.
Also backfills source_path from source_web_url when source_path is missing subfolders.
"""

from __future__ import annotations

import logging
import os
import re
from typing import Any
from urllib.parse import unquote, urlparse

from ...ingestion.communication_project_backfill import (
    build_target_catalog_payload,
    sync_document_assignment_to_rag,
)
from ...ingestion.project_assignment import AssignmentTarget, ProjectAssigner

logger = logging.getLogger(__name__)

BACKFILL_TAG = "project_auto_backfill:folder_match_v1"
GRAPH_FILE_SOURCES = {"onedrive", "sharepoint"}


def _assignment_tag(target: AssignmentTarget) -> str:
    if target.business_area_id is not None:
        return f"business_area_auto:{target.method}"
    return f"project_auto:{target.method}"


def _load_rag_document_text(doc_id: str) -> str:
    """Load heavy OCR/body text from the RAG store, not app metadata."""
    try:
        from src.services.supabase_helpers import (
            fetch_optional_row,
            get_rag_read_client,
        )

        row = fetch_optional_row(
            get_rag_read_client(),
            "rag_document_metadata",
            "content,raw_text",
            "id",
            doc_id,
        )
        return str(row.get("content") or row.get("raw_text") or "")
    except Exception as exc:
        logger.warning(
            "[OneDriveBackfill] RAG text lookup failed for %s: %s", doc_id, exc
        )
        return ""


def _infer_source_system(row: dict) -> str | None:
    sys = str(row.get("source_system") or "").lower()
    if sys in GRAPH_FILE_SOURCES:
        return sys
    row_id = str(row.get("id") or "")
    if row_id.startswith("onedrive_"):
        return "onedrive"
    if row_id.startswith("sharepoint_"):
        return "sharepoint"
    tags = str(row.get("tags") or "").lower()
    if "onedrive" in tags:
        return "onedrive"
    if "sharepoint" in tags:
        return "sharepoint"
    return None


_SKIP_PREFIXES = {
    "alleato group",
    "2026 jobs",
    "2025 jobs",
    "jobs",
    "projects",
    "documents",
}


def _extract_path_from_url(url: str) -> str | None:
    """Extract full file path from a SharePoint/OneDrive URL.

    Personal OneDrive:  .../personal/{user}/Documents/{Alleato Group/2025 Jobs/...}
    SharePoint site:    .../sites/{site}/Shared%20Documents/{...}
    """
    try:
        parsed = urlparse(url)
        path = parsed.path

        # Personal OneDrive
        personal = re.match(r".*/personal/[^/]+/Documents/(.+)", path)
        if personal:
            return unquote(personal.group(1))

        # SharePoint site — try Shared Documents or generic Documents library
        site = re.match(
            r".*/sites/[^/]+/(?:Shared%20Documents|Documents|[^/]+/[^/]+)/(.+)", path
        )
        if site:
            return unquote(site.group(1))
    except Exception:
        pass
    return None


_COMMON_WORDS = {
    "the",
    "a",
    "an",
    "and",
    "or",
    "of",
    "in",
    "at",
    "for",
    "to",
    "ca",
    "il",
    "oh",
}


def _parent_folder_from_path(source_path: str) -> str | None:
    """Return the first non-trivial folder segment from a OneDrive/SharePoint path.

    e.g. 'Alleato Group/2026 Jobs/Vermillion Rise Warehouse/Estimates/Budget.xlsx'
    → 'Vermillion Rise Warehouse'

    Strips numeric job-number prefixes: '25- 104 - Danville Theatre' → 'Danville Theatre'
    """
    parts = [p for p in source_path.strip("/").split("/") if p]
    if not parts:
        return None

    for part in parts:
        if part.lower() in _SKIP_PREFIXES:
            continue
        # Strip numeric job-number prefix including optional trailing dash:
        # "25- 104 Danville" → "Danville"  |  "25- 127 - Ulta Beauty" → "Ulta Beauty"
        stripped = re.sub(r"^\d{2}-\s*\d+\s*-?\s*", "", part).strip()
        # Also strip leading dash if left over
        stripped = re.sub(r"^-\s*", "", stripped).strip()
        return stripped if stripped else part
    return None


def _significant_words(text: str) -> list[str]:
    """Extract significant words (>2 chars, not common) from a project/folder name."""
    words = re.findall(r"[A-Za-z]+", text)
    return [w.lower() for w in words if len(w) > 2 and w.lower() not in _COMMON_WORDS]


def _lookup_project_by_folder(client: Any, folder_name: str) -> int | None:
    """Case-insensitive match against projects.name with progressive fallbacks."""
    # 1. Exact match
    try:
        res = (
            client.from_("projects")
            .select("id, name")
            .ilike("name", folder_name)
            .limit(1)
            .execute()
        )
        if res.data:
            return int(res.data[0]["id"])
    except Exception as exc:
        logger.warning(
            "[OneDriveBackfill] folder lookup failed for '%s': %s", folder_name, exc
        )
        return None

    # 2. Partial contains match
    try:
        res = (
            client.from_("projects")
            .select("id, name")
            .ilike("name", f"%{folder_name}%")
            .limit(1)
            .execute()
        )
        if res.data:
            logger.info(
                "[OneDriveBackfill] partial match '%s' → project %s",
                folder_name,
                res.data[0]["id"],
            )
            return int(res.data[0]["id"])
    except Exception as exc:
        logger.warning(
            "[OneDriveBackfill] partial lookup failed for '%s': %s", folder_name, exc
        )

    # 3. Keyword matching — find projects containing ALL significant words
    keywords = _significant_words(folder_name)
    if len(keywords) >= 2:
        try:
            all_projects = client.from_("projects").select("id, name").execute()
            for project in all_projects.data or []:
                project_words = set(_significant_words(project["name"]))
                if all(kw in project_words for kw in keywords):
                    logger.info(
                        "[OneDriveBackfill] keyword match '%s' → project %s '%s' via %s",
                        folder_name,
                        project["id"],
                        project["name"],
                        keywords,
                    )
                    return int(project["id"])
        except Exception as exc:
            logger.warning(
                "[OneDriveBackfill] keyword lookup failed for '%s': %s",
                folder_name,
                exc,
            )

    return None


def _append_tag(existing: str | None, tag: str) -> str:
    tags = [t.strip() for t in (existing or "").split(",") if t.strip()]
    if tag not in tags:
        tags.append(tag)
    return ",".join(tags)


def run_onedrive_project_assignment_backfill(
    client: Any,
    *,
    batch_size: int = 500,
    dry_run: bool = False,
    use_content_inference: bool = False,
) -> dict:
    """Assign one project-or-Business-Area scope to unassigned Graph documents.

    Returns a summary dict with counts.
    """
    result = {
        "scanned": 0,
        "eligible": 0,
        "assigned_folder": 0,
        "assigned_inference": 0,
        "assigned_project": 0,
        "assigned_business_area": 0,
        "unresolved": 0,
        "failed": 0,
        "dry_run": dry_run,
        "errors": [],
    }

    response = (
        client.from_("document_metadata")
        .select(
            "id, title, file_name, source_path, source_web_url, url, source_system, "
            "tags, project_id, business_area_id, participants"
        )
        .eq("category", "document")
        .is_("project_id", "null")
        .is_("business_area_id", "null")
        .limit(batch_size)
        .execute()
    )
    rows = response.data or []
    result["scanned"] = len(rows)

    # Filter to graph file sources
    eligible = [r for r in rows if _infer_source_system(r)]
    result["eligible"] = len(eligible)

    if not eligible:
        return result
    assigner = ProjectAssigner(client)

    for row in eligible:
        doc_id = row["id"]
        stored_path = row.get("source_path") or ""
        title = row.get("file_name") or row.get("title") or ""

        # Resolve the best available path — prefer URL-derived when source_path is shallow
        resolved_source_path = stored_path
        url = row.get("source_web_url") or row.get("url") or ""
        if url:
            url_path = _extract_path_from_url(url)
            stored_depth = len([p for p in stored_path.split("/") if p])
            url_depth = (
                len([p for p in (url_path or "").split("/") if p]) if url_path else 0
            )
            if url_path and url_depth > stored_depth:
                resolved_source_path = url_path
                logger.debug(
                    "[OneDriveBackfill] %s: using URL path (%d segments vs %d)",
                    doc_id,
                    url_depth,
                    stored_depth,
                )

        target: AssignmentTarget | None = None
        method = "unresolved"

        # Strategy 1: folder name → project name (using best available path)
        if resolved_source_path:
            folder_name = _parent_folder_from_path(resolved_source_path)
            if folder_name:
                matched_project_id = _lookup_project_by_folder(client, folder_name)
                if matched_project_id:
                    method = f"folder_match:{folder_name}"
                    target = assigner.assign_scope(
                        meeting_title=title,
                        participants=[],
                        content="",
                        existing_project_id=matched_project_id,
                        migrate_mapped_existing=True,
                    )

        # Strategy 2: content inference (opt-in)
        if target is None and use_content_inference:
            content = _load_rag_document_text(str(doc_id))
            participants = [
                p.strip()
                for p in (row.get("participants") or "").split(",")
                if p.strip()
            ]
            min_confidence = float(
                os.environ.get("GRAPH_PROJECT_ASSIGN_MIN_CONFIDENCE", "0.70")
            )
            try:
                inferred = assigner.assign_scope(
                    meeting_title=title,
                    participants=participants,
                    content=content[:3000],
                    existing_project_id=None,
                )
                if (
                    inferred.project_id is not None
                    or inferred.business_area_id is not None
                ) and inferred.confidence >= min_confidence:
                    target = inferred
                    method = f"inference:{inferred.method}:{inferred.confidence:.2f}"
            except Exception as exc:
                logger.warning(
                    "[OneDriveBackfill] inference failed for %s: %s", doc_id, exc
                )

        if target is None or (
            target.project_id is None and target.business_area_id is None
        ):
            result["unresolved"] += 1
            continue

        logger.info(
            "[OneDriveBackfill] %s -> %s=%s via %s",
            doc_id,
            "business_area_id" if target.business_area_id is not None else "project_id",
            (
                target.business_area_id
                if target.business_area_id is not None
                else target.project_id
            ),
            method,
        )

        if not dry_run:
            try:
                new_tags = _append_tag(row.get("tags"), f"{BACKFILL_TAG}")
                new_tags = _append_tag(new_tags, _assignment_tag(target))
                scope_payload, _target_name = build_target_catalog_payload(
                    client,
                    target,
                )
                update_payload: dict = {
                    **scope_payload,
                    "tags": new_tags,
                }
                # Also persist the richer source_path so the UI shows the full folder
                if resolved_source_path and resolved_source_path != stored_path:
                    update_payload["source_path"] = resolved_source_path
                client.from_("document_metadata").update(update_payload).eq(
                    "id", doc_id
                ).execute()
                sync_document_assignment_to_rag(
                    str(doc_id),
                    project_id=target.project_id,
                    business_area_id=target.business_area_id,
                )
            except Exception as exc:
                result["failed"] += 1
                result["errors"].append({"id": doc_id, "error": str(exc)})
                continue

        if method.startswith("folder_match:"):
            result["assigned_folder"] += 1
        else:
            result["assigned_inference"] += 1
        if target.business_area_id is not None:
            result["assigned_business_area"] += 1
        else:
            result["assigned_project"] += 1

    return result
