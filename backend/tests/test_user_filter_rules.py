"""Unit tests for the user-trained email filter rule matcher."""
from src.services.integrations.microsoft_graph.user_filter_rules import (
    UserFilterRule,
    match_user_filter_rule,
)


def _msg(sender: str = "", subject: str = "", body: str = "") -> dict:
    return {
        "from": {"emailAddress": {"address": sender}},
        "subject": subject,
        "bodyPreview": body,
    }


def _rule(**kwargs) -> UserFilterRule:
    defaults = dict(
        id="rule-1",
        action="skip",
        sender_pattern=None,
        sender_domain=None,
        subject_pattern=None,
        body_pattern=None,
        label="test",
    )
    defaults.update(kwargs)
    return UserFilterRule(**defaults)


def test_no_rules_returns_none():
    assert match_user_filter_rule(_msg(sender="x@y.com"), []) is None


def test_sender_domain_match_is_case_insensitive():
    rule = _rule(sender_domain="stripe.com")
    msg = _msg(sender="Receipts@STRIPE.com", subject="Your receipt")
    assert match_user_filter_rule(msg, [rule]) is rule


def test_sender_pattern_exact_only():
    rule = _rule(sender_pattern="receipts@stripe.com")
    assert match_user_filter_rule(_msg(sender="receipts@stripe.com"), [rule]) is rule
    # Different mailbox at same domain shouldn't match an exact-sender rule.
    assert match_user_filter_rule(_msg(sender="billing@stripe.com"), [rule]) is None


def test_subject_pattern_is_ilike_substring():
    rule = _rule(subject_pattern="%receipt%")
    assert match_user_filter_rule(_msg(subject="Your Monthly Receipt"), [rule]) is rule
    assert match_user_filter_rule(_msg(subject="Project update"), [rule]) is None


def test_multiple_criteria_are_anded():
    # Skip Stripe receipts but keep Stripe support emails.
    rule = _rule(sender_domain="stripe.com", subject_pattern="%receipt%")
    assert (
        match_user_filter_rule(
            _msg(sender="r@stripe.com", subject="Your receipt"), [rule]
        )
        is rule
    )
    assert (
        match_user_filter_rule(
            _msg(sender="support@stripe.com", subject="Reply re: dispute"), [rule]
        )
        is None
    )


def test_allow_rule_beats_skip_rule_even_when_both_match():
    skip_rule = _rule(id="skip", action="skip", sender_domain="stripe.com")
    allow_rule = _rule(id="allow", action="allow", sender_pattern="ceo@stripe.com")
    msg = _msg(sender="ceo@stripe.com", subject="anything")
    # Both rules match; the allow rule must win.
    match = match_user_filter_rule(msg, [skip_rule, allow_rule])
    assert match is not None and match.id == "allow"


def test_allow_rule_beats_not_project_rule_even_when_both_match():
    not_project_rule = _rule(id="not-project", action="not_project", sender_domain="stripe.com")
    allow_rule = _rule(id="allow", action="allow", sender_pattern="ceo@stripe.com")
    msg = _msg(sender="ceo@stripe.com", subject="project invoice")
    match = match_user_filter_rule(msg, [not_project_rule, allow_rule])
    assert match is not None and match.id == "allow"


def test_disabled_rules_are_not_passed_in():
    # `load_active_filter_rules` already filters on enabled=true, but exercise
    # the contract that the matcher itself does not double-check.
    rule = _rule(sender_domain="stripe.com")
    msg = _msg(sender="x@stripe.com")
    assert match_user_filter_rule(msg, [rule]) is rule


def test_body_pattern_starts_and_ends_with():
    rule_prefix = _rule(body_pattern="invoice%")
    rule_suffix = _rule(id="suffix", body_pattern="%due")
    assert match_user_filter_rule(_msg(body="invoice from acme"), [rule_prefix]) is rule_prefix
    assert match_user_filter_rule(_msg(body="balance due"), [rule_suffix]) is rule_suffix
    assert match_user_filter_rule(_msg(body="random text"), [rule_prefix, rule_suffix]) is None
