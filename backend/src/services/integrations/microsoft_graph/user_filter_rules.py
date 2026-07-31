"""User-trained email filter rules.

The hand-coded noise filter in `outlook._is_noise_email` catches obvious
marketing / auto-reply garbage. This module layers on top of it: app admins
flag emails as junk through the inbox UI, which writes a row to
`email_filter_rules`. At sync time we load active rules once and apply them
as Gate 1.5, between the hand-coded noise check and the heuristic classifier.

See docs/architecture/COMMUNICATIONS-DATA-PIPELINE.md for the full gate chain.
"""
from __future__ import annotations

import logging
from dataclasses import dataclass
from typing import Iterable, Optional

logger = logging.getLogger(__name__)


@dataclass(frozen=True)
class UserFilterRule:
    """In-memory representation of a row in `public.email_filter_rules`."""

    id: str
    action: str  # 'skip' | 'review' | 'allow' | 'not_project'
    sender_pattern: Optional[str]
    sender_domain: Optional[str]
    subject_pattern: Optional[str]
    body_pattern: Optional[str]
    label: Optional[str]


def load_active_filter_rules(supabase_client) -> list[UserFilterRule]:
    """Load all enabled rules from the database.

    Called once at the start of a sync run; the result is reused for every
    message in that run. If the table doesn't exist yet (migration hasn't
    been applied) we log a warning and return an empty list - the sync should
    still work, just without user-trained rules.
    """
    try:
        resp = (
            supabase_client.from_("email_filter_rules")
            .select(
                "id, action, sender_pattern, sender_domain, "
                "subject_pattern, body_pattern, label"
            )
            .eq("enabled", True)
            .execute()
        )
    except Exception as exc:
        logger.warning("[FilterRules] Could not load email_filter_rules: %s", exc)
        return []

    rows = resp.data or []
    rules: list[UserFilterRule] = []
    for row in rows:
        try:
            rules.append(
                UserFilterRule(
                    id=row["id"],
                    action=row.get("action") or "skip",
                    sender_pattern=_normalize(row.get("sender_pattern")),
                    sender_domain=_normalize(row.get("sender_domain")),
                    subject_pattern=_normalize(row.get("subject_pattern")),
                    body_pattern=_normalize(row.get("body_pattern")),
                    label=row.get("label"),
                )
            )
        except KeyError as exc:
            logger.warning("[FilterRules] Skipping malformed rule row %r: %s", row, exc)
    logger.info("[FilterRules] Loaded %d active email filter rule(s)", len(rules))
    return rules


def load_filter_rule_by_id(supabase_client, rule_id: str) -> Optional[UserFilterRule]:
    """Load one enabled rule by id for bounded replay jobs."""
    try:
        resp = (
            supabase_client.from_("email_filter_rules")
            .select(
                "id, action, sender_pattern, sender_domain, "
                "subject_pattern, body_pattern, label"
            )
            .eq("id", rule_id)
            .eq("enabled", True)
            .limit(1)
            .execute()
        )
    except Exception as exc:
        logger.warning("[FilterRules] Could not load email_filter_rules id=%s: %s", rule_id, exc)
        return None

    rows = resp.data or []
    if not rows:
        return None

    row = rows[0]
    try:
        return UserFilterRule(
            id=row["id"],
            action=row.get("action") or "skip",
            sender_pattern=_normalize(row.get("sender_pattern")),
            sender_domain=_normalize(row.get("sender_domain")),
            subject_pattern=_normalize(row.get("subject_pattern")),
            body_pattern=_normalize(row.get("body_pattern")),
            label=row.get("label"),
        )
    except KeyError as exc:
        logger.warning("[FilterRules] Malformed rule row %r: %s", row, exc)
        return None


def match_user_filter_rule(
    msg: dict,
    rules: Iterable[UserFilterRule],
) -> Optional[UserFilterRule]:
    """Return the first matching rule for a Graph message, or None.

    `allow` rules are evaluated first so an explicit allowlist always wins
    over a `skip`, `review`, or `not_project` rule that would also match.
    """
    sender_addr = (
        (msg.get("from", {}) or {}).get("emailAddress", {}).get("address", "") or ""
    ).lower()
    sender_domain = sender_addr.split("@", 1)[1] if "@" in sender_addr else ""
    subject = (msg.get("subject") or "").lower()
    body = (msg.get("bodyPreview") or "").lower()

    rules_list = list(rules)
    # Allow rules win.
    ordered = sorted(rules_list, key=lambda r: 0 if r.action == "allow" else 1)

    for rule in ordered:
        if _rule_matches(rule, sender_addr, sender_domain, subject, body):
            return rule
    return None


def record_rule_match(supabase_client, rule_id: str) -> None:
    """Bump match_count and last_matched_at via the RPC."""
    try:
        supabase_client.rpc(
            "record_email_filter_rule_match", {"p_rule_id": rule_id}
        ).execute()
    except Exception as exc:
        # Telemetry-only - never let this fail the sync.
        logger.warning("[FilterRules] record_rule_match failed for %s: %s", rule_id, exc)


def _rule_matches(
    rule: UserFilterRule,
    sender_addr: str,
    sender_domain: str,
    subject: str,
    body: str,
) -> bool:
    # A rule must specify at least one criterion - but we still treat any
    # specified criterion as a required match. (i.e. all set criteria must
    # match, like AND, not OR. This matches user expectations: "skip emails
    # from stripe.com WITH subject containing receipt" should not skip
    # arbitrary stripe.com mail.)
    matched_any = False

    if rule.sender_pattern:
        if rule.sender_pattern != sender_addr:
            return False
        matched_any = True
    if rule.sender_domain:
        if rule.sender_domain != sender_domain:
            return False
        matched_any = True
    if rule.subject_pattern:
        if not _ilike(subject, rule.subject_pattern):
            return False
        matched_any = True
    if rule.body_pattern:
        if not _ilike(body, rule.body_pattern):
            return False
        matched_any = True

    return matched_any


def _ilike(haystack: str, pattern: str) -> bool:
    """Approximate SQL ILIKE: '%foo%' as substring match, '%foo' as endswith,
    and 'foo%' as startswith. Pattern is lowercased; haystack is assumed lowercase.
    """
    p = pattern.lower()
    if p.startswith("%") and p.endswith("%"):
        return p[1:-1] in haystack
    if p.startswith("%"):
        return haystack.endswith(p[1:])
    if p.endswith("%"):
        return haystack.startswith(p[:-1])
    return p == haystack


def _normalize(value: Optional[str]) -> Optional[str]:
    if value is None:
        return None
    v = value.strip().lower()
    return v or None
