"""
Regression tests for pipeline config constants and LLM error handling.

Guards against the recurring dimension-mismatch bug: if EMBEDDING_MODEL
is changed without updating EMBEDDING_DIMENSIONS, pgvector rejects every
chunk insert silently. See PR #295.

Also guards the unguarded json.loads crash paths in generate_meeting_digest
and segment_transcript, which can crash on non-JSON AI Gateway responses.
"""
from __future__ import annotations

import json
import importlib
from unittest.mock import patch

from src.services.pipeline.config import (
    CHUNK_OVERLAP_CHARS,
    CHUNK_TARGET_CHARS,
    EMBEDDING_DIMENSIONS,
    EMBEDDING_MODEL,
)
from src.services.pipeline.llm import _MODEL_DIMENSIONS

# Canonical mapping of model name -> native output dimension.
# Update this table when adding support for a new embedding model.
_KNOWN_MODEL_DIMENSIONS: dict[str, int] = {
    "text-embedding-3-large": 3_072,
    "text-embedding-3-small": 1_536,
    "text-embedding-ada-002": 1_536,
}


# ---------------------------------------------------------------------------
# Config constants
# ---------------------------------------------------------------------------

def test_embedding_model_is_known():
    """EMBEDDING_MODEL must be in the canonical dimension table."""
    assert EMBEDDING_MODEL in _KNOWN_MODEL_DIMENSIONS, (
        f"Unknown model '{EMBEDDING_MODEL}'. Add it to _KNOWN_MODEL_DIMENSIONS "
        f"in this test file with the correct native dimension count."
    )


def test_embedding_dimensions_match_model():
    """EMBEDDING_DIMENSIONS must equal the native output of EMBEDDING_MODEL.

    This is the guard that would have caught the original bug: a stale
    EMBEDDING_DIMENSIONS value after changing EMBEDDING_MODEL.
    """
    expected = _KNOWN_MODEL_DIMENSIONS[EMBEDDING_MODEL]
    assert EMBEDDING_DIMENSIONS == expected, (
        f"EMBEDDING_DIMENSIONS={EMBEDDING_DIMENSIONS} does not match "
        f"native output of {EMBEDDING_MODEL} ({expected}). Update config.py."
    )


def test_llm_model_dimensions_table_covers_config_model():
    """_MODEL_DIMENSIONS in llm.py must include the model from config.py.

    Ensures batch_embed will not raise ValueError for the configured model.
    """
    assert EMBEDDING_MODEL in _MODEL_DIMENSIONS, (
        f"'{EMBEDDING_MODEL}' is missing from _MODEL_DIMENSIONS in llm.py. "
        f"Add it so batch_embed can determine the correct dimension count."
    )


def test_llm_model_dimensions_agree_with_canonical_table():
    """llm._MODEL_DIMENSIONS must agree with the canonical dimension table.

    Every model in _MODEL_DIMENSIONS must also be in _KNOWN_MODEL_DIMENSIONS.
    This prevents a model being added to production without cross-validating
    its dimension count in this test.
    """
    for model, dims in _MODEL_DIMENSIONS.items():
        assert model in _KNOWN_MODEL_DIMENSIONS, (
            f"'{model}' is in llm._MODEL_DIMENSIONS but missing from "
            f"_KNOWN_MODEL_DIMENSIONS in this test file. Add it with the correct dimension."
        )
        assert dims == _KNOWN_MODEL_DIMENSIONS[model], (
            f"llm._MODEL_DIMENSIONS['{model}']={dims} disagrees with "
            f"canonical value {_KNOWN_MODEL_DIMENSIONS[model]}."
        )


def test_chunk_constants_are_positive():
    assert CHUNK_TARGET_CHARS > 0
    assert CHUNK_OVERLAP_CHARS > 0
    assert CHUNK_OVERLAP_CHARS < CHUNK_TARGET_CHARS, (
        "CHUNK_OVERLAP_CHARS must be smaller than CHUNK_TARGET_CHARS"
    )


def test_model_routing_uses_only_canonical_pipeline_environment(monkeypatch):
    """Retired compiler/specialist variable names must never affect routing."""
    import src.services.pipeline.config as config

    monkeypatch.setenv("PIPELINE_MODEL_PROJECT_INTELLIGENCE", "gpt-canonical")
    monkeypatch.setenv("PIPELINE_MODEL_SIGNAL_EXTRACTION", "gpt-canonical-light")
    monkeypatch.setenv("PIPELINE_MODEL_MICROSOFT_EXECUTIVE_ASSISTANT", "openai:gpt-canonical-mail")
    monkeypatch.setenv("COMPILER_MODEL", "gpt-retired")
    monkeypatch.setenv("COMPILER_MODEL_LIGHT", "gpt-retired-light")
    monkeypatch.setenv("DEEP_AGENTS_MICROSOFT_EXECUTIVE_ASSISTANT_MODEL", "openai:gpt-retired-mail")

    reloaded = importlib.reload(config)
    assert reloaded.MODEL_PROJECT_INTELLIGENCE == "gpt-canonical"
    assert reloaded.MODEL_SIGNAL_EXTRACTION == "gpt-canonical-light"
    assert reloaded.MODEL_MICROSOFT_EXECUTIVE_ASSISTANT == "gpt-canonical-mail"

    monkeypatch.delenv("PIPELINE_MODEL_PROJECT_INTELLIGENCE", raising=False)
    monkeypatch.delenv("PIPELINE_MODEL_SIGNAL_EXTRACTION", raising=False)
    monkeypatch.delenv("PIPELINE_MODEL_MICROSOFT_EXECUTIVE_ASSISTANT", raising=False)
    importlib.reload(config)


# ---------------------------------------------------------------------------
# LLM error handling -- unguarded json.loads regression tests
# ---------------------------------------------------------------------------

def test_generate_meeting_digest_returns_empty_dict_on_non_json():
    """generate_meeting_digest must return {} instead of crashing on non-JSON LLM output.

    Regression test for the unguarded json.loads crash path. The AI Gateway provider
    skips response_format=json_object, making non-JSON responses a real failure path.
    """
    from src.services.pipeline import llm

    with patch.object(llm, "_call_llm", return_value="Sorry, I can't process that."):
        result = llm.generate_meeting_digest(
            title="Test Meeting",
            date="2026-04-30",
            participants=["Alice", "Bob"],
            summary="Brief meeting summary.",
            decisions=[],
            risks=[],
            tasks=[],
            opportunities=[],
        )
    assert result == {}, (
        "generate_meeting_digest must return an empty dict on non-JSON LLM output, "
        "not raise JSONDecodeError."
    )


def test_generate_meeting_digest_returns_parsed_json_on_success():
    """generate_meeting_digest parses and returns JSON when the LLM responds correctly."""
    from src.services.pipeline import llm

    expected = {"digest_text": "Test digest", "key_takeaways": ["Point A"]}
    with patch.object(llm, "_call_llm", return_value=json.dumps(expected)):
        result = llm.generate_meeting_digest(
            title="Test Meeting",
            date="2026-04-30",
            participants=["Alice"],
            summary="Summary.",
            decisions=[],
            risks=[],
            tasks=[],
            opportunities=[],
        )
    assert result == expected


def test_segment_transcript_returns_empty_list_on_non_json():
    """segment_transcript must return [] instead of crashing on non-JSON LLM output.

    Regression test: segment_transcript is Step 1 of the pipeline -- a crash here
    kills all downstream chunking for the document with no error surfaced.
    """
    from src.services.pipeline import llm

    with patch.object(llm, "_call_llm", return_value="Unable to parse transcript."):
        result = llm.segment_transcript(
            formatted_transcript="[0] Speaker: Hello",
            title="Test Meeting",
        )
    assert result == [], (
        "segment_transcript must return an empty list on non-JSON LLM output, "
        "not raise JSONDecodeError."
    )


def test_segment_transcript_returns_segments_on_success():
    """segment_transcript parses and returns segments when the LLM responds correctly."""
    from src.services.pipeline import llm

    segments = [{"title": "Intro", "start_index": 0, "end_index": 5}]
    with patch.object(llm, "_call_llm", return_value=json.dumps({"segments": segments})):
        result = llm.segment_transcript(
            formatted_transcript="[0] Speaker: Hello",
            title="Test Meeting",
        )
    assert result == segments


def test_segment_transcript_returns_empty_list_on_missing_segments_key():
    """segment_transcript returns [] if the JSON is valid but 'segments' key is absent."""
    from src.services.pipeline import llm

    with patch.object(llm, "_call_llm", return_value=json.dumps({"other_key": []})):
        result = llm.segment_transcript(
            formatted_transcript="[0] Speaker: Hello",
            title="Test Meeting",
        )
    assert result == []
