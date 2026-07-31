"""Outcome-based pipeline alerting → Teams DM.

The 2026-06-23 incident: graph embedding failed 25/25 every run for 36h+ and
NOTHING paged the owner. The existing `source_sync_health` computes alerts and
persists them to `system_alerts`, but no job pushed them to a channel the owner
watches. This module closes that gap with an outcome gate read straight off the
`source_sync_runs` run ledger:

A source is "page-worthy" when, in the last DARK_WINDOW_MINUTES, it has
>= MIN_FAILED_RUNS failed runs and not a single success or partial-success
(warning) — i.e. nothing is getting through. Degraded lanes that still embed
some items (warning runs, e.g. a partial Fireflies backlog) do not page.

Page-worthy sources are upserted as `pipeline_outcome` rows in `system_alerts`
(so the /rag dashboard banner reads them from one place) and DM'd to the owner
via the existing proactive-bot bridge. Notifications are throttled: a source is
paged when it first goes down and re-nagged at most every RENOTIFY_HOURS while it
stays down; recovery resolves the alert silently. Best-effort throughout — the
ledger/notifier must never take down the pipeline it watches.
"""

from __future__ import annotations

import logging
import os
import sys
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Optional

import httpx

from ..supabase_helpers import get_rag_read_client, get_rag_write_client

logger = logging.getLogger(__name__)

# --- Outcome thresholds (match the owner's chosen sensitivity) ---------------
DARK_WINDOW_MINUTES = 90       # how far back the run ledger is scanned per source
MIN_FAILED_RUNS = 2           # "regression" = this many failed runs with no success
RENOTIFY_HOURS = 6            # re-nag cadence while a source stays down

_DEFAULT_ALERT_TEAMS_USER_ID = "1854b4b0-3e8e-4d69-86df-32cdb3c80ee0"  # owner (Megan)

# Source identifiers in source_sync_runs we treat as user-facing pipeline lanes.
SOURCE_LABELS = {
    "microsoft_graph": "Outlook / SharePoint vectorization",
    "microsoft_graph_source_sync": "Microsoft Graph source sync",
    "microsoft_graph_downstream": "Microsoft Graph downstream enrichment",
    "document_pipeline": "Document vectorization",
    "fireflies": "Meeting transcripts (Fireflies)",
    "teams_message": "Teams channel messages",
    "teams_chat_export": "Teams direct messages",
    "acumatica_financial_sync": "Acumatica financial sync",
}


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def _parse_dt(value: Any) -> Optional[datetime]:
    if not value:
        return None
    if isinstance(value, datetime):
        return value if value.tzinfo else value.replace(tzinfo=timezone.utc)
    try:
        parsed = datetime.fromisoformat(str(value).replace("Z", "+00:00"))
    except ValueError:
        return None
    return parsed if parsed.tzinfo else parsed.replace(tzinfo=timezone.utc)


def evaluate_pipeline_outcomes(now: Optional[datetime] = None) -> List[Dict[str, Any]]:
    """Return one page-worthy descriptor per source that is failing or dark."""
    now = now or _utcnow()
    window_start = (now - timedelta(minutes=DARK_WINDOW_MINUTES)).isoformat()

    try:
        rows = (
            get_rag_read_client()
            .from_("source_sync_runs")
            .select("source,stage,status,items_failed,started_at,finished_at,error_message")
            .gte("started_at", window_start)
            .order("started_at", desc=True)
            .limit(2000)
            .execute()
            .data
            or []
        )
    except Exception as exc:  # noqa: BLE001
        logger.warning("[PipelineAlert] Could not read source_sync_runs: %s", exc)
        return []

    by_source: Dict[str, Dict[str, Any]] = {}
    for row in rows:
        source = str(row.get("source") or "unknown")
        agg = by_source.setdefault(
            source,
            {"failed": 0, "succeeded": 0, "warning": 0, "last_success": None, "last_run": None, "last_error": None},
        )
        status = str(row.get("status") or "").lower()
        started = _parse_dt(row.get("started_at"))
        if started and (agg["last_run"] is None or started > agg["last_run"]):
            agg["last_run"] = started
        if status == "succeeded":
            agg["succeeded"] += 1
            if started and (agg["last_success"] is None or started > agg["last_success"]):
                agg["last_success"] = started
        elif status == "failed":
            agg["failed"] += 1
            if not agg["last_error"]:
                agg["last_error"] = row.get("error_message")
        elif status == "warning":
            agg["warning"] += 1

    alerts: List[Dict[str, Any]] = []
    for source, agg in by_source.items():
        last_success = agg["last_success"]
        success_age_min = int((now - last_success).total_seconds() // 60) if last_success else None

        # "nothing through" = not a single run succeeded OR even partially
        # succeeded (warning). A warning means some items embedded, so the lane
        # is degraded, not dark — those do not page (kept the fireflies partial
        # backlog from false-paging). Only a hard, total failure pages.
        nothing_through = agg["succeeded"] == 0 and agg["warning"] == 0
        regression = nothing_through and agg["failed"] >= MIN_FAILED_RUNS

        if not regression:
            continue

        label = SOURCE_LABELS.get(source, source.replace("_", " ").title())
        reason = f"{agg['failed']} failed runs and 0 successes in the last {DARK_WINDOW_MINUTES} min"
        alerts.append(
            {
                "source": source,
                "label": label,
                "reason": reason,
                "failed": agg["failed"],
                "succeeded": agg["succeeded"],
                "successAgeMinutes": success_age_min,
                "lastError": (str(agg["last_error"])[:300] if agg["last_error"] else None),
            }
        )
    return alerts


def _alert_key(source: str) -> str:
    return f"pipeline_outcome:{source}"


def _post_teams(message: str) -> bool:
    base_url = (
        os.getenv("NEXT_PUBLIC_APP_URL")
        or os.getenv("APP_BASE_URL")
        or "https://projects.alleatogroup.com"
    ).rstrip("/")
    service_key = os.getenv("NOTIFICATION_SERVICE_KEY")
    user_id = os.getenv("AI_HEALTH_ALERT_TEAMS_USER_ID", _DEFAULT_ALERT_TEAMS_USER_ID)
    if not service_key:
        logger.warning("[PipelineAlert] NOTIFICATION_SERVICE_KEY not set — cannot send Teams alert")
        return False
    try:
        resp = httpx.post(
            f"{base_url}/api/bot/proactive/teams",
            headers={"Authorization": f"Bearer {service_key}"},
            json={"userId": user_id, "message": message},
            timeout=15,
        )
        if resp.status_code >= 400:
            logger.warning("[PipelineAlert] Teams alert HTTP %s: %s", resp.status_code, resp.text[:200])
            return False
        return True
    except Exception as exc:  # noqa: BLE001
        logger.warning("[PipelineAlert] Teams notification failed: %s", exc)
        return False


def _teams_message(alerts: List[Dict[str, Any]]) -> str:
    narrative_only = bool(alerts) and all(
        alert.get("source") == "project_intelligence_staleness" for alert in alerts
    )
    heading = (
        "🚨 **Project intelligence alert** — project-page narratives stopped refreshing."
        if narrative_only
        else "🚨 **Data pipeline alert** — one or more sources stopped vectorizing."
    )
    lines = [heading, ""]
    for alert in alerts:
        lines.append(f"• **{alert['label']}** — {alert['reason']}.")
        if alert.get("lastError"):
            lines.append(f"    ↳ {alert['lastError']}")
    lines.append("")
    lines.append("See the RAG dashboard: /rag")
    return "\n".join(lines)


def notify(alerts: List[Dict[str, Any]], *, now: Optional[datetime] = None) -> Dict[str, Any]:
    """Persist alert state, resolve recoveries, and DM newly reserved alerts.

    External delivery is fail-closed on the throttle ledger. If we cannot read
    or persist ``system_alerts``, we cannot prove whether the alert was already
    sent, so sending anyway would create an unbounded notification loop.
    """
    now = now or _utcnow()
    now_iso = now.isoformat()
    rag = get_rag_write_client()
    active_keys = {_alert_key(a["source"]) for a in alerts}

    # Resolve any previously-active pipeline_outcome alerts that recovered.
    resolved = 0
    ledger_errors: List[Dict[str, str]] = []
    try:
        existing = (
            rag.from_("system_alerts")
            .select("id,alert_key")
            .eq("category", "pipeline_outcome")
            .eq("status", "active")
            .limit(500)
            .execute()
            .data
            or []
        )
        for row in existing:
            if row.get("alert_key") not in active_keys:
                rag.from_("system_alerts").update(
                    {"status": "resolved", "resolved_at": now_iso, "last_seen_at": now_iso}
                ).eq("id", row["id"]).execute()
                resolved += 1
    except Exception as exc:  # noqa: BLE001
        logger.warning("[PipelineAlert] Could not resolve recovered alerts: %s", exc)
        ledger_errors.append({"operation": "resolve", "error": str(exc)[:500]})

    to_notify: List[Dict[str, Any]] = []
    for alert in alerts:
        key = _alert_key(alert["source"])
        prior = None
        try:
            rows = (
                rag.from_("system_alerts")
                .select("id,first_seen_at,notified_at")
                .eq("alert_key", key)
                .limit(1)
                .execute()
                .data
                or []
            )
            prior = rows[0] if rows else None
        except Exception as exc:  # noqa: BLE001
            logger.warning("[PipelineAlert] Could not read prior alert for %s: %s", key, exc)
            ledger_errors.append({"operation": "read", "alertKey": key, "error": str(exc)[:500]})
            continue

        last_notified = _parse_dt(prior.get("notified_at")) if prior else None
        should_notify = last_notified is None or (now - last_notified) >= timedelta(hours=RENOTIFY_HOURS)

        payload = {
            "alert_key": key,
            "category": "pipeline_outcome",
            "code": "pipeline_source_dark",
            "severity": "critical",
            "source": alert["source"],
            "resource_id": "source_sync_runs",
            "title": f"{alert['label']} stopped vectorizing",
            "message": f"{alert['label']}: {alert['reason']}."
            + (f" Last error: {alert['lastError']}" if alert.get("lastError") else ""),
            "status": "active",
            "last_seen_at": now_iso,
            "resolved_at": None,
            "first_seen_at": (prior.get("first_seen_at") if prior and prior.get("first_seen_at") else now_iso),
            "metadata": {
                "failed": alert["failed"],
                "succeeded": alert["succeeded"],
                "successAgeMinutes": alert.get("successAgeMinutes"),
            },
        }
        if should_notify:
            payload["notified_at"] = now_iso
        try:
            rag.from_("system_alerts").upsert(payload, on_conflict="alert_key").execute()
            if should_notify:
                # ``notified_at`` is a durable reservation. Only a successful
                # reservation is eligible for external delivery.
                to_notify.append(alert)
        except Exception as exc:  # noqa: BLE001
            logger.warning("[PipelineAlert] Could not upsert alert %s: %s", key, exc)
            ledger_errors.append({"operation": "upsert", "alertKey": key, "error": str(exc)[:500]})

    teams_sent = False
    if to_notify:
        teams_sent = _post_teams(_teams_message(to_notify))

    return {
        "pageWorthy": len(alerts),
        "notified": len(to_notify),
        "resolved": resolved,
        "teamsSent": teams_sent,
        "ledgerHealthy": not ledger_errors,
        "ledgerErrors": ledger_errors,
    }


def _outlook_promotion_alert() -> Optional[Dict[str, Any]]:
    """Page-worthy descriptor when Outlook emails arrive but stop promoting into
    the document store (the 2026-06-17 silent-block signature). Best-effort —
    never raises, so it cannot take down the notifier it rides on."""
    try:
        from .outlook_promotion_freshness import check_outlook_promotion_freshness

        promo = check_outlook_promotion_freshness()
    except Exception as exc:  # noqa: BLE001
        logger.warning("[PipelineAlert] promotion-freshness check failed: %s", exc)
        return None
    if promo.get("status") != "blocked":
        return None
    return {
        "source": "outlook_promotion",
        "label": "Outlook email promotion (intake → document store)",
        "reason": promo.get("detail") or "Promotion into document_metadata is blocked.",
        "failed": promo.get("doc_store_age_minutes") or 0,
        "succeeded": 0,
        "successAgeMinutes": promo.get("doc_store_age_minutes"),
        "lastError": None,
    }


def _embedding_alert() -> Optional[Dict[str, Any]]:
    """Page-worthy descriptor when the graph embedding stage is failing in a burst
    (the 2026-06-24 auth-wall signature). Independent of the run-ledger "nothing
    through" gate, which interleaved partial-success runs can hold shut. Best-effort."""
    try:
        from .embedding_freshness import check_embedding_freshness

        emb = check_embedding_freshness()
    except Exception as exc:  # noqa: BLE001
        logger.warning("[PipelineAlert] embedding-freshness check failed: %s", exc)
        return None
    if emb.get("status") != "blocked":
        return None
    errs = emb.get("recent_embedding_errors") or 0
    return {
        "source": "graph_embedding",
        "label": "Graph embedding (vectorization)",
        "reason": emb.get("detail") or "Embedding is failing in a burst.",
        "failed": errs,
        "succeeded": 0,
        "successAgeMinutes": None,
        "lastError": None,
    }


def _project_intelligence_staleness_alert() -> Optional[Dict[str, Any]]:
    """Page-worthy descriptor when project-intelligence narratives go stale — the
    project_current_state / project-L2 intelligence_packets tables the
    /[projectId]/intelligence page reads. Silent staleness (2+ weeks) with NO
    alert was the 2026-06-24 failure mode (issue #759). Best-effort — never raises,
    so it cannot take down the notifier it rides on."""
    try:
        from .project_intelligence_staleness_check import (
            check_project_intelligence_staleness,
        )

        res = check_project_intelligence_staleness()
    except Exception as exc:  # noqa: BLE001
        logger.warning("[PipelineAlert] project-intelligence-staleness check failed: %s", exc)
        return None
    if res.get("healthy", True):
        return None
    days = (
        res.get("project_current_state_staleness_days")
        or res.get("intelligence_packets_staleness_days")
        or 0
    )
    reasons = "; ".join(
        a.get("message", "") for a in (res.get("alerts") or []) if a.get("message")
    )
    return {
        "source": "project_intelligence_staleness",
        "label": "Project intelligence narratives (project pages)",
        "reason": reasons or "Project intelligence narrative tables are stale.",
        "failed": days,
        "succeeded": 0,
        "successAgeMinutes": days * 24 * 60,
        "lastError": None,
    }


def run_pipeline_alert_check() -> Dict[str, Any]:
    now = _utcnow()
    alerts = evaluate_pipeline_outcomes(now)
    for extra in (_outlook_promotion_alert(), _embedding_alert(), _project_intelligence_staleness_alert()):
        if extra:
            alerts.append(extra)
    result = notify(alerts, now=now)
    result["checkedAt"] = now.isoformat()
    result["alerts"] = alerts
    return result


def main() -> int:
    logging.basicConfig(level=logging.INFO, stream=sys.stderr)
    import json

    result = run_pipeline_alert_check()
    print(json.dumps(result, indent=2, default=str))
    # Non-zero exit when something is actively down or alert state could not be
    # persisted. A broken ledger must never look like a healthy notifier run.
    return 1 if result.get("pageWorthy") or not result.get("ledgerHealthy", True) else 0


if __name__ == "__main__":
    sys.exit(main())
