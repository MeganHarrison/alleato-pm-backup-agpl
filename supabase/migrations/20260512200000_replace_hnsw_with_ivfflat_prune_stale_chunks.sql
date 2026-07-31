-- =============================================================================
-- Replace 827 MB full HNSW index with IVFFlat + update search function
-- Root cause: HNSW index updates on every sync run exhaust available RAM and
-- trigger OOM kills, causing the DB to restart every few minutes.
-- IVFFlat loads ~30 MB per query vs HNSW which loads hundreds of MB.
--
-- The DROP and CREATE INDEX were applied manually via psql with
-- SET statement_timeout = 0 because both exceed the migration timeout:
--   DROP INDEX IF EXISTS idx_document_chunks_embedding_hnsw;
--   SET maintenance_work_mem='256MB'; SET statement_timeout=0;
--   CREATE INDEX idx_document_chunks_embedding_ivfflat ON document_chunks
--     USING ivfflat (embedding halfvec_cosine_ops) WITH (lists = 200);
--
-- Stale chunk pruning also applied manually after index build completed:
--   DELETE FROM document_chunks WHERE embedding IS NULL
--     AND created_at < now() - interval '7 days';
-- =============================================================================

-- Update search_document_chunks to set ivfflat.probes = 10 for recall quality.
-- hnsw.ef_search is silently ignored by IVFFlat so keeping it is harmless.
CREATE OR REPLACE FUNCTION search_document_chunks(
    query_embedding  halfvec(3072),
    filter_source_types text[] DEFAULT NULL,
    filter_project_id bigint DEFAULT NULL,
    match_count      int     DEFAULT 10,
    match_threshold  float   DEFAULT 0.25
)
RETURNS TABLE (
    chunk_id        text,
    document_id     text,
    chunk_index     int,
    chunk_text      text,
    source_type     text,
    similarity      float,
    doc_title       text,
    doc_category    text,
    doc_source      text,
    doc_date        timestamptz,
    doc_project_id  bigint,
    doc_metadata    jsonb,
    doc_created_at  timestamp
)
LANGUAGE plpgsql AS $$
BEGIN
    SET LOCAL hnsw.ef_search = 100;
    SET LOCAL ivfflat.probes = 10;

    RETURN QUERY
    SELECT
        dc.chunk_id,
        dc.document_id,
        dc.chunk_index,
        dc.text                                              AS chunk_text,
        dc.source_type,
        (1 - (dc.embedding <=> query_embedding))::float     AS similarity,
        dm.title                                            AS doc_title,
        dm.category                                         AS doc_category,
        dm.source                                           AS doc_source,
        dm.date                                             AS doc_date,
        dm.project_id                                       AS doc_project_id,
        dc.metadata                                         AS doc_metadata,
        dm.created_at                                       AS doc_created_at
    FROM document_chunks dc
    JOIN document_metadata dm ON dc.document_id = dm.id
    WHERE
        dc.embedding IS NOT NULL
        AND (filter_source_types IS NULL OR dc.source_type = ANY(filter_source_types))
        AND (filter_project_id IS NULL OR dm.project_id = filter_project_id)
        AND (1 - (dc.embedding <=> query_embedding)) > match_threshold
    ORDER BY dc.embedding <=> query_embedding
    LIMIT match_count;
END;
$$;
GRANT EXECUTE ON FUNCTION search_document_chunks(halfvec(3072), text[], bigint, int, float)
    TO anon, authenticated, service_role;
