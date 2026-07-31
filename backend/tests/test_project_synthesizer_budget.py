"""Test cumulative projection budget enforcement in project synthesizer."""
from __future__ import annotations

import pytest
from unittest.mock import MagicMock, patch, call
from typing import Dict, Any

# Import the functions under test
import sys
from pathlib import Path

backend_dir = Path(__file__).parent.parent
sys.path.insert(0, str(backend_dir))
sys.path.insert(0, str(backend_dir / "src"))


def test_synthesis_sweep_cumulative_budget():
    """Verify projection budget is cumulative across all projects in sweep.

    Simulates 35 projects where each contributes enough cards to exceed budget
    on a per-project basis. With cumulative budgeting, the sweep should fail
    gracefully when total budget is exceeded, rather than per-project budgets
    allowing each project to succeed independently.
    """
    from services.project_intelligence.projections.project_communications import run_synthesis_sweep
    from services.ops.db_pressure_guard import AppDbProjectionError

    # Mock dependencies to track budget enforcement
    mock_cards_per_project = 5  # Each project writes 5 cards
    projects_before_budget_exceeded = 20  # Budget exceeded after 20 projects
    total_budget_limit = 100  # PM_APP_PROJECTION_MAX_INTELLIGENCE_PACKETS = 100

    call_count = 0
    budget_state_per_call = []

    def mock_synthesize(
        project_id,
        since,
        max_docs,
        max_extractions,
        skip_synthesized,
        projection_budget_counts,
        projection_budget_job_name,
    ):
        """Mock synthesize_project_intelligence that simulates card writes."""
        nonlocal call_count
        call_count += 1

        # Record budget state before this project's write
        budget_before = dict(projection_budget_counts)
        budget_state_per_call.append({
            "project_id": project_id,
            "call_num": call_count,
            "budget_before": budget_before,
            "cards_to_write": mock_cards_per_project,
        })

        # Simulate writing cards to the budget counter
        projection_budget_counts["intelligence_packets"] = (
            projection_budget_counts.get("intelligence_packets", 0)
            + mock_cards_per_project
        )

        # If we've exceeded the budget, raise the guard error
        if call_count > projects_before_budget_exceeded:
            # This simulates enforce_pm_app_final_projection_guard raising
            raise AppDbProjectionError(
                f"Projection limit exceeded: {projection_budget_counts['intelligence_packets']} > {total_budget_limit}"
            )

        return {
            "emails": 0,
            "teams": 0,
            "cards_written": mock_cards_per_project,
            "tasks_written": 0,
        }

    # Mock the flag reconciler and refresh functions
    with patch(
        "services.project_intelligence.projections.project_communications.synthesize_project_intelligence",
        side_effect=mock_synthesize,
    ), patch(
        "services.project_intelligence.projections.project_communications.reconcile_project_flags",
        return_value={"materialized": 0, "did_not_materialize": 0},
    ), patch(
        "services.project_intelligence.projections.project_communications.enforce_app_db_pressure_guard",
        return_value=None,
    ), patch(
        "services.project_intelligence.projections.project_communications.get_supabase_client",
        return_value=MagicMock(),
    ):
        # Run sweep with 35 projects
        result = run_synthesis_sweep(
            max_projects=35,
            max_extractions_per_project=25,
            since_days=14,
            refresh_intelligence=False,  # Skip L2 synthesis to isolate budget test
            project_ids=list(range(1, 36)),
        )

    # Verify results
    assert call_count == 35, "All 35 projects should be processed"

    # Projects 1-20 should succeed
    successes = [r for r in budget_state_per_call if r["call_num"] <= projects_before_budget_exceeded]
    assert len(successes) == projects_before_budget_exceeded, f"First {projects_before_budget_exceeded} projects should succeed"

    # Projects 21-35 should fail with AppDbProjectionError caught in the sweep's outer try-except
    failures = [r for r in budget_state_per_call if r["call_num"] > projects_before_budget_exceeded]
    assert len(failures) == 35 - projects_before_budget_exceeded, f"Remaining {35 - projects_before_budget_exceeded} projects should fail"

    # Verify result has errors for the projects that exceeded budget
    assert len(result["errors"]) == 35 - projects_before_budget_exceeded, "Errors should be recorded for budget-exceeded projects"

    # Verify the budget was indeed cumulative
    # After project 20, budget should be ~100 (20 projects * 5 cards each)
    budget_at_project_20 = budget_state_per_call[19]["budget_before"]["intelligence_packets"]
    assert budget_at_project_20 >= 95, f"Budget at project 20 should be ~100, was {budget_at_project_20}"

    # Verify cumulative nature: project 21's budget_before should include all prior projects
    budget_at_project_21 = budget_state_per_call[20]["budget_before"]["intelligence_packets"]
    assert budget_at_project_21 >= 95, f"Project 21 sees cumulative budget from all prior projects, was {budget_at_project_21}"


def test_synthesis_sweep_reserves_narratives_and_continues_after_extraction_cap():
    """Extraction pressure cannot starve later projects' page narratives."""
    from services.project_intelligence.projections.project_communications import run_synthesis_sweep
    from services.ops.db_pressure_guard import AppDbProjectionError

    seen_budgets = []

    def mock_synthesize(project_id, **kwargs):
        seen_budgets.append(dict(kwargs["projection_budget_counts"]))
        if project_id == 2:
            raise AppDbProjectionError("projection row count 101>100")
        return {"emails": 0, "teams": 0, "cards_written": 0, "tasks_written": 0}

    packet_ids = iter(["packet-1", "packet-2", "packet-3"])
    mock_client = MagicMock()
    packet_query = MagicMock()
    packet_query.select.return_value.eq.return_value.limit.return_value.execute.return_value.data = []
    mock_client.table.return_value = packet_query

    with patch(
        "services.project_intelligence.projections.project_communications.synthesize_project_intelligence",
        side_effect=mock_synthesize,
    ), patch(
        "services.project_intelligence.projections.project_communications.reconcile_project_flags",
        return_value={"materialized": 0, "did_not_materialize": 0},
    ), patch(
        "services.project_intelligence.projections.project_communications.enforce_app_db_pressure_guard",
        return_value=None,
    ), patch(
        "services.ops.db_pressure_guard.enforce_pm_app_final_projection_guard",
        return_value=None,
    ), patch(
        "services.project_intelligence.projections.project_communications.get_supabase_client",
        return_value=mock_client,
    ), patch(
        "services.project_intelligence.projections.current_state.refresh_project_intelligence",
        side_effect=lambda _pid: {"packet_id": next(packet_ids)},
    ):
        result = run_synthesis_sweep(project_ids=[1, 2, 3])

    assert seen_budgets[0] == {
        "intelligence_packets": 3,
        "project_current_state": 3,
    }
    assert result["synthesis_packets_written"] == 3
    assert len(result["per_project"]) == 3
    assert result["errors"] == [
        {
            "project_id": 2,
            "stage": "extraction_budget",
            "error": "projection row count 101>100",
        }
    ]


def test_synthesis_sweep_fails_before_writes_when_narratives_exceed_cap():
    """A sweep too large for its required narratives fails loudly up front."""
    from services.project_intelligence.projections.project_communications import run_synthesis_sweep
    from services.ops.db_pressure_guard import AppDbProjectionError

    with patch(
        "services.project_intelligence.projections.project_communications.enforce_app_db_pressure_guard",
        return_value=None,
    ), patch(
        "services.project_intelligence.projections.project_communications.get_supabase_client",
        return_value=MagicMock(),
    ), patch(
        "services.ops.db_pressure_guard.enforce_pm_app_final_projection_guard",
        side_effect=AppDbProjectionError("required narratives exceed cap"),
    ), patch(
        "services.project_intelligence.projections.project_communications.synthesize_project_intelligence",
    ) as mock_synthesize:
        with pytest.raises(AppDbProjectionError, match="required narratives exceed cap"):
            run_synthesis_sweep(project_ids=[1, 2])

    mock_synthesize.assert_not_called()


def test_projection_budget_error_is_not_downgraded_to_document_error():
    """A run-level projection cap must escape the per-document error handler."""
    from services.project_intelligence.projections.project_communications import synthesize_project_intelligence
    from services.ops.db_pressure_guard import AppDbProjectionError

    client = MagicMock()
    documents = MagicMock()
    documents.select.return_value.eq.return_value.or_.return_value.order.return_value.limit.return_value.execute.return_value.data = [
        {
            "id": "doc-1",
            "project_id": 1,
            "source_system": "teams",
            "source_item_id": "message-1",
            "source_metadata": {},
        }
    ]
    client.table.return_value = documents
    rag_read = MagicMock()
    rag_read.table.return_value.select.return_value.eq.return_value.eq.return_value.limit.return_value.execute.return_value.data = []

    structured = MagicMock()
    structured.extraction_failed = False
    structured.tasks = []

    with patch(
        "services.project_intelligence.projections.project_communications.get_supabase_client",
        return_value=client,
    ), patch(
        "services.project_intelligence.projections.project_communications.get_rag_read_client",
        return_value=rag_read,
    ), patch(
        "services.project_intelligence.projections.project_communications.get_rag_write_client",
        return_value=MagicMock(),
    ), patch(
        "services.project_intelligence.projections.project_communications.ensure_client_project_target",
        return_value={"id": "target-1"},
    ), patch(
        "services.project_intelligence.projections.project_communications._fetch_project_state",
        return_value="",
    ), patch(
        "services.project_intelligence.projections.project_communications.fetch_optional_row",
        return_value={"content": "A valid Teams message"},
    ), patch(
        "services.project_intelligence.projections.project_communications.llm.extract_deep_communication_intelligence",
        return_value=structured,
    ), patch(
        "services.project_intelligence.projections.project_communications._build_signal_payloads",
        return_value=[{"confidence_score": 0.9}],
    ), patch(
        "services.project_intelligence.projections.project_communications.reserve_pm_app_projection_budget",
        side_effect=AppDbProjectionError("projection cap reached"),
    ):
        with pytest.raises(AppDbProjectionError, match="projection cap reached"):
            synthesize_project_intelligence(1, skip_synthesized=False)


def test_health_check_staleness_alerts():
    """Verify health check sends Slack and Teams alerts on staleness."""
    from services.health.project_intelligence_staleness_check import (
        check_project_intelligence_staleness,
        _post_slack,
        _post_teams,
    )

    # Mock Supabase to return stale data
    mock_client = MagicMock()

    # Old project_current_state (stale)
    old_timestamp = "2026-07-07T00:00:00Z"  # 2 days old
    current_state_table = MagicMock()
    current_state_table.select.return_value.order.return_value.limit.return_value.execute.return_value.data = [
        {"updated_at": old_timestamp}
    ]
    packets_table = MagicMock()
    packets_table.select.return_value.eq.return_value.eq.return_value.order.return_value.limit.return_value.execute.return_value.data = [
        {"generated_at": old_timestamp}
    ]
    mock_client.table.side_effect = [current_state_table, packets_table]

    with patch(
        "services.supabase_helpers.get_supabase_client",
        return_value=mock_client,
    ):
        result = check_project_intelligence_staleness()

    # Result should be unhealthy
    assert not result["healthy"], "Should detect staleness"
    assert len(result["alerts"]) > 0, "Should have alerts"
    assert "stale" in result["alerts"][0]["message"].lower(), "Alert should mention staleness"

    # Test Slack posting (mocked)
    with patch("services.health.project_intelligence_staleness_check.httpx.post") as mock_post:
        _post_slack("https://hooks.slack.com/test", result)
        mock_post.assert_called_once()
        call_args = mock_post.call_args
        assert "text" in call_args.kwargs["json"], "Slack post should have text payload"
        assert "Staleness" in call_args.kwargs["json"]["text"], "Text should mention staleness"

    # Test Teams posting (mocked)
    with patch("services.health.project_intelligence_staleness_check.httpx.post") as mock_post, patch.dict(
        "os.environ",
        {
            "NOTIFICATION_SERVICE_KEY": "test-key",
            "NEXT_PUBLIC_APP_URL": "https://test.example.com",
        },
    ):
        success = _post_teams(result)
        assert success, "Teams post should succeed"
        mock_post.assert_called_once()
        call_args = mock_post.call_args
        assert "/api/bot/proactive/teams" in call_args[0][0], "Should post to Teams bridge"


@pytest.mark.parametrize("stage", ["synthesis", "operating_record"])
def test_synthesis_sweep_exit_code_fails_for_page_facing_projection_errors(stage):
    from services.project_intelligence.projections.project_communications import _sweep_exit_code

    summary = {
        "errors": [{"project_id": 31, "stage": stage, "error": "projection failed"}],
        "per_project": [{"project_id": 31}],
    }

    assert _sweep_exit_code(summary) == 1


def test_synthesis_sweep_exit_code_allows_noncritical_partial_error():
    from services.project_intelligence.projections.project_communications import _sweep_exit_code

    summary = {
        "errors": [{"project_id": 31, "stage": "document", "error": "one source failed"}],
        "per_project": [{"project_id": 31}],
    }

    assert _sweep_exit_code(summary) == 0
