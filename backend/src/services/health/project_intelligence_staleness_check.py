"""Staleness health check for project intelligence narratives.

Monitors max(project_current_state.updated_at) and intelligence_packets
generation freshness. Silent staleness (2+ weeks) is the failure mode this
guards against (incident #759).

Alerts if:
- project_current_state max updated_at is older than N days (default 2).
- intelligence_packets max generated_at is older than N days (default 2).

Two hardening rules layered on top of the raw age check (AAI-1196 recurrence):

1. Weekend awareness for ``project_current_state``. That table's ONLY writer is
   the ``daily-executive-brief`` consumer fan-out, which runs on weekdays only
   (render.yaml ``alleato-daily-executive-brief-0600-et`` — ``* * 1-5``). A flat
   daily age threshold therefore false-fires every Monday morning (the row is
   legitimately ~2.5 days old after the weekend gap, before Monday's run). We
   subtract weekend days from the elapsed window so only *expected* weekday
   refreshes count toward staleness. Weekday detection is never weakened.

2. Self-locating diagnosis. When ``project_current_state`` is stale we look at
   its actual upstream — the newest ``daily-executive-brief`` current packet —
   and classify WHICH layer failed (brief generation vs. the consumer projection
   that writes ``project_current_state``), with the exact recovery command. This
   turns "N days old, go dig" into an actionable page.
"""

from __future__ import annotations

import json
import logging
import os
from datetime import datetime, timedelta, timezone
from typing import Any, Optional

import httpx

logger = logging.getLogger(__name__)

# How old is "stale" for narrative tables?
DEFAULT_MAX_STALENESS_DAYS = 2

# The controlled writer of project_current_state (the daily executive brief
# consumer fan-out) and the manual replay entrypoint for it.
_DAILY_BRIEF_TARGET_SLUG = "daily-executive-brief"
_CONSUMER_REPLAY_CMD = (
    "node project-intelligence/projections/daily-deep-read-consumers.mjs --packetId {packet_id}"
)
_BRIEF_REGEN_CMD = (
    "node project-intelligence/runner/run-scheduled-daily-executive-brief.mjs --regenerate"
)


def _weekend_days_spanned(start: datetime, end: datetime) -> int:
    """Count Saturday/Sunday calendar dates in the half-open interval (start, end].

    These are days on which the weekday-only project_current_state writer is not
    expected to run, so they must not inflate staleness. Returns 0 when the
    interval is empty or inverted.
    """
    if end <= start:
        return 0
    count = 0
    day = start.date() + timedelta(days=1)
    last = end.date()
    while day <= last:
        if day.weekday() >= 5:  # 5 = Saturday, 6 = Sunday
            count += 1
        day += timedelta(days=1)
    return count


def _diagnose_project_current_state_staleness(
    client: Any, now: datetime, max_staleness: timedelta
) -> Optional[dict]:
    """Localize project_current_state staleness to a pipeline layer.

    project_current_state is written only by the daily-executive-brief consumer
    fan-out, applied atomically with packet promotion. So when the table is stale
    the fault is in exactly one of two layers, and the newest brief packet tells
    us which:

    - Brief packet is fresh AND completed → the packet exists but its projection
      never landed (the consumer failed). Recovery: replay the consumer.
    - Brief packet is stale/incomplete/missing → the brief itself stopped
      producing. Recovery: check/regenerate the daily-executive-brief run.

    Best-effort: any failure here returns None so the core staleness signal is
    never lost.
    """
    try:
        targets = (
            client.table("intelligence_targets")
            .select("id")
            .eq("slug", _DAILY_BRIEF_TARGET_SLUG)
            .limit(1)
            .execute()
            .data
            or []
        )
        if not targets:
            return {
                "layer": "brief_generation",
                "detail": (
                    f"No '{_DAILY_BRIEF_TARGET_SLUG}' intelligence target exists — the "
                    "daily executive brief has never been wired up."
                ),
                "recovery_hint": _BRIEF_REGEN_CMD,
            }
        target_id = targets[0]["id"]
        # Read the newest packet of ANY type, not just packet_type='current'. A
        # freshly-compiled brief is written as a 'snapshot'/'working_sample' with
        # runContract.status='staged' and is only promoted to 'current'+'completed'
        # by the consumer's promoteCompletedPacket (packet-repository.mjs +
        # daily-deep-read-consumers.mjs). So in the exact case this diagnosis must
        # catch — the brief compiled fine but the consumer failed before promotion —
        # the fresh packet is still 'staged' while the stale prior packet remains
        # 'current'. Filtering to 'current' would read the stale row and misreport
        # the consumer failure as brief-generation stall with the wrong recovery.
        packets = (
            client.table("intelligence_packets")
            .select("id,generated_at,packet_json")
            .eq("target_id", target_id)
            .order("generated_at", desc=True)
            .limit(1)
            .execute()
            .data
            or []
        )
        if not packets:
            return {
                "layer": "brief_generation",
                "detail": "No current daily-executive-brief packet exists to project from.",
                "recovery_hint": _BRIEF_REGEN_CMD,
            }
        packet = packets[0]
        packet_id = packet.get("id")
        gen_str = packet.get("generated_at")
        gen_at = (
            datetime.fromisoformat(gen_str.replace("Z", "+00:00")) if gen_str else None
        )
        run_status = (
            ((packet.get("packet_json") or {}).get("runContract") or {}).get("status")
        )
        # Apply the same weekday-only schedule semantics used for
        # project_current_state. Otherwise a Friday packet is misclassified as
        # stale on Tuesday even though the weekend was an expected gap.
        brief_effective_staleness = (
            now - gen_at - timedelta(days=_weekend_days_spanned(gen_at, now))
            if gen_at is not None
            else None
        )
        brief_fresh = (
            brief_effective_staleness is not None
            and brief_effective_staleness <= max_staleness
        )

        if brief_fresh and run_status == "completed":
            return {
                "layer": "consumer_projection",
                "detail": (
                    f"The daily-executive-brief packet {packet_id} is fresh and completed "
                    f"(generated {gen_str}), but its project_current_state projection did not "
                    "land — the consumer fan-out failed after the packet was written."
                ),
                "recovery_hint": _CONSUMER_REPLAY_CMD.format(packet_id=packet_id),
            }
        if brief_fresh and run_status != "completed":
            return {
                "layer": "consumer_projection",
                "detail": (
                    f"The newest daily-executive-brief packet {packet_id} is fresh but its run "
                    f"never completed (runContract.status={run_status!r}); the consumer aborted "
                    "before promoting the packet, so project_current_state was never advanced."
                ),
                "recovery_hint": _CONSUMER_REPLAY_CMD.format(packet_id=packet_id),
            }
        return {
            "layer": "brief_generation",
            "detail": (
                f"The newest daily-executive-brief packet (generated {gen_str}) is itself stale — "
                "brief generation stopped, so there is nothing fresh to project."
            ),
            "recovery_hint": _BRIEF_REGEN_CMD,
        }
    except Exception as exc:  # noqa: BLE001 — diagnosis must never break the core check
        logger.warning(
            "[ProjectIntelligenceStalenessCheck] staleness diagnosis failed: %s", exc
        )
        return None


def check_project_intelligence_staleness(
    *, now: Optional[datetime] = None, client: Any = None
) -> dict:
    """Check if project intelligence narratives are stale.

    ``now`` and ``client`` are injectable for deterministic tests; production
    callers pass neither and get wall-clock time plus the PM-APP Supabase client.
    """
    max_staleness_days = int(os.getenv("PROJECT_INTELLIGENCE_STALENESS_CHECK_DAYS", str(DEFAULT_MAX_STALENESS_DAYS)))
    max_staleness = timedelta(days=max_staleness_days)
    now = now or datetime.now(timezone.utc)

    if client is None:
        from ..supabase_helpers import get_supabase_client

        client = get_supabase_client()

    result: dict = {
        "check": "project_intelligence_staleness",
        "max_allowed_staleness_days": max_staleness_days,
        "timestamp": now.isoformat(),
        "healthy": True,
        "alerts": [],
    }

    # Check project_current_state staleness
    try:
        current_state_rows = (
            client.table("project_current_state")
            .select("updated_at")
            .order("updated_at", desc=True)
            .limit(1)
            .execute()
            .data
            or []
        )
        if current_state_rows:
            last_update_str = current_state_rows[0]["updated_at"]
            # Parse ISO timestamp
            last_update = datetime.fromisoformat(last_update_str.replace("Z", "+00:00"))
            staleness = now - last_update
            # The writer runs weekdays only; the weekend gap is expected, not a
            # failure. Subtract weekend days so only missed *weekday* refreshes
            # count. Weekday detection is unchanged (weekends contribute 0).
            weekend_days = _weekend_days_spanned(last_update, now)
            effective_staleness = staleness - timedelta(days=weekend_days)
            result["project_current_state_last_update"] = last_update_str
            result["project_current_state_staleness_days"] = staleness.days
            result["project_current_state_weekend_days_excluded"] = weekend_days
            result["project_current_state_business_days_stale"] = max(
                effective_staleness.days, 0
            )

            if effective_staleness > max_staleness:
                result["healthy"] = False
                business_days = max(effective_staleness.days, 0)
                diagnosis = _diagnose_project_current_state_staleness(
                    client, now, max_staleness
                )
                alert: dict = {
                    "table": "project_current_state",
                    "last_update": last_update_str,
                    "staleness_days": staleness.days,
                    "business_days_stale": business_days,
                    "message": (
                        f"project_current_state narratives are stale: {business_days} "
                        f"business days old (last refresh {last_update_str})"
                    ),
                }
                if diagnosis:
                    alert["layer"] = diagnosis["layer"]
                    alert["diagnosis"] = diagnosis["detail"]
                    alert["recovery_hint"] = diagnosis["recovery_hint"]
                    result["project_current_state_diagnosis"] = diagnosis
                result["alerts"].append(alert)
        else:
            result["project_current_state_last_update"] = None
            result["project_current_state_staleness_days"] = None
    except Exception as e:  # noqa: BLE001
        logger.error("[ProjectIntelligenceStalenessCheck] Failed to check project_current_state: %s", e)
        result["healthy"] = False
        result["alerts"].append({
            "table": "project_current_state",
            "error": str(e),
        })

    # Check intelligence_packets staleness (for the synthesis version)
    try:
        packet_rows = (
            client.table("intelligence_packets")
            .select("generated_at")
            .eq("compiler_version", "project_intelligence_synthesis_v1")
            .eq("packet_type", "current")
            .order("generated_at", desc=True)
            .limit(1)
            .execute()
            .data
            or []
        )
        if packet_rows:
            last_gen_str = packet_rows[0]["generated_at"]
            # Parse ISO timestamp
            last_gen = datetime.fromisoformat(last_gen_str.replace("Z", "+00:00"))
            staleness = now - last_gen
            result["intelligence_packets_last_generated"] = last_gen_str
            result["intelligence_packets_staleness_days"] = staleness.days

            if staleness > max_staleness:
                result["healthy"] = False
                result["alerts"].append({
                    "table": "intelligence_packets",
                    "last_generated": last_gen_str,
                    "staleness_days": staleness.days,
                    "message": f"intelligence_packets syntheses are stale: {staleness.days} days old",
                })
        else:
            result["intelligence_packets_last_generated"] = None
            result["intelligence_packets_staleness_days"] = None
    except Exception as e:  # noqa: BLE001
        logger.error("[ProjectIntelligenceStalenessCheck] Failed to check intelligence_packets: %s", e)
        result["healthy"] = False
        result["alerts"].append({
            "table": "intelligence_packets",
            "error": str(e),
        })

    return result


def _post_slack(webhook_url: str, result: dict[str, Any]) -> None:
    """Post staleness alert to Slack."""
    try:
        alert_lines = []
        for alert in result.get("alerts", []):
            alert_lines.append(
                f"• {alert.get('table')}: {alert.get('message', alert.get('error'))}"
            )
            if alert.get("diagnosis"):
                alert_lines.append(f"    ↳ {alert['diagnosis']}")
            if alert.get("recovery_hint"):
                alert_lines.append(f"    ↳ Recovery: {alert['recovery_hint']}")
        alerts_text = "\n".join(alert_lines)
        text = (
            f"⚠️ Project Intelligence Staleness Alert\n\n"
            f"{alerts_text}\n\n"
            f"Max allowed staleness: {result.get('max_allowed_staleness_days')} days\n"
            f"Checked at: {result.get('timestamp')}"
        )
        httpx.post(webhook_url, json={"text": text}, timeout=10)
    except Exception as exc:  # noqa: BLE001
        logger.warning("[ProjectIntelligenceStalenessCheck] Slack notification failed: %s", exc)


if __name__ == "__main__":
    import sys

    result = check_project_intelligence_staleness()
    print(json.dumps(result, indent=2, default=str))

    if not result["healthy"]:
        slack_url = os.getenv("SLACK_WEBHOOK_URL")
        if slack_url:
            _post_slack(slack_url, result)
        logger.info(
            "[ProjectIntelligenceStalenessCheck] Alert recorded — slack=%s, teams=owned-by-pipeline-alert-notifier",
            "yes" if slack_url else "no-webhook",
        )

    sys.exit(0 if result["healthy"] else 1)
