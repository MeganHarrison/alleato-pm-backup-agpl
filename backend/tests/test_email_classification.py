from services.integrations.microsoft_graph.email_classification import (
    EmailIntakeAction,
    classify_graph_email_for_intake,
)


def _message(
    subject,
    body_preview="",
    headers=None,
    has_attachments=False,
    from_email="sender@example.com",
):
    return {
        "subject": subject,
        "bodyPreview": body_preview,
        "hasAttachments": has_attachments,
        "internetMessageHeaders": headers or [],
        "from": {"emailAddress": {"address": from_email}},
    }


def test_classifies_pure_accepted_invite_as_skip():
    msg = _message(
        "Accepted: Ulta Fresno OAC Meeting",
        "Accepted Ulta Fresno OAC Meeting When: Tuesday, May 12 Where: Teams",
        [{"name": "Content-Class", "value": "urn:content-classes:calendarmessage"}],
    )

    classification = classify_graph_email_for_intake(msg, msg["bodyPreview"])

    assert classification.action == EmailIntakeAction.SKIP
    assert classification.category == "calendar_rsvp"
    assert classification.confidence >= 0.9


def test_formatted_storage_text_does_not_make_rsvp_substantive():
    msg = _message(
        "Accepted: Ulta Fresno OAC Meeting",
        "Accepted Ulta Fresno OAC Meeting When: Tuesday, May 12 Where: Teams",
        [{"name": "Content-Class", "value": "urn:content-classes:calendarmessage"}],
    )
    formatted_body = """Subject: Accepted: Ulta Fresno OAC Meeting
Date: 2026-05-12T12:00:00Z
From: Scheduler <scheduler@example.com>
To: Brandon Clymer <bclymer@alleatogroup.com>

Accepted Ulta Fresno OAC Meeting When: Tuesday, May 12 Where: Teams"""

    classification = classify_graph_email_for_intake(msg, formatted_body)

    assert classification.action == EmailIntakeAction.SKIP
    assert classification.category == "calendar_rsvp"


def test_keeps_invite_response_with_substantive_comment():
    body = (
        "Accepted. I also need the revised drawing and the RFI response before "
        "the meeting because the owner asked about the schedule impact."
    )
    msg = _message(
        "Accepted: Ulta Fresno OAC Meeting",
        body,
        [{"name": "Content-Type", "value": "text/calendar; method=REPLY"}],
    )

    classification = classify_graph_email_for_intake(msg, body)

    assert classification.action == EmailIntakeAction.IMPORT
    assert classification.category == "calendar_reply_with_substance"


def test_quarantines_low_value_calendar_update():
    body = "This meeting has been updated. When: Wednesday 2 PM Where: Microsoft Teams"
    msg = _message(
        "Updated invitation: Coordination call",
        body,
        [{"name": "Content-Class", "value": "urn:content-classes:calendarmessage"}],
    )

    classification = classify_graph_email_for_intake(msg, body)

    assert classification.action == EmailIntakeAction.QUARANTINE
    assert classification.category == "calendar_low_value"


def test_imports_calendar_message_with_attachment():
    msg = _message(
        "Updated invitation: Permit review",
        "This meeting has been updated.",
        [{"name": "Content-Class", "value": "urn:content-classes:calendarmessage"}],
        has_attachments=True,
    )

    classification = classify_graph_email_for_intake(msg, msg["bodyPreview"])

    assert classification.action == EmailIntakeAction.IMPORT


def test_imports_normal_human_email():
    msg = _message(
        "Need pricing clarification",
        "Can you send the revised subcontractor price before Friday?",
    )

    classification = classify_graph_email_for_intake(msg, msg["bodyPreview"])

    assert classification.action == EmailIntakeAction.IMPORT
    assert classification.category == "human_email"


def test_skips_retail_review_request():
    msg = _message(
        "Review your recent purchase to earn rewards",
        "Get money off your next purchase when you write a review.",
        from_email="feedback@reviews.walmart.com",
    )

    classification = classify_graph_email_for_intake(msg, msg["bodyPreview"])

    assert classification.action == EmailIntakeAction.SKIP
    assert classification.category == "retail_review_request"


def test_skips_retail_purchase_order_without_business_context():
    msg = _message(
        "Your purchase order from Best Buy Marketplace",
        "Thanks for your order from PC Heaven via Best Buy Marketplace.",
        from_email="reply+abc@marketplace.bestbuy.com",
    )

    classification = classify_graph_email_for_intake(msg, msg["bodyPreview"])

    assert classification.action == EmailIntakeAction.SKIP
    assert classification.category == "retail_order_low_value"


def test_keeps_business_purchase_order_with_project_context():
    msg = _message(
        "Purchase Order for Union Collective project",
        "Please review the subcontract purchase order for the project site and cost code.",
        from_email="pm@trustedvendor.com",
    )

    classification = classify_graph_email_for_intake(msg, msg["bodyPreview"])

    assert classification.action == EmailIntakeAction.IMPORT
    assert classification.category == "human_email"
