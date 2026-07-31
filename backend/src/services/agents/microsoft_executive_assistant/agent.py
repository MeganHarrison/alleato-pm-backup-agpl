"""Microsoft Executive Assistant Deep Agents runtime."""

from __future__ import annotations

import json
import os
import re
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Callable, Optional

from src.services.agents.runtime_common import (
    extract_agent_text as _extract_agent_text,
    resolve_deep_agents_model as _resolve_deep_agents_model,
)
from src.services.agents.microsoft_executive_assistant.contracts import (
    MicrosoftAssistantAction,
    MicrosoftAssistantEmailItem,
    MicrosoftAssistantTraceItem,
    MicrosoftExecutiveAssistantRequest,
    MicrosoftExecutiveAssistantResponse,
)
from src.services.agents.microsoft_executive_assistant.tools import (
    microsoft_executive_assistant_tools,
)


ORCHESTRATOR_NAME = "microsoft-executive-assistant"
RUNTIME_DIR = Path(__file__).resolve().parent / "runtime"


def _voice_prompt() -> str:
    """Identity + soul shared with the main Alleato AI so the specialist answers
    in the same voice rather than a separate compliance tone. Falls back to a
    concise inline voice if the shared prompt files can't be loaded."""
    try:
        from src.services.agents.alleato_ai_tools.prompts import (
            IDENTITY_PROMPT,
            SOUL_PROMPT,
        )

        return f"{IDENTITY_PROMPT}\n\n{SOUL_PROMPT}\n\n"
    except Exception:
        return (
            "You are Alleato AI: a direct, grounded, useful advisor. Bottom line "
            "first, no filler, no corporate polish. Say what you found and the next move.\n\n"
        )


_MICROSOFT_OPERATOR_ADDENDUM = (
    "# Your post right now\n"
    "You are Alleato AI working as Brandon's Microsoft Executive Assistant — the same advisor described "
    "above, focused on his Outlook, Teams, calendar, and Microsoft files. The Chief Strategist delegates "
    "Microsoft work to you; you answer in that same voice, not as a separate tool.\n\n"
    "# How you work this post\n"
    "- Lead with the read, not the process. Bottom line first: what matters in the inbox/calendar and the "
    "next move. Do not narrate which tools you called.\n"
    "- Use live Outlook inbox reads for date-based inbox questions when a mailbox is available.\n"
    "- Treat emails as evidence: sender, local time, and a link — never a wall of prose or raw UTC.\n"
    "- Drop the compliance scaffolding. No 'What I can and cannot support', no 'Approvals needed: none'. "
    "Say what you found and what you would do.\n\n"
    "# Hard guardrails (these never bend)\n"
    "- Fail loudly for missing provider keys, Microsoft Graph credentials, Graph HTTP failures, stale "
    "context, or empty results. Never silently skip a tool failure.\n"
    "- If any search tool returns a result beginning with SEARCH_BACKEND_DEGRADED (or *_SEARCH_FAILED), the "
    "search subsystem is broken — do NOT report 'no matching passages' or conclude evidence is absent. Say "
    "plainly that search was unavailable, state which corpora could not be searched, and never present a "
    "confident negative.\n"
    "- Never send email, post Teams messages, or mutate calendar events unless an explicit approved action "
    "path exists. Draft for review only."
)


def _microsoft_system_prompt() -> str:
    """The specialist's system prompt: shared identity + soul, then a focused
    Microsoft-operator addendum that keeps the hard guardrails but leads with voice."""
    return _voice_prompt() + _MICROSOFT_OPERATOR_ADDENDUM


def _repo_root() -> Path:
    current = Path(__file__).resolve()
    for parent in current.parents:
        if (parent / "backend").exists() and (parent / "frontend").exists():
            return parent
    return Path.cwd()


def _source_skill_dir() -> Path:
    return RUNTIME_DIR


def _skill_roots() -> list[str]:
    source = _source_skill_dir() / "skills"
    return [str(source)] if source.exists() else []


def _memory_files() -> list[str]:
    source = _source_skill_dir() / "AGENTS.md"
    return [str(source)] if source.exists() else []


def _skills_loaded() -> list[str]:
    loaded: list[str] = []
    source = _source_skill_dir()
    if (source / "AGENTS.md").exists():
        loaded.append("microsoft-executive-assistant-memory")
    skills_root = source / "skills"
    for name in ("inbox-triage", "email-drafting", "humanizer", "wiki-markdown"):
        if (skills_root / name / "SKILL.md").exists():
            loaded.append(name)
    return loaded


def _provider_available() -> bool:
    from src.services.ai_transport import ai_gateway_configured, openai_configured

    return ai_gateway_configured() or openai_configured()


class _TestBackend:
    def __init__(self, root: Path):
        self.cwd = root


def _microsoft_backend(*, allow_fallback: bool = False) -> Any:
    try:
        from deepagents.backends import FilesystemBackend

        return FilesystemBackend(root_dir=str(_repo_root()), virtual_mode=True)
    except Exception as exc:
        if allow_fallback:
            return _TestBackend(_repo_root())
        raise RuntimeError(f"Deep Agents filesystem backend unavailable: {exc}") from exc


def _agent_config(request: MicrosoftExecutiveAssistantRequest) -> dict[str, Any]:
    thread_id = request.session_id or f"microsoft-executive-assistant:{request.user_id}"
    configurable: dict[str, Any] = {
        "thread_id": thread_id,
        "user_id": request.user_id,
        "trigger": request.trigger,
    }
    if request.project_id is not None:
        configurable["project_id"] = request.project_id
    if request.mailbox_user_id:
        configurable["mailbox_user_id"] = request.mailbox_user_id
    return {"configurable": configurable}


def _mailbox_owner_label(request: MicrosoftExecutiveAssistantRequest) -> str:
    mailbox = (request.mailbox_user_id or "").strip().lower()
    if mailbox == "bclymer@alleatogroup.com":
        return "Brandon"
    if mailbox == "megan@alleatogroup.com":
        return "Megan"
    if mailbox:
        local = mailbox.split("@", 1)[0].strip()
        return local or "the mailbox owner"
    return "the mailbox owner"


def _microsoft_question_directives(request: MicrosoftExecutiveAssistantRequest) -> list[str]:
    normalized = " ".join(request.prompt.lower().split())
    directives: list[str] = [
        "Only state facts you can support from the live Microsoft tool output. If you infer something, label it clearly as likely or possible.",
        "Do not introduce Megan unless the prompt explicitly asks about Megan or the mailbox owner is Megan.",
        "Do not propose a draft email or Teams escalation unless the user asked for drafting/escalation or the evidence shows a true urgent/security/legal emergency.",
    ]

    if "last five email" in normalized or "last 5 email" in normalized:
        directives.extend(
            [
                "For 'last five emails' requests, return exactly five emails in newest-first order when five exist. Do not add a sixth item or an extra inbox section.",
                "For each email, include only sender, subject, received time, and one short evidence-backed action label.",
                "Do not add urgency rankings, extra triage, or escalation advice unless the user separately asked for triage.",
            ]
        )

    if "arrived today" in normalized or "mail arrived today" in normalized:
        directives.extend(
            [
                "For 'arrived today' requests, report only messages from today in the mailbox timezone/context returned by the tool.",
                "Separate confirmed attention-needed items from clearly informational items. Do not claim something needs action unless the email content supports that.",
            ]
        )

    if (
        "urgent inbox" in normalized
        or ("urgent" in normalized and "inbox" in normalized)
        or "important emails this morning" in normalized
        or "reply triage" in normalized
    ):
        directives.extend(
            [
                "For inbox triage, separate 'confirmed urgent/action-needed' from 'important but not urgent'.",
                "Treat security notices, payment reminders, and admin notifications conservatively unless the content clearly shows immediate business risk.",
                "When an item likely needs a reply, say why in one sentence and avoid inventing deadlines, owners, or consequences not shown in the email evidence.",
            ]
        )

    return directives


def _microsoft_prompt(request: MicrosoftExecutiveAssistantRequest) -> str:
    mailbox = (
        f"Primary mailbox supplied by caller: {request.mailbox_user_id}."
        if request.mailbox_user_id
        else "No mailbox was supplied. Resolve the mailbox from the request context if possible; otherwise fail loudly."
    )
    project = (
        f"Project ID supplied by caller: {request.project_id}."
        if request.project_id
        else "No project ID was supplied."
    )
    owner = _mailbox_owner_label(request)
    question_directives = _microsoft_question_directives(request)
    approved_skill_context = (
        "Approved email/Teams Skill Library context:\n"
        f"{request.approved_skill_context.strip()}\n\n"
        if request.approved_skill_context and request.approved_skill_context.strip()
        else ""
    )
    return (
        f"Microsoft operator request:\n{request.prompt}\n\n"
        f"Trigger: {request.trigger}.\n"
        f"{mailbox}\n"
        f"{project}\n"
        f"Maximum messages to inspect: {request.max_messages}.\n\n"
        f"{approved_skill_context}"
        "Required workflow:\n"
        f"1. Treat this as Microsoft executive-assistant work for {owner}, not as generic Alleato strategist work.\n"
        "2. Use live Outlook inbox reads for date-based inbox questions when a mailbox is available.\n"
        "3. Use Outlook email search, Teams search, calendar reads, and Microsoft file search when they materially improve the answer.\n"
        "4. Draft email or Teams payloads for review only. Never claim an email was sent, a calendar event was changed, or a Teams message was posted.\n"
        "5. Escalate urgent client, prospect, legal, security, or true emergency items with a concise Teams-message draft.\n"
        "6. If a required Microsoft capability is missing, stale, blocked, or failed, include the exact failed capability and what evidence is missing.\n"
        f"7. End with recommended next steps for {owner} and any approvals needed.\n\n"
        "Answer-shaping rules:\n- "
        + "\n- ".join(question_directives)
    )


def _iter_json_objects(text: str) -> list[dict[str, Any]]:
    decoder = json.JSONDecoder()
    objects: list[dict[str, Any]] = []
    cursor = 0
    while cursor < len(text):
        start = text.find("{", cursor)
        if start == -1:
            break
        try:
            parsed, end = decoder.raw_decode(text[start:])
        except Exception:
            cursor = start + 1
            continue
        if isinstance(parsed, dict):
            objects.append(parsed)
        cursor = start + max(end, 1)
    return objects


def _action_from_preview_payload(payload: dict[str, Any]) -> Optional[MicrosoftAssistantAction]:
    if payload.get("action") != "preview":
        return None
    payload_type = str(payload.get("type") or "")
    action_type = "teams_message_draft" if "teams" in payload_type else "email_draft"
    return MicrosoftAssistantAction(
        actionType=action_type,  # type: ignore[arg-type]
        title=str(payload.get("type") or "Microsoft draft"),
        status="drafted",
        detail=str(payload.get("approvalReason") or "Draft prepared for review."),
        payload=payload,
    )


def _extract_preview_actions_from_text(text: str) -> list[MicrosoftAssistantAction]:
    actions: list[MicrosoftAssistantAction] = []
    for payload in _iter_json_objects(text):
        action = _action_from_preview_payload(payload)
        if action is None:
            continue
        actions.append(action)
    return actions


def _extract_actions(answer: str, result: Any | None = None) -> list[MicrosoftAssistantAction]:
    actions = _extract_preview_actions_from_text(answer)
    if result is not None:
        for message in _messages_from_result(result):
            if _message_tool_name(message) not in {
                "draft_outlook_email_for_review",
                "draft_teams_message_for_review",
            }:
                continue
            actions.extend(_extract_preview_actions_from_text(_message_content(message)))

    deduped: list[MicrosoftAssistantAction] = []
    seen: set[str] = set()
    for action in actions:
        key = json.dumps(action.payload or {}, sort_keys=True, default=str)
        if key in seen:
            continue
        seen.add(key)
        deduped.append(action)
    actions = deduped

    if not actions and any(marker in answer for marker in ("FAILED:", "UNAVAILABLE:", "BLOCKED:")):
        actions.append(
            MicrosoftAssistantAction(
                actionType="blocked",
                title="Microsoft capability blocked",
                status="blocked",
                detail="The assistant reported a Microsoft capability failure in the answer.",
            )
        )
    return actions


def _messages_from_result(result: Any) -> list[Any]:
    if isinstance(result, dict) and isinstance(result.get("messages"), list):
        return result["messages"]
    messages = getattr(result, "messages", None)
    return messages if isinstance(messages, list) else []


def _message_value(message: Any, key: str) -> Any:
    if isinstance(message, dict):
        return message.get(key)
    return getattr(message, key, None)


def _message_content(message: Any) -> str:
    content = _message_value(message, "content")
    if isinstance(content, str):
        return content
    if isinstance(content, list):
        parts: list[str] = []
        for item in content:
            if isinstance(item, str):
                parts.append(item)
            elif isinstance(item, dict) and isinstance(item.get("text"), str):
                parts.append(item["text"])
        return "\n".join(parts)
    return ""


def _message_tool_name(message: Any) -> Optional[str]:
    for key in ("name", "tool", "toolName"):
        value = _message_value(message, key)
        if isinstance(value, str) and value:
            return value
    message_type = _message_value(message, "type")
    if isinstance(message_type, str) and message_type == "tool":
        value = _message_value(message, "id")
        if isinstance(value, str) and value:
            return value
    return None


def _parse_tool_json(content: str) -> dict[str, Any]:
    stripped = content.strip()
    if not stripped:
        return {}
    try:
        parsed = json.loads(stripped)
        return parsed if isinstance(parsed, dict) else {}
    except Exception:
        return {}


def _inbox_request_kind(prompt: str) -> Optional[str]:
    normalized = " ".join(prompt.lower().split())
    if "last five email" in normalized or "last 5 email" in normalized:
        return "last_five"
    if (
        "reply triage" in normalized
        or "need a reply" in normalized
        or "needs a reply" in normalized
        or "need reply" in normalized
        or "needs reply" in normalized
    ):
        return "reply_triage"
    if "important emails this morning" in normalized or (
        "important" in normalized and "this morning" in normalized and "email" in normalized
    ):
        return "important_morning"
    if (
        "arrived today" in normalized
        or "mail arrived today" in normalized
        or "today's inbox" in normalized
        or "came in through outlook today" in normalized
        or "came in today through outlook" in normalized
        or ("came in" in normalized and "today" in normalized and "outlook" in normalized)
    ):
        return "arrived_today"
    if "urgent inbox" in normalized or ("urgent" in normalized and "inbox" in normalized):
        return "urgent_triage"
    return None


def _extract_live_inbox_messages(result: Any) -> list[dict[str, Any]]:
    for message in _messages_from_result(result):
        if _message_tool_name(message) != "read_live_outlook_inbox":
            continue
        parsed = _parse_tool_json(_message_content(message))
        if parsed.get("ok") is not True:
            continue
        if parsed.get("source") != "microsoft_graph_live":
            continue
        rows = parsed.get("messages")
        if isinstance(rows, list):
            return [row for row in rows if isinstance(row, dict)]
    return []


def _parse_received_at(value: Any) -> Optional[datetime]:
    if not isinstance(value, str) or not value.strip():
        return None
    try:
        return datetime.fromisoformat(value.replace("Z", "+00:00")).astimezone(timezone.utc)
    except Exception:
        return None


def _format_received_at(value: Any) -> str:
    dt = _parse_received_at(value)
    return dt.strftime("%Y-%m-%d %H:%M UTC") if dt else "unknown time"


def _received_on_utc_day(message: dict[str, Any], day: datetime.date) -> bool:
    dt = _parse_received_at(message.get("received_at"))
    return bool(dt and dt.date() == day)


def _message_text(message: dict[str, Any]) -> str:
    return " ".join(
        str(message.get(key) or "")
        for key in ("subject", "body_text", "from_name", "from_email")
    ).lower()


def _is_internal_sender(message: dict[str, Any]) -> bool:
    from_email = str(message.get("from_email") or "").strip().lower()
    return from_email.endswith("@alleatogroup.com")


def _is_automated_sender(message: dict[str, Any]) -> bool:
    from_email = str(message.get("from_email") or "").strip().lower()
    subject = str(message.get("subject") or "").strip().lower()
    return (
        from_email.startswith("no-reply@")
        or from_email.startswith("noreply@")
        or from_email.startswith("notifications@")
        or "notification" in from_email
        or "do not reply" in subject
        or "daily summary" in subject
        or "sign in to " in subject
    )


def _has_explicit_deadline(text: str) -> bool:
    deadline_tokens = (
        "by thursday",
        "by friday",
        "by tomorrow",
        "by end of day",
        "by eod",
        "this afternoon",
        "before noon",
        "deadline",
        "confirm by",
    )
    return any(token in text for token in deadline_tokens)


def _short_action_label(message: dict[str, Any]) -> str:
    bucket = _action_bucket(message)
    if bucket == "Alert now":
        return "Reply now"
    if bucket == "Reply":
        return "Reply"
    if bucket == "Delegate":
        return "Delegate"
    if bucket == "Watch":
        return "Watch"
    if bucket == "Ignore/noise":
        return "Ignore"
    text = _message_text(message)
    if "sign in" in text or "verification" in text or "login code" in text:
        return "Login verification"
    if "quarantine" in text or "security" in text:
        return "Security/admin notice"
    if "payment is due" in text or "approaching spend limit" in text:
        return "Billing/limit reminder"
    if any(token in text for token in ("can you", "please", "confirm", "review", "reply", "follow up", "?")):
        return "Direct follow-up needed"
    if "daily summary" in text or "summary" in text or "message center" in text:
        return "Operational summary"
    if message.get("has_attachments"):
        return "Attachment review"
    return "Review message"


def _likely_reply_needed(message: dict[str, Any]) -> bool:
    text = _message_text(message)
    if _is_automated_sender(message):
        return False
    if any(token in text for token in ("sign in", "verification code", "quarantine", "approaching spend limit", "payment is due")):
        return False
    if any(token in text for token in ("can you", "please", "confirm", "reply", "follow up", "review/sign", "review and sign", "?")):
        return True
    if not _is_internal_sender(message) and str(message.get("subject") or "").lower().startswith("re:"):
        return True
    return False


def _is_security_account_notice(text: str) -> bool:
    return any(
        token in text
        for token in (
            "third-party github application",
            "github application has been added",
            "recently authorized to access your account",
            "application was recently authorized",
            "new sign-in detected",
            "was recently signed-in",
            "login request was made",
            "log in code",
        )
    )


def _is_construction_risk_notice(text: str) -> bool:
    return any(
        token in text
        for token in (
            "could not confidently rule out",
            "could not rule out",
            "possible electrical trip",
            "electrical trip",
            "risk",
            "temp power",
            "temporary power",
        )
    )


def _action_bucket(message: dict[str, Any]) -> str:
    text = _message_text(message)
    subject = str(message.get("subject") or "")
    if _is_security_account_notice(text):
        return "Watch"
    if _is_automated_sender(message):
        if "payment is due" in text or "approaching spend limit" in text:
            return "Watch"
        return "Ignore/noise"
    if any(token in text for token in ("sign in", "verification code")):
        return "Ignore/noise"
    if "quarantine" in text or "security" in text:
        return "Watch"
    if "approaching spend limit" in text or "payment is due" in text:
        return "Watch"
    if _is_construction_risk_notice(text):
        return "Watch"
    if _has_explicit_deadline(text) and not _is_internal_sender(message):
        return "Alert now"
    if _likely_reply_needed(message) and not _is_internal_sender(message):
        return "Reply"
    if _likely_reply_needed(message) and _is_internal_sender(message):
        return "Delegate"
    if "daily summary" in text or "summary" in text:
        return "Ignore/noise"
    if message.get("has_attachments"):
        return "Watch"
    return "Ignore/noise"


def _message_reason(message: dict[str, Any], bucket: str) -> str:
    text = _message_text(message)
    if bucket == "Alert now":
        return "The email contains a direct external ask with explicit timing."
    if bucket == "Reply":
        return "External reply-thread message; treat as a reply candidate, but the exact owner is not confirmed by the inbox row alone."
    if bucket == "Delegate":
        return "This looks like an internal follow-up that needs ownership or routing."
    if "quarantine" in text or "security" in text:
        return "Security/admin notice exists, but the inbox evidence alone does not prove an immediate incident."
    if _is_security_account_notice(text):
        return "Security/account-change notice; verify it only if this account activity was unexpected."
    if "approaching spend limit" in text or "payment is due" in text:
        return "Admin reminder; time-sensitive, but not clearly an immediate reply item from the email alone."
    if _is_construction_risk_notice(text):
        return "Potential construction risk; watch this thread and confirm ownership if it connects to active work."
    if "sign in" in text or "verification code" in text:
        return "Authentication message; usually ignorable unless the sign-in was requested."
    if "daily summary" in text or "summary" in text:
        return "Operational summary or digest; no direct action is shown in the email itself."
    return "Present in the inbox, but the email evidence does not prove an immediate action."


def _message_evidence(message: dict[str, Any]) -> str:
    body = str(message.get("body_text") or "").replace("\r", " ").replace("\n", " ").strip()
    if not body:
        return "No body preview available."
    body = re.sub(r"[\u034f\u200b-\u200f\u202a-\u202e\u2060-\u206f]+", " ", body)
    body = re.sub(r"\s+", " ", body)
    sentences = [
        segment.strip()
        for segment in re.split(r"(?<=[.!?])\s+", body)
        if segment.strip()
        and "you don't often get email" not in segment.lower()
        and "this sender is outside your organization" not in segment.lower()
        and "learn why this is important" not in segment.lower()
    ]
    priority_tokens = (
        "can you",
        "please",
        "confirm",
        "reply",
        "review",
        "deadline",
        "by ",
        "today",
        "tomorrow",
        "thursday",
        "friday",
        "payment is due",
        "approaching spend limit",
        "verification code",
        "sign in",
        "do not reply",
    )
    for sentence in sentences:
        lowered = sentence.lower()
        if any(token in lowered for token in priority_tokens):
            return sentence[:200].strip()
    return (sentences[0] if sentences else body)[:200].strip()


def _reply_draft_direction(message: dict[str, Any], bucket: str) -> str:
    subject = str(message.get("subject") or "this thread").strip() or "this thread"
    if bucket == "Alert now":
        return f"Draft direction: acknowledge {subject}, answer the direct ask, and confirm the timing before the sender's stated deadline."
    if bucket == "Reply":
        return f"Draft direction: reply briefly to {subject}, confirm what Brandon can do next, and ask one clarifying question if scope or timing is missing."
    if bucket == "Delegate":
        return f"Draft direction: route {subject} to the right internal owner and ask them to confirm the next step."
    return "Draft direction: no reply draft recommended from the available inbox evidence."


def _action_owner(message: dict[str, Any], bucket: str) -> str:
    if bucket in {"Alert now", "Reply"}:
        return "Confirmed owner not shown; practical next owner is Brandon as mailbox owner unless this thread belongs to another team member"
    if bucket == "Delegate":
        return "Someone on the Alleato team should pick this up"
    if bucket == "Watch":
        return "Brandon should review only if this item matters to current work"
    return "No response owner is confirmed from the email alone"


def _action_risk(message: dict[str, Any], bucket: str) -> str:
    text = _message_text(message)
    if bucket == "Alert now":
        if _has_explicit_deadline(text):
            return "Ignoring it could miss the sender's stated timeline."
        return "Ignoring it could leave an external sender waiting on a direct answer."
    if bucket == "Reply":
        return "If this thread expects Brandon's response, ignoring it could stall an external follow-up."
    if bucket == "Delegate":
        return "Ignoring it could leave an internal follow-up without a clear owner."
    if bucket == "Watch":
        if _is_security_account_notice(text):
            return "Ignoring it is safe only if this account activity was expected."
        if _is_construction_risk_notice(text):
            return "Ignoring it could miss a project-risk signal that needs an owner if the work is active."
        if "payment is due" in text or "approaching spend limit" in text:
            return "Ignoring it could let a billing issue become time-sensitive later."
        if "quarantine" in text or "security" in text:
            return "Ignoring it could delay review of a security/admin notice."
        return "Ignoring it is usually safe unless it connects to known active work."
    return "Ignoring it is usually safe from the email evidence alone."


def _dedupe_messages(messages: list[dict[str, Any]]) -> list[dict[str, Any]]:
    groups: dict[tuple[str, str], list[dict[str, Any]]] = {}
    for message in messages:
        subject = str(message.get("subject") or "").strip().lower()
        sender = str(message.get("from_email") or message.get("from_name") or "").strip().lower()
        groups.setdefault((subject, sender), []).append(message)

    deduped: list[dict[str, Any]] = []
    for rows in groups.values():
        ordered = sorted(
            rows,
            key=lambda row: _parse_received_at(row.get("received_at")) or datetime.min.replace(tzinfo=timezone.utc),
            reverse=True,
        )
        latest = dict(ordered[0])
        latest["_message_count"] = len(rows)
        deduped.append(latest)

    deduped.sort(
        key=lambda row: _parse_received_at(row.get("received_at")) or datetime.min.replace(tzinfo=timezone.utc),
        reverse=True,
    )
    return deduped


def _trimmed_messages_for_today(messages: list[dict[str, Any]]) -> list[dict[str, Any]]:
    today = datetime.now(timezone.utc).date()
    today_messages = [message for message in messages if _received_on_utc_day(message, today)]
    return today_messages or messages


def _messages_for_this_morning(messages: list[dict[str, Any]]) -> list[dict[str, Any]]:
    today = datetime.now(timezone.utc).date()
    rows: list[dict[str, Any]] = []
    for message in messages:
        dt = _parse_received_at(message.get("received_at"))
        if dt and dt.date() == today and dt.hour < 12:
            rows.append(message)
    return rows


def _render_last_five_answer(messages: list[dict[str, Any]], mailbox: str) -> str:
    rows = messages[:5]
    lines = [f"Your last five emails in {mailbox} are:", ""]
    for index, message in enumerate(rows, start=1):
        sender = str(message.get("from_name") or message.get("from_email") or "Unknown sender")
        subject = str(message.get("subject") or "(no subject)")
        bucket = _action_bucket(message)
        lines.append(
            f"{index}. {subject} — {sender} — {_format_received_at(message.get('received_at'))}"
        )
        lines.append(f"   Response path: {_short_action_label(message)}.")
        lines.append(f"   Why: {_message_reason(message, bucket)}")
        if bucket in {"Alert now", "Reply", "Delegate"}:
            lines.append("   Ownership: likely action candidate, but not confirmed from this inbox row alone.")
        else:
            lines.append("   Ownership: no confirmed user-owned action from this inbox row alone.")
        lines.append(f"   Preview: {_message_evidence(message)}")
        lines.append("")
    return "\n".join(lines).strip()


def _render_action_lists(
    *,
    heading: str,
    action_needed: list[dict[str, Any]],
    informational: list[dict[str, Any]],
    lead: Optional[str] = None,
    include_draft_direction: bool = False,
    include_owner: bool = False,
) -> str:
    lines = [heading, ""]
    if lead:
        lines.append(lead)
        lines.append("")

    if action_needed:
        lines.append("Action needed")
        for message in action_needed:
            sender = str(message.get("from_name") or message.get("from_email") or "Unknown sender")
            subject = str(message.get("subject") or "(no subject)")
            bucket = _action_bucket(message)
            count = int(message.get("_message_count") or 1)
            lines.append(f"- {subject} — {sender} — {_format_received_at(message.get('received_at'))}")
            if count > 1:
                lines.append(f"  Thread activity: {count} messages in this subject thread.")
            lines.append(f"  Response path: {_short_action_label(message)}")
            lines.append(f"  Why: {_message_reason(message, bucket)}")
            lines.append("  User-owned action: not confirmed by this inbox row; treat as a candidate until ownership is verified.")
            if include_owner:
                lines.append(f"  Owner: {_action_owner(message, bucket)}")
            lines.append(f"  Evidence: {_message_evidence(message)}")
            lines.append(f"  If ignored: {_action_risk(message, bucket)}")
            if include_draft_direction and bucket in {"Alert now", "Reply", "Delegate"}:
                lines.append(f"  {_reply_draft_direction(message, bucket)}")
        lines.append("")

    if informational:
        lines.append("Watch / informational")
        for message in informational:
            sender = str(message.get("from_name") or message.get("from_email") or "Unknown sender")
            subject = str(message.get("subject") or "(no subject)")
            bucket = _action_bucket(message)
            count = int(message.get("_message_count") or 1)
            lines.append(f"- {subject} — {sender} — {_format_received_at(message.get('received_at'))}")
            if count > 1:
                lines.append(f"  Thread activity: {count} messages in this subject thread.")
            response_path = _short_action_label(message)
            if response_path == "Ignore":
                response_path = "Watch" if _action_bucket(message) == "Watch" else "No reply needed"
            lines.append(f"  Response path: {response_path}")
            lines.append(f"  Why: {_message_reason(message, bucket)}")
            lines.append("  User-owned action: no confirmed reply action from this inbox row.")
            if include_owner:
                lines.append(f"  Owner: {_action_owner(message, bucket)}")
            lines.append(f"  Evidence: {_message_evidence(message)}")
            lines.append(f"  If ignored: {_action_risk(message, bucket)}")
        lines.append("")

    if not action_needed and not informational:
        lines.append("No matching inbox items were identified from the live inbox read.")

    return "\n".join(lines).strip()


def _render_bucketed_triage_answer(
    *,
    heading: str,
    messages: list[dict[str, Any]],
    mailbox_owner: str,
    include_only_reply_needed: bool = False,
    same_day_only: bool = False,
) -> str:
    candidates = _trimmed_messages_for_today(messages) if same_day_only else messages
    candidates = _dedupe_messages(candidates)
    ordered_buckets = ["Alert now", "Reply", "Delegate", "Watch", "Ignore/noise"]
    buckets: dict[str, list[dict[str, Any]]] = {name: [] for name in ordered_buckets}
    for message in candidates[:12]:
        bucket = _action_bucket(message)
        buckets[bucket].append(message)

    if include_only_reply_needed:
        reply_buckets = ["Alert now", "Reply", "Delegate"]
        omitted_watch = len(buckets["Watch"])
        omitted_noise = len(buckets["Ignore/noise"])
        render_buckets = reply_buckets
    else:
        omitted_watch = 0
        omitted_noise = 0
        render_buckets = ordered_buckets

    lines = [heading, ""]
    if include_only_reply_needed:
        lines.append(
            "From today's live Outlook messages, no confirmed user-owned reply action was proven; the items below are the strongest reply candidates, separated from watch/no-reply items."
        )
        lines.append("")
    elif not buckets["Alert now"]:
        lines.append(
            "No confirmed user-owned urgent action was proven from the available evidence; security/project-risk watch items may need verification if unexpected or tied to active work."
        )
        lines.append("")

    for bucket in render_buckets:
        rows = buckets[bucket]
        if not rows:
            continue
        lines.append(f"{bucket}")
        for message in rows[:4]:
            sender = str(message.get("from_name") or message.get("from_email") or "Unknown sender")
            subject = str(message.get("subject") or "(no subject)")
            count = int(message.get("_message_count") or 1)
            lines.append(f"- {subject} — {sender} — {_format_received_at(message.get('received_at'))}")
            if count > 1:
                lines.append(f"  Thread activity: {count} messages in this subject thread.")
            lines.append(f"  Action: {bucket}. Reason: {_message_reason(message, bucket)}")
            lines.append("  User-owned action: not confirmed by this inbox row; treat as a candidate until ownership is verified.")
            lines.append(f"  Evidence: {_message_evidence(message)}")
            lines.append(f"  If ignored: {_action_risk(message, bucket)}")
            if False and bucket in {"Alert now", "Reply", "Delegate"}:
                lines.append(f"  {_reply_draft_direction(message, bucket)}")
        lines.append("")

    if not any(buckets[bucket] for bucket in ordered_buckets):
        lines.append("No clear action-needed inbox items were identified from the live inbox read.")
        lines.append("")

    if include_only_reply_needed and (omitted_watch or omitted_noise):
        lines.append("Not classified as reply-required from the available evidence")
        if omitted_watch:
            lines.append(f"- {omitted_watch} watch item(s) need awareness only unless they connect to active work.")
            for message in buckets["Watch"][:3]:
                sender = str(message.get("from_name") or message.get("from_email") or "Unknown sender")
                subject = str(message.get("subject") or "(no subject)")
                lines.append(f"  - Watch: {subject} — {sender}")
        if omitted_noise:
            lines.append(f"- {omitted_noise} noise/no-reply item(s) should not receive a reply from this evidence alone.")
            for message in buckets["Ignore/noise"][:3]:
                sender = str(message.get("from_name") or message.get("from_email") or "Unknown sender")
                subject = str(message.get("subject") or "(no subject)")
                lines.append(f"  - No reply: {subject} — {sender}")
        lines.append("")

    lines.extend(
        [
            f"Recommended next steps for {mailbox_owner}",
            "1. Handle the Alert now items first, if any are present.",
            "2. Reply to the direct sender asks next.",
            "3. Leave Watch/Ignore items alone unless they match known work you are already handling.",
        ]
    )
    return "\n".join(lines).strip()


def _render_morning_answer(messages: list[dict[str, Any]], mailbox: str) -> str:
    rows = _dedupe_messages(_messages_for_this_morning(messages))
    if not rows:
        return (
            f"Important emails this morning for {mailbox}:\n\n"
            "No emails from this morning were identified in the live inbox read."
        )

    action_needed = [message for message in rows if _action_bucket(message) in {"Alert now", "Reply", "Delegate"}][:6]
    informational = [
        message
        for message in rows
        if _action_bucket(message) == "Watch" and _is_construction_risk_notice(_message_text(message))
    ][:4]
    omitted_noise = len([message for message in rows if _action_bucket(message) == "Ignore/noise"])
    lead = (
        "No clear emergency was identified this morning; this list keeps direct replies and project-risk watch items, and excludes routine/no-reply noise."
    )
    if omitted_noise:
        lead += f" {omitted_noise} routine/no-reply item(s) were excluded from the important list."
    return _render_action_lists(
        heading=f"Important emails this morning for {mailbox}:",
        action_needed=action_needed,
        informational=informational,
        lead=lead,
    )


def _render_arrived_today_answer(messages: list[dict[str, Any]], mailbox: str) -> str:
    rows = _dedupe_messages(_trimmed_messages_for_today(messages))
    action_needed = [message for message in rows if _action_bucket(message) in {"Alert now", "Reply"}][:6]
    informational = [message for message in rows if _action_bucket(message) == "Watch"][:6]
    omitted_noise = len([message for message in rows if _action_bucket(message) == "Ignore/noise"])
    lead = "No confirmed user-owned urgent action was proven from today's Outlook arrivals; reply candidates and security/watch notices are separated below."
    if omitted_noise:
        lead += f" {omitted_noise} routine/no-reply item(s) were excluded."
    answer = _render_action_lists(
        heading=f"Outlook emails received today that may need attention for {mailbox}:",
        action_needed=action_needed,
        informational=informational,
        lead=lead,
        include_draft_direction=False,
    )
    decision_lines = ["", "Decision summary"]
    if action_needed:
        subjects = "; ".join(str(message.get("subject") or "(no subject)") for message in action_needed[:3])
        decision_lines.append(
            f"- Reply candidate(s): {subjects}. Ownership is not confirmed by the inbox row; verify before replying."
        )
    else:
        decision_lines.append("- Reply candidate(s): none confirmed from today's live Outlook rows.")
    if informational:
        subjects = "; ".join(str(message.get("subject") or "(no subject)") for message in informational[:3])
        decision_lines.append(f"- Watch item(s): {subjects}. Review only if unexpected or tied to active work.")
    return answer + "\n".join(decision_lines)


def _deterministic_inbox_answer(
    request: MicrosoftExecutiveAssistantRequest,
    result: Any,
) -> Optional[str]:
    kind = _inbox_request_kind(request.prompt)
    if not kind:
        return None

    messages = _extract_live_inbox_messages(result)
    if not messages:
        return None

    mailbox = request.mailbox_user_id or "the mailbox"
    owner = _mailbox_owner_label(request)
    if kind == "last_five":
        return _render_last_five_answer(messages, mailbox)
    if kind == "urgent_triage":
        return _render_bucketed_triage_answer(
            heading=f"Urgent inbox triage for {mailbox}:",
            messages=messages,
            mailbox_owner=owner,
        )
    if kind == "important_morning":
        return _render_morning_answer(messages, mailbox)
    if kind == "arrived_today":
        return _render_arrived_today_answer(messages, mailbox)
    if kind == "reply_triage":
        return _render_bucketed_triage_answer(
            heading=f"Emails that most likely need a reply in {mailbox}:",
            messages=messages,
            mailbox_owner=owner,
            include_only_reply_needed=True,
            same_day_only=True,
        )
    return None


def _wants_inbox_card(prompt: str) -> bool:
    """True when an inbox-listing/triage answer should render as the card.

    Broader than `_inbox_request_kind` (which only catches a few exact phrasings):
    any inbox-noun request that ISN'T a pure single-thread drafting action. Pure
    "draft a reply to X" requests read the inbox to find a thread but want a draft,
    not an inbox listing, so they're excluded.
    """
    normalized = " ".join(prompt.lower().split())
    if any(
        token in normalized
        for token in ("draft ", "reply to ", "respond to ", "write back", "compose ", "send a ")
    ):
        return False
    return any(token in normalized for token in ("email", "emails", "inbox", "mail", "message"))


def _fetch_draft_conversation_ids(mailbox: str) -> set[str]:
    """Return the set of conversationIds that already have a draft in the Drafts
    folder for the given mailbox. One Graph call; empty set on any error so the
    pencil simply stays muted rather than surfacing a runtime failure."""
    if not mailbox or "@" not in mailbox:
        return set()
    try:
        from urllib.parse import quote as _quote, urlencode as _urlencode

        from src.services.integrations.microsoft_graph.client import get_graph_client

        graph = get_graph_client()
        if not graph.is_configured():
            return set()
        params = _urlencode(
            {"$select": "id,conversationId", "$top": "100"}
        )
        path = f"{graph.GRAPH_BASE}/users/{_quote(mailbox)}/mailFolders/drafts/messages?{params}"
        data = graph._get_with_retry(path, max_retries=1, base_delay=0.5)
        items = data.get("value") if isinstance(data, dict) else []
        return {
            str(item["conversationId"])
            for item in (items or [])
            if isinstance(item, dict) and item.get("conversationId")
        }
    except Exception:
        return set()


def _structured_inbox_emails(
    request: MicrosoftExecutiveAssistantRequest,
    result: Any,
) -> list[MicrosoftAssistantEmailItem]:
    """Shape the same live-inbox rows used for the text answer into structured
    email items the frontend renders as the outlook_inbox_summary card.

    Triggers whenever the agent actually performed a successful live inbox read
    (so the data exists) AND the request is an inbox listing/triage — NOT gated on
    the narrow `_inbox_request_kind` phrasings. Returns [] otherwise so the
    frontend falls back to the text answer unchanged.
    """
    messages = _extract_live_inbox_messages(result)
    if not messages:
        return []
    if not _wants_inbox_card(request.prompt):
        return []

    mailbox = (request.mailbox_user_id or "").strip().lower()
    draft_conversation_ids = _fetch_draft_conversation_ids(mailbox)

    items: list[MicrosoftAssistantEmailItem] = []
    for index, message in enumerate(messages[: request.max_messages]):
        subject = str(message.get("subject") or "(no subject)").strip() or "(no subject)"
        body_text = str(message.get("body_text") or "").strip() or None
        preview = re.sub(r"\s+", " ", body_text).strip()[:200] if body_text else None
        graph_id = str(message.get("graph_message_id") or message.get("id") or "").strip() or None
        conversation_id = str(message.get("conversation_id") or "").strip() or None
        item_id = graph_id or conversation_id or f"inbox-{index}"
        bucket = _action_bucket(message)
        draft_ready = bool(conversation_id and conversation_id in draft_conversation_ids)
        reply_prompt = "\n".join(
            [
                "OUTLOOK_INBOX_CARD_ACTION",
                "Mode: reply",
                "Draft a short Outlook reply to this email thread.",
                f"Subject: {subject}",
                *([f"Graph message ID: {graph_id}"] if graph_id else []),
            ]
        )
        draft_prompt = "\n".join(
            [
                "OUTLOOK_INBOX_CARD_ACTION",
                "Mode: new",
                "Draft a short Outlook email about this inbox item.",
                f"Subject: {subject}",
            ]
        )
        items.append(
            MicrosoftAssistantEmailItem(
                id=item_id,
                graphMessageId=graph_id,
                conversationId=conversation_id,
                subject=subject,
                fromName=str(message.get("from_name") or "").strip() or None,
                fromEmail=str(message.get("from_email") or "").strip() or None,
                receivedAt=str(message.get("received_at") or "").strip() or None,
                hasAttachments=bool(message.get("has_attachments")),
                preview=preview,
                bodyText=body_text,
                webLink=str(message.get("web_link") or "").strip() or None,
                recommendedAction=_message_reason(message, bucket),
                replyPrompt=reply_prompt,
                draftPrompt=draft_prompt,
                draftReady=draft_ready,
            )
        )
    return items


def _tool_trace_from_result(result: Any, *, runtime_trace: MicrosoftAssistantTraceItem) -> list[MicrosoftAssistantTraceItem]:
    traces: list[MicrosoftAssistantTraceItem] = []
    known_tools = {
        "read_live_outlook_inbox",
        "search_outlook_emails",
        "search_microsoft_teams_messages",
        "search_microsoft_files",
        "list_outlook_calendar_events",
        "draft_outlook_email_for_review",
        "draft_teams_message_for_review",
    }
    for message in _messages_from_result(result):
        tool_name = _message_tool_name(message)
        if tool_name not in known_tools:
            continue
        content = _message_content(message)
        parsed = _parse_tool_json(content)
        source = parsed.get("source") if isinstance(parsed.get("source"), str) else None
        error = parsed.get("error") if isinstance(parsed.get("error"), str) else None
        ok = parsed.get("ok") if isinstance(parsed.get("ok"), bool) else None
        if ok is False and not error:
            error = content[:500] if content else f"{tool_name} failed"
        # The corpus-search tools return markdown (not JSON), so failures were
        # invisible in the trace — a degraded backend looked like a clean success.
        # Surface known failure markers so the trace and persisted metadata are honest.
        if not error and isinstance(content, str):
            stripped = content.lstrip()
            if (
                "SEARCH_BACKEND_DEGRADED" in content
                or stripped.startswith("Error searching")
                or stripped.startswith("Error executing retrieval")
                or "_SEARCH_FAILED" in content
                or "FILE_SEARCH_FAILED" in content
            ):
                error = content[:500]
        traces.append(
            MicrosoftAssistantTraceItem(
                agent=ORCHESTRATOR_NAME,
                tool=tool_name,
                status="failed" if error else "success",
                durationMs=0,
                detail=error or f"{tool_name} completed.",
                source=source,
                output={
                    key: value
                    for key, value in {
                        "source": source,
                        "ok": ok,
                        "count": parsed.get("count"),
                        "mailboxUserId": parsed.get("mailbox_user_id"),
                        "fetchedAt": parsed.get("fetched_at"),
                        "truncated": parsed.get("truncated"),
                        "error": error,
                    }.items()
                    if value is not None
                },
            )
        )
    traces.append(runtime_trace)
    return traces


def run_microsoft_executive_assistant(
    request: MicrosoftExecutiveAssistantRequest,
    *,
    create_agent: Optional[Callable[..., Any]] = None,
    model: str = "",
) -> MicrosoftExecutiveAssistantResponse:
    """Run the Microsoft Executive Assistant Deep Agent and return a typed response."""
    started = time.perf_counter()
    loaded_skills = _skills_loaded()
    try:
        if not model:
            from src.services.pipeline.config import MODEL_BRANDON_EMAIL

            model = f"openai:{MODEL_BRANDON_EMAIL}"
        if create_agent is None:
            if not _provider_available():
                raise RuntimeError(
                    "No AI provider is configured for the Microsoft Executive Assistant. "
                    "Set AI_GATEWAY_API_KEY (preferred) or OPENAI_API_KEY."
                )
            from deepagents import create_deep_agent as create_agent

            model = _resolve_deep_agents_model(model)

        kwargs: dict[str, Any] = {
            "name": ORCHESTRATOR_NAME,
            "model": model,
            "tools": microsoft_executive_assistant_tools(),
            "backend": _microsoft_backend(allow_fallback=create_agent is not None),
            "system_prompt": _microsoft_system_prompt(),
        }
        skill_roots = _skill_roots()
        if skill_roots:
            kwargs["skills"] = skill_roots
        memory_files = _memory_files()
        if memory_files:
            kwargs["memory"] = memory_files

        agent = create_agent(**kwargs)
        try:
            result = agent.invoke(
                {"messages": [{"role": "user", "content": _microsoft_prompt(request)}]},
                config=_agent_config(request),
            )
        except TypeError as exc:
            if "config" not in str(exc):
                raise
            result = agent.invoke({"messages": [{"role": "user", "content": _microsoft_prompt(request)}]})

        answer = _deterministic_inbox_answer(request, result) or _extract_agent_text(result)
        if not answer:
            raise RuntimeError("Microsoft Executive Assistant returned an empty response.")

        runtime_trace = MicrosoftAssistantTraceItem(
            agent=ORCHESTRATOR_NAME,
            tool="deepagents_microsoft_executive_assistant_runtime",
            status="success",
            durationMs=max(0, int((time.perf_counter() - started) * 1000)),
            detail="Microsoft Executive Assistant produced an answer.",
        )

        return MicrosoftExecutiveAssistantResponse(
            answer=answer,
            mode="deep_agents",
            actions=_extract_actions(answer, result),
            emails=_structured_inbox_emails(request, result),
            toolTrace=_tool_trace_from_result(result, runtime_trace=runtime_trace),
            skillsLoaded=loaded_skills,
            approvedSkillContext=request.approved_skill_context,
            orchestrator=ORCHESTRATOR_NAME,
        )
    except Exception as exc:
        return MicrosoftExecutiveAssistantResponse(
            answer=(
                "The Microsoft Executive Assistant could not complete this request. "
                f"Failed capability: deepagents_microsoft_executive_assistant_runtime. Detail: {exc}"
            ),
            mode="unavailable",
            actions=[
                MicrosoftAssistantAction(
                    actionType="blocked",
                    title="Microsoft Executive Assistant unavailable",
                    status="blocked",
                    detail=str(exc),
                )
            ],
            toolTrace=[
                MicrosoftAssistantTraceItem(
                    agent=ORCHESTRATOR_NAME,
                    tool="deepagents_microsoft_executive_assistant_runtime",
                    status="failed",
                    durationMs=max(0, int((time.perf_counter() - started) * 1000)),
                    detail=str(exc),
                )
            ],
            skillsLoaded=loaded_skills,
            approvedSkillContext=request.approved_skill_context,
            orchestrator=ORCHESTRATOR_NAME,
        )
