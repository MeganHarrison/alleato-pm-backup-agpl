"""
Shared constants for the ingestion pipeline.

Single source of truth for chunking targets, embedding config, and model
routing. Update here to change behavior across embedder + LLM helpers.
"""

from __future__ import annotations

import os


def _bare_openai_model_id(value: str) -> str:
    return value.removeprefix("openai:")


# Chunking — transcript segments (meeting transcripts, ~750 tokens per chunk)
CHUNK_TARGET_CHARS: int = 3_000
CHUNK_OVERLAP_CHARS: int = 500

# Embedding model — must match the vector column dimensions in document_chunks
EMBEDDING_MODEL: str = "text-embedding-3-large"
EMBEDDING_DIMENSIONS: int = 3_072  # native dimensions for text-embedding-3-large

# Pipeline model routing. PIPELINE_MODEL_* is the only supported environment
# contract; each default keeps an absent optional override deterministic.
MODEL_PROJECT_ASSIGNMENT: str = os.getenv("PIPELINE_MODEL_PROJECT_ASSIGNMENT", "gpt-5.4-nano")
MODEL_TEXT_CLEANUP: str = os.getenv("PIPELINE_MODEL_TEXT_CLEANUP", "gpt-5.4-nano")
MODEL_SIGNAL_EXTRACTION_TARGET: str = os.getenv(
    "PIPELINE_MODEL_SIGNAL_EXTRACTION_TARGET", "gpt-5.4-mini"
)
MODEL_SIGNAL_EXTRACTION: str = os.getenv("PIPELINE_MODEL_SIGNAL_EXTRACTION", "gpt-5.4-mini")
MODEL_PROJECT_INTELLIGENCE: str = os.getenv("PIPELINE_MODEL_PROJECT_INTELLIGENCE", "gpt-5.4")
MODEL_MICROSOFT_EXECUTIVE_ASSISTANT: str = _bare_openai_model_id(
    os.getenv("PIPELINE_MODEL_MICROSOFT_EXECUTIVE_ASSISTANT", "gpt-5.5")
)
MODEL_DAILY_BRIEF: str = os.getenv("PIPELINE_MODEL_DAILY_BRIEF", "gpt-5.5")
MODEL_ASSISTANT: str = os.getenv("PIPELINE_MODEL_ASSISTANT", "gpt-5.5")
