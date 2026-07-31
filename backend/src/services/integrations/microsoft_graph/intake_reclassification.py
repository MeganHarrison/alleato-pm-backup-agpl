"""Stored Outlook intake reclassification helpers."""

from __future__ import annotations

from collections import Counter
from datetime import datetime, timedelta, timezone
from typing import Any
from zoneinfo import ZoneInfo

from ...supabase_helpers import (
    get_outlook_intake_read_client,
    get_outlook_intake_write_client,
    rag_supabase_configured,
)
from .email_classification import EmailIntakeAction, classify_graph_email_for_intake


def run_outlook_intake_reclassification(
    client: Any,
    *,
    mailbox: str | None = None,
    intake_ids: list[int] | None = None,
    days_back: int = 0,
    time_zone: str = "America/New_York",
    limit: int = 500,
    page_size: int = 100,
    apply: bool = False,
    applied_by: str = "outlook_intake_reclassification",
) -> dict[str, Any]:
    """Reclassify stored Outlook intake rows in the AI DB-owned intake store."""

    since = _start_of_day(max(days_back, 0), time_zone)
    safe_page_size = max(1, min(page_size, 500))
    max_rows = max(1, limit)
    offset = 0
    scanned = 0
    updated = 0
    counts: Counter[str] = Counter()
    examples: list[dict[str, Any]] = []

    while scanned < max_rows:
        rows = _fetch_page(
            client,
            mailbox=mailbox,
            intake_ids=intake_ids,
            since=since,
            limit=min(safe_page_size, max_rows - scanned),
            offset=offset,
        )
        if not rows:
            break

        for row in rows:
            msg = _message_from_row(row)
            body_text = str(row.get("body_text") or row.get("body") or "")
            classification = classify_graph_email_for_intake(msg, body_text)
            key = f"{classification.action.value}:{classification.category}"
            counts[key] += 1

            prior_metadata = _source_metadata(row).get("intake_classification")
            prior_action = prior_metadata.get("action") if isinstance(prior_metadata, dict) else None
            should_update = (
                prior_action != classification.action.value
                or classification.action != EmailIntakeAction.IMPORT
            )

            if len(examples) < 25 and classification.action != EmailIntakeAction.IMPORT:
                examples.append(
                    {
                        "id": row.get("id"),
                        "subject": row.get("subject"),
                        "from": row.get("from_email"),
                        "receivedAt": row.get("received_at"),
                        "action": classification.action.value,
                        "category": classification.category,
                        "reason": classification.reason,
                        "signals": list(classification.signals),
                    }
                )

            if apply and should_update:
                payload = _update_payload(row, classification, applied_by=applied_by)
                get_outlook_intake_write_client().from_("outlook_email_intake").update(payload).eq("id", row["id"]).execute()
                updated += 1

            scanned += 1

        offset += len(rows)
        if len(rows) < safe_page_size or intake_ids:
            break

    return {
        "status": "complete",
        "mode": "apply" if apply else "dry_run",
        "database": "rag" if rag_supabase_configured() else "app",
        "table": "outlook_email_intake",
        "mailbox": mailbox,
        "intakeIds": intake_ids or [],
        "since": since.isoformat(),
        "scanned": scanned,
        "updated": updated,
        "counts": dict(sorted(counts.items())),
        "examples": examples,
    }


def _start_of_day(days_back: int, time_zone: str) -> datetime:
    tz = ZoneInfo(time_zone)
    now = datetime.now(tz)
    local_start = now.replace(hour=0, minute=0, second=0, microsecond=0) - timedelta(days=days_back)
    return local_start.astimezone(timezone.utc)


def _source_metadata(row: dict[str, Any]) -> dict[str, Any]:
    value = row.get("source_metadata")
    return dict(value) if isinstance(value, dict) else {}


def _message_from_row(row: dict[str, Any]) -> dict[str, Any]:
    return {
        "id": row.get("graph_message_id") or str(row.get("id") or ""),
        "subject": row.get("subject") or "",
        "bodyPreview": row.get("body_text") or row.get("body") or "",
        "hasAttachments": bool(row.get("has_attachments")),
        "webLink": row.get("web_link"),
        "internetMessageId": row.get("internet_message_id"),
        "conversationId": row.get("conversation_id"),
        "receivedDateTime": row.get("received_at"),
        "internetMessageHeaders": [],
        "from": {
            "emailAddress": {
                "name": row.get("from_name") or row.get("from_email") or "",
                "address": row.get("from_email") or "",
            }
        },
    }


def _update_payload(row: dict[str, Any], classification: Any, *, applied_by: str) -> dict[str, Any]:
    metadata = _source_metadata(row)
    metadata["intake_classification"] = classification.as_metadata()
    metadata["intake_reclassified"] = {
        "at": datetime.now(timezone.utc).isoformat(),
        "by": applied_by,
    }

    payload: dict[str, Any] = {"source_metadata": metadata}
    if classification.action.value == "skip":
        payload["match_status"] = "ignored"
        payload["assignment_method"] = "intake_classification_skip_backfill"
        payload["assignment_confidence"] = classification.confidence
    elif classification.action.value == "quarantine":
        payload["assignment_method"] = "intake_classification_quarantine_backfill"
        payload["assignment_confidence"] = classification.confidence
    return payload


def _fetch_page(
    client: Any,
    *,
    mailbox: str | None,
    intake_ids: list[int] | None,
    since: datetime,
    limit: int,
    offset: int,
) -> list[dict[str, Any]]:
    query = (
        get_outlook_intake_read_client().from_("outlook_email_intake")
        .select(
            "id,graph_message_id,mailbox_user_id,subject,body,body_text,from_name,from_email,"
            "match_status,assignment_method,assignment_confidence,received_at,has_attachments,"
            "web_link,internet_message_id,conversation_id,source_metadata"
        )
        .is_("deleted_at", "null")
        .order("received_at", desc=True)
        .range(offset, offset + limit - 1)
    )
    if intake_ids:
        query = query.in_("id", intake_ids)
    else:
        query = query.gte("received_at", since.isoformat())
        if mailbox:
            query = query.eq("mailbox_user_id", mailbox)
    result = query.execute()
    return list(result.data or [])
