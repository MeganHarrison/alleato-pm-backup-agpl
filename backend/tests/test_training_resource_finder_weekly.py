"""Focused weekly schedule and bounded-write tests for ALL-23."""

from __future__ import annotations

import json
from datetime import date, timedelta
from pathlib import Path
from typing import Any

import pytest
import yaml

from src.services.agents.research_agent.tools import PublicWebSearchResult
from src.scripts import run_training_resource_finder_weekly as weekly_runner
from src.services.training import finder as finder_module
from src.services.training import (
    TrainingFinderRequest,
    TrainingFinderResponse,
    TrainingResourceFinderError,
    WEEKLY_ROTATION_ANCHOR,
    WEEKLY_SCHEDULE_POLICY,
    WEEKLY_TARGETS,
    run_weekly_training_resource_finder,
    select_weekly_training_target,
)
from src.services.training.finder import _eligibility


def completed_response(request: TrainingFinderRequest) -> TrainingFinderResponse:
    return TrainingFinderResponse(
        status="completed",
        query="test query",
        roleSlug=request.role_slug,
        topicSlug=request.topic_slug,
        dryRun=request.dry_run,
        searchedCount=1,
        acceptedCount=1,
        insertedCount=0 if request.dry_run else 1,
        duplicateCount=0,
        rejectedCount=0,
        failedCount=0,
        outcomes=[],
    )


def test_rotation_visits_each_supported_role_before_repeating():
    selections = [
        select_weekly_training_target(
            WEEKLY_ROTATION_ANCHOR + timedelta(weeks=offset)
        )[2]
        for offset in range(len(WEEKLY_TARGETS) + 1)
    ]

    assert [target.role_slug for target in selections[:-1]] == [
        "project-engineer",
        "assistant-project-manager",
        "project-manager",
        "estimator",
        "assistant-superintendent",
        "superintendent",
    ]
    assert selections[-1] == selections[0]


def test_selection_uses_monday_for_every_date_in_the_same_utc_week():
    monday = date(2026, 7, 20)
    sunday = date(2026, 7, 26)

    assert select_weekly_training_target(monday) == (
        monday,
        4,
        WEEKLY_TARGETS[4],
    )
    assert select_weekly_training_target(sunday) == (
        monday,
        4,
        WEEKLY_TARGETS[4],
    )


@pytest.mark.parametrize(
    ("dry_run", "expected_inserted"),
    [(True, 0), (False, 1)],
)
def test_weekly_wrapper_is_read_only_by_default_and_always_caps_inserts(
    dry_run,
    expected_inserted,
):
    captured: list[TrainingFinderRequest] = []

    def finder(request: TrainingFinderRequest) -> TrainingFinderResponse:
        captured.append(request)
        return completed_response(request)

    response = run_weekly_training_resource_finder(
        run_date=date(2026, 7, 26),
        dry_run=dry_run,
        finder=finder,
    )

    assert response.status == "completed"
    assert response.schedule_policy == WEEKLY_SCHEDULE_POLICY
    assert response.rotation_index == 4
    assert response.target.role_slug == "assistant-superintendent"
    assert response.finder.inserted_count == expected_inserted
    assert captured[0].dry_run is dry_run
    assert captured[0].max_inserts == 1


def test_weekly_wrapper_preserves_named_finder_failures():
    def finder(_request: TrainingFinderRequest) -> TrainingFinderResponse:
        raise TrainingResourceFinderError(
            "TRAINING_RESOURCE_SEARCH_FAILED: provider unavailable"
        )

    with pytest.raises(
        TrainingResourceFinderError,
        match="TRAINING_RESOURCE_SEARCH_FAILED",
    ):
        run_weekly_training_resource_finder(
            run_date=date(2026, 7, 26),
            finder=finder,
        )


def test_weekly_cli_names_supabase_initialization_failure(
    monkeypatch,
    capsys,
):
    def missing_supabase_config():
        raise RuntimeError(
            "Environment variable 'SUPABASE_URL' is required for Supabase access"
        )

    monkeypatch.setattr(weekly_runner, "load_env", lambda: None)
    monkeypatch.setattr(
        finder_module,
        "get_supabase_client",
        missing_supabase_config,
    )

    exit_code = weekly_runner.main(["--for-date", "2026-07-26"])
    payload = json.loads(capsys.readouterr().out)

    assert exit_code == 1
    assert payload["status"] == "failed"
    assert payload["error"].startswith(
        "TRAINING_WEEKLY_RUN_FAILED: "
        "TRAINING_RESOURCE_CONFIGURATION_FAILED:"
    )
    assert "SUPABASE_URL" in payload["error"]


def test_shared_finder_rejects_deep_free_but_contextually_irrelevant_course():
    irrelevant = PublicWebSearchResult(
        title="Terraform Tutorial Full Course for Beginners",
        url="https://youtube.com/watch?v=terraform",
        snippet=(
            "A comprehensive full tutorial covering infrastructure as code, "
            "cloud providers, modules, state, commands, and practical examples."
        ),
        raw_content=" ".join(["terraform"] * 240),
        score=0.9,
    )
    relevant = PublicWebSearchResult(
        title="Daily Schedule and Look-Ahead Planning for Superintendents",
        url="https://youtube.com/watch?v=planning",
        snippet=(
            "A complete construction field tutorial for assistant "
            "superintendents covering daily schedules, look-ahead planning, "
            "trade coordination, material deliveries, and roadblock removal."
        ),
        raw_content="",
        score=0.9,
    )
    generic_construction_business = PublicWebSearchResult(
        title=(
            "How to Start & Grow a Successful Construction Business | "
            "Full Step-by-Step Course"
        ),
        url="https://youtube.com/watch?v=construction-business",
        snippet=(
            "A construction management course covering business planning, "
            "financials, marketing, hiring, leadership, and regulations."
        ),
        raw_content=" ".join(
            [
                "construction business planning financial marketing leadership"
            ]
            * 60
        ),
        score=0.9,
    )
    role: dict[str, Any] = {
        "name": "Assistant Superintendent",
        "slug": "assistant-superintendent",
    }
    topic: dict[str, Any] = {
        "name": "Look-Aheads & Pull Planning",
        "slug": "look-aheads-pull-planning",
    }

    assert _eligibility(
        irrelevant,
        irrelevant.url,
        role=role,
        topic=topic,
    ) == (
        False,
        "irrelevant_result",
        "The result does not demonstrate both construction-role and topic relevance.",
    )
    assert _eligibility(
        relevant,
        relevant.url,
        role=role,
        topic=topic,
    )[0] is True
    assert _eligibility(
        generic_construction_business,
        generic_construction_business.url,
        role=role,
        topic=topic,
    )[1] == "irrelevant_result"


def test_render_cron_is_weekly_bounded_and_has_required_secret_contract():
    render_config = yaml.safe_load(
        Path(__file__).resolve().parents[2].joinpath("render.yaml").read_text()
    )
    cron = next(
        service
        for service in render_config["services"]
        if service["name"] == "alleato-training-resource-finder-weekly"
    )

    assert cron["type"] == "cron"
    assert cron["runtime"] == "docker"
    assert cron["schedule"] == "15 13 * * 1"
    assert "--commit" in cron["dockerCommand"]
    assert "--max-inserts" not in cron["dockerCommand"]
    assert "timeout 20m" in cron["dockerCommand"]
    env_keys = {item["key"] for item in cron["envVars"]}
    assert {
        "PYTHONPATH",
        "PYTHONUNBUFFERED",
        "TAVILY_API_KEY",
        "SUPABASE_URL",
        "SUPABASE_SERVICE_ROLE_KEY",
    }.issubset(env_keys)
