"""Microsoft Graph subscription lifecycle helpers."""

from __future__ import annotations

import hashlib
import logging
import os
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Optional

from src.services.supabase_helpers import get_rag_read_client, get_rag_write_client

from .client import get_graph_client
from .webhooks import expected_client_state

logger = logging.getLogger(__name__)


def _get_graph_subscription_read_client() -> Any:
    return get_rag_read_client()


def _get_graph_subscription_write_client() -> Any:
    return get_rag_write_client()


@dataclass(frozen=True)
class GraphSubscriptionTarget:
    source: str
    resource_id: str
    resource_name: str
    resource: str
    change_type: str
    max_expiration_hours: int = 48


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def _parse_datetime(value: Any) -> Optional[datetime]:
    if not value:
        return None
    try:
        parsed = datetime.fromisoformat(str(value).replace("Z", "+00:00"))
    except ValueError:
        return None
    return parsed if parsed.tzinfo else parsed.replace(tzinfo=timezone.utc)


def _notification_url() -> str:
    value = (
        os.getenv("MICROSOFT_GRAPH_WEBHOOK_NOTIFICATION_URL")
        or os.getenv("GRAPH_WEBHOOK_NOTIFICATION_URL")
        or ""
    ).strip()
    if not value:
        raise RuntimeError(
            "MICROSOFT_GRAPH_WEBHOOK_NOTIFICATION_URL or GRAPH_WEBHOOK_NOTIFICATION_URL is required"
        )
    return value


def _lifecycle_url() -> Optional[str]:
    return (
        os.getenv("MICROSOFT_GRAPH_WEBHOOK_LIFECYCLE_URL")
        or os.getenv("GRAPH_WEBHOOK_LIFECYCLE_URL")
        or None
    )


def _client_state_hash(client_state: str) -> str:
    return hashlib.sha256(client_state.encode("utf-8")).hexdigest()


def _expiration_iso(hours: int) -> str:
    return (_utcnow() + timedelta(hours=max(1, hours))).isoformat()


def _env_enabled(name: str, default: str = "false") -> bool:
    return os.getenv(name, default).lower() in ("1", "true", "yes")


def _sync_mailboxes() -> List[str]:
    return [e.strip() for e in os.getenv("MICROSOFT_SYNC_USERS", "").split(",") if e.strip()]


def _outlook_subscription_resource(email: str) -> str:
    scope = os.getenv("GRAPH_SUBSCRIBE_OUTLOOK_SCOPE", "inbox").strip().lower()
    if scope in {"all", "all_messages", "mailbox"}:
        return f"users/{email}/messages"
    if scope not in {"inbox", "inbox_only"}:
        logger.warning(
            "[GraphSubscriptions] Unknown GRAPH_SUBSCRIBE_OUTLOOK_SCOPE=%s; defaulting to inbox.",
            scope,
        )
    return f"users/{email}/mailFolders('inbox')/messages"


def configured_subscription_targets() -> List[GraphSubscriptionTarget]:
    targets: List[GraphSubscriptionTarget] = []
    if os.getenv("GRAPH_SUBSCRIBE_OUTLOOK", "true").lower() not in ("0", "false", "no"):
        for email in _sync_mailboxes():
            targets.append(
                GraphSubscriptionTarget(
                    source="outlook_email",
                    resource_id=email,
                    resource_name=f"Outlook: {email}",
                    resource=_outlook_subscription_resource(email),
                    change_type="created,updated",
                    max_expiration_hours=48,
                )
            )
    if _env_enabled("GRAPH_SUBSCRIBE_TEAMS_TENANT"):
        targets.append(
            GraphSubscriptionTarget(
                source="teams_message",
                resource_id="tenant:teams_channel_messages",
                resource_name="Teams tenant channel messages",
                resource="teams/getAllMessages",
                change_type="created,updated",
                max_expiration_hours=1,
            )
        )
    if _env_enabled("GRAPH_SUBSCRIBE_TEAMS_CHAT_TENANT"):
        targets.append(
            GraphSubscriptionTarget(
                source="teams_chat_export",
                resource_id="tenant:teams_chat_messages",
                resource_name="Teams tenant chat messages",
                resource="chats/getAllMessages",
                change_type="created,updated",
                max_expiration_hours=1,
            )
        )
    if _env_enabled("GRAPH_SUBSCRIBE_ONEDRIVE"):
        for email in _sync_mailboxes():
            targets.append(
                GraphSubscriptionTarget(
                    source="onedrive_file",
                    resource_id=f"{email}:drive_root",
                    resource_name=f"OneDrive root: {email}",
                    resource=f"users/{email}/drive/root",
                    change_type="updated",
                    max_expiration_hours=48,
                )
            )
    sharepoint_drive_ids = [
        drive_id.strip()
        for drive_id in os.getenv("GRAPH_SUBSCRIBE_SHAREPOINT_DRIVE_IDS", "").split(",")
        if drive_id.strip()
    ]
    for drive_id in sharepoint_drive_ids:
        targets.append(
            GraphSubscriptionTarget(
                source="sharepoint_file",
                resource_id=f"drive:{drive_id}",
                resource_name=f"SharePoint drive root: {drive_id}",
                resource=f"drives/{drive_id}/root",
                change_type="updated",
                max_expiration_hours=48,
            )
        )
    return targets


def _existing_subscription(supabase: Any, target: GraphSubscriptionTarget) -> Optional[Dict[str, Any]]:
    response = (
        _get_graph_subscription_read_client()
        .table("graph_subscriptions")
        .select("*")
        .eq("source", target.source)
        .eq("resource_id", target.resource_id)
        .limit(1)
        .execute()
    )
    rows = response.data or []
    return dict(rows[0]) if rows else None


def _remove_stale_subscription_rows(
    supabase: Any,
    *,
    selected_targets: List[GraphSubscriptionTarget],
) -> int:
    """Mark subscription rows outside the configured target set as removed.

    Rows are retained for audit/history, but they must not continue to appear as
    active renewal debt after a mailbox leaves the configured sync target list.
    """

    target_keys = {(target.source, target.resource_id) for target in selected_targets}
    target_sources = {target.source for target in selected_targets}
    response = (
        _get_graph_subscription_read_client()
        .table("graph_subscriptions")
        .select("source,resource_id,status")
        .execute()
    )
    rows = response.data or []
    stale_rows = [
        row
        for row in rows
        if row.get("source") in target_sources
        and (row.get("source"), row.get("resource_id")) not in target_keys
        and row.get("status") != "removed"
    ]
    if not stale_rows:
        return 0

    removed = 0
    now_iso = _utcnow().isoformat()
    write_client = _get_graph_subscription_write_client()
    for row in stale_rows:
        source = row.get("source")
        resource_id = row.get("resource_id")
        if not source or not resource_id:
            continue
        update_response = (
            write_client.table("graph_subscriptions")
            .update({
                "status": "removed",
                "last_error_message": None,
                "metadata": {
                    "removal_reason": "not_in_configured_subscription_targets",
                    "removed_at": now_iso,
                },
            })
            .eq("source", source)
            .eq("resource_id", resource_id)
            .execute()
        )
        removed += len(update_response.data or [])
    return removed


def _upsert_subscription(
    supabase: Any,
    target: GraphSubscriptionTarget,
    *,
    graph_subscription_id: Optional[str],
    status: str,
    notification_url: str,
    client_state: str,
    expiration_at: Optional[str] = None,
    lifecycle_notification_url: Optional[str] = None,
    last_error_message: Optional[str] = None,
    metadata: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    payload = {
        "graph_subscription_id": graph_subscription_id,
        "resource": target.resource,
        "source": target.source,
        "resource_id": target.resource_id,
        "resource_name": target.resource_name,
        "change_type": target.change_type,
        "notification_url": notification_url,
        "client_state_hash": _client_state_hash(client_state),
        "lifecycle_notification_url": lifecycle_notification_url,
        "status": status,
        "expiration_at": expiration_at,
        "last_renewed_at": _utcnow().isoformat() if status in {"active", "renewal_due"} else None,
        "last_error_message": last_error_message,
        "metadata": metadata or {},
    }
    response = (
        _get_graph_subscription_write_client()
        .table("graph_subscriptions")
        .upsert(payload, on_conflict="source,resource_id")
        .execute()
    )
    rows = response.data or []
    return dict(rows[0]) if rows else payload


def _create_subscription_payload(
    target: GraphSubscriptionTarget,
    *,
    notification_url: str,
    client_state: str,
    lifecycle_notification_url: Optional[str],
    expiration_hours: int,
) -> Dict[str, Any]:
    target_expiration_hours = min(expiration_hours, target.max_expiration_hours)
    payload: Dict[str, Any] = {
        "changeType": target.change_type,
        "notificationUrl": notification_url,
        "resource": target.resource,
        "expirationDateTime": _expiration_iso(target_expiration_hours),
        "clientState": client_state,
    }
    if lifecycle_notification_url:
        payload["lifecycleNotificationUrl"] = lifecycle_notification_url
    return payload


def _requires_fresh_subscription(
    existing: Optional[Dict[str, Any]],
    *,
    existing_expiration: Optional[datetime],
    now: datetime,
) -> bool:
    if not existing:
        return False

    status = str(existing.get("status") or "").lower()
    last_error_message = str(existing.get("last_error_message") or "")
    if status in {"renewal_due", "removed", "missed", "failed", "expired"}:
        return True
    if "reauthorizationrequired" in last_error_message.replace(" ", "").lower():
        return True
    if existing_expiration and existing_expiration <= now:
        return True
    return False


def _delete_stale_subscription(graph_client: Any, graph_subscription_id: str) -> None:
    try:
        graph_client.delete(f"/subscriptions/{graph_subscription_id}")
    except Exception as exc:
        logger.warning(
            "[GraphSubscriptions] DELETE failed for stale subscription %s; continuing with fresh create: %s",
            graph_subscription_id,
            exc,
        )


def ensure_subscriptions(
    supabase: Any,
    *,
    targets: Optional[List[GraphSubscriptionTarget]] = None,
    graph: Any = None,
    renew_within_hours: int = 6,
    expiration_hours: int = 48,
) -> Dict[str, Any]:
    graph_client = graph or get_graph_client()
    notification_url = _notification_url()
    lifecycle_notification_url = _lifecycle_url()
    client_state = expected_client_state()
    if not client_state:
        raise RuntimeError("MICROSOFT_GRAPH_WEBHOOK_CLIENT_STATE or GRAPH_WEBHOOK_CLIENT_STATE is required")

    selected_targets = targets if targets is not None else configured_subscription_targets()
    stale_removed = _remove_stale_subscription_rows(
        supabase,
        selected_targets=selected_targets,
    )
    stats = {
        "checked": 0,
        "created": 0,
        "renewed": 0,
        "skipped": 0,
        "failed": 0,
        "stale_removed": stale_removed,
        "errors": [],
    }
    now = _utcnow()
    renew_cutoff = now + timedelta(hours=renew_within_hours)

    for target in selected_targets:
        stats["checked"] += 1
        existing = _existing_subscription(supabase, target)
        existing_expiration = _parse_datetime((existing or {}).get("expiration_at"))
        existing_graph_id = (existing or {}).get("graph_subscription_id")
        existing_resource = str((existing or {}).get("resource") or "")
        if (
            existing_graph_id
            and existing_resource == target.resource
            and existing_expiration
            and existing_expiration > renew_cutoff
            and (existing or {}).get("status") == "active"
        ):
            stats["skipped"] += 1
            continue

        try:
            payload = _create_subscription_payload(
                target,
                notification_url=notification_url,
                client_state=client_state,
                lifecycle_notification_url=lifecycle_notification_url,
                expiration_hours=expiration_hours,
            )
            needs_fresh_subscription = _requires_fresh_subscription(
                existing,
                existing_expiration=existing_expiration,
                now=now,
            )
            if existing_graph_id and existing_resource and existing_resource != target.resource:
                _delete_stale_subscription(graph_client, existing_graph_id)
                response = graph_client.post("/subscriptions", payload)
                graph_subscription_id = response.get("id")
                stats["created"] += 1
            elif existing_graph_id and needs_fresh_subscription:
                _delete_stale_subscription(graph_client, existing_graph_id)
                response = graph_client.post("/subscriptions", payload)
                graph_subscription_id = response.get("id")
                stats["created"] += 1
            elif existing_graph_id:
                try:
                    response = graph_client.patch(f"/subscriptions/{existing_graph_id}", {
                        "expirationDateTime": payload["expirationDateTime"],
                    })
                    graph_subscription_id = existing_graph_id
                    stats["renewed"] += 1
                except Exception as patch_exc:
                    # Subscription no longer exists on Graph (expired/removed) — create fresh
                    logger.warning(
                        "[GraphSubscriptions] PATCH failed for %s (%s), creating fresh subscription",
                        existing_graph_id, patch_exc,
                    )
                    response = graph_client.post("/subscriptions", payload)
                    graph_subscription_id = response.get("id")
                    stats["created"] += 1
            else:
                response = graph_client.post("/subscriptions", payload)
                graph_subscription_id = response.get("id")
                stats["created"] += 1
            _upsert_subscription(
                supabase,
                target,
                graph_subscription_id=graph_subscription_id,
                status="active",
                notification_url=notification_url,
                client_state=client_state,
                expiration_at=response.get("expirationDateTime") or payload["expirationDateTime"],
                lifecycle_notification_url=lifecycle_notification_url,
                metadata={"graph_response": response},
            )
        except Exception as exc:
            stats["failed"] += 1
            error = f"{target.resource}: {exc}"
            stats["errors"].append(error)
            logger.warning("[GraphSubscriptions] %s", error)
            _upsert_subscription(
                supabase,
                target,
                graph_subscription_id=existing_graph_id,
                status="failed",
                notification_url=notification_url,
                client_state=client_state,
                expiration_at=(existing or {}).get("expiration_at"),
                lifecycle_notification_url=lifecycle_notification_url,
                last_error_message=str(exc),
            )

    return stats


def delete_subscription(
    supabase: Any,
    *,
    graph_subscription_id: str,
    graph: Any = None,
) -> Dict[str, Any]:
    graph_client = graph or get_graph_client()
    graph_client.delete(f"/subscriptions/{graph_subscription_id}")
    response = (
        _get_graph_subscription_write_client()
        .table("graph_subscriptions")
        .update({"status": "removed", "last_error_message": None})
        .eq("graph_subscription_id", graph_subscription_id)
        .execute()
    )
    return {"status": "removed", "graph_subscription_id": graph_subscription_id, "rows": response.data or []}
