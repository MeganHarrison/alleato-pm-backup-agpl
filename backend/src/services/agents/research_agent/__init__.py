"""Alleato Deep Agents research agent module."""

from src.services.agents.research_agent.agent import run_research_agent
from src.services.agents.research_agent.contracts import ResearchRequest, ResearchResponse

__all__ = ["ResearchRequest", "ResearchResponse", "run_research_agent"]
