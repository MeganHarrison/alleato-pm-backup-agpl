"""Trigger adapters for the Microsoft Executive Assistant specialist."""

from __future__ import annotations

import os
from typing import Any, Callable, Optional

from src.services.agents.microsoft_executive_assistant.agent import run_microsoft_executive_assistant
from src.services.agents.microsoft_executive_assistant.contracts import (
    MicrosoftExecutiveAssistantRequest,
    MicrosoftExecutiveAssistantResponse,
)
from src.services.pipeline.config import MODEL_MICROSOFT_EXECUTIVE_ASSISTANT


Runner = Callable[..., MicrosoftExecutiveAssistantResponse]


def _flag_enabled(name: str, default: bool = False) -> bool:
    raw = os.getenv(name)
    if raw is None:
        return default
    return raw.strip().lower() in {"1", "true", "yes", "on"}


def _operator_user_id() -> str:
    return os.getenv("MICROSOFT_EXECUTIVE_ASSISTANT_USER_ID", "system:microsoft-executive-assistant")


def _operator_mailbox(explicit: Optional[str] = None) -> Optional[str]:
    return (
        explicit
        or os.getenv("MICROSOFT_EXECUTIVE_ASSISTANT_MAILBOX")
        or os.getenv("AI_ASSISTANT_DEFAULT_OUTLOOK_MAILBOX")
        or os.getenv("OUTLOOK_OPERATOR_MAILBOX")
        or (os.getenv("MICROSOFT_SYNC_USERS", "").split(",")[0].strip() or None)
    )


def _model() -> str:
    return f"openai:{MODEL_MICROSOFT_EXECUTIVE_ASSISTANT}"


def run_scheduled_microsoft_executive_assistant_check(
    *,
    runner: Runner = run_microsoft_executive_assistant,
) -> dict[str, Any]:
    """Run the 15-minute inbox/operator check when explicitly enabled."""
    if not _flag_enabled("MICROSOFT_EXECUTIVE_ASSISTANT_SCHEDULED_ENABLED", default=False):
        return {
            "status": "skipped",
            "reason": "MICROSOFT_EXECUTIVE_ASSISTANT_SCHEDULED_ENABLED is not true",
        }

    mailbox = _operator_mailbox()
    if not mailbox:
        return {
            "status": "blocked",
            "reason": "No Microsoft Executive Assistant mailbox is configured.",
        }

    request = MicrosoftExecutiveAssistantRequest(
        userId=_operator_user_id(),
        sessionId="microsoft-executive-assistant:scheduled-check",
        prompt=(
            "Run the 15-minute Microsoft executive assistant check:\n"
            "1. Call read_live_outlook_inbox with unread_only=true to fetch recent unread messages.\n"
            "2. For EACH email, classify it with one of: urgent, reply_needed, delegate, fyi, watch, delete.\n"
            "3. Call write_email_triage for each classified email (pass graph_message_id, triage_action, "
            "and a one-sentence triage_reason). This persists your decision to Alleato's review ledger; "
            "do not assume the live Outlook message can be tagged.\n"
            "4. For every urgent or reply_needed email that has a safe response path, call "
            "draft_outlook_email_for_review with reply_to_graph_message_id so the reply lands in Brandon's "
            "Outlook Drafts folder. If a safe response cannot be drafted, say why in the triage reason.\n"
            "5. For urgent items, call draft_teams_message_for_review with urgency=urgent and pass the "
            "email's graph_message_id so the Teams alert is deduped before sending.\n"
            "6. Avoid duplicate recommendations for emails already triaged or already drafted.\n"
            "Do not skip write_email_triage for classified email, and do not leave reply_needed email as "
            "app-only text when an Outlook reply draft can be created."
        ),
        mailboxUserId=mailbox,
        trigger="scheduled_check",
        maxMessages=int(os.getenv("MICROSOFT_EXECUTIVE_ASSISTANT_MAX_MESSAGES", "25")),
    )
    response = runner(request, model=_model())
    return {
        "status": "completed" if response.mode == "deep_agents" else "failed",
        "mode": response.mode,
        "orchestrator": response.orchestrator,
        "mailbox": mailbox,
        "actions": [action.model_dump(by_alias=True) for action in response.actions],
        "toolTrace": [trace.model_dump(by_alias=True) for trace in response.tool_trace],
    }


def run_outlook_event_microsoft_executive_assistant(
    *,
    sync_result: dict[str, Any],
    runner: Runner = run_microsoft_executive_assistant,
) -> dict[str, Any]:
    """Run a guarded Outlook-event specialist pass after Graph accepts a mailbox event."""
    if not _flag_enabled("MICROSOFT_EXECUTIVE_ASSISTANT_WEBHOOK_ENABLED", default=False):
        return {
            "status": "skipped",
            "reason": "MICROSOFT_EXECUTIVE_ASSISTANT_WEBHOOK_ENABLED is not true",
        }

    mailbox = _operator_mailbox(str(sync_result.get("mailbox") or "") or None)
    if not mailbox:
        return {"status": "blocked", "reason": "Webhook sync result did not include a mailbox."}

    message_id = sync_result.get("message_id")
    request = MicrosoftExecutiveAssistantRequest(
        userId=_operator_user_id(),
        sessionId=f"microsoft-executive-assistant:outlook-event:{message_id or mailbox}",
        prompt=(
            "A Microsoft Graph Outlook webhook was accepted and queued for delta sync. Use live Outlook tools "
            "to review the new or changed mailbox item, classify urgency, call write_email_triage so Alleato "
            "records the decision, prepare a concise Teams escalation only if the item is urgent, pass "
            "the email's graph_message_id to draft_teams_message_for_review so delivery is deduped, and "
            "create an Outlook reply draft in Brandon's Drafts folder when the item needs a response and a safe "
            "response path exists. Never send email directly; Brandon reviews and sends from Outlook.\n\n"
            f"Webhook work item: {sync_result}"
        ),
        mailboxUserId=mailbox,
        trigger="outlook_event",
        maxMessages=int(os.getenv("MICROSOFT_EXECUTIVE_ASSISTANT_EVENT_MAX_MESSAGES", "10")),
    )
    response = runner(request, model=_model())
    return {
        "status": "completed" if response.mode == "deep_agents" else "failed",
        "mode": response.mode,
        "orchestrator": response.orchestrator,
        "mailbox": mailbox,
        "messageId": message_id,
        "actions": [action.model_dump(by_alias=True) for action in response.actions],
        "toolTrace": [trace.model_dump(by_alias=True) for trace in response.tool_trace],
    }
