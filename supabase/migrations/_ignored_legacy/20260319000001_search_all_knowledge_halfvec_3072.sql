-- Migrate search_all_knowledge to halfvec(3072)
--
-- Migration 20260318000004 already migrated all embedding columns
-- (decisions, risks, opportunities, meeting_segments.summary_embedding)
-- to halfvec(3072). This migration updates the function signature to match,
-- fixing the dimension mismatch introduced when semanticSearch was updated
-- to pass 3072-dim embeddings.
--
-- Uses halfvec_cosine_ops consistent with the HNSW indexes created in _000004.

DROP FUNCTION IF EXISTS search_all_knowledge(vector(1536), int, float);
DROP FUNCTION IF EXISTS search_all_knowledge(halfvec(3072), int, float);

CREATE OR REPLACE FUNCTION search_all_knowledge(
    query_embedding halfvec(3072),
    match_count int DEFAULT 20,
    match_threshold float DEFAULT 0.3
)
RETURNS TABLE (
    source_table text,
    record_id uuid,
    content text,
    metadata jsonb,
    project_ids int[],
    created_at timestamptz,
    similarity float
)
LANGUAGE plpgsql
AS $$
BEGIN
    SET LOCAL hnsw.ef_search = 100;

    RETURN QUERY
    (
        -- Decisions
        SELECT
            'decisions'::text AS source_table,
            d.id AS record_id,
            d.description AS content,
            jsonb_build_object(
                'rationale', d.rationale,
                'owner', d.owner_name,
                'impact', d.impact,
                'status', d.status
            ) AS metadata,
            d.project_ids,
            d.created_at,
            1 - (d.embedding <=> query_embedding) AS similarity
        FROM decisions d
        WHERE d.embedding IS NOT NULL
          AND 1 - (d.embedding <=> query_embedding) > match_threshold
    )
    UNION ALL
    (
        -- Risks
        SELECT
            'risks'::text AS source_table,
            r.id AS record_id,
            r.description AS content,
            jsonb_build_object(
                'category', r.category,
                'likelihood', r.likelihood,
                'impact', r.impact,
                'owner', r.owner_name,
                'mitigation', r.mitigation_plan,
                'status', r.status
            ) AS metadata,
            r.project_ids,
            r.created_at,
            1 - (r.embedding <=> query_embedding) AS similarity
        FROM risks r
        WHERE r.embedding IS NOT NULL
          AND 1 - (r.embedding <=> query_embedding) > match_threshold
    )
    UNION ALL
    (
        -- Opportunities
        SELECT
            'opportunities'::text AS source_table,
            o.id AS record_id,
            o.description AS content,
            jsonb_build_object(
                'type', o.type,
                'owner', o.owner_name,
                'next_step', o.next_step,
                'status', o.status
            ) AS metadata,
            o.project_ids,
            o.created_at,
            1 - (o.embedding <=> query_embedding) AS similarity
        FROM opportunities o
        WHERE o.embedding IS NOT NULL
          AND 1 - (o.embedding <=> query_embedding) > match_threshold
    )
    UNION ALL
    (
        -- Meeting Segments
        SELECT
            'meeting_segments'::text AS source_table,
            ms.id AS record_id,
            COALESCE(ms.title, '') || ': ' || COALESCE(ms.summary, '') AS content,
            jsonb_build_object(
                'segment_index', ms.segment_index,
                'decisions_count', jsonb_array_length(ms.decisions),
                'risks_count', jsonb_array_length(ms.risks),
                'tasks_count', jsonb_array_length(ms.tasks)
            ) AS metadata,
            ms.project_ids,
            ms.created_at,
            1 - (ms.summary_embedding <=> query_embedding) AS similarity
        FROM meeting_segments ms
        WHERE ms.summary_embedding IS NOT NULL
          AND 1 - (ms.summary_embedding <=> query_embedding) > match_threshold
    )
    ORDER BY similarity DESC
    LIMIT match_count;
END;
$$;

GRANT EXECUTE ON FUNCTION search_all_knowledge(halfvec(3072), int, float) TO anon, authenticated, service_role;
