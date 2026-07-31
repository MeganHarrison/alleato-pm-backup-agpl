"""Runtime tools for the Microsoft Executive Assistant backend agent."""

from __future__ import annotations

import json
import logging
import os
import re
from datetime import datetime, timedelta, timezone
from typing import Any, Optional
from urllib.parse import quote, urlencode

import httpx
from langchain_core.tools import tool

logger = logging.getLogger(__name__)


def _json(data: dict[str, Any]) -> str:
    return json.dumps(data, ensure_ascii=False, indent=2, default=str)


def _bounded_int(value: int, *, minimum: int, maximum: int) -> int:
    return max(minimum, min(maximum, int(value)))


def _clean_text(value: str) -> str:
    return re.sub(r"\s+", " ", value).strip()


def _invoke_tool(candidate: Any, payload: dict[str, Any]) -> str:
    if hasattr(candidate, "invoke"):
        return str(candidate.invoke(payload))
    if hasattr(candidate, "func"):
        try:
            return str(candidate.func(**payload))
        except TypeError:
            return str(candidate.func(*payload.values()))
    return str(candidate(**payload))


@tool
def read_live_outlook_inbox(
    mailbox_user_id: str,
    since_iso: Optional[str] = None,
    limit: int = 25,
    unread_only: bool = False,
) -> str:
    """Read recent live Outlook inbox messages through Microsoft Graph."""
    try:
        from src.services.integrations.microsoft_graph.live_mail import list_live_outlook_inbox

        result = list_live_outlook_inbox(
            mailbox_user_id=mailbox_user_id,
            since_iso=since_iso,
            limit=_bounded_int(limit, minimum=1, maximum=100),
            unread_only=unread_only,
        )
        return _json({"ok": True, **result})
    except Exception as exc:
        return _json(
            {
                "ok": False,
                "error": (
                    "OUTLOOK_LIVE_INBOX_FAILED: Microsoft Graph live inbox read failed. "
                    f"Failed capability: read_live_outlook_inbox. Detail: {type(exc).__name__}: {exc}"
                ),
            }
        )


@tool
def search_outlook_emails(
    query: str,
    from_address: Optional[str] = None,
    date_from: Optional[str] = None,
    max_results: int = 10,
) -> str:
    """Search synced Outlook email content in the Alleato RAG corpus."""
    trimmed = _clean_text(query)
    if not trimmed:
        return "EMAIL_SEARCH_FAILED: query must not be blank."
    try:
        from src.services.agents.alleato_ai_tools.graph_api import search_emails

        return _invoke_tool(
            search_emails,
            {
                "query": trimmed,
                "from_address": from_address,
                "date_from": date_from,
                "max_results": _bounded_int(max_results, minimum=1, maximum=20),
            },
        )
    except Exception as exc:
        return f"EMAIL_SEARCH_FAILED: Failed capability: search_outlook_emails. Detail: {type(exc).__name__}: {exc}"


@tool
def search_microsoft_teams_messages(
    query: str,
    channel: Optional[str] = None,
    date_from: Optional[str] = None,
    max_results: int = 10,
) -> str:
    """Search synced Microsoft Teams messages in the Alleato RAG corpus."""
    trimmed = _clean_text(query)
    if not trimmed:
        return "TEAMS_SEARCH_FAILED: query must not be blank."
    try:
        from src.services.agents.alleato_ai_tools.graph_api import search_teams_messages

        return _invoke_tool(
            search_teams_messages,
            {
                "query": trimmed,
                "channel": channel,
                "date_from": date_from,
                "max_results": _bounded_int(max_results, minimum=1, maximum=20),
            },
        )
    except Exception as exc:
        return f"TEAMS_SEARCH_FAILED: Failed capability: search_microsoft_teams_messages. Detail: {type(exc).__name__}: {exc}"


@tool
def search_microsoft_files(query: str, date_from: Optional[str] = None, max_results: int = 10) -> str:
    """Search Microsoft/SharePoint/OneDrive files already indexed into Alleato RAG."""
    trimmed = _clean_text(query)
    if not trimmed:
        return "MICROSOFT_FILE_SEARCH_FAILED: query must not be blank."
    try:
        from src.services.agents.alleato_ai_tools.rag import _format_results, retrieve

        rows = retrieve(
            query=trimmed,
            source_types=["document", "email_attachment"],
            date_from=date_from,
            max_results=_bounded_int(max_results, minimum=1, maximum=20),
        )
        return _format_results(rows)
    except Exception as exc:
        return f"MICROSOFT_FILE_SEARCH_FAILED: Failed capability: search_microsoft_files. Detail: {type(exc).__name__}: {exc}"


@tool
def list_outlook_calendar_events(
    mailbox_user_id: str,
    start_iso: str,
    end_iso: Optional[str] = None,
    limit: int = 25,
) -> str:
    """List Outlook calendar events in a date window through Microsoft Graph."""
    try:
        from src.services.integrations.microsoft_graph.client import get_graph_client

        graph = get_graph_client()
        if not graph.is_configured():
            return _json(
                {
                    "ok": False,
                    "error": (
                        "OUTLOOK_CALENDAR_UNAVAILABLE: Microsoft Graph credentials are not configured. "
                        "Set MICROSOFT_CLIENT_ID, MICROSOFT_CLIENT_SECRET, and MICROSOFT_TENANT_ID."
                    ),
                }
            )

        start = datetime.fromisoformat(start_iso.replace("Z", "+00:00"))
        end = (
            datetime.fromisoformat(end_iso.replace("Z", "+00:00"))
            if end_iso
            else start + timedelta(days=1)
        )
        params = {
            "startDateTime": start.astimezone(timezone.utc).isoformat().replace("+00:00", "Z"),
            "endDateTime": end.astimezone(timezone.utc).isoformat().replace("+00:00", "Z"),
            "$select": "id,subject,start,end,organizer,attendees,webLink,isCancelled,showAs",
            "$orderby": "start/dateTime",
            "$top": str(_bounded_int(limit, minimum=1, maximum=50)),
        }
        path = f"/users/{quote(mailbox_user_id.strip().lower())}/calendarView?{urlencode(params)}"
        data = graph.get(path)
        events = data.get("value") if isinstance(data, dict) else []
        return _json(
            {
                "ok": True,
                "source": "microsoft_graph_calendar",
                "mailboxUserId": mailbox_user_id.strip().lower(),
                "count": len(events or []),
                "events": events or [],
            }
        )
    except Exception as exc:
        return _json(
            {
                "ok": False,
                "error": (
                    "OUTLOOK_CALENDAR_FAILED: Microsoft Graph calendar read failed. "
                    f"Failed capability: list_outlook_calendar_events. Detail: {type(exc).__name__}: {exc}"
                ),
            }
        )


def _auto_draft_enabled() -> bool:
    return os.getenv("MICROSOFT_EXECUTIVE_ASSISTANT_AUTO_DRAFT", "true").lower() in {"1", "true", "yes"}


def _mailbox_mutations_enabled() -> bool:
    return os.getenv("MICROSOFT_EXECUTIVE_ASSISTANT_MAILBOX_MUTATIONS_ENABLED", "false").lower() in {
        "1",
        "true",
        "yes",
    }


def _auto_teams_alert_enabled() -> bool:
    return os.getenv("MICROSOFT_EXECUTIVE_ASSISTANT_AUTO_TEAMS_ALERT", "true").lower() in {"1", "true", "yes"}


def _notification_service_key() -> Optional[str]:
    return os.getenv("NOTIFICATION_SERVICE_KEY") or None


def _app_base_url() -> str:
    return (
        os.getenv("NEXT_PUBLIC_APP_URL")
        or os.getenv("APP_BASE_URL")
        or "https://projects.alleatogroup.com"
    ).rstrip("/")


def _operator_teams_user_id() -> Optional[str]:
    return (
        os.getenv("MICROSOFT_EXECUTIVE_ASSISTANT_TEAMS_USER_ID")
        or os.getenv("AI_HEALTH_ALERT_TEAMS_USER_ID")
        or None
    )


def _send_teams_dm(message: str) -> dict[str, Any]:
    """Post a Teams DM via the Archon bot proactive endpoint. Best-effort, never raises."""
    service_key = _notification_service_key()
    user_id = _operator_teams_user_id()
    if not service_key or not user_id:
        missing = []
        if not service_key:
            missing.append("NOTIFICATION_SERVICE_KEY")
        if not user_id:
            missing.append("MICROSOFT_EXECUTIVE_ASSISTANT_TEAMS_USER_ID")
        logger.warning("[ExecAssistant] Teams DM skipped — missing env: %s", ", ".join(missing))
        return {"sent": False, "reason": f"missing_env:{','.join(missing)}"}
    try:
        resp = httpx.post(
            f"{_app_base_url()}/api/bot/proactive/teams",
            headers={"Authorization": f"Bearer {service_key}"},
            json={"userId": user_id, "message": message},
            timeout=15,
        )
        if resp.status_code >= 400:
            logger.warning("[ExecAssistant] Teams DM HTTP %s: %s", resp.status_code, resp.text[:200])
            return {"sent": False, "http_status": resp.status_code}
        return {"sent": True, "http_status": resp.status_code}
    except Exception as exc:
        logger.warning("[ExecAssistant] Teams DM failed: %s", exc)
        return {"sent": False, "error": str(exc)}


def _claim_teams_alert_delivery(graph_message_id: str) -> dict[str, Any]:
    """Atomically claim Teams alert delivery for one synced Outlook email."""
    message_id = _clean_text(graph_message_id)
    if not message_id:
        return {
            "claimed": False,
            "reason": "missing_graph_message_id",
            "detail": "Urgent Teams auto-alerts require graph_message_id so delivery can be deduped.",
        }

    client = _supabase_client()
    if not client:
        return {
            "claimed": False,
            "reason": "supabase_not_configured",
            "detail": "Urgent Teams auto-alert blocked because the outlook_email_intake dedupe ledger is unavailable.",
        }

    claimed_at = datetime.now(timezone.utc).isoformat()
    try:
        response = (
            client.table("outlook_email_intake")
            .update({"teams_alert_sent_at": claimed_at})
            .eq("graph_message_id", message_id)
            .is_("teams_alert_sent_at", "null")
            .execute()
        )
        matched = len(response.data or [])
        if matched > 0:
            return {"claimed": True, "graphMessageId": message_id, "claimedAt": claimed_at, "matchedRows": matched}

        existing = (
            client.table("outlook_email_intake")
            .select("graph_message_id,teams_alert_sent_at")
            .eq("graph_message_id", message_id)
            .limit(1)
            .execute()
        )
        rows = existing.data or []
        if rows and rows[0].get("teams_alert_sent_at"):
            return {
                "claimed": False,
                "reason": "duplicate",
                "graphMessageId": message_id,
                "teamsAlertSentAt": rows[0].get("teams_alert_sent_at"),
            }

        return {
            "claimed": False,
            "reason": "no_matching_row",
            "graphMessageId": message_id,
            "detail": (
                "Urgent Teams auto-alert blocked because no outlook_email_intake row matched "
                "graph_message_id. Run Outlook intake sync before alert delivery."
            ),
        }
    except Exception as exc:
        logger.warning("[ExecAssistant] Teams alert dedupe claim failed: %s", exc)
        return {"claimed": False, "reason": "dedupe_claim_failed", "graphMessageId": message_id, "error": str(exc)}


def _release_teams_alert_delivery_claim(graph_message_id: str) -> None:
    """Clear a claimed Teams alert timestamp when the downstream Teams send fails."""
    message_id = _clean_text(graph_message_id)
    if not message_id:
        return
    try:
        client = _supabase_client()
        if client:
            (
                client.table("outlook_email_intake")
                .update({"teams_alert_sent_at": None})
                .eq("graph_message_id", message_id)
                .execute()
            )
    except Exception as exc:
        logger.warning("[ExecAssistant] Teams alert dedupe claim release failed: %s", exc)


def _create_graph_draft(
    *,
    mailbox: str,
    to_recipients: list[str],
    subject: str,
    body: str,
    cc_recipients: list[str],
    reply_to_message_id: Optional[str],
) -> dict[str, Any]:
    """Create an Outlook draft in the mailbox via Microsoft Graph. Best-effort, never raises."""
    try:
        from src.services.integrations.microsoft_graph.client import get_graph_client

        graph = get_graph_client()
        if not graph.is_configured():
            return {"created": False, "reason": "graph_not_configured"}

        safe_mailbox = mailbox.strip().lower()

        if reply_to_message_id:
            # Threaded reply draft — lands in Drafts folder, pre-threads the conversation
            reply_resp = graph.post(
                f"/users/{quote(safe_mailbox)}/messages/{reply_to_message_id}/createReply",
                {},
            )
            draft_id = reply_resp.get("id")
            if not draft_id:
                return {"created": False, "reason": "no_draft_id_from_createReply"}
            # Patch the draft body now that we have the draft ID
            graph.patch(
                f"/users/{quote(safe_mailbox)}/messages/{draft_id}",
                {"body": {"contentType": "Text", "content": body}},
            )
        else:
            # Standalone new draft
            recipient_objects = [{"emailAddress": {"address": r}} for r in to_recipients]
            cc_objects = [{"emailAddress": {"address": c}} for c in cc_recipients]
            msg_payload: dict[str, Any] = {
                "subject": subject,
                "body": {"contentType": "Text", "content": body},
                "toRecipients": recipient_objects,
                "isDraft": True,
            }
            if cc_objects:
                msg_payload["ccRecipients"] = cc_objects
            reply_resp = graph.post(f"/users/{quote(safe_mailbox)}/messages", msg_payload)
            draft_id = reply_resp.get("id")
            if not draft_id:
                return {"created": False, "reason": "no_draft_id_from_new_message"}

        return {"created": True, "draftId": draft_id, "mailbox": safe_mailbox}
    except Exception as exc:
        logger.warning("[ExecAssistant] Graph draft creation failed: %s", exc)
        return {"created": False, "error": str(exc)}


@tool
def draft_outlook_email_for_review(
    to_recipients: list[str],
    subject: str,
    body: str,
    mailbox_user_id: Optional[str] = None,
    cc_recipients: Optional[list[str]] = None,
    reply_to_graph_message_id: Optional[str] = None,
) -> str:
    """Create an Outlook email draft in the operator's Drafts folder for review. Never sends.

    When MICROSOFT_EXECUTIVE_ASSISTANT_AUTO_DRAFT is true (default), the draft is written
    directly to the Outlook Drafts folder via Microsoft Graph so Brandon can find it in
    Outlook and send or edit it. The draft is never sent automatically.
    """
    if not to_recipients and not reply_to_graph_message_id:
        return "OUTLOOK_DRAFT_BLOCKED: Provide recipients or reply_to_graph_message_id before drafting."

    mailbox = (
        mailbox_user_id
        or os.getenv("MICROSOFT_EXECUTIVE_ASSISTANT_MAILBOX")
        or (os.getenv("MICROSOFT_SYNC_USERS", "").split(",")[0].strip() or None)
    )

    graph_result: dict[str, Any] = {"created": False, "reason": "auto_draft_disabled"}
    if _auto_draft_enabled() and _mailbox_mutations_enabled() and mailbox:
        graph_result = _create_graph_draft(
            mailbox=mailbox,
            to_recipients=to_recipients,
            subject=subject,
            body=body,
            cc_recipients=cc_recipients or [],
            reply_to_message_id=reply_to_graph_message_id,
        )
    elif _auto_draft_enabled() and not _mailbox_mutations_enabled():
        logger.warning(
            "[ExecAssistant] MAILBOX_MUTATION_BLOCKED action=outlook_draft mailbox=%s reason=mailbox_mutations_disabled",
            mailbox or "<missing>",
        )
        graph_result = {"created": False, "reason": "mailbox_mutations_disabled"}

    payload = {
        "action": "draft_created" if graph_result.get("created") else "preview",
        "type": "outlook_email_draft",
        "approvalRequired": True,
        "approvalReason": "Draft saved to Outlook Drafts — Brandon reviews and sends from Outlook.",
        "graphResult": graph_result,
        "fields": {
            "mailbox": mailbox,
            "toRecipients": to_recipients,
            "ccRecipients": cc_recipients or [],
            "subject": subject,
            "body": body,
            "replyToGraphMessageId": reply_to_graph_message_id,
        },
    }
    return _json(payload)


@tool
def draft_teams_message_for_review(
    recipient: str,
    message: str,
    urgency: str = "normal",
    graph_message_id: Optional[str] = None,
) -> str:
    """Send or prepare a Teams DM for Brandon's awareness.

    When urgency is "urgent" and MICROSOFT_EXECUTIVE_ASSISTANT_AUTO_TEAMS_ALERT is true
    (default), graph_message_id is required and the outlook_email_intake row is claimed
    before posting to Teams. For non-urgent items, a preview payload is returned for
    human review.
    """
    if not _clean_text(recipient):
        return "TEAMS_DRAFT_BLOCKED: recipient must not be blank."

    teams_result: dict[str, Any] = {"sent": False, "reason": "non_urgent_or_disabled"}
    is_urgent = urgency.lower() in {"urgent", "high"}
    if is_urgent and _auto_teams_alert_enabled():
        dedupe_result = _claim_teams_alert_delivery(graph_message_id or "")
        if dedupe_result.get("claimed"):
            teams_result = _send_teams_dm(message)
            teams_result["dedupe"] = dedupe_result
            if not teams_result.get("sent"):
                _release_teams_alert_delivery_claim(graph_message_id or "")
        else:
            teams_result = {"sent": False, **dedupe_result}

    payload = {
        "action": "sent" if teams_result.get("sent") else "preview",
        "type": "teams_private_message_draft",
        "approvalRequired": not teams_result.get("sent"),
        "teamsResult": teams_result,
        "fields": {
            "recipient": recipient,
            "message": message,
            "urgency": urgency,
            "graphMessageId": graph_message_id,
        },
    }
    return _json(payload)


def _supabase_client():
    """Lazy Supabase client for triage write-back. Returns None if unconfigured."""
    try:
        from src.services.supabase_helpers import get_outlook_intake_write_client

        return get_outlook_intake_write_client()
    except Exception:
        try:
            import os

            from supabase import create_client

            url = os.getenv("SUPABASE_URL") or os.getenv("NEXT_PUBLIC_SUPABASE_URL")
            key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
            if url and key:
                return create_client(url, key)
        except Exception:
            pass
    return None


TRIAGE_CATEGORY_MAP: dict[str, str] = {
    "urgent": "Urgent",
    "reply_needed": "Reply Needed",
    "delegate": "To Delegate",
    "fyi": "FYI",
    "watch": "Watching",
    "delete": "Archive",
}

OUTLOOK_CATEGORY_COLOR_MAP: dict[str, str] = {
    "Urgent": "preset0",
    "Reply Needed": "preset1",
    "To Delegate": "preset3",
    "FYI": "preset4",
    "Watching": "preset5",
    "Archive": "preset7",
}


@tool
def write_email_triage(
    graph_message_id: str,
    triage_action: str,
    triage_reason: str,
    mailbox_user_id: Optional[str] = None,
    write_outlook_category: bool = True,
) -> str:
    """Record the triage classification for a synced Outlook email.

    Writes triage_action, triage_reason, and triage_at to the outlook_email_intake
    row matching graph_message_id. Outlook category writes are gated by
    MICROSOFT_EXECUTIVE_ASSISTANT_MAILBOX_MUTATIONS_ENABLED.

    triage_action must be one of: urgent, reply_needed, delegate, fyi, watch, delete.
    """
    valid_actions = set(TRIAGE_CATEGORY_MAP)
    action = triage_action.lower().strip()
    if action not in valid_actions:
        return _json(
            {
                "ok": False,
                "error": f"Invalid triage_action '{triage_action}'. Must be one of: {', '.join(sorted(valid_actions))}",
            }
        )

    db_result: dict[str, Any] = {"written": False}
    try:
        client = _supabase_client()
        if client:
            response = (
                client.table("outlook_email_intake")
                .update(
                    {
                        "triage_action": action,
                        "triage_reason": _clean_text(triage_reason),
                        "triage_at": datetime.now(timezone.utc).isoformat(),
                    }
                )
                .eq("graph_message_id", graph_message_id)
                .execute()
            )
            matched = len(response.data or [])
            if matched > 0:
                db_result = {"written": True, "matchedRows": matched}
            else:
                # Fail loudly: the live email is not in outlook_email_intake yet
                # (sync/webhook drain has not landed this message). A silent no-op
                # here is exactly the kind of bug CLAUDE.md forbids — surface it so
                # the agent knows the triage classification was NOT persisted.
                db_result = {
                    "written": False,
                    "matchedRows": 0,
                    "reason": "no_matching_row",
                    "detail": (
                        f"No outlook_email_intake row for graph_message_id={graph_message_id}. "
                        "The message has not been synced to the DB yet (webhook drain / sync "
                        "must populate it before triage can persist)."
                    ),
                }
                logger.warning(
                    "[ExecAssistant] Triage write matched 0 rows for graph_message_id=%s — "
                    "email not yet in outlook_email_intake.",
                    graph_message_id,
                )
        else:
            db_result = {"written": False, "reason": "supabase_not_configured"}
    except Exception as exc:
        logger.warning("[ExecAssistant] Triage write failed: %s", exc)
        db_result = {"written": False, "error": str(exc)}

    # Write Outlook category so Brandon sees a coloured label in his inbox
    category_result: dict[str, Any] = {"patched": False, "reason": "skipped"}
    if write_outlook_category and not _mailbox_mutations_enabled():
        logger.warning(
            "[ExecAssistant] MAILBOX_MUTATION_BLOCKED action=outlook_category graph_message_id=%s reason=mailbox_mutations_disabled",
            graph_message_id,
        )
        category_result = {"patched": False, "reason": "mailbox_mutations_disabled"}
    elif write_outlook_category:
        mailbox = mailbox_user_id or os.getenv("MICROSOFT_EXECUTIVE_ASSISTANT_MAILBOX")
        category_name = TRIAGE_CATEGORY_MAP.get(action)
        if mailbox and category_name and graph_message_id:
            category_result = _patch_message_category(mailbox, graph_message_id, category_name)

    return _json(
        {
            "ok": True,
            "graphMessageId": graph_message_id,
            "triageAction": action,
            "dbResult": db_result,
            "categoryResult": category_result,
        }
    )


def _ensure_master_category(graph: Any, mailbox: str, category_name: str) -> dict[str, Any]:
    """Ensure a visible Outlook master category exists before applying it."""
    if not category_name:
        return {"ensured": False, "reason": "blank_category"}
    try:
        existing = graph.get(
            f"/users/{quote(mailbox)}/outlook/masterCategories?$select=displayName,color"
        )
        categories = existing.get("value") if isinstance(existing, dict) else []
        if any(
            str(item.get("displayName") or "").lower() == category_name.lower()
            for item in categories or []
            if isinstance(item, dict)
        ):
            return {"ensured": True, "created": False}
        graph.post(
            f"/users/{quote(mailbox)}/outlook/masterCategories",
            {
                "displayName": category_name,
                "color": OUTLOOK_CATEGORY_COLOR_MAP.get(category_name, "preset8"),
            },
        )
        return {"ensured": True, "created": True}
    except Exception as exc:
        logger.warning("[ExecAssistant] Master category ensure failed for %s: %s", category_name, exc)
        return {"ensured": False, "error": str(exc)}


def _read_message_categories(graph: Any, mailbox: str, message_id: str) -> list[str]:
    try:
        response = graph.get(f"/users/{quote(mailbox)}/messages/{message_id}?$select=categories")
        categories = response.get("categories") if isinstance(response, dict) else []
        return [str(category) for category in categories or [] if str(category).strip()]
    except Exception as exc:
        logger.warning("[ExecAssistant] Category read failed for %s: %s", message_id, exc)
        return []


def _merge_categories(existing: list[str], additions: list[str]) -> list[str]:
    merged: list[str] = []
    seen: set[str] = set()
    for category in [*existing, *additions]:
        cleaned = str(category or "").strip()
        key = cleaned.lower()
        if not cleaned or key in seen:
            continue
        seen.add(key)
        merged.append(cleaned)
    return merged


def _patch_message_categories(
    mailbox: str,
    message_id: str,
    categories: list[str],
    *,
    merge_existing: bool = True,
) -> dict[str, Any]:
    """Patch Outlook categories on a message via Graph API. Best-effort, never raises."""
    if not _mailbox_mutations_enabled():
        logger.warning(
            "[ExecAssistant] MAILBOX_MUTATION_BLOCKED action=outlook_categories_patch mailbox=%s message_id=%s reason=mailbox_mutations_disabled",
            mailbox,
            message_id,
        )
        return {"patched": False, "reason": "mailbox_mutations_disabled"}

    try:
        from src.services.integrations.microsoft_graph.client import get_graph_client

        graph = get_graph_client()
        if not graph.is_configured():
            return {"patched": False, "reason": "graph_not_configured"}

        safe_mailbox = mailbox.strip().lower()
        clean_categories = [category.strip() for category in categories if category and category.strip()]
        ensure_results = [
            _ensure_master_category(graph, safe_mailbox, category)
            for category in clean_categories
        ]
        final_categories = clean_categories
        if merge_existing:
            final_categories = _merge_categories(
                _read_message_categories(graph, safe_mailbox, message_id),
                clean_categories,
            )
        graph.patch(
            f"/users/{quote(safe_mailbox)}/messages/{message_id}",
            {"categories": final_categories},
        )
        return {
            "patched": True,
            "categories": final_categories,
            "ensuredCategories": ensure_results,
            "mergeExisting": merge_existing,
        }
    except Exception as exc:
        logger.warning("[ExecAssistant] Category patch failed: %s", exc)
        return {"patched": False, "error": str(exc)}


def _patch_message_category(mailbox: str, message_id: str, category_name: str) -> dict[str, Any]:
    return _patch_message_categories(mailbox, message_id, [category_name], merge_existing=True)


@tool
def patch_outlook_email_categories(
    graph_message_id: str,
    categories: list[str],
    mailbox_user_id: Optional[str] = None,
) -> str:
    """Set the Outlook categories (coloured tags) on a message via Microsoft Graph.

    Adds categories without removing existing categories. Pass an empty list to clear them.
    This writes directly to the live Outlook mailbox — Brandon will see the tag instantly.
    """
    if not _mailbox_mutations_enabled():
        logger.warning(
            "[ExecAssistant] MAILBOX_MUTATION_BLOCKED action=patch_outlook_email_categories graph_message_id=%s reason=mailbox_mutations_disabled",
            graph_message_id,
        )
        return _json({"ok": False, "patched": False, "reason": "mailbox_mutations_disabled"})

    mailbox = (
        mailbox_user_id
        or os.getenv("MICROSOFT_EXECUTIVE_ASSISTANT_MAILBOX")
        or (os.getenv("MICROSOFT_SYNC_USERS", "").split(",")[0].strip() or None)
    )
    if not mailbox:
        return _json({"ok": False, "error": "OUTLOOK_CATEGORY_BLOCKED: No mailbox configured."})

    if not categories:
        result = {"patched": False, "reason": "graph_not_configured"}
        # Clear categories
        try:
            from src.services.integrations.microsoft_graph.client import get_graph_client

            graph = get_graph_client()
            if graph.is_configured():
                graph.patch(
                    f"/users/{quote(mailbox.strip().lower())}/messages/{graph_message_id}",
                    {"categories": []},
                )
                result = {"patched": True, "categories": []}
        except Exception as exc:
            result = {"patched": False, "error": str(exc)}
    else:
        result = _patch_message_categories(mailbox, graph_message_id, categories, merge_existing=True)
    return _json({"ok": result.get("patched", False), **result})


def microsoft_executive_assistant_tools() -> list[Any]:
    """Return the Microsoft specialist's runtime tools."""
    tools = [
        read_live_outlook_inbox,
        search_outlook_emails,
        search_microsoft_teams_messages,
        search_microsoft_files,
        list_outlook_calendar_events,
        draft_outlook_email_for_review,
        draft_teams_message_for_review,
        write_email_triage,
    ]
    if _mailbox_mutations_enabled():
        tools.append(patch_outlook_email_categories)
    return tools
