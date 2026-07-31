-- =============================================================================
-- Consolidate RAG schema
--
-- Changes:
--   1. Create `insights` table — merges decisions, risks, opportunities into
--      a single table with a `type` column. Keeps all data queryable via one
--      HNSW index and one RPC instead of 3 tables + 3-way UNION.
--
--   2. Migrate existing rows from decisions/risks/opportunities → insights.
--
--   3. Drop decisions, risks, opportunities tables (+ their RPCs and indexes).
--
--   4. Drop meeting_digests table — redundant with document_metadata.summary
--      (Fireflies provides the real summary natively; digest was an extra LLM
--      call on already-AI-processed content).
--
--   5. Drop meeting_segments.summary_embedding column — the summaries were
--      AI-hallucinated by the parser (fake names, placeholder dates). The
--      table stays as internal pipeline plumbing (extractor reads raw
--      decisions/risks arrays from it) but is no longer a search target.
--
--   6. Add document_metadata.summary_embedding halfvec(3072) — embed the
--      real Fireflies-generated summary once per meeting. This becomes the
--      semantic search target for searchMeetingsByTopic.
--
--   7. Replace search_all_knowledge RPC to query insights instead of the
--      3 legacy tables.
--
--   8. Add match_document_metadata_by_summary RPC for semantic meeting search.
-- =============================================================================

-- ─── 1. Create insights table ────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS insights (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    metadata_id     text REFERENCES document_metadata(id) ON DELETE CASCADE,
    project_id      bigint REFERENCES projects(id) ON DELETE SET NULL,
    project_ids     integer[] DEFAULT '{}',
    type            text NOT NULL CHECK (type IN ('decision', 'risk', 'opportunity')),
    description     text NOT NULL,
    owner_name      text,
    status          text NOT NULL DEFAULT 'open',
    details         jsonb DEFAULT '{}'::jsonb,
    -- details stores type-specific fields:
    --   decision:    { rationale, impact, effective_date }
    --   risk:        { category, likelihood, impact, mitigation_plan }
    --   opportunity: { opportunity_type, next_step }
    embedding       halfvec(3072),
    created_at      timestamptz NOT NULL DEFAULT now(),
    updated_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_insights_type        ON insights(type);
CREATE INDEX idx_insights_metadata_id ON insights(metadata_id);
CREATE INDEX idx_insights_project_id  ON insights(project_id);
CREATE INDEX idx_insights_status      ON insights(status);
-- HNSW index for semantic search (halfvec cosine)
CREATE INDEX idx_insights_embedding
    ON insights
    USING hnsw (embedding halfvec_cosine_ops)
    WITH (m = 32, ef_construction = 200);
-- updated_at trigger
CREATE OR REPLACE FUNCTION update_insights_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;
CREATE TRIGGER update_insights_timestamp
    BEFORE UPDATE ON insights
    FOR EACH ROW EXECUTE FUNCTION update_insights_updated_at();
-- RLS
ALTER TABLE insights ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can read insights" ON insights;
CREATE POLICY "Users can read insights" ON insights FOR SELECT
    USING (auth.role() IN ('authenticated', 'service_role'));
DROP POLICY IF EXISTS "Service role can manage insights" ON insights;
CREATE POLICY "Service role can manage insights" ON insights FOR ALL
    USING (auth.role() = 'service_role');
-- ─── 2. Migrate existing rows ─────────────────────────────────────────────────

-- Decisions → insights
INSERT INTO insights (
    metadata_id, project_id, project_ids, type, description,
    owner_name, status, details, embedding, created_at
)
SELECT
    metadata_id,
    project_id,
    COALESCE(project_ids, '{}'),
    'decision',
    description,
    owner_name,
    COALESCE(status, 'active'),
    jsonb_build_object(
        'rationale',       rationale,
        'impact',          impact,
        'effective_date',  effective_date
    ),
    embedding,
    created_at
FROM decisions
WHERE description IS NOT NULL AND description <> ''
ON CONFLICT DO NOTHING;
-- Risks → insights
INSERT INTO insights (
    metadata_id, project_id, project_ids, type, description,
    owner_name, status, details, embedding, created_at
)
SELECT
    metadata_id,
    project_id,
    COALESCE(project_ids, '{}'),
    'risk',
    description,
    owner_name,
    COALESCE(status, 'open'),
    jsonb_build_object(
        'category',         category,
        'likelihood',       likelihood,
        'impact',           impact,
        'mitigation_plan',  mitigation_plan
    ),
    embedding,
    created_at
FROM risks
WHERE description IS NOT NULL AND description <> ''
ON CONFLICT DO NOTHING;
-- Opportunities → insights
INSERT INTO insights (
    metadata_id, project_id, project_ids, type, description,
    owner_name, status, details, embedding, created_at
)
SELECT
    metadata_id,
    project_id,
    COALESCE(project_ids, '{}'),
    'opportunity',
    description,
    owner_name,
    COALESCE(status, 'open'),
    jsonb_build_object(
        'opportunity_type', type,
        'next_step',        next_step
    ),
    embedding,
    created_at
FROM opportunities
WHERE description IS NOT NULL AND description <> ''
ON CONFLICT DO NOTHING;
-- ─── 3. Drop legacy tables ───────────────────────────────────────────────────

-- Drop RPCs first (they reference the tables)
DROP FUNCTION IF EXISTS match_decisions(vector, int, float);
DROP FUNCTION IF EXISTS match_decisions(halfvec(3072), int, float);
DROP FUNCTION IF EXISTS match_decisions_by_project(vector, int[], int, float);
DROP FUNCTION IF EXISTS match_decisions_by_project(halfvec(3072), int[], int, float);
DROP FUNCTION IF EXISTS match_risks(vector, int, float);
DROP FUNCTION IF EXISTS match_risks(halfvec(3072), int, float);
DROP FUNCTION IF EXISTS match_risks_by_project(vector, bigint[], int, float);
DROP FUNCTION IF EXISTS match_risks_by_project(halfvec(3072), bigint[], int, float);
DROP FUNCTION IF EXISTS match_opportunities(vector, int, float);
DROP FUNCTION IF EXISTS match_opportunities(halfvec(3072), int, float);
DROP FUNCTION IF EXISTS match_opportunities_by_project(vector, int[], int, float);
DROP FUNCTION IF EXISTS match_opportunities_by_project(halfvec(3072), int[], int, float);
DROP TABLE IF EXISTS decisions CASCADE;
DROP TABLE IF EXISTS risks CASCADE;
DROP TABLE IF EXISTS opportunities CASCADE;
-- ─── 4. Drop meeting_digests ─────────────────────────────────────────────────

DROP TABLE IF EXISTS meeting_digests CASCADE;
-- ─── 5. Remove summary_embedding from meeting_segments ───────────────────────
-- Also drop the match_meeting_segments RPCs since they search summary_embedding.

DROP FUNCTION IF EXISTS match_meeting_segments(halfvec(3072), int, float);
DROP FUNCTION IF EXISTS match_meeting_segments(vector, int, float);
DROP FUNCTION IF EXISTS match_meeting_segments(halfvec(3072), int, float, int);
DROP FUNCTION IF EXISTS match_meeting_segments_by_project(halfvec(3072), int[], int, float);
DROP FUNCTION IF EXISTS match_meeting_segments_by_project(vector, int[], int, float);
DROP INDEX IF EXISTS meeting_segments_summary_embedding_idx;
ALTER TABLE meeting_segments DROP COLUMN IF EXISTS summary_embedding;
-- ─── 6. Add summary_embedding to document_metadata ───────────────────────────

ALTER TABLE document_metadata
    ADD COLUMN IF NOT EXISTS summary_embedding halfvec(3072);
CREATE INDEX IF NOT EXISTS idx_document_metadata_summary_embedding
    ON document_metadata
    USING hnsw (summary_embedding halfvec_cosine_ops)
    WITH (m = 32, ef_construction = 200);
-- ─── 7. Replace search_all_knowledge RPC ─────────────────────────────────────
-- Now queries the single insights table instead of 3-way UNION.

DROP FUNCTION IF EXISTS search_all_knowledge(halfvec(3072), int, float);
DROP FUNCTION IF EXISTS search_all_knowledge(vector(1536), int, float);
DROP FUNCTION IF EXISTS search_all_knowledge(vector, int, float);
CREATE OR REPLACE FUNCTION search_all_knowledge(
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
LANGUAGE plpgsql STABLE AS $$
BEGIN
    SET LOCAL hnsw.ef_search = 100;

    RETURN QUERY
    SELECT
        i.id,
        'insights'::text            AS source_table,
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
        AND 1 - (i.embedding <=> query_embedding) > match_threshold
    ORDER BY i.embedding <=> query_embedding
    LIMIT match_count;
END;
$$;
GRANT EXECUTE ON FUNCTION search_all_knowledge(halfvec(3072), int, float)
    TO anon, authenticated, service_role;
-- ─── 8. Add match_document_metadata_by_summary RPC ───────────────────────────
-- Semantic search on real Fireflies meeting summaries.
-- Used by searchMeetingsByTopic instead of match_meeting_segments.

DROP FUNCTION IF EXISTS match_document_metadata_by_summary(halfvec(3072), int, float, int);
CREATE OR REPLACE FUNCTION match_document_metadata_by_summary(
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
LANGUAGE plpgsql STABLE AS $$
BEGIN
    SET LOCAL hnsw.ef_search = 100;

    RETURN QUERY
    SELECT
        dm.id,
        dm.title,
        COALESCE(dm.summary, dm.overview, '')   AS summary,
        COALESCE(dm.date::text, dm.started_at::text, '') AS date,
        dm.project_id,
        dm.source,
        1 - (dm.summary_embedding <=> query_embedding) AS similarity
    FROM document_metadata dm
    WHERE
        dm.summary_embedding IS NOT NULL
        AND 1 - (dm.summary_embedding <=> query_embedding) > match_threshold
        AND (p_project_id IS NULL OR dm.project_id = p_project_id)
    ORDER BY dm.summary_embedding <=> query_embedding
    LIMIT match_count;
END;
$$;
GRANT EXECUTE ON FUNCTION match_document_metadata_by_summary(halfvec(3072), int, float, int)
    TO anon, authenticated, service_role;
-- ─── Grants ───────────────────────────────────────────────────────────────────
GRANT ALL ON TABLE insights TO anon, authenticated, service_role;
