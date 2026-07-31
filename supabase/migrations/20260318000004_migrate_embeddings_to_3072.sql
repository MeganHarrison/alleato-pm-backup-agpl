-- =============================================================================
-- Migrate RAG embeddings to halfvec(3072) for text-embedding-3-large at full quality.
--
-- halfvec = half-precision float16, pgvector type designed for large dims.
-- - Supports HNSW up to 4000 dimensions (vector type limited to 2000)
-- - 50% less storage vs float32
-- - Negligible quality difference for cosine similarity search
--
-- After applying this migration, run the Python backfill script:
--   cd backend && python src/scripts/backfill_3072_embeddings.py
-- =============================================================================

-- ─── document_chunks ─────────────────────────────────────────────────────────
DROP INDEX IF EXISTS document_chunks_embedding_idx;
DROP INDEX IF EXISTS idx_document_chunks_embedding;
ALTER TABLE document_chunks
  ALTER COLUMN embedding TYPE halfvec(3072) USING NULL::halfvec(3072);
CREATE INDEX idx_document_chunks_embedding
  ON document_chunks
  USING hnsw (embedding halfvec_cosine_ops)
  WITH (m = 32, ef_construction = 200);
-- ─── meeting_segments ────────────────────────────────────────────────────────
DROP INDEX IF EXISTS meeting_segments_summary_embedding_idx;
ALTER TABLE meeting_segments
  ALTER COLUMN summary_embedding TYPE halfvec(3072) USING NULL::halfvec(3072);
CREATE INDEX meeting_segments_summary_embedding_idx
  ON meeting_segments
  USING hnsw (summary_embedding halfvec_cosine_ops)
  WITH (m = 32, ef_construction = 200);
-- ─── decisions ───────────────────────────────────────────────────────────────
DROP INDEX IF EXISTS decisions_embedding_idx;
ALTER TABLE decisions
  ALTER COLUMN embedding TYPE halfvec(3072) USING NULL::halfvec(3072);
CREATE INDEX decisions_embedding_idx
  ON decisions
  USING hnsw (embedding halfvec_cosine_ops)
  WITH (m = 32, ef_construction = 200);
-- ─── risks ───────────────────────────────────────────────────────────────────
DROP INDEX IF EXISTS risks_embedding_idx;
ALTER TABLE risks
  ALTER COLUMN embedding TYPE halfvec(3072) USING NULL::halfvec(3072);
CREATE INDEX risks_embedding_idx
  ON risks
  USING hnsw (embedding halfvec_cosine_ops)
  WITH (m = 32, ef_construction = 200);
-- ─── opportunities ───────────────────────────────────────────────────────────
DROP INDEX IF EXISTS opportunities_embedding_idx;
ALTER TABLE opportunities
  ALTER COLUMN embedding TYPE halfvec(3072) USING NULL::halfvec(3072);
CREATE INDEX opportunities_embedding_idx
  ON opportunities
  USING hnsw (embedding halfvec_cosine_ops)
  WITH (m = 32, ef_construction = 200);
-- ─── tasks ───────────────────────────────────────────────────────────────────
ALTER TABLE tasks
  ALTER COLUMN embedding TYPE halfvec(3072) USING NULL::halfvec(3072);
-- ─── ai_memories ─────────────────────────────────────────────────────────────
DROP INDEX IF EXISTS idx_ai_memories_embedding;
ALTER TABLE ai_memories
  ALTER COLUMN embedding TYPE halfvec(3072) USING NULL::halfvec(3072);
CREATE INDEX idx_ai_memories_embedding
  ON ai_memories
  USING hnsw (embedding halfvec_cosine_ops)
  WITH (m = 32, ef_construction = 200);
-- ─── search_document_chunks_by_category ──────────────────────────────────────
DROP FUNCTION IF EXISTS search_document_chunks_by_category(vector, text, integer, double precision);
DROP FUNCTION IF EXISTS search_document_chunks_by_category(vector(1536), text, integer, double precision);
DROP FUNCTION IF EXISTS search_document_chunks_by_category(vector(3072), text, integer, double precision);
DROP FUNCTION IF EXISTS search_document_chunks_by_category(halfvec, text, integer, double precision);
DROP FUNCTION IF EXISTS search_document_chunks_by_category(halfvec(3072), text, integer, double precision);
CREATE OR REPLACE FUNCTION search_document_chunks_by_category(
    query_embedding  halfvec(3072),
    filter_category  text,
    match_count      int     DEFAULT 10,
    match_threshold  float   DEFAULT 0.25
)
RETURNS TABLE (
    chunk_id        text,
    document_id     text,
    chunk_index     int,
    chunk_text      text,
    similarity      float,
    doc_title       text,
    doc_category    text,
    doc_source      text,
    doc_type        text,
    doc_date        timestamptz,
    doc_participants text,
    doc_tags        text,
    doc_project_id  bigint,
    doc_metadata    jsonb,
    doc_created_at  timestamptz
)
LANGUAGE plpgsql
AS $$
BEGIN
    SET LOCAL hnsw.ef_search = 100;

    RETURN QUERY
    SELECT
        dc.chunk_id,
        dc.document_id,
        dc.chunk_index,
        dc.text                                              AS chunk_text,
        (1 - (dc.embedding <=> query_embedding))::float     AS similarity,
        dm.title                                            AS doc_title,
        dm.category                                         AS doc_category,
        dm.source                                           AS doc_source,
        dm.type                                             AS doc_type,
        dm.date                                             AS doc_date,
        dm.participants                                     AS doc_participants,
        dm.tags                                             AS doc_tags,
        dm.project_id                                       AS doc_project_id,
        dc.metadata                                         AS doc_metadata,
        dm.created_at                                       AS doc_created_at
    FROM document_chunks dc
    JOIN document_metadata dm
        ON dc.document_id = dm.id
    WHERE
        dc.embedding IS NOT NULL
        AND dm.category = filter_category
        AND (1 - (dc.embedding <=> query_embedding)) > match_threshold
    ORDER BY dc.embedding <=> query_embedding
    LIMIT match_count;
END;
$$;
GRANT EXECUTE ON FUNCTION search_document_chunks_by_category TO anon, authenticated, service_role;
-- NULL out unconstrained documents.embedding (old 1536-dim vectors would break 3072-dim queries)
UPDATE documents SET embedding = NULL WHERE embedding IS NOT NULL;
