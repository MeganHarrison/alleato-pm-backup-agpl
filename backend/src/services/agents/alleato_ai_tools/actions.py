"""Write actions.

The agent never executes a write directly. It DRAFTS the action and returns the draft to the
caller. The PM platform UI presents the draft to the user, who approves it, and only then is
the actual API call made (against the PM platform's own endpoints — not from this service).

This pattern keeps the agent honest, keeps audit logs in one place, and means a bad
generation can never silently send an email or create a contract.

Payload shape (must match alleato-pm UI contract exactly):
{
    "action": "preview",
    "type": "<record type>",
    "message": "<human-readable summary>",
    "preview": {
        "table": "<target DB table>",
        "fields": { ... }
    },
    "approval_required": true,
    "approval_reason": "<why human approval is needed>"
}
"""

from __future__ import annotations

import json
from typing import Literal, Optional

from langchain_core.tools import tool
from pydantic import BaseModel, Field


# ---------------------------------------------------------------------------
# Draft payload models
# ---------------------------------------------------------------------------


class DraftEmail(BaseModel):
    """Draft of an outbound email awaiting human approval."""

    to: list[str] = Field(description="Recipient email addresses")
    subject: str = Field(description="Email subject line")
    body: str = Field(description="Email body in markdown")
    cc: Optional[list[str]] = Field(default=None, description="Optional CC recipients")


class DraftTeamsMessage(BaseModel):
    """Draft of a Microsoft Teams message awaiting human approval."""

    channel: str = Field(description="Teams channel name or ID")
    body: str = Field(description="Message body in markdown")


class DraftRFI(BaseModel):
    """Draft RFI record for the rfis table."""

    subject: str = Field(description="RFI subject / title")
    question: str = Field(description="The actual question being asked")
    due_date: Optional[str] = Field(default=None, description="ISO date string for response due date")
    ball_in_court: Optional[str] = Field(default=None, description="Person or company responsible for answering")
    question_to: Optional[str] = Field(default=None, description="Who the question is directed to")
    discipline: Optional[str] = Field(default=None, description="Trade or discipline (e.g. Structural, MEP)")
    cost_impact: Literal["yes", "no", "tbd"] = Field(default="tbd")
    schedule_impact: Literal["yes", "no", "tbd"] = Field(default="tbd")
    status: str = Field(default="open")
    is_private: bool = Field(default=False)


class DraftCommitment(BaseModel):
    """Draft commitment (subcontract or purchase order) record."""

    vendor_name: Optional[str] = Field(default=None, description="Vendor or subcontractor company name")
    commitment_type: Literal["subcontract", "purchase_order"] = Field(
        description="'subcontract' for labor/trade work, 'purchase_order' for materials/equipment"
    )
    title: str = Field(description="Commitment title, e.g. 'Electrical Work'")
    description: Optional[str] = Field(default=None, description="Scope description")
    value: Optional[float] = Field(default=None, description="Contract value in dollars")
    project_id: Optional[int] = Field(default=None, description="PM platform project ID")
    status: str = Field(default="Draft")
    start_date: Optional[str] = Field(default=None, description="ISO start date")
    estimated_completion_date: Optional[str] = Field(default=None, description="ISO estimated completion date")
    default_retainage_percent: Optional[float] = Field(default=None, description="Retainage percentage (e.g. 10 for 10%)")


class DraftChangeEvent(BaseModel):
    """Draft change event record for the change_events table."""

    title: str = Field(description="Short descriptive title")
    description: Optional[str] = Field(default=None, description="Detailed description")
    initiating_co: Optional[str] = Field(default=None, description="Initiating change order reference")
    cost_impact: Optional[float] = Field(default=None, description="Estimated cost impact in dollars")
    schedule_impact: Optional[int] = Field(default=None, description="Estimated schedule impact in days")
    scope: Literal["owner_change", "unforeseen_condition", "design_error", "other"] = Field(default="other")
    type: Literal["potential_change", "trend", "rfi_answer_required"] = Field(default="potential_change")
    status: str = Field(default="open")


class DraftChangeOrder(BaseModel):
    """Draft prime contract change order for prime_contract_change_orders table."""

    title: str = Field(description="Change order title")
    description: Optional[str] = Field(default=None, description="Scope or reason description")
    owner_amount: Optional[float] = Field(default=None, description="Dollar amount billed to owner")
    reason: Optional[str] = Field(default=None, description="Reason or justification for the change")
    status: str = Field(default="draft")


class DraftSubmittal(BaseModel):
    """Draft submittal record for the submittals table."""

    title: str = Field(description="Submittal title, e.g. 'Structural Steel Shop Drawings'")
    spec_section: Optional[str] = Field(default=None, description="Spec section number, e.g. '05 12 00'")
    required_by: Optional[str] = Field(default=None, description="ISO date by which the submittal is required")
    submitted_by: str = Field(default="TBD", description="Subcontractor or party submitting")
    status: str = Field(default="pending")


class DraftTask(BaseModel):
    """Draft task / action item for the tasks table."""

    title: str = Field(description="Short task title")
    description: Optional[str] = Field(default=None, description="Task detail or source context")
    assignee: Optional[str] = Field(default=None, description="Person responsible — name or email")
    due_date: Optional[str] = Field(default=None, description="ISO due date")
    project_id: Optional[int] = Field(default=None, description="PM platform project ID")
    priority: Literal["low", "medium", "high", "urgent"] = Field(default="medium")
    status: Literal["open", "in_progress", "blocked", "done", "cancelled"] = Field(default="open")


# ---------------------------------------------------------------------------
# Internal helper
# ---------------------------------------------------------------------------

_TABLE_MAP: dict[str, str] = {
    "email": "outlook_email_drafts",
    "teams_message": "teams_message_drafts",
    "rfi": "rfis",
    "commitment": "subcontracts",  # overridden per commitment_type at runtime
    "change_event": "change_events",
    "change_order": "prime_contract_change_orders",
    "submittal": "submittals",
    "task": "tasks",
}

_APPROVAL_REASONS: dict[str, str] = {
    "email": "External communication — requires human review before sending",
    "teams_message": "Internal message — requires human review before posting",
    "rfi": "Creates a formal RFI record visible to the project team",
    "commitment": "Creates a financial commitment record — requires PM approval",
    "change_event": "Logs a potential scope change — requires PM review",
    "change_order": "Creates a contract change order — requires PM approval",
    "submittal": "Creates a submittal tracking record for the project team",
    "task": "Creates an action item and may trigger notifications",
}


def _make_draft(
    draft_type: str,
    message: str,
    fields: dict,
    table: Optional[str] = None,
) -> str:
    """Wrap a draft model's field dict into the standard payload shape.

    Args:
        draft_type: One of the type literals recognised by the PM UI.
        message: Human-readable summary shown in the approval UI.
        fields: Flat dict of the record fields to be created.
        table: Override the target table name (defaults to _TABLE_MAP lookup).

    Returns:
        JSON string conforming to the alleato-pm draft payload contract.
    """
    resolved_table = table or _TABLE_MAP.get(draft_type, draft_type)
    payload = {
        "action": "preview",
        "type": draft_type,
        "message": message,
        "preview": {
            "table": resolved_table,
            "fields": fields,
        },
        "approval_required": True,
        "approval_reason": _APPROVAL_REASONS.get(draft_type, "Requires human approval before execution"),
    }
    return json.dumps(payload, ensure_ascii=False, indent=2)


# ---------------------------------------------------------------------------
# Tools — communications
# ---------------------------------------------------------------------------


@tool
def draft_email(
    to: list[str],
    subject: str,
    body: str,
    cc: Optional[list[str]] = None,
) -> str:
    """Draft an email for human approval. Never sends.

    The PM platform UI is responsible for showing the draft to the user,
    allowing edits, and sending only after explicit approval.

    Args:
        to: Recipient email addresses.
        subject: Email subject line.
        body: Email body in markdown.
        cc: Optional CC recipient addresses.

    Returns:
        JSON draft payload conforming to the alleato-pm draft contract.
    """
    draft = DraftEmail(to=to, subject=subject, body=body, cc=cc)
    fields: dict = {
        "to": draft.to,
        "subject": draft.subject,
        "body": draft.body,
    }
    if draft.cc:
        fields["cc"] = draft.cc

    recipient_preview = ", ".join(to[:2])
    if len(to) > 2:
        recipient_preview += f" (+{len(to) - 2} more)"

    return _make_draft(
        draft_type="email",
        message=f"Draft email to {recipient_preview} — subject: \"{subject}\"",
        fields=fields,
    )


@tool
def draft_teams_message(
    channel: str,
    body: str,
) -> str:
    """Draft a Microsoft Teams message for human approval. Never posts.

    Args:
        channel: Teams channel name or ID.
        body: Message body in markdown.

    Returns:
        JSON draft payload conforming to the alleato-pm draft contract.
    """
    draft = DraftTeamsMessage(channel=channel, body=body)
    return _make_draft(
        draft_type="teams_message",
        message=f"Draft Teams message for #{draft.channel}",
        fields={"channel": draft.channel, "body": draft.body},
    )


# ---------------------------------------------------------------------------
# Tools — PM record creation
# ---------------------------------------------------------------------------


@tool
def draft_rfi(
    subject: str,
    question: str,
    due_date: Optional[str] = None,
    ball_in_court: Optional[str] = None,
    question_to: Optional[str] = None,
    discipline: Optional[str] = None,
    cost_impact: str = "tbd",
    schedule_impact: str = "tbd",
) -> str:
    """Draft a new RFI (Request for Information) for human approval. Never creates the record.

    Use when the user says "create an RFI", "log an RFI about [topic]", or describes a
    field question that needs a formal answer from the design team.

    Args:
        subject: RFI subject / title.
        question: The actual question being asked.
        due_date: ISO date string for the response due date (e.g. "2026-06-01").
        ball_in_court: Person or company responsible for answering.
        question_to: Who the question is directed to (e.g. "Architect", "Structural Engineer").
        discipline: Trade or discipline (e.g. "Structural", "MEP", "Civil").
        cost_impact: "yes", "no", or "tbd".
        schedule_impact: "yes", "no", or "tbd".

    Returns:
        JSON draft payload conforming to the alleato-pm draft contract.
    """
    draft = DraftRFI(
        subject=subject,
        question=question,
        due_date=due_date,
        ball_in_court=ball_in_court,
        question_to=question_to,
        discipline=discipline,
        cost_impact=cost_impact,  # type: ignore[arg-type]
        schedule_impact=schedule_impact,  # type: ignore[arg-type]
    )
    fields: dict = {
        "subject": draft.subject,
        "question": draft.question,
        "status": draft.status,
        "is_private": draft.is_private,
        "cost_impact": draft.cost_impact,
        "schedule_impact": draft.schedule_impact,
    }
    if draft.due_date:
        fields["due_date"] = draft.due_date
    if draft.ball_in_court:
        fields["ball_in_court"] = draft.ball_in_court
    if draft.question_to:
        fields["question_to"] = draft.question_to
    if draft.discipline:
        fields["discipline"] = draft.discipline

    return _make_draft(
        draft_type="rfi",
        message=f"Here's the RFI I'll create: \"{subject}\"",
        fields=fields,
    )


@tool
def draft_commitment(
    title: str,
    commitment_type: str,
    description: Optional[str] = None,
    value: Optional[float] = None,
    vendor_name: Optional[str] = None,
    project_id: Optional[int] = None,
    status: str = "Draft",
    start_date: Optional[str] = None,
    estimated_completion_date: Optional[str] = None,
    default_retainage_percent: Optional[float] = None,
) -> str:
    """Draft a new commitment (subcontract or purchase order) for human approval. Never creates the record.

    Use when the user says "create a subcontract", "add a PO", "set up a commitment with [vendor]",
    or describes awarding work to a subcontractor or supplier.

    Args:
        title: Commitment title, e.g. "Electrical Work" or "Structural Steel Supply".
        commitment_type: "subcontract" for labor/trade work, "purchase_order" for materials/equipment.
        description: Scope description.
        value: Contract value in dollars.
        vendor_name: Vendor or subcontractor company name.
        project_id: PM platform project ID.
        status: Initial status — defaults to "Draft".
        start_date: ISO start date.
        estimated_completion_date: ISO estimated completion date.
        default_retainage_percent: Retainage percentage (e.g. 10 for 10%).

    Returns:
        JSON draft payload conforming to the alleato-pm draft contract.
    """
    draft = DraftCommitment(
        title=title,
        commitment_type=commitment_type,  # type: ignore[arg-type]
        description=description,
        value=value,
        vendor_name=vendor_name,
        project_id=project_id,
        status=status,
        start_date=start_date,
        estimated_completion_date=estimated_completion_date,
        default_retainage_percent=default_retainage_percent,
    )

    # Resolve table from commitment type
    table = "subcontracts" if draft.commitment_type == "subcontract" else "purchase_orders"

    fields: dict = {
        "title": draft.title,
        "type": draft.commitment_type,
        "status": draft.status,
    }
    if draft.vendor_name:
        fields["vendor_name"] = draft.vendor_name
    if draft.description:
        fields["description"] = draft.description
    if draft.value is not None:
        fields["value"] = draft.value
    if draft.project_id is not None:
        fields["project_id"] = draft.project_id
    if draft.start_date:
        fields["start_date"] = draft.start_date
    if draft.estimated_completion_date:
        fields["estimated_completion_date"] = draft.estimated_completion_date
    if draft.default_retainage_percent is not None:
        fields["default_retainage_percent"] = draft.default_retainage_percent

    vendor_label = f" with {vendor_name}" if vendor_name else ""
    type_label = "subcontract" if draft.commitment_type == "subcontract" else "purchase order"

    return _make_draft(
        draft_type="commitment",
        message=f"Here's the {type_label} I'll create: \"{title}\"{vendor_label}",
        fields=fields,
        table=table,
    )


@tool
def draft_change_event(
    title: str,
    description: Optional[str] = None,
    cost_impact: Optional[float] = None,
    schedule_impact: Optional[int] = None,
    initiating_co: Optional[str] = None,
    scope: str = "other",
    event_type: str = "potential_change",
) -> str:
    """Draft a change event for human approval. Never creates the record.

    Use when the user says "log a change event", "something came up on [project]",
    or describes an unexpected field condition or potential scope change.

    Args:
        title: Short descriptive title for the change event.
        description: Detailed description of what happened or was discovered.
        cost_impact: Estimated cost impact in dollars (can be 0 if unknown).
        schedule_impact: Estimated schedule impact in days (can be 0 if unknown).
        initiating_co: Initiating change order reference number if known.
        scope: "owner_change", "unforeseen_condition", "design_error", or "other".
        event_type: "potential_change", "trend", or "rfi_answer_required".

    Returns:
        JSON draft payload conforming to the alleato-pm draft contract.
    """
    draft = DraftChangeEvent(
        title=title,
        description=description,
        initiating_co=initiating_co,
        cost_impact=cost_impact,
        schedule_impact=schedule_impact,
        scope=scope,  # type: ignore[arg-type]
        type=event_type,  # type: ignore[arg-type]
    )
    fields: dict = {
        "title": draft.title,
        "scope": draft.scope,
        "type": draft.type,
        "status": draft.status,
    }
    if draft.description:
        fields["description"] = draft.description
    if draft.initiating_co:
        fields["initiating_co"] = draft.initiating_co
    if draft.cost_impact is not None:
        fields["cost_impact"] = draft.cost_impact
    if draft.schedule_impact is not None:
        fields["schedule_impact"] = draft.schedule_impact

    return _make_draft(
        draft_type="change_event",
        message=f"Here's the change event I'll log: \"{title}\"",
        fields=fields,
    )


@tool
def draft_task(
    title: str,
    description: Optional[str] = None,
    assignee: Optional[str] = None,
    due_date: Optional[str] = None,
    project_id: Optional[int] = None,
    priority: str = "medium",
    status: str = "open",
) -> str:
    """Draft a task / action item for human approval. Never creates the record.

    Use for AI-generated follow-ups, reminders, accountability items, or user-created
    action items that should appear on the Tasks page. This creates records in the main
    tasks table, not schedule/Gantt tasks.

    Args:
        title: Short task title.
        description: Task detail or source context.
        assignee: Person responsible — name or email address.
        due_date: ISO due date (e.g. "2026-06-15").
        project_id: PM platform project ID if the task belongs to a project.
        priority: "low", "medium", "high", or "urgent".
        status: "open", "in_progress", "blocked", "done", or "cancelled".

    Returns:
        JSON draft payload conforming to the alleato-pm draft contract.
    """
    draft = DraftTask(
        title=title,
        description=description,
        assignee=assignee,
        due_date=due_date,
        project_id=project_id,
        priority=priority,  # type: ignore[arg-type]
        status=status,  # type: ignore[arg-type]
    )
    fields: dict = {
        "title": draft.title,
        "description": draft.description or draft.title,
        "status": draft.status,
        "priority": draft.priority,
        "source_system": "ai_assistant",
    }
    if draft.assignee:
        fields["assignee_name"] = draft.assignee
    if draft.due_date:
        fields["due_date"] = draft.due_date
    if draft.project_id is not None:
        fields["project_id"] = draft.project_id

    assignee_label = f" — assigned to {assignee}" if assignee else ""

    return _make_draft(
        draft_type="task",
        message=f"Here's the task I'll create: \"{title}\"{assignee_label}",
        fields=fields,
    )


# ---------------------------------------------------------------------------
# Tool registry (for agent wiring)
# ---------------------------------------------------------------------------

ALL_ACTION_TOOLS = [
    draft_email,
    draft_teams_message,
    draft_rfi,
    draft_commitment,
    draft_change_event,
    draft_task,
]
