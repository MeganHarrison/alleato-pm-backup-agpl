-- =============================================================================
-- Vector Search RPC Functions for RAG Retrieval (FIXED VERSION)
-- =============================================================================
-- These functions enable semantic search across structured knowledge tables
-- using pgvector's cosine similarity (<=> operator)
--
-- Usage from Python/Supabase client:
--   result = supabase.rpc('match_decisions', {
--       'query_embedding': [0.1, 0.2, ...],  # 1536-dim vector
--       'match_count': 10,
--       'match_threshold': 0.5  # optional, defaults to 0.5
--   }).execute()
-- =============================================================================


-- -----------------------------------------------------------------------------
-- CLEANUP: Drop ALL existing versions of these functions
-- -----------------------------------------------------------------------------
-- Drop all overloaded versions by using CASCADE
DROP FUNCTION IF EXISTS match_meeting_segments CASCADE;
DROP FUNCTION IF EXISTS match_decisions CASCADE;
DROP FUNCTION IF EXISTS match_risks CASCADE;
DROP FUNCTION IF EXISTS match_opportunities CASCADE;
DROP FUNCTION IF EXISTS match_documents_full CASCADE;
DROP FUNCTION IF EXISTS match_meeting_segments_by_project CASCADE;
DROP FUNCTION IF EXISTS match_decisions_by_project CASCADE;
DROP FUNCTION IF EXISTS match_risks_by_project CASCADE;
DROP FUNCTION IF EXISTS search_all_knowledge CASCADE;


-- -----------------------------------------------------------------------------
-- 1. match_meeting_segments
-- Search meeting segments by summary embedding similarity
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION match_meeting_segments(
    query_embedding vector(1536),
    match_count int DEFAULT 10,
    match_threshold float DEFAULT 0.5
)
RETURNS TABLE (
    id uuid,
    metadata_id text,
    segment_index int,
    title text,
    summary text,
    decisions jsonb,
    risks jsonb,
    tasks jsonb,
    project_ids int[],
    created_at timestamptz,
    similarity float
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT
        ms.id,
        ms.metadata_id,
        ms.segment_index,
        ms.title,
        ms.summary,
        ms.decisions,
        ms.risks,
        ms.tasks,
        ms.project_ids,
        ms.created_at,
        1 - (ms.summary_embedding <=> query_embedding) AS similarity
    FROM meeting_segments ms
    WHERE ms.summary_embedding IS NOT NULL
      AND 1 - (ms.summary_embedding <=> query_embedding) > match_threshold
    ORDER BY ms.summary_embedding <=> query_embedding
    LIMIT match_count;
END;
$$;


-- -----------------------------------------------------------------------------
-- 2. match_decisions
-- Search decisions by embedding similarity
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION match_decisions(
    query_embedding vector(1536),
    match_count int DEFAULT 10,
    match_threshold float DEFAULT 0.5
)
RETURNS TABLE (
    id uuid,
    metadata_id text,
    segment_id uuid,
    description text,
    rationale text,
    owner_name text,
    project_id int,
    project_ids int[],
    effective_date date,
    impact text,
    status text,
    created_at timestamptz,
    similarity float
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT
        d.id,
        d.metadata_id,
        d.segment_id,
        d.description,
        d.rationale,
        d.owner_name,
        d.project_id,
        d.project_ids,
        d.effective_date,
        d.impact,
        d.status,
        d.created_at,
        1 - (d.embedding <=> query_embedding) AS similarity
    FROM decisions d
    WHERE d.embedding IS NOT NULL
      AND 1 - (d.embedding <=> query_embedding) > match_threshold
    ORDER BY d.embedding <=> query_embedding
    LIMIT match_count;
END;
$$;


-- -----------------------------------------------------------------------------
-- 3. match_risks
-- Search risks by embedding similarity
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION match_risks(
    query_embedding vector(1536),
    match_count int DEFAULT 10,
    match_threshold float DEFAULT 0.5
)
RETURNS TABLE (
    id uuid,
    metadata_id text,
    segment_id uuid,
    description text,
    category text,
    likelihood text,
    impact text,
    owner_name text,
    project_id int,
    project_ids int[],
    mitigation_plan text,
    status text,
    created_at timestamptz,
    similarity float
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT
        r.id,
        r.metadata_id,
        r.segment_id,
        r.description,
        r.category,
        r.likelihood,
        r.impact,
        r.owner_name,
        r.project_id,
        r.project_ids,
        r.mitigation_plan,
        r.status,
        r.created_at,
        1 - (r.embedding <=> query_embedding) AS similarity
    FROM risks r
    WHERE r.embedding IS NOT NULL
      AND 1 - (r.embedding <=> query_embedding) > match_threshold
    ORDER BY r.embedding <=> query_embedding
    LIMIT match_count;
END;
$$;


-- -----------------------------------------------------------------------------
-- 4. match_opportunities
-- Search opportunities by embedding similarity
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION match_opportunities(
    query_embedding vector(1536),
    match_count int DEFAULT 10,
    match_threshold float DEFAULT 0.5
)
RETURNS TABLE (
    id uuid,
    metadata_id text,
    segment_id uuid,
    description text,
    type text,
    owner_name text,
    project_id int,
    project_ids int[],
    next_step text,
    status text,
    created_at timestamptz,
    similarity float
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT
        o.id,
        o.metadata_id,
        o.segment_id,
        o.description,
        o.type,
        o.owner_name,
        o.project_id,
        o.project_ids,
        o.next_step,
        o.status,
        o.created_at,
        1 - (o.embedding <=> query_embedding) AS similarity
    FROM opportunities o
    WHERE o.embedding IS NOT NULL
      AND 1 - (o.embedding <=> query_embedding) > match_threshold
    ORDER BY o.embedding <=> query_embedding
    LIMIT match_count;
END;
$$;


-- -----------------------------------------------------------------------------
-- 5. match_documents (improved version with more fields)
-- Search documents table by embedding similarity
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION match_documents_full(
    query_embedding vector(1536),
    match_count int DEFAULT 10,
    match_threshold float DEFAULT 0.5
)
RETURNS TABLE (
    id bigint,
    file_id text,
    title text,
    content text,
    source text,
    project_id int,
    project_ids int[],
    file_date date,
    metadata jsonb,
    created_at timestamptz,
    similarity float
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT
        doc.id,
        doc.file_id,
        doc.title,
        doc.content,
        doc.source,
        doc.project_id,
        doc.project_ids,
        doc.file_date,
        doc.metadata,
        doc.created_at,
        1 - (doc.embedding <=> query_embedding) AS similarity
    FROM documents doc
    WHERE doc.embedding IS NOT NULL
      AND 1 - (doc.embedding <=> query_embedding) > match_threshold
    ORDER BY doc.embedding <=> query_embedding
    LIMIT match_count;
END;
$$;


-- -----------------------------------------------------------------------------
-- 6. Hybrid search functions (vector + keyword + filters)
-- These combine semantic similarity with metadata filtering
-- -----------------------------------------------------------------------------

-- Search meeting segments with project filter
CREATE OR REPLACE FUNCTION match_meeting_segments_by_project(
    query_embedding vector(1536),
    filter_project_ids int[],
    match_count int DEFAULT 10,
    match_threshold float DEFAULT 0.3
)
RETURNS TABLE (
    id uuid,
    metadata_id text,
    segment_index int,
    title text,
    summary text,
    decisions jsonb,
    risks jsonb,
    tasks jsonb,
    project_ids int[],
    created_at timestamptz,
    similarity float
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT
        ms.id,
        ms.metadata_id,
        ms.segment_index,
        ms.title,
        ms.summary,
        ms.decisions,
        ms.risks,
        ms.tasks,
        ms.project_ids,
        ms.created_at,
        1 - (ms.summary_embedding <=> query_embedding) AS similarity
    FROM meeting_segments ms
    WHERE ms.summary_embedding IS NOT NULL
      AND ms.project_ids && filter_project_ids  -- Array overlap operator
      AND 1 - (ms.summary_embedding <=> query_embedding) > match_threshold
    ORDER BY ms.summary_embedding <=> query_embedding
    LIMIT match_count;
END;
$$;


-- Search decisions with project filter
CREATE OR REPLACE FUNCTION match_decisions_by_project(
    query_embedding vector(1536),
    filter_project_ids int[],
    match_count int DEFAULT 10,
    match_threshold float DEFAULT 0.3
)
RETURNS TABLE (
    id uuid,
    metadata_id text,
    segment_id uuid,
    description text,
    rationale text,
    owner_name text,
    project_id int,
    project_ids int[],
    effective_date date,
    impact text,
    status text,
    created_at timestamptz,
    similarity float
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT
        d.id,
        d.metadata_id,
        d.segment_id,
        d.description,
        d.rationale,
        d.owner_name,
        d.project_id,
        d.project_ids,
        d.effective_date,
        d.impact,
        d.status,
        d.created_at,
        1 - (d.embedding <=> query_embedding) AS similarity
    FROM decisions d
    WHERE d.embedding IS NOT NULL
      AND (d.project_ids && filter_project_ids OR d.project_id = ANY(filter_project_ids))
      AND 1 - (d.embedding <=> query_embedding) > match_threshold
    ORDER BY d.embedding <=> query_embedding
    LIMIT match_count;
END;
$$;


-- Search risks with project filter
CREATE OR REPLACE FUNCTION match_risks_by_project(
    query_embedding vector(1536),
    filter_project_ids int[],
    match_count int DEFAULT 10,
    match_threshold float DEFAULT 0.3
)
RETURNS TABLE (
    id uuid,
    metadata_id text,
    segment_id uuid,
    description text,
    category text,
    likelihood text,
    impact text,
    owner_name text,
    project_id int,
    project_ids int[],
    mitigation_plan text,
    status text,
    created_at timestamptz,
    similarity float
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT
        r.id,
        r.metadata_id,
        r.segment_id,
        r.description,
        r.category,
        r.likelihood,
        r.impact,
        r.owner_name,
        r.project_id,
        r.project_ids,
        r.mitigation_plan,
        r.status,
        r.created_at,
        1 - (r.embedding <=> query_embedding) AS similarity
    FROM risks r
    WHERE r.embedding IS NOT NULL
      AND (r.project_ids && filter_project_ids OR r.project_id = ANY(filter_project_ids))
      AND 1 - (r.embedding <=> query_embedding) > match_threshold
    ORDER BY r.embedding <=> query_embedding
    LIMIT match_count;
END;
$$;


-- -----------------------------------------------------------------------------
-- 7. Combined multi-table search (for blended retrieval)
-- Returns results from multiple tables in a unified format
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION search_all_knowledge(
    query_embedding vector(1536),
    match_count int DEFAULT 20,
    match_threshold float DEFAULT 0.4
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


-- -----------------------------------------------------------------------------
-- Grant permissions (adjust as needed for your security model)
-- -----------------------------------------------------------------------------
GRANT EXECUTE ON FUNCTION match_meeting_segments TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION match_decisions TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION match_risks TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION match_opportunities TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION match_documents_full TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION match_meeting_segments_by_project TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION match_decisions_by_project TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION match_risks_by_project TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION search_all_knowledge TO anon, authenticated, service_role;


-- -----------------------------------------------------------------------------
-- Create indexes for better performance (if not already present)
-- -----------------------------------------------------------------------------
-- Note: These use HNSW indexes for fast approximate nearest neighbor search
-- Adjust m and ef_construction based on your data size and accuracy needs

-- Index for meeting_segments.summary_embedding
CREATE INDEX IF NOT EXISTS meeting_segments_summary_embedding_idx
ON meeting_segments
USING hnsw (summary_embedding vector_cosine_ops)
WITH (m = 16, ef_construction = 64);

-- Index for decisions.embedding
CREATE INDEX IF NOT EXISTS decisions_embedding_idx
ON decisions
USING hnsw (embedding vector_cosine_ops)
WITH (m = 16, ef_construction = 64);

-- Index for risks.embedding
CREATE INDEX IF NOT EXISTS risks_embedding_idx
ON risks
USING hnsw (embedding vector_cosine_ops)
WITH (m = 16, ef_construction = 64);

-- Index for opportunities.embedding
CREATE INDEX IF NOT EXISTS opportunities_embedding_idx
ON opportunities
USING hnsw (embedding vector_cosine_ops)
WITH (m = 16, ef_construction = 64);

-- Index for documents.embedding
CREATE INDEX IF NOT EXISTS documents_embedding_idx
ON documents
USING hnsw (embedding vector_cosine_ops)
WITH (m = 16, ef_construction = 64);


-- -----------------------------------------------------------------------------
-- Verification: List all function signatures for debugging
-- -----------------------------------------------------------------------------
-- Run this query to see all overloaded versions of these functions:
/*
SELECT 
    n.nspname as schema_name,
    p.proname as function_name,
    pg_catalog.pg_get_function_identity_arguments(p.oid) as arguments
FROM pg_catalog.pg_proc p
LEFT JOIN pg_catalog.pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname NOT IN ('pg_catalog', 'information_schema')
  AND p.proname IN ('match_decisions', 'match_risks', 'match_opportunities', 
                    'match_meeting_segments', 'match_documents_full',
                    'match_meeting_segments_by_project', 'match_decisions_by_project',
                    'match_risks_by_project', 'search_all_knowledge')
ORDER BY 1, 2, 3;
*/