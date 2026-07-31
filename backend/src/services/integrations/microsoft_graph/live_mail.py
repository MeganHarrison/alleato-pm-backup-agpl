"""Live Microsoft Graph mail reads for assistant inbox/operator workflows."""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Dict, List, Optional
from urllib.parse import quote, urlencode

from .client import get_graph_client


def _recipient_emails(values: Any) -> List[str]:
    if not isinstance(values, list):
        return []
    emails: List[str] = []
    for value in values:
        if not isinstance(value, dict):
            continue
        email_address = value.get("emailAddress")
        if not isinstance(email_address, dict):
            continue
        address = str(email_address.get("address") or "").strip().lower()
        if address:
            emails.append(address)
    return emails


def _normalize_message(message: Dict[str, Any], mailbox_user_id: str) -> Dict[str, Any]:
    sender = message.get("from") if isinstance(message.get("from"), dict) else {}
    sender_address = (
        sender.get("emailAddress") if isinstance(sender.get("emailAddress"), dict) else {}
    )
    return {
        "id": message.get("id") or "",
        "graph_message_id": message.get("id") or "",
        "conversation_id": message.get("conversationId"),
        "subject": str(message.get("subject") or "(no subject)").strip() or "(no subject)",
        "from_name": sender_address.get("name"),
        "from_email": str(sender_address.get("address") or "").strip().lower() or None,
        "to_list": _recipient_emails(message.get("toRecipients")),
        "cc_list": _recipient_emails(message.get("ccRecipients")),
        "received_at": message.get("receivedDateTime"),
        "mailbox_user_id": mailbox_user_id,
        "body_text": message.get("bodyPreview"),
        "has_attachments": bool(message.get("hasAttachments")),
        "web_link": message.get("webLink"),
        "importance": message.get("importance"),
        "is_read": message.get("isRead") if isinstance(message.get("isRead"), bool) else None,
    }


def list_live_outlook_inbox(
    *,
    mailbox_user_id: str,
    since_iso: Optional[str] = None,
    limit: int = 50,
    unread_only: bool = False,
) -> Dict[str, Any]:
    """Read the live Outlook inbox via Microsoft Graph.

    This is the source of truth for "what is in my inbox right now?" assistant
    prompts. Synced database tables are fallback/cache only.
    """
    mailbox = mailbox_user_id.strip().lower()
    if not mailbox or "@" not in mailbox:
        raise ValueError("mailbox_user_id must be a valid mailbox email address")

    graph = get_graph_client()
    if not graph.is_configured():
        raise RuntimeError(
            "Microsoft Graph credentials are not configured. Set MICROSOFT_CLIENT_ID, "
            "MICROSOFT_CLIENT_SECRET, and MICROSOFT_TENANT_ID."
        )

    safe_limit = max(1, min(int(limit or 50), 100))
    select_fields = ",".join(
        [
            "id",
            "conversationId",
            "subject",
            "from",
            "toRecipients",
            "ccRecipients",
            "receivedDateTime",
            "bodyPreview",
            "hasAttachments",
            "webLink",
            "importance",
            "isRead",
        ]
    )
    query_params = {
        "$select": select_fields,
        "$orderby": "receivedDateTime desc",
        "$top": str(safe_limit),
    }
    filters = []
    if since_iso:
        filters.append(f"receivedDateTime ge {since_iso}")
    if unread_only:
        filters.append("isRead eq false")
    if filters:
        query_params["$filter"] = " and ".join(filters)

    path = (
        f"/users/{quote(mailbox)}/mailFolders/Inbox/messages?"
        + urlencode(query_params)
    )
    data = graph._get_with_retry(
        f"{graph.GRAPH_BASE}{path}",
        max_retries=1,
        base_delay=0.5,
    )
    raw_messages = data.get("value") if isinstance(data, dict) else []
    messages = [
        _normalize_message(message, mailbox)
        for message in raw_messages
        if isinstance(message, dict)
    ]
    return {
        "source": "microsoft_graph_live",
        "mailbox_user_id": mailbox,
        "since_iso": since_iso,
        "unread_only": unread_only,
        "fetched_at": datetime.now(timezone.utc).isoformat(),
        "count": len(messages),
        "messages": messages,
        "truncated": bool(isinstance(data, dict) and data.get("@odata.nextLink")),
    }
