#!/usr/bin/env python3
"""Backfill knowledge-base SharePoint files into Supabase Storage.

The knowledge-base metadata sync stores stable Graph drive/item IDs plus the
target Supabase Storage path in document_metadata. This script fills any missing
`documents/knowledge-base/*` objects so app document open actions can use an
app-served signed URL instead of requiring a live SharePoint browser session.

Usage:
    python scripts/ingestion/backfill_knowledge_storage_from_graph.py
    python scripts/ingestion/backfill_knowledge_storage_from_graph.py --apply
    python scripts/ingestion/backfill_knowledge_storage_from_graph.py --apply --limit 5
"""

from __future__ import annotations

import argparse
import json
import mimetypes
import os
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path
from typing import Any, Dict, List, Optional

REPO_ROOT = Path(__file__).resolve().parents[2]
BACKEND_SRC = REPO_ROOT / "backend" / "src"
if str(BACKEND_SRC) not in sys.path:
    sys.path.insert(0, str(BACKEND_SRC))

from services.env_loader import load_env
from services.supabase_helpers import get_supabase_client

GRAPH_BASE = "https://graph.microsoft.com/v1.0"
TOKEN_URL = "https://login.microsoftonline.com/{tenant_id}/oauth2/v2.0/token"
DEFAULT_BUCKET = "documents"
DEFAULT_SIGNED_URL_TTL_SECONDS = 60


def load_dotenv() -> None:
    try:
        load_env(str(REPO_ROOT / ".env"))
    except TypeError:
        load_env()


def _post_form(url: str, data: Dict[str, str]) -> Dict[str, Any]:
    encoded = urllib.parse.urlencode(data).encode("utf-8")
    req = urllib.request.Request(url, data=encoded, method="POST")
    with urllib.request.urlopen(req, timeout=30) as resp:
        return json.loads(resp.read().decode("utf-8"))


def get_graph_token() -> str:
    client_id = os.getenv("MICROSOFT_CLIENT_ID")
    client_secret = os.getenv("MICROSOFT_CLIENT_SECRET")
    tenant_id = os.getenv("MICROSOFT_TENANT_ID")
    missing = [
        name
        for name, value in {
            "MICROSOFT_CLIENT_ID": client_id,
            "MICROSOFT_CLIENT_SECRET": client_secret,
            "MICROSOFT_TENANT_ID": tenant_id,
        }.items()
        if not value
    ]
    if missing:
        raise RuntimeError(f"Missing Microsoft Graph env vars: {', '.join(missing)}")

    data = _post_form(
        TOKEN_URL.format(tenant_id=tenant_id),
        {
            "grant_type": "client_credentials",
            "client_id": client_id or "",
            "client_secret": client_secret or "",
            "scope": "https://graph.microsoft.com/.default",
        },
    )
    return str(data["access_token"])


def graph_download_bytes(drive_id: str, item_id: str, token: str, max_retries: int = 4) -> bytes:
    url = f"{GRAPH_BASE}/drives/{drive_id}/items/{item_id}/content"
    last_error: Optional[Exception] = None

    for attempt in range(max_retries):
        request = urllib.request.Request(url, headers={"Authorization": f"Bearer {token}"})
        try:
            with urllib.request.urlopen(request, timeout=180) as response:
                return response.read()
        except urllib.error.HTTPError as exc:
            last_error = exc
            if exc.code not in {429, 503, 504}:
                raise
            retry_after = exc.headers.get("Retry-After")
            delay = float(retry_after) if retry_after and retry_after.isdigit() else 2.0 * (2**attempt)
            time.sleep(min(delay, 30.0))
        except urllib.error.URLError as exc:
            last_error = exc
            time.sleep(min(2.0 * (2**attempt), 30.0))

    raise RuntimeError(f"Graph download failed after {max_retries} attempts: {last_error}")


def storage_object_signable(client: Any, bucket: str, path: str) -> bool:
    try:
        result = client.storage.from_(bucket).create_signed_url(path, DEFAULT_SIGNED_URL_TTL_SECONDS)
    except Exception:
        return False
    if isinstance(result, dict):
        return bool(result.get("signedURL") or result.get("signedUrl") or result.get("signed_url"))
    return bool(result)


def content_type_for(row: Dict[str, Any]) -> str:
    name = str(row.get("file_name") or row.get("file_path") or "")
    explicit = {
        ".doc": "application/msword",
        ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        ".heic": "image/heic",
        ".md": "text/markdown",
        ".mpp": "application/vnd.ms-project",
        ".msg": "application/vnd.ms-outlook",
        ".pdf": "application/pdf",
        ".txt": "text/plain",
        ".xls": "application/vnd.ms-excel",
        ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        ".zip": "application/zip",
    }
    ext = Path(name).suffix.lower()
    guessed = explicit.get(ext)
    if guessed:
        return guessed
    guessed, _encoding = mimetypes.guess_type(name)
    return guessed or "application/octet-stream"


def upload_storage_object(client: Any, bucket: str, path: str, payload: bytes, content_type: str) -> None:
    options = {"upsert": "true", "content-type": content_type}
    storage = client.storage.from_(bucket)
    try:
        storage.upload(path, payload, options)
    except Exception:
        storage.update(path, payload, options)


def fetch_knowledge_rows(client: Any, limit: Optional[int], metadata_id: Optional[str]) -> List[Dict[str, Any]]:
    query = (
        client.table("document_metadata")
        .select(
            "id,title,file_name,file_path,storage_bucket,source_drive_id,source_item_id,"
            "source_web_url,url,status"
        )
        .eq("category", "knowledge")
        .order("created_at", desc=False)
    )
    if metadata_id:
        query = query.eq("id", metadata_id)
    if limit:
        query = query.limit(limit)

    rows = query.execute().data or []
    return [row for row in rows if row.get("file_path")]


def backfill_rows(rows: List[Dict[str, Any]], apply: bool) -> Dict[str, Any]:
    client = get_supabase_client()
    token: Optional[str] = None
    summary: Dict[str, Any] = {
        "scanned": len(rows),
        "already_present": 0,
        "would_upload": 0,
        "uploaded": 0,
        "skipped_missing_graph_ids": 0,
        "verify_failed": 0,
        "errors": [],
    }

    for row in rows:
        bucket = str(row.get("storage_bucket") or DEFAULT_BUCKET)
        path = str(row.get("file_path") or "")
        label = row.get("file_name") or row.get("title") or row.get("id")

        if storage_object_signable(client, bucket, path):
            summary["already_present"] += 1
            continue

        drive_id = row.get("source_drive_id")
        item_id = row.get("source_item_id")
        if not drive_id or not item_id:
            summary["skipped_missing_graph_ids"] += 1
            continue

        if not apply:
            summary["would_upload"] += 1
            continue

        try:
            if token is None:
                token = get_graph_token()
            payload = graph_download_bytes(str(drive_id), str(item_id), token)
            upload_storage_object(client, bucket, path, payload, content_type_for(row))
            if not storage_object_signable(client, bucket, path):
                summary["verify_failed"] += 1
                summary["errors"].append({"id": row.get("id"), "file": label, "error": "uploaded object is not signable"})
                continue
            summary["uploaded"] += 1
        except Exception as exc:
            summary["errors"].append({"id": row.get("id"), "file": label, "error": str(exc)})

    return summary


def main() -> int:
    parser = argparse.ArgumentParser(description="Backfill knowledge-base files into Supabase Storage")
    parser.add_argument("--apply", action="store_true", help="Upload missing objects (omit for dry-run)")
    parser.add_argument("--limit", type=int, help="Limit rows scanned")
    parser.add_argument("--id", dest="metadata_id", help="Backfill one document_metadata id")
    args = parser.parse_args()

    load_dotenv()
    client = get_supabase_client()
    rows = fetch_knowledge_rows(client, args.limit, args.metadata_id)
    summary = backfill_rows(rows, apply=args.apply)

    print(json.dumps(summary, indent=2, sort_keys=True))
    if summary["errors"] or summary["verify_failed"]:
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
