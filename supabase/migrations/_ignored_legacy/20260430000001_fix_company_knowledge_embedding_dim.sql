-- ============================================================================
-- Fix company_knowledge.embedding dimension: vector(1536) → halfvec(3072)
--
-- Context:
--   - All other RAG tables were migrated to halfvec(3072) in 20260318000004.
--   - company_knowledge was missed in that migration.
--   - The governance migration (20260429093000) re-declared search_knowledge_base
--     with vector(1536) — we must drop it and recreate with halfvec(3072).
--   - Table has zero rows, so USING NULL::halfvec(3072) is safe.
-- ============================================================================

-- 1. Drop the old ivfflat index
DROP INDEX IF EXISTS idx_company_knowledge_embedding;

-- 2. Alter column type (safe: table is empty)
ALTER TABLE company_knowledge
  ALTER COLUMN embedding TYPE halfvec(3072) USING NULL::halfvec(3072);

-- 3. Create HNSW index (matches all other RAG tables)
CREATE INDEX idx_company_knowledge_embedding
  ON company_knowledge
  USING hnsw (embedding halfvec_cosine_ops)
  WITH (m = 32, ef_construction = 200);

-- 4. Drop old search_knowledge_base overloads (all signatures that may exist)
DROP FUNCTION IF EXISTS search_knowledge_base(vector, int, float, text, int);
DROP FUNCTION IF EXISTS search_knowledge_base(vector(1536), int, float, text, int);
DROP FUNCTION IF EXISTS search_knowledge_base(halfvec, int, float, text, int);
DROP FUNCTION IF EXISTS search_knowledge_base(halfvec(3072), int, float, text, int);

-- 5. Recreate search_knowledge_base with halfvec(3072)
CREATE OR REPLACE FUNCTION search_knowledge_base(
  query_embedding  halfvec(3072),
  match_count      int     DEFAULT 10,
  match_threshold  float   DEFAULT 0.3,
  filter_category  text    DEFAULT NULL,
  filter_project_id int    DEFAULT NULL
)
RETURNS TABLE (
  id           uuid,
  title        text,
  content      text,
  category     text,
  tags         text[],
  source       text,
  project_id   int,
  meeting_id   text,
  origin       text,
  similarity   float,
  created_at   timestamptz
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

GRANT EXECUTE ON FUNCTION search_knowledge_base(halfvec(3072), int, float, text, int)
  TO anon, authenticated, service_role;
