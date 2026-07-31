from __future__ import annotations

from src.services.ops.db_pressure_guard import enforce_app_db_pressure_guard
from src.services.supabase_helpers import get_supabase_client

from .source_sync_health import (
    MAX_RECOMPUTE_ALERT_WRITES,
    MAX_RECOMPUTE_SNAPSHOT_WRITES,
    get_source_sync_health,
    persist_source_sync_alerts,
    update_source_health_snapshot,
)


def run_source_sync_health_recompute() -> dict:
    """Persist current source-sync snapshots and active alerts."""
    enforce_app_db_pressure_guard("source_sync_health_recompute")
    client = get_supabase_client()
    health = get_source_sync_health(client)
    updated = 0
    for source in health.get("sources", [])[:MAX_RECOMPUTE_SNAPSHOT_WRITES]:
        update_source_health_snapshot(client, source)
        updated += 1
    routed_alerts = persist_source_sync_alerts(
        client,
        health.get("alerts", [])[:MAX_RECOMPUTE_ALERT_WRITES],
        resolve_missing=False,
    )
    return {
        "status": "completed",
        "updatedSnapshots": updated,
        "routedAlerts": routed_alerts,
        "writeCaps": {
            "snapshots": MAX_RECOMPUTE_SNAPSHOT_WRITES,
            "alerts": MAX_RECOMPUTE_ALERT_WRITES,
            "resolveMissing": False,
        },
        "health": health,
    }
