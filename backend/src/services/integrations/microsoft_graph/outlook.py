"""
Outlook Email Ingestion
Fetches emails from Microsoft Graph API and ingests them into the RAG pipeline.

Filtering strategy:
- Only emails with at least one external recipient (non-company domain)
  OR emails that mention any active project name in subject/body preview
- Skips calendar invites, newsletters, and automated notifications
- Uses delta queries for incremental sync
"""
import base64
import hashlib
import mimetypes
import os
import re
import logging
from datetime import datetime, timezone
from typing import Optional
from urllib.parse import quote

from ...supabase_helpers import (
    SupabaseRagStore,
    as_actionable_outlook_intake_write_error,
    get_outlook_intake_read_client,
    get_outlook_intake_write_client,
    get_rag_write_client,
    storage_upload_with_retry,
)
from .client import get_graph_client
from .email_classification import (
    EmailIntakeAction,
    EmailIntakeClassification,
    classify_graph_email_for_intake,
)
from .user_filter_rules import (
    load_filter_rule_by_id,
    load_active_filter_rules,
    match_user_filter_rule,
    record_rule_match,
)
from .onedrive import SUPPORTED_EXTENSIONS, _extract_text
from .outlook_attribution import find_outlook_project_consensus
from .project_documents import upsert_project_document_by_source as _upsert_project_document_by_source
from .project_inference import (
    begin_project_assignment_batch,
    end_project_assignment_batch,
    infer_assignment_target,
    is_assignable_project_id,
)

logger = logging.getLogger(__name__)

COMPANY_DOMAINS = [d.strip() for d in os.environ.get("COMPANY_EMAIL_DOMAINS", "alleatogroup.com").split(",")]
MIN_BODY_CHARS = 50  # Skip very short emails (auto-replies, etc.)

_NON_PROJECT_PROJECT_CONTEXT_RE = re.compile(
    r"\b("
    r"rfi|submittal|change order|change event|pay app|permit|drawing|schedule|"
    r"job number|cost code|subcontract|sov|owner|architect|site|scope|pricing|"
    r"proposal|contract setup|application|lien release|zoning|invoice entry"
    r")\b",
    re.IGNORECASE,
)
_FINANCE_ADMIN_SENDER_PATTERNS = (
    "capitalone@",
    "forumcu.com",
    "verizonwireless.com",
    "marylandresidentagent.com",
)
_SYSTEM_ADMIN_SENDER_PATTERNS = (
    "quarantine@messaging.microsoft.com",
    "mailer-daemon@",
    "postmaster@",
)
_PERSONAL_CONTEXT_PATTERNS = (
    "adventure thailand",
    "photos are ready",
    "childcare",
)
_BUSINESS_ADMIN_PATTERNS = (
    "shared the folder",
    "employee handbook",
    "unable to assign max trial",
    "check to print",
    "accounting",
    "administration",
)
_FINANCE_ADMIN_PATTERNS = (
    "card statement",
    "credit card",
    "spend limit",
    "verizon bill",
    "payment failure",
    "online transfer",
    "recurring charge",
    "policy #",
    "e-payroll",
    "payroll report",
)


def _normalize_match_text(*parts: object) -> str:
    return " ".join(str(part or "").lower() for part in parts)


def _non_project_category_for_outlook_row(row: dict, body_text: str = "") -> Optional[dict[str, object]]:
    subject = str(row.get("subject") or "")
    sender = str(row.get("from_email") or "").lower()
    combined = _normalize_match_text(subject, body_text, sender, row.get("from_name"))
    has_project_context = bool(_NON_PROJECT_PROJECT_CONTEXT_RE.search(combined))

    if any(pattern in sender for pattern in _SYSTEM_ADMIN_SENDER_PATTERNS):
        return {
            "category": "system_admin",
            "confidence": 0.95,
            "reason": "System-generated mailbox/security notification with no project assignment.",
        }

    if any(pattern in combined for pattern in _PERSONAL_CONTEXT_PATTERNS) and not has_project_context:
        return {
            "category": "personal_admin",
            "confidence": 0.88,
            "reason": "Personal or non-business administrative message with no project context.",
        }

    if any(pattern in sender for pattern in _FINANCE_ADMIN_SENDER_PATTERNS) or (
        any(pattern in combined for pattern in _FINANCE_ADMIN_PATTERNS) and not has_project_context
    ):
        return {
            "category": "finance_admin",
            "confidence": 0.9,
            "reason": "Finance/accounting administrative message with no project assignment.",
        }

    if any(pattern in combined for pattern in _BUSINESS_ADMIN_PATTERNS) and not has_project_context:
        return {
            "category": "business_admin",
            "confidence": 0.86,
            "reason": "Business administrative message with no project context.",
        }

    return None

# ── Noise / spam filter constants ─────────────────────────────────────────────
# Sender address substrings that indicate automated/marketing mail.
_NOISE_SENDER_PATTERNS: tuple[str, ...] = (
    "noreply", "no-reply", "donotreply", "do-not-reply",
    "notifications@", "notification@", "alerts@", "alert@",
    "newsletter@", "news@", "updates@", "update@",
    "marketing@", "promo@", "promotions@", "offers@",
    "mailer@", "bounce@", "campaigns@", "reply@",
    "support@sendgrid", "mail.linkedin.com", "e.linkedin.com",
    "@facebookmail.com", "@twitter.com", "@amazonses.com",
    "@bounce.", "@em.", "@email.", "@mail.", "@news.",
)

# Subject substrings that strongly indicate non-business noise.
_NOISE_SUBJECT_PATTERNS: tuple[str, ...] = (
    "unsubscribe",
    "newsletter",
    "out of office",
    "automatic reply",
    "auto reply",
    "autoreply",
    "delivery status notification",
    "delivery failure",
    "undelivered mail",
    "mailer-daemon",
    "your password",
    "verify your email",
    "confirm your email",
    "email confirmation",
    "account confirmation",
    "welcome to ",
    "thanks for signing up",
    "you've been invited to",
    "you have been invited to",
)

# Subject substrings that indicate marketing / promotional email.
_PROMO_SUBJECT_PATTERNS: tuple[str, ...] = (
    "% off",
    "% discount",
    "free shipping",
    "shop now",
    "buy now",
    "sale ends",
    "limited time",
    "earn points",
    "exclusive deal",
    "special offer",
    "don't miss",
    "act now",
    "last chance",
    "flash sale",
)

# Body preview substrings that confirm noise (only checked when other signals present).
_NOISE_BODY_PATTERNS: tuple[str, ...] = (
    "to unsubscribe",
    "click here to unsubscribe",
    "manage your email preferences",
    "manage your preferences",
    "update your preferences",
    "email preferences",
    "opt out",
    "view in browser",
    "view this email in your browser",
    "you're receiving this because",
    "you received this email because",
    "this email was sent to",
)
EMAIL_BODY_MAX_CHARS = 8000
MAX_ATTACHMENT_BYTES = int(os.environ.get("OUTLOOK_ATTACHMENT_MAX_BYTES", str(50 * 1024 * 1024)))
OUTLOOK_INTAKE_ATTACHMENT_CONTENT_MAX_BYTES = int(os.environ.get(
    "OUTLOOK_INTAKE_ATTACHMENT_CONTENT_MAX_BYTES",
    "0",
))
MAX_ATTACHMENTS_PER_EMAIL = int(os.environ.get("OUTLOOK_MAX_ATTACHMENTS_PER_EMAIL", "25"))
OUTLOOK_ATTACHMENT_LIST_TIMEOUT_SECONDS = int(os.environ.get("OUTLOOK_ATTACHMENT_LIST_TIMEOUT_SECONDS", "15"))
OUTLOOK_SYNC_MAX_MESSAGES_PER_MAILBOX = int(os.environ.get("OUTLOOK_SYNC_MAX_MESSAGES_PER_MAILBOX", "25"))
DOCUMENT_BUCKET = os.environ.get("SUPABASE_DOCUMENTS_BUCKET", "documents")
SYNC_OUTLOOK_INTAKE = os.environ.get("OUTLOOK_SYNC_INTAKE", "true").lower() in {"1", "true", "yes"}
def _outlook_intake_read_client():
    return get_outlook_intake_read_client()


def _outlook_intake_write_client():
    return get_outlook_intake_write_client()
SYNC_OUTLOOK_INTAKE_ATTACHMENTS = os.environ.get("OUTLOOK_SYNC_INTAKE_ATTACHMENTS", "true").lower() in {"1", "true", "yes"}

CID_RE = re.compile(r"(?i)\bcid:([^\"'>\s)]+)")

def _strip_email_html(raw_html: str) -> str:
    text = re.sub(r"(?is)<blockquote.*?</blockquote>", " ", raw_html)
    text = re.sub(r"(?is)<style.*?</style>|<script.*?</script>", " ", text)
    text = re.sub(r"(?i)<br\s*/?>", "\n", text)
    text = re.sub(r"(?i)</p\s*>", "\n", text)
    text = re.sub(r"<[^>]+>", " ", text)
    text = re.sub(r"\r\n?", "\n", text)
    text = re.sub(r"[ \t]+", " ", text)
    return re.sub(r"\n{3,}", "\n\n", text).strip()


def _stable_graph_id(value: str, length: int = 24) -> str:
    return hashlib.sha256(value.encode("utf-8")).hexdigest()[:length]


def _storage_safe_name(name: str) -> str:
    cleaned = re.sub(r"[^A-Za-z0-9._-]+", "_", name or "attachment").strip("._")
    return cleaned[:180] or "attachment"


def _storage_public_url(supabase_client, bucket: str, path: str) -> str:
    try:
        return supabase_client.storage.from_(bucket).get_public_url(path)
    except Exception:
        return path


def _body_html(msg: dict) -> str:
    body = msg.get("body") or {}
    return str(body.get("content") or "")


def _extract_cid_refs(raw_html: str) -> set[str]:
    return {match.strip("<>").lower() for match in CID_RE.findall(raw_html or "") if match}


_DECORATIVE_INLINE_PATTERNS = (
    re.compile(r"^image\d*\.(png|jpe?g|gif|bmp|webp)$", re.IGNORECASE),
    re.compile(r"^outlook-", re.IGNORECASE),
    re.compile(r"^inky-injection-inliner-", re.IGNORECASE),
    re.compile(
        r"^(image|logo|icon|signature|facebook|linkedin|twitter|instagram|youtube)\d*[\W_]*\.(png|jpe?g|gif|bmp|webp|svg)$",
        re.IGNORECASE,
    ),
    re.compile(r"^[\d_-]+\.(png|jpe?g|gif|bmp|webp)$"),
    re.compile(r"^cid:", re.IGNORECASE),
)


def _is_decorative_inline_attachment(attachment_name: str, content_type: str, is_inline: bool) -> bool:
    if not content_type.startswith("image/"):
        return False
    normalized = attachment_name.strip().lower()
    if any(pattern.search(normalized) for pattern in _DECORATIVE_INLINE_PATTERNS):
        return True
    return False


def _strip_quoted_email_history(text: str) -> str:
    quote_markers = [
        r"(?im)^On .+ wrote:\s*$",
        r"(?im)^From:\s+.+$",
        r"(?im)^Sent:\s+.+$",
        r"(?im)^-----Original Message-----\s*$",
        r"(?im)^_{5,}\s*$",
    ]
    cutoff = len(text)
    for pattern in quote_markers:
        match = re.search(pattern, text)
        if match:
            cutoff = min(cutoff, match.start())

    text = text[:cutoff]
    lines = [
        line.strip()
        for line in text.splitlines()
        if line.strip() and not line.lstrip().startswith(">")
    ]
    return re.sub(r"\s+", " ", " ".join(lines)).strip()


def _has_list_unsubscribe_header(msg: dict) -> bool:
    """Return True if the email has a List-Unsubscribe header (newsletter / mailing list)."""
    headers = msg.get("internetMessageHeaders") or []
    return any(
        h.get("name", "").lower() == "list-unsubscribe"
        for h in headers
        if isinstance(h, dict)
    )


def _is_noise_email(msg: dict) -> bool:
    """Return True if this email is noise and should be skipped entirely.

    Noise = newsletters, marketing, auto-replies, delivery failures, and social
    media notifications. These are never worth storing or embedding.

    When this returns True the caller should skip ALL database writes for the
    message (outlook_email_intake, project_emails, document_metadata).
    """
    sender_addr = (msg.get("from", {}).get("emailAddress", {}).get("address", "") or "").lower()
    subject = (msg.get("subject") or "").lower()
    preview = (msg.get("bodyPreview") or "").lower()

    # 1. List-Unsubscribe header is the single most reliable signal.
    if _has_list_unsubscribe_header(msg):
        logger.debug("[Outlook] Skipping noise (List-Unsubscribe): %s", msg.get("subject"))
        return True

    # 2. Sender address matches a known automated/marketing pattern.
    if any(pat in sender_addr for pat in _NOISE_SENDER_PATTERNS):
        logger.debug("[Outlook] Skipping noise (sender pattern '%s'): %s", sender_addr, msg.get("subject"))
        return True

    # 3. Subject clearly indicates noise.
    if any(pat in subject for pat in _NOISE_SUBJECT_PATTERNS):
        logger.debug("[Outlook] Skipping noise (subject pattern): %s", msg.get("subject"))
        return True

    # 4. Subject is promotional AND body confirms it's marketing.
    if any(pat in subject for pat in _PROMO_SUBJECT_PATTERNS):
        if any(pat in preview for pat in _NOISE_BODY_PATTERNS):
            logger.debug("[Outlook] Skipping noise (promo subject + unsubscribe body): %s", msg.get("subject"))
            return True

    # 5. Body preview alone is a strong unsubscribe signal even without subject match.
    #    Require two body signals to avoid false positives on real emails that happen
    #    to mention "unsubscribe" once.
    body_hits = sum(1 for pat in _NOISE_BODY_PATTERNS if pat in preview)
    if body_hits >= 2:
        logger.debug("[Outlook] Skipping noise (multiple body patterns): %s", msg.get("subject"))
        return True

    return False


def _is_relevant_email(msg: dict, project_keywords: list[str]) -> bool:
    """Return True if this email is worth indexing for RAG.

    Assumes _is_noise_email() has already returned False.
    Keeps emails that mention a project keyword OR have an external participant.
    """
    subject = (msg.get("subject") or "").lower()
    preview = (msg.get("bodyPreview") or "").lower()

    # Keep if any project keyword appears in subject or preview
    combined = subject + " " + preview
    if any(kw.lower() in combined for kw in project_keywords):
        return True

    # Keep if has external recipients (communications with owners/subs/clients)
    recipients = msg.get("toRecipients", []) + msg.get("ccRecipients", [])
    for r in recipients:
        addr = r.get("emailAddress", {}).get("address", "")
        domain = addr.split("@")[-1].lower() if "@" in addr else ""
        if domain and domain not in COMPANY_DOMAINS:
            return True

    return False


def _format_email_as_text(msg: dict) -> str:
    """Convert a Graph API message object to plain text for embedding."""
    date_str = msg.get("receivedDateTime", "")
    subject = msg.get("subject", "(no subject)")
    sender = msg.get("from", {}).get("emailAddress", {})
    sender_str = f"{sender.get('name', '')} <{sender.get('address', '')}>"

    to_addrs = [
        f"{r['emailAddress'].get('name', '')} <{r['emailAddress'].get('address', '')}>"
        for r in msg.get("toRecipients", [])
        if r.get("emailAddress")
    ]

    body = msg.get("bodyPreview", "")
    # bodyPreview is 255 chars max — if we have full body, use it
    if msg.get("body", {}).get("content"):
        raw_html = msg["body"]["content"]
        body = _strip_quoted_email_history(_strip_email_html(raw_html))
        body = body[:EMAIL_BODY_MAX_CHARS]  # Cap for embedding

    return f"""Subject: {subject}
Date: {date_str}
From: {sender_str}
To: {", ".join(to_addrs)}

{body}"""


def _message_participants(msg: dict, sender_name: str, sender_addr: str) -> list[str]:
    participants = [f"{sender_name} <{sender_addr}>"] if sender_addr else [sender_name]
    for recipient in msg.get("toRecipients", []) + msg.get("ccRecipients", []):
        email_address = recipient.get("emailAddress", {}) or {}
        name = email_address.get("name", "")
        address = email_address.get("address", "")
        if address:
            participants.append(f"{name} <{address}>".strip())
    return participants


def _attachment_doc_id(message_id: str, attachment_id: str) -> str:
    return f"outlook_attachment_{_stable_graph_id(message_id)}_{_stable_graph_id(attachment_id)}"


def _list_message_attachments(graph, user_id: str, msg: dict, cid_refs: set[str]) -> list[dict]:
    if not msg.get("hasAttachments") and not cid_refs:
        return []

    msg_id = msg.get("id", "")
    if not msg_id:
        return []

    try:
        attachments = graph.get_all_pages(
            f"/users/{user_id}/messages/{msg_id}/attachments",
            params={
                "$top": str(MAX_ATTACHMENTS_PER_EMAIL),
                "$select": "id,name,contentType,size,isInline,lastModifiedDateTime",
            },
            max_pages=1,
            max_items=MAX_ATTACHMENTS_PER_EMAIL,
            timeout=OUTLOOK_ATTACHMENT_LIST_TIMEOUT_SECONDS,
            max_retries=1,
        )
        return attachments[:MAX_ATTACHMENTS_PER_EMAIL]
    except Exception as exc:
        logger.warning("[Outlook] Failed to list attachments for %s: %s", msg_id, exc)
        raise


def _extract_attachment_bytes(attachment: dict) -> Optional[bytes]:
    content_bytes = attachment.get("contentBytes")
    if not content_bytes:
        return None
    try:
        return base64.b64decode(content_bytes)
    except Exception as exc:
        raise ValueError(f"Attachment contentBytes could not be decoded: {exc}") from exc


def _fetch_file_attachment_detail(graph, user_id: str, msg_id: str, attachment_id: str) -> dict:
    encoded_user_id = quote(user_id, safe="@.")
    encoded_msg_id = quote(msg_id, safe="")
    encoded_attachment_id = quote(attachment_id, safe="")
    return graph.get(
        f"/users/{encoded_user_id}/messages/{encoded_msg_id}/attachments/{encoded_attachment_id}",
        params={"$select": "id,name,contentType,size,isInline,contentBytes"},
    )


def _attachment_bytes_for_intake(graph, user_id: str, msg_id: str, attachment: dict) -> Optional[bytes]:
    raw_bytes = _extract_attachment_bytes(attachment)
    if raw_bytes is not None:
        return raw_bytes

    attachment_id = str(attachment.get("id") or "")
    if not attachment_id:
        return None

    detail = _fetch_file_attachment_detail(graph, user_id, msg_id, attachment_id)
    attachment.update(detail)
    return _extract_attachment_bytes(attachment)


def _graph_recipient_emails(msg: dict, key: str) -> list[str] | None:
    recipients = []
    for row in msg.get(key, []) or []:
        address = (row.get("emailAddress") or {}).get("address")
        if address:
            recipients.append(address)
    return recipients or None


def _upsert_outlook_intake_email(
    *,
    supabase_client,
    project_id: Optional[int],
    document_metadata_id: Optional[str],
    msg: dict,
    user_email: str,
    body_text: str,
    sender_name: str,
    sender_addr: str,
    assignment_method: Optional[str],
    assignment_confidence: Optional[float],
    source_metadata: dict,
    business_area_id: Optional[int] = None,
) -> Optional[int]:
    if not SYNC_OUTLOOK_INTAKE:
        return None

    msg_id = str(msg.get("id") or "")
    if not msg_id:
        return None

    project_assignment_status = str(
        ((source_metadata or {}).get("project_assignment") or {}).get("status") or ""
    )
    has_assignment = project_id is not None or business_area_id is not None
    match_status = "matched" if has_assignment else "not_project" if project_assignment_status == "not_project" else "unassigned"
    now_iso = datetime.now(timezone.utc).isoformat()
    payload = {
        "project_id": project_id,
        "document_metadata_id": document_metadata_id,
        "vectorization_status": "pending" if document_metadata_id else "no_document",
        "vectorization_chunk_count": 0,
        "vectorization_error": None,
        "subject": (msg.get("subject") or "(no subject)")[:500],
        "body": body_text[:8000],
        "body_text": body_text[:8000],
        "from_name": sender_name,
        "from_email": sender_addr,
        "to_list": _graph_recipient_emails(msg, "toRecipients"),
        "cc_list": _graph_recipient_emails(msg, "ccRecipients"),
        "status": "Matched" if has_assignment else "Received",
        "match_status": match_status,
        "assignment_method": assignment_method,
        "assignment_confidence": assignment_confidence,
        "received_at": msg.get("receivedDateTime") or datetime.now(timezone.utc).isoformat(),
        "has_attachments": bool(msg.get("hasAttachments")),
        "graph_message_id": msg_id,
        "mailbox_user_id": user_email,
        "web_link": msg.get("webLink"),
        "internet_message_id": msg.get("internetMessageId"),
        "conversation_id": msg.get("conversationId"),
        "source_metadata": source_metadata,
        "last_synced_at": now_iso,
        "deleted_at": None,
        "updated_at": now_iso,
    }

    intake_read = _outlook_intake_read_client()
    intake_write = _outlook_intake_write_client()
    existing = (
        intake_read.from_("outlook_email_intake")
        .select("id")
        .eq("graph_message_id", msg_id)
        .limit(1)
        .execute()
    )
    rows = existing.data or []
    if rows:
        email_id = rows[0]["id"]
        try:
            intake_write.from_("outlook_email_intake").update(payload).eq("id", email_id).execute()
        except Exception as exc:  # noqa: BLE001 - fail loudly on env drift
            raise as_actionable_outlook_intake_write_error(
                exc,
                table_name="outlook_email_intake",
            ) from exc
        return int(email_id)

    try:
        inserted = (
            intake_write.from_("outlook_email_intake")
            .insert({**payload, "created_at": now_iso})
            .execute()
        )
    except Exception as exc:  # noqa: BLE001 - fail loudly on env drift
        raise as_actionable_outlook_intake_write_error(
            exc,
            table_name="outlook_email_intake",
        ) from exc
    inserted_rows = inserted.data or []
    if inserted_rows:
        return int(inserted_rows[0]["id"])

    inserted_lookup = (
        intake_read.from_("outlook_email_intake")
        .select("id")
        .eq("graph_message_id", msg_id)
        .limit(1)
        .execute()
    )
    lookup_rows = inserted_lookup.data or []
    if not lookup_rows:
        raise RuntimeError(f"outlook_email_intake insert for Outlook message {msg_id} returned no row")
    return int(lookup_rows[0]["id"])


def _record_outlook_skip_audit(
    *,
    supabase_client,
    msg: dict,
    user_email: str,
    body_text: str,
    sender_name: str,
    sender_addr: str,
    source_metadata: dict,
) -> None:
    msg_id = str(msg.get("id") or "")
    if not msg_id:
        return

    classification = source_metadata.get("intake_classification") or {}
    now_iso = datetime.now(timezone.utc).isoformat()
    payload = {
        "graph_message_id": msg_id,
        "mailbox_user_id": user_email,
        "internet_message_id": msg.get("internetMessageId"),
        "conversation_id": msg.get("conversationId"),
        "subject": (msg.get("subject") or "(no subject)")[:500],
        "body_preview": body_text[:1000],
        "from_name": sender_name,
        "from_email": sender_addr,
        "received_at": msg.get("receivedDateTime"),
        "web_link": msg.get("webLink"),
        "classification_action": classification.get("action") or "skip",
        "classification_category": classification.get("category") or "unknown",
        "classification_confidence": classification.get("confidence"),
        "classification_reason": classification.get("reason") or "Skipped before import.",
        "classification_signals": classification.get("signals") or [],
        "source_metadata": source_metadata,
        "last_seen_at": now_iso,
    }

    try:
        _outlook_intake_write_client().from_("outlook_email_skip_audit").upsert(
            payload,
            on_conflict="graph_message_id",
        ).execute()
    except Exception as exc:  # noqa: BLE001 - fail loudly on env drift
        raise as_actionable_outlook_intake_write_error(
            exc,
            table_name="outlook_email_skip_audit",
        ) from exc


def _fetch_document_project_id(supabase_client, doc_id: Optional[str]) -> Optional[int]:
    if not doc_id:
        return None
    row = (
        supabase_client.from_("document_metadata")
        .select("project_id")
        .eq("id", doc_id)
        .limit(1)
        .execute()
        .data
        or []
    )
    if not row or row[0].get("project_id") is None:
        return None
    return int(row[0]["project_id"])


def _reconcile_outlook_project_assignment(
    *,
    supabase_client,
    msg_id: str,
    document_metadata_id: Optional[str],
    intake_email_id: Optional[int],
    inferred_project_id: Optional[int],
    assignment_method: Optional[str],
    assignment_confidence: Optional[float],
) -> Optional[int]:
    """Keep the canonical Outlook intake row aligned to document_metadata.

    The document row is the canonical source because database triggers, manual
    attribution review, and compiler corrections all converge there. Graph sync
    no longer mirrors new Outlook messages into legacy project_emails rows.
    """

    canonical_project_id = _fetch_document_project_id(supabase_client, document_metadata_id)
    if canonical_project_id is None:
        canonical_project_id = int(inferred_project_id) if inferred_project_id else None
    if canonical_project_id is None:
        return None

    sync_method = assignment_method or "project_inference"
    sync_confidence = assignment_confidence if assignment_confidence is not None else 0.0
    if inferred_project_id and int(inferred_project_id) != int(canonical_project_id):
        sync_method = "document_metadata_reconcile"
        sync_confidence = 1.0

    now_iso = datetime.now(timezone.utc).isoformat()
    intake_update = {
        "project_id": canonical_project_id,
        "match_status": "matched",
        "status": "Matched",
        "assignment_method": sync_method,
        "assignment_confidence": sync_confidence,
        "updated_at": now_iso,
    }
    if document_metadata_id:
        intake_update["document_metadata_id"] = document_metadata_id

    intake_write = _outlook_intake_write_client()
    try:
        if intake_email_id:
            intake_write.from_("outlook_email_intake").update(intake_update).eq("id", intake_email_id).execute()
        elif msg_id:
            intake_write.from_("outlook_email_intake").update(intake_update).eq("graph_message_id", msg_id).execute()
    except Exception as exc:  # noqa: BLE001 - fail loudly on env drift
        raise as_actionable_outlook_intake_write_error(
            exc,
            table_name="outlook_email_intake",
        ) from exc

    return canonical_project_id


def _participants_for_intake_row(row: dict) -> list[str]:
    participants: list[str] = []
    from_email = row.get("from_email")
    from_name = row.get("from_name")
    if from_email:
        participants.append(f"{from_name or ''} <{from_email}>".strip())

    for key in ("to_list", "cc_list", "bcc_list"):
        value = row.get(key)
        if isinstance(value, list):
            participants.extend(str(item) for item in value if item)
    return participants


def _business_area_id_from_source_metadata(source_metadata: dict) -> Optional[int]:
    assignment = (source_metadata or {}).get("project_assignment")
    if not isinstance(assignment, dict):
        return None
    if (
        assignment.get("status") != "assigned"
        or assignment.get("target_type") != "business_area"
    ):
        return None
    raw_business_area_id = assignment.get("business_area_id")
    if raw_business_area_id is None:
        raise ValueError(
            "Assigned Business Area metadata is missing business_area_id"
        )
    try:
        business_area_id = int(raw_business_area_id)
    except (TypeError, ValueError) as exc:
        raise ValueError(
            "Assigned Business Area metadata has an invalid business_area_id"
        ) from exc
    if business_area_id <= 0:
        raise ValueError(
            "Assigned Business Area metadata requires a positive business_area_id"
        )
    return business_area_id


def _apply_since_filter(query, since: Optional[str]):
    if since:
        return query.gte("received_at", since)
    return query


def backfill_outlook_intake_project_assignments(
    supabase_client,
    *,
    mailbox_user_id: Optional[str] = None,
    limit: int = 100,
    min_confidence: Optional[float] = None,
    since: Optional[str] = None,
) -> dict[str, object]:
    """Normalize older Outlook intake rows that predate synchronous assignment.

    New syncs assign before RAG intake. This bounded backfill lets us repair
    historical `project_assignment.status=deferred` rows without a destructive
    full-table rewrite.
    """

    resolved_limit = max(1, min(int(limit or 100), 500))
    threshold = (
        float(min_confidence)
        if min_confidence is not None
        else float(os.environ.get("OUTLOOK_PROJECT_BACKFILL_MIN_CONFIDENCE", "0.70"))
    )

    query = (
        _outlook_intake_read_client()
        .from_("outlook_email_intake")
        .select(
            "id,subject,body,body_text,from_name,from_email,to_list,cc_list,bcc_list,"
            "project_id,document_metadata_id,source_metadata,received_at,graph_message_id,"
            "assignment_method,assignment_confidence"
        )
        .order("received_at", desc=True)
        .limit(resolved_limit)
    )
    if mailbox_user_id:
        query = query.eq("mailbox_user_id", mailbox_user_id)
    query = _apply_since_filter(query, since)

    rows = query.execute().data or []
    write_client = _outlook_intake_write_client()
    rag_write = get_rag_write_client()
    stats: dict[str, object] = {
        "scanned": 0,
        "assigned": 0,
        "normalized_existing": 0,
        "not_project": 0,
        "review_needed": 0,
        "failed": 0,
        "errors": [],
    }

    for row in rows:
        stats["scanned"] = int(stats["scanned"]) + 1
        row_id = row.get("id")
        source_metadata = dict(row.get("source_metadata") or {})
        try:
            now_iso = datetime.now(timezone.utc).isoformat()
            existing_project_id = row.get("project_id")
            existing_business_area_id = _business_area_id_from_source_metadata(
                source_metadata
            )
            if (
                existing_project_id is not None
                and existing_business_area_id is not None
            ):
                raise ValueError(
                    "Outlook intake assignment cannot contain both project_id and business_area_id"
                )
            if existing_project_id is not None or existing_business_area_id is not None:
                project_id = (
                    int(existing_project_id)
                    if existing_project_id is not None
                    else None
                )
                business_area_id = existing_business_area_id
                method = row.get("assignment_method") or "existing_project"
                confidence = (
                    float(row.get("assignment_confidence"))
                    if row.get("assignment_confidence") is not None
                    else 1.0
                )
                assignment_metadata = {
                    "status": "assigned",
                    "target_type": (
                        "business_area"
                        if business_area_id is not None
                        else "project"
                    ),
                    "method": method,
                    "confidence": confidence,
                    "backfilled_at": now_iso,
                }
                if business_area_id is not None:
                    assignment_metadata["business_area_id"] = business_area_id
                source_metadata["project_assignment"] = assignment_metadata
                update_payload = {
                    "project_id": project_id,
                    "match_status": "matched",
                    "status": "Matched",
                    "assignment_method": method,
                    "assignment_confidence": confidence,
                    "source_metadata": source_metadata,
                    "updated_at": now_iso,
                }
                document_metadata_id = row.get("document_metadata_id")
                if document_metadata_id:
                    try:
                        supabase_client.from_("document_metadata").update(
                            {
                                "project_id": project_id,
                                "business_area_id": business_area_id,
                            }
                        ).eq("id", document_metadata_id).execute()
                    except Exception as exc:  # noqa: BLE001 - split DB may not have app row
                        logger.warning("[Outlook] App document_metadata existing-assignment normalization failed for %s: %s", document_metadata_id, exc)
                    try:
                        rag_write.from_("rag_document_metadata").update(
                            {
                                "project_id": project_id,
                                "source_metadata": {
                                    **source_metadata,
                                    "project_assignment": assignment_metadata,
                                },
                            }
                        ).eq("id", document_metadata_id).execute()
                    except Exception as exc:  # noqa: BLE001 - do not fail intake normalization on RAG metadata drift
                        logger.warning("[Outlook] RAG metadata existing-project normalization failed for %s: %s", document_metadata_id, exc)
                write_client.from_("outlook_email_intake").update(update_payload).eq("id", row_id).execute()
                stats["assigned"] = int(stats["assigned"]) + 1
                stats["normalized_existing"] = int(stats["normalized_existing"]) + 1
                continue

            body_text = str(row.get("body_text") or row.get("body") or "")
            assignment_target = infer_assignment_target(
                supabase_client,
                title=str(row.get("subject") or ""),
                content=body_text,
                participants=_participants_for_intake_row(row),
                existing_project_id=None,
            )
            project_id = assignment_target.project_id
            business_area_id = assignment_target.business_area_id
            method = assignment_target.method
            confidence = assignment_target.confidence
            has_assignment = (
                project_id is not None or business_area_id is not None
            ) and confidence >= threshold
            non_project_category = None
            if not has_assignment:
                non_project_category = _non_project_category_for_outlook_row(row, body_text)
            assignment_metadata = {
                "status": (
                    "assigned"
                    if has_assignment
                    else "not_project"
                    if non_project_category
                    else "review_needed"
                ),
                "method": method,
                "confidence": confidence,
                "backfilled_at": now_iso,
            }
            if has_assignment:
                assignment_metadata["target_type"] = (
                    "business_area"
                    if business_area_id is not None
                    else "project"
                )
            if business_area_id is not None:
                assignment_metadata["business_area_id"] = business_area_id
                assignment_metadata["legacy_project_id"] = (
                    assignment_target.legacy_project_id
                )
            if non_project_category:
                assignment_metadata.update(non_project_category)
            source_metadata["project_assignment"] = assignment_metadata

            update_payload = {
                "assignment_method": method,
                "assignment_confidence": confidence,
                "source_metadata": source_metadata,
                "updated_at": now_iso,
            }
            if has_assignment:
                project_id = int(project_id) if project_id is not None else None
                business_area_id = (
                    int(business_area_id)
                    if business_area_id is not None
                    else None
                )
                update_payload.update(
                    {
                        "project_id": project_id,
                        "match_status": "matched",
                        "status": "Matched",
                    }
                )
                document_metadata_id = row.get("document_metadata_id")
                if document_metadata_id:
                    try:
                        supabase_client.from_("document_metadata").update(
                            {
                                "project_id": project_id,
                                "business_area_id": business_area_id,
                            }
                        ).eq("id", document_metadata_id).execute()
                    except Exception as exc:  # noqa: BLE001 - split DB may not have app row
                        logger.warning("[Outlook] App document_metadata project backfill failed for %s: %s", document_metadata_id, exc)
                    try:
                        rag_write.from_("rag_document_metadata").update(
                            {
                                "project_id": project_id,
                                "source_metadata": {
                                    **source_metadata,
                                    "project_assignment": assignment_metadata,
                                },
                            }
                        ).eq("id", document_metadata_id).execute()
                    except Exception as exc:  # noqa: BLE001 - do not fail intake normalization on RAG metadata drift
                        logger.warning("[Outlook] RAG metadata project backfill failed for %s: %s", document_metadata_id, exc)
                stats["assigned"] = int(stats["assigned"]) + 1
            else:
                if non_project_category:
                    update_payload.update(
                        {
                            "match_status": "not_project",
                            "status": "Received",
                            "assignment_method": f"non_project:{non_project_category['category']}",
                            "assignment_confidence": non_project_category["confidence"],
                        }
                    )
                    stats["not_project"] = int(stats["not_project"]) + 1
                else:
                    update_payload.update({"match_status": "unassigned", "status": "Received"})
                    stats["review_needed"] = int(stats["review_needed"]) + 1

            write_client.from_("outlook_email_intake").update(update_payload).eq("id", row_id).execute()
        except Exception as exc:  # noqa: BLE001 - continue bounded repair and report failures
            stats["failed"] = int(stats["failed"]) + 1
            errors = stats["errors"]
            assert isinstance(errors, list)
            errors.append({"id": row_id, "error": str(exc)[:500]})

    return stats


def apply_outlook_filter_rule_to_intake(
    supabase_client,
    *,
    rule_id: str,
    mailbox_user_id: Optional[str] = None,
    limit: int = 500,
    since: Optional[str] = None,
) -> dict[str, object]:
    """Apply one learned `not_project` rule to stored Outlook intake rows.

    This is intentionally bounded and non-destructive: it only updates rows
    without a project or Business Area assignment, so a learned admin rule
    cannot erase an existing scope.
    """

    resolved_limit = max(1, min(int(limit or 500), 5000))
    rule = load_filter_rule_by_id(supabase_client, rule_id)
    stats: dict[str, object] = {
        "rule_id": rule_id,
        "status": "applied" if rule else "missing_rule",
        "scanned": 0,
        "matched": 0,
        "updated": 0,
        "skipped_existing_project": 0,
        "failed": 0,
        "errors": [],
    }
    if rule is None:
        return stats
    if rule.action != "not_project":
        stats["status"] = "unsupported_rule_action"
        stats["rule_action"] = rule.action
        return stats

    query = (
        _outlook_intake_read_client()
        .from_("outlook_email_intake")
        .select(
            "id,subject,body,body_text,from_name,from_email,project_id,document_metadata_id,"
            "source_metadata,received_at,graph_message_id,mailbox_user_id"
        )
        .order("received_at", desc=True)
        .limit(resolved_limit)
    )
    if mailbox_user_id:
        query = query.eq("mailbox_user_id", mailbox_user_id)
    query = _apply_since_filter(query, since)

    rows = query.execute().data or []
    write_client = _outlook_intake_write_client()
    rag_write = get_rag_write_client()

    for row in rows:
        stats["scanned"] = int(stats["scanned"]) + 1
        row_id = row.get("id")
        try:
            source_metadata = dict(row.get("source_metadata") or {})
            existing_business_area_id = _business_area_id_from_source_metadata(
                source_metadata
            )
            if (
                row.get("project_id") is not None
                or existing_business_area_id is not None
            ):
                stats["skipped_existing_project"] = int(stats["skipped_existing_project"]) + 1
                continue

            msg = {
                "id": row.get("graph_message_id"),
                "subject": row.get("subject") or "",
                "bodyPreview": row.get("body_text") or row.get("body") or "",
                "from": {
                    "emailAddress": {
                        "name": row.get("from_name") or "",
                        "address": row.get("from_email") or "",
                    }
                },
            }
            if match_user_filter_rule(msg, [rule]) is None:
                continue

            stats["matched"] = int(stats["matched"]) + 1
            now_iso = datetime.now(timezone.utc).isoformat()
            source_metadata["user_filter_rule"] = {
                "rule_id": rule.id,
                "label": rule.label,
                "action": rule.action,
                "applied_by": "apply_outlook_filter_rule_to_intake",
                "applied_at": now_iso,
            }
            assignment_metadata = {
                "status": "not_project",
                "method": "non_project:user_filter_rule",
                "confidence": 1.0,
                "category": "learned_rule",
                "reason": "User-trained filter rule marked this imported email as non-project.",
                "rule_id": rule.id,
                "assigned_at": now_iso,
            }
            source_metadata["project_assignment"] = assignment_metadata
            update_payload = {
                "match_status": "not_project",
                "status": "Received",
                "assignment_method": "non_project:user_filter_rule",
                "assignment_confidence": 1.0,
                "source_metadata": source_metadata,
                "updated_at": now_iso,
            }
            write_client.from_("outlook_email_intake").update(update_payload).eq("id", row_id).execute()

            document_metadata_id = row.get("document_metadata_id")
            if document_metadata_id:
                try:
                    rag_write.from_("rag_document_metadata").update(
                        {
                            "source_metadata": {
                                **source_metadata,
                                "project_assignment": assignment_metadata,
                            }
                        }
                    ).eq("id", document_metadata_id).execute()
                except Exception as exc:  # noqa: BLE001 - replay result still captures intake update
                    logger.warning("[Outlook] RAG metadata learned-rule update failed for %s: %s", document_metadata_id, exc)

            record_rule_match(supabase_client, rule.id)
            stats["updated"] = int(stats["updated"]) + 1
        except Exception as exc:  # noqa: BLE001 - continue bounded replay and report failures
            stats["failed"] = int(stats["failed"]) + 1
            errors = stats["errors"]
            assert isinstance(errors, list)
            errors.append({"id": row_id, "error": str(exc)[:500]})

    return stats


def _vectorization_status_from_metadata(
    *,
    document_metadata_id: Optional[str],
    embedding_status: Optional[str],
    embedded_chunk_count: int,
) -> tuple[str, Optional[str]]:
    if not document_metadata_id:
        return "no_document", "No RAG document_metadata_id is linked to this intake row."
    if embedded_chunk_count > 0:
        return "embedded", None

    normalized = str(embedding_status or "").strip().lower()
    if normalized in {"skipped", "intentionally_excluded"}:
        return "skipped", None
    if normalized in {"failed", "failed_permanent", "error"}:
        return "failed", f"RAG metadata embedding_status={normalized}"
    if normalized in {"review_needed", "project_assignment_review"}:
        return "review_needed", None
    return "pending", None


def refresh_outlook_intake_vectorization_statuses(
    *,
    mailbox_user_id: Optional[str] = None,
    limit: int = 100,
    since: Optional[str] = None,
) -> dict[str, object]:
    """Project RAG chunk/vectorization state onto Outlook intake rows."""

    resolved_limit = max(1, min(int(limit or 100), 500))
    read_client = _outlook_intake_read_client()
    write_client = _outlook_intake_write_client()
    rag_read = get_outlook_intake_read_client()

    query = (
        read_client.from_("outlook_email_intake")
        .select("id,document_metadata_id,source_metadata,received_at")
        .order("received_at", desc=True)
        .limit(resolved_limit)
    )
    if mailbox_user_id:
        query = query.eq("mailbox_user_id", mailbox_user_id)
    query = _apply_since_filter(query, since)

    rows = query.execute().data or []
    stats: dict[str, object] = {
        "scanned": 0,
        "updated": 0,
        "failed": 0,
        "statuses": {},
        "errors": [],
    }

    for row in rows:
        stats["scanned"] = int(stats["scanned"]) + 1
        row_id = row.get("id")
        doc_id = row.get("document_metadata_id")
        try:
            embedding_status: Optional[str] = None
            embedded_chunk_count = 0
            if doc_id:
                meta_rows = (
                    rag_read.from_("rag_document_metadata")
                    .select("embedding_status")
                    .eq("id", doc_id)
                    .limit(1)
                    .execute()
                    .data
                    or []
                )
                if meta_rows:
                    embedding_status = meta_rows[0].get("embedding_status")
                chunk_rows = (
                    rag_read.from_("document_chunks")
                    .select("chunk_id,embedding")
                    .eq("document_id", doc_id)
                    .limit(1000)
                    .execute()
                    .data
                    or []
                )
                embedded_chunk_count = sum(1 for chunk in chunk_rows if chunk.get("embedding") is not None)

            status, error = _vectorization_status_from_metadata(
                document_metadata_id=str(doc_id) if doc_id else None,
                embedding_status=embedding_status,
                embedded_chunk_count=embedded_chunk_count,
            )
            source_metadata = dict(row.get("source_metadata") or {})
            source_metadata["vectorization"] = {
                "status": status,
                "chunk_count": embedded_chunk_count,
                "embedding_status": embedding_status,
                "checked_at": datetime.now(timezone.utc).isoformat(),
            }
            if error:
                source_metadata["vectorization"]["error"] = error

            write_client.from_("outlook_email_intake").update(
                {
                    "vectorization_status": status,
                    "vectorization_checked_at": datetime.now(timezone.utc).isoformat(),
                    "vectorization_chunk_count": embedded_chunk_count,
                    "vectorization_error": error,
                    "source_metadata": source_metadata,
                    "updated_at": datetime.now(timezone.utc).isoformat(),
                }
            ).eq("id", row_id).execute()
            stats["updated"] = int(stats["updated"]) + 1
            statuses = stats["statuses"]
            assert isinstance(statuses, dict)
            statuses[status] = int(statuses.get(status, 0)) + 1
        except Exception as exc:  # noqa: BLE001 - report row failures and continue
            stats["failed"] = int(stats["failed"]) + 1
            errors = stats["errors"]
            assert isinstance(errors, list)
            errors.append({"id": row_id, "error": str(exc)[:500]})

    return stats


def backfill_outlook_intake_rag_documents(
    supabase_client,
    *,
    mailbox_user_id: Optional[str] = None,
    limit: int = 100,
    since: Optional[str] = None,
) -> dict[str, object]:
    """Create missing RAG document rows for imported Outlook intake emails."""

    resolved_limit = max(1, min(int(limit or 100), 500))
    query = (
        _outlook_intake_read_client()
        .from_("outlook_email_intake")
        .select(
            "id,graph_message_id,mailbox_user_id,subject,body,body_text,from_name,from_email,"
            "to_list,cc_list,project_id,assignment_method,received_at,web_link,document_metadata_id,source_metadata"
        )
        .is_("document_metadata_id", "null")
        .order("received_at", desc=True)
        .limit(resolved_limit)
    )
    if mailbox_user_id:
        query = query.eq("mailbox_user_id", mailbox_user_id)
    query = _apply_since_filter(query, since)

    rows = query.execute().data or []
    write_client = _outlook_intake_write_client()
    store = SupabaseRagStore(supabase_client)
    stats: dict[str, object] = {
        "scanned": 0,
        "created": 0,
        "skipped": 0,
        "failed": 0,
        "errors": [],
    }

    for row in rows:
        stats["scanned"] = int(stats["scanned"]) + 1
        row_id = row.get("id")
        body_text = str(row.get("body_text") or row.get("body") or "")
        if len(body_text) < MIN_BODY_CHARS:
            stats["skipped"] = int(stats["skipped"]) + 1
            continue

        try:
            msg_id = str(row.get("graph_message_id") or f"intake_{row_id}")
            doc_id = f"outlook_{msg_id}"
            user_email = str(row.get("mailbox_user_id") or mailbox_user_id or "unknown")
            subject = str(row.get("subject") or "(no subject)")
            source_metadata = dict(row.get("source_metadata") or {})
            source_metadata["rag_document_backfill"] = {
                "status": "created",
                "created_at": datetime.now(timezone.utc).isoformat(),
                "intake_email_id": row_id,
            }
            participants = _participants_for_intake_row(row)
            tags = ["email", "outlook", "intake_backfill"]
            project_id = row.get("project_id")
            business_area_id = _business_area_id_from_source_metadata(
                source_metadata
            )
            if project_id is not None and business_area_id is not None:
                raise ValueError(
                    "Outlook intake assignment cannot contain both project_id and business_area_id"
                )
            assignment_method = row.get("assignment_method") or "unassigned"
            if project_id:
                tags.append(f"project_auto:{assignment_method}")
            if business_area_id is not None:
                tags.append(f"business_area_auto:{assignment_method}")

            store.upsert_document_metadata(
                {
                    "id": doc_id,
                    "title": f"Email: {subject}",
                    "source": "microsoft_graph",
                    "category": "email",
                    "type": "email",
                    "content": body_text,
                    "date": str(row.get("received_at") or "")[:10] or None,
                    "participants": ", ".join(participants[:50]),
                    "status": "raw_ingested",
                    "tags": ",".join(tags),
                    "project_id": int(project_id) if project_id else None,
                    "business_area_id": business_area_id,
                    "url": row.get("web_link"),
                    "source_system": "outlook_email",
                    "source_item_id": msg_id,
                    "source_path": f"outlook/{user_email}/{msg_id}.txt",
                    "source_web_url": row.get("web_link"),
                    "storage_bucket": DOCUMENT_BUCKET,
                    "file_path": f"outlook/{user_email}/{msg_id}.txt",
                    "source_metadata": source_metadata,
                }
            )
            write_client.from_("outlook_email_intake").update(
                {
                    "document_metadata_id": doc_id,
                    "vectorization_status": "pending",
                    "vectorization_checked_at": datetime.now(timezone.utc).isoformat(),
                    "vectorization_chunk_count": 0,
                    "vectorization_error": None,
                    "source_metadata": source_metadata,
                    "updated_at": datetime.now(timezone.utc).isoformat(),
                }
            ).eq("id", row_id).execute()
            stats["created"] = int(stats["created"]) + 1
        except Exception as exc:  # noqa: BLE001 - keep bounded backfill inspectable
            stats["failed"] = int(stats["failed"]) + 1
            errors = stats["errors"]
            assert isinstance(errors, list)
            errors.append({"id": row_id, "error": str(exc)[:500]})

    return stats


def _upsert_outlook_intake_attachment(
    *,
    supabase_client,
    graph,
    user_id: str,
    msg_id: str,
    intake_email_id: int,
    attachment: dict,
) -> bool:
    attachment_type = str(attachment.get("@odata.type") or attachment.get("odata.type") or "")
    attachment_id = str(attachment.get("id") or "")
    attachment_name = str(attachment.get("name") or "attachment")
    content_type = str(attachment.get("contentType") or mimetypes.guess_type(attachment_name)[0] or "application/octet-stream")
    is_inline = bool(attachment.get("isInline"))
    size = int(attachment.get("size") or 0)

    if not attachment_id:
        logger.warning("[Outlook] Intake attachment without id on %s was skipped", msg_id)
        return False
    if "fileAttachment" not in attachment_type:
        logger.info("[Outlook] Intake skipped non-file attachment %s on %s", attachment_id, msg_id)
        return False
    if size > MAX_ATTACHMENT_BYTES:
        raise ValueError(f"Attachment {attachment_name} exceeds OUTLOOK_ATTACHMENT_MAX_BYTES ({size} bytes)")
    if _is_decorative_inline_attachment(attachment_name, content_type, is_inline):
        return False

    capture_content = size <= OUTLOOK_INTAKE_ATTACHMENT_CONTENT_MAX_BYTES
    raw_bytes: Optional[bytes] = None
    checksum: Optional[str] = None
    if capture_content:
        raw_bytes = _attachment_bytes_for_intake(graph, user_id, msg_id, attachment)
        if not raw_bytes:
            return False
        checksum = hashlib.sha256(raw_bytes).hexdigest()

    payload = {
        "intake_email_id": intake_email_id,
        "file_name": attachment_name,
        "file_url": f"graph://messages/{msg_id}/attachments/{attachment_id}",
        "file_size": len(raw_bytes) if raw_bytes is not None else size,
        "content_type": content_type,
        "graph_attachment_id": attachment_id,
        "checksum_sha256": checksum,
        "is_inline": is_inline,
        "source_metadata": {
            "outlook_attachment_type": attachment_type,
            "outlook_message_id": msg_id,
            "content_capture_status": "captured" if capture_content else "skipped_large_attachment",
            "content_capture_limit_bytes": OUTLOOK_INTAKE_ATTACHMENT_CONTENT_MAX_BYTES,
        },
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }
    if raw_bytes is not None:
        payload["content"] = "\\x" + raw_bytes.hex()

    intake_read = _outlook_intake_read_client()
    intake_write = _outlook_intake_write_client()
    existing = (
        intake_read.from_("outlook_email_intake_attachments")
        .select("id")
        .eq("intake_email_id", intake_email_id)
        .eq("graph_attachment_id", attachment_id)
        .limit(1)
        .execute()
    )
    rows = existing.data or []
    if rows:
        try:
            intake_write.from_("outlook_email_intake_attachments").update(payload).eq("id", rows[0]["id"]).execute()
        except Exception as exc:  # noqa: BLE001 - fail loudly on env drift
            raise as_actionable_outlook_intake_write_error(
                exc,
                table_name="outlook_email_intake_attachments",
            ) from exc
    else:
        try:
            intake_write.from_("outlook_email_intake_attachments").insert(payload).execute()
        except Exception as exc:  # noqa: BLE001 - fail loudly on env drift
            raise as_actionable_outlook_intake_write_error(
                exc,
                table_name="outlook_email_intake_attachments",
            ) from exc
    return True


def _attachment_metadata_text(
    *,
    subject: str,
    sender_name: str,
    sender_addr: str,
    attachment_name: str,
    attachment: dict,
    email_doc_id: str,
    email_web_link: str,
) -> str:
    lines = [
        f"Email attachment: {attachment_name}",
        f"Email subject: {subject}",
        f"From: {sender_name} <{sender_addr}>",
        f"Source email document: {email_doc_id}",
    ]
    if email_web_link:
        lines.append(f"Outlook link: {email_web_link}")
    lines.extend(
        [
            f"Content type: {attachment.get('contentType') or 'unknown'}",
            f"Attachment id: {attachment.get('id') or ''}",
        ]
    )
    return "\n".join(lines)


def parse_outlook_delta_cursor(delta_token: Optional[str]) -> Optional[dict[str, str]]:
    """Parse a stored Outlook delta cursor into its per-folder tokens.

    Returns ``{"inbox": <token>, "sent": <token>}`` for a well-formed canonical
    cursor, or ``None`` for any legacy/retired/malformed value. A ``None`` result
    is the signal that the caller must fall back to a full resync rather than pass
    a poisoned cursor to Graph. Kept as the single source of truth for the cursor
    contract so validation and self-healing never drift apart.
    """
    if not delta_token:
        return None
    cursor_parts = dict(part.split(":", 1) for part in delta_token.split("|") if ":" in part)
    inbox_token = cursor_parts.get("inbox")
    sent_token = cursor_parts.get("sent")
    if not inbox_token or not sent_token or set(cursor_parts) != {"inbox", "sent"}:
        return None
    return {"inbox": inbox_token, "sent": sent_token}


def is_canonical_outlook_delta_cursor(delta_token: Optional[str]) -> bool:
    """Return whether a stored delta cursor is in the canonical folder-scoped format."""
    return parse_outlook_delta_cursor(delta_token) is not None


def _sync_outlook_emails_in_batch(
    supabase_client,
    user_email: str,
    project_keywords: list[str],
    graph,
    delta_token: Optional[str] = None,
    since_date: Optional[str] = None,
) -> tuple[int, str]:
    """
    Sync emails for a user. Returns (count_synced, new_delta_token).

    Args:
        supabase_client: Supabase service client
        user_email: The user's email address (e.g. "brandon@alleatogroup.com")
        project_keywords: List of project names/keywords to filter emails by
        delta_token: Previous delta token (None for initial full sync)
        since_date: ISO date string (e.g. "2024-01-01") — only applied on initial full sync
    """
    user_id = user_email  # Graph accepts email as user identifier

    # Delta query for Inbox/SentItems messages
    # Note: /users/{id}/messages/delta is NOT supported in v1.0 — must use folder-specific delta
    select_fields = ",".join([
        "id",
        "subject",
        "from",
        "toRecipients",
        "ccRecipients",
        "receivedDateTime",
        "bodyPreview",
        "body",
        "categories",
        "importance",
        "hasAttachments",
        "webLink",
        "internetMessageId",
        "conversationId",
        "internetMessageHeaders",  # Used for List-Unsubscribe noise detection
    ])
    date_filter = f"&$filter=receivedDateTime ge {since_date}T00:00:00Z" if since_date else ""
    folder_item_limit = max(
        1,
        int(OUTLOOK_SYNC_MAX_MESSAGES_PER_MAILBOX or 25),
    )
    folders = [
        (
            "Inbox",
            f"/users/{user_id}/mailFolders/Inbox/messages/delta?"
            f"$select={select_fields}&$top={folder_item_limit}{date_filter}",
        ),
        (
            "SentItems",
            f"/users/{user_id}/mailFolders/SentItems/messages/delta?"
            f"$select={select_fields}&$top={folder_item_limit}{date_filter}",
        ),
    ]

    # Canonical cursors retain an independent position for both folders.
    inbox_token: Optional[str] = None
    sent_token: Optional[str] = None
    if delta_token:
        cursor_parts = parse_outlook_delta_cursor(delta_token)
        if cursor_parts is None:
            raise ValueError(
                "Outlook delta cursor must use the canonical 'inbox:<token>|sent:<token>' format. "
                "Reset the scoped cursor before retrying sync."
            )
        inbox_token = cursor_parts["inbox"]
        sent_token = cursor_parts["sent"]

    items = []
    new_inbox_token = inbox_token or ""
    new_sent_token = sent_token or ""
    folder_errors: list[str] = []

    for folder_name, base_path in folders:
        folder_token = inbox_token if folder_name == "Inbox" else sent_token
        try:
            folder_batch = graph.get_delta_batch(
                base_path,
                folder_token,
                max_pages=1,
                max_items=folder_item_limit,
            )
            folder_items = folder_batch.items
            folder_delta = folder_batch.next_cursor
            items.extend(folder_items)
            if folder_name == "Inbox":
                new_inbox_token = folder_delta
            else:
                new_sent_token = folder_delta
            logger.info(
                "[Outlook] %s: fetched %d items for %s "
                "(inventory_complete=%s)",
                folder_name,
                len(folder_items),
                user_email,
                folder_batch.complete,
            )
        except Exception as e:
            message = str(e)
            status_code = getattr(getattr(e, "response", None), "status_code", None)
            token_recovery_error = status_code in {400, 410} or "400 Bad Request" in message or "410 Gone" in message
            if folder_token and token_recovery_error:
                logger.warning(
                    "[Outlook] %s delta token failed for %s; retrying full folder delta.",
                    folder_name,
                    user_email,
                )
                try:
                    folder_batch = graph.get_delta_batch(
                        base_path,
                        None,
                        max_pages=1,
                        max_items=folder_item_limit,
                    )
                    folder_items = folder_batch.items
                    folder_delta = folder_batch.next_cursor
                    items.extend(folder_items)
                    if folder_name == "Inbox":
                        new_inbox_token = folder_delta
                    else:
                        new_sent_token = folder_delta
                    logger.info(
                        "[Outlook] %s: recovered and fetched %d items for %s",
                        folder_name,
                        len(folder_items),
                        user_email,
                    )
                    continue
                except Exception as retry_error:
                    folder_errors.append(
                        f"{folder_name} full delta recovery failed: {retry_error}"
                    )
                    logger.error(
                        "[Outlook] %s full delta recovery failed for %s: %s",
                        folder_name,
                        user_email,
                        retry_error,
                    )
            else:
                folder_errors.append(f"{folder_name} delta failed: {e}")
                logger.error(f"[Outlook] {folder_name} delta failed for {user_email}: {e}")

    if folder_errors:
        raise RuntimeError(
            "Outlook folder enumeration failed; refusing to persist a partial "
            f"mailbox cursor for {user_email}: {'; '.join(folder_errors)}"
        )

    new_delta_token = f"inbox:{new_inbox_token}|sent:{new_sent_token}" if (new_inbox_token or new_sent_token) else ""

    # Load user-trained filter rules once per sync run. These are applied as
    # Gate 1.5 between the hand-coded noise filter and the heuristic classifier.
    user_filter_rules = load_active_filter_rules(supabase_client)
    synced = 0
    item_errors: list[str] = []
    for msg in items:
        # Skip deleted items (delta returns removed items with @removed)
        if "@removed" in msg:
            continue

        body_text = _format_email_as_text(msg)
        msg_id = msg.get("id", "")
        if not msg_id:
            continue

        subject = msg.get("subject", "(no subject)")
        received = msg.get("receivedDateTime", datetime.now(timezone.utc).isoformat())
        sender = msg.get("from", {}).get("emailAddress", {}) or {}
        sender_name = sender.get("name", user_email)
        sender_addr = sender.get("address", "")
        email_web_link = msg.get("webLink", "")
        raw_html = _body_html(msg)
        cid_refs = _extract_cid_refs(raw_html)

        doc_id = f"outlook_{msg_id}"

        participants = _message_participants(msg, sender_name, sender_addr)

        # Gate 1: skip noise entirely - no DB writes at all.
        if _is_noise_email(msg):
            logger.debug("[Outlook] Noise email skipped: %s", subject)
            continue

        # Gate 1.5: user-trained junk rules from `email_filter_rules`. Skip
        # actions drop the email with no DB writes (same as Gate 1). Allow
        # actions short-circuit further filtering and force import. Review
        # actions fall through but get tagged in source_metadata.
        user_rule_match = match_user_filter_rule(msg, user_filter_rules)
        user_rule_review_label: Optional[str] = None
        if user_rule_match is not None:
            if user_rule_match.action == "skip":
                record_rule_match(supabase_client, user_rule_match.id)
                logger.info(
                    "[Outlook] User filter rule skipped email: rule=%s label=%s subject=%s",
                    user_rule_match.id,
                    user_rule_match.label,
                    subject,
                )
                continue
            if user_rule_match.action == "review":
                record_rule_match(supabase_client, user_rule_match.id)
                user_rule_review_label = user_rule_match.label or user_rule_match.id
            if user_rule_match.action in {"allow", "not_project"}:
                record_rule_match(supabase_client, user_rule_match.id)

        if user_rule_match is not None and user_rule_match.action in {"allow", "not_project"}:
            intake_classification = EmailIntakeClassification(
                action=EmailIntakeAction.IMPORT,
                category=f"user_filter_rule_{user_rule_match.action}",
                confidence=1.0,
                reason=f"User filter rule explicitly applied action={user_rule_match.action}.",
                signals=(f"user_filter_rule_{user_rule_match.action}",),
            )
        else:
            intake_classification = classify_graph_email_for_intake(msg, body_text)
        source_metadata = {
            "outlook_message_id": msg_id,
            "mailbox_user_id": user_email,
            "internet_message_id": msg.get("internetMessageId"),
            "conversation_id": msg.get("conversationId"),
            "outlook_web_link": email_web_link,
            "has_attachments": bool(msg.get("hasAttachments")),
            "inline_content_ids": sorted(cid_refs),
            "intake_classification": intake_classification.as_metadata(),
        }
        if user_rule_match is not None:
            source_metadata["user_filter_rule"] = {
                "rule_id": user_rule_match.id,
                "label": user_rule_match.label,
                "action": user_rule_match.action,
                "review_only": user_rule_review_label is not None,
            }

        if intake_classification.action == EmailIntakeAction.SKIP:
            try:
                _record_outlook_skip_audit(
                    supabase_client=supabase_client,
                    msg=msg,
                    user_email=user_email,
                    body_text=body_text,
                    sender_name=sender_name,
                    sender_addr=sender_addr,
                    source_metadata=source_metadata,
                )
            except Exception as exc:
                logger.warning("[Outlook] Skip audit write failed for %s: %s", msg_id, exc)
            logger.info(
                "[Outlook] Skipping email before intake: msg=%s category=%s reason=%s subject=%s",
                msg_id,
                intake_classification.category,
                intake_classification.reason,
                subject,
            )
            continue

        if intake_classification.action == EmailIntakeAction.QUARANTINE:
            try:
                _upsert_outlook_intake_email(
                    supabase_client=supabase_client,
                    project_id=None,
                    document_metadata_id=None,
                    msg=msg,
                    user_email=user_email,
                    body_text=body_text,
                    sender_name=sender_name,
                    sender_addr=sender_addr,
                    assignment_method="intake_classification_quarantine",
                    assignment_confidence=intake_classification.confidence,
                    source_metadata=source_metadata,
                )
            except Exception as exc:
                logger.warning("[Outlook] Quarantine intake write failed for %s: %s", msg_id, exc)
            logger.info(
                "[Outlook] Quarantined low-value email: msg=%s category=%s reason=%s subject=%s",
                msg_id,
                intake_classification.category,
                intake_classification.reason,
                subject,
            )
            continue

        should_index_for_rag = len(body_text) >= MIN_BODY_CHARS

        try:
            existing_doc = None
            if should_index_for_rag:
                existing = (
                    supabase_client.from_("document_metadata")
                    .select("id, project_id, business_area_id, source_metadata, tags, file_path, storage_bucket")
                    .eq("id", doc_id)
                    .limit(1)
                    .execute()
                )
                existing_rows = existing.data or []
                existing_doc = existing_rows[0] if existing_rows else None

            project_id: Optional[int] = None
            business_area_id: Optional[int] = None
            assignment_method = "assignment_deferred"
            assignment_confidence = 0.0
            conversation_consensus = find_outlook_project_consensus(
                _outlook_intake_read_client(),
                mailbox_user_id=user_email,
                conversation_id=msg.get("conversationId"),
                internet_message_id=msg.get("internetMessageId"),
            )
            existing_project_id = (
                existing_doc.get("project_id") if existing_doc else None
            )
            existing_business_area_id = (
                existing_doc.get("business_area_id") if existing_doc else None
            )
            if (
                existing_project_id is not None
                and not is_assignable_project_id(
                    supabase_client,
                    existing_project_id,
                )
            ):
                logger.warning(
                    "[Outlook] Ignoring existing document assignment for %s "
                    "because project_id=%s is no longer assignable",
                    msg_id,
                    existing_project_id,
                )
                existing_project_id = None
            has_existing_scope = (
                existing_project_id is not None
                or existing_business_area_id is not None
            )
            if (
                not has_existing_scope
                and conversation_consensus is not None
                and not is_assignable_project_id(
                    supabase_client,
                    conversation_consensus.project_id,
                )
            ):
                logger.warning(
                    "[Outlook] Ignoring conversation consensus for %s because "
                    "project_id=%s is no longer assignable",
                    msg_id,
                    conversation_consensus.project_id,
                )
                conversation_consensus = None

            if existing_doc and has_existing_scope:
                project_id = existing_project_id
                business_area_id = existing_business_area_id
                assignment_method = "existing_document"
                assignment_confidence = 1.0
                source_metadata["project_assignment"] = {
                    "status": "assigned",
                    "target_type": (
                        "business_area"
                        if business_area_id is not None
                        else "project"
                    ),
                    "method": assignment_method,
                    "confidence": assignment_confidence,
                    "assigned_at": datetime.now(timezone.utc).isoformat(),
                }
                if business_area_id is not None:
                    source_metadata["project_assignment"]["business_area_id"] = (
                        business_area_id
                    )
            elif conversation_consensus:
                project_id = conversation_consensus.project_id
                assignment_method = f"conversation_consensus:{conversation_consensus.source_method}"
                assignment_confidence = conversation_consensus.confidence
                source_metadata["project_assignment"] = {
                    "status": "assigned",
                    "target_type": "project",
                    "method": assignment_method,
                    "confidence": assignment_confidence,
                    "evidence_intake_ids": list(conversation_consensus.evidence_row_ids),
                    "assigned_at": datetime.now(timezone.utc).isoformat(),
                }
            elif should_index_for_rag and user_rule_match is not None and user_rule_match.action == "not_project":
                assignment_method = "non_project:user_filter_rule"
                assignment_confidence = 1.0
                source_metadata["project_assignment"] = {
                    "status": "not_project",
                    "method": assignment_method,
                    "confidence": assignment_confidence,
                    "category": "learned_rule",
                    "reason": "User-trained filter rule marked this imported email as non-project.",
                    "rule_id": user_rule_match.id,
                    "assigned_at": datetime.now(timezone.utc).isoformat(),
                }
            elif should_index_for_rag:
                assignment_target = infer_assignment_target(
                    supabase_client,
                    title=subject,
                    content=body_text,
                    participants=participants,
                    existing_project_id=None,
                )
                project_id = assignment_target.project_id
                business_area_id = assignment_target.business_area_id
                assignment_method = assignment_target.method
                assignment_confidence = assignment_target.confidence
                has_assignment = project_id is not None or business_area_id is not None
                non_project_category = None
                if not has_assignment:
                    non_project_category = _non_project_category_for_outlook_row(
                        {
                            "subject": subject,
                            "from_email": sender_addr,
                            "from_name": sender_name,
                        },
                        body_text,
                    )
                source_metadata["project_assignment"] = {
                    "status": "assigned" if has_assignment else "not_project" if non_project_category else "review_needed",
                    "method": (
                        assignment_method
                        if not non_project_category
                        else f"non_project:{non_project_category['category']}"
                    ),
                    "confidence": (
                        assignment_confidence
                        if not non_project_category
                        else non_project_category["confidence"]
                    ),
                    "assigned_at": datetime.now(timezone.utc).isoformat(),
                }
                if has_assignment:
                    source_metadata["project_assignment"]["target_type"] = (
                        "business_area" if business_area_id is not None else "project"
                    )
                if business_area_id is not None:
                    source_metadata["project_assignment"]["business_area_id"] = business_area_id
                    source_metadata["project_assignment"]["legacy_project_id"] = (
                        assignment_target.legacy_project_id
                    )
                if non_project_category:
                    source_metadata["project_assignment"].update(non_project_category)
                    assignment_method = f"non_project:{non_project_category['category']}"
                    assignment_confidence = float(non_project_category["confidence"])
            else:
                source_metadata["project_assignment"] = {
                    "status": "not_indexed",
                    "reason": "Email body was too short for RAG indexing/project inference.",
                    "checked_at": datetime.now(timezone.utc).isoformat(),
                }

            tags = ["email", "outlook"]
            if project_id:
                tags.append(f"project_auto:{assignment_method}")
            if business_area_id is not None:
                tags.append(f"business_area_auto:{assignment_method}")

            effective_source_metadata = source_metadata

            intake_attachment_count = 0
            attachment_errors: list[str] = []
            intake_errors: list[str] = []
            had_attachment_errors = bool(effective_source_metadata.get("attachment_errors")) if existing_doc else False
            intake_email_id: Optional[int] = None
            rag_document_upserted = False

            try:
                intake_email_id = _upsert_outlook_intake_email(
                    supabase_client=supabase_client,
                    project_id=project_id,
                    document_metadata_id=existing_doc.get("id") if existing_doc else None,
                    msg=msg,
                    user_email=user_email,
                    body_text=body_text,
                    sender_name=sender_name,
                    sender_addr=sender_addr,
                    assignment_method=assignment_method,
                    assignment_confidence=assignment_confidence,
                    source_metadata=source_metadata,
                    business_area_id=business_area_id,
                )
            except Exception as exc:
                message = f"email_intake_failed: {exc}"
                intake_errors.append(message[:500])
                logger.warning("[Outlook] Intake email sync failed for %s: %s", msg_id, exc)

            should_list_attachments = bool(SYNC_OUTLOOK_INTAKE_ATTACHMENTS and intake_email_id)
            if should_list_attachments:
                try:
                    attachments = _list_message_attachments(graph, user_id, msg, cid_refs)
                except Exception as exc:
                    attachments = []
                    attachment_errors.append(f"list_failed: {exc}")
            else:
                attachments = []

            for attachment in attachments:
                if SYNC_OUTLOOK_INTAKE_ATTACHMENTS and intake_email_id:
                    try:
                        if _upsert_outlook_intake_attachment(
                            supabase_client=supabase_client,
                            graph=graph,
                            user_id=user_id,
                            msg_id=msg_id,
                            intake_email_id=intake_email_id,
                            attachment=attachment,
                        ):
                            intake_attachment_count += 1
                    except Exception as exc:
                        message = f"{attachment.get('name') or attachment.get('id')}: {exc}"
                        intake_errors.append(message[:500])
                        logger.warning("[Outlook] Intake attachment sync failed for %s: %s", msg_id, message)

            if should_index_for_rag:
                rag_store = SupabaseRagStore(supabase_client)
                storage_path = f"outlook/{user_email}/{msg_id}.txt"
                needs_storage_upload = not existing_doc or not existing_doc.get("file_path")
                if needs_storage_upload:
                    try:
                        storage_upload_with_retry(
                            supabase_client.storage.from_(DOCUMENT_BUCKET),
                            storage_path,
                            body_text.encode("utf-8"),
                            {"content-type": "text/plain", "upsert": "true"},
                        )
                    except Exception as e:
                        logger.warning(f"[Outlook] Storage upload failed for {msg_id}: {e}")
                        storage_path = ""

                if existing_doc:
                    effective_source_metadata = {
                        **(existing_doc.get("source_metadata") or {}),
                        **source_metadata,
                    }
                    supabase_client.from_("document_metadata").update({
                        "url": email_web_link,
                        "source_system": "outlook_email",
                        "source_item_id": msg_id,
                        "source_path": f"outlook/{user_email}/{msg_id}.txt",
                        "source_web_url": email_web_link,
                        "storage_bucket": existing_doc.get("storage_bucket") or DOCUMENT_BUCKET,
                        "file_path": existing_doc.get("file_path") or storage_path,
                        "project_id": project_id,
                        "business_area_id": business_area_id,
                        "source_metadata": effective_source_metadata,
                    }).eq("id", doc_id).execute()
                    rag_store.upsert_rag_document_metadata({
                        "id": doc_id,
                        "app_document_id": doc_id,
                        "title": f"Email: {subject}",
                        "source": "microsoft_graph",
                        "source_system": "outlook_email",
                        "source_item_id": msg_id,
                        "source_web_url": email_web_link,
                        "storage_bucket": existing_doc.get("storage_bucket") or DOCUMENT_BUCKET,
                        "file_path": existing_doc.get("file_path") or storage_path,
                        "content": body_text,
                        "raw_text": body_text,
                        "source_metadata": effective_source_metadata,
                        "parsing_status": "raw_ingested",
                    })
                    rag_document_upserted = True
                else:
                    rag_store.upsert_document_metadata({
                        "id": doc_id,
                        "title": f"Email: {subject}",
                        "source": "microsoft_graph",
                        "category": "email",
                        "type": "email",
                        "content": body_text,
                        "date": received[:10] if received else None,
                        "participants": ", ".join(participants[:50]),
                        "status": "raw_ingested",
                        "tags": ",".join(tags),
                        "project_id": project_id,
                        "business_area_id": business_area_id,
                        "url": email_web_link,
                        "source_system": "outlook_email",
                        "source_item_id": msg_id,
                        "source_path": f"outlook/{user_email}/{msg_id}.txt",
                        "source_web_url": email_web_link,
                        "storage_bucket": DOCUMENT_BUCKET,
                        "file_path": storage_path,
                        "source_metadata": source_metadata,
                    })
                    rag_document_upserted = True
                rag_store.set_document_scope(
                    doc_id,
                    project_id=project_id,
                    business_area_id=business_area_id,
                )

                if intake_email_id:
                    _outlook_intake_write_client().from_("outlook_email_intake").update(
                        {
                            "document_metadata_id": doc_id,
                            "vectorization_status": "pending",
                            "vectorization_chunk_count": 0,
                            "vectorization_error": None,
                            "updated_at": datetime.now(timezone.utc).isoformat(),
                        }
                    ).eq("id", intake_email_id).execute()

                reconciled_project_id = _reconcile_outlook_project_assignment(
                    supabase_client=supabase_client,
                    msg_id=msg_id,
                    document_metadata_id=doc_id,
                    intake_email_id=intake_email_id,
                    inferred_project_id=project_id,
                    assignment_method=assignment_method,
                    assignment_confidence=assignment_confidence,
                )
                if reconciled_project_id is not None:
                    if int(reconciled_project_id) != int(project_id or 0):
                        logger.warning(
                            "[Outlook] Reconciled project assignment for %s "
                            "from %s to document_metadata project_id=%s",
                            msg_id,
                            project_id,
                            reconciled_project_id,
                        )
                    project_id = int(reconciled_project_id)
                    business_area_id = None
                    # A trigger/manual correction can change the canonical app
                    # scope during the initial upsert. Mirror that final scope
                    # back to both databases after reconciliation so retrieval
                    # cannot remain on the pre-correction project.
                    rag_store.set_document_scope(
                        doc_id,
                        project_id=project_id,
                        business_area_id=None,
                    )

            if intake_email_id and (attachment_errors or intake_errors):
                _outlook_intake_write_client().from_("outlook_email_intake").update(
                    {
                        "source_metadata": {
                            **source_metadata,
                            "attachment_errors": attachment_errors,
                            "intake_errors": intake_errors,
                            "intake_attachment_count_synced": intake_attachment_count,
                        },
                        "updated_at": datetime.now(timezone.utc).isoformat(),
                    }
                ).eq("id", intake_email_id).execute()

            if should_index_for_rag and rag_document_upserted and (attachment_errors or intake_email_id or intake_attachment_count or intake_errors or had_attachment_errors):
                update_payload = {
                    "source_metadata": {
                        **effective_source_metadata,
                        "attachment_count_synced": intake_attachment_count,
                        "attachment_errors": attachment_errors,
                        "intake_email_id": intake_email_id,
                        "intake_attachment_count_synced": intake_attachment_count,
                        "intake_errors": intake_errors,
                    }
                }
                error_tags = []
                if attachment_errors:
                    error_tags.append("attachment_sync_error")
                if intake_errors:
                    error_tags.append("intake_sync_error")
                if error_tags:
                    update_payload["tags"] = ",".join(tags + error_tags)
                supabase_client.from_("document_metadata").update(update_payload).eq("id", doc_id).execute()

            if intake_email_id or (should_index_for_rag and not existing_doc):
                synced += 1
            if project_id:
                logger.info(
                    "[Outlook] Auto-assigned project_id=%s for %s via %s (%.2f); attachments=%d errors=%d",
                    project_id,
                    msg_id,
                    assignment_method,
                    assignment_confidence,
                    intake_attachment_count,
                    len(attachment_errors) + len(intake_errors),
                )
            elif business_area_id is not None:
                logger.info(
                    "[Outlook] Auto-assigned business_area_id=%s for %s via %s (%.2f); attachments=%d errors=%d",
                    business_area_id,
                    msg_id,
                    assignment_method,
                    assignment_confidence,
                    intake_attachment_count,
                    len(attachment_errors) + len(intake_errors),
                )
        except Exception as e:
            logger.warning(f"[Outlook] Failed to insert metadata for {msg_id}: {e}")
            item_errors.append(f"{msg_id}: {e}")
            continue

    if item_errors:
        raise RuntimeError(
            "Outlook materialization failed for "
            f"{len(item_errors)} message(s) in {user_email}; the delta cursor "
            f"was not persisted and the batch will replay. First failure: "
            f"{item_errors[0][:700]}"
        )

    logger.info(f"[Outlook] Synced {synced} emails for {user_email}")
    return synced, new_delta_token


def sync_outlook_emails(
    supabase_client,
    user_email: str,
    project_keywords: list[str],
    delta_token: Optional[str] = None,
    since_date: Optional[str] = None,
) -> tuple[int, str]:
    """Sync one mailbox against one exact, always-released project snapshot."""
    graph = get_graph_client()
    if not graph.is_configured():
        logger.warning("[Outlook] Microsoft Graph not configured — skipping")
        return 0, delta_token or ""

    begin_project_assignment_batch(supabase_client)
    try:
        return _sync_outlook_emails_in_batch(
            supabase_client,
            user_email,
            project_keywords,
            graph,
            delta_token,
            since_date,
        )
    finally:
        end_project_assignment_batch(supabase_client)
