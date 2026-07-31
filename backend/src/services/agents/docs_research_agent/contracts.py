"""Contracts for the LangChain docs Deep Agents endpoint."""

from __future__ import annotations

from typing import List, Literal, Optional

from pydantic import BaseModel, Field, field_validator


DocsResearchMode = Literal["deep_agents", "unavailable"]
DocsResearchToolStatus = Literal["success", "failed", "skipped"]


class DocsResearchRequest(BaseModel):
    user_id: str = Field(..., min_length=1, alias="userId")
    session_id: Optional[str] = Field(default=None, alias="sessionId")
    question: str = Field(..., min_length=1)
    max_docs: int = Field(default=5, ge=1, le=8, alias="maxDocs")

    model_config = {"populate_by_name": True}

    @field_validator("question")
    @classmethod
    def question_must_not_be_blank(cls, value: str) -> str:
        stripped = value.strip()
        if not stripped:
            raise ValueError("question must not be blank")
        return stripped


class DocsResearchSource(BaseModel):
    title: str
    url: Optional[str] = None


class DocsResearchTraceItem(BaseModel):
    agent: str
    tool: str
    status: DocsResearchToolStatus
    duration_ms: int = Field(..., ge=0, alias="durationMs")
    detail: Optional[str] = None

    model_config = {"populate_by_name": True}


class DocsResearchResponse(BaseModel):
    answer: str
    mode: DocsResearchMode
    sources: List[DocsResearchSource] = Field(default_factory=list)
    tool_trace: List[DocsResearchTraceItem] = Field(..., alias="toolTrace")
    orchestrator: str
    docs_server: str = Field(..., alias="docsServer")

    model_config = {"populate_by_name": True}
