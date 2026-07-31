"""Contracts for request-scoped Deep Agents memory tools."""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field


MemoryScope = Literal["user", "project", "organization"]


class MemoryCandidate(BaseModel):
    scope: MemoryScope
    fact: str
    requires_approval: bool = Field(..., alias="requiresApproval")

    model_config = {"populate_by_name": True}
