"""Contracts for the Alleato App Expert Deep Agents endpoint."""

from __future__ import annotations

from typing import List, Literal, Optional

from pydantic import BaseModel, Field, field_validator


AppExpertMode = Literal["deep_agents", "unavailable"]
AppExpertToolStatus = Literal["success", "failed", "skipped"]
AppExpertSourceType = Literal[
    "help_article",
    "sitemap",
    "feature_registry",
    "source_map",
    "unknown",
]


class AppExpertRequest(BaseModel):
    user_id: str = Field(..., min_length=1, alias="userId")
    session_id: Optional[str] = Field(default=None, alias="sessionId")
    question: str = Field(..., min_length=1)
    current_route: Optional[str] = Field(default=None, alias="currentRoute")
    project_id: Optional[int] = Field(default=None, ge=1, alias="projectId")
    approved_skill_context: Optional[str] = Field(default=None, alias="approvedSkillContext")

    model_config = {"populate_by_name": True}

    @field_validator("question")
    @classmethod
    def question_must_not_be_blank(cls, value: str) -> str:
        stripped = value.strip()
        if not stripped:
            raise ValueError("question must not be blank")
        return stripped

    @field_validator("current_route")
    @classmethod
    def current_route_must_start_with_slash(cls, value: Optional[str]) -> Optional[str]:
        if value is None:
            return None
        stripped = value.strip()
        if not stripped:
            return None
        return stripped if stripped.startswith("/") else f"/{stripped}"


class AppExpertSource(BaseModel):
    title: str
    source_type: AppExpertSourceType = Field(..., alias="sourceType")
    route: Optional[str] = None
    file_path: Optional[str] = Field(default=None, alias="filePath")
    detail: Optional[str] = None

    model_config = {"populate_by_name": True}


class AppExpertTraceItem(BaseModel):
    agent: str
    tool: str
    status: AppExpertToolStatus
    duration_ms: int = Field(..., ge=0, alias="durationMs")
    detail: Optional[str] = None

    model_config = {"populate_by_name": True}


class AppExpertResponse(BaseModel):
    answer: str
    mode: AppExpertMode
    sources: List[AppExpertSource]
    tool_trace: List[AppExpertTraceItem] = Field(..., alias="toolTrace")
    skills_loaded: List[str] = Field(default_factory=list, alias="skillsLoaded")
    approved_skill_context: Optional[str] = Field(default=None, alias="approvedSkillContext")
    orchestrator: str

    model_config = {"populate_by_name": True}
