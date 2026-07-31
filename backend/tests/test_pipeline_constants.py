"""
Guards for embedding model/dimension constants in the ingestion pipeline.

These tests exist to prevent the recurring dimension-mismatch bug where the
embedding model string and the expected dimension count drift apart, causing
pgvector INSERT failures that are silently swallowed.

History:
  - 2026-04-30: company_knowledge.embedding was vector(1536) while the route
    generated text-embedding-3-large (3072-dim) vectors. Inserts silently saved
    null embeddings. This file was added as the permanent regression guard.
"""

import pytest

# ---------------------------------------------------------------------------
# Known model → native dimension mapping
# Add new models here when the pipeline adopts them.
# ---------------------------------------------------------------------------

KNOWN_MODEL_DIMENSIONS: dict[str, int] = {
    "text-embedding-3-small": 1536,
    "text-embedding-3-large": 3072,
    "text-embedding-ada-002": 1536,
}


class TestLlmPipelineConstants:
    """Guards against dimension-mismatch bugs in the LLM/embedding pipeline."""

    @pytest.mark.unit
    def test_embedding_model_is_known(self):
        """EMBEDDING_MODEL must be a known model so we can assert its dimensions."""
        from backend.src.services.pipeline.llm import EMBEDDING_MODEL

        assert EMBEDDING_MODEL in KNOWN_MODEL_DIMENSIONS, (
            f"Unknown EMBEDDING_MODEL='{EMBEDDING_MODEL}' in llm.py. "
            f"Add it to KNOWN_MODEL_DIMENSIONS in this test with its native dimension count: "
            f"{list(KNOWN_MODEL_DIMENSIONS.keys())}"
        )

    @pytest.mark.unit
    def test_embedding_dimensions_match_model(self):
        """EMBEDDING_DIMENSIONS must match the native output of EMBEDDING_MODEL.

        If someone changes the model string without updating the dimension constant,
        every chunk insert will fail with a pgvector dimension mismatch error — the
        exact bug that prompted this test. This assertion ensures the two constants
        agree with each other.
        """
        from backend.src.services.pipeline.llm import EMBEDDING_MODEL, EMBEDDING_DIMENSIONS

        expected = KNOWN_MODEL_DIMENSIONS.get(EMBEDDING_MODEL)
        if expected is None:
            pytest.skip(f"Unknown model '{EMBEDDING_MODEL}' — add to KNOWN_MODEL_DIMENSIONS")

        assert EMBEDDING_DIMENSIONS == expected, (
            f"EMBEDDING_DIMENSIONS={EMBEDDING_DIMENSIONS} does not match the native "
            f"output dimensions of {EMBEDDING_MODEL} ({expected}). "
            f"Update EMBEDDING_DIMENSIONS in llm.py to match the model."
        )

    @pytest.mark.unit
    def test_embedding_model_is_large_variant(self):
        """Pipeline should use text-embedding-3-large for RAG knowledge tables.

        All RAG tables (document_chunks, company_knowledge, etc.) use halfvec(3072).
        If this fails, the model was downgraded — verify the schema still matches.
        """
        from backend.src.services.pipeline.llm import EMBEDDING_MODEL

        assert EMBEDDING_MODEL == "text-embedding-3-large", (
            f"Expected text-embedding-3-large but got '{EMBEDDING_MODEL}'. "
            "If you intentionally changed the model, update the database schema "
            "and search_knowledge_base RPC to match the new dimension count."
        )


class TestEmbedderChunkConstants:
    """Guards for chunk sizing constants in the embedder pipeline."""

    @pytest.mark.unit
    def test_chunk_sizes_are_positive(self):
        """Chunk sizing constants must be positive integers."""
        from backend.src.services.pipeline.embedder import (
            CHUNK_TARGET_CHARS,
            CHUNK_OVERLAP_CHARS,
        )

        assert CHUNK_TARGET_CHARS > 0, "CHUNK_TARGET_CHARS must be > 0"
        assert CHUNK_OVERLAP_CHARS > 0, "CHUNK_OVERLAP_CHARS must be > 0"

    @pytest.mark.unit
    def test_chunk_overlap_smaller_than_target(self):
        """Overlap must not exceed target or infinite loops become possible."""
        from backend.src.services.pipeline.embedder import (
            CHUNK_TARGET_CHARS,
            CHUNK_OVERLAP_CHARS,
        )

        assert CHUNK_OVERLAP_CHARS < CHUNK_TARGET_CHARS, (
            f"CHUNK_OVERLAP_CHARS ({CHUNK_OVERLAP_CHARS}) must be less than "
            f"CHUNK_TARGET_CHARS ({CHUNK_TARGET_CHARS}) to avoid infinite chunking loops."
        )

    @pytest.mark.unit
    def test_chunk_constants_match_expected_values(self):
        """Guard against accidental value changes during refactors.

        These values were validated against RAG retrieval quality benchmarks.
        If you need to change them, update this test intentionally and document why.
        """
        from backend.src.services.pipeline.embedder import (
            CHUNK_TARGET_CHARS,
            CHUNK_OVERLAP_CHARS,
        )

        assert CHUNK_TARGET_CHARS == 3000, (
            f"CHUNK_TARGET_CHARS changed to {CHUNK_TARGET_CHARS}. "
            "Intentional? Update this test and document the reason."
        )
        assert CHUNK_OVERLAP_CHARS == 500, (
            f"CHUNK_OVERLAP_CHARS changed to {CHUNK_OVERLAP_CHARS}. "
            "Intentional? Update this test and document the reason."
        )
