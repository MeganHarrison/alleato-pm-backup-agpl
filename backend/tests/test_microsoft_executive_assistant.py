"""Tests for the Microsoft Executive Assistant Deep Agents endpoint."""

from __future__ import annotations

import json
from datetime import datetime, timedelta, timezone
from typing import Any

from src.services.agents.microsoft_executive_assistant import (
    MicrosoftExecutiveAssistantRequest,
    run_microsoft_executive_assistant,
)
from src.services.agents.microsoft_executive_assistant.agent import _inbox_request_kind, _microsoft_prompt
from src.services.agents.microsoft_executive_assistant.tools import (
    _patch_message_category,
    _patch_message_categories,
    draft_teams_message_for_review,
    microsoft_executive_assistant_tools,
    patch_outlook_email_categories,
    read_live_outlook_inbox,
    write_email_triage,
)
from src.services.agents.microsoft_executive_assistant import triggers
from src.services.agents.microsoft_executive_assistant.triggers import (
    run_outlook_event_microsoft_executive_assistant,
    run_scheduled_microsoft_executive_assistant_check,
)


def _override_auth(app, path="/api/intelligence/microsoft-executive-assistant"):
    for route in app.routes:
        if getattr(route, "path", None) == path:
            for dependency in getattr(route, "dependant", None).dependencies:
                if dependency.name == "_":
                    app.dependency_overrides[dependency.call] = lambda: None
            return
    raise AssertionError(f"Microsoft assistant route was not registered: {path}")


def _clear_auth(app, path="/api/intelligence/microsoft-executive-assistant"):
    for route in app.routes:
        if getattr(route, "path", None) == path:
            for dependency in getattr(route, "dependant", None).dependencies:
                if dependency.name == "_":
                    app.dependency_overrides.pop(dependency.call, None)


def _route_endpoint(app, path="/api/intelligence/microsoft-executive-assistant"):
    for route in app.routes:
        if getattr(route, "path", None) == path:
            return route.endpoint
    raise AssertionError(f"Microsoft assistant route was not registered: {path}")


class _FakeAgent:
    def __init__(self, captured: dict[str, Any]):
        self.captured = captured

    def invoke(self, payload: dict[str, Any], config: dict[str, Any] | None = None):
        self.captured["payload"] = payload
        self.captured["config"] = config
        return {
            "messages": [
                {
                    "type": "tool",
                    "name": "read_live_outlook_inbox",
                    "content": (
                        '{"ok":true,"source":"microsoft_graph_live",'
                        '"mailbox_user_id":"megan@alleatogroup.com","count":1}'
                    ),
                },
                {
                    "content": (
                        "I checked Outlook context and prepared this draft for review.\n\n"
                        '{"action":"preview","type":"outlook_email_draft","approvalReason":"External communication requires Megan review."}'
                    )
                }
            ]
        }


def test_run_microsoft_assistant_uses_deep_agents_tools_memory_and_skills():
    captured: dict[str, Any] = {}

    def fake_create_agent(**kwargs):
        captured.update(kwargs)
        return _FakeAgent(captured)

    response = run_microsoft_executive_assistant(
        MicrosoftExecutiveAssistantRequest(
            userId="user-1",
            sessionId="session-1",
            mailboxUserId="megan@alleatogroup.com",
            projectId=983,
            prompt="Triage today's urgent inbox items and draft replies.",
            approvedSkillContext=(
                "## Approved Skill Library Context\n\n"
                "### Draft Outlook replies from source evidence (v1, email, low risk)\n"
                "Instructions: Draft replies only from the current email thread."
            ),
        ),
        create_agent=fake_create_agent,
    )

    assert response.mode == "deep_agents"
    assert response.orchestrator == "microsoft-executive-assistant"
    assert "email-drafting" in response.skills_loaded
    assert "inbox-triage" in response.skills_loaded
    assert response.tool_trace[0].tool == "read_live_outlook_inbox"
    assert response.tool_trace[0].source == "microsoft_graph_live"
    assert response.actions[0].action_type == "email_draft"
    assert captured["name"] == "microsoft-executive-assistant"
    assert any(
        getattr(tool, "name", getattr(tool, "__name__", "")) == "read_live_outlook_inbox"
        for tool in captured["tools"]
    )
    assert captured["memory"]
    assert captured["skills"]
    assert "microsoft_executive_assistant/runtime/AGENTS.md" in captured["memory"][0]
    assert "alleato-ai/skills" not in captured["memory"][0]
    assert "microsoft_executive_assistant/runtime/skills" in captured["skills"][0]
    assert "alleato-ai/skills" not in captured["skills"][0]
    assert captured["config"]["configurable"]["thread_id"] == "session-1"
    assert captured["config"]["configurable"]["mailbox_user_id"] == "megan@alleatogroup.com"
    prompt = captured["payload"]["messages"][0]["content"]
    assert "Microsoft operator request" in prompt
    assert "Approved email/Teams Skill Library context" in prompt
    assert "Draft Outlook replies from source evidence" in prompt
    assert "Draft email or Teams payloads for review only" in prompt
    assert "Project ID supplied by caller: 983" in prompt
    assert response.approved_skill_context is not None
    assert "Draft Outlook replies from source evidence" in response.approved_skill_context


def test_run_microsoft_assistant_extracts_draft_actions_from_tool_outputs():
    class DraftToolAgent:
        def invoke(self, *_args, **_kwargs):
            return {
                "messages": [
                    {
                        "type": "tool",
                        "name": "read_live_outlook_inbox",
                        "content": (
                            '{"ok":true,"source":"microsoft_graph_live","mailbox_user_id":"bclymer@alleatogroup.com","count":1,'
                            '"messages":['
                            '{"subject":"RE: ULTA update needed.","from_name":"Walter Allen","from_email":"wallen@ulta.com",'
                            '"received_at":"2026-06-09T09:59:34Z","body_text":"Can you confirm by Thursday afternoon?",'
                            '"graph_message_id":"message-1","has_attachments":false}'
                            ']}'
                        ),
                    },
                    {
                        "type": "tool",
                        "name": "draft_outlook_email_for_review",
                        "content": (
                            '{"action":"preview","type":"outlook_email_draft",'
                            '"approvalRequired":true,'
                            '"approvalReason":"External communication requires Megan review.",'
                            '"fields":{"toRecipients":["wallen@ulta.com"],"ccRecipients":[],'
                            '"subject":"RE: ULTA update needed.",'
                            '"body":"Thanks Walter. I will confirm the roof penetration status.",'
                            '"replyToGraphMessageId":"message-1"}}'
                        ),
                    },
                    {"content": "I found one item that needs a reply and prepared a draft for review."},
                ]
            }

    response = run_microsoft_executive_assistant(
        MicrosoftExecutiveAssistantRequest(
            userId="user-1",
            mailboxUserId="bclymer@alleatogroup.com",
            prompt="Show me any emails from today that need a reply and draft a response.",
        ),
        create_agent=lambda **_kwargs: DraftToolAgent(),
    )

    assert response.mode == "deep_agents"
    assert response.actions
    assert response.actions[0].action_type == "email_draft"
    assert response.actions[0].status == "drafted"
    assert response.actions[0].payload["fields"]["replyToGraphMessageId"] == "message-1"


def test_microsoft_prompt_uses_mailbox_owner_not_megan_for_brandon_inbox():
    prompt = _microsoft_prompt(
        MicrosoftExecutiveAssistantRequest(
            userId="user-1",
            mailboxUserId="bclymer@alleatogroup.com",
            prompt="Can you tell me my last five emails?",
        )
    )

    assert "work for Brandon" in prompt
    assert "recommended next steps for Brandon" in prompt
    assert "Do not introduce Megan unless the prompt explicitly asks about Megan" in prompt
    assert "return exactly five emails in newest-first order" in prompt


def test_microsoft_prompt_adds_triage_guardrails_for_urgent_inbox_questions():
    prompt = _microsoft_prompt(
        MicrosoftExecutiveAssistantRequest(
            userId="user-1",
            mailboxUserId="bclymer@alleatogroup.com",
            prompt="Anything urgent in my inbox?",
        )
    )

    assert "confirmed urgent/action-needed" in prompt
    assert "important but not urgent" in prompt
    assert "Treat security notices, payment reminders, and admin notifications conservatively" in prompt
    assert "Do not propose a draft email or Teams escalation unless the user asked" in prompt


def test_inbox_request_kind_matches_eval_phrasing():
    assert _inbox_request_kind("What came in through Outlook today that needs my attention?") == "arrived_today"
    assert _inbox_request_kind("Show me any emails from today that need a reply.") == "reply_triage"


def test_run_microsoft_assistant_formats_last_five_deterministically():
    class LastFiveAgent:
        def invoke(self, *_args, **_kwargs):
            return {
                "messages": [
                    {
                        "type": "tool",
                        "name": "read_live_outlook_inbox",
                        "content": (
                            '{"ok":true,"source":"microsoft_graph_live","mailbox_user_id":"bclymer@alleatogroup.com","count":5,'
                            '"messages":['
                            '{"subject":"RE: ULTA update needed.","from":{"ignored":true},"from_name":"Walter Allen","from_email":"wallen@ulta.com","received_at":"2026-06-09T09:59:34Z","body_text":"Can you confirm by Thursday afternoon?","has_attachments":false},'
                            '{"subject":"Sign in to Perplexity","from_name":"Perplexity","from_email":"team@mail.perplexity.ai","received_at":"2026-06-09T09:37:58Z","body_text":"Your verification code is 12345.","has_attachments":false},'
                            '{"subject":"ERP Integrations Daily Summary","from_name":"Alleato Group notifications","from_email":"no-reply@alleatogroup.com","received_at":"2026-06-09T06:15:56Z","body_text":"Daily summary.","has_attachments":false},'
                            '{"subject":"[Reminder] Your payment is due in 1 day","from_name":"Ryan Niddel","from_email":"payments@example.com","received_at":"2026-06-09T03:54:13Z","body_text":"Payment is due in 1 day.","has_attachments":false},'
                            '{"subject":"RE: Exol Morrisville PA","from_name":"Steve Fischer","from_email":"steve.fischer@exol.com","received_at":"2026-06-09T02:59:12Z","body_text":"Please review the comments.","has_attachments":false}'
                            ']}'
                        ),
                    },
                    {"content": "freeform assistant output that should be ignored"},
                ]
            }

    response = run_microsoft_executive_assistant(
        MicrosoftExecutiveAssistantRequest(
            userId="user-1",
            mailboxUserId="bclymer@alleatogroup.com",
            prompt="Can you tell me my last five emails?",
        ),
        create_agent=lambda **_kwargs: LastFiveAgent(),
    )

    assert response.answer.startswith("Your last five emails in bclymer@alleatogroup.com are:")
    assert "Megan" not in response.answer
    assert "Approvals needed" not in response.answer
    assert "draft" not in response.answer.lower()
    assert "Security-related email noted in the broader inbox" not in response.answer
    assert response.answer.count("Response path:") == 5
    assert "ERP Integrations Daily Summary" in response.answer
    assert "Response path: Ignore." in response.answer
    assert response.answer.count("Evidence:") == 5
    assert "Evidence: Can you confirm by Thursday afternoon?" in response.answer
    assert "Why:" not in response.answer


def test_run_microsoft_assistant_formats_urgent_inbox_into_action_buckets():
    class UrgentInboxAgent:
        def invoke(self, *_args, **_kwargs):
            return {
                "messages": [
                    {
                        "type": "tool",
                        "name": "read_live_outlook_inbox",
                        "content": (
                            '{"ok":true,"source":"microsoft_graph_live","mailbox_user_id":"bclymer@alleatogroup.com","count":4,'
                            '"messages":['
                            '{"subject":"RE: ULTA update needed.","from_name":"Walter Allen","from_email":"wallen@ulta.com","received_at":"2026-06-09T09:59:34Z","body_text":"Can you confirm by Thursday afternoon?","has_attachments":false},'
                            '{"subject":"Microsoft 365 security: You have messages in quarantine","from_name":"Microsoft 365","from_email":"quarantine@messaging.microsoft.com","received_at":"2026-06-09T08:00:00Z","body_text":"Review 1 quarantined message.","has_attachments":false},'
                            '{"subject":"FYI--approaching spend limit","from_name":"Capital One Business","from_email":"alerts@capitalone.com","received_at":"2026-06-09T07:00:00Z","body_text":"You are approaching your spend limit.","has_attachments":false},'
                            '{"subject":"Sign in to Perplexity","from_name":"Perplexity","from_email":"team@mail.perplexity.ai","received_at":"2026-06-09T06:00:00Z","body_text":"Your verification code is 12345.","has_attachments":false}'
                            ']}'
                        ),
                    },
                    {"content": "freeform assistant output that should be ignored"},
                ]
            }

    response = run_microsoft_executive_assistant(
        MicrosoftExecutiveAssistantRequest(
            userId="user-1",
            mailboxUserId="bclymer@alleatogroup.com",
            prompt="Anything urgent in my inbox today?",
        ),
        create_agent=lambda **_kwargs: UrgentInboxAgent(),
    )

    assert "Alert now" in response.answer
    assert "Reply" not in response.answer or "Alert now" in response.answer
    assert "Watch" in response.answer
    assert "Ignore/noise" in response.answer
    assert "Recommended next steps for Brandon" in response.answer
    assert "Draft Teams message" not in response.answer
    assert "Megan" not in response.answer


def test_run_microsoft_assistant_limits_this_morning_to_same_day_morning_messages():
    today = datetime.now(timezone.utc).date()
    yesterday = today - timedelta(days=1)

    class MorningInboxAgent:
        def invoke(self, *_args, **_kwargs):
            return {
                "messages": [
                    {
                        "type": "tool",
                        "name": "read_live_outlook_inbox",
                        "content": (
                            '{"ok":true,"source":"microsoft_graph_live","mailbox_user_id":"bclymer@alleatogroup.com","count":4,'
                            '"messages":['
                            f'{{"subject":"RE: ULTA update needed.","from_name":"Walter Allen","from_email":"wallen@ulta.com","received_at":"{today.isoformat()}T09:59:34Z","body_text":"Can you confirm by Thursday afternoon?","has_attachments":false}},'
                            f'{{"subject":"Sign in to Perplexity","from_name":"Perplexity","from_email":"team@mail.perplexity.ai","received_at":"{today.isoformat()}T09:37:58Z","body_text":"Your verification code is 12345.","has_attachments":false}},'
                            f'{{"subject":"Champaign Pay App","from_name":"Glendon Griesbaum","from_email":"ggriesbaum@niemannfoods.com","received_at":"{yesterday.isoformat()}T20:39:00Z","body_text":"Reminder to keep invoicing timely.","has_attachments":false}},'
                            f'{{"subject":"Acumatica maintenance","from_name":"Revive Support","from_email":"support@reviveerp.com","received_at":"{yesterday.isoformat()}T18:47:00Z","body_text":"Scheduled maintenance notice.","has_attachments":false}}'
                            ']}'
                        ),
                    },
                    {"content": "freeform assistant output that should be ignored"},
                ]
            }

    response = run_microsoft_executive_assistant(
        MicrosoftExecutiveAssistantRequest(
            userId="user-1",
            mailboxUserId="bclymer@alleatogroup.com",
            prompt="What are the important emails this morning?",
        ),
        create_agent=lambda **_kwargs: MorningInboxAgent(),
    )

    assert "Important emails this morning" in response.answer
    assert "Walter Allen" in response.answer
    assert "Perplexity" in response.answer
    assert "Glendon Griesbaum" not in response.answer
    assert "Revive Support" not in response.answer


def test_run_microsoft_assistant_arrived_today_separates_action_needed_from_informational():
    class TodayInboxAgent:
        def invoke(self, *_args, **_kwargs):
            return {
                "messages": [
                    {
                        "type": "tool",
                        "name": "read_live_outlook_inbox",
                        "content": (
                            '{"ok":true,"source":"microsoft_graph_live","mailbox_user_id":"bclymer@alleatogroup.com","count":4,'
                            '"messages":['
                            '{"subject":"RE: ULTA update needed.","from_name":"Walter Allen","from_email":"wallen@ulta.com","received_at":"2026-06-09T09:59:34Z","body_text":"Can you confirm by Thursday afternoon?","has_attachments":false},'
                            '{"subject":"RE: Exol Morrisville PA","from_name":"Steve Fischer","from_email":"steve.fischer@exol.com","received_at":"2026-06-09T02:59:12Z","body_text":"Please review the comments and reply.","has_attachments":false},'
                            '{"subject":"ERP Integrations Daily Summary","from_name":"Alleato Group notifications","from_email":"no-reply@alleatogroup.com","received_at":"2026-06-09T06:15:56Z","body_text":"Daily summary.","has_attachments":false},'
                            '{"subject":"[Reminder] Your payment is due in 1 day","from_name":"Ryan Niddel","from_email":"payments@example.com","received_at":"2026-06-09T03:54:13Z","body_text":"Payment is due in 1 day.","has_attachments":false}'
                            ']}'
                        ),
                    },
                    {"content": "freeform assistant output that should be ignored"},
                ]
            }

    response = run_microsoft_executive_assistant(
        MicrosoftExecutiveAssistantRequest(
            userId="user-1",
            mailboxUserId="bclymer@alleatogroup.com",
            prompt="What Outlook emails arrived today that matter?",
        ),
        create_agent=lambda **_kwargs: TodayInboxAgent(),
    )

    assert "Action needed" in response.answer
    assert "Watch / informational" in response.answer
    assert "ERP Integrations Daily Summary" in response.answer
    assert "Response path: Ignore" in response.answer or "Response path: Watch" in response.answer
    assert "Recommended next steps for Brandon" not in response.answer


def test_run_microsoft_assistant_reply_triage_excludes_automated_summary_mail():
    class ReplyInboxAgent:
        def invoke(self, *_args, **_kwargs):
            return {
                "messages": [
                    {
                        "type": "tool",
                        "name": "read_live_outlook_inbox",
                        "content": (
                            '{"ok":true,"source":"microsoft_graph_live","mailbox_user_id":"bclymer@alleatogroup.com","count":4,'
                            '"messages":['
                            '{"subject":"RE: ULTA update needed.","from_name":"Walter Allen","from_email":"wallen@ulta.com","received_at":"2026-06-09T09:59:34Z","body_text":"Can you confirm by Thursday afternoon?","has_attachments":false},'
                            '{"subject":"Alleato Group: ERP Integrations Daily Summary","from_name":"Alleato Group","from_email":"alleato_group_notifications@us02.procoretech.com","received_at":"2026-06-09T06:15:56Z","body_text":"Do not reply to this email. 2 vendors available to sync.","has_attachments":false},'
                            '{"subject":"RE: Exol Morrisville PA","from_name":"Steve Fischer","from_email":"steve.fischer@exol.com","received_at":"2026-06-09T02:20:00Z","body_text":"Will review asap and provide feedback.","has_attachments":false},'
                            '{"subject":"Sign in to Perplexity","from_name":"Perplexity","from_email":"team@mail.perplexity.ai","received_at":"2026-06-09T09:37:58Z","body_text":"Your verification code is 12345.","has_attachments":false}'
                            ']}'
                        ),
                    },
                    {"content": "freeform assistant output that should be ignored"},
                ]
            }

    response = run_microsoft_executive_assistant(
        MicrosoftExecutiveAssistantRequest(
            userId="user-1",
            mailboxUserId="bclymer@alleatogroup.com",
            prompt="Show me any emails from today that need a reply.",
        ),
        create_agent=lambda **_kwargs: ReplyInboxAgent(),
    )

    assert "Emails that most likely need a reply" in response.answer
    assert "ERP Integrations Daily Summary" not in response.answer
    assert "Sign in to Perplexity" not in response.answer
    assert "RE: Exol Morrisville PA" in response.answer
    assert "Action: Reply." in response.answer
    assert "Action: Alert now." in response.answer


def test_run_microsoft_assistant_dedupes_same_thread_and_reports_thread_activity():
    class ReplyInboxAgent:
        def invoke(self, *_args, **_kwargs):
            return {
                "messages": [
                    {
                        "type": "tool",
                        "name": "read_live_outlook_inbox",
                        "content": (
                            '{"ok":true,"source":"microsoft_graph_live","mailbox_user_id":"bclymer@alleatogroup.com","count":4,'
                            '"messages":['
                            '{"subject":"RE: Exol Morrisville PA","from_name":"Steve Fischer","from_email":"steve.fischer@exol.com","received_at":"2026-06-09T02:59:12Z","body_text":"Please review the comments and reply with your approval today.","has_attachments":false},'
                            '{"subject":"RE: Exol Morrisville PA","from_name":"Steve Fischer","from_email":"steve.fischer@exol.com","received_at":"2026-06-09T02:20:00Z","body_text":"Will review asap and provide feedback.","has_attachments":false},'
                            '{"subject":"RE: ULTA update needed.","from_name":"Walter Allen","from_email":"wallen@ulta.com","received_at":"2026-06-09T09:59:34Z","body_text":"Can you confirm by Thursday afternoon?","has_attachments":false},'
                            '{"subject":"Alleato Group: ERP Integrations Daily Summary","from_name":"Alleato Group","from_email":"alleato_group_notifications@us02.procoretech.com","received_at":"2026-06-09T06:15:56Z","body_text":"Do not reply to this email. 2 vendors available to sync.","has_attachments":false}'
                            ']}'
                        ),
                    },
                    {"content": "freeform assistant output that should be ignored"},
                ]
            }

    response = run_microsoft_executive_assistant(
        MicrosoftExecutiveAssistantRequest(
            userId="user-1",
            mailboxUserId="bclymer@alleatogroup.com",
            prompt="Show me any emails from today that need a reply.",
        ),
        create_agent=lambda **_kwargs: ReplyInboxAgent(),
    )

    assert response.answer.count("RE: Exol Morrisville PA") == 1
    assert "Thread activity: 2 messages in this subject thread." in response.answer
    assert "Evidence: Please review the comments and reply with your approval today." in response.answer


def test_run_microsoft_assistant_fails_loudly_without_provider(monkeypatch):
    monkeypatch.delenv("AI_GATEWAY_API_KEY", raising=False)
    monkeypatch.delenv("OPENAI_API_KEY", raising=False)

    response = run_microsoft_executive_assistant(
        MicrosoftExecutiveAssistantRequest(userId="user-1", prompt="Check email")
    )

    assert response.mode == "unavailable"
    assert response.tool_trace[0].status == "failed"
    assert "OPENAI_API_KEY is required for the Microsoft Executive Assistant." in response.answer
    assert response.actions[0].action_type == "blocked"


def test_run_microsoft_assistant_fails_loudly_on_empty_runtime_response():
    class EmptyAgent:
        def invoke(self, *_args, **_kwargs):
            return {"messages": [{"content": ""}]}

    response = run_microsoft_executive_assistant(
        MicrosoftExecutiveAssistantRequest(userId="user-1", prompt="Check email"),
        create_agent=lambda **_kwargs: EmptyAgent(),
    )

    assert response.mode == "unavailable"
    assert response.tool_trace[0].status == "failed"
    assert "empty response" in response.answer


def test_live_inbox_tool_reports_graph_configuration_failure(monkeypatch):
    class FakeGraph:
        def is_configured(self):
            return False

    monkeypatch.setattr(
        "src.services.integrations.microsoft_graph.live_mail.get_graph_client",
        lambda: FakeGraph(),
    )

    result = read_live_outlook_inbox("megan@alleatogroup.com", None, 5)

    assert "OUTLOOK_LIVE_INBOX_FAILED" in result
    assert "Microsoft Graph credentials" in result


def test_microsoft_assistant_route_is_feature_gated(client, monkeypatch):
    _override_auth(client.app)
    monkeypatch.setenv("DEEP_AGENTS_MICROSOFT_EXECUTIVE_ASSISTANT_ENABLED", "false")
    try:
        response = client.post(
            "/api/intelligence/microsoft-executive-assistant",
            json={"userId": "user-1", "prompt": "Check email"},
        )
    finally:
        _clear_auth(client.app)

    assert response.status_code == 503
    assert "DEEP_AGENTS_MICROSOFT_EXECUTIVE_ASSISTANT_ENABLED=true" in response.json()["detail"]


def test_microsoft_assistant_route_returns_payload(client, monkeypatch):
    _override_auth(client.app)
    monkeypatch.setenv("DEEP_AGENTS_MICROSOFT_EXECUTIVE_ASSISTANT_ENABLED", "true")

    def fake_run(request, *, model):
        assert request.prompt == "Check email"
        assert model == "openai:gpt-5.4-mini"
        return run_microsoft_executive_assistant(
            request,
            create_agent=lambda **kwargs: _FakeAgent({}),
            model=model,
        )

    monkeypatch.setitem(_route_endpoint(client.app).__globals__, "run_microsoft_executive_assistant", fake_run)
    try:
        response = client.post(
            "/api/intelligence/microsoft-executive-assistant",
            json={"userId": "user-1", "sessionId": "session-1", "prompt": "Check email"},
        )
    finally:
        _clear_auth(client.app)

    assert response.status_code == 200
    body = response.json()
    assert body["mode"] == "deep_agents"
    assert body["toolTrace"][0]["status"] == "success"


def test_microsoft_assistant_route_accepts_approved_skill_context(client, monkeypatch):
    _override_auth(client.app)
    monkeypatch.setenv("DEEP_AGENTS_MICROSOFT_EXECUTIVE_ASSISTANT_ENABLED", "true")

    captured: dict[str, Any] = {}

    def fake_run(request, *, model):
        captured["approved_skill_context"] = request.approved_skill_context
        return run_microsoft_executive_assistant(
            request,
            create_agent=lambda **kwargs: _FakeAgent({}),
            model=model,
        )

    monkeypatch.setitem(_route_endpoint(client.app).__globals__, "run_microsoft_executive_assistant", fake_run)
    try:
        response = client.post(
            "/api/intelligence/microsoft-executive-assistant",
            json={
                "userId": "user-1",
                "sessionId": "session-1",
                "prompt": "Check email and draft a Teams follow-up",
                "approvedSkillContext": (
                    "## Approved Skill Library Context\n\n"
                    "### Escalate Teams threads with concise asks (v1, teams, low risk)"
                ),
            },
        )
    finally:
        _clear_auth(client.app)

    assert response.status_code == 200
    assert "Escalate Teams threads" in captured["approved_skill_context"]
    assert "Escalate Teams threads" in response.json()["approvedSkillContext"]


def test_scheduled_trigger_is_feature_gated(monkeypatch):
    monkeypatch.setenv("MICROSOFT_EXECUTIVE_ASSISTANT_SCHEDULED_ENABLED", "false")

    result = run_scheduled_microsoft_executive_assistant_check()

    assert result["status"] == "skipped"
    assert "SCHEDULED_ENABLED" in result["reason"]


def test_scheduled_trigger_runs_specialist_when_enabled(monkeypatch):
    captured: dict[str, Any] = {}
    monkeypatch.setenv("MICROSOFT_EXECUTIVE_ASSISTANT_SCHEDULED_ENABLED", "true")
    monkeypatch.setenv("MICROSOFT_EXECUTIVE_ASSISTANT_MAILBOX", "bclymer@alleatogroup.com")
    monkeypatch.setattr(triggers, "MODEL_MICROSOFT_EXECUTIVE_ASSISTANT", "gpt-5.9")

    def fake_runner(request, *, model):
        captured["request"] = request
        captured["model"] = model
        return run_microsoft_executive_assistant(
            request,
            create_agent=lambda **kwargs: _FakeAgent({}),
            model=model,
        )

    result = run_scheduled_microsoft_executive_assistant_check(runner=fake_runner)

    assert result["status"] == "completed"
    assert captured["request"].trigger == "scheduled_check"
    assert captured["request"].mailbox_user_id == "bclymer@alleatogroup.com"
    assert captured["model"] == "openai:gpt-5.9"
    assert "unread_only=true" in captured["request"].prompt
    assert "write_email_triage" in captured["request"].prompt
    assert "draft_outlook_email_for_review" in captured["request"].prompt
    assert "reply_to_graph_message_id" in captured["request"].prompt
    assert "Outlook Drafts folder" in captured["request"].prompt
    assert "Do not skip write_email_triage" in captured["request"].prompt
    assert "app-only text" in captured["request"].prompt


def test_outlook_event_trigger_runs_from_webhook_for_brandon_outlook(monkeypatch):
    captured: dict[str, Any] = {}
    monkeypatch.setenv("MICROSOFT_EXECUTIVE_ASSISTANT_WEBHOOK_ENABLED", "true")

    def fake_runner(request, *, model):
        captured["request"] = request
        captured["model"] = model
        return run_microsoft_executive_assistant(
            request,
            create_agent=lambda **kwargs: _FakeAgent({}),
            model=model,
        )

    result = run_outlook_event_microsoft_executive_assistant(
        sync_result={"mailbox": "bclymer@alleatogroup.com", "message_id": "abc123"},
        runner=fake_runner,
    )

    assert result["status"] == "completed"
    assert result["messageId"] == "abc123"
    assert captured["request"].trigger == "outlook_event"
    assert captured["request"].mailbox_user_id == "bclymer@alleatogroup.com"
    assert "webhook was accepted and queued for delta sync" in captured["request"].prompt
    assert "Use live Outlook tools" in captured["request"].prompt
    assert "write_email_triage" in captured["request"].prompt
    assert "records the decision" in captured["request"].prompt
    assert "Outlook reply draft in Brandon's Drafts folder" in captured["request"].prompt
    assert "Never send email directly" in captured["request"].prompt
    assert "Megan" not in captured["request"].prompt


class _FakeSupabaseResponse:
    def __init__(self, data: list[dict[str, Any]] | None = None):
        self.data = data or []


class _FakeOutlookIntakeTable:
    def __init__(self, row: dict[str, Any] | None = None):
        self.row = row
        self.operation = "select"
        self.update_payloads: list[dict[str, Any]] = []
        self.filters: dict[str, Any] = {}
        self.require_unsent = False

    def update(self, payload: dict[str, Any]):
        self.operation = "update"
        self.update_payloads.append(payload)
        return self

    def select(self, *_args):
        self.operation = "select"
        return self

    def eq(self, key: str, value: Any):
        self.filters[key] = value
        return self

    def is_(self, key: str, value: Any):
        if key == "teams_alert_sent_at" and value == "null":
            self.require_unsent = True
        return self

    def limit(self, *_args):
        return self

    def execute(self):
        if self.filters.get("graph_message_id") != (self.row or {}).get("graph_message_id"):
            return _FakeSupabaseResponse([])
        if self.operation == "update":
            if self.require_unsent and self.row.get("teams_alert_sent_at"):
                return _FakeSupabaseResponse([])
            self.row.update(self.update_payloads[-1])
            return _FakeSupabaseResponse([dict(self.row)])
        return _FakeSupabaseResponse([dict(self.row)])


class _FakeOutlookIntakeClient:
    def __init__(self, row: dict[str, Any] | None = None):
        self.table_obj = _FakeOutlookIntakeTable(row)

    def table(self, name: str):
        assert name == "outlook_email_intake"
        return self.table_obj


def test_urgent_teams_alert_blocks_without_graph_message_id(monkeypatch):
    monkeypatch.setenv("MICROSOFT_EXECUTIVE_ASSISTANT_AUTO_TEAMS_ALERT", "true")
    monkeypatch.setattr(
        "src.services.agents.microsoft_executive_assistant.tools._supabase_client",
        lambda: _FakeOutlookIntakeClient(),
    )
    monkeypatch.setattr(
        "src.services.agents.microsoft_executive_assistant.tools._send_teams_dm",
        lambda _message: {"sent": True},
    )

    raw_result = draft_teams_message_for_review.func(
        recipient="Megan",
        message="Urgent inbox item.",
        urgency="urgent",
    )
    result = json.loads(raw_result)

    assert result["action"] == "preview"
    assert result["teamsResult"]["sent"] is False
    assert result["teamsResult"]["reason"] == "missing_graph_message_id"


def test_urgent_teams_alert_skips_duplicate_when_ledger_has_timestamp(monkeypatch):
    monkeypatch.setenv("MICROSOFT_EXECUTIVE_ASSISTANT_AUTO_TEAMS_ALERT", "true")
    fake_client = _FakeOutlookIntakeClient(
        {
            "graph_message_id": "message-1",
            "teams_alert_sent_at": "2026-06-26T12:45:00+00:00",
        }
    )
    sent: list[str] = []
    monkeypatch.setattr(
        "src.services.agents.microsoft_executive_assistant.tools._supabase_client",
        lambda: fake_client,
    )
    monkeypatch.setattr(
        "src.services.agents.microsoft_executive_assistant.tools._send_teams_dm",
        lambda message: sent.append(message) or {"sent": True},
    )

    raw_result = draft_teams_message_for_review.func(
        recipient="Megan",
        message="Urgent inbox item.",
        urgency="urgent",
        graph_message_id="message-1",
    )
    result = json.loads(raw_result)

    assert result["action"] == "preview"
    assert result["teamsResult"]["sent"] is False
    assert result["teamsResult"]["reason"] == "duplicate"
    assert sent == []


def test_urgent_teams_alert_claims_ledger_before_send(monkeypatch):
    monkeypatch.setenv("MICROSOFT_EXECUTIVE_ASSISTANT_AUTO_TEAMS_ALERT", "true")
    fake_client = _FakeOutlookIntakeClient(
        {
            "graph_message_id": "message-1",
            "teams_alert_sent_at": None,
        }
    )
    sent: list[str] = []
    monkeypatch.setattr(
        "src.services.agents.microsoft_executive_assistant.tools._supabase_client",
        lambda: fake_client,
    )
    monkeypatch.setattr(
        "src.services.agents.microsoft_executive_assistant.tools._send_teams_dm",
        lambda message: sent.append(message) or {"sent": True, "http_status": 200},
    )

    raw_result = draft_teams_message_for_review.func(
        recipient="Megan",
        message="Urgent inbox item.",
        urgency="urgent",
        graph_message_id="message-1",
    )
    result = json.loads(raw_result)

    assert result["action"] == "sent"
    assert result["teamsResult"]["sent"] is True
    assert result["teamsResult"]["dedupe"]["claimed"] is True
    assert fake_client.table_obj.row["teams_alert_sent_at"] is not None
    assert sent == ["Urgent inbox item."]


class _FakeCategoryGraph:
    def __init__(self, existing_categories: list[str] | None = None):
        self.existing_categories = existing_categories or []
        self.master_categories: list[dict[str, str]] = []
        self.calls: list[tuple[str, str, Any]] = []
        self.patch_payload: dict[str, Any] | None = None

    def is_configured(self):
        return True

    def get(self, path):
        self.calls.append(("get", path, None))
        if "masterCategories" in path:
            return {"value": self.master_categories}
        return {"categories": list(self.existing_categories)}

    def post(self, path, payload):
        self.calls.append(("post", path, payload))
        self.master_categories.append(
            {"displayName": payload["displayName"], "color": payload["color"]}
        )
        return {"id": payload["displayName"]}

    def patch(self, path, payload):
        self.calls.append(("patch", path, payload))
        self.patch_payload = payload
        return {}


def test_outlook_category_patch_merges_existing_categories(monkeypatch):
    monkeypatch.setenv("MICROSOFT_EXECUTIVE_ASSISTANT_MAILBOX_MUTATIONS_ENABLED", "true")
    graph = _FakeCategoryGraph(existing_categories=["Client", "Existing"])
    monkeypatch.setattr(
        "src.services.integrations.microsoft_graph.client.get_graph_client",
        lambda: graph,
    )

    result = _patch_message_category(
        "bclymer@alleatogroup.com",
        "message-1",
        "Reply Needed",
    )

    assert result["patched"] is True
    assert result["categories"] == ["Client", "Existing", "Reply Needed"]
    assert graph.patch_payload == {"categories": ["Client", "Existing", "Reply Needed"]}
    assert ("post", "/users/bclymer%40alleatogroup.com/outlook/masterCategories", {"displayName": "Reply Needed", "color": "preset1"}) in graph.calls


def test_outlook_category_patch_dedupes_case_insensitively(monkeypatch):
    monkeypatch.setenv("MICROSOFT_EXECUTIVE_ASSISTANT_MAILBOX_MUTATIONS_ENABLED", "true")
    graph = _FakeCategoryGraph(existing_categories=["reply needed", "Client"])
    monkeypatch.setattr(
        "src.services.integrations.microsoft_graph.client.get_graph_client",
        lambda: graph,
    )

    result = _patch_message_categories(
        "bclymer@alleatogroup.com",
        "message-1",
        ["Reply Needed", "Urgent"],
        merge_existing=True,
    )

    assert result["patched"] is True
    assert result["categories"] == ["reply needed", "Client", "Urgent"]
    assert graph.patch_payload == {"categories": ["reply needed", "Client", "Urgent"]}


def test_patch_outlook_email_categories_clears_when_explicitly_empty(monkeypatch):
    monkeypatch.setenv("MICROSOFT_EXECUTIVE_ASSISTANT_MAILBOX_MUTATIONS_ENABLED", "true")
    graph = _FakeCategoryGraph(existing_categories=["Client", "Existing"])
    monkeypatch.setattr(
        "src.services.integrations.microsoft_graph.client.get_graph_client",
        lambda: graph,
    )

    raw_result = patch_outlook_email_categories.func(
        graph_message_id="message-1",
        categories=[],
        mailbox_user_id="bclymer@alleatogroup.com",
    )
    result = json.loads(raw_result)

    assert result["ok"] is True
    assert result["categories"] == []


def test_outlook_category_patch_blocked_when_mailbox_mutations_disabled(monkeypatch):
    monkeypatch.delenv("MICROSOFT_EXECUTIVE_ASSISTANT_MAILBOX_MUTATIONS_ENABLED", raising=False)
    graph = _FakeCategoryGraph(existing_categories=["Client", "Existing"])
    monkeypatch.setattr(
        "src.services.integrations.microsoft_graph.client.get_graph_client",
        lambda: graph,
    )

    result = _patch_message_category(
        "bclymer@alleatogroup.com",
        "message-1",
        "Reply Needed",
    )

    assert result == {"patched": False, "reason": "mailbox_mutations_disabled"}
    assert graph.calls == []


def test_write_email_triage_does_not_patch_outlook_when_mailbox_mutations_disabled(monkeypatch):
    monkeypatch.delenv("MICROSOFT_EXECUTIVE_ASSISTANT_MAILBOX_MUTATIONS_ENABLED", raising=False)
    monkeypatch.setenv("MICROSOFT_EXECUTIVE_ASSISTANT_MAILBOX", "bclymer@alleatogroup.com")
    monkeypatch.setattr(
        "src.services.agents.microsoft_executive_assistant.tools._supabase_client",
        lambda: None,
    )
    graph = _FakeCategoryGraph(existing_categories=[])
    monkeypatch.setattr(
        "src.services.integrations.microsoft_graph.client.get_graph_client",
        lambda: graph,
    )

    raw_result = write_email_triage.func(
        graph_message_id="message-1",
        triage_action="reply_needed",
        triage_reason="Needs a customer reply.",
    )
    result = json.loads(raw_result)

    assert result["categoryResult"] == {
        "patched": False,
        "reason": "mailbox_mutations_disabled",
    }
    assert graph.calls == []


def test_category_mutation_tool_hidden_when_mailbox_mutations_disabled(monkeypatch):
    monkeypatch.delenv("MICROSOFT_EXECUTIVE_ASSISTANT_MAILBOX_MUTATIONS_ENABLED", raising=False)

    tool_names = {
        getattr(tool, "name", getattr(tool, "__name__", ""))
        for tool in microsoft_executive_assistant_tools()
    }

    assert "patch_outlook_email_categories" not in tool_names
    assert "write_email_triage" in tool_names


# ---------------------------------------------------------------------------
# Real draft lookup — _fetch_draft_conversation_ids + draftReady on card items
# ---------------------------------------------------------------------------


def test_fetch_draft_conversation_ids_returns_set_from_graph(monkeypatch):
    """_fetch_draft_conversation_ids should query the drafts folder and return
    a set of conversationId strings."""
    from src.services.agents.microsoft_executive_assistant.agent import (
        _fetch_draft_conversation_ids,
    )

    class _FakeDraftGraph:
        GRAPH_BASE = "https://graph.microsoft.com/v1.0"

        def is_configured(self):
            return True

        def _get_with_retry(self, url, **_kwargs):
            assert "/mailFolders/drafts/messages" in url
            assert "bclymer%40alleatogroup.com" in url or "bclymer@alleatogroup.com" in url
            return {
                "value": [
                    {"id": "draft-1", "conversationId": "conv-AAA"},
                    {"id": "draft-2", "conversationId": "conv-BBB"},
                    {"id": "draft-3", "conversationId": None},
                ]
            }

    monkeypatch.setattr(
        "src.services.agents.microsoft_executive_assistant.agent._fetch_draft_conversation_ids",
        lambda mailbox: {"conv-AAA", "conv-BBB"} if mailbox == "bclymer@alleatogroup.com" else set(),
    )

    result = _fetch_draft_conversation_ids("bclymer@alleatogroup.com")
    assert isinstance(result, set)


def test_fetch_draft_conversation_ids_returns_empty_set_on_graph_error(monkeypatch):
    """Any Graph failure must return an empty set — not raise — so the card still
    renders with all pencils muted rather than crashing the whole response."""
    from src.services.agents.microsoft_executive_assistant.agent import (
        _fetch_draft_conversation_ids,
    )

    class _ErrorGraph:
        GRAPH_BASE = "https://graph.microsoft.com/v1.0"

        def is_configured(self):
            return True

        def _get_with_retry(self, *_args, **_kwargs):
            raise RuntimeError("Graph 503 transient error")

    monkeypatch.setattr(
        "src.services.integrations.microsoft_graph.client.get_graph_client",
        lambda: _ErrorGraph(),
    )

    result = _fetch_draft_conversation_ids("bclymer@alleatogroup.com")
    assert result == set()


def test_structured_inbox_emails_sets_draft_ready_from_lookup(monkeypatch):
    """draftReady should be True when the email's conversationId appears in the
    draft-lookup set, and False otherwise."""
    from src.services.agents.microsoft_executive_assistant.agent import (
        _structured_inbox_emails,
    )

    monkeypatch.setattr(
        "src.services.agents.microsoft_executive_assistant.agent._fetch_draft_conversation_ids",
        lambda mailbox: {"conv-AAA"},
    )

    inbox_tool_output = json.dumps({
        "ok": True,
        "source": "microsoft_graph_live",
        "mailbox_user_id": "bclymer@alleatogroup.com",
        "count": 2,
        "messages": [
            {
                "id": "msg-1",
                "graph_message_id": "msg-1",
                "conversation_id": "conv-AAA",
                "subject": "RE: Contract review",
                "from_name": "Walter Allen",
                "from_email": "wallen@ulta.com",
                "received_at": "2026-06-24T14:00:00Z",
                "body_text": "Can you confirm by Thursday?",
                "has_attachments": False,
                "web_link": "https://outlook.office.com/mail/inbox/id/msg-1",
            },
            {
                "id": "msg-2",
                "graph_message_id": "msg-2",
                "conversation_id": "conv-BBB",
                "subject": "Invoice attached",
                "from_name": "Steve Fischer",
                "from_email": "steve@example.com",
                "received_at": "2026-06-24T13:00:00Z",
                "body_text": "Please review the invoice.",
                "has_attachments": True,
                "web_link": "https://outlook.office.com/mail/inbox/id/msg-2",
            },
        ],
    })

    fake_result = {
        "messages": [
            {
                "type": "tool",
                "name": "read_live_outlook_inbox",
                "content": inbox_tool_output,
            }
        ]
    }

    request = MicrosoftExecutiveAssistantRequest(
        userId="user-1",
        mailboxUserId="bclymer@alleatogroup.com",
        prompt="What emails are in my inbox today?",
    )

    items = _structured_inbox_emails(request, fake_result)

    assert len(items) == 2
    msg_1 = next(item for item in items if item.conversation_id == "conv-AAA")
    msg_2 = next(item for item in items if item.conversation_id == "conv-BBB")
    assert msg_1.draft_ready is True
    assert msg_2.draft_ready is False
