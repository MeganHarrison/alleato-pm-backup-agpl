import sys

import pytest

from src.services.agents.deep_project_intelligence import (
    REQUIRED_EXECUTIVE_SOURCE_TYPES,
    REQUIRED_SOURCE_TYPES,
    _deep_agent_executive_prompt,
    _deep_agent_prompt,
    build_executive_briefing_contract_spike,
    build_project_status_contract_spike,
    deep_agents_runtime_inventory,
    deep_agents_runtime_subagent_names,
    deep_agents_runtime_tool_names,
    _openai_model_name,
    _resolve_deep_agents_model,
)
from src.services.agents.deep_project_intelligence_contracts import (
    DeepOrganization,
    DeepExecutiveIntelligenceRequest,
    EvidenceItem,
    DeepProject,
    DeepProjectIntelligenceRequest,
    SourceCoverage,
)
class _Store:
    def __init__(self, project=None, client=None):
        self.project = project
        self._client = client

    def get_project(self, project_id):
        if self.project and self.project.get("id") == project_id:
            return self.project
        return None


class _Result:
    def __init__(self, data):
        self.data = data


class _TableQuery:
    def __init__(self, db, table_name):
        self.db = db
        self.table_name = table_name
        self.rows = list(db.tables.get(table_name, []))
        self.limit_count = None

    def select(self, *_args):
        return self

    def eq(self, key, value):
        self.rows = [row for row in self.rows if row.get(key) == value]
        return self

    def in_(self, key, values):
        allowed = set(values)
        self.rows = [row for row in self.rows if row.get(key) in allowed]
        return self

    def order(self, key, desc=False):
        self.rows = sorted(self.rows, key=lambda row: row.get(key) or "", reverse=desc)
        return self

    def limit(self, count):
        self.limit_count = count
        return self

    def execute(self):
        rows = self.rows[: self.limit_count] if self.limit_count is not None else self.rows
        return _Result([dict(row) for row in rows])


class _FakeSupabase:
    def __init__(self, tables):
        self.tables = tables

    def table(self, table_name):
        return _TableQuery(self, table_name)


def _request():
    return DeepProjectIntelligenceRequest(
        userId="user-1",
        projectId=43,
        sessionId="session-1",
        question="What is the current risk/status on this project?",
    )


def _executive_request():
    return DeepExecutiveIntelligenceRequest(
        userId="user-1",
        sessionId="session-1",
        question="What risks exist in the business and what am I waiting on?",
    )


def _override_deep_agent_auth(app, path="/api/intelligence/deep-agent/project-status"):
    """Override the admin dependency even when test conftest imports it as a mock."""
    for route in app.routes:
        if getattr(route, "path", None) == path:
            for dependency in getattr(route, "dependant", None).dependencies:
                if dependency.name == "_":
                    app.dependency_overrides[dependency.call] = lambda: None
            return
    raise AssertionError(f"Deep Agents route was not registered: {path}")


def _clear_overrides(app, path="/api/intelligence/deep-agent/project-status"):
    for route in app.routes:
        if getattr(route, "path", None) == path:
            for dependency in getattr(route, "dependant", None).dependencies:
                if dependency.name == "_":
                    app.dependency_overrides.pop(dependency.call, None)


def test_contract_spike_returns_explicit_missing_source_coverage():
    response = build_project_status_contract_spike(
        _request(),
        _Store({"id": 43, "name": "Westfield Collective"}),
    )

    assert response.mode == "contract_spike"
    assert response.project.name == "Westfield Collective"
    assert response.confidence == "low"
    assert response.evidence == []
    assert [source.source_type for source in response.sources_checked] == list(REQUIRED_SOURCE_TYPES)
    assert all(source.status == "missing" for source in response.sources_checked)
    assert all(source.record_count == 0 for source in response.sources_checked)
    assert response.tool_trace[0].status == "success"
    assert response.tool_trace[1].tool == "source_client"
    assert response.tool_trace[1].status == "skipped"


def test_contract_spike_reads_source_coverage_without_synthesis():
    client = _FakeSupabase(
        {
            "intelligence_targets": [
                {"id": "target-1", "project_id": 43, "updated_at": "2026-05-10T00:00:00Z"}
            ],
            "intelligence_packets": [
                {
                    "id": "packet-1",
                    "target_id": "target-1",
                    "packet_type": "project_status",
                    "executive_summary": "Packet says owner decisions are pending.",
                    "generated_at": "2026-05-11T00:00:00Z",
                }
            ],
            "document_metadata": [
                {
                    "id": "teams-1",
                    "project_id": 43,
                    "source_system": "teams",
                    "title": "Teams decision thread",
                    "overview": "Teams discussion found a schedule concern.",
                    "source_last_modified_at": "2026-05-12T00:00:00Z",
                },
                {
                    "id": "meeting-1",
                    "project_id": 43,
                    "source": "fireflies",
                    "title": "Owner meeting",
                    "summary": "Meeting covered budget exposure.",
                    "date": "2026-05-09T00:00:00Z",
                },
            ],
            "project_emails": [
                {
                    "id": 1,
                    "project_id": 43,
                    "subject": "Submittal follow-up",
                    "body_text": "Owner needs an answer.",
                    "received_at": "2026-05-08T00:00:00Z",
                }
            ],
            "project_documents": [
                {
                    "id": 2,
                    "project_id": 43,
                    "title": "Contract drawing",
                    "source_last_modified_at": "2026-05-07T00:00:00Z",
                }
            ],
            "acumatica_project_budgets": [
                {
                    "id": 3,
                    "project_id": 43,
                    "description": "Concrete budget",
                    "updated_at": "2026-05-06T00:00:00Z",
                }
            ],
            "schedule_tasks": [
                {
                    "id": "schedule-1",
                    "project_id": 43,
                    "name": "Milestone",
                    "finish_date": "2026-05-20T00:00:00Z",
                }
            ],
            "rfis": [
                {
                    "id": "rfi-1",
                    "project_id": 43,
                    "subject": "RFI 1",
                    "updated_at": "2026-05-05T00:00:00Z",
                }
            ],
            "submittals": [
                {
                    "id": "submittal-1",
                    "project_id": 43,
                    "title": "Submittal 1",
                    "updated_at": "2026-05-04T00:00:00Z",
                }
            ],
        }
    )

    response = build_project_status_contract_spike(
        _request(),
        _Store({"id": 43, "name": "Westfield Collective"}, client=client),
    )

    assert response.confidence == "medium"
    assert all(source.status == "checked" for source in response.sources_checked)
    assert [source.source_type for source in response.sources_checked] == list(REQUIRED_SOURCE_TYPES)
    assert len(response.evidence) >= 8
    assert response.evidence[0].source_type == "packet"
    assert response.tool_trace[1].tool == "packet_reader"
    assert response.tool_trace[-1].tool == "submittal_reader"
    assert response.recommended_actions[0].label == "Add Deep Agents synthesis on top of checked sources"


def test_deep_agents_runtime_can_synthesize_behind_contract():
    class _Agent:
        def invoke(self, payload):
            assert "messages" in payload
            return {"messages": [{"role": "assistant", "content": "Runtime synthesis from Deep Agents."}]}

    def create_agent(**kwargs):
        assert kwargs["model"] == "openai:gpt-5.5"
        tool_names = [getattr(tool, "name", getattr(tool, "__name__", "")) for tool in kwargs["tools"]]
        assert "source_coverage" in tool_names
        assert "pm_budget_summary" in tool_names
        assert "resolve_project_by_name" not in tool_names
        assert "query_db" not in tool_names
        assert "draft_rfi" not in tool_names
        assert kwargs["subagents"] == []
        assert "Resolve entities first" in kwargs["system_prompt"]
        return _Agent()

    response = build_project_status_contract_spike(
        _request(),
        _Store(
            {"id": 43, "name": "Westfield Collective"},
            client=_FakeSupabase({"intelligence_targets": []}),
        ),
        runtime="deep_agents",
        create_agent=create_agent,
    )

    assert response.mode == "deep_agents"
    assert response.answer == "Runtime synthesis from Deep Agents."
    assert response.tool_trace[-1].tool == "deepagents_runtime"
    assert response.tool_trace[-1].status == "success"
    assert response.approved_skill_context is None


def test_project_deep_agent_prompt_includes_approved_skill_context():
    prompt = _deep_agent_prompt(
        DeepProjectIntelligenceRequest(
            userId="user-1",
            projectId=43,
            sessionId="session-1",
            question="What is the current risk/status on this project?",
            approvedSkillContext=(
                "## Approved Skill Library Context\n\n"
                "### Chase project schedule risks (v1, schedule, medium risk)"
            ),
        ),
        DeepProject(id=43, name="Westfield Collective"),
        [],
        [],
    )

    assert "Approved project Skill Library context" in prompt
    assert "Chase project schedule risks" in prompt


def test_deep_agents_runtime_attaches_harness_options_and_subagent_skills(monkeypatch):
    captured: dict[str, object] = {}
    harness_options = {
        "backend": object(),
        "store": object(),
        "skills": ["/skills/"],
        "memory": ["/AGENTS.md"],
        "checkpointer": object(),
    }

    monkeypatch.setenv("DEEP_AGENTS_STANDALONE_TOOLS_ENABLED", "true")
    monkeypatch.setenv("DEEP_AGENTS_SUBAGENTS_ENABLED", "true")
    monkeypatch.setattr(
        "src.services.agents.deep_project_intelligence._runtime_harness_options",
        lambda: (harness_options, []),
    )

    class _Agent:
        def invoke(self, payload, config=None):
            captured["payload"] = payload
            captured["config"] = config
            return {"messages": [{"role": "assistant", "content": "Runtime synthesis from full harness."}]}

    def create_agent(**kwargs):
        captured["kwargs"] = kwargs
        return _Agent()

    response = build_project_status_contract_spike(
        _request(),
        _Store(
            {"id": 43, "name": "Westfield Collective"},
            client=_FakeSupabase({"intelligence_targets": []}),
        ),
        runtime="deep_agents",
        create_agent=create_agent,
    )

    kwargs = captured["kwargs"]
    assert response.mode == "deep_agents"
    assert kwargs["name"] == "alleato-project-intelligence-orchestrator"
    assert kwargs["backend"] is harness_options["backend"]
    assert kwargs["store"] is harness_options["store"]
    assert kwargs["skills"] == ["/skills/"]
    assert kwargs["memory"] == ["/AGENTS.md"]
    assert kwargs["checkpointer"] is harness_options["checkpointer"]
    assert kwargs["subagents"]
    assert all(subagent["skills"] == ["/skills/"] for subagent in kwargs["subagents"])
    structured_subagents = {
        subagent["name"]: subagent.get("response_format")
        for subagent in kwargs["subagents"]
        if subagent["name"]
        in {"financial-analyst", "risk-analyst", "communications-analyst"}
    }
    assert set(structured_subagents) == {
        "financial-analyst",
        "risk-analyst",
        "communications-analyst",
    }
    assert all(response_format is not None for response_format in structured_subagents.values())


def test_deep_agents_runtime_tool_inventory_is_gated(monkeypatch):
    monkeypatch.delenv("DEEP_AGENTS_STANDALONE_TOOLS_ENABLED", raising=False)
    assert deep_agents_runtime_tool_names() == ()
    assert deep_agents_runtime_subagent_names() == ()

    monkeypatch.setenv("DEEP_AGENTS_STANDALONE_TOOLS_ENABLED", "true")
    read_only_expected = {
        "resolve_project_by_name",
        "resolve_vendor_by_name",
        "resolve_contract",
        "resolve_cost_code",
        "project_briefing_snapshot",
        "project_budget_summary",
        "project_risk_snapshot",
        "portfolio_overview",
        "list_recent_meetings",
        "recent_activity",
        "search_meeting_transcripts",
        "search_unstructured",
        "search_emails",
        "search_teams_messages",
        "think_tool",
    }

    assert set(deep_agents_runtime_tool_names()) == read_only_expected
    assert "query_db" not in deep_agents_runtime_tool_names()
    assert "draft_rfi" not in deep_agents_runtime_tool_names()
    assert "acumatica_project_budget" not in deep_agents_runtime_tool_names()


def test_deep_agents_runtime_tool_inventory_matches_full_standalone_surface(monkeypatch):
    monkeypatch.setenv("DEEP_AGENTS_STANDALONE_TOOLS_ENABLED", "true")
    monkeypatch.setenv("DEEP_AGENTS_SQL_TOOLS_ENABLED", "true")
    monkeypatch.setenv("DEEP_AGENTS_ACUMATICA_TOOLS_ENABLED", "true")
    monkeypatch.setenv("DEEP_AGENTS_DRAFT_TOOLS_ENABLED", "true")
    monkeypatch.setenv("DEEP_AGENTS_SUBAGENTS_ENABLED", "true")
    expected_tools = {
        "resolve_project_by_name",
        "resolve_vendor_by_name",
        "resolve_contract",
        "resolve_cost_code",
        "project_briefing_snapshot",
        "project_budget_summary",
        "project_risk_snapshot",
        "portfolio_overview",
        "describe_schema",
        "query_db",
        "list_recent_meetings",
        "recent_activity",
        "search_meeting_transcripts",
        "search_unstructured",
        "search_emails",
        "search_teams_messages",
        "think_tool",
        "draft_email",
        "draft_teams_message",
        "draft_rfi",
        "draft_commitment",
        "draft_change_event",
        "draft_task",
        "acumatica_ap_aging",
        "acumatica_ar_aging",
        "acumatica_cash_position",
        "acumatica_project_budget",
        "acumatica_project_list",
        "acumatica_purchase_orders",
        "acumatica_recent_bills",
        "acumatica_recent_invoices",
        "acumatica_vendor_spend",
    }

    assert set(deep_agents_runtime_tool_names()) == expected_tools
    assert set(deep_agents_runtime_subagent_names()) == {
        "financial-analyst",
        "schedule-analyst",
        "risk-analyst",
        "communications-analyst",
        "business-development-analyst",
    }


def test_deep_agents_runtime_subagents_respect_sql_and_acumatica_gates(monkeypatch):
    from src.services.agents.deep_project_intelligence import _runtime_subagents

    monkeypatch.setenv("DEEP_AGENTS_STANDALONE_TOOLS_ENABLED", "true")
    monkeypatch.setenv("DEEP_AGENTS_SUBAGENTS_ENABLED", "true")
    monkeypatch.delenv("DEEP_AGENTS_SQL_TOOLS_ENABLED", raising=False)
    monkeypatch.delenv("DEEP_AGENTS_ACUMATICA_TOOLS_ENABLED", raising=False)

    subagents = _runtime_subagents()
    tool_names = {
        getattr(tool, "name", getattr(tool, "__name__", ""))
        for subagent in subagents
        for tool in subagent["tools"]
    }

    assert "query_db" not in tool_names
    assert "describe_schema" not in tool_names
    assert not any(name.startswith("acumatica_") for name in tool_names)
    assert "project_budget_summary" in tool_names
    assert "search_meeting_transcripts" in tool_names
    structured = {
        subagent["name"]: subagent.get("response_format")
        for subagent in subagents
        if subagent["name"] in {"financial-analyst", "risk-analyst", "communications-analyst"}
    }
    assert all(schema is not None for schema in structured.values())


def test_deep_agents_runtime_inventory_reports_effective_surface(monkeypatch):
    monkeypatch.setenv("DEEP_AGENTS_PROJECT_INTELLIGENCE_ENABLED", "true")
    monkeypatch.setenv("DEEP_AGENTS_PROJECT_INTELLIGENCE_RUNTIME", "deep_agents")
    monkeypatch.setenv("DEEP_AGENTS_STANDALONE_TOOLS_ENABLED", "true")
    monkeypatch.setenv("DEEP_AGENTS_SQL_TOOLS_ENABLED", "true")
    monkeypatch.setenv("DEEP_AGENTS_ACUMATICA_TOOLS_ENABLED", "true")
    monkeypatch.setenv("DEEP_AGENTS_DRAFT_TOOLS_ENABLED", "true")
    monkeypatch.setenv("DEEP_AGENTS_SUBAGENTS_ENABLED", "true")
    monkeypatch.setenv("DEEP_AGENTS_MEMORY_ENABLED", "true")
    monkeypatch.setenv("DATABASE_URL", "postgresql://example")

    inventory = deep_agents_runtime_inventory()

    assert inventory["status"] == "active"
    assert inventory["toolCount"] == 33
    assert inventory["subagentCount"] == 5
    assert "query_db" in inventory["tools"]
    assert "draft_rfi" in inventory["tools"]
    assert "financial-analyst" in inventory["subagents"]
    subagent_details = {
        subagent["name"]: subagent for subagent in inventory["subagentDetails"]
    }
    assert subagent_details["financial-analyst"]["structuredOutput"] is True
    assert subagent_details["financial-analyst"]["responseFormat"] == "FinancialAnalystPacket"
    assert subagent_details["risk-analyst"]["structuredOutput"] is True
    assert subagent_details["risk-analyst"]["responseFormat"] == "RiskAnalystPacket"
    assert subagent_details["communications-analyst"]["structuredOutput"] is True
    assert (
        subagent_details["communications-analyst"]["responseFormat"]
        == "CommunicationsAnalystPacket"
    )
    assert subagent_details["schedule-analyst"]["structuredOutput"] is False
    assert inventory["memory"]["enabled"] is True
    assert inventory["memory"]["middleware"] == "DbMemoryMiddleware"
    assert set(inventory["memory"]["tools"]) == {
        "recall_user_memory",
        "recall_project_memory",
        "recall_team_memory",
        "propose_memory_candidate",
    }
    assert inventory["memory"]["databaseUrlConfigured"] is True
    assert "DbMemoryMiddleware" not in inventory["knownMissing"]


def test_deep_agents_runtime_invokes_installed_graph_with_bindable_model(monkeypatch):
    for module_name in list(sys.modules):
        if module_name == "langchain" or module_name.startswith("langchain."):
            monkeypatch.delitem(sys.modules, module_name, raising=False)

    deepagents = pytest.importorskip("deepagents")
    fake_chat_models = pytest.importorskip("langchain_core.language_models.fake_chat_models")

    class _BindableFakeChatModel(fake_chat_models.FakeListChatModel):
        def bind_tools(self, tools, *, tool_choice=None, **kwargs):
            assert tools
            return self

    response = build_project_status_contract_spike(
        _request(),
        _Store(
            {"id": 43, "name": "Westfield Collective"},
            client=_FakeSupabase(
                {
                    "intelligence_targets": [
                        {
                            "id": "target-1",
                            "project_id": 43,
                            "updated_at": "2026-05-10T00:00:00Z",
                        }
                    ],
                    "intelligence_packets": [
                        {
                            "id": "packet-1",
                            "target_id": "target-1",
                            "packet_type": "project_status",
                            "executive_summary": "Packet says owner decisions are pending.",
                            "generated_at": "2026-05-11T00:00:00Z",
                        }
                    ],
                }
            ),
        ),
        runtime="deep_agents",
        create_agent=deepagents.create_deep_agent,
        model=_BindableFakeChatModel(
            responses=[
                "Installed Deep Agents graph synthesized checked packet coverage."
            ]
        ),
    )

    assert response.mode == "deep_agents"
    assert response.answer == "Installed Deep Agents graph synthesized checked packet coverage."
    assert response.tool_trace[-1].tool == "deepagents_runtime"
    assert response.tool_trace[-1].status == "success"


def test_deep_agents_runtime_prefers_ai_gateway_model(monkeypatch):
    pytest.importorskip("langchain_openai")
    monkeypatch.setenv("AI_GATEWAY_API_KEY", "gateway-test-key")
    monkeypatch.setenv("OPENAI_API_KEY", "direct-test-key")

    model = _resolve_deep_agents_model("openai:gpt-5.4-mini")

    assert getattr(model, "model_name") == "openai/gpt-5.4-mini"
    assert str(getattr(model, "openai_api_base")) == "https://ai-gateway.vercel.sh/v1"


def test_deep_agents_runtime_direct_openai_model_normalization(monkeypatch):
    pytest.importorskip("langchain_openai")
    monkeypatch.delenv("AI_GATEWAY_API_KEY", raising=False)
    monkeypatch.setenv("OPENAI_API_KEY", "direct-test-key")

    model = _resolve_deep_agents_model("openai/gpt-5.4-mini")

    assert getattr(model, "model_name") == "gpt-5.4-mini"


def test_openai_model_name_normalizes_langchain_and_gateway_formats():
    assert _openai_model_name("openai:gpt-5.4-mini", gateway=True) == "openai/gpt-5.4-mini"
    assert _openai_model_name("openai/gpt-5.4-mini", gateway=False) == "gpt-5.4-mini"
    assert _openai_model_name("gpt-5.4-mini", gateway=True) == "openai/gpt-5.4-mini"


def test_deep_agents_runtime_failure_falls_back_to_contract_answer():
    def create_agent(**_kwargs):
        raise RuntimeError("deepagents unavailable")

    response = build_project_status_contract_spike(
        _request(),
        _Store(
            {"id": 43, "name": "Westfield Collective"},
            client=_FakeSupabase({"intelligence_targets": []}),
        ),
        runtime="deep_agents",
        create_agent=create_agent,
    )

    assert response.mode == "contract_spike"
    assert "checked 0 source categories" in response.answer
    assert response.tool_trace[-1].tool == "deepagents_runtime"
    assert response.tool_trace[-1].status == "failed"
    assert "deepagents unavailable" in response.tool_trace[-1].detail


def test_executive_contract_spike_reads_business_wide_source_coverage():
    client = _FakeSupabase(
        {
            "daily_recaps": [
                {
                    "id": "brief-1",
                    "recap_kind": "executive_briefing",
                    "workflow_status": "approved",
                    "recap_date": "2026-05-14",
                    "briefing_packet": {"summary": "Today has two urgent follow-ups."},
                }
            ],
            "executive_briefing_follow_ups": [
                {
                    "id": "task-1",
                    "title": "Get Megan an update",
                    "section": "urgent",
                    "created_at": "2026-05-14T10:00:00Z",
                }
            ],
            "tasks": [
                {
                    "id": "pm-task-1",
                    "title": "Send owner decision list",
                    "description": "Brandon owns the current task-register follow-up.",
                    "assignee_name": "Brandon Clymer",
                    "status": "open",
                    "priority": "high",
                    "updated_at": "2026-05-14T11:00:00Z",
                }
            ],
            "project_emails": [
                {
                    "id": 1,
                    "subject": "Need update",
                    "body_text": "Can someone send the latest?",
                    "received_at": "2026-05-14T09:00:00Z",
                }
            ],
            "document_metadata": [
                {
                    "id": "teams-1",
                    "source_system": "teams",
                    "title": "Teams risk thread",
                    "overview": "Team is blocked on ownership.",
                    "source_last_modified_at": "2026-05-14T08:00:00Z",
                },
                {
                    "id": "meeting-1",
                    "source": "fireflies",
                    "title": "Daily huddle",
                    "summary": "Meeting covered business risk.",
                    "date": "2026-05-14T07:00:00Z",
                },
            ],
            "project_documents": [
                {
                    "id": 2,
                    "title": "Operating process",
                    "source_last_modified_at": "2026-05-13T00:00:00Z",
                }
            ],
            "projects": [
                {
                    "id": 43,
                    "name": "Westfield Collective",
                    "updated_at": "2026-05-12T00:00:00Z",
                }
            ],
            "acumatica_project_budgets": [
                {
                    "id": 3,
                    "description": "Budget exposure",
                    "updated_at": "2026-05-11T00:00:00Z",
                }
            ],
            "schedule_tasks": [
                {
                    "id": "schedule-1",
                    "name": "Critical milestone",
                    "finish_date": "2026-05-20T00:00:00Z",
                }
            ],
        }
    )

    response = build_executive_briefing_contract_spike(
        _executive_request(),
        _Store(client=client),
    )

    assert response.intent == "business_briefing"
    assert response.organization.name == "Alleato"
    assert response.confidence == "medium"
    assert [source.source_type for source in response.sources_checked] == list(REQUIRED_EXECUTIVE_SOURCE_TYPES)
    assert all(source.status == "checked" for source in response.sources_checked)
    assert response.evidence[0].source_type == "executive_briefing"
    assert response.evidence[1].source_type == "tasks"
    assert response.evidence[2].source_type == "executive_follow_ups"
    assert response.tool_trace[0].tool == "executive_briefing_reader"
    assert response.tool_trace[1].tool == "tasks_reader"
    assert "`tasks`" in response.tool_trace[1].detail
    assert response.tool_trace[2].tool == "executive_follow_ups_reader"
    assert "`executive_briefing_follow_ups`" in response.tool_trace[2].detail
    assert response.recommended_actions[0].label == "Use executive Deep Agents packet for business-wide chat answers"


def test_executive_task_source_uses_pm_task_register_not_briefing_followups():
    client = _FakeSupabase(
        {
            "daily_recaps": [],
            "tasks": [
                {
                    "id": "pm-task-1",
                    "title": "Complete Best Buy survey",
                    "description": "Real PM task row assigned to Brandon.",
                    "assignee_name": "Brandon Clymer",
                    "updated_at": "2026-05-21T12:00:00Z",
                }
            ],
            "executive_briefing_follow_ups": [
                {
                    "id": "follow-up-1",
                    "title": "Synthesized briefing follow-up",
                    "summary": "This is not the PM task register.",
                    "updated_at": "2026-05-21T11:00:00Z",
                }
            ],
        }
    )

    response = build_executive_briefing_contract_spike(
        _executive_request(),
        _Store(client=client),
    )

    task_source = next(source for source in response.sources_checked if source.source_type == "tasks")
    follow_up_source = next(
        source for source in response.sources_checked if source.source_type == "executive_follow_ups"
    )
    assert task_source.record_count == 1
    assert "`tasks`" in task_source.notes
    assert follow_up_source.record_count == 1
    assert "`executive_briefing_follow_ups`" in follow_up_source.notes
    assert any(item.source_type == "tasks" and item.title == "Complete Best Buy survey" for item in response.evidence)
    assert any(item.source_type == "executive_follow_ups" for item in response.evidence)


def test_executive_task_source_filters_named_brandon_task_requests():
    client = _FakeSupabase(
        {
            "daily_recaps": [],
            "tasks": [
                {
                    "id": "pm-task-brandon",
                    "title": "Complete Best Buy survey",
                    "description": "Real PM task row assigned to Brandon.",
                    "assignee_name": "Brandon Clymer",
                    "updated_at": "2026-05-21T12:00:00Z",
                },
                {
                    "id": "pm-task-other",
                    "title": "Audit Casella invoices",
                    "description": "Another recent PM task row.",
                    "assignee_name": "Someone Else",
                    "updated_at": "2026-05-21T13:00:00Z",
                },
            ],
        }
    )

    response = build_executive_briefing_contract_spike(
        DeepExecutiveIntelligenceRequest(
            userId="user-1",
            sessionId="session-1",
            question="what are brandons tasks/action items",
        ),
        _Store(client=client),
    )

    task_source = next(source for source in response.sources_checked if source.source_type == "tasks")
    task_titles = [item.title for item in response.evidence if item.source_type == "tasks"]
    assert task_source.record_count == 1
    assert task_titles == ["Complete Best Buy survey"]


def test_executive_deep_agents_runtime_can_synthesize_business_packet():
    class _Agent:
        def invoke(self, payload):
            assert "messages" in payload
            return {"messages": [{"role": "assistant", "content": "Executive synthesis from Deep Agents."}]}

    def create_agent(**kwargs):
        assert kwargs["model"] == "openai:gpt-5.5"
        assert kwargs["tools"]
        assert "system_prompt" in kwargs
        return _Agent()

    response = build_executive_briefing_contract_spike(
        _executive_request(),
        _Store(client=_FakeSupabase({"daily_recaps": []})),
        runtime="deep_agents",
        create_agent=create_agent,
    )

    assert response.mode == "deep_agents"
    assert response.answer == "Executive synthesis from Deep Agents."
    assert response.tool_trace[-1].tool == "deepagents_runtime"
    assert response.tool_trace[-1].status == "success"
    assert response.approved_skill_context is None


def test_executive_deep_agent_prompt_includes_approved_skill_context():
    prompt = _deep_agent_executive_prompt(
        DeepExecutiveIntelligenceRequest(
            userId="user-1",
            sessionId="session-1",
            question="What business risks need attention?",
            approvedSkillContext=(
                "## Approved Skill Library Context\n\n"
                "### Executive task triage (v1, task, low risk)"
            ),
        ),
        DeepOrganization(name="Alleato"),
        [],
        [],
    )

    assert "Approved executive Skill Library context" in prompt
    assert "Executive task triage" in prompt


def test_executive_prompt_adds_waiting_on_management_structure():
    prompt = _deep_agent_executive_prompt(
        DeepExecutiveIntelligenceRequest(
            userId="user-1",
            sessionId="session-1",
            question="What am I waiting on from my team?",
        ),
        DeepOrganization(name="Alleato"),
        [
            SourceCoverage(
                sourceType="tasks",
                status="checked",
                recordCount=4,
                latestSourceAt="2026-06-09T12:00:00Z",
                notes="Task register rows exist.",
            )
        ],
        [
            EvidenceItem(
                sourceType="tasks",
                sourceId="task-1",
                title="Send owner decision list",
                excerpt="Outstanding follow-through assigned to Brandon Griffith.",
                occurredAt="2026-06-09T11:00:00Z",
                confidence="high",
            )
        ],
    )

    assert "Biggest blockers" in prompt
    assert "Watch list" in prompt
    assert "Management move" in prompt
    assert "Do not open with a raw task dump" in prompt


def test_executive_prompt_adds_priority_ranking_for_most_important_tasks():
    prompt = _deep_agent_executive_prompt(
        DeepExecutiveIntelligenceRequest(
            userId="user-1",
            sessionId="session-1",
            question="What are my most important tasks right now?",
        ),
        DeepOrganization(name="Alleato"),
        [],
        [],
    )

    assert "rank tasks by urgency, business impact, and due-date risk" in prompt
    assert "Lead with a one-sentence executive point of view" in prompt
    assert "verified task-register row or a non-canonical follow-up signal" in prompt


def test_deep_agents_runtime_attaches_memory_middleware(monkeypatch):
    captured: dict[str, object] = {}
    monkeypatch.setenv("DEEP_AGENTS_MEMORY_ENABLED", "true")

    class _Agent:
        def invoke(self, payload, config=None):
            captured["payload"] = payload
            captured["config"] = config
            tools = {tool.name: tool for tool in captured["kwargs"]["tools"] if hasattr(tool, "name")}
            tools["propose_memory_candidate"].invoke(
                {"scope": "project", "fact": "Owner wants Division 9 cost code detail."}
            )
            return {"messages": [{"role": "assistant", "content": "Runtime synthesis with memory."}]}

    def create_agent(**kwargs):
        captured["kwargs"] = kwargs
        return _Agent()

    response = build_project_status_contract_spike(
        _request(),
        _Store({"id": 43, "name": "Westfield Collective"}, client=_FakeSupabase({"intelligence_targets": []})),
        runtime="deep_agents",
        create_agent=create_agent,
    )

    kwargs = captured["kwargs"]
    assert response.mode == "deep_agents"
    assert kwargs["middleware"]
    assert kwargs["middleware"][0].__class__.__name__ == "DbMemoryMiddleware"
    tool_names = [getattr(tool, "name", getattr(tool, "__name__", "")) for tool in kwargs["tools"]]
    assert "recall_user_memory" in tool_names
    assert "recall_project_memory" in tool_names
    assert "propose_memory_candidate" in tool_names
    assert captured["config"]["configurable"]["thread_id"] == "session-1"
    assert captured["config"]["configurable"]["user_id"] == "user-1"
    assert captured["config"]["configurable"]["project_id"] == 43
    assert "durable memory" in response.tool_trace[-1].detail
    assert response.memory_candidates[0].fact == "Owner wants Division 9 cost code detail."
    assert response.memory_candidates[0].requires_approval is True


def test_contract_spike_fails_loudly_when_project_is_missing():
    response = build_project_status_contract_spike(_request(), _Store())

    assert response.confidence == "low"
    assert response.sources_checked[0].source_type == "project"
    assert response.sources_checked[0].status == "failed"
    assert "could not resolve project 43" in response.answer
    assert response.tool_trace[0].tool == "project_lookup"
    assert response.tool_trace[0].status == "failed"


def test_contract_spike_fails_loudly_when_project_lookup_raises():
    class _FailingStore:
        def get_project(self, _project_id):
            raise RuntimeError("Supabase schema cache unavailable")

    response = build_project_status_contract_spike(_request(), _FailingStore())

    assert response.confidence == "low"
    assert response.sources_checked[0].source_type == "project"
    assert response.sources_checked[0].status == "failed"
    assert "project lookup failed" in response.answer
    assert "Supabase schema cache unavailable" in response.tool_trace[0].detail


def test_deep_agent_endpoint_is_feature_gated(client, mock_supabase_store, monkeypatch):
    monkeypatch.delenv("DEEP_AGENTS_PROJECT_INTELLIGENCE_ENABLED", raising=False)
    mock_supabase_store._client = None
    _override_deep_agent_auth(client.app)

    try:
        response = client.post(
            "/api/intelligence/deep-agent/project-status",
            json={
                "userId": "user-1",
                "projectId": 43,
                "sessionId": "session-1",
                "question": "What is the current risk/status on this project?",
            },
        )
    finally:
        _clear_overrides(client.app)

    assert response.status_code == 503
    assert "DEEP_AGENTS_PROJECT_INTELLIGENCE_ENABLED=true" in response.json()["detail"]
    mock_supabase_store.get_project.assert_not_called()


def test_deep_agent_executive_endpoint_is_feature_gated(client, mock_supabase_store, monkeypatch):
    monkeypatch.delenv("DEEP_AGENTS_PROJECT_INTELLIGENCE_ENABLED", raising=False)
    mock_supabase_store._client = None
    path = "/api/intelligence/deep-agent/executive-briefing"
    _override_deep_agent_auth(client.app, path)

    try:
        response = client.post(
            path,
            json={
                "userId": "user-1",
                "sessionId": "session-1",
                "question": "What business risks need attention?",
            },
        )
    finally:
        _clear_overrides(client.app, path)

    assert response.status_code == 503
    assert "DEEP_AGENTS_PROJECT_INTELLIGENCE_ENABLED=true" in response.json()["detail"]


def test_deep_agent_endpoint_returns_contract_packet(client, mock_supabase_store, monkeypatch):
    monkeypatch.setenv("DEEP_AGENTS_PROJECT_INTELLIGENCE_ENABLED", "true")
    mock_supabase_store.get_project.return_value = {"id": 43, "name": "Westfield Collective"}
    mock_supabase_store._client = None
    _override_deep_agent_auth(client.app)

    try:
        response = client.post(
            "/api/intelligence/deep-agent/project-status",
            json={
                "userId": "user-1",
                "projectId": 43,
                "sessionId": "session-1",
                "question": "What is the current risk/status on this project?",
                "approvedSkillContext": (
                    "## Approved Skill Library Context\n\n"
                    "### Chase project schedule risks"
                ),
            },
        )
    finally:
        _clear_overrides(client.app)

    assert response.status_code == 200
    data = response.json()
    assert data["mode"] == "contract_spike"
    assert data["project"] == {"id": 43, "name": "Westfield Collective"}
    assert data["confidence"] == "low"
    assert data["sourcesChecked"][0]["sourceType"] == "packet"
    assert data["sourcesChecked"][0]["status"] == "missing"
    assert data["toolTrace"][0]["tool"] == "project_lookup"
    assert data["recommendedActions"][0]["ownerRole"] == "AI/backend"
    assert "Chase project schedule risks" in data["approvedSkillContext"]


def test_deep_agent_executive_endpoint_returns_contract_packet(client, mock_supabase_store, monkeypatch):
    monkeypatch.setenv("DEEP_AGENTS_PROJECT_INTELLIGENCE_ENABLED", "true")
    mock_supabase_store._client = None
    mock_supabase_store.client = None
    path = "/api/intelligence/deep-agent/executive-briefing"
    _override_deep_agent_auth(client.app, path)

    try:
        response = client.post(
            path,
            json={
                "userId": "user-1",
                "sessionId": "session-1",
                "question": "What business risks need attention?",
                "approvedSkillContext": (
                    "## Approved Skill Library Context\n\n"
                    "### Executive task triage"
                ),
            },
        )
    finally:
        _clear_overrides(client.app, path)

    assert response.status_code == 200
    data = response.json()
    assert data["mode"] == "contract_spike"
    assert data["intent"] == "business_briefing"
    assert data["organization"] == {"name": "Alleato"}
    assert data["confidence"] == "low"
    assert data["sourcesChecked"][0]["sourceType"] == "executive_briefing"
    assert data["sourcesChecked"][0]["status"] == "missing"
    assert data["toolTrace"][0]["tool"] == "source_client"
    assert data["recommendedActions"][0]["ownerRole"] == "Operations"
    assert "Executive task triage" in data["approvedSkillContext"]


def test_deep_agent_tool_inventory_endpoint_reports_active_tools(client, monkeypatch):
    monkeypatch.setenv("DEEP_AGENTS_PROJECT_INTELLIGENCE_ENABLED", "true")
    monkeypatch.setenv("DEEP_AGENTS_PROJECT_INTELLIGENCE_RUNTIME", "deep_agents")
    monkeypatch.setenv("DEEP_AGENTS_STANDALONE_TOOLS_ENABLED", "true")
    monkeypatch.setenv("DEEP_AGENTS_SQL_TOOLS_ENABLED", "true")
    monkeypatch.setenv("DEEP_AGENTS_ACUMATICA_TOOLS_ENABLED", "true")
    monkeypatch.setenv("DEEP_AGENTS_DRAFT_TOOLS_ENABLED", "true")
    monkeypatch.setenv("DEEP_AGENTS_SUBAGENTS_ENABLED", "true")
    path = "/api/intelligence/deep-agent/tool-inventory"
    _override_deep_agent_auth(client.app, path)

    try:
        response = client.get(path)
    finally:
        _clear_overrides(client.app, path)

    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "active"
    assert data["toolCount"] == 33
    assert "resolve_project_by_name" in data["tools"]
    assert "acumatica_vendor_spend" in data["tools"]
    assert data["subagents"] == [
        "financial-analyst",
        "schedule-analyst",
        "risk-analyst",
        "communications-analyst",
        "business-development-analyst",
    ]
    subagent_details = {
        subagent["name"]: subagent for subagent in data["subagentDetails"]
    }
    assert subagent_details["financial-analyst"]["responseFormat"] == "FinancialAnalystPacket"
    assert subagent_details["risk-analyst"]["responseFormat"] == "RiskAnalystPacket"
    assert (
        subagent_details["communications-analyst"]["responseFormat"]
        == "CommunicationsAnalystPacket"
    )


def test_deep_agent_endpoint_returns_404_for_missing_project(client, mock_supabase_store, monkeypatch):
    monkeypatch.setenv("DEEP_AGENTS_PROJECT_INTELLIGENCE_ENABLED", "true")
    mock_supabase_store.get_project.return_value = None
    mock_supabase_store._client = None
    _override_deep_agent_auth(client.app)

    try:
        response = client.post(
            "/api/intelligence/deep-agent/project-status",
            json={
                "userId": "user-1",
                "projectId": 43,
                "question": "What is the current risk/status on this project?",
            },
        )
    finally:
        _clear_overrides(client.app)

    assert response.status_code == 404
    assert "could not resolve project 43" in response.json()["detail"]


def test_deep_agent_endpoint_returns_typed_packet_for_lookup_dependency_failure(
    client,
    mock_supabase_store,
    monkeypatch,
):
    monkeypatch.setenv("DEEP_AGENTS_PROJECT_INTELLIGENCE_ENABLED", "true")
    mock_supabase_store.get_project.side_effect = RuntimeError("Supabase schema cache unavailable")
    mock_supabase_store._client = None
    _override_deep_agent_auth(client.app)

    try:
        response = client.post(
            "/api/intelligence/deep-agent/project-status",
            json={
                "userId": "user-1",
                "projectId": 43,
                "question": "What is the current risk/status on this project?",
            },
        )
    finally:
        _clear_overrides(client.app)

    assert response.status_code == 200
    data = response.json()
    assert data["confidence"] == "low"
    assert data["sourcesChecked"][0]["sourceType"] == "project"
    assert data["sourcesChecked"][0]["status"] == "failed"
    assert "project lookup failed" in data["answer"]
    assert data["toolTrace"][0]["tool"] == "project_lookup"
    assert "Supabase schema cache unavailable" in data["toolTrace"][0]["detail"]
