"""Source sync and intelligence health aggregation.

This service intentionally reads from the existing ingestion tables first. The
new health tables provide a durable run ledger, but the admin status endpoint
must still explain the current system even before every producer is wired.
"""

from __future__ import annotations

from collections import Counter, defaultdict
from datetime import datetime, timedelta, timezone
import os
from typing import Any, Dict, Iterable, List, Optional, Sequence, Tuple

from src.services.supabase_helpers import get_rag_read_client, get_rag_write_client
from src.services.integrations.microsoft_graph.sharepoint_scopes import (
    sharepoint_resource_ids_from_receipt,
)


STALE_SYNC_MINUTES = 120
STALE_ACUMATICA_SYNC_MINUTES = 24 * 60
STALE_FIREFLIES_MINUTES = 240
STALE_EXTRACTION_MINUTES = 24 * 60
EMBEDDING_BACKLOG_WARNING = 25
FAILED_JOB_WARNING = 1
DOCUMENT_HEALTH_SAMPLE_LIMIT = 2500
CHUNK_HEALTH_SAMPLE_LIMIT = 5000
CHUNK_DOCUMENT_ID_BATCH_SIZE = 25
JOB_HEALTH_SAMPLE_LIMIT = 5000
MAX_RETURNED_SOURCES = 80
MAX_RETURNED_ALERTS = 80
MAX_RETURNED_STUCK_ITEMS = 25
MAX_RECOMPUTE_SNAPSHOT_WRITES = 25
MAX_RECOMPUTE_ALERT_WRITES = 25
ALERT_TEXT_LIMIT = 1200
ALERT_RESOURCE_ID_LIMIT = 500
FRESHNESS_RUN_LIMIT = 500
# Re-nag cadence for external (Teams) delivery while the same alert stays active.
# Mirrors pipeline_alert_notifier.RENOTIFY_HOURS so both notifiers throttle the
# same way. Without this, the source-rag health cron posted to Teams on EVERY
# degraded run, flooding operators with dozens of identical messages.
RAG_HEALTH_RENOTIFY_HOURS = int(os.getenv("RAG_HEALTH_RENOTIFY_HOURS", "6"))

GRAPH_SOURCE_LABELS = {
    "outlook_email": "Outlook email",
    "teams_message": "Teams channel messages",
    "teams_chat_export": "Teams direct messages",
    "onedrive_file": "OneDrive documents",
    "sharepoint_file": "SharePoint documents",
}

# Graph sub-sources synced by the main Microsoft Graph sync cycle. Their own
# `source_sync_runs` rows are only written when items actually flow, so on a quiet
# overnight a healthy mailbox/folder looks hours stale. The parent `microsoft_graph`
# run is written every cycle and is the honest "we checked this source" signal, so
# these inherit its freshness. (teams_chat_export/onedrive run on separate crons and
# are intentionally excluded — they keep their own run cadence.)
GRAPH_PARENT_RUN_SOURCE = "microsoft_graph_source_sync"
GRAPH_PARENT_SYNC_SUBSOURCES = {
    "microsoft_graph",
    "outlook_email",
    "sharepoint_file",
    "teams_message",
}

DOCUMENT_SOURCE_LABELS = {
    "fireflies": "Fireflies meetings",
    "microsoft_graph": "Microsoft Graph documents",
    "acumatica_financial_sync": "Acumatica financial sync",
}

GRAPH_DOCUMENT_TYPE_SOURCE_KEYS = {
    "email": "outlook_email",
    "outlook_email": "outlook_email",
    "teams_message": "teams_message",
    "teams_dm": "teams_chat_export",
    "teams_dm_conversation": "teams_chat_export",
    "onedrive_file": "onedrive_file",
    "sharepoint_file": "sharepoint_file",
    "document": "sharepoint_file",
}

GRAPH_PROJECT_DOCUMENT_SOURCES = {"sharepoint"}
RETIRED_GRAPH_STATE_SOURCES = {
    # Replaced by teams_chat_export. Preserve old rows for incident history,
    # but never treat them as current executable source owners.
    "teams_chat",
}

NON_EMBEDDING_DOCUMENT_TYPES = {
    "ai_assistant_task",
    "meeting_agenda_task",
}
NON_RAG_DOCUMENT_SOURCE_SYSTEMS = {
    "ai_assistant",
    "meeting_agenda",
    "synthetic_test",
}
TERMINAL_NON_EMBEDDING_STATUSES = {
    "intentionally_excluded",
    "metadata_only",
    "skipped_low_content",
}
def _configured_graph_subscription_keys() -> set[Tuple[str, str]]:
    try:
        from src.services.integrations.microsoft_graph.subscriptions import configured_subscription_targets
    except Exception:
        return set()
    return {
        (str(target.source), str(target.resource_id).lower())
        for target in configured_subscription_targets()
        if target.source and target.resource_id
    }


def _unconfigured_graph_subscriptions(subscriptions: Sequence[Dict[str, Any]]) -> List[Dict[str, Any]]:
    configured_keys = _configured_graph_subscription_keys()
    if not configured_keys:
        return []
    return [
        row
        for row in subscriptions
        if str(row.get("status") or "") != "removed"
        and (
            str(row.get("source") or ""),
            str(row.get("resource_id") or "").lower(),
        )
        not in configured_keys
    ]


def _active_sharepoint_resource_ids() -> set[str]:
    entries = [
        entry.strip()
        for entry in os.environ.get("SHAREPOINT_SYNC_FOLDERS", "").split(",")
        if entry.strip()
    ]
    resource_ids: set[str] = set()
    for entry in entries:
        try:
            site_part, folder_path = entry.split(":", 1) if ":" in entry else (entry, "/")
            _, site_name = site_part.split("/", 1)
            resource_ids.add(f"sharepoint:{site_name}:{folder_path}")
        except ValueError:
            continue
    return resource_ids


def _sharepoint_discovery_receipt(
    sync_runs: Sequence[Dict[str, Any]],
) -> Dict[str, Any]:
    for row in sync_runs:
        if str(row.get("source") or "") != "microsoft_graph_source_sync":
            continue
        metadata = row.get("metadata")
        if not isinstance(metadata, dict):
            continue
        receipt = metadata.get("sharepoint_discovery")
        if isinstance(receipt, dict):
            return receipt
    return {}


def _is_inactive_graph_resource(state: Dict[str, Any]) -> bool:
    return _is_inactive_graph_resource_with_active_ids(state, _active_sharepoint_resource_ids())


def _is_inactive_graph_resource_with_active_ids(state: Dict[str, Any], active_sharepoint_ids: set[str]) -> bool:
    source = str(state.get("source") or "")
    resource_id = str(state.get("resource_id") or "")

    if source in RETIRED_GRAPH_STATE_SOURCES:
        return True
    if source == "onedrive_file":
        return True
    if source == "sharepoint_file":
        return bool(active_sharepoint_ids) and resource_id not in active_sharepoint_ids
    return False


def _recent_sharepoint_resource_ids(graph_states: Sequence[Dict[str, Any]], now: datetime) -> set[str]:
    resource_ids: set[str] = set()
    for state in graph_states:
        if str(state.get("source") or "") != "sharepoint_file":
            continue
        if str(state.get("sync_status") or "") == "error":
            continue
        last_sync = _parse_datetime(state.get("last_sync_at"))
        stale = _age_minutes(last_sync, now)
        if stale is not None and stale <= STALE_SYNC_MINUTES * 2:
            resource_id = str(state.get("resource_id") or "")
            if resource_id:
                resource_ids.add(resource_id)
    return resource_ids


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def _iso(value: Optional[datetime]) -> Optional[str]:
    return value.isoformat() if value else None


def _single_row(response: Any) -> Optional[Dict[str, Any]]:
    data = getattr(response, "data", None) or []
    return data[0] if data else None


def _limit_text(value: Any, limit: int = ALERT_TEXT_LIMIT) -> str:
    text = str(value or "")
    if len(text) <= limit:
        return text
    if limit <= 3:
        return text[:limit]
    return f"{text[:limit - 3]}..."


def _metadata_dict(value: Any) -> Dict[str, Any]:
    return value if isinstance(value, dict) else {}


def _alert_metadata(alert: Dict[str, Any]) -> Dict[str, Any]:
    return {
        "detected_at": alert.get("detectedAt"),
        "code": _limit_text(alert.get("code"), 120),
        "source": _limit_text(alert.get("source"), 120),
        "resourceId": _limit_text(alert.get("resourceId"), ALERT_RESOURCE_ID_LIMIT),
        "severity": _alert_severity(alert),
    }


def _parse_datetime(value: Any) -> Optional[datetime]:
    if not value:
        return None
    if isinstance(value, datetime):
        return value if value.tzinfo else value.replace(tzinfo=timezone.utc)
    if not isinstance(value, str):
        return None
    normalized = value.replace("Z", "+00:00")
    try:
        parsed = datetime.fromisoformat(normalized)
    except ValueError:
        return None
    return parsed if parsed.tzinfo else parsed.replace(tzinfo=timezone.utc)


def _age_minutes(value: Optional[datetime], now: datetime) -> Optional[int]:
    if not value:
        return None
    return max(0, int((now - value).total_seconds() // 60))


def _table_rows(
    supabase: Any,
    table: str,
    columns: str = "*",
    *,
    limit: int = 10000,
    order_by: Optional[str] = None,
    desc: bool = False,
) -> List[Dict[str, Any]]:
    rows: List[Dict[str, Any]] = []
    page_size = min(limit or 1000, 1000)
    offset = 0

    while True:
        query = supabase.table(table).select(columns)
        if order_by:
            query = query.order(order_by, desc=desc)
        if hasattr(query, "range"):
            query = query.range(offset, offset + page_size - 1)
        elif limit:
            query = query.limit(limit)
        response = query.execute()
        data = response.data or []
        rows.extend(dict(row) for row in data)
        if not hasattr(query, "range") or len(data) < page_size or (limit and len(rows) >= limit):
            break
        offset += page_size

    return rows[:limit] if limit else rows


def _chunk_rows_for_documents(supabase: Any, document_ids: Sequence[str]) -> List[Dict[str, Any]]:
    """Fetch chunk rows for the sampled documents so backlog counts are not sample-skewed."""
    ids = [str(document_id) for document_id in document_ids if document_id]
    if not ids:
        return []

    rows: List[Dict[str, Any]] = []
    chunk_client = get_rag_read_client()
    # Document ids can be long Graph/Teams opaque ids. Smaller batches avoid
    # PostgREST URL/query limits that silently undercount chunk coverage.
    batch_size = CHUNK_DOCUMENT_ID_BATCH_SIZE
    for start in range(0, len(ids), batch_size):
        batch = ids[start:start + batch_size]
        response = (
            chunk_client.table("document_chunks")
            .select("document_id,chunk_id")
            .in_("document_id", batch)
            .execute()
        )
        rows.extend(dict(row) for row in response.data or [])
    return rows


def _sorted_sources(sources: Sequence[Dict[str, Any]]) -> List[Dict[str, Any]]:
    status_rank = {"critical": 0, "warning": 1, "unknown": 2, "healthy": 3}
    return sorted(
        sources,
        key=lambda source: (
            status_rank.get(str(source.get("status")), 4),
            source.get("source") or "",
            source.get("resourceName") or "",
        ),
    )


def _limited_rows(rows: Sequence[Dict[str, Any]], limit: int) -> List[Dict[str, Any]]:
    return list(rows[:limit])


def _counter(rows: Iterable[Dict[str, Any]], key: str, fallback: str = "unknown") -> Dict[str, int]:
    counts: Counter[str] = Counter()
    for row in rows:
        value = row.get(key) or fallback
        counts[str(value)] += 1
    return dict(counts)


def _graph_document_source_key(document: Dict[str, Any]) -> Optional[str]:
    source = str(document.get("source") or document.get("source_system") or "")
    if source not in {"microsoft_graph", "graph"}:
        return None

    doc_type = str(document.get("type") or "")
    category = str(document.get("category") or "")
    for candidate in (doc_type, category):
        mapped = GRAPH_DOCUMENT_TYPE_SOURCE_KEYS.get(candidate)
        if mapped:
            return mapped
    return "microsoft_graph"


def _graph_project_document_source(document: Dict[str, Any]) -> Optional[str]:
    source_system = str(document.get("source_system") or "").lower()
    if source_system in GRAPH_PROJECT_DOCUMENT_SOURCES:
        return source_system

    document_id = str(document.get("id") or "")
    if document_id.startswith("onedrive_"):
        return "onedrive"
    if document_id.startswith("sharepoint_"):
        return "sharepoint"

    tags = str(document.get("tags") or "").lower()
    if "onedrive" in tags:
        return "onedrive"
    if "sharepoint" in tags:
        return "sharepoint"
    return None


def _graph_project_document_item_id(document: Dict[str, Any], source: str) -> Optional[str]:
    item_id = document.get("source_item_id")
    if item_id:
        return str(item_id)

    document_id = str(document.get("id") or "")
    prefix = f"{source}_"
    if document_id.startswith(prefix) and len(document_id) > len(prefix):
        return document_id[len(prefix):]
    return None


def _graph_project_document_promotion_counts(
    documents: Sequence[Dict[str, Any]],
    project_documents: Sequence[Dict[str, Any]],
) -> Dict[str, int]:
    existing = {
        (
            int(row["project_id"]),
            str(row["source_system"]),
            str(row["source_item_id"]),
        )
        for row in project_documents
        if row.get("project_id")
        and row.get("source_system") in GRAPH_PROJECT_DOCUMENT_SOURCES
        and row.get("source_item_id")
        and row.get("deleted_at") is None
    }
    counts: Counter[str] = Counter()
    for document in documents:
        project_id = document.get("project_id")
        if not project_id:
            continue
        source = _graph_project_document_source(document)
        if not source:
            continue
        item_id = _graph_project_document_item_id(document, source)
        if not item_id:
            continue
        key = (int(project_id), source, item_id)
        if key in existing:
            counts["promoted"] += 1
        else:
            counts["missing"] += 1
            counts[f"missing_{source}"] += 1
    return dict(counts)


def _source_key(document: Dict[str, Any]) -> str:
    category = document.get("category") or document.get("type")
    source_system = document.get("source_system") or document.get("source")
    graph_source = _graph_document_source_key(document)
    if graph_source:
        return graph_source
    if category in GRAPH_SOURCE_LABELS:
        return str(category)
    if source_system == "fireflies" or document.get("fireflies_id"):
        return "fireflies"
    if source_system in {"microsoft_graph", "graph"}:
        return "microsoft_graph"
    return str(source_system or category or "unknown")


def _source_name(source: str, resource_name: Optional[str] = None) -> str:
    if resource_name:
        return resource_name
    return GRAPH_SOURCE_LABELS.get(source) or DOCUMENT_SOURCE_LABELS.get(source) or source.replace("_", " ").title()


def _document_last_seen_at(document: Dict[str, Any], source: str) -> Optional[datetime]:
    """Return the timestamp health should use for source freshness.

    Teams DM conversation documents are daily buckets. Their ``date`` column is
    intentionally the source day, not the ingestion timestamp, so using it for a
    two-hour freshness threshold makes healthy same-day docs look stale in U.S.
    timezones. Graph sync state still tracks true source-sync recency.
    """
    if source == "teams_chat_export" and document.get("type") == "teams_dm_conversation":
        return (
            _parse_datetime(document.get("source_last_modified_at"))
            or _parse_datetime(document.get("created_at"))
            or _parse_datetime(document.get("date"))
        )

    return (
        _parse_datetime(document.get("captured_at"))
        or _parse_datetime(document.get("date"))
        or _parse_datetime(document.get("source_last_modified_at"))
        or _parse_datetime(document.get("created_at"))
    )


def _requires_embedding_for_health(document: Dict[str, Any]) -> bool:
    """Return whether a document should count toward embedding backlog health.

    `document_metadata` also stores app-side task stubs, agenda markers, synthetic
    tests, and terminal low-content rows. Counting those as vector backlog makes
    RAG look broken even when every embeddable source document has chunks.
    """
    status = str(document.get("status") or "").lower()
    if status in TERMINAL_NON_EMBEDDING_STATUSES:
        return False
    if str(document.get("type") or "").lower() in NON_EMBEDDING_DOCUMENT_TYPES:
        return False
    if str(document.get("source_system") or "").lower() in NON_RAG_DOCUMENT_SOURCE_SYSTEMS:
        return False
    return True


def _health_status(
    *,
    stale_minutes: Optional[int],
    stale_threshold: int,
    last_error: Optional[str],
    unprocessed: int = 0,
    unembedded: int = 0,
) -> str:
    if last_error:
        return "critical"
    if stale_minutes is None:
        return "unknown"
    if stale_minutes > stale_threshold * 2:
        return "critical"
    if (
        stale_minutes > stale_threshold
        or unembedded >= EMBEDDING_BACKLOG_WARNING
        or unprocessed > 0
    ):
        return "warning"
    return "healthy"


def _source_row(
    *,
    source: str,
    resource_id: str,
    resource_name: Optional[str],
    status: str,
    last_sync_at: Optional[datetime],
    last_success_at: Optional[datetime],
    last_error_at: Optional[datetime],
    last_error_message: Optional[str],
    items_synced: int,
    stale_minutes: Optional[int],
    unprocessed_count: int,
    unembedded_count: int,
    uncompiled_count: int,
    metadata: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    return {
        "source": source,
        "resourceId": resource_id,
        "resourceName": _source_name(source, resource_name),
        "status": status,
        "lastSyncAt": _iso(last_sync_at),
        "lastSuccessAt": _iso(last_success_at),
        "lastErrorAt": _iso(last_error_at),
        "lastErrorMessage": last_error_message,
        "itemsSynced": items_synced,
        "staleMinutes": stale_minutes,
        "unprocessedCount": unprocessed_count,
        "unembeddedCount": unembedded_count,
        "uncompiledCount": uncompiled_count,
        "metadata": metadata or {},
    }


def _acumatica_sync_source(sync_states: Sequence[Dict[str, Any]], now: datetime) -> Optional[Dict[str, Any]]:
    if not sync_states:
        return None

    parsed_states: List[Dict[str, Any]] = []
    for state in sync_states:
        last_success = _parse_datetime(state.get("last_success_at"))
        updated_at = _parse_datetime(state.get("updated_at"))
        last_started = _parse_datetime(state.get("last_started_at"))
        parsed_states.append(
            {
                **state,
                "_last_success": last_success,
                "_updated_at": updated_at,
                "_last_started": last_started,
            }
        )

    failed_states = [
        state
        for state in parsed_states
        if state.get("status") == "failed"
    ]
    warning_states = [
        state
        for state in parsed_states
        if state.get("status") == "warning" or (state.get("last_error") and state not in failed_states)
    ]
    latest_success = max(
        (state["_last_success"] for state in parsed_states if state.get("_last_success")),
        default=None,
    )
    latest_seen = max(
        (
            value
            for state in parsed_states
            for value in (state.get("_updated_at"), state.get("_last_started"), state.get("_last_success"))
            if value
        ),
        default=None,
    )
    stale = _age_minutes(latest_success or latest_seen, now)
    last_error = None
    last_error_at = None
    latest_warning = None
    latest_warning_at = None
    if failed_states:
        latest_failed = max(
            failed_states,
            key=lambda state: state.get("_updated_at") or state.get("_last_started") or datetime.min.replace(tzinfo=timezone.utc),
        )
        last_error = latest_failed.get("last_error") or f"{latest_failed.get('entity_name')} failed"
        last_error_at = latest_failed.get("_updated_at") or latest_failed.get("_last_started")
    elif warning_states:
        latest_warning_state = max(
            warning_states,
            key=lambda state: state.get("_updated_at") or state.get("_last_started") or datetime.min.replace(tzinfo=timezone.utc),
        )
        latest_warning = latest_warning_state.get("last_error") or f"{latest_warning_state.get('entity_name')} warning"
        latest_warning_at = latest_warning_state.get("_updated_at") or latest_warning_state.get("_last_started")

    items_synced = 0
    entity_statuses: Dict[str, str] = {}
    failed_entities: List[str] = []
    warning_entities: List[str] = []
    for state in parsed_states:
        entity = str(state.get("entity_name") or "unknown")
        entity_statuses[entity] = str(state.get("status") or "unknown")
        if state in failed_states:
            failed_entities.append(entity)
        elif state in warning_states:
            warning_entities.append(entity)
        stats = _metadata_dict(state.get("last_stats"))
        items_synced += int(stats.get("upserted") or 0) + int(stats.get("projected") or 0)
    status = _health_status(
        stale_minutes=stale,
        stale_threshold=STALE_ACUMATICA_SYNC_MINUTES,
        last_error=last_error,
    )
    if status == "healthy" and warning_states:
        status = "warning"

    return _source_row(
        source="acumatica_financial_sync",
        resource_id="acumatica_sync_state",
        resource_name="Acumatica financial sync",
        status=status,
        last_sync_at=latest_seen,
        last_success_at=latest_success,
        last_error_at=last_error_at or latest_warning_at,
        last_error_message=last_error or latest_warning,
        items_synced=items_synced,
        stale_minutes=stale,
        unprocessed_count=0,
        unembedded_count=0,
        uncompiled_count=0,
        metadata={
            "source": "acumatica_sync_state",
            "failedEntities": failed_entities,
            "warningEntities": warning_entities,
            "entityStatuses": entity_statuses,
        },
    )


def record_sync_run(
    supabase: Any,
    *,
    source: str,
    stage: str,
    status: str,
    resource_id: str = "default",
    resource_name: Optional[str] = None,
    started_at: Optional[datetime] = None,
    finished_at: Optional[datetime] = None,
    items_seen: int = 0,
    items_synced: int = 0,
    items_created: int = 0,
    items_updated: int = 0,
    items_skipped: int = 0,
    items_failed: int = 0,
    error_code: Optional[str] = None,
    error_message: Optional[str] = None,
    metadata: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    payload = {
        "source": source,
        "resource_id": resource_id,
        "resource_name": resource_name,
        "stage": stage,
        "status": status,
        "started_at": _iso(started_at or _utcnow()),
        "finished_at": _iso(finished_at),
        "items_seen": items_seen,
        "items_synced": items_synced,
        "items_created": items_created,
        "items_updated": items_updated,
        "items_skipped": items_skipped,
        "items_failed": items_failed,
        "error_code": error_code,
        "error_message": error_message,
        "metadata": metadata or {},
    }
    response = get_rag_write_client().table("source_sync_runs").insert(payload).execute()
    rows = response.data or []
    return dict(rows[0]) if rows else payload


def update_sync_run(
    supabase: Any,
    run_id: str,
    *,
    status: str,
    finished_at: Optional[datetime] = None,
    items_seen: Optional[int] = None,
    items_synced: Optional[int] = None,
    items_created: Optional[int] = None,
    items_updated: Optional[int] = None,
    items_skipped: Optional[int] = None,
    items_failed: Optional[int] = None,
    error_code: Optional[str] = None,
    error_message: Optional[str] = None,
    metadata: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    payload: Dict[str, Any] = {
        "status": status,
        "finished_at": _iso(finished_at or _utcnow()),
    }
    for key, value in {
        "items_seen": items_seen,
        "items_synced": items_synced,
        "items_created": items_created,
        "items_updated": items_updated,
        "items_skipped": items_skipped,
        "items_failed": items_failed,
    }.items():
        if value is not None:
            payload[key] = value
    if error_code is not None:
        payload["error_code"] = error_code
    if error_message is not None:
        payload["error_message"] = error_message
    if metadata is not None:
        payload["metadata"] = metadata

    response = get_rag_write_client().table("source_sync_runs").update(payload).eq("id", run_id).execute()
    rows = response.data or []
    return dict(rows[0]) if rows else payload


def update_source_health_snapshot(
    supabase: Any,
    source_health: Dict[str, Any],
) -> Dict[str, Any]:
    payload = {
        "source": source_health["source"],
        "resource_id": source_health["resourceId"],
        "resource_name": source_health["resourceName"],
        "status": source_health["status"],
        "last_sync_at": source_health.get("lastSyncAt"),
        "last_success_at": source_health.get("lastSuccessAt"),
        "last_error_at": source_health.get("lastErrorAt"),
        "last_error_message": source_health.get("lastErrorMessage"),
        "items_synced": source_health.get("itemsSynced", 0),
        "unprocessed_count": source_health.get("unprocessedCount", 0),
        "unembedded_count": source_health.get("unembeddedCount", 0),
        "uncompiled_count": source_health.get("uncompiledCount", 0),
        "stale_minutes": source_health.get("staleMinutes"),
        "metadata": source_health.get("metadata") or {},
        "generated_at": _iso(_utcnow()),
    }
    response = (
        get_rag_write_client().table("source_sync_health_snapshots")
        .upsert(payload, on_conflict="source,resource_id")
        .execute()
    )
    rows = response.data or []
    return dict(rows[0]) if rows else payload


def _source_stale_threshold(source_key: str) -> int:
    if source_key == "fireflies":
        return STALE_FIREFLIES_MINUTES
    if source_key == "task_extraction":
        return STALE_EXTRACTION_MINUTES
    if source_key == "acumatica_financial_sync":
        return STALE_ACUMATICA_SYNC_MINUTES
    return STALE_SYNC_MINUTES


def detect_source_sync_alerts(
    sources: Sequence[Dict[str, Any]],
    pipeline: Dict[str, Dict[str, int]],
    now: datetime,
) -> List[Dict[str, Any]]:
    alerts: List[Dict[str, Any]] = []
    for source in sources:
        if source["status"] in {"critical", "warning", "unknown"}:
            severity = "critical" if source["status"] == "critical" else "warning"
            stale_minutes = source.get("staleMinutes")
            threshold = _source_stale_threshold(str(source["source"]))
            is_genuinely_stale = stale_minutes is not None and stale_minutes > threshold
            if source.get("lastErrorMessage"):
                code = "source_sync_error"
                reason = source["lastErrorMessage"]
            elif is_genuinely_stale:
                code = (
                    "task_extraction_stale"
                    if source["source"] == "task_extraction"
                    else "source_sync_stale"
                )
                reason = f"Last sync is {stale_minutes} minutes old."
            elif stale_minutes is None:
                code = f"source_sync_{source['status']}"
                reason = "No successful sync timestamp is available."
            else:
                # Warning/critical driven by an embedding backlog, NOT by
                # staleness or an error. A fresh source (e.g. synced 4 min ago)
                # must never emit a "Last sync is N minutes old" alert. The aggregate
                # embedding_backlog alerts below already cover this.
                continue
            alerts.append(
                {
                    "severity": severity,
                    "code": code,
                    "source": source["source"],
                    "resourceId": source["resourceId"],
                    "message": f"{source['resourceName']}: {reason}",
                    "detectedAt": _iso(now),
                }
            )

    unembedded_total = sum(pipeline.get("unembeddedBySource", {}).values())
    if unembedded_total >= EMBEDDING_BACKLOG_WARNING:
        alerts.append(
            {
                "severity": "warning",
                "code": "embedding_backlog",
                "source": "vectorization",
                "resourceId": "document_chunks",
                "message": f"{unembedded_total} ingested documents do not have chunks yet.",
                "detectedAt": _iso(now),
            }
        )

    graph_subscription_statuses = pipeline.get("graphSubscriptionsByStatus", {})
    unconfigured_subscriptions = pipeline.get("unconfiguredGraphSubscriptions", 0)
    if unconfigured_subscriptions:
        alerts.append(
            {
                "severity": "critical",
                "code": "unconfigured_graph_subscription",
                "source": "microsoft_graph",
                "resourceId": "graph_subscriptions",
                "message": f"{unconfigured_subscriptions} Graph subscription row(s) are not in the configured sync target set.",
                "detectedAt": _iso(now),
            }
        )
    removed_subscriptions = graph_subscription_statuses.get("removed", 0) + graph_subscription_statuses.get("missed", 0)
    if removed_subscriptions:
        alerts.append(
            {
                "severity": "critical",
                "code": "graph_subscription_removed",
                "source": "microsoft_graph",
                "resourceId": "graph_subscriptions",
                "message": f"{removed_subscriptions} Graph subscription(s) were removed or missed notifications.",
                "detectedAt": _iso(now),
            }
        )
    expiring_subscriptions = graph_subscription_statuses.get("renewal_due", 0)
    if expiring_subscriptions:
        alerts.append(
            {
                "severity": "warning",
                "code": "graph_subscription_expiring",
                "source": "microsoft_graph",
                "resourceId": "graph_subscriptions",
                "message": f"{expiring_subscriptions} Graph subscription(s) require renewal or reauthorization.",
                "detectedAt": _iso(now),
            }
        )

    missing_project_documents = pipeline.get("graphProjectDocumentPromotion", {}).get("missing", 0)
    if missing_project_documents:
        alerts.append(
            {
                "severity": "warning",
                "code": "graph_project_document_promotion_gap",
                "source": "microsoft_graph",
                "resourceId": "project_documents",
                "message": (
                    f"{missing_project_documents} assigned SharePoint document(s) "
                    "are searchable in AI but missing from project Documents."
                ),
                "detectedAt": _iso(now),
            }
        )

    return alerts


def _alert_key(alert: Dict[str, Any]) -> str:
    return "source_sync:{code}:{source}:{resource}".format(
        code=str(alert.get("code") or "unknown"),
        source=str(alert.get("source") or "unknown"),
        resource=str(alert.get("resourceId") or ""),
    )


def _alert_severity(alert: Dict[str, Any]) -> str:
    severity = str(alert.get("severity") or "warning").lower()
    return severity if severity in {"info", "warning", "critical"} else "warning"


def _as_actionable_alert_write_error(exc: Exception) -> Exception:
    """Turn an opaque RLS failure into a self-diagnosing env-drift error.

    A non-service_role RAG key makes every ``system_alerts`` write fail with
    PostgREST 42501 ("new row violates row-level security policy"). That crashed
    the source-rag-health resolver cron on every run — silently leaving stale
    alerts active because nothing resolved them. Surface the real cause loudly so
    the next operator fixes the env instead of re-deriving it from a traceback.
    """
    text = str(exc)
    if "row-level security" in text or "42501" in text:
        return RuntimeError(
            "Writing system_alerts hit row-level security (42501). The RAG write "
            "client is not authenticated as service_role — RAG_SUPABASE_SERVICE_ROLE_KEY "
            "on this service has drifted to a non-service_role (anon) value. Set the "
            "RAG project's service_role key and redeploy. Original error: " + text
        )
    return exc


def persist_source_sync_alerts(
    supabase: Any,
    alerts: Sequence[Dict[str, Any]],
    *,
    resolve_missing: bool = True,
    reserve_notifications: bool = False,
) -> Dict[str, Any]:
    """Upsert active source-sync alerts and resolve alerts that disappeared.

    When ``reserve_notifications`` is True, each alert whose ``notified_at`` is
    unset or older than ``RAG_HEALTH_RENOTIFY_HOURS`` is stamped as notified
    (a durable reservation) and its key is returned in ``notified``. Callers use
    that set to throttle external delivery — send once per new/re-armed alert
    instead of on every degraded run. The default (False) leaves ``notified_at``
    untouched so non-notifying callers (recompute, admin routes) never consume a
    reservation.
    """
    now_dt = _utcnow()
    now = now_dt.isoformat()
    renotify_after = timedelta(hours=RAG_HEALTH_RENOTIFY_HOURS)
    active_keys = {_alert_key(alert) for alert in alerts}
    upserted = 0
    resolved = 0
    notified: List[str] = []
    rag_client = get_rag_write_client()

    for alert in alerts:
        alert_key = _alert_key(alert)
        payload = {
            "alert_key": alert_key,
            "category": "source_sync",
            "code": _limit_text(alert.get("code") or "source_sync_alert", 120),
            "severity": _alert_severity(alert),
            "source": _limit_text(alert.get("source") or "unknown", 120),
            "resource_id": _limit_text(alert.get("resourceId") or "", ALERT_RESOURCE_ID_LIMIT),
            "title": _limit_text(str(alert.get("code") or "Source sync alert").replace("_", " ").title(), 180),
            "message": _limit_text(alert.get("message") or "Source sync alert detected."),
            "status": "active",
            "last_seen_at": now,
            "resolved_at": None,
            "metadata": _alert_metadata(alert),
        }
        existing = _single_row(
            rag_client.table("system_alerts")
            .select("id,first_seen_at,notified_at,status")
            .eq("alert_key", alert_key)
            .limit(1)
            .execute()
        )
        if existing and existing.get("first_seen_at"):
            payload["first_seen_at"] = existing["first_seen_at"]
        else:
            payload["first_seen_at"] = now
        if reserve_notifications:
            last_notified = _parse_datetime(existing.get("notified_at")) if existing else None
            previously_resolved = bool(existing and existing.get("status") == "resolved")
            should_notify = (
                last_notified is None
                or previously_resolved
                or (now_dt - last_notified) >= renotify_after
            )
            if should_notify:
                payload["notified_at"] = now
        try:
            rag_client.table("system_alerts").upsert(payload, on_conflict="alert_key").execute()
        except Exception as exc:  # noqa: BLE001 - re-raised with actionable context below
            raise _as_actionable_alert_write_error(exc) from exc
        if reserve_notifications and payload.get("notified_at"):
            # Only a successful upsert of the reservation is eligible for delivery.
            notified.append(alert_key)
        upserted += 1

    if resolve_missing:
        existing_active = (
            rag_client.table("system_alerts")
            .select("id,alert_key")
            .eq("category", "source_sync")
            .eq("status", "active")
            .limit(1000)
            .execute()
        )
        for row in existing_active.data or []:
            if row.get("alert_key") in active_keys:
                continue
            rag_client.table("system_alerts").update(
                {"status": "resolved", "resolved_at": now, "last_seen_at": now}
            ).eq("id", row["id"]).execute()
            resolved += 1

    return {"upserted": upserted, "resolved": resolved, "notified": notified}


RAG_HEALTH_DIGEST_ALERT_KEY = "rag_health:degraded_digest"


def reserve_health_digest_notification(supabase: Any, *, mark_notified: bool = False) -> bool:
    """Throttled report-level notification reservation for a degraded health run.

    Covers the case a per-alert reservation cannot: a report that is degraded
    (unhealthy watched sources) but produced NO discrete alert rows, so there is
    nothing to reserve against and the first Teams DM would otherwise never fire.
    It also acts as a re-nag heartbeat so a persistently degraded pipeline is
    re-flagged at most once per RAG_HEALTH_RENOTIFY_HOURS. Kept in its own
    ``rag_health_digest`` category so the source_sync resolve sweep never churns
    it (which would otherwise reset the throttle every run and re-flood).

    Returns whether the digest itself is due to notify (never notified / window
    elapsed / previously resolved). ``mark_notified=True`` — passed when a
    delivery is already happening for a new alert — stamps the reservation
    regardless so the heartbeat clock resets and the next run does not double-post.
    """
    now_dt = _utcnow()
    now = now_dt.isoformat()
    rag_client = get_rag_write_client()
    existing = _single_row(
        rag_client.table("system_alerts")
        .select("id,first_seen_at,notified_at,status")
        .eq("alert_key", RAG_HEALTH_DIGEST_ALERT_KEY)
        .limit(1)
        .execute()
    )
    last_notified = _parse_datetime(existing.get("notified_at")) if existing else None
    previously_resolved = bool(existing and existing.get("status") == "resolved")
    digest_due = (
        last_notified is None
        or previously_resolved
        or (now_dt - last_notified) >= timedelta(hours=RAG_HEALTH_RENOTIFY_HOURS)
    )
    payload = {
        "alert_key": RAG_HEALTH_DIGEST_ALERT_KEY,
        "category": "rag_health_digest",
        "code": "rag_health_degraded_digest",
        "severity": "warning",
        "source": "rag_health",
        "resource_id": "report",
        "title": "RAG Pipeline Health Degraded",
        "message": "RAG pipeline health is degraded.",
        "status": "active",
        "last_seen_at": now,
        "resolved_at": None,
        "first_seen_at": (
            existing.get("first_seen_at") if existing and existing.get("first_seen_at") else now
        ),
    }
    if digest_due or mark_notified:
        payload["notified_at"] = now
    try:
        rag_client.table("system_alerts").upsert(payload, on_conflict="alert_key").execute()
    except Exception as exc:  # noqa: BLE001 - re-raised with actionable context below
        raise _as_actionable_alert_write_error(exc) from exc
    return digest_due


def resolve_health_digest_notification(supabase: Any) -> bool:
    """Resolve the degraded-health digest when the pipeline recovers.

    Recovery must clear the digest so a fresh degradation episode notifies
    immediately (via ``previously_resolved``) instead of waiting out the
    heartbeat window. Mirrors how per-alert reservations resolve on recovery.
    """
    now = _utcnow().isoformat()
    rag_client = get_rag_write_client()
    existing = _single_row(
        rag_client.table("system_alerts")
        .select("id,status")
        .eq("alert_key", RAG_HEALTH_DIGEST_ALERT_KEY)
        .eq("status", "active")
        .limit(1)
        .execute()
    )
    if not existing:
        return False
    rag_client.table("system_alerts").update(
        {"status": "resolved", "resolved_at": now, "last_seen_at": now}
    ).eq("id", existing["id"]).execute()
    return True


def _document_health(
    documents: Sequence[Dict[str, Any]],
    chunk_document_ids: set[str],
    now: datetime,
) -> Tuple[Dict[str, Dict[str, int]], List[Dict[str, Any]]]:
    source_counts: Dict[str, Dict[str, int]] = defaultdict(lambda: defaultdict(int))
    latest_by_source: Dict[str, datetime] = {}

    for document in documents:
        source = _source_key(document)
        source_counts[source]["total"] += 1
        status = str(document.get("status") or "unknown")
        source_counts[source][f"status:{status}"] += 1
        document_id = str(document.get("id"))
        if _requires_embedding_for_health(document) and document_id not in chunk_document_ids:
            source_counts[source]["unembedded"] += 1
        captured = _document_last_seen_at(document, source)
        if captured and (source not in latest_by_source or captured > latest_by_source[source]):
            latest_by_source[source] = captured

    rows: List[Dict[str, Any]] = []
    for source, counts in source_counts.items():
        if source in GRAPH_SOURCE_LABELS or source in DOCUMENT_SOURCE_LABELS:
            last_seen = latest_by_source.get(source)
            stale_threshold = STALE_FIREFLIES_MINUTES if source == "fireflies" else STALE_SYNC_MINUTES
            stale = _age_minutes(last_seen, now)
            rows.append(
                _source_row(
                    source=source,
                    resource_id="document_metadata",
                    resource_name=_source_name(source),
                    status=_health_status(
                        stale_minutes=stale,
                        stale_threshold=stale_threshold,
                        last_error=None,
                        unembedded=counts.get("unembedded", 0),
                    ),
                    last_sync_at=last_seen,
                    last_success_at=last_seen,
                    last_error_at=None,
                    last_error_message=None,
                    items_synced=counts.get("total", 0),
                    stale_minutes=stale,
                    unprocessed_count=counts.get("status:uploaded", 0),
                    unembedded_count=counts.get("unembedded", 0),
                    uncompiled_count=counts.get("uncompiled", 0),
                    metadata={"source": "document_metadata"},
                )
            )
    return {key: dict(value) for key, value in source_counts.items()}, rows


def _recent_run_rows(sync_runs: Sequence[Dict[str, Any]]) -> List[Dict[str, Any]]:
    rows: List[Dict[str, Any]] = []
    for run in sync_runs[:20]:
        rows.append(
            {
                "id": str(run.get("id") or ""),
                "source": str(run.get("source") or "unknown"),
                "stage": str(run.get("stage") or "unknown"),
                "status": str(run.get("status") or "unknown"),
                "resourceId": str(run.get("resource_id") or "default"),
                "resourceName": run.get("resource_name"),
                "startedAt": run.get("started_at"),
                "finishedAt": run.get("finished_at"),
                "itemsSeen": int(run.get("items_seen") or 0),
                "itemsSynced": int(run.get("items_synced") or 0),
                "itemsFailed": int(run.get("items_failed") or 0),
                "errorCode": run.get("error_code"),
                "errorMessage": run.get("error_message"),
                "metadata": run.get("metadata") or {},
            }
        )
    return rows


def _stuck_item_rows(
    fireflies_jobs: Sequence[Dict[str, Any]],
    documents: Sequence[Dict[str, Any]],
    now: datetime,
) -> List[Dict[str, Any]]:
    document_by_id = {str(row.get("id")): row for row in documents if row.get("id")}
    stuck: List[Dict[str, Any]] = []
    stuck_stages = {"pending", "raw_ingested", "segmented", "chunked", "embedded", "structured_extracted", "error"}

    for job in fireflies_jobs:
        stage = str(job.get("stage") or "unknown")
        if stage not in stuck_stages:
            continue
        updated_at = _parse_datetime(job.get("updated_at")) or _parse_datetime(job.get("last_attempt_at"))
        age = _age_minutes(updated_at, now)
        if stage != "error" and (age is None or age < STALE_FIREFLIES_MINUTES):
            continue

        metadata_id = str(job.get("metadata_id") or "")
        document = document_by_id.get(metadata_id, {})
        source = _source_key(document) if document else "fireflies"
        error_message = job.get("error_message")
        is_non_vectorizable = isinstance(error_message, str) and error_message.startswith("NON_VECTORIZABLE")
        is_intentionally_excluded = (
            isinstance(error_message, str)
            and error_message.startswith("INTENTIONALLY_EXCLUDED")
        ) or str(document.get("status") or "") == "intentionally_excluded"
        stuck.append(
            {
                "source": source,
                "resourceId": metadata_id or str(job.get("fireflies_id") or ""),
                "resourceName": document.get("title") or job.get("fireflies_id") or metadata_id or "Fireflies item",
                "stage": stage,
                "status": (
                    "intentionally_excluded"
                    if is_intentionally_excluded
                    else "not_vectorizable"
                    if is_non_vectorizable
                    else "failed"
                    if stage == "error"
                    else "stale"
                ),
                "ageMinutes": age,
                "lastAttemptAt": job.get("last_attempt_at") or job.get("updated_at"),
                "errorMessage": error_message,
                "metadata": {
                    "firefliesId": job.get("fireflies_id"),
                    "metadataId": metadata_id or None,
                    "documentStatus": document.get("status"),
                    "documentType": document.get("type"),
                    "documentCategory": document.get("category"),
                    "projectId": document.get("project_id"),
                    "documentUrl": document.get("url"),
                },
            }
        )

    stuck.sort(
        key=lambda row: (
            row["status"] != "failed",
            -(row.get("ageMinutes") or 0),
            str(row.get("resourceName") or ""),
        )
    )
    return stuck[:25]


def _build_run_freshness_by_source(
    sync_runs: Sequence[Dict[str, Any]],
) -> Dict[str, datetime]:
    """Return the most-recent non-error run start time per source from the run ledger.

    The run ledger (source_sync_runs) is written on every sync cycle, so it
    reflects true recency even when graph_sync_state.last_sync_at or
    document_metadata timestamps are stale. We ignore error/failed runs so a
    broken source doesn't appear fresh.
    """
    freshness: Dict[str, datetime] = {}
    for run in sync_runs:
        if str(run.get("status") or "") in {"error", "failed"}:
            continue
        source = str(run.get("source") or "")
        if not source:
            continue
        ts = _parse_datetime(run.get("started_at"))
        if ts and (source not in freshness or ts > freshness[source]):
            freshness[source] = ts
    return freshness


def _apply_run_ledger_freshness(
    sources: List[Dict[str, Any]],
    run_freshness_by_source: Dict[str, datetime],
    now: datetime,
) -> None:
    """Override staleness for any source where the run ledger is more recent.

    Mutates each source dict in-place. This is the canonical fix for false
    'source stale' alerts caused by snapshot fields (graph_sync_state.last_sync_at,
    document_metadata timestamps) that lag behind the actual sync cadence.
    """
    for source in sources:
        source_key = str(source.get("source") or "")
        run_fresh = run_freshness_by_source.get(source_key)
        if source_key in GRAPH_PARENT_SYNC_SUBSOURCES:
            parent_fresh = run_freshness_by_source.get(GRAPH_PARENT_RUN_SOURCE)
            if parent_fresh and (run_fresh is None or parent_fresh > run_fresh):
                run_fresh = parent_fresh
        if not run_fresh:
            continue
        current_sync = _parse_datetime(source.get("lastSyncAt"))
        if current_sync and run_fresh <= current_sync:
            continue
        # Run ledger is more recent — override the staleness fields
        stale_threshold = STALE_FIREFLIES_MINUTES if source_key == "fireflies" else STALE_SYNC_MINUTES
        stale = _age_minutes(run_fresh, now)
        source["lastSyncAt"] = _iso(run_fresh)
        if not source.get("lastErrorMessage"):
            source["lastSuccessAt"] = _iso(run_fresh)
        source["staleMinutes"] = stale
        source["status"] = _health_status(
            stale_minutes=stale,
            stale_threshold=stale_threshold,
                    last_error=source.get("lastErrorMessage"),
                    unembedded=source.get("unembeddedCount", 0),
                )


def get_source_sync_health(supabase: Any) -> Dict[str, Any]:
    now = _utcnow()

    graph_states = _table_rows(
        get_rag_read_client(),
        "graph_sync_state",
        "source,resource_id,resource_name,last_sync_at,sync_status,error_message,items_synced,updated_at",
        order_by="last_sync_at",
        desc=True,
    )
    documents = _table_rows(
        supabase,
        "document_metadata",
        "id,title,url,source,source_system,source_item_id,category,type,status,captured_at,date,created_at,source_last_modified_at,fireflies_id,project_id,source_metadata,tags",
        limit=DOCUMENT_HEALTH_SAMPLE_LIMIT,
        # MUST order by ingestion recency. Without this the sample is the OLDEST
        # ~2.5k rows of a 40k+ table, so per-source freshness AND unembedded/
        # uncompiled backlog counts reflect months-old documents — which made
        # healthy sources report 40+ days stale and emit phantom backlog warnings.
        order_by="created_at",
        desc=True,
    )
    project_documents = _table_rows(
        supabase,
        "project_documents",
        "id,project_id,source_system,source_item_id,deleted_at",
        limit=DOCUMENT_HEALTH_SAMPLE_LIMIT,
    )
    chunks = _chunk_rows_for_documents(
        supabase,
        [str(row.get("id")) for row in documents if row.get("id")],
    )
    fireflies_jobs = _table_rows(
        get_rag_read_client(),
        "fireflies_ingestion_jobs",
        "fireflies_id,stage,error_message,last_attempt_at,updated_at,metadata_id",
        limit=JOB_HEALTH_SAMPLE_LIMIT,
    )
    source_jobs: List[Dict[str, Any]] = []
    packet_jobs: List[Dict[str, Any]] = []
    tasks = _table_rows(
        supabase,
        "tasks",
        "id,metadata_id,source_system,extraction_source,created_at,updated_at",
    )
    snapshots = _table_rows(
        get_rag_read_client(),
        "source_sync_health_snapshots",
        "source,resource_id,resource_name,status,last_sync_at,last_success_at,last_error_at,last_error_message,items_synced,unprocessed_count,unembedded_count,stale_minutes,metadata",
    )
    subscriptions = _table_rows(
        get_rag_read_client(),
        "graph_subscriptions",
        "source,resource_id,resource_name,status,expiration_at,last_notification_at,last_error_message",
    )
    acumatica_sync_states = _table_rows(
        supabase,
        "acumatica_sync_state",
        "entity_name,status,last_started_at,last_success_at,last_error,last_stats,updated_at",
    )
    sync_runs = _table_rows(
        get_rag_read_client(),
        "source_sync_runs",
        "id,source,resource_id,resource_name,stage,status,started_at,finished_at,items_seen,items_synced,items_failed,error_code,error_message,metadata",
        limit=50,
        order_by="started_at",
        desc=True,
    )
    # Broader fetch for freshness derivation — used to override stale snapshot fields
    sync_runs_freshness = _table_rows(
        get_rag_read_client(),
        "source_sync_runs",
        "source,resource_id,started_at,status",
        limit=FRESHNESS_RUN_LIMIT,
        order_by="started_at",
        desc=True,
    )

    chunk_document_ids = {str(row.get("document_id")) for row in chunks if row.get("document_id")}
    active_source_jobs: List[Dict[str, Any]] = []
    active_packet_jobs: List[Dict[str, Any]] = []

    document_counts, document_sources = _document_health(
        documents,
        chunk_document_ids,
        now,
    )
    document_by_id = {str(row.get("id")): row for row in documents if row.get("id")}

    discovered_sharepoint_resource_ids = sharepoint_resource_ids_from_receipt(
        sync_runs
    )
    if os.environ.get(
        "SHAREPOINT_PROJECT_DISCOVERY_ENABLED",
        "false",
    ).strip().lower() == "true":
        active_sharepoint_resource_ids = (
            discovered_sharepoint_resource_ids
            or _recent_sharepoint_resource_ids(graph_states, now)
        )
    else:
        active_sharepoint_resource_ids = (
            _active_sharepoint_resource_ids()
            or _recent_sharepoint_resource_ids(graph_states, now)
        )
    discovery_receipt = _sharepoint_discovery_receipt(sync_runs)

    sources: List[Dict[str, Any]] = []
    for state in graph_states:
        last_sync = _parse_datetime(state.get("last_sync_at"))
        # A partial SharePoint sync preserves its delta cursor and records a
        # warning so the next scheduled pass can recover it. Treat that warning
        # as degraded health too; otherwise the recovery queue is invisible to
        # operational monitoring and the source is reported healthy.
        last_error = (
            state.get("error_message")
            if state.get("sync_status") in {"error", "warning"}
            else None
        )
        stale = _age_minutes(last_sync, now)
        source = str(state.get("source") or "microsoft_graph")
        if _is_inactive_graph_resource_with_active_ids(state, active_sharepoint_resource_ids):
            continue
        sources.append(
            _source_row(
                source=source,
                resource_id=str(state.get("resource_id") or "default"),
                resource_name=state.get("resource_name"),
                status=_health_status(
                    stale_minutes=stale,
                    stale_threshold=STALE_SYNC_MINUTES,
                    last_error=last_error,
                    unembedded=document_counts.get(source, {}).get("unembedded", 0),
                ),
                last_sync_at=last_sync,
                last_success_at=last_sync if not last_error else None,
                last_error_at=_parse_datetime(state.get("updated_at")) if last_error else None,
                last_error_message=last_error,
                items_synced=int(state.get("items_synced") or 0),
                stale_minutes=stale,
                unprocessed_count=document_counts.get(source, {}).get("status:uploaded", 0),
                unembedded_count=document_counts.get(source, {}).get("unembedded", 0),
                uncompiled_count=document_counts.get(source, {}).get("uncompiled", 0),
                metadata={"syncStatus": state.get("sync_status")},
            )
        )

    if discovery_receipt:
        bootstrap_pending = int(
            discovery_receipt.get("bootstrap_pending_count") or 0
        )
        incremental_pending = int(
            discovery_receipt.get("incremental_pending_count") or 0
        )
        discovery_error = discovery_receipt.get("error")
        pending = bootstrap_pending + incremental_pending
        discovery_status = (
            "critical"
            if discovery_error or incremental_pending
            else "warning" if bootstrap_pending else "healthy"
        )
        message = None
        if discovery_error:
            message = f"SharePoint project discovery failed: {discovery_error}"
        elif incremental_pending:
            message = (
                f"{incremental_pending} initialized SharePoint project folder(s) "
                "were not checked because the incremental cap was reached."
            )
        elif bootstrap_pending:
            message = (
                f"{bootstrap_pending} discovered SharePoint project folder(s) "
                "have not completed their initial source inventory."
            )
        sources.append(
            _source_row(
                source="sharepoint_file",
                resource_id="sharepoint:project-discovery",
                resource_name="SharePoint project discovery",
                status=discovery_status,
                last_sync_at=_parse_datetime(
                    next(
                        (
                            row.get("started_at")
                            for row in sync_runs
                            if str(row.get("source") or "")
                            == "microsoft_graph_source_sync"
                        ),
                        None,
                    )
                ),
                last_success_at=None if message else now,
                last_error_at=now if message else None,
                last_error_message=message,
                items_synced=int(discovery_receipt.get("established_count") or 0),
                stale_minutes=0,
                unprocessed_count=pending,
                unembedded_count=0,
                uncompiled_count=0,
                metadata={"sharepointDiscovery": discovery_receipt},
            )
        )

    sources.extend(document_sources)

    acumatica_source = _acumatica_sync_source(acumatica_sync_states, now)
    if acumatica_source:
        sources.append(acumatica_source)

    latest_fireflies = max(
        (
            _parse_datetime(row.get("updated_at"))
            for row in fireflies_jobs
            if _source_key(document_by_id.get(str(row.get("metadata_id") or ""), {})) == "fireflies"
        ),
        default=None,
    )
    fireflies_error_rows = [
        row
        for row in fireflies_jobs
        if _source_key(document_by_id.get(str(row.get("metadata_id") or ""), {})) == "fireflies"
    ]
    if fireflies_error_rows and not any(row["source"] == "fireflies" for row in sources):
        fireflies_errors = [row.get("error_message") for row in fireflies_error_rows if row.get("error_message")]
        stale = _age_minutes(latest_fireflies, now)
        sources.append(
            _source_row(
                source="fireflies",
                resource_id="fireflies_ingestion_jobs",
                resource_name="Fireflies meetings",
                status=_health_status(
                    stale_minutes=stale,
                    stale_threshold=STALE_FIREFLIES_MINUTES,
                    last_error=fireflies_errors[0] if fireflies_errors else None,
                    unembedded=document_counts.get("fireflies", {}).get("unembedded", 0),
                ),
                last_sync_at=latest_fireflies,
                last_success_at=latest_fireflies if not fireflies_errors else None,
                last_error_at=latest_fireflies if fireflies_errors else None,
                last_error_message=fireflies_errors[0] if fireflies_errors else None,
                items_synced=len(fireflies_error_rows),
                stale_minutes=stale,
                unprocessed_count=sum(1 for row in fireflies_error_rows if row.get("stage") != "complete"),
                unembedded_count=document_counts.get("fireflies", {}).get("unembedded", 0),
                uncompiled_count=document_counts.get("fireflies", {}).get("uncompiled", 0),
                metadata={"source": "fireflies_ingestion_jobs"},
            )
        )

    if tasks:
        latest_task = max(
            (
                parsed
                for parsed in (_parse_datetime(row.get("updated_at")) for row in tasks)
                if parsed
            ),
            default=None,
        )
        stale = _age_minutes(latest_task, now)
        sources.append(
            _source_row(
                source="task_extraction",
                resource_id="tasks",
                resource_name="Task extraction",
                status=_health_status(
                    stale_minutes=stale,
                    stale_threshold=STALE_EXTRACTION_MINUTES,
                    last_error=None,
                ),
                last_sync_at=latest_task,
                last_success_at=latest_task,
                last_error_at=None,
                last_error_message=None,
                items_synced=len(tasks),
                stale_minutes=stale,
                unprocessed_count=0,
                unembedded_count=0,
                uncompiled_count=0,
                metadata={"source": "tasks.updated_at"},
            )
        )

    for snapshot in snapshots:
        snapshot_source = str(snapshot.get("source") or "unknown")
        snapshot_resource = str(snapshot.get("resource_id") or "default")
        if _is_inactive_graph_resource_with_active_ids(
            {"source": snapshot_source, "resource_id": snapshot_resource},
            active_sharepoint_resource_ids,
        ):
            continue
        if any(
            row["source"] == snapshot_source and row["resourceId"] == snapshot_resource
            for row in sources
        ):
            continue
        snapshot_unprocessed = int(snapshot.get("unprocessed_count") or 0)
        snapshot_unembedded = int(snapshot.get("unembedded_count") or 0)
        snapshot_stale_minutes = snapshot.get("stale_minutes")
        snapshot_last_error = snapshot.get("last_error_message")
        snapshot_status = str(snapshot.get("status") or "unknown")
        # Historical snapshots may have been marked warning solely because the
        # retired per-document compiler queue was backlogged. Source readiness
        # now ends at durable embedding, so do not resurrect that retired stage
        # through fallback data after the live health calculation removed it.
        if (
            snapshot_status == "warning"
            and not snapshot_last_error
            and snapshot_stale_minutes is not None
            and snapshot_stale_minutes <= STALE_SYNC_MINUTES
            and snapshot_unprocessed == 0
            and snapshot_unembedded < EMBEDDING_BACKLOG_WARNING
        ):
            snapshot_status = "healthy"
        sources.append(
            _source_row(
                source=snapshot_source,
                resource_id=snapshot_resource,
                resource_name=snapshot.get("resource_name"),
                status=snapshot_status,
                last_sync_at=_parse_datetime(snapshot.get("last_sync_at")),
                last_success_at=_parse_datetime(snapshot.get("last_success_at")),
                last_error_at=_parse_datetime(snapshot.get("last_error_at")),
                last_error_message=snapshot_last_error,
                items_synced=int(snapshot.get("items_synced") or 0),
                stale_minutes=snapshot_stale_minutes,
                unprocessed_count=snapshot_unprocessed,
                unembedded_count=snapshot_unembedded,
                uncompiled_count=0,
                metadata=snapshot.get("metadata") or {},
            )
        )

    # Override staleness for any source where source_sync_runs is more recent
    # than the snapshot field. This prevents false 'stale' alerts when
    # graph_sync_state.last_sync_at or document timestamps lag the real cadence.
    run_freshness_by_source = _build_run_freshness_by_source(sync_runs_freshness)
    _apply_run_ledger_freshness(sources, run_freshness_by_source, now)

    pipeline = {
        "documentMetadataBySource": _counter(documents, "source_system"),
        "documentMetadataByCategory": _counter(documents, "category"),
        "documentMetadataByStatus": _counter(documents, "status"),
        "unembeddedBySource": {
            source: counts.get("unembedded", 0)
            for source, counts in document_counts.items()
            if counts.get("unembedded", 0) > 0
        },
        # Compatibility-only field. Packet freshness is owned by the canonical
        # Project Intelligence run and artifact ledger, not source ingestion.
        "uncompiledBySource": {},
        "firefliesJobsByStage": _counter(fireflies_jobs, "stage"),
        "sourceJobsByStatus": _counter(active_source_jobs, "status"),
        "sourceJobsByStatusRaw": _counter(source_jobs, "status"),
        "retiredSourceJobsByStatus": {},
        "packetJobsByStatus": _counter(active_packet_jobs, "status"),
        "packetJobsByStatusRaw": _counter(packet_jobs, "status"),
        "retiredPacketJobsByStatus": {},
        "tasksBySourceSystem": _counter(tasks, "source_system"),
        "graphSubscriptionsByStatus": _counter(subscriptions, "status"),
        "unconfiguredGraphSubscriptions": len(_unconfigured_graph_subscriptions(subscriptions)),
        "graphProjectDocumentPromotion": _graph_project_document_promotion_counts(
            documents,
            project_documents,
        ),
    }

    alerts = detect_source_sync_alerts(sources, pipeline, now)
    stuck_items = _stuck_item_rows(fireflies_jobs, documents, now)
    sorted_sources = _sorted_sources(sources)
    unhealthy = any(source["status"] in {"warning", "critical", "unknown"} for source in sources)
    status = "degraded" if unhealthy or alerts else "healthy"

    return {
        "status": status,
        "healthy": status == "healthy",
        "generatedAt": _iso(now),
        "thresholds": {
            "staleSyncMinutes": STALE_SYNC_MINUTES,
            "staleFirefliesMinutes": STALE_FIREFLIES_MINUTES,
            "staleExtractionMinutes": STALE_EXTRACTION_MINUTES,
            "embeddingBacklogWarning": EMBEDDING_BACKLOG_WARNING,
            "failedJobWarning": FAILED_JOB_WARNING,
            "documentHealthSampleLimit": DOCUMENT_HEALTH_SAMPLE_LIMIT,
            "chunkHealthSampleLimit": CHUNK_HEALTH_SAMPLE_LIMIT,
            "jobHealthSampleLimit": JOB_HEALTH_SAMPLE_LIMIT,
            "maxReturnedSources": MAX_RETURNED_SOURCES,
            "maxReturnedAlerts": MAX_RETURNED_ALERTS,
            "maxReturnedStuckItems": MAX_RETURNED_STUCK_ITEMS,
        },
        "sources": _limited_rows(sorted_sources, MAX_RETURNED_SOURCES),
        "pipeline": pipeline,
        "alerts": _limited_rows(alerts, MAX_RETURNED_ALERTS),
        "recentRuns": _recent_run_rows(sync_runs),
        "stuckItems": _limited_rows(stuck_items, MAX_RETURNED_STUCK_ITEMS),
        "counts": {
            "sources": len(sources),
            "alerts": len(alerts),
            "documents": len(documents),
            "chunks": len(chunks),
            "unembedded": sum(pipeline["unembeddedBySource"].values()),
            "uncompiled": 0,
            "tasks": len(tasks),
            "graphSubscriptions": len(subscriptions),
            "stuckItems": len(stuck_items),
        },
    }
