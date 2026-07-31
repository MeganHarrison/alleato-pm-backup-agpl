-- ============================================================================
-- Company Knowledge Governance
-- Adds approval, visibility, AI indexing, and source-document tracking so the
-- company Knowledge Base can separate reader-facing content from admin-managed
-- source intake.
-- ============================================================================

ALTER TABLE company_knowledge
  ADD COLUMN IF NOT EXISTS approval_status text NOT NULL DEFAULT 'approved',
  ADD COLUMN IF NOT EXISTS visibility text NOT NULL DEFAULT 'internal',
  ADD COLUMN IF NOT EXISTS ai_searchable boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS source_document_id text REFERENCES document_metadata(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS approved_at timestamptz,
  ADD COLUMN IF NOT EXISTS approved_by uuid REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE company_knowledge
  DROP CONSTRAINT IF EXISTS company_knowledge_approval_status_check,
  ADD CONSTRAINT company_knowledge_approval_status_check
    CHECK (approval_status IN ('draft', 'approved', 'archived'));
ALTER TABLE company_knowledge
  DROP CONSTRAINT IF EXISTS company_knowledge_visibility_check,
  ADD CONSTRAINT company_knowledge_visibility_check
    CHECK (visibility IN ('internal', 'admin_only', 'client_visible'));
UPDATE company_knowledge
SET
  approval_status = COALESCE(approval_status, 'approved'),
  visibility = COALESCE(visibility, 'internal'),
  ai_searchable = COALESCE(ai_searchable, true),
  approved_at = COALESCE(approved_at, updated_at, created_at)
WHERE
  approval_status IS NULL
  OR visibility IS NULL
  OR ai_searchable IS NULL
  OR approved_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_company_knowledge_approval_status
  ON company_knowledge (approval_status);
CREATE INDEX IF NOT EXISTS idx_company_knowledge_visibility
  ON company_knowledge (visibility);
CREATE INDEX IF NOT EXISTS idx_company_knowledge_ai_searchable
  ON company_knowledge (ai_searchable)
  WHERE ai_searchable = true;
CREATE INDEX IF NOT EXISTS idx_company_knowledge_source_document
  ON company_knowledge (source_document_id)
  WHERE source_document_id IS NOT NULL;
CREATE OR REPLACE FUNCTION search_knowledge_base(
  query_embedding vector(1536),
  match_count int DEFAULT 10,
  match_threshold float DEFAULT 0.5,
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
    AND ck.approval_status = 'approved'
    AND ck.visibility <> 'admin_only'
    AND ck.ai_searchable = true
    AND ck.embedding IS NOT NULL
    AND 1 - (ck.embedding <=> query_embedding) > match_threshold
    AND (filter_category IS NULL OR ck.category = filter_category)
    AND (filter_project_id IS NULL OR ck.project_id = filter_project_id)
  ORDER BY ck.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;
