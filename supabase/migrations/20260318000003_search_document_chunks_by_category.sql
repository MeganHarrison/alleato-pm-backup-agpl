-- =============================================================================
-- search_document_chunks_by_category
-- Joins document_chunks (embeddings) → document_metadata (category/source/title)
-- Used by the AI assistant to search emails, Teams messages, and docs separately.
-- =============================================================================

DROP FUNCTION IF EXISTS search_document_chunks_by_category(vector, text, integer, double precision);
DROP FUNCTION IF EXISTS search_document_chunks_by_category(vector(1536), text, integer, double precision);
DROP FUNCTION IF EXISTS search_document_chunks_by_category(vector, text, integer, float);
DROP FUNCTION IF EXISTS search_document_chunks_by_category(vector(1536), text, integer, float);
CREATE OR REPLACE FUNCTION search_document_chunks_by_category(
    query_embedding  vector(1536),
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
    -- document_metadata fields
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
-- Index for fast category lookups on document_metadata
CREATE INDEX IF NOT EXISTS idx_document_metadata_category
    ON document_metadata (category);
CREATE INDEX IF NOT EXISTS idx_document_metadata_category_date
    ON document_metadata (category, date DESC NULLS LAST);
-- HNSW index on document_chunks.embedding (if not already present)
CREATE INDEX IF NOT EXISTS idx_document_chunks_embedding
    ON document_chunks
    USING hnsw (embedding vector_cosine_ops)
    WITH (m = 32, ef_construction = 200);
GRANT EXECUTE ON FUNCTION search_document_chunks_by_category TO anon, authenticated, service_role;
