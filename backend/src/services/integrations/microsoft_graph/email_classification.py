"""Email intake classification guardrails for Microsoft Graph messages."""
from __future__ import annotations

import re
import html
from dataclasses import dataclass
from enum import Enum
from typing import Any


class EmailIntakeAction(str, Enum):
    IMPORT = "import"
    QUARANTINE = "quarantine"
    SKIP = "skip"


@dataclass(frozen=True)
class EmailIntakeClassification:
    action: EmailIntakeAction
    category: str
    confidence: float
    reason: str
    signals: tuple[str, ...] = ()

    def as_metadata(self) -> dict[str, Any]:
        return {
            "action": self.action.value,
            "category": self.category,
            "confidence": self.confidence,
            "reason": self.reason,
            "signals": list(self.signals),
        }


_RSVP_SUBJECT_RE = re.compile(
    r"^\s*(accepted|declined|tentative|tentatively accepted|new time proposed)\s*:",
    re.IGNORECASE,
)
_CALENDAR_SUBJECT_RE = re.compile(
    r"\b("
    r"invitation|meeting invitation|updated invitation|canceled event|cancelled event|"
    r"event cancellation|meeting canceled|meeting cancelled|calendar"
    r")\b",
    re.IGNORECASE,
)
_CALENDAR_HEADER_NAMES = {
    "content-class",
    "x-ms-has-attach",
    "x-ms-tnef-correlator",
    "x-ms-olk-apptseqtime",
    "x-ms-olk-autofilllocation",
}
_CALENDAR_HEADER_VALUES = (
    "urn:content-classes:calendarmessage",
    "method=reply",
    "method=request",
    "method=cancel",
    "text/calendar",
)
_MEETING_BOILERPLATE_PATTERNS = (
    re.compile(r"\baccepted\b.{0,80}\b(invitation|meeting|event)\b", re.IGNORECASE),
    re.compile(r"\bdeclined\b.{0,80}\b(invitation|meeting|event)\b", re.IGNORECASE),
    re.compile(r"\btentatively accepted\b.{0,80}\b(invitation|meeting|event)\b", re.IGNORECASE),
    re.compile(r"\bthis meeting has been (canceled|cancelled|updated)\b", re.IGNORECASE),
    re.compile(r"\bwhen:\b.{0,120}\bwhere:\b", re.IGNORECASE | re.DOTALL),
    re.compile(r"\bjoin (microsoft )?teams meeting\b", re.IGNORECASE),
)
_LOW_VALUE_REPLY_TOKENS = {
    "accept",
    "accepted",
    "decline",
    "declined",
    "tentative",
    "tentatively",
    "yes",
    "no",
    "ok",
    "okay",
    "thanks",
    "thank",
    "thx",
    "received",
    "confirmed",
    "confirm",
}
_SUBSTANTIVE_KEYWORDS = (
    "rfi",
    "submittal",
    "change order",
    "change event",
    "schedule",
    "delay",
    "permit",
    "inspection",
    "invoice",
    "payment",
    "cost",
    "budget",
    "drawing",
    "revision",
    "approval",
    "owner",
    "subcontractor",
    "vendor",
    "deliverable",
    "scope",
    "price",
)
_RETAIL_SENDER_PATTERNS = (
    "amazon.",
    "bestbuy.",
    "ebay.",
    "etsy.",
    "homedepot.",
    "lowes.",
    "marketplace.",
    "paypal.",
    "reviews.",
    "shopify.",
    "store.",
    "target.",
    "walmart.",
)
_LOW_VALUE_SENDER_PATTERNS = (
    "feedback@",
    "mailer@",
    "marketing@",
    "newsletter@",
    "no-reply",
    "noreply",
    "offers@",
    "promo@",
    "promotions@",
)
_REVIEW_REQUEST_PATTERNS = (
    "review your recent purchase",
    "rate your purchase",
    "rate your recent purchase",
    "tell us about your purchase",
    "write a review",
    "earn points for your review",
)
_PROMOTIONAL_PATTERNS = (
    "free shipping",
    "limited time",
    "sale ends",
    "shop now",
    "special offer",
    "unsubscribe",
    "view in browser",
)
_RETAIL_ORDER_PATTERNS = (
    "order confirmation",
    "order confirmed",
    "purchase confirmation",
    "purchase order",
    "receipt for your",
    "thanks for your order",
    "your order",
    "your purchase",
)
_BUSINESS_CONTEXT_KEYWORDS = (
    "alleato",
    "billing",
    "budget",
    "change order",
    "closeout",
    "contract",
    "cost code",
    "draw",
    "invoice",
    "job",
    "pay app",
    "permit",
    "project",
    "rfi",
    "schedule",
    "site",
    "subcontract",
    "submittal",
)


def classify_graph_email_for_intake(msg: dict[str, Any], body_text: str) -> EmailIntakeClassification:
    """Decide whether an Outlook message should enter project intelligence.

    Calendar messages are only suppressed when they look system-generated or
    low-value after quoted history, signatures, and common meeting boilerplate
    are ignored. A meeting response with meaningful typed content imports as a
    normal email.
    """

    subject = str(msg.get("subject") or "")
    text = _message_text_for_classification(msg, body_text)
    commercial_signals = _commercial_noise_signals(msg, subject, text)
    if commercial_signals:
        sender_addr = _sender_address(msg)
        combined = _normalize_text(f"{subject} {text}")
        has_business_context = _has_business_context(combined)

        if "review_request" in commercial_signals:
            return EmailIntakeClassification(
                action=EmailIntakeAction.SKIP,
                category="retail_review_request",
                confidence=0.98,
                reason="Retail review request is not operationally relevant.",
                signals=commercial_signals,
            )

        if "promotional_marketing" in commercial_signals and not has_business_context:
            return EmailIntakeClassification(
                action=EmailIntakeAction.SKIP,
                category="marketing_low_value",
                confidence=0.95,
                reason="Marketing or promotional email has no project/business context.",
                signals=commercial_signals,
            )

        if "retail_order" in commercial_signals and not has_business_context:
            action = EmailIntakeAction.QUARANTINE if bool(msg.get("hasAttachments")) else EmailIntakeAction.SKIP
            return EmailIntakeClassification(
                action=action,
                category="retail_order_low_value",
                confidence=0.9,
                reason="Retail order or purchase message has no project/business context.",
                signals=commercial_signals,
            )

        if _is_low_value_sender(sender_addr) and not has_business_context:
            return EmailIntakeClassification(
                action=EmailIntakeAction.QUARANTINE,
                category="automated_low_value",
                confidence=0.82,
                reason="Automated sender has no project/business context.",
                signals=commercial_signals,
            )

    header_signals = _calendar_header_signals(msg)
    subject_signals = _calendar_subject_signals(subject)
    body_signals = _calendar_body_signals(text)
    signals = tuple((*subject_signals, *header_signals, *body_signals))

    if not signals:
        return EmailIntakeClassification(
            action=EmailIntakeAction.IMPORT,
            category="human_email",
            confidence=0.95,
            reason="No calendar or RSVP-only signals detected.",
        )

    has_attachment = bool(msg.get("hasAttachments"))
    body_substantive_score = _substantive_score("", text)
    if has_attachment or body_substantive_score >= 80:
        return EmailIntakeClassification(
            action=EmailIntakeAction.IMPORT,
            category="calendar_reply_with_substance",
            confidence=0.88,
            reason="Calendar-related message contains substantive typed content.",
            signals=signals,
        )

    if "rsvp_subject" in subject_signals and body_substantive_score < 30:
        return EmailIntakeClassification(
            action=EmailIntakeAction.SKIP,
            category="calendar_rsvp",
            confidence=0.98,
            reason="RSVP response has no substantive typed content.",
            signals=signals,
        )

    if ("calendar_header" in header_signals or "calendar_subject" in subject_signals) and body_substantive_score < 30:
        return EmailIntakeClassification(
            action=EmailIntakeAction.QUARANTINE,
            category="calendar_low_value",
            confidence=0.84,
            reason="Calendar-related message has only low-value or ambiguous content.",
            signals=signals,
        )

    return EmailIntakeClassification(
        action=EmailIntakeAction.IMPORT,
        category="calendar_reply_with_substance",
        confidence=0.72,
        reason="Calendar-related message is not safe to suppress.",
        signals=signals,
    )


def _calendar_subject_signals(subject: str) -> tuple[str, ...]:
    signals: list[str] = []
    if _RSVP_SUBJECT_RE.search(subject):
        signals.append("rsvp_subject")
    if _CALENDAR_SUBJECT_RE.search(subject):
        signals.append("calendar_subject")
    return tuple(signals)


def _commercial_noise_signals(msg: dict[str, Any], subject: str, text: str) -> tuple[str, ...]:
    sender_addr = _sender_address(msg)
    combined = _normalize_text(f"{subject} {text}")
    signals: list[str] = []

    if any(pattern in combined for pattern in _REVIEW_REQUEST_PATTERNS):
        signals.append("review_request")
    if any(pattern in combined for pattern in _PROMOTIONAL_PATTERNS):
        signals.append("promotional_marketing")
    if any(pattern in combined for pattern in _RETAIL_ORDER_PATTERNS) and _is_retail_sender(sender_addr):
        signals.append("retail_order")
    if _is_retail_sender(sender_addr):
        signals.append("retail_sender")
    if _is_low_value_sender(sender_addr):
        signals.append("automated_sender")

    return tuple(dict.fromkeys(signals))


def _sender_address(msg: dict[str, Any]) -> str:
    sender = msg.get("from") if isinstance(msg.get("from"), dict) else {}
    email_address = sender.get("emailAddress") if isinstance(sender.get("emailAddress"), dict) else {}
    return str(email_address.get("address") or "").lower()


def _is_retail_sender(sender_addr: str) -> bool:
    return any(pattern in sender_addr for pattern in _RETAIL_SENDER_PATTERNS)


def _is_low_value_sender(sender_addr: str) -> bool:
    return any(pattern in sender_addr for pattern in _LOW_VALUE_SENDER_PATTERNS)


def _has_business_context(text: str) -> bool:
    return any(keyword in text for keyword in _BUSINESS_CONTEXT_KEYWORDS)


def _calendar_header_signals(msg: dict[str, Any]) -> tuple[str, ...]:
    for header in msg.get("internetMessageHeaders") or []:
        if not isinstance(header, dict):
            continue
        name = str(header.get("name") or "").lower()
        value = str(header.get("value") or "").lower()
        if name in _CALENDAR_HEADER_NAMES or any(marker in value for marker in _CALENDAR_HEADER_VALUES):
            return ("calendar_header",)
    return ()


def _calendar_body_signals(text: str) -> tuple[str, ...]:
    matches = [pattern for pattern in _MEETING_BOILERPLATE_PATTERNS if pattern.search(text)]
    return ("calendar_body",) if matches else ()


def _substantive_score(subject: str, text: str) -> int:
    normalized = _strip_calendar_boilerplate(f"{subject}\n{text}")
    keyword_bonus = sum(20 for keyword in _SUBSTANTIVE_KEYWORDS if keyword in normalized)
    tokens = re.findall(r"[a-z0-9][a-z0-9'-]*", normalized)
    useful_tokens = [
        token
        for token in tokens
        if len(token) > 2 and token not in _LOW_VALUE_REPLY_TOKENS
    ]
    return sum(len(token) for token in useful_tokens) + keyword_bonus


def _strip_calendar_boilerplate(text: str) -> str:
    cleaned = _normalize_text(text)
    for pattern in _MEETING_BOILERPLATE_PATTERNS:
        cleaned = pattern.sub(" ", cleaned)
    cleaned = re.sub(r"\b(when|where|organizer|required|optional|importance|sensitivity):\b.*", " ", cleaned)
    cleaned = re.sub(r"\b(microsoft teams|need help|meeting options|join on your computer).*$", " ", cleaned)
    return re.sub(r"\s+", " ", cleaned).strip()


def _message_text_for_classification(msg: dict[str, Any], body_text: str) -> str:
    body = msg.get("body") if isinstance(msg.get("body"), dict) else {}
    body_content = str(body.get("content") or "")
    candidate = body_content or str(msg.get("bodyPreview") or "") or body_text
    if body_content:
        candidate = _strip_html(candidate)
    candidate = _strip_storage_text_headers(candidate)
    return _normalize_text(candidate)


def _strip_storage_text_headers(value: str) -> str:
    return re.sub(
        r"(?is)^\s*subject:.*?\n\s*date:.*?\n\s*from:.*?\n\s*to:.*?\n\s*\n",
        "",
        value or "",
        count=1,
    )


def _strip_html(value: str) -> str:
    without_tags = re.sub(r"(?is)<(script|style).*?</\1>", " ", value or "")
    without_tags = re.sub(r"(?is)<br\s*/?>", "\n", without_tags)
    without_tags = re.sub(r"(?is)</p\s*>", "\n", without_tags)
    without_tags = re.sub(r"(?is)<[^>]+>", " ", without_tags)
    return html.unescape(without_tags)


def _normalize_text(value: Any) -> str:
    return re.sub(r"\s+", " ", str(value or "").lower()).strip()
