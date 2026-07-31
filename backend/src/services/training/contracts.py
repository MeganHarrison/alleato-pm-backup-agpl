"""Typed contracts for the training resource finder job."""

from __future__ import annotations

from datetime import date
from typing import Any, Literal, Optional

from pydantic import BaseModel, Field, field_validator


TrainingFinderStatus = Literal["completed", "partial", "failed"]
TrainingFinderDecision = Literal[
    "inserted",
    "would_insert",
    "duplicate",
    "rejected",
    "failed",
]


class TrainingFinderRequest(BaseModel):
    role_slug: str = Field(..., min_length=1, alias="roleSlug")
    topic_slug: str = Field(..., min_length=1, alias="topicSlug")
    max_search_results: int = Field(
        default=8,
        ge=1,
        le=8,
        alias="maxSearchResults",
    )
    max_inserts: int = Field(default=3, ge=1, le=8, alias="maxInserts")
    dry_run: bool = Field(default=True, alias="dryRun")
    trigger_source: Literal["admin", "weekly", "manual", "test"] = Field(
        default="manual",
        alias="triggerSource",
    )

    model_config = {"populate_by_name": True}

    @field_validator("role_slug", "topic_slug")
    @classmethod
    def normalize_slug(cls, value: str) -> str:
        slug = value.strip().lower()
        if not slug or any(
            not (character.isalnum() or character == "-") for character in slug
        ):
            raise ValueError("must be a lowercase kebab-case slug")
        return slug


class TrainingFinderCandidateOutcome(BaseModel):
    title: str
    url: Optional[str] = None
    decision: TrainingFinderDecision
    reason_code: str = Field(..., alias="reasonCode")
    detail: str
    resource_id: Optional[str] = Field(default=None, alias="resourceId")
    candidate_id: Optional[str] = Field(default=None, alias="candidateId")
    strategy: Optional[str] = None
    score: Optional[float] = Field(default=None, ge=0, le=1)
    explanation: list[str] = Field(default_factory=list)

    model_config = {"populate_by_name": True}


class TrainingFinderResponse(BaseModel):
    status: TrainingFinderStatus
    query: str
    queries: list[dict[str, Any]] = Field(default_factory=list)
    run_id: Optional[str] = Field(default=None, alias="runId")
    policy_version: str = Field(
        default="feedback-ranking-v2",
        alias="policyVersion",
    )
    role_slug: str = Field(..., alias="roleSlug")
    topic_slug: str = Field(..., alias="topicSlug")
    dry_run: bool = Field(..., alias="dryRun")
    searched_count: int = Field(..., ge=0, alias="searchedCount")
    accepted_count: int = Field(..., ge=0, alias="acceptedCount")
    inserted_count: int = Field(..., ge=0, alias="insertedCount")
    duplicate_count: int = Field(..., ge=0, alias="duplicateCount")
    rejected_count: int = Field(..., ge=0, alias="rejectedCount")
    failed_count: int = Field(..., ge=0, alias="failedCount")
    outcomes: list[TrainingFinderCandidateOutcome]

    model_config = {"populate_by_name": True}


class WeeklyTrainingTarget(BaseModel):
    role_slug: str = Field(..., alias="roleSlug")
    topic_slug: str = Field(..., alias="topicSlug")
    label: str

    model_config = {"populate_by_name": True}


class WeeklyTrainingFinderResponse(BaseModel):
    status: TrainingFinderStatus
    schedule_policy: str = Field(..., alias="schedulePolicy")
    week_start: date = Field(..., alias="weekStart")
    rotation_index: int = Field(..., ge=0, alias="rotationIndex")
    target: WeeklyTrainingTarget
    finder: TrainingFinderResponse

    model_config = {"populate_by_name": True}


TrainingFreshnessOutcome = Literal[
    "healthy",
    "unavailable",
    "redirected",
    "title_changed",
    "free_unproven",
    "paid",
    "blocked",
]
TrainingFreshnessReviewStatus = Literal[
    "not_required",
    "observing",
    "pending",
    "accepted",
    "rejected",
]


class TrainingFreshnessEvidence(BaseModel):
    outcome: TrainingFreshnessOutcome
    fingerprint: str = Field(..., pattern=r"^[0-9a-f]{64}$")
    recommended_action: Literal["keep", "archive"] = Field(
        default="keep",
        alias="recommendedAction",
    )
    http_status: Optional[int] = Field(default=None, alias="httpStatus")
    final_url: Optional[str] = Field(default=None, alias="finalUrl")
    observed_title: Optional[str] = Field(default=None, alias="observedTitle")
    evidence: dict[str, Any] = Field(default_factory=dict)

    model_config = {"populate_by_name": True}


class TrainingFreshnessOutcomeRecord(BaseModel):
    resource_id: str = Field(..., alias="resourceId")
    title: str
    check_id: Optional[str] = Field(default=None, alias="checkId")
    outcome: Optional[TrainingFreshnessOutcome] = None
    review_status: Optional[TrainingFreshnessReviewStatus] = Field(
        default=None,
        alias="reviewStatus",
    )
    error: Optional[str] = None

    model_config = {"populate_by_name": True}


class TrainingFreshnessRunResponse(BaseModel):
    status: TrainingFinderStatus
    checked_count: int = Field(..., ge=0, alias="checkedCount")
    recorded_count: int = Field(..., ge=0, alias="recordedCount")
    pending_count: int = Field(..., ge=0, alias="pendingCount")
    failed_count: int = Field(..., ge=0, alias="failedCount")
    outcomes: list[TrainingFreshnessOutcomeRecord]

    model_config = {"populate_by_name": True}
