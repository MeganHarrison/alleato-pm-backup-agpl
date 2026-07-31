-- Normalize AI memory RPCs to match the active embedding storage.
--
-- ai_memories.embedding is halfvec(3072) after the 3072-dimension embedding
-- migration. These functions previously accepted vector inputs, which worked
-- only through implicit casts and made the live contract drift from storage.

DROP FUNCTION IF EXISTS search_ai_memories(vector, uuid, int, float, text, int);
DROP FUNCTION IF EXISTS search_ai_memories(vector(1536), uuid, int, float, text, int);
DROP FUNCTION IF EXISTS search_ai_memories(halfvec, uuid, int, float, text, int);
DROP FUNCTION IF EXISTS search_ai_memories(halfvec(3072), uuid, int, float, text, int);
CREATE OR REPLACE FUNCTION search_ai_memories(
  query_embedding   halfvec(3072),
  p_user_id         UUID,
  match_count       INT     DEFAULT 8,
  match_threshold   FLOAT   DEFAULT 0.45,
  filter_type       TEXT    DEFAULT NULL,
  filter_project_id INT     DEFAULT NULL
)
RETURNS TABLE (
  id              UUID,
  type            TEXT,
  content         TEXT,
  confidence      FLOAT,
  importance      FLOAT,
  project_id      INT,
  meeting_id      TEXT,
  source          TEXT,
  created_at      TIMESTAMPTZ,
  similarity      FLOAT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  SET LOCAL hnsw.ef_search = 100;

  RETURN QUERY
  SELECT
    m.id,
    m.type,
    m.content,
    m.confidence,
    m.importance,
    m.project_id,
    m.meeting_id,
    m.source,
    m.created_at,
    (1 - (m.embedding <=> query_embedding))::FLOAT AS similarity
  FROM ai_memories m
  WHERE
    m.user_id = p_user_id
    AND m.is_active = true
    AND (m.expires_at IS NULL OR m.expires_at > NOW())
    AND m.embedding IS NOT NULL
    AND (1 - (m.embedding <=> query_embedding)) > match_threshold
    AND (filter_type IS NULL OR m.type = filter_type)
    AND (filter_project_id IS NULL OR m.project_id = filter_project_id)
  ORDER BY
    ((1 - (m.embedding <=> query_embedding)) * 0.7 + m.importance * 0.3) DESC
  LIMIT match_count;
END;
$$;
GRANT EXECUTE ON FUNCTION search_ai_memories(halfvec(3072), UUID, INT, FLOAT, TEXT, INT)
  TO anon, authenticated, service_role;
DROP FUNCTION IF EXISTS find_duplicate_memory(vector, uuid, text, float);
DROP FUNCTION IF EXISTS find_duplicate_memory(vector(1536), uuid, text, float);
DROP FUNCTION IF EXISTS find_duplicate_memory(halfvec, uuid, text, float);
DROP FUNCTION IF EXISTS find_duplicate_memory(halfvec(3072), uuid, text, float);
CREATE OR REPLACE FUNCTION find_duplicate_memory(
  query_embedding      halfvec(3072),
  p_user_id            UUID,
  p_type               TEXT,
  similarity_threshold FLOAT DEFAULT 0.88
)
RETURNS TABLE (
  id          UUID,
  content     TEXT,
  confidence  FLOAT,
  importance  FLOAT,
  similarity  FLOAT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  SET LOCAL hnsw.ef_search = 100;

  RETURN QUERY
  SELECT
    m.id,
    m.content,
    m.confidence,
    m.importance,
    (1 - (m.embedding <=> query_embedding))::FLOAT AS similarity
  FROM ai_memories m
  WHERE
    m.user_id = p_user_id
    AND m.type = p_type
    AND m.is_active = true
    AND (m.expires_at IS NULL OR m.expires_at > NOW())
    AND m.embedding IS NOT NULL
    AND (1 - (m.embedding <=> query_embedding)) > similarity_threshold
  ORDER BY m.embedding <=> query_embedding
  LIMIT 1;
END;
$$;
GRANT EXECUTE ON FUNCTION find_duplicate_memory(halfvec(3072), UUID, TEXT, FLOAT)
  TO anon, authenticated, service_role;
DROP FUNCTION IF EXISTS search_team_memories(vector, int, float, text);
DROP FUNCTION IF EXISTS search_team_memories(vector(1536), int, float, text);
DROP FUNCTION IF EXISTS search_team_memories(halfvec, int, float, text);
DROP FUNCTION IF EXISTS search_team_memories(halfvec(3072), int, float, text);
CREATE OR REPLACE FUNCTION search_team_memories(
  query_embedding   halfvec(3072),
  match_count       INT   DEFAULT 5,
  match_threshold   FLOAT DEFAULT 0.45,
  filter_type       TEXT  DEFAULT NULL
)
RETURNS TABLE (
  id          UUID,
  type        TEXT,
  content     TEXT,
  confidence  FLOAT,
  importance  FLOAT,
  project_id  INT,
  source      TEXT,
  created_at  TIMESTAMPTZ,
  similarity  FLOAT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  SET LOCAL hnsw.ef_search = 100;

  RETURN QUERY
  SELECT
    m.id,
    m.type,
    m.content,
    m.confidence,
    m.importance,
    m.project_id,
    m.source,
    m.created_at,
    (1 - (m.embedding <=> query_embedding))::FLOAT AS similarity
  FROM ai_memories m
  WHERE
    m.visibility = 'team'
    AND m.is_active = true
    AND (m.expires_at IS NULL OR m.expires_at > NOW())
    AND m.embedding IS NOT NULL
    AND (1 - (m.embedding <=> query_embedding)) > match_threshold
    AND (filter_type IS NULL OR m.type = filter_type)
  ORDER BY
    ((1 - (m.embedding <=> query_embedding)) * 0.7 + m.importance * 0.3) DESC
  LIMIT match_count;
END;
$$;
GRANT EXECUTE ON FUNCTION search_team_memories(halfvec(3072), INT, FLOAT, TEXT)
  TO anon, authenticated, service_role;
