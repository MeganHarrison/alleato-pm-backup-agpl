"""Contracts for the Microsoft Executive Assistant Deep Agents endpoint."""

from __future__ import annotations

from typing import Any, List, Literal, Optional

from pydantic import BaseModel, Field, field_validator


MicrosoftAssistantMode = Literal["deep_agents", "unavailable"]
MicrosoftAssistantToolStatus = Literal["success", "failed", "skipped"]
MicrosoftAssistantActionType = Literal[
    "inbox_triage",
    "email_draft",
    "teams_escalation",
    "teams_message_draft",
    "calendar_review",
    "file_context",
    "follow_up",
    "blocked",
]


class MicrosoftExecutiveAssistantRequest(BaseModel):
    user_id: str = Field(..., min_length=1, alias="userId")
    session_id: Optional[str] = Field(default=None, alias="sessionId")
    prompt: str = Field(..., min_length=1)
    mailbox_user_id: Optional[str] = Field(default=None, alias="mailboxUserId")
    project_id: Optional[int] = Field(default=None, ge=1, alias="projectId")
    approved_skill_context: Optional[str] = Field(default=None, alias="approvedSkillContext")
    trigger: Literal["strategist_delegation", "outlook_event", "teams_message", "scheduled_check"] = (
        "strategist_delegation"
    )
    max_messages: int = Field(default=25, ge=1, le=100, alias="maxMessages")

    model_config = {"populate_by_name": True}

    @field_validator("prompt")
    @classmethod
    def prompt_must_not_be_blank(cls, value: str) -> str:
        stripped = value.strip()
        if not stripped:
            raise ValueError("prompt must not be blank")
        return stripped

    @field_validator("mailbox_user_id")
    @classmethod
    def mailbox_must_be_email_when_present(cls, value: Optional[str]) -> Optional[str]:
        if value is None:
            return None
        stripped = value.strip().lower()
        if not stripped:
            return None
        if "@" not in stripped:
            raise ValueError("mailboxUserId must be an email address")
        return stripped


class MicrosoftAssistantAction(BaseModel):
    action_type: MicrosoftAssistantActionType = Field(..., alias="actionType")
    title: str
    status: Literal["recommended", "drafted", "blocked", "completed"]
    detail: str
    payload: Optional[dict[str, Any]] = None

    model_config = {"populate_by_name": True}


class MicrosoftAssistantTraceItem(BaseModel):
    agent: str
    tool: str
    status: MicrosoftAssistantToolStatus
    duration_ms: int = Field(..., ge=0, alias="durationMs")
    detail: Optional[str] = None
    source: Optional[str] = None
    output: Optional[dict[str, Any]] = None

    model_config = {"populate_by_name": True}


class MicrosoftAssistantEmailItem(BaseModel):
    """One inbox email shaped for the frontend outlook_inbox_summary card.

    Field aliases are camelCase so the JSON maps onto the frontend
    OutlookInboxSummaryWidgetItem when the response is serialized by alias.
    """

    id: str
    graph_message_id: Optional[str] = Field(default=None, alias="graphMessageId")
    conversation_id: Optional[str] = Field(default=None, alias="conversationId")
    subject: str
    from_name: Optional[str] = Field(default=None, alias="fromName")
    from_email: Optional[str] = Field(default=None, alias="fromEmail")
    received_at: Optional[str] = Field(default=None, alias="receivedAt")
    has_attachments: bool = Field(default=False, alias="hasAttachments")
    preview: Optional[str] = None
    body_text: Optional[str] = Field(default=None, alias="bodyText")
    web_link: Optional[str] = Field(default=None, alias="webLink")
    recommended_action: str = Field(default="", alias="recommendedAction")
    reply_prompt: str = Field(default="", alias="replyPrompt")
    draft_prompt: str = Field(default="", alias="draftPrompt")
    # True only when a real Outlook draft reply already exists for this thread.
    draft_ready: bool = Field(default=False, alias="draftReady")

    model_config = {"populate_by_name": True}


class MicrosoftExecutiveAssistantResponse(BaseModel):
    answer: str
    mode: MicrosoftAssistantMode
    actions: List[MicrosoftAssistantAction] = Field(default_factory=list)
    # Structured inbox emails for date-based inbox questions; empty for other
    # request kinds (the frontend renders the card only when this is non-empty).
    emails: List[MicrosoftAssistantEmailItem] = Field(default_factory=list)
    tool_trace: List[MicrosoftAssistantTraceItem] = Field(..., alias="toolTrace")
    skills_loaded: List[str] = Field(default_factory=list, alias="skillsLoaded")
    approved_skill_context: Optional[str] = Field(default=None, alias="approvedSkillContext")
    orchestrator: str

    model_config = {"populate_by_name": True}
