"""Cron entrypoint: send Brandon's daily email triage digest via Teams.

Runs at 7:00 AM ET (12:00 UTC). Queries outlook_email_intake for the prior
calendar day, groups by triage_action, and sends a summary Teams DM so Brandon
starts the day with a clear picture of yesterday's inbox activity.
"""

from __future__ import annotations

import logging
import os
import sys
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from typing import Iterable

sys.path.insert(0, "/app")

from src.services.env_loader import load_env

load_env()

import httpx

from src.services.supabase_helpers import get_outlook_intake_read_client

logging.basicConfig(level=logging.INFO, format="%(levelname)s %(message)s")
logger = logging.getLogger(__name__)

_DEFAULT_TEAMS_USER_ID = "1854b4b0-3e8e-4d69-86df-32cdb3c80ee0"


@dataclass(frozen=True)
class DeliveryResult:
    status: str
    detail: str
    http_status: int | None = None

    @property
    def sent(self) -> bool:
        return self.status == "sent"


def _app_base_url() -> str:
    return (
        os.getenv("NEXT_PUBLIC_APP_URL")
        or os.getenv("APP_BASE_URL")
        or "https://projects.alleatogroup.com"
    ).rstrip("/")


def _send_teams_dm(message: str) -> DeliveryResult:
    service_key = os.getenv("NOTIFICATION_SERVICE_KEY")
    user_id = os.getenv("MICROSOFT_EXECUTIVE_ASSISTANT_TEAMS_USER_ID") or _DEFAULT_TEAMS_USER_ID
    if os.getenv("EMAIL_DIGEST_DRY_RUN", "").strip().lower() in {"1", "true", "yes"}:
        logger.info("EMAIL_DIGEST_DRY_RUN enabled — not sending Teams digest")
        return DeliveryResult(status="dry_run", detail="EMAIL_DIGEST_DRY_RUN enabled")
    if not service_key:
        logger.warning("NOTIFICATION_SERVICE_KEY not set — cannot send Teams digest")
        return DeliveryResult(status="blocked", detail="NOTIFICATION_SERVICE_KEY not set")
    try:
        resp = httpx.post(
            f"{_app_base_url()}/api/bot/proactive/teams",
            headers={"Authorization": f"Bearer {service_key}"},
            json={"userId": user_id, "message": message},
            timeout=15,
        )
        if resp.status_code >= 400:
            logger.warning("Teams DM HTTP %s: %s", resp.status_code, resp.text[:200])
            return DeliveryResult(
                status="failed",
                detail=resp.text[:200] or "Teams DM HTTP failure",
                http_status=resp.status_code,
            )
        return DeliveryResult(status="sent", detail="Teams digest sent", http_status=resp.status_code)
    except Exception as exc:
        logger.warning("Teams DM failed: %s", exc)
        return DeliveryResult(status="failed", detail=str(exc)[:500])


def generate_email_digest(mailbox: str, date: datetime) -> str:
    """Query outlook_email_intake for `date` and return a formatted digest string."""
    client = get_outlook_intake_read_client()

    day_start = date.replace(hour=0, minute=0, second=0, microsecond=0)
    day_end = day_start + timedelta(days=1)

    rows = (
        client.table("outlook_email_intake")
        .select("id,subject,from_email,from_name,triage_action,received_at,has_attachments")
        .eq("mailbox_user_id", mailbox)
        .gte("received_at", day_start.isoformat())
        .lt("received_at", day_end.isoformat())
        .order("received_at", desc=True)
        .execute()
    ).data or []
    intake_ids = [row.get("id") for row in rows if row.get("id") is not None]
    attachment_rows = _query_rows(
        client.table("outlook_email_intake_attachments")
        .select("intake_email_id,file_name,promotion_status,document_metadata_id,project_document_id")
        .in_("intake_email_id", intake_ids)
    ) if intake_ids else []
    draft_rows = _query_rows(
        client.table("outlook_email_assistant_reviews")
        .select("graph_message_id,assistant_action,assistant_priority,review_outcome,draft_body,created_at")
        .eq("mailbox_user_id", mailbox)
        .gte("created_at", day_start.isoformat())
        .lt("created_at", day_end.isoformat())
        .order("created_at", desc=True)
    )

    total = len(rows)
    triaged = [r for r in rows if r.get("triage_action")]
    untriaged = total - len(triaged)
    promoted_attachments = [
        row for row in attachment_rows
        if row.get("promotion_status") == "promoted"
    ]
    attachments_needing_review = [
        row for row in attachment_rows
        if row.get("promotion_status") in {"review_needed", "failed"}
    ]
    draft_rows = [
        row for row in draft_rows
        if row.get("draft_body") or row.get("review_outcome") in {"draft_copied", "draft_edited"}
    ]

    buckets: dict[str, list[dict]] = {
        "urgent": [],
        "reply_needed": [],
        "delegate": [],
        "fyi": [],
        "watch": [],
        "delete": [],
    }
    for r in triaged:
        action = (r.get("triage_action") or "").lower()
        if action in buckets:
            buckets[action].append(r)

    date_label = date.strftime("%A, %B %-d")

    def sender(r: dict) -> str:
        return r.get("from_name") or r.get("from_email") or "unknown"

    def bullet_list(items: list[dict], max_items: int = 4) -> str:
        lines = []
        for item in items[:max_items]:
            subj = (item.get("subject") or "(no subject)")[:60]
            lines.append(f"  - {subj} - {sender(item)}")
        if len(items) > max_items:
            lines.append(f"  - and {len(items) - max_items} more")
        return "\n".join(lines)

    def name_list(items: Iterable[dict], key: str, max_items: int = 5) -> str:
        names = [str(item.get(key) or "").strip() for item in items if item.get(key)]
        visible = names[:max_items]
        suffix = f", and {len(names) - max_items} more" if len(names) > max_items else ""
        return ", ".join(visible) + suffix if visible else "none"

    sections = [f"Email digest for {date_label}: {total} email(s) received"]

    if buckets["urgent"]:
        sections.append(f"\nUrgent ({len(buckets['urgent'])})\n{bullet_list(buckets['urgent'])}")

    if buckets["reply_needed"]:
        sections.append(
            f"\nReply Needed ({len(buckets['reply_needed'])})\n{bullet_list(buckets['reply_needed'])}"
        )

    if buckets["delegate"]:
        sections.append(f"\nTo Delegate ({len(buckets['delegate'])})")

    if buckets["fyi"] or buckets["watch"]:
        fyi_count = len(buckets["fyi"]) + len(buckets["watch"])
        sections.append(f"\nFYI / Watch ({fyi_count})")

    if attachment_rows:
        sections.append(
            "\nAttachments"
            f"\n- Total captured: {len(attachment_rows)}"
            f"\n- Saved to project documents: {len(promoted_attachments)}"
            f"\n- Needs review or failed: {len(attachments_needing_review)}"
            f"\n- Files: {name_list(attachment_rows, 'file_name')}"
        )

    if draft_rows:
        sections.append(
            "\nDrafts written"
            f"\n- Total drafts/review events: {len(draft_rows)}"
            f"\n- Highest priority: {name_list(draft_rows, 'assistant_priority', max_items=3)}"
        )

    if untriaged:
        sections.append(f"\nNot yet triaged: {untriaged}")

    if total == 0:
        sections.append("\nNo emails received — inbox clear.")

    return "\n".join(sections)


def _query_rows(query) -> list[dict]:
    try:
        return query.execute().data or []
    except Exception as exc:
        logger.warning("Digest query failed: %s", exc)
        return []


def main() -> None:
    mailbox = (
        os.getenv("MICROSOFT_EXECUTIVE_ASSISTANT_MAILBOX")
        or (os.getenv("MICROSOFT_SYNC_USERS", "").split(",")[0].strip())
    )
    if not mailbox:
        logger.error("No mailbox configured — set MICROSOFT_EXECUTIVE_ASSISTANT_MAILBOX")
        sys.exit(1)

    # Prior calendar day in UTC (close enough for ET overlap at 7 AM)
    yesterday = datetime.now(timezone.utc) - timedelta(days=1)
    digest = generate_email_digest(mailbox, yesterday)
    logger.info("Digest:\n%s", digest)

    delivery = _send_teams_dm(digest)
    logger.info(
        "Email digest delivery status=%s detail=%s http_status=%s",
        delivery.status,
        delivery.detail,
        delivery.http_status,
    )
    if not delivery.sent:
        logger.error("Failed to send digest via Teams DM: %s", delivery.detail)
        sys.exit(1)

    logger.info("Email digest sent successfully for %s", mailbox)


if __name__ == "__main__":
    main()
