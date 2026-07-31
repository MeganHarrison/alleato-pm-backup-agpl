"""Contracts for the Alleato Deep Agents content builder endpoint."""

from __future__ import annotations

from typing import List, Literal, Optional

from pydantic import BaseModel, Field, field_validator


ContentBuilderMode = Literal["deep_agents", "unavailable"]
ContentBuilderArtifactKind = Literal["markdown", "image", "research", "other"]
ContentBuilderToolStatus = Literal["success", "failed", "skipped"]


class ContentBuilderRequest(BaseModel):
    user_id: str = Field(..., min_length=1, alias="userId")
    session_id: Optional[str] = Field(default=None, alias="sessionId")
    prompt: str = Field(..., min_length=1)
    content_type: Optional[Literal["blog", "linkedin", "twitter", "social"]] = Field(
        default=None,
        alias="contentType",
    )
    include_images: bool = Field(default=True, alias="includeImages")
    max_searches: int = Field(default=5, ge=1, le=12, alias="maxSearches")

    model_config = {"populate_by_name": True}

    @field_validator("prompt")
    @classmethod
    def prompt_must_not_be_blank(cls, value: str) -> str:
        stripped = value.strip()
        if not stripped:
            raise ValueError("prompt must not be blank")
        return stripped


class ContentBuilderArtifact(BaseModel):
    path: str
    kind: ContentBuilderArtifactKind
    bytes: int = Field(..., ge=0)
    content: Optional[str] = None


class ContentBuilderTraceItem(BaseModel):
    agent: str
    tool: str
    status: ContentBuilderToolStatus
    duration_ms: int = Field(..., ge=0, alias="durationMs")
    detail: Optional[str] = None

    model_config = {"populate_by_name": True}


class ContentBuilderResponse(BaseModel):
    answer: str
    mode: ContentBuilderMode
    artifacts: List[ContentBuilderArtifact]
    tool_trace: List[ContentBuilderTraceItem] = Field(..., alias="toolTrace")
    skills_loaded: List[str] = Field(default_factory=list, alias="skillsLoaded")
    orchestrator: str

    model_config = {"populate_by_name": True}
