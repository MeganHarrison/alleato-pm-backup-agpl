"""Guardrails for Alleato AI prompt composition."""

from __future__ import annotations

from src.services.agents.alleato_ai_tools.prompts import ORCHESTRATOR_PROMPT
from src.services.agents.alleato_ai_tools.subagents import ALL_SUBAGENTS, build_subagents


def test_orchestrator_prompt_composes_context_in_expected_order():
    identity_index = ORCHESTRATOR_PROMPT.index("# Identity")
    soul_index = ORCHESTRATOR_PROMPT.index("# Soul")
    user_index = ORCHESTRATOR_PROMPT.index("# User And Team Context")
    workflow_index = ORCHESTRATOR_PROMPT.index("# How you work")

    assert identity_index < soul_index < user_index < workflow_index


def test_orchestrator_prompt_includes_identity_soul_user_context_and_workflow():
    assert "# Identity" in ORCHESTRATOR_PROMPT
    assert "# Soul" in ORCHESTRATOR_PROMPT
    assert "# User And Team Context" in ORCHESTRATOR_PROMPT
    assert "# How you work" in ORCHESTRATOR_PROMPT


def test_orchestrator_prompt_keeps_brandon_first_user_context():
    assert "The primary human context for now is Brandon." in ORCHESTRATOR_PROMPT
    assert "Do not center Megan as an Alleato team member." in ORCHESTRATOR_PROMPT
    assert "When Brandon is the user, speak as a trusted right hand" in ORCHESTRATOR_PROMPT


def test_orchestrator_prompt_calibrates_direct_without_woo_woo_voice():
    assert "Your intensity should match the moment" in ORCHESTRATOR_PROMPT
    assert "Do not confuse spirituality with spiritual vocabulary." in ORCHESTRATOR_PROMPT
    assert "The deeper philosophy should show up as courage, service, discipline" in ORCHESTRATOR_PROMPT
    assert "Do not talk like a spiritual coach." in ORCHESTRATOR_PROMPT


def test_orchestrator_prompt_encodes_brandon_decision_pattern():
    assert "assume he is trying to make a decision or reduce risk" in ORCHESTRATOR_PROMPT
    assert "The read: what is actually going on." in ORCHESTRATOR_PROMPT
    assert "The move: who should do what next." in ORCHESTRATOR_PROMPT


def test_orchestrator_prompt_preserves_final_response_filter_and_profile_expansion_rules():
    assert "Before answering, run the response through this filter" in ORCHESTRATOR_PROMPT
    assert "If something is failing, did it fail loudly enough for the team to act?" in ORCHESTRATOR_PROMPT
    assert "This file should grow from lived context, not assumptions." in ORCHESTRATOR_PROMPT
    assert "Add future team profiles only when there is enough evidence" in ORCHESTRATOR_PROMPT


def test_orchestrator_prompt_preserves_anti_drift_contract():
    assert "The agent should never slowly slide back into generic assistant behavior." in ORCHESTRATOR_PROMPT
    assert "clear read, real evidence, practical implication, next move" in ORCHESTRATOR_PROMPT
    assert "Most of his questions should be treated as decision-support requests." in ORCHESTRATOR_PROMPT


def test_orchestrator_prompt_excludes_performative_spiritual_jargon():
    forbidden_terms = [
        "higher vibration",
        "manifest",
        "manifestation",
        "abundance mindset",
        "divine masculine",
        "sacred business",
        "soul-led",
        "healing journey",
    ]
    prompt = ORCHESTRATOR_PROMPT.lower()

    for term in forbidden_terms:
        assert term not in prompt


# --- Consolidation tests (5→2 sub-agents) ---


def test_only_two_subagents_remain():
    """After consolidation, only financial-analyst and risk-analyst exist."""
    names = [s["name"] for s in ALL_SUBAGENTS]
    assert sorted(names) == ["financial-analyst", "risk-analyst"]


def test_eliminated_subagents_not_present():
    """Schedule, communications, and business-development analysts are removed."""
    names = {s["name"] for s in ALL_SUBAGENTS}
    assert "schedule-analyst" not in names
    assert "communications-analyst" not in names
    assert "business-development-analyst" not in names


def test_financial_analyst_has_intelligence_briefs():
    """Financial analyst must have access to synthesized intelligence tools."""
    financial = next(s for s in ALL_SUBAGENTS if s["name"] == "financial-analyst")
    tool_names = {t.name for t in financial["tools"]}
    assert "project_intelligence_brief" in tool_names
    assert "portfolio_intelligence_brief" in tool_names


def test_risk_analyst_has_schedule_tools():
    """Risk analyst absorbed schedule analysis — must have schedule-relevant tools."""
    risk = next(s for s in ALL_SUBAGENTS if s["name"] == "risk-analyst")
    tool_names = {t.name for t in risk["tools"]}
    assert "search_meeting_transcripts" in tool_names
    assert "list_recent_meetings" in tool_names
    assert "recent_activity" in tool_names
    assert "search_unstructured" in tool_names


def test_both_subagents_have_structured_output():
    """Both remaining sub-agents enforce structured packet output."""
    for subagent in ALL_SUBAGENTS:
        assert "response_format" in subagent, (
            f"{subagent['name']} missing response_format"
        )


def test_orchestrator_prompt_no_eliminated_agent_routing():
    """Orchestrator prompt must not reference eliminated sub-agents."""
    assert "schedule-analyst" not in ORCHESTRATOR_PROMPT
    assert "communications-analyst" not in ORCHESTRATOR_PROMPT
    assert "business-development-analyst" not in ORCHESTRATOR_PROMPT


def test_orchestrator_prompt_has_person_attribution():
    """Orchestrator absorbed communications-analyst's person-attribution discipline."""
    assert "Person-attribution" in ORCHESTRATOR_PROMPT


def test_build_subagents_sql_gate():
    """SQL tools should be excluded when include_sql=False."""
    agents = build_subagents(include_sql=False, include_acumatica=True)
    for agent in agents:
        tool_names = {t.name for t in agent["tools"]}
        assert "query_db" not in tool_names
        assert "describe_schema" not in tool_names
