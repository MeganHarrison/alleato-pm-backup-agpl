"""Contracts for the Deep Agents LLM wiki endpoint."""

from __future__ import annotations

from typing import List, Literal, Optional

from pydantic import BaseModel, Field, field_validator, model_validator


WikiMode = Literal["init", "ingest", "query", "lint"]
WikiRuntimeMode = Literal["deep_agents", "scaffold", "unavailable"]
WikiArtifactKind = Literal["markdown", "source", "log", "other"]
WikiToolStatus = Literal["success", "failed", "skipped"]


class WikiSource(BaseModel):
    path: str = Field(..., min_length=1)
    content: str = Field(..., min_length=1)

    @field_validator("path")
    @classmethod
    def source_path_must_be_relative(cls, value: str) -> str:
        normalized = value.strip().replace("\\", "/")
        if not normalized or normalized.startswith("/") or ".." in normalized.split("/"):
            raise ValueError("source path must be a safe relative path")
        return normalized


class WikiRequest(BaseModel):
    user_id: str = Field(..., min_length=1, alias="userId")
    session_id: Optional[str] = Field(default=None, alias="sessionId")
    topic: str = Field(..., min_length=1)
    mode: WikiMode
    sources: List[WikiSource] = Field(default_factory=list)
    question: Optional[str] = None
    note: Optional[str] = None
    file_query_answer: bool = Field(default=True, alias="fileQueryAnswer")

    model_config = {"populate_by_name": True}

    @field_validator("topic")
    @classmethod
    def topic_must_not_be_blank(cls, value: str) -> str:
        stripped = value.strip()
        if not stripped:
            raise ValueError("topic must not be blank")
        return stripped

    @model_validator(mode="after")
    def validate_mode_inputs(self) -> "WikiRequest":
        if self.mode == "ingest" and not self.sources:
            raise ValueError("sources are required in ingest mode")
        if self.mode == "query" and not (self.question or "").strip():
            raise ValueError("question is required in query mode")
        return self


class WikiArtifact(BaseModel):
    path: str
    kind: WikiArtifactKind
    bytes: int = Field(..., ge=0)
    content: Optional[str] = None


class WikiTraceItem(BaseModel):
    agent: str
    tool: str
    status: WikiToolStatus
    duration_ms: int = Field(..., ge=0, alias="durationMs")
    detail: Optional[str] = None

    model_config = {"populate_by_name": True}


class WikiResponse(BaseModel):
    answer: str
    mode: WikiRuntimeMode
    wiki_path: str = Field(..., alias="wikiPath")
    artifacts: List[WikiArtifact]
    tool_trace: List[WikiTraceItem] = Field(..., alias="toolTrace")
    orchestrator: str

    model_config = {"populate_by_name": True}


class WikiArchiveProject(BaseModel):
    user_id: str = Field(..., alias="userId")
    topic: str
    topic_slug: str = Field(..., alias="topicSlug")
    session_id: str = Field(..., alias="sessionId")
    wiki_path: str = Field(..., alias="wikiPath")
    title: str
    updated_at: str = Field(..., alias="updatedAt")
    artifact_count: int = Field(..., ge=0, alias="artifactCount")
    markdown_count: int = Field(..., ge=0, alias="markdownCount")
    source_count: int = Field(..., ge=0, alias="sourceCount")
    log_summary: Optional[str] = Field(default=None, alias="logSummary")

    model_config = {"populate_by_name": True}


class WikiArchiveResponse(BaseModel):
    projects: List[WikiArchiveProject]
    selected_project: Optional[WikiArchiveProject] = Field(default=None, alias="selectedProject")
    artifacts: List[WikiArtifact] = Field(default_factory=list)

    model_config = {"populate_by_name": True}
