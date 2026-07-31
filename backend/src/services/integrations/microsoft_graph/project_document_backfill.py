"""Backfill project_documents rows for already-ingested Microsoft Graph files."""

from __future__ import annotations

from pathlib import PurePosixPath
from typing import Any, Dict, Iterable, Optional

from .project_documents import (
    metadata_text_storage,
    project_document_payload_from_graph_item,
    source_system_label,
    upsert_project_document_by_source,
)


GRAPH_FILE_SOURCES = {"onedrive", "sharepoint"}
POSTGREST_PAGE_SIZE = 1000


def _table(client: Any, name: str) -> Any:
    return client.table(name) if hasattr(client, "table") else client.from_(name)


def _rows(response: Any) -> list[dict]:
    return [dict(row) for row in (getattr(response, "data", None) or [])]


def _source_metadata(row: dict) -> dict:
    value = row.get("source_metadata")
    return value if isinstance(value, dict) else {}


def _infer_source_system(row: dict) -> Optional[str]:
    source_system = str(row.get("source_system") or "").lower()
    if source_system in GRAPH_FILE_SOURCES:
        return source_system

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


def _source_item_id(row: dict, source_system: str) -> Optional[str]:
    item_id = row.get("source_item_id")
    if item_id:
        return str(item_id)

    row_id = str(row.get("id") or "")
    prefix = f"{source_system}_"
    if row_id.startswith(prefix) and len(row_id) > len(prefix):
        return row_id[len(prefix):]
    return None


def _file_name(row: dict) -> str:
    return str(row.get("file_name") or row.get("title") or "Graph document")


def _folder_path(row: dict, source_system: str) -> str:
    source_path = str(row.get("source_path") or "").strip("/")
    if not source_path:
        return source_system_label(source_system)
    parent = str(PurePosixPath(source_path).parent)
    if parent in {"", "."}:
        return source_system_label(source_system)
    return parent


def _owner(row: dict, source_system: str) -> str:
    metadata = _source_metadata(row)
    owner = metadata.get("graph_owner") or metadata.get("source_owner")
    if owner:
        return str(owner)

    file_path = str(row.get("file_path") or "")
    parts = [part for part in PurePosixPath(file_path).parts if part and part != "/"]
    if len(parts) >= 2 and parts[0] == source_system:
        return parts[1]
    return source_system_label(source_system)


def _storage_path(row: dict, source_system: str, owner: str, item_id: str, name: str) -> str:
    existing = row.get("file_path")
    if existing:
        return str(existing)
    extension = PurePosixPath(name).suffix
    return metadata_text_storage(source_system, owner, item_id, extension)


def _candidate_payload(row: dict) -> Optional[dict]:
    project_id = row.get("project_id")
    if not project_id:
        return None

    source_system = _infer_source_system(row)
    if not source_system:
        return None

    item_id = _source_item_id(row, source_system)
    if not item_id:
        return None

    name = _file_name(row)
    owner = _owner(row, source_system)
    storage_path = _storage_path(row, source_system, owner, item_id, name)
    item = {
        "webUrl": row.get("source_web_url") or row.get("url"),
        "url": row.get("url"),
        "source_web_url": row.get("source_web_url"),
        "source_drive_id": row.get("source_drive_id"),
        "source_site_id": row.get("source_site_id"),
        "source_path": row.get("source_path"),
        "source_etag": row.get("source_etag"),
        "source_last_modified_at": row.get("source_last_modified_at") or row.get("date"),
        "source_size": row.get("source_size"),
        "date": row.get("date"),
    }

    return project_document_payload_from_graph_item(
        project_id=int(project_id),
        source_system=source_system,
        owner=owner,
        folder_path=_folder_path(row, source_system),
        item=item,
        item_id=item_id,
        name=name,
        storage_path=storage_path,
        uploaded_by=f"{source_system_label(source_system)} sync",
    )


def _fetch_metadata_rows(client: Any, limit: int) -> list[dict]:
    select_clause = (
        "id,title,file_name,url,source,source_system,category,type,project_id,date,tags,"
        "file_path,source_drive_id,source_item_id,source_site_id,source_path,source_web_url,"
        "source_etag,source_last_modified_at,source_size,source_metadata"
    )
    rows: list[dict] = []
    offset = 0
    remaining = max(1, limit)
    while remaining > 0:
        page_size = min(POSTGREST_PAGE_SIZE, remaining)
        query = (
            _table(client, "document_metadata")
            .select(select_clause)
            .not_.is_("project_id", "null")
            .or_("source_system.eq.onedrive,source_system.eq.sharepoint,id.like.onedrive_%,id.like.sharepoint_%")
        )
        try:
            query = query.range(offset, offset + page_size - 1)
        except AttributeError:
            query = query.limit(limit)
        response = query.execute()
        page = _rows(response)
        rows.extend(page)
        if len(page) < page_size:
            break
        offset += page_size
        remaining -= page_size
    return rows


def _existing_project_document_keys(client: Any, payloads: Iterable[dict]) -> set[tuple[int, str, str]]:
    payload_list = list(payloads)
    if not payload_list:
        return set()

    project_ids = sorted({payload["project_id"] for payload in payload_list})
    keys: set[tuple[int, str, str]] = set()
    rows = []
    offset = 0
    while True:
        query = (
            _table(client, "project_documents")
            .select("project_id,source_system,source_item_id,deleted_at")
            .in_("project_id", project_ids)
        )
        try:
            query = query.range(offset, offset + POSTGREST_PAGE_SIZE - 1)
        except AttributeError:
            pass
        response = query.execute()
        page = _rows(response)
        rows.extend(page)
        if len(page) < POSTGREST_PAGE_SIZE:
            break
        offset += POSTGREST_PAGE_SIZE

    for row in rows:
        if row.get("deleted_at") is not None:
            continue
        source_system = row.get("source_system")
        source_item_id = row.get("source_item_id")
        project_id = row.get("project_id")
        if project_id and source_system and source_item_id:
            keys.add((int(project_id), str(source_system), str(source_item_id)))
    return keys


def run_graph_project_document_backfill(
    client: Any,
    *,
    limit: int = 1000,
    dry_run: bool = False,
) -> Dict[str, Any]:
    """Promote assigned OneDrive/SharePoint metadata rows into project_documents."""
    rows = _fetch_metadata_rows(client, max(1, limit))
    payloads = [payload for row in rows if (payload := _candidate_payload(row))]
    existing_keys = _existing_project_document_keys(client, payloads)

    result: Dict[str, Any] = {
        "scanned": len(rows),
        "eligible": len(payloads),
        "missing": 0,
        "inserted": 0,
        "updated": 0,
        "skipped_existing": 0,
        "failed": 0,
        "dry_run": dry_run,
        "errors": [],
    }

    for payload in payloads:
        key = (int(payload["project_id"]), str(payload["source_system"]), str(payload["source_item_id"]))
        if key in existing_keys:
            result["skipped_existing"] += 1
            continue

        result["missing"] += 1
        if dry_run:
            continue

        try:
            action = upsert_project_document_by_source(client, payload)
            result[action] = int(result.get(action, 0)) + 1
            existing_keys.add(key)
        except Exception as exc:
            result["failed"] += 1
            result["errors"].append(
                {
                    "project_id": payload.get("project_id"),
                    "source_system": payload.get("source_system"),
                    "source_item_id": payload.get("source_item_id"),
                    "error": str(exc),
                }
            )

    return result
