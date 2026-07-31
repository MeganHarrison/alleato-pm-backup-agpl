-- =============================================================================
-- Fix embedding dimension mismatches across company_knowledge and memories tables.
--
-- Context:
--   - All RAG tables were migrated to halfvec(3072) in 20260318000004
--   - company_knowledge and memories were missed in that migration
--   - search_knowledge_base still expects vector(1536)
--   - search_conversation_memories still expects vector(1536)
--   - ai_memories is already halfvec(3072) (correct)
--   - This migration aligns the remaining tables + RPCs to halfvec(3072)
-- =============================================================================

-- ─── company_knowledge ───────────────────────────────────────────────────────
DROP INDEX IF EXISTS idx_company_knowledge_embedding;

ALTER TABLE company_knowledge
  ALTER COLUMN embedding TYPE halfvec(3072) USING NULL::halfvec(3072);

CREATE INDEX idx_company_knowledge_embedding
  ON company_knowledge
  USING hnsw (embedding halfvec_cosine_ops)
  WITH (m = 32, ef_construction = 200);

-- Update search_knowledge_base to accept halfvec(3072)
DROP FUNCTION IF EXISTS search_knowledge_base(vector, int, float, text, int);
DROP FUNCTION IF EXISTS search_knowledge_base(vector(1536), int, float, text, int);

CREATE OR REPLACE FUNCTION search_knowledge_base(
    query_embedding  halfvec(3072),
    match_count      int     DEFAULT 10,
    match_threshold  float   DEFAULT 0.3,
    filter_category  text    DEFAULT NULL,
    filter_project_id int    DEFAULT NULL
)
RETURNS TABLE (
    id          uuid,
    title       text,
    content     text,
    category    text,
    tags        text[],
    source      text,
    project_id  int,
    meeting_id  text,
    origin      text,
    similarity  float,
    created_at  timestamptz
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

GRANT EXECUTE ON FUNCTION search_knowledge_base(halfvec(3072), int, float, text, int) TO anon, authenticated, service_role;

-- ─── memories (conversation memory) ──────────────────────────────────────────
ALTER TABLE memories
  ALTER COLUMN embedding TYPE halfvec(3072) USING NULL::halfvec(3072);

CREATE INDEX IF NOT EXISTS idx_memories_embedding
  ON memories
  USING hnsw (embedding halfvec_cosine_ops)
  WITH (m = 32, ef_construction = 200);

-- Update search_conversation_memories to accept halfvec(3072)
DROP FUNCTION IF EXISTS search_conversation_memories(vector(1536), int, uuid);
DROP FUNCTION IF EXISTS search_conversation_memories(vector, int, uuid);

CREATE OR REPLACE FUNCTION search_conversation_memories(
    query_embedding  halfvec(3072),
    match_count      int  DEFAULT 5,
    filter_user_id   uuid DEFAULT NULL
)
RETURNS TABLE (id bigint, content text, metadata jsonb, similarity float)
LANGUAGE sql STABLE
AS $$
    SELECT m.id, m.content, m.metadata,
           1 - (m.embedding <=> query_embedding) AS similarity
    FROM memories m
    WHERE m.memory_type = 'conversation_summary'
      AND m.embedding IS NOT NULL
      AND (filter_user_id IS NULL OR m.user_id = filter_user_id)
    ORDER BY m.embedding <=> query_embedding
    LIMIT match_count;
$$;

GRANT EXECUTE ON FUNCTION search_conversation_memories(halfvec(3072), int, uuid) TO anon, authenticated, service_role;
