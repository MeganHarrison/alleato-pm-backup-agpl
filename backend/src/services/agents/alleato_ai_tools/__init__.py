"""Standalone Alleato AI tool surface ported into the Render backend.

These tools mirror the `alleato-ai` Deep Agents runtime. Read tools are
database/API backed. Write-oriented tools only return approval-preview payloads.
"""

from src.services.agents.alleato_ai_tools.actions import (
    draft_change_event,
    draft_commitment,
    draft_email,
    draft_rfi,
    draft_task,
    draft_teams_message,
)
from src.services.agents.alleato_ai_tools.acumatica import (
    acumatica_ap_aging,
    acumatica_ar_aging,
    acumatica_cash_position,
    acumatica_project_budget,
    acumatica_project_list,
    acumatica_purchase_orders,
    acumatica_recent_bills,
    acumatica_recent_invoices,
    acumatica_vendor_spend,
)
from src.services.agents.alleato_ai_tools.db import describe_schema, query_db
from src.services.agents.alleato_ai_tools.graph_api import (
    search_emails,
    search_teams_messages,
)
from src.services.agents.alleato_ai_tools.intelligence import (
    portfolio_intelligence_brief,
    project_intelligence_brief,
)
from src.services.agents.alleato_ai_tools.pm import (
    portfolio_overview,
    project_briefing_snapshot,
    project_budget_summary,
    project_risk_snapshot,
)
from src.services.agents.alleato_ai_tools.rag import (
    list_recent_meetings,
    search_meeting_transcripts,
    search_unstructured,
)
from src.services.agents.alleato_ai_tools.recent import recent_activity
from src.services.agents.alleato_ai_tools.resolvers import (
    resolve_contract,
    resolve_cost_code,
    resolve_project_by_name,
    resolve_vendor_by_name,
)
from src.services.agents.alleato_ai_tools.think import think_tool

RESOLVERS = [
    resolve_project_by_name,
    resolve_vendor_by_name,
    resolve_contract,
    resolve_cost_code,
]

READ_ONLY_PM_TOOLS = [
    *RESOLVERS,
    # Synthesized deep-read intelligence — the authoritative narrative source.
    # Listed first so the model reaches for it before the raw-data fallbacks below.
    project_intelligence_brief,
    portfolio_intelligence_brief,
    project_briefing_snapshot,
    project_budget_summary,
    project_risk_snapshot,
    portfolio_overview,
    list_recent_meetings,
    recent_activity,
    search_meeting_transcripts,
    search_unstructured,
    search_emails,
    search_teams_messages,
    think_tool,
]

SQL_TOOLS = [
    describe_schema,
    query_db,
]

DRAFT_ACTION_TOOLS = [
    draft_email,
    draft_teams_message,
    draft_rfi,
    draft_commitment,
    draft_change_event,
    draft_task,
]

EXTERNAL_ACCOUNTING_TOOLS = [
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

ORCHESTRATOR_TOOLS = [
    *READ_ONLY_PM_TOOLS,
    *SQL_TOOLS,
    *DRAFT_ACTION_TOOLS,
    *EXTERNAL_ACCOUNTING_TOOLS,
]

__all__ = [
    "DRAFT_ACTION_TOOLS",
    "EXTERNAL_ACCOUNTING_TOOLS",
    "ORCHESTRATOR_TOOLS",
    "READ_ONLY_PM_TOOLS",
    "RESOLVERS",
    "SQL_TOOLS",
    "acumatica_ap_aging",
    "acumatica_ar_aging",
    "acumatica_cash_position",
    "acumatica_project_budget",
    "acumatica_project_list",
    "acumatica_purchase_orders",
    "acumatica_recent_bills",
    "acumatica_recent_invoices",
    "acumatica_vendor_spend",
    "describe_schema",
    "draft_change_event",
    "draft_commitment",
    "draft_email",
    "draft_rfi",
    "draft_task",
    "draft_teams_message",
    "list_recent_meetings",
    "portfolio_intelligence_brief",
    "portfolio_overview",
    "project_briefing_snapshot",
    "project_budget_summary",
    "project_intelligence_brief",
    "project_risk_snapshot",
    "query_db",
    "recent_activity",
    "resolve_contract",
    "resolve_cost_code",
    "resolve_project_by_name",
    "resolve_vendor_by_name",
    "search_emails",
    "search_meeting_transcripts",
    "search_teams_messages",
    "search_unstructured",
    "think_tool",
]
