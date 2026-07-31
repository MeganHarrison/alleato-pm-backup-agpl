"""Deterministic weekly target rotation for the training resource finder."""

from __future__ import annotations

from collections.abc import Callable
from datetime import date, datetime, timedelta, timezone

from src.services.training.contracts import (
    TrainingFinderRequest,
    TrainingFinderResponse,
    WeeklyTrainingFinderResponse,
    WeeklyTrainingTarget,
)
from src.services.training.finder import run_training_resource_finder

WEEKLY_SCHEDULE_POLICY = "weekly-role-rotation-v1"
WEEKLY_ROTATION_ANCHOR = date(2026, 1, 5)  # Monday, UTC calendar policy.
WEEKLY_TARGETS: tuple[WeeklyTrainingTarget, ...] = (
    WeeklyTrainingTarget(
        roleSlug="project-engineer",
        topicSlug="submittal-review-management",
        label="Project Engineer — Submittal Review & Management",
    ),
    WeeklyTrainingTarget(
        roleSlug="assistant-project-manager",
        topicSlug="procurement-the-procurement-log",
        label="Assistant Project Manager — Procurement & the Procurement Log",
    ),
    WeeklyTrainingTarget(
        roleSlug="project-manager",
        topicSlug="project-scheduling",
        label="Project Manager — Project Scheduling",
    ),
    WeeklyTrainingTarget(
        roleSlug="estimator",
        topicSlug="buyout-writing-scopes-of-work",
        label="Estimator — Buyout & Writing Scopes of Work",
    ),
    WeeklyTrainingTarget(
        roleSlug="assistant-superintendent",
        topicSlug="look-aheads-pull-planning",
        label="Assistant Superintendent — Look-Aheads & Pull Planning",
    ),
    WeeklyTrainingTarget(
        roleSlug="superintendent",
        topicSlug="safety-management",
        label="Superintendent — Safety Management",
    ),
)

Finder = Callable[[TrainingFinderRequest], TrainingFinderResponse]


def _utc_week_start(run_date: date) -> date:
    return run_date - timedelta(days=run_date.weekday())


def select_weekly_training_target(
    run_date: date,
) -> tuple[date, int, WeeklyTrainingTarget]:
    """Return the Monday, rotation index, and configured target for a UTC date."""

    week_start = _utc_week_start(run_date)
    elapsed_weeks = (week_start - WEEKLY_ROTATION_ANCHOR).days // 7
    rotation_index = elapsed_weeks % len(WEEKLY_TARGETS)
    return week_start, rotation_index, WEEKLY_TARGETS[rotation_index]


def run_weekly_training_resource_finder(
    *,
    run_date: date | None = None,
    dry_run: bool = True,
    max_search_results: int = 8,
    finder: Finder = run_training_resource_finder,
) -> WeeklyTrainingFinderResponse:
    """Run the established finder for the deterministic UTC weekly target."""

    effective_date = run_date or datetime.now(timezone.utc).date()
    week_start, rotation_index, target = select_weekly_training_target(effective_date)
    request = TrainingFinderRequest(
        roleSlug=target.role_slug,
        topicSlug=target.topic_slug,
        maxSearchResults=max_search_results,
        maxInserts=1,
        dryRun=dry_run,
        triggerSource="weekly",
    )
    finder_response = finder(request)
    return WeeklyTrainingFinderResponse(
        status=finder_response.status,
        schedulePolicy=WEEKLY_SCHEDULE_POLICY,
        weekStart=week_start,
        rotationIndex=rotation_index,
        target=target,
        finder=finder_response,
    )
