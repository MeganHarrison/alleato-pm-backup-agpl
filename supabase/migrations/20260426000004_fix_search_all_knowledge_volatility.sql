-- Fix search_all_knowledge runtime failures.
--
-- The current function uses SET LOCAL hnsw.ef_search inside a STABLE function,
-- which Postgres rejects at runtime with:
--   SET is not allowed in a non-volatile function
--
-- Keep the existing signature and result shape, but mark the function VOLATILE
-- so semantic retrieval can use the HNSW tuning statement safely.

CREATE OR REPLACE FUNCTION public.search_all_knowledge(
    query_embedding  halfvec(3072),
    match_count      int     DEFAULT 10,
    match_threshold  float   DEFAULT 0.3
)
RETURNS TABLE (
    id              uuid,
    source_table    text,
    metadata_id     text,
    description     text,
    type            text,
    owner_name      text,
    project_id      bigint,
    project_ids     int[],
    status          text,
    details         jsonb,
    similarity      float,
    created_at      timestamptz
)
LANGUAGE plpgsql VOLATILE AS $$
BEGIN
    SET LOCAL hnsw.ef_search = 100;

    RETURN QUERY
    SELECT
        i.id,
        'insights'::text AS source_table,
        i.metadata_id,
        i.description,
        i.type,
        i.owner_name,
        i.project_id,
        i.project_ids,
        i.status,
        i.details,
        1 - (i.embedding <=> query_embedding) AS similarity,
        i.created_at
    FROM public.insights i
    WHERE
        i.embedding IS NOT NULL
        AND 1 - (i.embedding <=> query_embedding) > match_threshold
    ORDER BY i.embedding <=> query_embedding
    LIMIT match_count;
END;
$$;
GRANT EXECUTE ON FUNCTION public.search_all_knowledge(halfvec(3072), int, float)
    TO anon, authenticated, service_role;
