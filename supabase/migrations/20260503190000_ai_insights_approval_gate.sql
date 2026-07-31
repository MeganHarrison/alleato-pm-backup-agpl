-- Add approval_status gate to ai_insights so AI-generated insights require
-- human review before appearing in semantic search results.
-- Root cause: saveInsight tool was writing directly to ai_insights with no
-- quality gate, polluting search results with AI-generated synthetic content.

-- 1. Add approval_status column to ai_insights
ALTER TABLE public.ai_insights
  ADD COLUMN IF NOT EXISTS approval_status text NOT NULL DEFAULT 'draft';

ALTER TABLE public.ai_insights
  DROP CONSTRAINT IF EXISTS ai_insights_approval_status_check;
ALTER TABLE public.ai_insights
  ADD CONSTRAINT ai_insights_approval_status_check
    CHECK (approval_status IN ('draft', 'approved', 'archived'));

CREATE INDEX IF NOT EXISTS idx_ai_insights_approval_status
  ON public.ai_insights (approval_status);

-- 2. Mark all existing AI-generated insights (those with no source meeting
--    or document, i.e. written directly by the AI tool) as 'draft' for review.
--    Insights that have a real meeting_id or document_id are considered sourced
--    and can stay approved.
UPDATE public.ai_insights
SET approval_status = 'draft'
WHERE meeting_id IS NULL
  AND document_id IS NULL
  AND approval_status = 'draft';

-- 3. Add approval_status to the insights table (the normalized RAG table
--    queried by search_all_knowledge) so garbage can be filtered at query time.
ALTER TABLE public.insights
  ADD COLUMN IF NOT EXISTS approval_status text NOT NULL DEFAULT 'approved';

ALTER TABLE public.insights
  DROP CONSTRAINT IF EXISTS insights_approval_status_check;
ALTER TABLE public.insights
  ADD CONSTRAINT insights_approval_status_check
    CHECK (approval_status IN ('draft', 'approved', 'archived'));

CREATE INDEX IF NOT EXISTS idx_insights_approval_status
  ON public.insights (approval_status);

-- 4. Update search_all_knowledge to filter out non-approved insights.
--    Previously any insight (including AI-generated garbage) could surface.
DROP FUNCTION IF EXISTS search_all_knowledge(halfvec(3072), int, float);
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
        AND i.approval_status = 'approved'
        AND 1 - (i.embedding <=> query_embedding) > match_threshold
    ORDER BY i.embedding <=> query_embedding
    LIMIT match_count;
END;
$$;
GRANT EXECUTE ON FUNCTION search_all_knowledge(halfvec(3072), int, float)
    TO anon, authenticated, service_role;
