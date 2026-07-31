-- Fix semantic meeting summary search for AI Strategist.
--
-- The previous function was declared STABLE while using SET LOCAL hnsw.ef_search,
-- which Postgres rejects at runtime. It also referenced document_metadata.started_at,
-- a non-existent column in the current schema. Keep the public signature stable so
-- generated clients and tool calls continue to work.

CREATE OR REPLACE FUNCTION public.match_document_metadata_by_summary(
    query_embedding   halfvec(3072),
    match_count       int     DEFAULT 10,
    match_threshold   float   DEFAULT 0.3,
    p_project_id      int     DEFAULT NULL
)
RETURNS TABLE (
    id          text,
    title       text,
    summary     text,
    date        text,
    project_id  int,
    source      text,
    similarity  float
)
LANGUAGE plpgsql VOLATILE AS $$
BEGIN
    SET LOCAL hnsw.ef_search = 100;

    RETURN QUERY
    SELECT
        dm.id,
        dm.title,
        COALESCE(dm.summary, dm.overview, '') AS summary,
        COALESCE(dm.date::text, '') AS date,
        dm.project_id::int AS project_id,
        dm.source,
        (1 - (dm.summary_embedding <=> query_embedding))::float AS similarity
    FROM public.document_metadata dm
    WHERE
        dm.summary_embedding IS NOT NULL
        AND (1 - (dm.summary_embedding <=> query_embedding)) > match_threshold
        AND (p_project_id IS NULL OR dm.project_id = p_project_id)
    ORDER BY dm.summary_embedding <=> query_embedding
    LIMIT match_count;
END;
$$;
GRANT EXECUTE ON FUNCTION public.match_document_metadata_by_summary(halfvec(3072), int, float, int)
    TO anon, authenticated, service_role;
