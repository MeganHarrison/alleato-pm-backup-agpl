-- ============================================================================
-- Knowledge Base Enhancements
-- Adds embedding support, project/meeting linking, and expanded categories
-- to power the "second brain" knowledge base feature.
-- ============================================================================

-- 1. Add new columns to company_knowledge
-- ---------------------------------------------------------------------------

-- Embedding for semantic search (same dimension as rest of system)
ALTER TABLE company_knowledge
  ADD COLUMN IF NOT EXISTS embedding vector(1536);
-- Link knowledge to source project and/or meeting
ALTER TABLE company_knowledge
  ADD COLUMN IF NOT EXISTS project_id INTEGER REFERENCES projects(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS meeting_id TEXT REFERENCES document_metadata(id) ON DELETE SET NULL;
-- Track whether entry was auto-extracted from a meeting vs manually created
ALTER TABLE company_knowledge
  ADD COLUMN IF NOT EXISTS origin TEXT NOT NULL DEFAULT 'manual'
    CHECK (origin IN ('manual', 'meeting_extraction', 'ai_assistant', 'import'));
-- 2. Expand category CHECK constraint to include construction/ASRS domain categories
-- ---------------------------------------------------------------------------

-- Drop existing check and replace with expanded set
ALTER TABLE company_knowledge DROP CONSTRAINT IF EXISTS company_knowledge_category_check;
ALTER TABLE company_knowledge ADD CONSTRAINT company_knowledge_category_check
  CHECK (category IN (
    -- Original categories
    'strategy', 'policy', 'process', 'market_intel',
    'lessons_learned', 'best_practice', 'org_update', 'general',
    -- Construction domain categories
    'system_design',      -- ASRS design, fire suppression design, MEP design
    'pricing_intel',      -- Vendor pricing, cost benchmarks, quote analysis
    'vendor_intel',       -- Vendor capabilities, reliability, relationships
    'client_education',   -- Knowledge for educating clients
    'technical_reference', -- Engineering specs, standards, code requirements
    'safety_compliance',  -- OSHA, fire code, safety protocols
    'installation_ops'    -- Installation best practices, field operations
  ));
-- 3. Add indexes for new columns
-- ---------------------------------------------------------------------------

CREATE INDEX IF NOT EXISTS idx_company_knowledge_embedding
  ON company_knowledge USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 50);
CREATE INDEX IF NOT EXISTS idx_company_knowledge_project
  ON company_knowledge (project_id) WHERE project_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_company_knowledge_meeting
  ON company_knowledge (meeting_id) WHERE meeting_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_company_knowledge_origin
  ON company_knowledge (origin);
-- 4. Semantic search RPC for knowledge base
-- ---------------------------------------------------------------------------

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
    AND ck.embedding IS NOT NULL
    AND 1 - (ck.embedding <=> query_embedding) > match_threshold
    AND (filter_category IS NULL OR ck.category = filter_category)
    AND (filter_project_id IS NULL OR ck.project_id = filter_project_id)
  ORDER BY ck.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;
