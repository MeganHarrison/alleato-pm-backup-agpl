from src.services.project_intelligence.validation import (
    UNSYNTHESIZED_WHY_IT_MATTERS,
    is_synthesized_signal,
    looks_like_raw_source,
    safe_summary,
)


def test_raw_email_headers_never_become_synthesized_prose():
    raw = "Subject: Cost update From: pm@example.com To: owner@example.com"
    assert looks_like_raw_source(raw)
    assert safe_summary(raw) is None


def test_placeholder_signal_is_not_publishable():
    assert not is_synthesized_signal({
        "title": "Schedule update",
        "summary": "The schedule changed.",
        "why_it_matters": UNSYNTHESIZED_WHY_IT_MATTERS,
    })


def test_synthesized_signal_is_publishable():
    assert is_synthesized_signal({
        "title": "Steel release now threatens the dry-in milestone",
        "summary": "The release moved three days and consumes the remaining float.",
        "why_it_matters": "The exterior sequence has no recovery time left.",
    })
