"""Contracts for the Alleato Deep Agents research endpoint."""

from __future__ import annotations

from typing import List, Literal, Optional

from pydantic import BaseModel, Field, field_validator


# "deep_agents_degraded": the runtime produced an answer but the app database
# was unreachable, so structured PM tools were down and the answer carries a
# loud degraded-mode banner. "degraded" trace status marks that same condition.
ResearchMode = Literal["deep_agents", "deep_agents_degraded", "unavailable"]
ResearchToolStatus = Literal["success", "failed", "skipped", "degraded"]
ResearchSourceType = Literal["web", "alleato", "internal", "unknown"]


class ResearchRequest(BaseModel):
    user_id: str = Field(..., min_length=1, alias="userId")
    session_id: Optional[str] = Field(default=None, alias="sessionId")
    question: str = Field(..., min_length=1)
    project_id: Optional[int] = Field(default=None, ge=1, alias="projectId")
    max_searches: int = Field(default=5, ge=1, le=12, alias="maxSearches")

    model_config = {"populate_by_name": True}

    @field_validator("question")
    @classmethod
    def question_must_not_be_blank(cls, value: str) -> str:
        stripped = value.strip()
        if not stripped:
            raise ValueError("question must not be blank")
        return stripped


class ResearchSource(BaseModel):
    title: str
    url: Optional[str] = None
    source_type: ResearchSourceType = Field(default="unknown", alias="sourceType")

    model_config = {"populate_by_name": True}


class ResearchTraceItem(BaseModel):
    agent: str
    tool: str
    status: ResearchToolStatus
    duration_ms: int = Field(..., ge=0, alias="durationMs")
    detail: Optional[str] = None

    model_config = {"populate_by_name": True}


class ResearchResponse(BaseModel):
    answer: str
    mode: ResearchMode
    sources: List[ResearchSource]
    tool_trace: List[ResearchTraceItem] = Field(..., alias="toolTrace")
    skills_loaded: List[str] = Field(default_factory=list, alias="skillsLoaded")
    orchestrator: str

    model_config = {"populate_by_name": True}
