"""Compile Outlook raw intake rows into conversation-level RAG documents."""

from __future__ import annotations

import hashlib
import logging
import os
import re
from datetime import datetime, timezone
from typing import Any, Iterable, Optional

from ...supabase_helpers import SupabaseRagStore, get_outlook_intake_read_client

logger = logging.getLogger(__name__)

DEFAULT_CONVERSATION_LIMIT = int(os.environ.get("OUTLOOK_CONVERSATION_COMPILE_LIMIT", "25"))
DEFAULT_MAX_MESSAGES_PER_CONVERSATION = int(
    os.environ.get("OUTLOOK_CONVERSATION_MAX_MESSAGES", "200")
)
BODY_MAX_CHARS = int(os.environ.get("OUTLOOK_CONVERSATION_MESSAGE_BODY_MAX_CHARS", "8000"))
CONVERSATION_CONTENT_MAX_CHARS = int(
    os.environ.get("OUTLOOK_CONVERSATION_CONTENT_MAX_CHARS", "200000")
)
SELECT_COLUMNS = (
    "id,graph_message_id,mailbox_user_id,conversation_id,subject,body,body_text,"
    "from_name,from_email,to_list,cc_list,project_id,document_metadata_id,"
    "received_at,web_link,internet_message_id,source_metadata,has_attachments,deleted_at"
)


def _sha256(value: str) -> str:
    return hashlib.sha256(value.encode("utf-8")).hexdigest()


def _stable_doc_id(mailbox_user_id: str, group_key: str) -> str:
    return f"outlook_conversation_{_sha256(f'{mailbox_user_id}|{group_key}')[:32]}"


def _normalize_subject(subject: object) -> str:
    value = re.sub(r"^\s*(re|fw|fwd):\s*", "", str(subject or ""), flags=re.IGNORECASE)
    value = re.sub(r"\s+", " ", value).strip()
    return value or "(no subject)"


def _conversation_group_key(row: dict[str, Any]) -> str:
    conversation_id = str(row.get("conversation_id") or "").strip()
    if conversation_id:
        return f"conversation:{conversation_id}"
    mailbox = str(row.get("mailbox_user_id") or "").strip().lower()
    subject = _normalize_subject(row.get("subject")).lower()
    return f"fallback_subject:{_sha256(f'{mailbox}|{subject}')[:20]}"


def _parse_datetime(value: object) -> datetime:
    if isinstance(value, datetime):
        return value if value.tzinfo else value.replace(tzinfo=timezone.utc)
    text = str(value or "").strip()
    if not text:
        return datetime.min.replace(tzinfo=timezone.utc)
    try:
        return datetime.fromisoformat(text.replace("Z", "+00:00"))
    except ValueError:
        return datetime.min.replace(tzinfo=timezone.utc)


def _dedupe(values: Iterable[object]) -> list[str]:
    seen: set[str] = set()
    result: list[str] = []
    for value in values:
        text = str(value or "").strip()
        if not text:
            continue
        key = text.lower()
        if key in seen:
            continue
        seen.add(key)
        result.append(text)
    return result


def _participants_for_row(row: dict[str, Any]) -> list[str]:
    participants: list[object] = []
    from_email = row.get("from_email")
    from_name = row.get("from_name")
    if from_email:
        participants.append(f"{from_name or ''} <{from_email}>".strip())
    elif from_name:
        participants.append(from_name)

    for key in ("to_list", "cc_list"):
        values = row.get(key)
        if isinstance(values, list):
            participants.extend(values)
    return _dedupe(participants)


def _body_for_row(row: dict[str, Any]) -> str:
    body = str(row.get("body_text") or row.get("body") or "").strip()
    body = re.sub(r"\r\n?", "\n", body)
    body = re.sub(r"\n{3,}", "\n\n", body)
    return body[:BODY_MAX_CHARS].strip()


def _format_message(row: dict[str, Any]) -> str:
    timestamp = str(row.get("received_at") or "").strip() or "unknown time"
    sender = " ".join(
        part for part in (str(row.get("from_name") or "").strip(), f"<{row.get('from_email')}>")
        if part and part != "<None>"
    ).strip()
    recipients = _dedupe((row.get("to_list") or []) + (row.get("cc_list") or []))
    header = [
        f"### {timestamp}",
        f"From: {sender or 'unknown sender'}",
        f"Subject: {_normalize_subject(row.get('subject'))}",
    ]
    if recipients:
        header.append(f"Participants: {', '.join(recipients)}")
    if row.get("web_link"):
        header.append(f"Outlook link: {row['web_link']}")
    body = _body_for_row(row)
    return "\n".join(header + ["", body or "[No body text captured]"]).strip()


def _project_id_for_rows(rows: list[dict[str, Any]]) -> Optional[int]:
    project_ids = sorted(
        {int(row["project_id"]) for row in rows if row.get("project_id") is not None}
    )
    if len(project_ids) > 1:
        intake_ids = sorted(str(row.get("id")) for row in rows if row.get("id") is not None)
        raise ValueError(
            "Outlook conversation has conflicting project assignments to "
            f"projects {', '.join(str(project_id) for project_id in project_ids)} "
            f"across intake rows {', '.join(intake_ids)}. Repair attribution before compiling."
        )
    return project_ids[0] if project_ids else None


def _source_metadata_for_rows(
    rows: list[dict[str, Any]],
    *,
    group_key: str,
    content_hash: str,
) -> dict[str, Any]:
    first = rows[0]
    latest = rows[-1]
    conversation_id = str(first.get("conversation_id") or "").strip() or None
    return {
        "document_kind": "outlook_conversation",
        "compiler": "outlook_conversation_compiler",
        "compiled_from": "outlook_email_intake",
        "content_hash": content_hash,
        "mailbox_user_id": first.get("mailbox_user_id"),
        "conversation_id": conversation_id,
        "conversation_group_key": group_key,
        "fallback_group": conversation_id is None,
        "message_count": len(rows),
        "source_message_ids": [
            row.get("graph_message_id") for row in rows if row.get("graph_message_id")
        ],
        "source_intake_ids": [row.get("id") for row in rows if row.get("id") is not None],
        "earliest_message_at": rows[0].get("received_at"),
        "latest_message_at": latest.get("received_at"),
        "latest_source_web_url": latest.get("web_link"),
    }


def compile_conversation_payload(rows: list[dict[str, Any]]) -> dict[str, Any]:
    """Build a deterministic document_metadata payload from one Outlook thread."""
    active_rows = [dict(row) for row in rows if not row.get("deleted_at")]
    if not active_rows:
        raise ValueError("Cannot compile Outlook conversation with no active rows")
    active_rows.sort(key=lambda row: (_parse_datetime(row.get("received_at")), str(row.get("id") or "")))

    first = active_rows[0]
    latest = active_rows[-1]
    mailbox = str(first.get("mailbox_user_id") or "").strip()
    if not mailbox:
        raise ValueError("Outlook conversation row is missing mailbox_user_id")

    group_key = _conversation_group_key(first)
    doc_id = _stable_doc_id(mailbox, group_key)
    subject = _normalize_subject(latest.get("subject") or first.get("subject"))
    participants = _dedupe(
        participant for row in active_rows for participant in _participants_for_row(row)
    )
    content = "\n\n".join(
        [
            f"# Outlook Conversation: {subject}",
            f"Mailbox: {mailbox}",
            f"Conversation key: {group_key}",
            f"Message count: {len(active_rows)}",
            f"Participants: {', '.join(participants) if participants else 'unknown'}",
            "---",
            *[_format_message(row) for row in active_rows],
        ]
    ).strip()
    if len(content) > CONVERSATION_CONTENT_MAX_CHARS:
        content = (
            content[:CONVERSATION_CONTENT_MAX_CHARS].rstrip()
            + "\n\n[Conversation content truncated by OUTLOOK_CONVERSATION_CONTENT_MAX_CHARS]"
        )
    content_hash = _sha256(content)
    source_metadata = _source_metadata_for_rows(
        active_rows,
        group_key=group_key,
        content_hash=content_hash,
    )
    now_iso = datetime.now(timezone.utc).isoformat()

    return {
        "id": doc_id,
        "title": f"Outlook conversation: {subject}",
        "type": "email",
        "category": "email",
        "document_type": "email_message",
        "source": "microsoft_graph",
        "source_system": "outlook",
        "source_item_id": group_key,
        "project_id": _project_id_for_rows(active_rows),
        "status": "raw_ingested",
        "content": content,
        "raw_text": content,
        "content_hash": content_hash,
        "participants": ", ".join(participants) if participants else None,
        "participants_array": participants or None,
        "date": latest.get("received_at"),
        "captured_at": latest.get("received_at"),
        "source_web_url": latest.get("web_link"),
        "url": latest.get("web_link"),
        "source_metadata": source_metadata,
        "processing_metadata": {
            "source_type": "outlook_conversation",
            "compiled_from": "outlook_email_intake",
            "message_count": len(active_rows),
        },
        "updated_at": now_iso,
    }


def _fetch_recent_rows(
    *,
    mailbox_user_id: Optional[str],
    since: Optional[str],
    limit: int,
) -> list[dict[str, Any]]:
    query = (
        get_outlook_intake_read_client()
        .from_("outlook_email_intake")
        .select(SELECT_COLUMNS)
        .is_("deleted_at", "null")
        .order("received_at", desc=True)
        .limit(limit)
    )
    if mailbox_user_id:
        query = query.eq("mailbox_user_id", mailbox_user_id)
    if since:
        query = query.gte("received_at", since)
    return [dict(row) for row in (query.execute().data or [])]


def _fetch_conversation_rows(
    *,
    mailbox_user_id: str,
    conversation_id: str,
    max_messages: int,
) -> list[dict[str, Any]]:
    return [
        dict(row)
        for row in (
            get_outlook_intake_read_client()
            .from_("outlook_email_intake")
            .select(SELECT_COLUMNS)
            .eq("mailbox_user_id", mailbox_user_id)
            .eq("conversation_id", conversation_id)
            .is_("deleted_at", "null")
            .order("received_at", desc=False)
            .limit(max_messages)
            .execute()
            .data
            or []
        )
    ]


def _existing_content_hash(store: SupabaseRagStore, document_id: str) -> Optional[str]:
    existing = store.fetch_rag_document_metadata(document_id) or {}
    if not existing.get("content") and not existing.get("raw_text"):
        return None
    source_metadata = existing.get("source_metadata") if isinstance(existing, dict) else {}
    if not isinstance(source_metadata, dict):
        source_metadata = {}
    return existing.get("content_hash") or source_metadata.get("content_hash")


def compile_outlook_conversations(
    supabase_client,
    *,
    mailbox_user_id: Optional[str] = None,
    since: Optional[str] = None,
    limit: Optional[int] = None,
    max_messages_per_conversation: Optional[int] = None,
) -> dict[str, Any]:
    """Compile a bounded set of changed Outlook conversations into RAG docs."""
    resolved_limit = max(1, min(int(limit or DEFAULT_CONVERSATION_LIMIT), 200))
    resolved_max_messages = max(
        1,
        min(int(max_messages_per_conversation or DEFAULT_MAX_MESSAGES_PER_CONVERSATION), 500),
    )
    recent_rows = _fetch_recent_rows(
        mailbox_user_id=mailbox_user_id,
        since=since,
        limit=resolved_limit,
    )
    store = SupabaseRagStore(supabase_client)
    stats: dict[str, Any] = {
        "status": "complete",
        "mailbox_user_id": mailbox_user_id,
        "recent_rows": len(recent_rows),
        "conversations_seen": 0,
        "compiled": 0,
        "unchanged": 0,
        "failed": 0,
        "documents": [],
        "errors": [],
    }
    seen_groups: set[tuple[str, str]] = set()

    for seed_row in recent_rows:
        mailbox = str(seed_row.get("mailbox_user_id") or "").strip()
        group_key = _conversation_group_key(seed_row)
        group_id = (mailbox, group_key)
        if not mailbox or group_id in seen_groups:
            continue
        seen_groups.add(group_id)
        stats["conversations_seen"] = int(stats["conversations_seen"]) + 1

        try:
            conversation_id = str(seed_row.get("conversation_id") or "").strip()
            rows = (
                _fetch_conversation_rows(
                    mailbox_user_id=mailbox,
                    conversation_id=conversation_id,
                    max_messages=resolved_max_messages,
                )
                if conversation_id
                else [seed_row]
            )
            payload = compile_conversation_payload(rows or [seed_row])
            existing_hash = _existing_content_hash(store, str(payload["id"]))
            if existing_hash == payload["content_hash"]:
                stats["unchanged"] = int(stats["unchanged"]) + 1
                continue
            store.upsert_document_metadata(payload)
            stats["compiled"] = int(stats["compiled"]) + 1
            stats["documents"].append(
                {
                    "id": payload["id"],
                    "content_hash": payload["content_hash"],
                    "message_count": payload["source_metadata"]["message_count"],
                    "project_id": payload.get("project_id"),
                }
            )
        except Exception as exc:  # noqa: BLE001 - compiler failures must surface downstream
            stats["failed"] = int(stats["failed"]) + 1
            error = f"{mailbox or 'unknown mailbox'} {group_key}: {exc}"
            stats["errors"].append(error)
            logger.error("[OutlookConversation] Failed to compile %s: %s", group_id, exc, exc_info=True)

    if stats["failed"]:
        stats["status"] = "complete_with_errors" if stats["compiled"] or stats["unchanged"] else "failed"
    return stats
