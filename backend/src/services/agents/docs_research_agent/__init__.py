"""Alleato Deep Agents docs research module."""

from src.services.agents.docs_research_agent.agent import run_docs_research_agent
from src.services.agents.docs_research_agent.contracts import (
    DocsResearchRequest,
    DocsResearchResponse,
)

__all__ = ["DocsResearchRequest", "DocsResearchResponse", "run_docs_research_agent"]
