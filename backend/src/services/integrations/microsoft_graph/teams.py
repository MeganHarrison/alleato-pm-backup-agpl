"""
Microsoft Teams Message Ingestion
Fetches channel messages/threads and direct messages (chats) from Teams via Microsoft Graph API.
"""
import hashlib
import logging
import os
import re
from datetime import datetime, timedelta, timezone
from typing import Optional

from ...supabase_helpers import SupabaseRagStore, get_rag_read_client, get_rag_write_client, storage_upload_with_retry
from .client import get_graph_client
from .project_inference import infer_project_id

logger = logging.getLogger(__name__)

MIN_MESSAGE_CHARS = 20
MIN_CONVERSATION_CHARS = 200
LOW_VALUE_MESSAGE_WORDS = {
    "ok",
    "okay",
    "k",
    "yes",
    "no",
    "thanks",
    "thank",
    "thx",
    "got",
    "it",
    "done",
    "sent",
    "received",
    "sounds",
    "good",
}


def _fetch_rag_document_text(doc_id: str) -> str:
    try:
        row = (
            get_rag_read_client()
            .from_("rag_document_metadata")
            .select("content,raw_text")
            .eq("id", doc_id)
            .single()
            .execute()
            .data
            or {}
        )
        return str(row.get("content") or row.get("raw_text") or "")
    except Exception:
        return ""


def _mark_graph_embedding_pending(doc_id: str) -> None:
    """Reset RAG embedding status after a Teams conversation document changes."""
    try:
        get_rag_write_client().from_("rag_document_metadata").update(
            {"embedding_status": None}
        ).eq("id", doc_id).execute()
    except Exception as exc:
        logger.warning("[Teams] Could not reset RAG embedding status for %s: %s", doc_id, exc)


def _strip_html(text: str) -> str:
    text = re.sub(r'<[^>]+>', ' ', text)
    return re.sub(r'\s+', ' ', text).strip()


def _substantive_text_length(text: str) -> int:
    """Approximate useful conversation signal after dropping markers and filler."""
    without_markers = re.sub(r"\[[^\]]+\]", " ", text)
    tokens = re.findall(r"[A-Za-z0-9][A-Za-z0-9'-]*", without_markers.lower())
    useful_tokens = [
        token
        for token in tokens
        if len(token) > 2 and token not in LOW_VALUE_MESSAGE_WORDS
    ]
    return sum(len(token) for token in useful_tokens)


def _user_identity_signals(user: dict) -> list[str]:
    """Return display/email signals usable for project inference."""
    if not isinstance(user, dict):
        return []

    signals: list[str] = []
    display_name = str(user.get("displayName") or "").strip()
    email = str(
        user.get("email")
        or user.get("mail")
        or user.get("userPrincipalName")
        or ""
    ).strip()

    if display_name:
        signals.append(display_name)
    if email:
        signals.append(email)
        if display_name:
            signals.append(f"{display_name} <{email}>")

    return signals


def _conversation_doc_id(prefix: str, conversation_id: str, date_key: str) -> str:
    digest = hashlib.sha256(conversation_id.encode("utf-8")).hexdigest()[:16]
    return f"{prefix}_{digest}_{date_key}"


def _format_thread_as_text(thread_messages: list[dict], channel_name: str, team_name: str) -> str:
    """Format a Teams thread (root message + replies) as plain text."""
    lines = [f"[Teams Channel: {team_name} / {channel_name}]", ""]
    for msg in thread_messages:
        if not msg:  # Skip None/deleted messages
            continue
        sender = msg.get("from", {}) or {}
        user = sender.get("user", {}) or {}
        name = user.get("displayName", "Unknown")
        created = msg.get("createdDateTime", "")[:10]
        body = _strip_html((msg.get("body") or {}).get("content", ""))
        if body:
            lines.append(f"[{created}] {name}: {body}")
    return "\n".join(lines)


def sync_teams_channel(
    supabase_client,
    team_id: str,
    team_name: str,
    channel_id: str,
    channel_name: str,
    delta_token: Optional[str] = None,
) -> tuple[int, str]:
    """
    Sync messages from a Teams channel. Returns (count_synced, new_delta_token).
    """
    graph = get_graph_client()
    if not graph.is_configured():
        logger.warning("[Teams] Microsoft Graph not configured — skipping")
        return 0, delta_token or ""

    delta_path = f"/teams/{team_id}/channels/{channel_id}/messages/delta"
    messages_path = f"/teams/{team_id}/channels/{channel_id}/messages"

    try:
        items, new_delta_token = graph.get_delta(delta_path, delta_token)
    except Exception as e:
        status_code = getattr(getattr(e, "response", None), "status_code", None)
        message = str(e)
        token_recovery_error = status_code in {400, 410} or "400 Bad Request" in message or "410 Gone" in message
        if token_recovery_error:
            logger.warning(
                "[Teams] Delta token failed for %s/%s; retrying full channel delta.",
                team_name,
                channel_name,
            )
            try:
                items, new_delta_token = graph.get_delta(delta_path, None)
            except Exception as retry_error:
                retry_message = str(retry_error)
                retry_status = getattr(getattr(retry_error, "response", None), "status_code", None)
                if retry_status in {400, 410} or "400 Bad Request" in retry_message or "410 Gone" in retry_message:
                    logger.warning(
                        "[Teams] Full channel delta failed for %s/%s; falling back to message snapshot.",
                        team_name,
                        channel_name,
                    )
                    items = graph.get_all_pages(messages_path)
                    new_delta_token = ""
                else:
                    raise
        else:
            logger.error("[Teams] Delta query failed for %s/%s: %s", team_name, channel_name, e)
            raise

    synced = 0
    for msg in items:
        try:
            _process_teams_message(supabase_client, graph, msg, team_id, team_name, channel_id, channel_name)
            synced += 1
        except _AlreadyIngested:
            pass
        except Exception as e:
            logger.warning(f"[Teams] Skipping message due to error: {e}", exc_info=True)

    logger.info(f"[Teams] Synced {synced} threads from {team_name}/{channel_name}")
    return synced, new_delta_token


class _AlreadyIngested(Exception):
    pass


def _process_teams_message(supabase_client, graph, msg, team_id, team_name, channel_id, channel_name):
    """Process a single Teams message. Raises _AlreadyIngested if already in DB, or other exceptions on error."""
    if not msg:
        raise _AlreadyIngested()
    if "@removed" in msg:
        raise _AlreadyIngested()

    # Only process root messages (messageType == message, not replies or system msgs)
    if msg.get("messageType") != "message":
        raise _AlreadyIngested()

    msg_id = msg.get("id", "")
    if not msg_id:
        raise _AlreadyIngested()

    # Fetch replies to build the full thread
    thread_messages = [msg]
    try:
        replies = graph.get_all_pages(
            f"/teams/{team_id}/channels/{channel_id}/messages/{msg_id}/replies"
        )
        thread_messages.extend(r for r in replies if r)
    except Exception:
        pass  # Proceed with just the root message

    thread_text = _format_thread_as_text(thread_messages, channel_name, team_name)
    if len(thread_text) < MIN_MESSAGE_CHARS:
        raise _AlreadyIngested()

    doc_id = f"teams_{msg_id}"

    # Check if already ingested
    existing = supabase_client.from_("document_metadata").select("id").eq("id", doc_id).execute()
    if existing and existing.data:
        raise _AlreadyIngested()

    # Upload to storage
    storage_path = f"teams/{team_id}/{channel_id}/{msg_id}.txt"
    try:
        storage_upload_with_retry(
            supabase_client.storage.from_("documents"),
            storage_path,
            thread_text.encode("utf-8"),
            {"content-type": "text/plain", "upsert": "true"},
        )
    except Exception as e:
        logger.warning(f"[Teams] Storage upload failed for {msg_id}: {e}")
        raise

    created = msg.get("createdDateTime", datetime.now(timezone.utc).isoformat())
    from_field = msg.get("from")
    sender = (from_field if isinstance(from_field, dict) else {}).get("user") or {}
    sender_name = sender.get("displayName", "Unknown") if isinstance(sender, dict) else "Unknown"
    participants = [sender_name]
    for thread_msg in thread_messages:
        msg_from = (thread_msg or {}).get("from", {}) or {}
        user_data = msg_from.get("user", {}) if isinstance(msg_from, dict) else {}
        participants.extend(_user_identity_signals(user_data or {}))

    project_id, assignment_method, assignment_confidence = infer_project_id(
        supabase_client,
        title=f"Teams: {team_name} / {channel_name}",
        content=thread_text,
        participants=participants,
    )

    SupabaseRagStore(supabase_client).upsert_document_metadata({
        "id": doc_id,
        "title": f"Teams: {team_name} / {channel_name}",
        "source": "microsoft_graph",
        "source_system": "teams",
        "category": "teams_message",
        "type": "teams_message",
        "content": thread_text,
        "embedding_status": None,
        "storage_bucket": "documents",
        "storage_path": storage_path,
        "date": created[:10] if created else None,
        "participants": ", ".join(sorted(set(participants))),
        "status": "raw_ingested",
        "tags": ",".join(["teams", team_name.lower(), channel_name.lower(), f"project_auto:{assignment_method}" if project_id else "unassigned"]),
        "project_id": project_id,
        "source_metadata": {
            "document_kind": "teams_channel_thread",
            "team_id": team_id,
            "team_name": team_name,
            "channel_id": channel_id,
            "channel_name": channel_name,
            "root_message_id": msg_id,
            "message_count": len(thread_messages),
        },
    })
    _mark_graph_embedding_pending(doc_id)
    if project_id:
        logger.info(
            "[Teams] Auto-assigned project_id=%s for %s via %s (%.2f)",
            project_id,
            msg_id,
            assignment_method,
            assignment_confidence,
        )


def get_all_teams_and_channels(supabase_client) -> list[dict]:
    """
    Enumerate all teams and channels accessible to the app.
    Returns list of {team_id, team_name, channel_id, channel_name}.
    """
    graph = get_graph_client()
    channels = []
    try:
        teams = graph.get_all_pages("/teams")
        for team in teams:
            team_id = team["id"]
            team_name = team.get("displayName", team_id)
            try:
                team_channels = graph.get_all_pages(f"/teams/{team_id}/channels")
                for ch in team_channels:
                    channels.append({
                        "team_id": team_id,
                        "team_name": team_name,
                        "channel_id": ch["id"],
                        "channel_name": ch.get("displayName", ch["id"]),
                    })
            except Exception as e:
                logger.warning(f"[Teams] Failed to get channels for {team_name}: {e}")
    except Exception as e:
        logger.error(f"[Teams] Failed to enumerate teams: {e}")
    return channels


# ─────────────────────────────────────────────────────────────────────────────
# Direct Messages (Chats)
# Primary path uses /users/{user}/chats/getAllMessages.
# Requires: Chat.Read.All (application permission)
# Optional: ChatMember.Read.All for member names (graceful fallback if absent)
# ─────────────────────────────────────────────────────────────────────────────

def _chat_display_name(chat: dict) -> tuple[str, list[str]]:
    """
    Build a human-readable label for a chat and return (display_name, [member_names]).
    Falls back gracefully if members weren't expanded.
    """
    members_raw = chat.get("members") or []
    member_names = [
        str(m.get("displayName", "")).strip()
        for m in members_raw
        if isinstance(m, dict) and m.get("displayName")
    ]
    member_signals: list[str] = []
    for member in members_raw:
        if not isinstance(member, dict):
            continue
        member_signals.extend(_user_identity_signals(member))

    topic = (chat.get("topic") or "").strip()
    chat_type = chat.get("chatType", "")

    if topic:
        display = topic
    elif chat_type == "oneOnOne" and len(member_names) >= 2:
        display = " ↔ ".join(member_names[:2])
    elif member_names:
        display = ", ".join(member_names[:4])
        if len(member_names) > 4:
            display += f" +{len(member_names) - 4}"
    else:
        display = chat.get("id", "Unknown")[:12]

    return display, member_signals or member_names


def _fallback_chat_display_name(chat_id: str) -> str:
    return chat_id[:12] if chat_id else "Unknown Teams DM"


def _sender_signals(message: dict) -> list[str]:
    from_field = message.get("from") or {}
    if not isinstance(from_field, dict):
        return []
    signals: list[str] = []
    user_field = from_field.get("user") or {}
    if isinstance(user_field, dict):
        signals.extend(_user_identity_signals(user_field))
    app_field = from_field.get("application") or {}
    if isinstance(app_field, dict) and app_field.get("displayName"):
        signals.append(str(app_field["displayName"]).strip())
    return [signal for signal in signals if signal]


def _export_since_iso(since_iso: Optional[str]) -> str:
    def normalize(value: str) -> str:
        try:
            parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
        except ValueError:
            return value
        return parsed.astimezone(timezone.utc).isoformat(timespec="milliseconds").replace("+00:00", "Z")

    if since_iso:
        return normalize(since_iso)
    configured_since = os.environ.get("TEAMS_DM_EXPORT_SINCE")
    if configured_since:
        return normalize(configured_since)
    lookback_days = max(1, int(os.environ.get("TEAMS_DM_EXPORT_INITIAL_LOOKBACK_DAYS", "7")))
    return (datetime.now(timezone.utc) - timedelta(days=lookback_days)).isoformat(timespec="milliseconds").replace("+00:00", "Z")


def _now_graph_iso() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="milliseconds").replace("+00:00", "Z")


class ChatReadPermissionError(Exception):
    """Raised when Chat.Read.All admin consent is missing (HTTP 403 from /users/{user}/chats)."""


def get_user_chats(user_email: str) -> list[dict]:
    """
    List all oneOnOne and group chats for a user.
    Returns list of dicts with keys: id, chatType, display_name, member_names.
    Requires Chat.Read.All (application permission + admin consent in Azure AD).
    Member names require ChatMember.Read.All (optional — graceful fallback).

    Raises ChatReadPermissionError if Chat.Read.All admin consent is missing.
    """
    graph = get_graph_client()
    chats = []

    # Try with member expansion first; fall back without it if forbidden
    for params in [
        {"$select": "id,chatType,topic", "$expand": "members($select=displayName,email,mail,userPrincipalName)"},
        {"$select": "id,chatType,topic"},
    ]:
        try:
            raw = graph.get_all_pages(f"/users/{user_email}/chats", params=params)
            for c in raw:
                if c.get("chatType") not in ("oneOnOne", "group"):
                    continue
                display, members = _chat_display_name(c)
                chats.append({
                    "id": c["id"],
                    "chatType": c.get("chatType"),
                    "display_name": display,
                    "member_names": members,
                })
            logger.info(f"[Teams DM] Found {len(chats)} chats for {user_email}")
            return chats
        except Exception as e:
            e_str = str(e)
            is_403 = any(code in e_str for code in ("403", "Forbidden"))

            # Member expansion 403/400 → retry without expansion (ChatMember.Read.All missing)
            if "members" in params.get("$expand", "") and (is_403 or "400" in e_str or "Bad Request" in e_str):
                logger.warning(f"[Teams DM] Member expansion not supported — retrying without it")
                continue

            # Base chats endpoint 403 → Chat.Read.All admin consent not granted
            if is_403:
                raise ChatReadPermissionError(
                    f"Chat.Read.All admin consent missing for tenant — "
                    f"grant consent in Azure AD > App registrations > API permissions. "
                    f"User: {user_email}. Original error: {e_str}"
                ) from e

            logger.error(f"[Teams DM] Failed to list chats for {user_email}: {e}")
            raise

    return chats


def _process_chat_message(
    supabase_client,
    msg: dict,
    chat_id: str,
    chat_display_name: str,
    chat_members: list[str],
) -> None:
    """Store a single Teams DM message. Raises _AlreadyIngested to skip."""
    if not msg or "@removed" in msg:
        raise _AlreadyIngested()
    if msg.get("messageType") != "message":
        raise _AlreadyIngested()

    msg_id = msg.get("id", "")
    if not msg_id:
        raise _AlreadyIngested()

    body = _strip_html((msg.get("body") or {}).get("content", ""))
    if len(body) < MIN_MESSAGE_CHARS:
        raise _AlreadyIngested()

    created = msg.get("createdDateTime", datetime.now(timezone.utc).isoformat())
    date_key = created[:10] if created else datetime.now(timezone.utc).date().isoformat()
    doc_id = _conversation_doc_id("teamsdm", chat_id, date_key)
    message_marker = f"[message:{msg_id}]"

    existing = supabase_client.from_("document_metadata").select("id").eq("id", doc_id).execute()
    existing_doc = None
    if existing and existing.data:
        existing_resp = (
            supabase_client.from_("document_metadata")
            .select("id, participants, project_id, source_metadata")
            .eq("id", doc_id)
            .single()
            .execute()
        )
        existing_doc = existing_resp.data
        existing_content = _fetch_rag_document_text(doc_id)
        if existing_doc and message_marker in existing_content:
            raise _AlreadyIngested()

    sender_field = msg.get("from") or {}
    user_field = sender_field.get("user") or {}
    sender_name = user_field.get("displayName", "Unknown") if isinstance(user_field, dict) else "Unknown"
    created_time = created[:19].replace("T", " ") if created else date_key

    line = f"{message_marker} [{created_time}] {sender_name}: {body}"
    if existing_doc:
        previous_content = _fetch_rag_document_text(doc_id).rstrip()
        text = f"{previous_content}\n{line}"
    else:
        text = f"[Teams Direct Message Conversation: {chat_display_name}]\nDate: {date_key}\n\n{line}"

    storage_path = f"teams/chats/{chat_id}/{date_key}.txt"
    try:
        storage_upload_with_retry(
            supabase_client.storage.from_("documents"),
            storage_path,
            text.encode("utf-8"),
            {"content-type": "text/plain", "upsert": "true"},
        )
    except Exception as e:
        logger.warning(f"[Teams DM] Storage upload failed for {msg_id}: {e}")
        raise

    participants = sorted(set((chat_members or []) + [sender_name]))
    project_id, assignment_method, assignment_confidence = infer_project_id(
        supabase_client,
        title=f"Teams DM Conversation: {chat_display_name}",
        content=text,
        participants=participants,
        existing_project_id=(existing_doc or {}).get("project_id"),
    )
    substantive_chars = _substantive_text_length(text)
    is_embedding_ready = substantive_chars >= MIN_CONVERSATION_CHARS
    tags = [
        "teams",
        "direct_message",
        chat_display_name.lower(),
        f"project_auto:{assignment_method}" if project_id else "unassigned",
    ]
    if not is_embedding_ready:
        tags.append("skipped_low_content")

    row = {
        "id": doc_id,
        "title": f"Teams DM Conversation: {chat_display_name}",
        "source": "microsoft_graph",
        "source_system": "teams_dm",
        "category": "teams_message",  # same category → picked up by searchTeamsMessages tool
        "type": "teams_dm_conversation",
        "content": text,
        "embedding_status": None,
        "storage_bucket": "documents",
        "storage_path": storage_path,
        "date": date_key,
        "participants": ", ".join(participants),
        "status": "raw_ingested" if is_embedding_ready else "skipped_low_content",
        "tags": ",".join(tags),
        "project_id": project_id,
        "source_metadata": {
            **(((existing_doc or {}).get("source_metadata") or {}) if isinstance((existing_doc or {}).get("source_metadata"), dict) else {}),
            "document_kind": "teams_dm_conversation",
            "source_day": date_key,
            "source_day_timezone": "UTC",
            "teams_chat_id": chat_id,
            "latest_message_at": created,
            "latest_message_id": msg_id,
            "conversation_doc_id": doc_id,
        },
    }
    SupabaseRagStore(supabase_client).upsert_document_metadata(row)
    _mark_graph_embedding_pending(doc_id)


def sync_teams_chat(
    supabase_client,
    chat_id: str,
    chat_display_name: str,
    chat_members: list[str],
    since_iso: Optional[str] = None,
) -> tuple[int, str]:
    """
    Sync messages from a Teams chat (DM or group chat).

    Uses /chats/{chatId}/messages with $orderby=createdDateTime desc and stops
    paginating once messages older than `since_iso` are reached.

    NOTE: Graph API does NOT support delta queries on chat messages with app-only
    (client credentials) auth — /chats/.../messages/delta returns 400.
    We use timestamp-based incremental sync instead.

    Returns (count_synced, new_latest_timestamp_iso).
    """
    graph = get_graph_client()
    if not graph.is_configured():
        return 0, since_iso or ""

    # Fetch messages newest-first; stop when we reach messages older than last sync.
    # Page size 50 balances API calls vs overfetch.
    PAGE_SIZE = 50
    url: Optional[str] = f"{graph.GRAPH_BASE}/chats/{chat_id}/messages"
    params: Optional[dict] = {"$top": str(PAGE_SIZE), "$orderby": "createdDateTime desc"}

    items: list[dict] = []
    pages_fetched = 0

    while url and pages_fetched < 20:  # hard cap at 1000 messages per run
        data = graph.get(url, params if pages_fetched == 0 else None)
        page_msgs = data.get("value", [])
        pages_fetched += 1

        # Stop early once we've passed the last-sync cutoff
        stop_early = False
        for msg in page_msgs:
            created = msg.get("createdDateTime", "")
            if since_iso and created and created <= since_iso:
                stop_early = True
                break
            items.append(msg)

        if stop_early or "@odata.nextLink" not in data:
            break
        url = data["@odata.nextLink"]

    synced = 0
    latest_ts = since_iso or ""
    for msg in items:
        try:
            _process_chat_message(supabase_client, msg, chat_id, chat_display_name, chat_members)
            synced += 1
            # Track the most recent timestamp for next run's cutoff
            created = msg.get("createdDateTime", "")
            if created and (not latest_ts or created > latest_ts):
                latest_ts = created
        except _AlreadyIngested:
            pass
        except Exception as e:
            logger.warning(f"[Teams DM] Skipping message {msg.get('id')}: {e}")

    if synced:
        logger.info(f"[Teams DM] Synced {synced} messages from '{chat_display_name}'")
    return synced, latest_ts


def sync_user_chat_messages(
    supabase_client,
    user_email: str,
    since_iso: Optional[str] = None,
) -> tuple[int, str]:
    """
    Sync Teams chat messages visible to a user via the export endpoint.

    This avoids tenant-mismatch failures from /chats/{chatId}/messages for
    federated/external chats while preserving the existing grouped daily
    document shape used by embedding and the Teams compiler.
    """
    graph = get_graph_client()
    if not graph.is_configured():
        return 0, since_iso or ""

    chat_labels: dict[str, tuple[str, list[str]]] = {}
    try:
        for chat in get_user_chats(user_email):
            chat_labels[chat["id"]] = (chat["display_name"], chat["member_names"])
    except ChatReadPermissionError:
        raise
    except Exception as exc:
        logger.warning("[Teams DM Export] Could not prefetch chat labels for %s: %s", user_email, exc)

    since_filter = _export_since_iso(since_iso)
    until_filter = _now_graph_iso()
    page_size = max(1, min(int(os.environ.get("TEAMS_DM_EXPORT_PAGE_SIZE", "25")), 50))
    max_pages = max(1, min(int(os.environ.get("TEAMS_DM_EXPORT_MAX_PAGES", "2")), 5))
    filter_expr = f"lastModifiedDateTime gt {since_filter} and lastModifiedDateTime lt {until_filter}"
    url: Optional[str] = f"{graph.GRAPH_BASE}/users/{user_email}/chats/getAllMessages"
    params: Optional[dict] = {"$top": str(page_size), "$filter": filter_expr}
    items: list[dict] = []
    pages_fetched = 0

    while url and pages_fetched < max_pages:
        data = graph.get(url, params if pages_fetched == 0 else None)
        items.extend(data.get("value", []))
        pages_fetched += 1
        url = data.get("@odata.nextLink")

    synced = 0
    latest_ts = since_filter
    for msg in sorted(items, key=lambda item: item.get("createdDateTime") or ""):
        chat_id = msg.get("chatId") or ""
        if not chat_id:
            continue
        display_name, member_names = chat_labels.get(
            chat_id,
            (_fallback_chat_display_name(chat_id), []),
        )
        member_signals = sorted(set(member_names + _sender_signals(msg) + [user_email]))
        try:
            _process_chat_message(
                supabase_client,
                msg,
                chat_id,
                display_name,
                member_signals,
            )
            synced += 1
        except _AlreadyIngested:
            pass
        except Exception as exc:
            logger.warning("[Teams DM Export] Skipping message %s: %s", msg.get("id"), exc)

        modified = msg.get("lastModifiedDateTime") or msg.get("createdDateTime") or ""
        if modified and modified > latest_ts:
            latest_ts = modified

    if url is None and latest_ts < until_filter:
        latest_ts = until_filter

    logger.info(
        "[Teams DM Export] Synced %d messages for %s from %s to %s across %d fetched pages",
        synced,
        user_email,
        since_filter,
        until_filter,
        pages_fetched,
    )
    return synced, latest_ts
