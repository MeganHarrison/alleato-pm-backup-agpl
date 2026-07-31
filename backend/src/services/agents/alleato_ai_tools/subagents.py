"""Sub-agent definitions.

Each sub-agent is a focused investigator with its own context window and tool subset.
The orchestrator delegates to them in parallel and integrates their reports.
"""

from typing import Literal

from pydantic import BaseModel, Field

from .prompts import (
    FINANCIAL_ANALYST_PROMPT,
    RISK_ANALYST_PROMPT,
)
from . import (
    acumatica_ap_aging,
    acumatica_ar_aging,
    acumatica_cash_position,
    acumatica_project_budget,
    acumatica_project_list,
    acumatica_purchase_orders,
    acumatica_recent_bills,
    acumatica_recent_invoices,
    acumatica_vendor_spend,
    describe_schema,
    list_recent_meetings,
    portfolio_intelligence_brief,
    portfolio_overview,
    project_briefing_snapshot,
    project_budget_summary,
    project_intelligence_brief,
    project_risk_snapshot,
    query_db,
    recent_activity,
    search_emails,
    search_meeting_transcripts,
    search_teams_messages,
    search_unstructured,
    think_tool,
)


class _SubagentPacket(BaseModel):
    """Structured packet returned by analyst subagents to the orchestrator."""

    findings: list[str] = Field(
        default_factory=list,
        description="Specific facts or observations found by the subagent. No narrative synthesis.",
    )
    citations: list[str] = Field(
        default_factory=list,
        description="Source identifiers supporting the findings, such as table IDs, dates, or tool result labels.",
    )
    confidence: Literal["high", "medium", "low"] = Field(
        description="Confidence based on data freshness, source coverage, and conflicting evidence.",
    )
    open_questions: list[str] = Field(
        default_factory=list,
        description="Specific unresolved gaps the orchestrator should disclose or investigate further.",
    )


class FinancialAnalystPacket(_SubagentPacket):
    """Financial analyst structured output."""


class RiskAnalystPacket(_SubagentPacket):
    """Risk analyst structured output."""


def build_subagents(
    *,
    include_sql: bool = True,
    include_acumatica: bool = True,
) -> list[dict]:
    """Build subagents with the same tool gates as the orchestrator runtime."""

    financial_tools = [
        project_intelligence_brief,
        portfolio_intelligence_brief,
        project_budget_summary,
        portfolio_overview,
        think_tool,
    ]
    if include_sql:
        financial_tools = [describe_schema, query_db, *financial_tools]
    if include_acumatica:
        financial_tools.extend(
            [
                acumatica_ap_aging,
                acumatica_ar_aging,
                acumatica_cash_position,
                acumatica_project_budget,
                acumatica_project_list,
                acumatica_purchase_orders,
                acumatica_recent_bills,
                acumatica_recent_invoices,
                acumatica_vendor_spend,
            ]
        )

    risk_tools = [
        project_intelligence_brief,
        portfolio_intelligence_brief,
        project_briefing_snapshot,
        project_risk_snapshot,
        project_budget_summary,
        search_meeting_transcripts,
        list_recent_meetings,
        recent_activity,
        search_emails,
        search_teams_messages,
        search_unstructured,
        think_tool,
    ]
    if include_sql:
        risk_tools = [describe_schema, query_db, *risk_tools]

    return [
        {
            "name": "financial-analyst",
            "description": (
                "Delegate financial questions: budget vs. actuals, commitments, change orders, "
                "pay applications, cash position, margin, billing, Acumatica data. "
                "Give one focused question at a time."
            ),
            "system_prompt": FINANCIAL_ANALYST_PROMPT,
            "tools": financial_tools,
            "response_format": FinancialAnalystPacket,
        },
        {
            "name": "risk-analyst",
            "description": (
                "Delegate risk and schedule questions: aged RFIs, late submittals, "
                "critical path, milestones, procurement pipeline, contractual exposure, "
                "claim signals, portfolio risk ranking, subcontractor execution, "
                "action item accountability. Give one focused question at a time."
            ),
            "system_prompt": RISK_ANALYST_PROMPT,
            "tools": risk_tools,
            "response_format": RiskAnalystPacket,
        },
    ]


ALL_SUBAGENTS = build_subagents(include_sql=True, include_acumatica=True)
