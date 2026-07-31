-- Guard search_all_knowledge against the dropped `insights` table (PM APP).
-- The `insights` table was removed in a prior migration but search_all_knowledge
-- still did `FROM insights`, so it threw "relation insights does not exist". The AI
-- assistant's semanticSearch runs this in parallel with the document-chunks search and
-- treats BOTH failing as a hard error -> "Broader knowledge search: failed on the
-- backend". Degrade gracefully: return 0 rows when the table is absent, so the chunks
-- search alone can still answer. Re-home insights into this function when an embedded
-- insights store exists again. 2026-06-24.
CREATE OR REPLACE FUNCTION public.search_all_knowledge(
    query_embedding halfvec,
    match_count integer DEFAULT 10,
    match_threshold double precision DEFAULT 0.3
)
RETURNS TABLE(
    id uuid, source_table text, metadata_id text, description text, type text,
    owner_name text, project_id bigint, project_ids integer[], status text,
    details jsonb, similarity double precision, created_at timestamp with time zone
)
LANGUAGE plpgsql
AS $function$
BEGIN
    IF to_regclass('public.insights') IS NULL THEN
        RETURN;
    END IF;

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
    FROM insights i
    WHERE
        i.embedding IS NOT NULL
        AND i.approval_status = 'approved'
        AND 1 - (i.embedding <=> query_embedding) > match_threshold
    ORDER BY i.embedding <=> query_embedding
    LIMIT match_count;
END;
$function$;
