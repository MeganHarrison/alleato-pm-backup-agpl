"""RFI reply-by-email ingestion (Microsoft Graph).

Reads the shared RFI reply mailbox (RFI_REPLY_MAILBOX env var), matches each
message to an rfi_response_token via plus-address or magic-link URL, and
upserts an rfi_responses row.  Idempotent: keyed on the Graph message id so
re-running the same window never double-inserts.

Run as a Render cron every 15 minutes.
"""

from __future__ import annotations

import logging
import os
import re
import sys
from datetime import datetime, timedelta, timezone
from typing import List, Optional

from src.services.supabase_helpers import get_supabase_client
from src.services.integrations.microsoft_graph.live_mail import list_live_outlook_inbox

logger = logging.getLogger(__name__)

LOOKBACK_HOURS = 48
TOKEN_RE = re.compile(r"[A-Za-z0-9_\-]{16,}")


# ---------------------------------------------------------------------------
# Token extraction (mirrors frontend/src/lib/rfi/email-reply.ts)
# ---------------------------------------------------------------------------

def _extract_email_address(raw: str) -> Optional[str]:
    """Pull bare address from 'Name <email>' or plain address."""
    if not raw:
        return None
    angle = re.search(r"<([^>]+)>", raw)
    candidate = (angle.group(1) if angle else raw).strip()
    return candidate if "@" in candidate else None


def _extract_token_from_recipients(recipients: List[str], local_part: str, domain: str) -> Optional[str]:
    """Check To/Cc addresses for a plus-addressed token: <local>+<token>@<domain>."""
    pattern = re.compile(
        rf"^{re.escape(local_part)}\+({TOKEN_RE.pattern})@{re.escape(domain)}$",
        re.IGNORECASE,
    )
    for raw in recipients:
        addr = _extract_email_address(raw)
        if not addr:
            continue
        # Don't lowercase addr — token is case-sensitive base64url
        m = pattern.match(addr)
        if m:
            return m.group(1)
    return None


def _extract_token_from_body(body: str) -> Optional[str]:
    """Fallback: find /respond/rfi/<token> URL quoted in the body."""
    if not body:
        return None
    m = re.search(rf"/respond/rfi/({TOKEN_RE.pattern})", body)
    return m.group(1) if m else None


def _extract_reply_token(recipients: List[str], body: str, local_part: str, domain: str) -> Optional[str]:
    return _extract_token_from_recipients(recipients, local_part, domain) or _extract_token_from_body(body)


_QUOTE_MARKERS = [
    re.compile(r"^>"),
    re.compile(r"^On .+ wrote:\s*$", re.IGNORECASE),
    re.compile(r"^-----\s*Original Message\s*-----", re.IGNORECASE),
    re.compile(r"^_{8,}\s*$"),
    re.compile(r"^From:\s.+", re.IGNORECASE),
    re.compile(r"^Sent from my ", re.IGNORECASE),
]


def _strip_quoted_reply(body: str) -> str:
    """Remove quoted original and trailing signature; return just the new text."""
    if not body:
        return ""
    normalized = body.replace("\r\n", "\n")
    lines = normalized.split("\n")
    kept: List[str] = []
    for line in lines:
        if any(m.match(line.strip()) for m in _QUOTE_MARKERS):
            break
        kept.append(line)
    try:
        sig_idx = next(i for i, l in enumerate(kept) if l.strip() == "--")
        kept = kept[:sig_idx]
    except StopIteration:
        pass
    return "\n".join(kept).strip()


# ---------------------------------------------------------------------------
# Main ingestion loop
# ---------------------------------------------------------------------------

def ingest_rfi_email_replies() -> dict:
    """Read the RFI reply mailbox and write rfi_responses rows. Returns a stats dict."""
    reply_mailbox = (os.getenv("RFI_REPLY_MAILBOX") or "").strip().lower()
    if not reply_mailbox or "@" not in reply_mailbox:
        logger.info("[rfi-email-ingest] RFI_REPLY_MAILBOX not configured — skipping")
        return {"skipped": "RFI_REPLY_MAILBOX not configured"}

    at = reply_mailbox.index("@")
    local_part = reply_mailbox[:at]
    domain = reply_mailbox[at + 1:]

    since_iso = (datetime.now(timezone.utc) - timedelta(hours=LOOKBACK_HOURS)).isoformat()

    result = list_live_outlook_inbox(
        mailbox_user_id=reply_mailbox,
        since_iso=since_iso,
        limit=100,
    )

    if not result.get("ok"):
        error = result.get("error", "unknown")
        logger.error("[rfi-email-ingest] mailbox read failed: %s", error)
        return {"ok": False, "error": error}

    messages = result.get("messages", [])
    supabase = get_supabase_client()
    ingested = 0
    unmatched = 0

    for msg in messages:
        to_list: List[str] = msg.get("to_list") or []
        cc_list: List[str] = msg.get("cc_list") or []
        body_text: str = msg.get("body_text") or ""
        msg_id: str = msg.get("id") or msg.get("graph_message_id") or ""
        from_name: Optional[str] = msg.get("from_name")
        from_email: Optional[str] = msg.get("from_email")

        token = _extract_reply_token(to_list + cc_list, body_text, local_part, domain)
        if not token:
            unmatched += 1
            continue

        # Resolve token → rfi_id, project_id, recipient info
        token_row = (
            supabase.from_("rfi_response_tokens")
            .select("token, rfi_id, project_id, recipient_name, recipient_email, recipient_person_id, expires_at, revoked_at")
            .eq("token", token)
            .maybe_single()
            .execute()
        )
        row = token_row.data if token_row else None
        if not row:
            unmatched += 1
            continue

        # Expired or revoked
        now_iso = datetime.now(timezone.utc).isoformat()
        if row.get("revoked_at") or (row.get("expires_at") and row["expires_at"] < now_iso):
            unmatched += 1
            continue

        rfi_id = row["rfi_id"]
        project_id = row["project_id"]

        # Don't accept responses to a closed RFI
        rfi_row = (
            supabase.from_("rfis")
            .select("id, status, rfi_manager")
            .eq("id", rfi_id)
            .maybe_single()
            .execute()
        )
        rfi = rfi_row.data if rfi_row else None
        if not rfi or rfi.get("status") in ("closed", "closed-draft"):
            continue

        body = _strip_quoted_reply(body_text)
        if not body:
            continue

        upsert_payload = {
            "rfi_id": rfi_id,
            "project_id": project_id,
            "responder_name": row.get("recipient_name") or from_name,
            "responder_email": row.get("recipient_email") or from_email,
            "responder_person_id": row.get("recipient_person_id"),
            "body": body,
            "source": "email",
            "source_message_id": msg_id,
        }

        insert_result = (
            supabase.from_("rfi_responses")
            .upsert(upsert_payload, on_conflict="source_message_id", ignore_duplicates=True)
            .execute()
        )

        if not insert_result.data:
            # duplicate already ingested
            continue

        ingested += 1

        # Flip ball_in_court back to RFI manager
        rfi_manager = rfi.get("rfi_manager")
        if rfi_manager:
            supabase.from_("rfis").update({"ball_in_court": rfi_manager}).eq("id", rfi_id).execute()

        logger.info(
            "[rfi-email-ingest] ingested response for RFI %s from %s",
            rfi_id,
            row.get("recipient_email") or from_email,
        )

    stats = {"ok": True, "scanned": len(messages), "ingested": ingested, "unmatched": unmatched}
    logger.info("[rfi-email-ingest] %s", stats)
    return stats


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO, stream=sys.stdout)
    result = ingest_rfi_email_replies()
    print(result)
    sys.exit(0 if result.get("ok", True) else 1)
