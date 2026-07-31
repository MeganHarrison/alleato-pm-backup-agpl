"""Promote important Outlook intake attachments into project documents."""

from __future__ import annotations

import hashlib
import logging
import mimetypes
import os
import re
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import PurePosixPath
from typing import Any, Optional

from ...supabase_helpers import (
    SupabaseRagStore,
    get_outlook_intake_read_client,
    get_outlook_intake_write_client,
    storage_upload_with_retry,
)
from .client import get_graph_client
from .onedrive import SUPPORTED_EXTENSIONS, _extract_text
from .outlook import (
    DOCUMENT_BUCKET,
    _attachment_bytes_for_intake,
    _attachment_metadata_text,
)
from .project_documents import upsert_project_document_by_source

logger = logging.getLogger(__name__)

DEFAULT_LIMIT = 25
MAX_BATCH_LIMIT = int(os.environ.get("OUTLOOK_ATTACHMENT_PROMOTION_MAX_BATCH", "25"))
MAX_ATTACHMENT_BYTES = int(os.environ.get("OUTLOOK_ATTACHMENT_PROMOTION_MAX_BYTES", str(50 * 1024 * 1024)))
COPY_ATTACHMENTS_TO_STORAGE = os.environ.get("OUTLOOK_ATTACHMENT_PROMOTION_COPY_STORAGE", "false").lower() in {
    "1",
    "true",
    "yes",
}

PROMOTABLE_EXTENSIONS = {
    ".csv",
    ".doc",
    ".docx",
    ".dwg",
    ".dxf",
    ".mpp",
    ".pdf",
    ".ppt",
    ".pptx",
    ".rvt",
    ".txt",
    ".xls",
    ".xlsx",
    ".zip",
}

DOCUMENT_KEYWORDS = {
    "contract": "Contract",
    "agreement": "Contract",
    "subcontract": "Contract",
    "purchase order": "Contract",
    "po ": "Contract",
    "spec": "Specification",
    "specification": "Specification",
    "drawing": "Drawing",
    "drawings": "Drawing",
    "plan": "Drawing",
    "plans": "Drawing",
    "sheet": "Drawing",
    "submittal": "Submittal",
    "rfi": "RFI",
    "proposal": "Proposal",
    "quote": "Proposal",
    "change order": "Change Order",
    "change request": "Change Order",
    "invoice": "Invoice",
    "pay app": "Invoice",
    "payment application": "Invoice",
    "permit": "Permit",
    "schedule": "Schedule",
    "addendum": "Addendum",
    "closeout": "Closeout",
    "warranty": "Closeout",
}

LOW_VALUE_NAME_PATTERNS = (
    re.compile(r"^(image|logo|icon|signature|facebook|linkedin|twitter|instagram)\d*[\W_]*", re.IGNORECASE),
    re.compile(r"(unsubscribe|privacy|terms|confidentiality|email[-_ ]banner)", re.IGNORECASE),
)


@dataclass(frozen=True)
class AttachmentDecision:
    status: str
    category: Optional[str]
    reason: str


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _stable_graph_id(value: str, length: int = 24) -> str:
    return hashlib.sha256(value.encode("utf-8")).hexdigest()[:length]


def _storage_safe_name(name: str) -> str:
    cleaned = re.sub(r"[^A-Za-z0-9._-]+", "_", name or "attachment").strip("._")
    return cleaned[:180] or "attachment"


def _decode_bytea(value: Any) -> Optional[bytes]:
    if value is None:
        return None
    if isinstance(value, bytes):
        return value
    text = str(value)
    if text.startswith("\\x"):
        return bytes.fromhex(text[2:])
    return text.encode("utf-8")


def _storage_public_url(supabase_client, bucket: str, path: str) -> str:
    try:
        return supabase_client.storage.from_(bucket).get_public_url(path)
    except Exception:
        return path


def _attachment_doc_id(message_id: str, attachment_id: str) -> str:
    return f"outlook_attachment_{_stable_graph_id(message_id)}_{_stable_graph_id(attachment_id)}"


def classify_attachment_for_promotion(
    *,
    file_name: str,
    content_type: Optional[str],
    is_inline: bool,
    subject: str,
    body_text: str,
) -> AttachmentDecision:
    """Classify whether an attachment should become a project document."""
    normalized_name = (file_name or "").strip().lower()
    _, ext = os.path.splitext(normalized_name)
    ext = ext.lower()

    if not normalized_name:
        return AttachmentDecision("skipped", None, "missing_file_name")
    if is_inline and (content_type or "").startswith("image/"):
        return AttachmentDecision("skipped", None, "inline_image")
    if (content_type or "").startswith("image/"):
        return AttachmentDecision("review_needed", None, "image_attachment_requires_photo_pipeline")
    if any(pattern.search(normalized_name) for pattern in LOW_VALUE_NAME_PATTERNS):
        return AttachmentDecision("skipped", None, "low_value_attachment_name")

    combined = f"{normalized_name} {subject or ''} {body_text or ''}".lower()
    for keyword, category in DOCUMENT_KEYWORDS.items():
        if keyword in combined:
            return AttachmentDecision("promoted", category, f"keyword:{keyword}")

    if ext in {".dwg", ".dxf", ".rvt"}:
        return AttachmentDecision("promoted", "Drawing", f"extension:{ext.lstrip('.')}")
    if ext in PROMOTABLE_EXTENSIONS and not (content_type or "").startswith("image/"):
        return AttachmentDecision("promoted", "Email Attachment", f"extension:{ext.lstrip('.')}")

    return AttachmentDecision("skipped", None, f"unsupported_or_low_value_extension:{ext.lstrip('.') or 'none'}")


def _select_pending_attachments(supabase_client, limit: int) -> list[dict[str, Any]]:
    response = (
        get_outlook_intake_read_client().from_("outlook_email_intake_attachments")
        .select(
            """
            id,
            intake_email_id,
            email_attachment_id,
            graph_attachment_id,
            file_name,
            file_url,
            file_size,
            content_type,
            extracted_text,
            is_inline,
            source_metadata,
            promotion_status,
            promotion_reason,
            promotion_attempt_count,
            outlook_email_intake!inner(
              id,
              graph_message_id,
              mailbox_user_id,
              project_id,
              subject,
              from_name,
              body_text,
              from_email,
              received_at,
              web_link,
              assignment_method,
              assignment_confidence
            )
            """
        )
        .in_("promotion_status", ["pending", "failed", "review_needed"])
        .lt("promotion_attempt_count", 3)
        .order("created_at", desc=False)
        .limit(limit)
        .execute()
    )
    return [row for row in (response.data or []) if _should_retry_attachment_promotion(row)]


def _should_retry_attachment_promotion(row: dict[str, Any]) -> bool:
    status = str(row.get("promotion_status") or "")
    if status in {"pending", "failed"}:
        return True

    if status == "review_needed" and row.get("promotion_reason") == "missing_project_assignment":
        intake = row.get("outlook_email_intake") or {}
        return bool(intake.get("project_id"))

    if status == "review_needed" and str(row.get("promotion_reason") or "").startswith(
        "promotable_extension_no_context:"
    ):
        intake = row.get("outlook_email_intake") or {}
        return bool(intake.get("project_id"))

    return False


def _fetch_attachment_payload(supabase_client, attachment_id: int, *, include_content: bool) -> dict[str, Any]:
    columns = "checksum_sha256, extracted_text"
    if include_content:
        columns = f"content, {columns}"
    response = (
        get_outlook_intake_read_client().from_("outlook_email_intake_attachments")
        .select(columns)
        .eq("id", attachment_id)
        .limit(1)
        .execute()
    )
    rows = response.data or []
    if not rows:
        raise ValueError(f"attachment_payload_missing:{attachment_id}")
    return rows[0]


def _update_attachment_status(
    supabase_client,
    attachment_id: int,
    *,
    status: str,
    reason: str,
    extra: Optional[dict[str, Any]] = None,
) -> None:
    payload = {
        "promotion_status": status,
        "promotion_reason": reason[:500],
        "updated_at": _now_iso(),
    }
    if status == "promoted":
        payload["promoted_at"] = _now_iso()
    if extra:
        payload.update(extra)
    get_outlook_intake_write_client().from_("outlook_email_intake_attachments").update(payload).eq("id", attachment_id).execute()


def _increment_attempt_count(supabase_client, row: dict[str, Any]) -> None:
    current = int(row.get("promotion_attempt_count") or 0)
    get_outlook_intake_write_client().from_("outlook_email_intake_attachments").update(
        {"promotion_attempt_count": current + 1, "updated_at": _now_iso()}
    ).eq("id", row["id"]).execute()


def _project_document_id(supabase_client, *, project_id: int, source_item_id: str) -> Optional[int]:
    response = (
        supabase_client.from_("project_documents")
        .select("id")
        .eq("project_id", project_id)
        .eq("source_system", "outlook_attachment")
        .eq("source_item_id", source_item_id)
        .is_("deleted_at", "null")
        .limit(1)
        .execute()
    )
    rows = response.data or []
    return int(rows[0]["id"]) if rows else None


def _existing_document_for_content_hash(
    supabase_client,
    *,
    content_hash: Optional[str],
    current_doc_id: str,
) -> Optional[dict[str, Any]]:
    if not content_hash:
        return None

    response = (
        supabase_client.from_("document_metadata")
        .select("id, url, storage_bucket, file_path, source_size, source_metadata")
        .eq("content_hash", content_hash)
        .limit(5)
        .execute()
    )
    for row in response.data or []:
        if row.get("id") != current_doc_id:
            return row
    return None


def _load_attachment_bytes_for_promotion(
    *,
    payload_row: dict[str, Any],
    intake: dict[str, Any],
    row: dict[str, Any],
) -> Optional[bytes]:
    raw_bytes = _decode_bytea(payload_row.get("content"))
    if raw_bytes is not None:
        return raw_bytes

    graph_attachment_id = row.get("graph_attachment_id")
    graph_message_id = intake.get("graph_message_id")
    mailbox_user_id = intake.get("mailbox_user_id")
    if not graph_attachment_id or not graph_message_id or not mailbox_user_id:
        return None

    graph = get_graph_client()
    if not graph.is_configured():
        return None

    attachment_stub = {
        "id": graph_attachment_id,
        "name": row.get("file_name") or "attachment",
        "contentType": row.get("content_type") or "application/octet-stream",
        "size": int(row.get("file_size") or 0),
        "isInline": bool(row.get("is_inline")),
    }
    return _attachment_bytes_for_intake(
        graph,
        str(mailbox_user_id),
        str(graph_message_id),
        attachment_stub,
    )


def _promote_attachment(supabase_client, row: dict[str, Any]) -> dict[str, Any]:
    intake = row.get("outlook_email_intake") or {}
    project_id = intake.get("project_id")
    decision = classify_attachment_for_promotion(
        file_name=row.get("file_name") or "",
        content_type=row.get("content_type"),
        is_inline=bool(row.get("is_inline")),
        subject=intake.get("subject") or "",
        body_text=intake.get("body_text") or "",
    )

    if not project_id:
        _update_attachment_status(
            supabase_client,
            row["id"],
            status="review_needed",
            reason="missing_project_assignment",
        )
        return {"status": "review_needed", "reason": "missing_project_assignment"}

    if decision.status != "promoted":
        _update_attachment_status(
            supabase_client,
            row["id"],
            status=decision.status,
            reason=decision.reason,
            extra={"project_id": project_id},
        )
        return {"status": decision.status, "reason": decision.reason}

    payload_row = _fetch_attachment_payload(supabase_client, row["id"], include_content=True)
    file_name = row.get("file_name") or "attachment"
    graph_attachment_id = row.get("graph_attachment_id") or str(row["id"])
    graph_message_id = intake.get("graph_message_id") or str(row.get("intake_email_id"))
    doc_id = _attachment_doc_id(graph_message_id, graph_attachment_id)
    storage_path = str(
        PurePosixPath("outlook-attachments")
        / _storage_safe_name(intake.get("mailbox_user_id") or "mailbox")
        / _stable_graph_id(graph_message_id)
        / f"{_stable_graph_id(graph_attachment_id, 12)}-{_storage_safe_name(file_name)}"
    )
    content_type = row.get("content_type") or mimetypes.guess_type(file_name)[0] or "application/octet-stream"
    raw_bytes = _load_attachment_bytes_for_promotion(
        payload_row=payload_row,
        intake=intake,
        row=row,
    )
    content_hash = payload_row.get("checksum_sha256")
    public_url = intake.get("web_link") or row.get("file_url") or ""
    storage_bucket: Optional[str] = None
    stored_path: Optional[str] = None
    storage_copy_status = "deferred"
    metadata_content_hash = content_hash
    duplicate_of_doc_id: Optional[str] = None

    if raw_bytes:
        if len(raw_bytes) > MAX_ATTACHMENT_BYTES:
            raise ValueError(f"attachment_exceeds_max_bytes:{len(raw_bytes)}")
        content_hash = content_hash or hashlib.sha256(raw_bytes).hexdigest()
        metadata_content_hash = content_hash
        existing_doc = _existing_document_for_content_hash(
            supabase_client,
            content_hash=content_hash,
            current_doc_id=doc_id,
        )
        if existing_doc:
            duplicate_of_doc_id = existing_doc.get("id")
            public_url = existing_doc.get("url") or public_url
            storage_bucket = existing_doc.get("storage_bucket")
            stored_path = existing_doc.get("file_path")
            metadata_content_hash = None
            storage_copy_status = "reused_existing"
        else:
            try:
                storage_upload_with_retry(
                    supabase_client.storage.from_(DOCUMENT_BUCKET),
                    storage_path,
                    raw_bytes,
                    {"content-type": content_type, "upsert": "true"},
                )
            except Exception:
                if not content_type.startswith("image/"):
                    raise
                storage_upload_with_retry(
                    supabase_client.storage.from_(DOCUMENT_BUCKET),
                    storage_path,
                    raw_bytes,
                    {"content-type": "application/octet-stream", "upsert": "true"},
                )
                content_type = "application/octet-stream"
            public_url = _storage_public_url(supabase_client, DOCUMENT_BUCKET, storage_path)
            storage_bucket = DOCUMENT_BUCKET
            stored_path = storage_path
            storage_copy_status = "copied"

    extracted_text = payload_row.get("extracted_text") or ""
    _, ext = os.path.splitext(file_name)
    ext = ext.lower()
    if not extracted_text and raw_bytes and ext in SUPPORTED_EXTENSIONS:
        extracted_text = _extract_text(raw_bytes, ext).replace("\x00", "").strip()

    source_metadata = {
        **(row.get("source_metadata") or {}),
        "promotion_reason": decision.reason,
        "outlook_intake_attachment_id": row["id"],
        "outlook_intake_email_id": row.get("intake_email_id"),
        "outlook_message_id": graph_message_id,
        "outlook_web_link": intake.get("web_link"),
        "assignment_method": intake.get("assignment_method"),
        "assignment_confidence": intake.get("assignment_confidence"),
        "source_file_url": row.get("file_url"),
        "storage_copy_status": storage_copy_status,
        "storage_content_type": content_type,
    }
    if duplicate_of_doc_id:
        source_metadata["duplicate_content_hash_of"] = duplicate_of_doc_id
        source_metadata["original_content_hash"] = content_hash
    content = (
        extracted_text
        or _attachment_metadata_text(
            subject=intake.get("subject") or "",
            sender_name=intake.get("from_name") or intake.get("from_email") or "",
            sender_addr=intake.get("from_email") or "",
            attachment_name=file_name,
            attachment={
                "id": graph_attachment_id,
                "contentType": content_type,
            },
            email_doc_id=str(intake.get("document_metadata_id") or ""),
            email_web_link=intake.get("web_link") or "",
        )
    )[:50000]

    SupabaseRagStore(supabase_client).upsert_document_metadata(
        {
            "id": doc_id,
            "title": file_name,
            "description": f"Attachment from Outlook email: {intake.get('subject') or '(no subject)'}",
            "source": "microsoft_graph",
            "category": decision.category or "Email Attachment",
            "type": "email_attachment",
            "content": content,
            "raw_text": extracted_text[:50000] if extracted_text else None,
            "date": (intake.get("received_at") or "")[:10] or None,
            "url": public_url,
            "participants": intake.get("from_email") or "",
            "status": "raw_ingested" if extracted_text else "metadata_only",
            "tags": ",".join(
                [
                    "outlook_attachment",
                    "inline" if row.get("is_inline") else "attached_file",
                    ext.lstrip(".") if ext else "no_extension",
                    (decision.category or "document").lower().replace(" ", "_"),
                ]
            ),
            "project_id": project_id,
            "source_system": "outlook_attachment",
            "source_item_id": doc_id,
            "source_path": f"outlook/{intake.get('mailbox_user_id')}/{graph_message_id}/{file_name}",
            "source_web_url": intake.get("web_link"),
            "source_size": row.get("file_size"),
            "storage_bucket": storage_bucket,
            "file_path": stored_path,
            "content_hash": metadata_content_hash,
            "source_metadata": source_metadata,
            "workflow_target": "document",
        }
    )

    upsert_project_document_by_source(
        supabase_client,
        {
            "project_id": project_id,
            "folder": "Email Attachments",
            "title": file_name,
            "description": f"Attachment from Outlook email: {intake.get('subject') or '(no subject)'}",
            "file_name": file_name,
            "file_url": public_url,
            "file_size": row.get("file_size"),
            "content_type": content_type,
            "status": "Published",
            "category": decision.category or "Email Attachment",
            "uploaded_by": intake.get("from_email") or intake.get("mailbox_user_id"),
            "created_by": "microsoft_graph",
            "source_system": "outlook_attachment",
            "source_item_id": doc_id,
            "source_path": f"outlook/{intake.get('mailbox_user_id')}/{graph_message_id}/{file_name}",
            "source_web_url": intake.get("web_link"),
            "source_size": row.get("file_size"),
            "sync_status": "synced",
            "last_synced_at": _now_iso(),
            "storage_bucket": storage_bucket,
            "storage_path": stored_path,
            "content_hash": content_hash,
            "workflow_target": "document",
            "source_metadata": source_metadata,
        },
    )

    project_document_id = _project_document_id(supabase_client, project_id=project_id, source_item_id=doc_id)
    _update_attachment_status(
        supabase_client,
        row["id"],
        status="promoted",
        reason=decision.reason,
        extra={
            "project_id": project_id,
            "document_metadata_id": doc_id,
            "project_document_id": project_document_id,
        },
    )
    return {
        "status": "promoted",
        "reason": decision.reason,
        "document_metadata_id": doc_id,
        "project_document_id": project_document_id,
    }


def promote_outlook_intake_attachments(supabase_client, *, limit: int = DEFAULT_LIMIT) -> dict[str, Any]:
    """Promote queued Outlook attachments into document surfaces."""
    limit = max(1, min(int(limit or DEFAULT_LIMIT), MAX_BATCH_LIMIT))
    result: dict[str, Any] = {
        "seen": 0,
        "promoted": 0,
        "skipped": 0,
        "review_needed": 0,
        "failed": 0,
        "failures": [],
    }
    try:
        rows = _select_pending_attachments(supabase_client, limit)
        result["seen"] = len(rows)
    except Exception as exc:
        logger.warning("[OutlookAttachmentPromotion] Failed to load pending attachments: %s", exc, exc_info=True)
        result["failed"] = 1
        result["failures"].append({"stage": "select_pending_attachments", "error": str(exc)[:300]})
        return result

    for row in rows:
        try:
            _increment_attempt_count(supabase_client, row)
            outcome = _promote_attachment(supabase_client, row)
            status = outcome.get("status")
            if status in {"promoted", "skipped", "review_needed"}:
                result[status] += 1
            else:
                result["failed"] += 1
        except Exception as exc:
            logger.warning("[OutlookAttachmentPromotion] Failed attachment id=%s: %s", row.get("id"), exc, exc_info=True)
            result["failed"] += 1
            result["failures"].append({"id": row.get("id"), "error": str(exc)[:300]})
            _update_attachment_status(
                supabase_client,
                row["id"],
                status="failed",
                reason=str(exc),
            )
    return result
