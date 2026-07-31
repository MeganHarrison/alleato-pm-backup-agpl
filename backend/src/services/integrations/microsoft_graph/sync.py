"""
Microsoft Graph Sync Orchestrator
Coordinates sync of Outlook, Teams, and SharePoint files.
Saves delta tokens between runs for incremental sync.
"""
import logging
import os
from datetime import datetime, timedelta, timezone
from typing import Any, Optional

from supabase import Client
from src.services.supabase_helpers import get_rag_read_client, get_rag_write_client

from .outlook import (
    is_canonical_outlook_delta_cursor,
    refresh_outlook_intake_vectorization_statuses,
    sync_outlook_emails,
)
from .teams import sync_teams_channel, get_all_teams_and_channels, sync_user_chat_messages, ChatReadPermissionError
from .onedrive import SharePointSyncResult, sync_onedrive_folder, sync_sharepoint_folder
from .sharepoint_scopes import (
    SharePointScope,
    discover_sharepoint_project_scopes,
    select_sharepoint_scopes,
)
from .client import get_graph_client
from .embed import enqueue_pending_graph_documents
from .attachment_promotion import promote_outlook_intake_attachments
from .outlook_conversations import compile_outlook_conversations

logger = logging.getLogger(__name__)
OUTLOOK_WEBHOOK_PENDING_STATUS = "webhook_pending"


def _get_graph_sync_state_read_client() -> Client:
    """Route Graph delta/state reads to the isolated AI DB."""
    return get_rag_read_client()


def _get_graph_sync_state_write_client() -> Client:
    """Route Graph delta/state writes to the isolated AI DB."""
    return get_rag_write_client()


def _record_sync_run_safe(
    supabase: Client,
    *,
    source: str,
    resource_id: str,
    resource_name: str,
    started_at: datetime,
    status: str,
    items_synced: int = 0,
    items_seen: int = 0,
    items_failed: int = 0,
    error_message: Optional[str] = None,
    metadata: Optional[dict[str, Any]] = None,
) -> None:
    try:
        from src.services.health.source_sync_health import record_sync_run

        record_sync_run(
            supabase,
            source=source,
            resource_id=resource_id,
            resource_name=resource_name,
            stage="source_sync",
            status=status,
            started_at=started_at,
            finished_at=datetime.now(timezone.utc),
            items_seen=items_seen or items_synced,
            items_synced=items_synced,
            items_failed=items_failed,
            error_message=error_message,
            metadata=metadata or {},
        )
    except Exception as exc:
        logger.warning(
            "[GraphSync] Could not record source_sync_runs row for %s/%s: %s",
            source,
            resource_id,
            exc,
        )


def _record_graph_phase_run_safe(
    supabase: Client,
    *,
    source: str,
    resource_name: str,
    stage: str,
    started_at: datetime,
    status: str,
    items_seen: int = 0,
    items_synced: int = 0,
    items_failed: int = 0,
    error_message: Optional[str] = None,
    metadata: Optional[dict[str, Any]] = None,
) -> None:
    """Record coarse Graph phase outcomes so alerting can isolate source vs AI failures."""
    try:
        from src.services.health.source_sync_health import record_sync_run

        record_sync_run(
            supabase,
            source=source,
            resource_id=stage,
            resource_name=resource_name,
            stage=stage,
            status=status,
            started_at=started_at,
            finished_at=datetime.now(timezone.utc),
            items_seen=items_seen,
            items_synced=items_synced,
            items_failed=items_failed,
            error_message=error_message,
            metadata=metadata or {},
        )
    except Exception as exc:
        logger.warning(
            "[GraphSync] Could not record phase source_sync_runs row for %s/%s: %s",
            source,
            stage,
            exc,
        )


def _count_outlook_docs_for_mailbox(supabase: Client, user_email: str) -> int:
    """Count persisted raw Outlook intake rows for a mailbox."""
    result = (
        get_rag_read_client().from_("outlook_email_intake")
        .select("id", count="exact")
        .eq("mailbox_user_id", user_email)
        .is_("deleted_at", "null")
        .execute()
    )
    return int(result.count or 0)


def _get_delta_token(supabase: Client, source: str, resource_id: str) -> Optional[str]:
    """Fetch saved delta token for a source/resource pair."""
    try:
        result = (
            _get_graph_sync_state_read_client()
            .from_("graph_sync_state")
            .select("delta_token")
            .eq("source", source)
            .eq("resource_id", resource_id)
            .limit(1)
            .execute()
        )
        rows = result.data or []
        return rows[0].get("delta_token") if rows else None
    except Exception:
        return None


def _get_sharepoint_sync_states(
    resource_ids: list[str],
) -> dict[str, dict[str, Any]]:
    """Load scope state in one read so discovery selection is deterministic."""
    if not resource_ids:
        return {}
    rows: list[dict[str, Any]] = []
    client = _get_graph_sync_state_read_client()
    for start in range(0, len(resource_ids), 100):
        response = (
            client.from_("graph_sync_state")
            .select(
                "resource_id,resource_name,delta_token,last_sync_at,"
                "sync_status,error_message,items_synced"
            )
            .eq("source", "sharepoint_file")
            .in_("resource_id", resource_ids[start : start + 100])
            .execute()
        )
        rows.extend(response.data or [])
    return {
        str(row.get("resource_id")): dict(row)
        for row in rows
        if row.get("resource_id")
    }


def _limit_sync_users(
    supabase: Client,
    *,
    source: str,
    users: list[str],
    env_key: str,
    default_limit: int,
    always_include_env_key: str | None = None,
    resource_id_prefix: str = "",
) -> list[str]:
    """Pick a bounded, stalest-first slice of users for expensive per-user syncs."""
    if not users:
        return []
    limit = max(1, min(int(os.environ.get(env_key, str(default_limit))), len(users)))
    if len(users) <= limit:
        return users

    resource_id_by_user = {email: f"{resource_id_prefix}{email}" for email in users}
    user_by_resource_id = {
        resource_id: email for email, resource_id in resource_id_by_user.items()
    }

    # Source adapters do not all persist the same graph_sync_state key shape:
    # Outlook uses the bare mailbox email while Teams DM export uses
    # "user:<email>". Query and translate the exact durable IDs for this source;
    # otherwise every lookup appears unsynced and alphabetical fallback starves
    # all but the first configured user.
    last_sync_by_resource: dict[str, str] = {}
    try:
        result = (
            _get_graph_sync_state_read_client()
            .from_("graph_sync_state")
            .select("resource_id,last_sync_at")
            .eq("source", source)
            .in_("resource_id", list(user_by_resource_id))
            .execute()
        )
        last_sync_by_resource = {
            user_by_resource_id[str(row.get("resource_id"))]: str(
                row.get("last_sync_at") or ""
            )
            for row in (result.data or [])
            if str(row.get("resource_id") or "") in user_by_resource_id
        }
    except Exception as exc:
        logger.warning("[GraphSync] Could not load %s sync state for user limiting: %s", source, exc)

    normalized_users = {email.lower(): email for email in users}
    always_include: list[str] = []
    if always_include_env_key:
        for raw_email in os.environ.get(always_include_env_key, "").split(","):
            email = raw_email.strip().lower()
            if email and email in normalized_users and normalized_users[email] not in always_include:
                always_include.append(normalized_users[email])

    remaining_users = [email for email in users if email not in always_include]
    stale_sorted_remaining = sorted(
        remaining_users,
        key=lambda email: (
            last_sync_by_resource.get(email) or "",
            email,
        ),
    )
    remaining_slots = max(0, limit - len(always_include))
    return (always_include + stale_sorted_remaining[:remaining_slots])[:limit]


def _bounded_int_env(name: str, default_limit: int, minimum: int = 1, maximum: int = 100) -> int:
    try:
        value = int(os.environ.get(name, str(default_limit)))
    except ValueError:
        logger.warning("[GraphSync] Invalid integer for %s; using %d", name, default_limit)
        value = default_limit
    return max(minimum, min(value, maximum))


def _limit_sync_items(
    values: list[Any],
    *,
    env_key: str,
    default_limit: int,
    label: str,
) -> list[Any]:
    if not values:
        return []
    limit = _bounded_int_env(env_key, default_limit, 1, len(values))
    if len(values) > limit:
        logger.info("[GraphSync] Limiting %s from %d to %d via %s", label, len(values), limit, env_key)
    return values[:limit]


def _save_sync_state(
    supabase: Client,
    source: str,
    resource_id: str,
    resource_name: str,
    delta_token: str,
    items_synced: int,
    status: str = "success",
    error: Optional[str] = None,
) -> None:
    """Upsert sync state after a run."""
    try:
        _get_graph_sync_state_write_client().from_("graph_sync_state").upsert(
            {
                "source": source,
                "resource_id": resource_id,
                "resource_name": resource_name,
                "delta_token": delta_token,
                "last_sync_at": datetime.now(timezone.utc).isoformat(),
                "sync_status": status,
                "error_message": error,
                "items_synced": items_synced,
            },
            on_conflict="source,resource_id",
        ).execute()
    except Exception as exc:
        logger.error(
            "[GraphSync] Could not save sync state for %s/%s: %s",
            source,
            resource_id,
            exc,
        )


def _pending_outlook_webhook_rows(limit: int) -> list[dict[str, Any]]:
    """Return bounded Outlook mailbox rows that have queued webhook work."""
    try:
        result = (
            _get_graph_sync_state_read_client()
            .from_("graph_sync_state")
            .select("resource_id,resource_name,sync_status,updated_at,created_at")
            .eq("source", "outlook_email")
            .eq("sync_status", OUTLOOK_WEBHOOK_PENDING_STATUS)
            .execute()
        )
    except Exception as exc:
        logger.warning("[GraphSync] Could not load queued Outlook webhook rows: %s", exc)
        return []

    rows = [dict(row) for row in (result.data or []) if row.get("resource_id")]
    rows.sort(key=lambda row: str(row.get("updated_at") or row.get("created_at") or ""))
    return rows[: max(1, limit)]


def drain_pending_outlook_mailboxes(
    supabase: Client,
    *,
    limit: int = 5,
) -> dict[str, Any]:
    """Drain queued Outlook mailboxes recorded by Graph webhook notifications."""
    rows = _pending_outlook_webhook_rows(limit)
    if not rows:
        return {
            "status": "skipped",
            "reason": "no_pending_mailboxes",
            "queued": 0,
            "processed": 0,
            "failed": 0,
            "items_synced": 0,
            "mailboxes": [],
        }

    processed = 0
    failed = 0
    items_synced = 0
    mailboxes: list[str] = []
    write_client = _get_graph_sync_state_write_client()

    for row in rows:
        mailbox = str(row.get("resource_id") or "").strip()
        if not mailbox:
            continue
        resource_name = str(row.get("resource_name") or f"Outlook: {mailbox}")
        mailboxes.append(mailbox)
        write_client.from_("graph_sync_state").update(
            {
                "resource_name": resource_name,
                "sync_status": "running",
                "error_message": "Draining queued Graph webhook mailbox delta.",
            }
        ).eq("source", "outlook_email").eq("resource_id", mailbox).execute()

        try:
            result = sync_outlook_mailbox_delta(
                supabase,
                mailbox,
                reason="graph_webhook_drain",
                verify_persisted_count=False,
            )
            processed += 1
            items_synced += int(result.get("items_synced") or 0)
        except Exception as exc:
            failed += 1
            logger.error("[GraphSync] Outlook webhook drain failed for %s: %s", mailbox, exc, exc_info=True)
            _save_sync_state(
                supabase,
                "outlook_email",
                mailbox,
                resource_name,
                "",
                0,
                "error",
                str(exc),
            )

    status = "failed" if failed and not processed else "ok"
    if failed and processed:
        status = "partial"
    return {
        "status": status,
        "queued": len(rows),
        "processed": processed,
        "failed": failed,
        "items_synced": items_synced,
        "mailboxes": mailboxes,
    }


def _get_active_project_keywords(supabase: Client) -> list[str]:
    """Return names of active projects for email filtering."""
    result = (
        supabase.from_("projects")
        .select("name, aliases")
        .eq("archived", False)
        .execute()
    )
    keywords = []
    for p in (result.data or []):
        if p.get("name"):
            keywords.append(p["name"])
        for alias in (p.get("aliases") or []):
            if alias:
                keywords.append(alias)
    return keywords


def sync_outlook_mailbox_delta(
    supabase: Client,
    user_email: str,
    *,
    reason: str = "scheduled",
    verify_persisted_count: bool = True,
    load_project_keywords: bool = False,
) -> dict[str, Any]:
    """Sync one Outlook mailbox through the durable delta-token path."""
    started_at = datetime.now(timezone.utc)
    before_count = _count_outlook_docs_for_mailbox(supabase, user_email) if verify_persisted_count else 0
    project_keywords = _get_active_project_keywords(supabase) if load_project_keywords else []
    token = _get_delta_token(supabase, "outlook_email", user_email)
    since_date = os.environ.get("OUTLOOK_SYNC_SINCE") or None

    # Self-heal a retired/legacy/malformed stored cursor. Before this reset, a
    # non-canonical cursor made sync_outlook_emails() raise on every scheduled
    # pass, permanently freezing the mailbox and re-firing the same critical
    # "delta cursor must use the canonical format" alert. A None token triggers a
    # safe full resync, after which _save_sync_state persists a fresh canonical
    # cursor and the alert resolves on its own.
    # A truthy-but-non-canonical token is a retired/legacy/malformed cursor. An
    # empty/absent token is simply "no cursor" and already means full resync, so
    # it passes through untouched (no reset event, no warning).
    cursor_reset = False
    if token and not is_canonical_outlook_delta_cursor(token):
        logger.warning(
            "[GraphSync] Retired Outlook delta cursor for %s (reason=%s); "
            "resetting to a full resync to recover.",
            user_email,
            reason,
        )
        token = None
        cursor_reset = True

    count, new_token = sync_outlook_emails(
        supabase,
        user_email,
        project_keywords,
        token,
        since_date,
    )
    after_count = _count_outlook_docs_for_mailbox(supabase, user_email) if verify_persisted_count else 0
    persisted_delta = max(0, after_count - before_count) if verify_persisted_count else None
    sync_status = "success"
    sync_error: Optional[str] = None
    if verify_persisted_count and count > 0 and after_count == 0:
        sync_status = "mismatch"
        sync_error = (
            f"Persisted Outlook intake missing for {user_email}: "
            f"sync_outlook_emails processed {count}, but no durable outlook_email_intake rows are visible."
        )
        logger.error("[GraphSync] %s", sync_error)

    _save_sync_state(
        supabase,
        "outlook_email",
        user_email,
        f"Outlook: {user_email}",
        new_token,
        count,
        sync_status,
        sync_error,
    )
    _record_sync_run_safe(
        supabase,
        source="outlook_email",
        resource_id=user_email,
        resource_name=f"Outlook: {user_email}",
        started_at=started_at,
        status="warning" if sync_error else "succeeded",
        items_seen=count,
        items_synced=count,
        error_message=sync_error,
        metadata={"persisted_delta": persisted_delta, "reason": reason, "cursor_reset": cursor_reset},
    )
    return {
        "status": "warning" if sync_error else "succeeded",
        "user_email": user_email,
        "items_synced": count,
        "persisted_delta": persisted_delta,
        "delta_token_saved": bool(new_token),
        "cursor_reset": cursor_reset,
        "error": sync_error,
        "reason": reason,
    }


def _run_graph_source_reconciliation(
    supabase: Client,
    *,
    run_outlook: bool,
    run_teams: bool,
    run_onedrive: bool,
    run_sharepoint: bool,
    outlook_users: Optional[list[str]],
    verify_outlook_persisted_count: bool,
) -> dict[str, Any]:
    """Run only Graph source acquisition/reconciliation work."""
    summary: dict[str, Any] = {
        "outlook": 0,
        "teams": 0,
        "teams_dm": 0,
        "onedrive": 0,
        "sharepoint": 0,
        "sharepoint_failed": 0,
        "errors": [],
        "sync_emails_enabled": False,
        "sync_teams_enabled": False,
        "sync_teams_dm_enabled": False,
        "sync_onedrive_enabled": False,
        "sync_sharepoint_enabled": False,
    }

    sync_emails = run_outlook and os.environ.get("GRAPH_SYNC_OUTLOOK", "true").lower() == "true"
    summary["sync_emails_enabled"] = sync_emails
    if sync_emails:
        if outlook_users is None:
            user_emails = [
                e.strip()
                for e in os.environ.get("MICROSOFT_SYNC_USERS", "").split(",")
                if e.strip()
            ]
        else:
            user_emails = [e.strip() for e in outlook_users if e and e.strip()]
        user_emails = _limit_sync_users(
            supabase,
            source="outlook_email",
            users=user_emails,
            env_key="OUTLOOK_SYNC_MAX_USERS",
            default_limit=1,
            always_include_env_key="OUTLOOK_SYNC_ALWAYS_INCLUDE_USERS",
        )
        summary["outlook_users_selected"] = user_emails

        for user_email in user_emails:
            started_at = datetime.now(timezone.utc)
            try:
                result = sync_outlook_mailbox_delta(
                    supabase,
                    user_email,
                    reason="scheduled",
                    verify_persisted_count=verify_outlook_persisted_count,
                )
                if result.get("error"):
                    summary["errors"].append(result["error"])
                summary["outlook"] += int(result.get("items_synced") or 0)
            except Exception as exc:
                err = f"Outlook sync failed for {user_email}: {exc}"
                logger.error("[GraphSync] %s", err)
                summary["errors"].append(err)
                _save_sync_state(
                    supabase,
                    "outlook_email",
                    user_email,
                    f"Outlook: {user_email}",
                    "",
                    0,
                    "error",
                    str(exc),
                )
                _record_sync_run_safe(
                    supabase,
                    source="outlook_email",
                    resource_id=user_email,
                    resource_name=f"Outlook: {user_email}",
                    started_at=started_at,
                    status="failed",
                    items_failed=1,
                    error_message=str(exc),
                )

    sync_teams = run_teams and os.environ.get("GRAPH_SYNC_TEAMS", "true").lower() == "true"
    summary["sync_teams_enabled"] = sync_teams
    if sync_teams:
        try:
            channels = get_all_teams_and_channels(supabase)
            channels = _limit_sync_items(
                channels,
                env_key="TEAMS_CHANNEL_SYNC_MAX_CHANNELS",
                default_limit=5,
                label="Teams channels",
            )
            summary["teams_channels_selected"] = len(channels)
            for ch in channels:
                resource_id = f"{ch['team_id']}:{ch['channel_id']}"
                resource_name = f"Teams: {ch['team_name']} / {ch['channel_name']}"
                started_at = datetime.now(timezone.utc)
                try:
                    token = _get_delta_token(supabase, "teams_message", resource_id)
                    count, new_token = sync_teams_channel(
                        supabase,
                        ch["team_id"], ch["team_name"],
                        ch["channel_id"], ch["channel_name"],
                        token,
                    )
                    _save_sync_state(supabase, "teams_message", resource_id, resource_name, new_token, count)
                    _record_sync_run_safe(
                        supabase,
                        source="teams_message",
                        resource_id=resource_id,
                        resource_name=resource_name,
                        started_at=started_at,
                        status="succeeded",
                        items_seen=count,
                        items_synced=count,
                    )
                    summary["teams"] += count
                except Exception as exc:
                    err = f"Teams sync failed for {resource_name}: {exc}"
                    logger.error("[GraphSync] %s", err, exc_info=True)
                    summary["errors"].append(err)
                    _record_sync_run_safe(
                        supabase,
                        source="teams_message",
                        resource_id=resource_id,
                        resource_name=resource_name,
                        started_at=started_at,
                        status="failed",
                        items_failed=1,
                        error_message=str(exc),
                    )
        except Exception as exc:
            err = f"Teams enumeration failed: {exc}"
            logger.error("[GraphSync] %s", err)
            summary["errors"].append(err)

    sync_teams_dm = run_teams and os.environ.get("GRAPH_SYNC_TEAMS_DM", "true").lower() == "true"
    summary["sync_teams_dm_enabled"] = sync_teams_dm
    if sync_teams_dm:
        dm_users = [
            e.strip()
            for e in os.environ.get("MICROSOFT_SYNC_USERS", "").split(",")
            if e.strip()
        ]
        dm_users = _limit_sync_users(
            supabase,
            source="teams_chat_export",
            users=dm_users,
            env_key="TEAMS_DM_SYNC_MAX_USERS",
            default_limit=1,
            resource_id_prefix="user:",
        )
        summary["teams_dm_users_selected"] = dm_users
        for user_email in dm_users:
            started_at = datetime.now(timezone.utc)
            try:
                resource_id = f"user:{user_email}"
                resource_name = f"Teams DM export: {user_email}"
                since_iso = _get_delta_token(supabase, "teams_chat_export", resource_id)
                count, new_ts = sync_user_chat_messages(supabase, user_email, since_iso)
                _save_sync_state(
                    supabase,
                    "teams_chat_export",
                    resource_id,
                    resource_name,
                    new_ts,
                    count,
                )
                _record_sync_run_safe(
                    supabase,
                    source="teams_chat_export",
                    resource_id=resource_id,
                    resource_name=resource_name,
                    started_at=started_at,
                    status="succeeded",
                    items_seen=count,
                    items_synced=count,
                )
                summary["teams_dm"] += count
            except ChatReadPermissionError as exc:
                err = f"Teams DM sync skipped — Chat.Read.All admin consent required in Azure AD: {exc}"
                logger.error("[GraphSync] %s", err)
                summary["errors"].append(err)
                _record_sync_run_safe(
                    supabase,
                    source="teams_chat_export",
                    resource_id=f"user:{user_email}",
                    resource_name=f"Teams DM export: {user_email}",
                    started_at=started_at,
                    status="skipped",
                    error_message=str(exc),
                    metadata={"required_permission": "Chat.Read.All"},
                )
                break
            except Exception as exc:
                err = f"Teams DM export failed for {user_email}: {exc}"
                logger.error("[GraphSync] %s", err, exc_info=True)
                summary["errors"].append(err)
                _save_sync_state(
                    supabase,
                    "teams_chat_export",
                    f"user:{user_email}",
                    f"Teams DM export: {user_email}",
                    "",
                    0,
                    "error",
                    str(exc),
                )
                _record_sync_run_safe(
                    supabase,
                    source="teams_chat_export",
                    resource_id=f"user:{user_email}",
                    resource_name=f"Teams DM export: {user_email}",
                    started_at=started_at,
                    status="failed",
                    items_failed=1,
                    error_message=str(exc),
                )

    sync_onedrive = run_onedrive and os.environ.get("GRAPH_SYNC_ONEDRIVE", "false").lower() == "true"
    summary["sync_onedrive_enabled"] = sync_onedrive
    if sync_onedrive:
        user_emails = [
            e.strip()
            for e in os.environ.get("MICROSOFT_SYNC_USERS", "").split(",")
            if e.strip()
        ]
        user_emails = _limit_sync_users(
            supabase,
            source="onedrive_file",
            users=user_emails,
            env_key="ONEDRIVE_SYNC_MAX_USERS",
            default_limit=1,
        )
        folders_raw = os.environ.get("ONEDRIVE_SYNC_FOLDERS") or os.environ.get("ONEDRIVE_SYNC_FOLDER", "/Projects")
        onedrive_folders = [f.strip() for f in folders_raw.split(",") if f.strip()]
        onedrive_folders = _limit_sync_items(
            onedrive_folders,
            env_key="ONEDRIVE_SYNC_MAX_FOLDERS",
            default_limit=2,
            label="OneDrive folders",
        )
        summary["onedrive_users_selected"] = user_emails
        summary["onedrive_folders_selected"] = onedrive_folders

        for user_email in user_emails:
            for folder_path in onedrive_folders:
                resource_id = f"{user_email}:{folder_path}"
                resource_name = f"OneDrive: {user_email}{folder_path}"
                started_at = datetime.now(timezone.utc)
                try:
                    token = _get_delta_token(supabase, "onedrive_file", resource_id)
                    count, new_token = sync_onedrive_folder(supabase, user_email, folder_path, token)
                    _save_sync_state(supabase, "onedrive_file", resource_id, resource_name, new_token, count)
                    _record_sync_run_safe(
                        supabase,
                        source="onedrive_file",
                        resource_id=resource_id,
                        resource_name=resource_name,
                        started_at=started_at,
                        status="succeeded",
                        items_seen=count,
                        items_synced=count,
                    )
                    summary["onedrive"] += count
                except Exception as exc:
                    err = f"OneDrive sync failed for {user_email}{folder_path}: {exc}"
                    logger.error("[GraphSync] %s", err)
                    summary["errors"].append(err)
                    _save_sync_state(supabase, "onedrive_file", resource_id, resource_name, "", 0, "error", str(exc))
                    _record_sync_run_safe(
                        supabase,
                        source="onedrive_file",
                        resource_id=resource_id,
                        resource_name=resource_name,
                        started_at=started_at,
                        status="failed",
                        items_failed=1,
                        error_message=str(exc),
                    )

    sync_sharepoint = run_sharepoint and os.environ.get("GRAPH_SYNC_SHAREPOINT", "true").lower() == "true"
    summary["sync_sharepoint_enabled"] = sync_sharepoint
    selected_scopes: tuple[SharePointScope, ...] = ()
    state_by_resource_id: dict[str, dict[str, Any]] = {}
    if sync_sharepoint:
        try:
            discovery = discover_sharepoint_project_scopes(get_graph_client())
            state_by_resource_id = _get_sharepoint_sync_states(
                [scope.resource_id for scope in discovery.scopes]
            )
            selection = select_sharepoint_scopes(
                discovery.scopes,
                state_by_resource_id,
            )
            selected_scopes = selection.selected
            summary["sharepoint_discovery"] = {
                **discovery.receipt(),
                **selection.receipt(),
            }
            summary["sharepoint_entries_selected"] = [
                scope.entry for scope in selected_scopes
            ]
            if selection.incremental_pending_count:
                summary["errors"].append(
                    "SharePoint incremental scope cap left "
                    f"{selection.incremental_pending_count} initialized project folder(s) "
                    "unchecked. Increase SHAREPOINT_INCREMENTAL_MAX_FOLDERS or reduce "
                    "the governed discovery window."
                )
        except Exception as exc:
            err = f"SharePoint project-folder discovery failed: {exc}"
            logger.error("[GraphSync] %s", err)
            summary["errors"].append(err)
            summary["sharepoint_discovery"] = {
                "status": "failed",
                "error": str(exc),
            }

    for scope in selected_scopes:
        resource_id = scope.resource_id
        resource_name = scope.resource_name
        started_at = datetime.now(timezone.utc)
        state = state_by_resource_id.get(resource_id) or {}
        token = str(state.get("delta_token") or "")
        try:
            result: SharePointSyncResult = sync_sharepoint_folder(
                supabase,
                scope.hostname,
                scope.site_name,
                scope.folder_path,
                token,
                expected_project_number=scope.project_number,
            )
            status = "warning" if result.retry_required else "success"
            error = (
                result.retry_reason
                or f"{result.items_failed} SharePoint file(s) failed; the prior delta cursor was preserved for automatic retry."
                if result.retry_required
                else None
            )
            _save_sync_state(
                supabase,
                "sharepoint_file",
                resource_id,
                resource_name,
                result.delta_token,
                result.items_synced,
                status,
                error,
            )
            _record_sync_run_safe(
                supabase,
                source="sharepoint_file",
                resource_id=resource_id,
                resource_name=resource_name,
                started_at=started_at,
                status="warning" if result.retry_required else "succeeded",
                items_seen=(
                    result.items_synced
                    + result.items_unchanged
                    + result.items_excluded
                    + result.items_failed
                ),
                items_synced=result.items_synced,
                items_failed=result.items_failed,
                error_message=error,
                metadata={
                    "retry_scheduled": result.retry_required,
                    "items_unchanged": result.items_unchanged,
                    "items_excluded": result.items_excluded,
                    "excluded_by_extension": result.excluded_by_extension,
                    "scope_source": scope.source,
                    "project_number": scope.project_number,
                    "inventory_complete": result.inventory_complete,
                },
            )
            summary["sharepoint"] += result.items_synced
            summary["sharepoint_failed"] += result.items_failed
            summary["sharepoint_excluded"] = int(
                summary.get("sharepoint_excluded") or 0
            ) + result.items_excluded
            summary["sharepoint_unchanged"] = int(
                summary.get("sharepoint_unchanged") or 0
            ) + result.items_unchanged
            if result.retry_required:
                summary["errors"].append(
                    f"SharePoint recovery scheduled for {resource_name}: {error}"
                )
        except Exception as exc:
            err = f"SharePoint sync failed for {resource_name}: {exc}"
            logger.error("[GraphSync] %s", err)
            summary["errors"].append(err)
            # Keep the last good cursor. Clearing it turns one transient failure into a
            # full re-ingest and can hide the exact delta batch that needs recovery.
            _save_sync_state(
                supabase,
                "sharepoint_file",
                resource_id,
                resource_name,
                token,
                0,
                "error",
                str(exc),
            )
            _record_sync_run_safe(
                supabase,
                source="sharepoint_file",
                resource_id=resource_id,
                resource_name=resource_name,
                started_at=started_at,
                status="failed",
                items_failed=1,
                error_message=str(exc),
                metadata={
                    "scope_source": scope.source,
                    "project_number": scope.project_number,
                },
            )

    summary["communications_synced"] = (
        summary["outlook"] + summary["teams"] + summary["teams_dm"]
    )
    summary["total_synced"] = (
        summary["outlook"]
        + summary["teams"]
        + summary["teams_dm"]
        + summary["onedrive"]
        + summary["sharepoint"]
    )
    summary["status"] = "complete" if not summary["errors"] else "complete_with_errors"
    return summary


def _run_graph_downstream_processing(
    supabase: Client,
    *,
    sync_started_at: datetime,
    source_summary: dict[str, Any],
    run_embedding: bool,
    run_ocr: bool,
    run_attachment_promotion: bool,
    embed_limit: int,
    ocr_batch_size: int,
    attachment_promotion_limit: int,
) -> dict[str, Any]:
    """Run post-sync enrichment after source reconciliation succeeds or partially succeeds."""
    summary: dict[str, Any] = {
        "errors": [],
        "phases": {
            "source_sync": source_summary.get("status", "complete"),
            "outlook_conversations": (
                "enabled"
                if source_summary.get("sync_emails_enabled")
                and source_summary.get("compile_outlook_conversations", True)
                and os.environ.get("GRAPH_COMPILE_OUTLOOK_CONVERSATIONS", "true").lower() == "true"
                else "skipped"
            ),
            "embedding": "workflow_queue" if run_embedding else "skipped",
            "ocr": "enabled" if run_ocr else "skipped",
            "attachment_promotion": "enabled" if run_attachment_promotion else "skipped",
        },
    }
    ocr_result: dict[str, Any] = {"ocr_full": 0, "ocr_partial": 0}

    if summary["phases"]["outlook_conversations"] == "enabled":
        conversation_results: dict[str, Any] = {}
        compile_limit = _bounded_int_env("OUTLOOK_CONVERSATION_COMPILE_LIMIT", 25, 1, 200)
        for user_email in source_summary.get("outlook_users_selected") or [None]:
            label = user_email or "all_mailboxes"
            try:
                result = compile_outlook_conversations(
                    supabase,
                    mailbox_user_id=user_email,
                    since=sync_started_at.isoformat(),
                    limit=compile_limit,
                )
                conversation_results[label] = result
                if result.get("errors"):
                    summary["errors"].append(
                        f"Outlook conversation compile failed for {label}: "
                        + "; ".join(str(error) for error in result["errors"][:3])
                    )
            except Exception as exc:
                logger.error("[GraphSync] Outlook conversation compilation failed for %s: %s", label, exc)
                summary["errors"].append(f"Outlook conversation compile failed for {label}: {exc}")
                conversation_results[label] = {"status": "failed", "error": str(exc)}
        summary["outlook_conversations"] = conversation_results
    else:
        summary["outlook_conversations"] = {
            "status": "skipped",
            "reason": (
                "sync_emails_disabled"
                if not source_summary.get("sync_emails_enabled")
                else "disabled_for_isolated_phase"
                if not source_summary.get(
                    "compile_outlook_conversations",
                    True,
                )
                else "GRAPH_COMPILE_OUTLOOK_CONVERSATIONS=false"
            ),
        }

    if run_ocr:
        try:
            from .ocr_worker import run_ocr_pass

            ocr_result = run_ocr_pass(supabase, limit=ocr_batch_size)
            summary["ocr"] = ocr_result
            if ocr_result.get("ocr_partial", 0):
                logger.warning(
                    "[GraphSync] OCR page cap hit on %d file(s) — marked ocr_partial. "
                    "Check /files?status=ocr_partial to review.",
                    ocr_result["ocr_partial"],
                )
            logger.info("[GraphSync] OCR pass complete: %s", ocr_result)
        except Exception as exc:
            logger.error("[GraphSync] OCR pass failed: %s", exc)
            summary["errors"].append(f"OCR pass failed: {exc}")
            summary["ocr"] = {"error": str(exc)}
    else:
        summary["ocr"] = {"status": "skipped", "reason": "run_ocr=false"}

    if run_embedding:
        try:
            workflow_result = enqueue_pending_graph_documents(
                supabase,
                limit=embed_limit,
            )
            summary["embed"] = workflow_result
            workflow_errors = int(workflow_result.get("errors") or 0)
            if workflow_errors:
                summary["errors"].append(
                    "Graph durable workflow enqueue failed for "
                    f"{workflow_errors} document(s)"
                )
            logger.info(
                "[GraphSync] Durable workflow queue complete: %s",
                workflow_result,
            )
        except Exception as exc:
            logger.error("[GraphSync] Durable workflow queue failed: %s", exc)
            summary["errors"].append(f"Workflow queue failed: {exc}")
            summary["embed"] = {"error": str(exc)}
    else:
        summary["embed"] = {
            "status": "skipped",
            "reason": "run_embedding=false",
        }

    if source_summary.get("sync_emails_enabled") and run_embedding:
        vectorization_results: dict[str, Any] = {}
        for user_email in source_summary.get("outlook_users_selected") or []:
            try:
                vectorization_results[user_email] = refresh_outlook_intake_vectorization_statuses(
                    mailbox_user_id=user_email,
                    limit=max(embed_limit * 3, 25),
                    since=sync_started_at.isoformat(),
                )
            except Exception as exc:
                logger.warning(
                    "[GraphSync] Outlook vectorization status refresh failed for %s: %s",
                    user_email,
                    exc,
                    exc_info=True,
                )
                vectorization_results[user_email] = {"error": str(exc)}
        summary["outlook_vectorization_status"] = vectorization_results

    if run_attachment_promotion:
        try:
            promotion_result = promote_outlook_intake_attachments(
                supabase, limit=attachment_promotion_limit
            )
            summary["attachment_promotion"] = promotion_result
            logger.info(
                "[GraphSync] Attachment promotion complete — seen: %d, promoted: %d, "
                "skipped: %d, review_needed: %d, failed: %d",
                promotion_result.get("seen", 0),
                promotion_result.get("promoted", 0),
                promotion_result.get("skipped", 0),
                promotion_result.get("review_needed", 0),
                promotion_result.get("failed", 0),
            )
            if promotion_result.get("failed"):
                logger.warning(
                    "[GraphSync] Attachment promotion had %d failure(s): %s",
                    promotion_result["failed"],
                    promotion_result.get("failures"),
                )
        except Exception as exc:
            logger.error("[GraphSync] Attachment promotion step failed: %s", exc)
            summary["errors"].append(f"Attachment promotion failed: {exc}")
            summary["attachment_promotion"] = {"error": str(exc)}
    else:
        summary["attachment_promotion"] = {"status": "skipped", "reason": "run_attachment_promotion=false"}

    communications_synced = int(source_summary.get("communications_synced") or 0)
    if communications_synced > 0:
        try:
            from src.services.ingestion.sync_followups import maybe_run_comm_project_backfill

            project_backfill_result = maybe_run_comm_project_backfill(
                supabase,
                since=sync_started_at,
            )
            summary["project_backfill"] = project_backfill_result
            if project_backfill_result.get("failed"):
                summary["errors"].append(
                    "Communication project backfill failed for "
                    f"{project_backfill_result.get('failed')} row(s)"
                )
            logger.info("[GraphSync] Communication project backfill complete: %s", project_backfill_result)
        except Exception as exc:
            logger.error("[GraphSync] Communication project backfill failed (non-fatal): %s", exc)
            summary["errors"].append(f"Communication project backfill failed: {exc}")
            summary["project_backfill"] = {"error": str(exc)}

        try:
            from src.services.project_intelligence.projections.project_communications import synthesize_new_comms_since

            extract_result = synthesize_new_comms_since(
                sync_started_at.isoformat(),
                # graph-sync cannot persist PM-APP L2 projections (no ALLOW_PM_APP_FINAL_PROJECTIONS),
                # so skip the every-2h L2 re-synthesis here; the daily sweep owns L2. Extraction still runs.
                refresh_intelligence=False,
            )
            summary["intelligence_extraction"] = extract_result
            logger.info(
                "[GraphSync] Event-driven extraction: projects=%d cards=%d packets=%d errors=%d",
                extract_result.get("projects", 0),
                extract_result.get("cards_written", 0),
                extract_result.get("synthesis_packets_written", 0),
                len(extract_result.get("errors", [])),
            )
        except Exception as exc:
            logger.error("[GraphSync] Event-driven extraction failed (non-fatal): %s", exc)
            summary["errors"].append(f"Intelligence extraction failed: {exc}")
            summary["intelligence_extraction"] = {"error": str(exc)}
    else:
        summary["project_backfill"] = {
            "status": "skipped",
            "reason": "no_new_outlook_or_teams_communications",
        }
        summary["intelligence_extraction"] = {
            "status": "skipped",
            "reason": "no_new_outlook_or_teams_communications",
        }

    summary["status"] = "complete" if not summary["errors"] else "complete_with_errors"
    return summary


def run_graph_sync(
    supabase: Client,
    *,
    run_outlook: bool = True,
    run_teams: bool = True,
    run_onedrive: bool = False,
    run_sharepoint: bool = True,
    run_embedding: bool = True,
    run_ocr: bool = True,
    run_attachment_promotion: bool = True,
    embed_limit: int = 25,
    ocr_batch_size: int = 20,
    attachment_promotion_limit: int = 50,
    outlook_users: Optional[list[str]] = None,
    verify_outlook_persisted_count: bool = True,
    run_downstream: bool = True,
    record_source_receipt: bool = True,
    record_downstream_receipt: bool = True,
    source_summary_override: Optional[dict[str, Any]] = None,
    sync_started_at_override: Optional[datetime] = None,
) -> dict:
    """
    Run a full Microsoft Graph sync for all configured sources.
    Called by the scheduler or the /api/graph/sync endpoint.

    Returns a summary dict with counts per source.
    """
    from src.services.ops.db_pressure_guard import enforce_app_db_pressure_guard

    enforce_app_db_pressure_guard("graph_sync")

    # Watermark for the event-driven extraction phase below: anything ingested
    # after this instant is "new this sync" and gets turned into intelligence
    # inline, instead of waiting for a blind re-scan. Small buffer so a doc whose
    # row lands a moment before this line is still caught (the candidate-based skip
    # makes any overlap free).
    sync_started_at = (
        sync_started_at_override
        or datetime.now(timezone.utc) - timedelta(minutes=5)
    )
    source_phase_started_at = datetime.now(timezone.utc)

    graph = get_graph_client()
    if not graph.is_configured():
        logger.info("[GraphSync] Microsoft Graph credentials not set — skipping")
        return {"status": "skipped", "reason": "not_configured"}
    source_summary = (
        source_summary_override
        if source_summary_override is not None
        else _run_graph_source_reconciliation(
            supabase,
            run_outlook=run_outlook,
            run_teams=run_teams,
            run_onedrive=run_onedrive,
            run_sharepoint=run_sharepoint,
            outlook_users=outlook_users,
            verify_outlook_persisted_count=verify_outlook_persisted_count,
        )
    )
    source_errors = list(source_summary.get("errors") or [])
    if record_source_receipt:
        _record_graph_phase_run_safe(
            supabase,
            source="microsoft_graph_source_sync",
            resource_name="Microsoft Graph source reconciliation",
            stage="source_reconciliation",
            started_at=source_phase_started_at,
            status="failed" if source_errors else "succeeded",
            items_seen=int(source_summary.get("total_synced") or 0),
            items_synced=int(source_summary.get("total_synced") or 0),
            items_failed=len(source_errors),
            error_message="; ".join(str(error) for error in source_errors[:3]) if source_errors else None,
            metadata={
                "outlook": source_summary.get("outlook"),
                "teams": source_summary.get("teams"),
                "teams_dm": source_summary.get("teams_dm"),
                "onedrive": source_summary.get("onedrive"),
                "sharepoint": source_summary.get("sharepoint"),
                "sharepoint_failed": source_summary.get("sharepoint_failed"),
                "sharepoint_excluded": source_summary.get("sharepoint_excluded"),
                "sharepoint_discovery": source_summary.get("sharepoint_discovery"),
                "communications_synced": source_summary.get("communications_synced"),
            },
        )
    logger.info(
        "[GraphSync] Source reconciliation complete — Outlook: %d, Teams channels: %d, "
        "Teams DMs: %d, OneDrive: %d, SharePoint: %d",
        source_summary["outlook"],
        source_summary["teams"],
        source_summary["teams_dm"],
        source_summary["onedrive"],
        source_summary["sharepoint"],
    )

    if not run_downstream:
        return {
            "status": (
                "complete" if not source_errors else "complete_with_errors"
            ),
            "total_synced": source_summary["total_synced"],
            "outlook": source_summary["outlook"],
            "teams": source_summary["teams"],
            "teams_dm": source_summary["teams_dm"],
            "onedrive": source_summary["onedrive"],
            "sharepoint": source_summary["sharepoint"],
            "errors": source_errors,
            "source_sync_errors": source_errors,
            "downstream_errors": [],
            "phases": {
                "source_sync": source_summary.get("status", "complete"),
                "downstream": "skipped",
            },
            "source_sync": source_summary,
            "downstream": {
                "status": "skipped",
                "reason": "run_downstream=false",
            },
            **{
                key: value
                for key, value in source_summary.items()
                if key
                not in {
                    "outlook",
                    "teams",
                    "teams_dm",
                    "onedrive",
                    "sharepoint",
                    "errors",
                    "status",
                    "total_synced",
                }
            },
        }

    downstream_phase_started_at = datetime.now(timezone.utc)
    downstream_summary = _run_graph_downstream_processing(
        supabase,
        sync_started_at=sync_started_at,
        source_summary=source_summary,
        run_embedding=run_embedding,
        run_ocr=run_ocr,
        run_attachment_promotion=run_attachment_promotion,
        embed_limit=embed_limit,
        ocr_batch_size=ocr_batch_size,
        attachment_promotion_limit=attachment_promotion_limit,
    )

    downstream_errors = list(downstream_summary.get("errors") or [])
    if record_downstream_receipt:
        _record_graph_phase_run_safe(
            supabase,
            source="microsoft_graph_downstream",
            resource_name="Microsoft Graph downstream enrichment",
            stage="downstream_enrichment",
            started_at=downstream_phase_started_at,
            status="failed" if downstream_errors else "succeeded",
            items_seen=int(source_summary.get("total_synced") or 0),
            items_synced=int(source_summary.get("total_synced") or 0) if not downstream_errors else 0,
            items_failed=len(downstream_errors),
            error_message="; ".join(str(error) for error in downstream_errors[:3]) if downstream_errors else None,
            metadata={
                "communications_synced": source_summary.get("communications_synced"),
                "outlook_conversations": downstream_summary.get("outlook_conversations"),
                "project_backfill": downstream_summary.get("project_backfill"),
                "embedding": downstream_summary.get("embed"),
                "ocr": downstream_summary.get("ocr"),
                "attachment_promotion": downstream_summary.get("attachment_promotion"),
                "intelligence_extraction": downstream_summary.get("intelligence_extraction"),
            },
        )
    errors = source_errors + downstream_errors
    status = "complete" if not errors else "complete_with_errors"

    return {
        "status": status,
        "total_synced": source_summary["total_synced"],
        "outlook": source_summary["outlook"],
        "teams": source_summary["teams"],
        "teams_dm": source_summary["teams_dm"],
        "onedrive": source_summary["onedrive"],
        "sharepoint": source_summary["sharepoint"],
        "errors": errors,
        "source_sync_errors": source_errors,
        "downstream_errors": downstream_errors,
        "phases": downstream_summary["phases"],
        "source_sync": source_summary,
        "downstream": downstream_summary,
        **{
            key: value
            for key, value in source_summary.items()
            if key
            not in {
                "outlook",
                "teams",
                "teams_dm",
                "onedrive",
                "sharepoint",
                "errors",
                "status",
                "total_synced",
            }
        },
        **{
            key: value
            for key, value in downstream_summary.items()
            if key not in {"errors", "status", "phases"}
        },
    }
