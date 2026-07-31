"""Shared helpers for Microsoft Graph source-backed project documents."""

from __future__ import annotations

import mimetypes
import os
import signal
import threading
from datetime import datetime, timezone
from contextlib import contextmanager
from pathlib import PurePosixPath
from typing import Any, Iterator, Optional


DOCUMENT_BUCKET = "documents"


def _env_int(name: str, default: int, *, minimum: int = 1) -> int:
    try:
        value = int(os.getenv(name, str(default)))
    except ValueError:
        return default
    return max(minimum, value)


@contextmanager
def _project_document_timeout() -> Iterator[None]:
    timeout_seconds = _env_int("GRAPH_PROJECT_DOCUMENT_UPSERT_TIMEOUT_SECONDS", 8)
    alarm_enabled = (
        threading.current_thread() is threading.main_thread()
        and hasattr(signal, "SIGALRM")
        and hasattr(signal, "alarm")
    )
    previous_handler = None

    def _raise_timeout(_signum: int, _frame: Any) -> None:
        raise TimeoutError(
            f"project document promotion exceeded {timeout_seconds}s"
        )

    if alarm_enabled:
        previous_handler = signal.getsignal(signal.SIGALRM)
        signal.signal(signal.SIGALRM, _raise_timeout)
        signal.alarm(timeout_seconds)
    try:
        yield
    finally:
        if alarm_enabled:
            signal.alarm(0)
            signal.signal(signal.SIGALRM, previous_handler)


def source_path(folder_path: str, name: str) -> str:
    """Build a stable source path for app-facing document records."""
    clean_folder = folder_path.strip("/")
    if not clean_folder:
        return name
    return str(PurePosixPath(clean_folder) / name)


def graph_id_safe(value: Any) -> Optional[str]:
    if value is None:
        return None
    text = str(value).strip()
    return text or None


def metadata_text_storage(source_system: str, owner: str, item_id: str, ext: str) -> str:
    return f"{source_system}/{owner}/{item_id}{ext}.txt"


def source_system_label(source_system: str) -> str:
    return "OneDrive" if source_system == "onedrive" else "SharePoint"


def project_document_payload_from_graph_item(
    *,
    project_id: int,
    source_system: str,
    owner: str,
    folder_path: str,
    item: dict,
    item_id: str,
    name: str,
    storage_path: Optional[str],
    uploaded_by: str,
) -> dict:
    web_url = item.get("webUrl") or item.get("source_web_url") or item.get("url") or ""
    modified = item.get("lastModifiedDateTime") or item.get("source_last_modified_at") or item.get("date")
    content_type = mimetypes.guess_type(name)[0] or "application/octet-stream"
    parent_ref = item.get("parentReference") or {}
    item_source_path = source_path(folder_path, name)
    source_label = source_system_label(source_system)
    source_metadata = {
        "graph_source": source_label.lower(),
        "graph_owner": owner,
        "text_storage_bucket": DOCUMENT_BUCKET,
        "text_storage_path": storage_path,
        "text_storage_note": "Extracted text used for AI search; file_url points to the Microsoft Graph source file.",
    }

    return {
        "project_id": project_id,
        "folder": folder_path.strip("/") or source_label,
        "title": name,
        "description": f"Synced from {source_label}: {item_source_path}",
        "file_name": name,
        "file_url": web_url,
        "file_size": item.get("size") or item.get("source_size"),
        "content_type": content_type,
        "version": 1,
        "status": "Published",
        "category": f"{source_label} Document",
        "is_private": False,
        "uploaded_by": uploaded_by,
        "created_by": "microsoft_graph",
        "source_system": source_system,
        "source_drive_id": graph_id_safe(item.get("source_drive_id") or parent_ref.get("driveId")),
        "source_item_id": item_id,
        "source_site_id": graph_id_safe(item.get("source_site_id") or parent_ref.get("siteId")),
        "source_path": item.get("source_path") or item_source_path,
        "source_web_url": web_url or None,
        "source_etag": item.get("source_etag") or item.get("eTag") or item.get("cTag"),
        "source_last_modified_at": modified,
        "source_size": item.get("size") or item.get("source_size"),
        "sync_status": "synced",
        "sync_error": None,
        "last_synced_at": datetime.now(timezone.utc).isoformat(),
        "storage_bucket": None,
        "storage_path": None,
        "content_hash": None,
        "workflow_target": "document",
        "source_metadata": source_metadata,
    }


def upsert_project_document_by_source(supabase_client, payload: dict) -> str:
    """Upsert project_documents without relying on the partial source-item index."""
    project_id = payload.get("project_id")
    source_system = payload.get("source_system")
    source_item_id = payload.get("source_item_id")
    if not project_id or not source_system or not source_item_id:
        raise ValueError("project_id, source_system, and source_item_id are required for source-backed documents")

    with _project_document_timeout():
        existing = (
            supabase_client.from_("project_documents")
            .select("id")
            .eq("project_id", project_id)
            .eq("source_system", source_system)
            .eq("source_item_id", source_item_id)
            .is_("deleted_at", "null")
            .limit(1)
            .execute()
        )
        rows = existing.data or []
        if rows:
            supabase_client.from_("project_documents").update(payload).eq("id", rows[0]["id"]).execute()
            return "updated"

        supabase_client.from_("project_documents").insert(payload).execute()
        return "inserted"
