-- Migration: Improve vector search quality
-- Changes:
-- 1. Lower default similarity thresholds from 0.5 → 0.3 (better recall)
-- 2. Add hnsw.ef_search = 100 hint to all search functions (better HNSW recall)
-- 3. Rebuild HNSW indexes with m=32, ef_construction=200 (better accuracy)
-- 4. Migrate company_knowledge and opportunities from IVFFlat → HNSW (better accuracy)
-- Applied: 2026-03-18


-- =============================================================================
-- SECTION 1 & 2: Recreate RPC functions with lower default thresholds (0.5→0.3)
--                and hnsw.ef_search = 100 hint at the start of each BEGIN block
-- =============================================================================


-- -----------------------------------------------------------------------------
-- 1. match_meeting_segments
-- -----------------------------------------------------------------------------
DROP FUNCTION IF EXISTS match_meeting_segments;
CREATE OR REPLACE FUNCTION match_meeting_segments(
    query_embedding vector(1536),
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
    SET LOCAL hnsw.ef_search = 100;

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
-- -----------------------------------------------------------------------------
DROP FUNCTION IF EXISTS match_decisions;
CREATE OR REPLACE FUNCTION match_decisions(
    query_embedding vector(1536),
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
    SET LOCAL hnsw.ef_search = 100;

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
-- 3. match_risks (drop first — return type changed)
-- -----------------------------------------------------------------------------
DROP FUNCTION IF EXISTS match_risks;
CREATE OR REPLACE FUNCTION match_risks(
    query_embedding vector(1536),
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
    SET LOCAL hnsw.ef_search = 100;

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
-- -----------------------------------------------------------------------------
DROP FUNCTION IF EXISTS match_opportunities;
CREATE OR REPLACE FUNCTION match_opportunities(
    query_embedding vector(1536),
    match_count int DEFAULT 10,
    match_threshold float DEFAULT 0.3
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
    SET LOCAL hnsw.ef_search = 100;

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
-- 5. match_documents_full
-- -----------------------------------------------------------------------------
DROP FUNCTION IF EXISTS match_documents_full;
CREATE OR REPLACE FUNCTION match_documents_full(
    query_embedding vector(1536),
    match_count int DEFAULT 10,
    match_threshold float DEFAULT 0.3
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
    SET LOCAL hnsw.ef_search = 100;

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
-- 6. search_all_knowledge
--    Note: threshold default was already 0.4 — lowered to 0.3 for consistency
-- -----------------------------------------------------------------------------
DROP FUNCTION IF EXISTS search_all_knowledge;
CREATE OR REPLACE FUNCTION search_all_knowledge(
    query_embedding vector(1536),
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
-- -----------------------------------------------------------------------------
-- 7. search_knowledge_base
--    Threshold default was 0.5 — lowered to 0.3
-- -----------------------------------------------------------------------------
DROP FUNCTION IF EXISTS search_knowledge_base;
CREATE OR REPLACE FUNCTION search_knowledge_base(
    query_embedding vector(1536),
    match_count int DEFAULT 10,
    match_threshold float DEFAULT 0.3,
    filter_category text DEFAULT NULL,
    filter_project_id int DEFAULT NULL
)
RETURNS TABLE (
    id uuid,
    title text,
    content text,
    category text,
    tags text[],
    source text,
    project_id int,
    meeting_id text,
    origin text,
    similarity float,
    created_at timestamptz
)
LANGUAGE plpgsql
AS $$
BEGIN
    SET LOCAL hnsw.ef_search = 100;

    RETURN QUERY
    SELECT
        ck.id,
        ck.title,
        ck.content,
        ck.category,
        ck.tags,
        ck.source,
        ck.project_id,
        ck.meeting_id,
        ck.origin,
        1 - (ck.embedding <=> query_embedding) AS similarity,
        ck.created_at
    FROM company_knowledge ck
    WHERE
        ck.is_active = true
        AND ck.embedding IS NOT NULL
        AND 1 - (ck.embedding <=> query_embedding) > match_threshold
        AND (filter_category IS NULL OR ck.category = filter_category)
        AND (filter_project_id IS NULL OR ck.project_id = filter_project_id)
    ORDER BY ck.embedding <=> query_embedding
    LIMIT match_count;
END;
$$;
-- =============================================================================
-- SECTION 3: Rebuild HNSW indexes with better parameters (m=32, ef_construction=200)
-- Current indexes were created with m=16, ef_construction=64
-- =============================================================================

-- meeting_segments: was HNSW m=16, ef_construction=64
DROP INDEX IF EXISTS meeting_segments_summary_embedding_idx;
CREATE INDEX meeting_segments_summary_embedding_idx
    ON meeting_segments
    USING hnsw (summary_embedding vector_cosine_ops)
    WITH (m = 32, ef_construction = 200);
-- decisions: was HNSW m=16, ef_construction=64
DROP INDEX IF EXISTS decisions_embedding_idx;
CREATE INDEX decisions_embedding_idx
    ON decisions
    USING hnsw (embedding vector_cosine_ops)
    WITH (m = 32, ef_construction = 200);
-- risks: was HNSW m=16, ef_construction=64
DROP INDEX IF EXISTS risks_embedding_idx;
CREATE INDEX risks_embedding_idx
    ON risks
    USING hnsw (embedding vector_cosine_ops)
    WITH (m = 32, ef_construction = 200);
-- =============================================================================
-- SECTION 4: Migrate IVFFlat indexes → HNSW
-- =============================================================================

-- opportunities: was IVFFlat lists=50 — migrate to HNSW
DROP INDEX IF EXISTS opportunities_embedding_idx;
CREATE INDEX opportunities_embedding_idx
    ON opportunities
    USING hnsw (embedding vector_cosine_ops)
    WITH (m = 32, ef_construction = 200);
-- company_knowledge: was IVFFlat lists=50 — migrate to HNSW
DROP INDEX IF EXISTS idx_company_knowledge_embedding;
CREATE INDEX idx_company_knowledge_embedding_hnsw
    ON company_knowledge
    USING hnsw (embedding vector_cosine_ops)
    WITH (m = 32, ef_construction = 200);
-- =============================================================================
-- Re-grant permissions (idempotent — safe to run again)
-- =============================================================================
GRANT EXECUTE ON FUNCTION match_meeting_segments TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION match_decisions TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION match_risks TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION match_opportunities TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION match_documents_full TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION search_all_knowledge TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION search_knowledge_base TO anon, authenticated, service_role;
