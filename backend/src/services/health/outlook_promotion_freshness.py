"""Guardrail: detect when Outlook emails are arriving but NOT promoting into the
AI document store.

This is the exact signature of the 2026-06-17 incident (see
incident_outlook_ingestion_silent_block_2026_06_17): a silent guard dropped writes
to ``document_metadata`` for a week while ``outlook_email_intake`` kept ingesting
normally. The inbox UI looked current (it reads intake live) so nothing screamed.

The check compares two freshness signals across the two Supabase projects:

* newest ``outlook_email_intake.received_at``  (AI DB)  -> are emails arriving?
* newest Outlook ``document_metadata.created_at`` (PM APP) -> are they promoting?

If emails are arriving (intake fresh) but the document store has gone stale, the
promotion path is blocked/lagging -> raise loudly. This is intentionally NOT wired
into the large detect_source_sync_alerts engine; it is a small, independent check
so it cannot introduce false-stale regressions into that system.

Run standalone:  ``python3 -m src.services.health.outlook_promotion_freshness``
Exit code: 0 healthy, 1 lagging (warn), 2 blocked (critical), 3 unknown.
"""

from __future__ import annotations

import json
import sys
from datetime import datetime, timezone
from typing import Any, Dict, Optional

from src.services.supabase_helpers import (
    get_outlook_intake_read_client,
    get_supabase_client,
)

# Emails arriving within this window => intake is actively flowing.
INTAKE_FRESH_MAX_MIN = 180
# Newest promoted Outlook doc older than this => promotion has stalled.
DOC_STALE_MAX_MIN = 360
# Gap between newest intake email and newest promoted doc that warrants a warning.
LAG_WARN_MIN = 240


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def _parse(value: Any) -> Optional[datetime]:
    if not value:
        return None
    text = str(value).replace("Z", "+00:00")
    try:
        dt = datetime.fromisoformat(text)
    except ValueError:
        return None
    return dt if dt.tzinfo else dt.replace(tzinfo=timezone.utc)


def _age_min(dt: Optional[datetime], now: datetime) -> Optional[int]:
    if dt is None:
        return None
    return int((now - dt).total_seconds() // 60)


def _newest_intake_received_at() -> Optional[datetime]:
    resp = (
        get_outlook_intake_read_client()
        .from_("outlook_email_intake")
        .select("received_at")
        .order("received_at", desc=True)
        .limit(1)
        .execute()
    )
    rows = resp.data or []
    return _parse(rows[0].get("received_at")) if rows else None


def _newest_promoted_outlook_doc_at() -> Optional[datetime]:
    resp = (
        get_supabase_client()
        .from_("document_metadata")
        .select("created_at")
        .or_("type.eq.email,id.ilike.outlook_*")
        .order("created_at", desc=True)
        .limit(1)
        .execute()
    )
    rows = resp.data or []
    return _parse(rows[0].get("created_at")) if rows else None


def check_outlook_promotion_freshness() -> Dict[str, Any]:
    now = _utcnow()
    newest_intake = _newest_intake_received_at()
    newest_doc = _newest_promoted_outlook_doc_at()

    intake_age = _age_min(newest_intake, now)
    doc_age = _age_min(newest_doc, now)
    lag = (
        int((newest_intake - newest_doc).total_seconds() // 60)
        if newest_intake and newest_doc
        else None
    )

    if intake_age is None:
        status, exit_code = "unknown", 3
        detail = "No emails in outlook_email_intake; cannot assess promotion."
    elif intake_age <= INTAKE_FRESH_MAX_MIN and (doc_age is None or doc_age >= DOC_STALE_MAX_MIN):
        status, exit_code = "blocked", 2
        detail = (
            f"Emails are arriving (newest intake {intake_age}m ago) but the document "
            f"store is stale (newest Outlook doc "
            f"{'none' if doc_age is None else str(doc_age) + 'm'} ago). "
            "Promotion into document_metadata is blocked or failing silently."
        )
    elif lag is not None and lag >= LAG_WARN_MIN:
        status, exit_code = "lagging", 1
        detail = f"Promotion lag is {lag}m (intake newer than document store)."
    else:
        status, exit_code = "healthy", 0
        detail = "Outlook emails are promoting into the document store normally."

    return {
        "status": status,
        "exit_code": exit_code,
        "detail": detail,
        "newest_intake_received_at": newest_intake.isoformat() if newest_intake else None,
        "newest_promoted_doc_at": newest_doc.isoformat() if newest_doc else None,
        "intake_age_minutes": intake_age,
        "doc_store_age_minutes": doc_age,
        "promotion_lag_minutes": lag,
        "thresholds": {
            "intake_fresh_max_min": INTAKE_FRESH_MAX_MIN,
            "doc_stale_max_min": DOC_STALE_MAX_MIN,
            "lag_warn_min": LAG_WARN_MIN,
        },
        "checked_at": now.isoformat(),
    }


def main() -> int:
    # Local/standalone runs read creds from .env; on Render the cron env is already
    # populated so this is a harmless no-op (load_dotenv does not override real env).
    try:
        from dotenv import load_dotenv

        load_dotenv(".env")
    except ImportError:
        pass
    result = check_outlook_promotion_freshness()
    print(json.dumps(result, indent=2, sort_keys=True))
    return int(result["exit_code"])


if __name__ == "__main__":
    sys.exit(main())
