-- ============================================================================
-- AI Memories Enhancements
-- 1. Visibility: private | team  (shared vs personal memories)
-- 2. Duplicate-search RPC  (deduplication before insert)
-- 3. Confidence decay function  (weekly cron target)
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. Visibility column
-- ---------------------------------------------------------------------------

ALTER TABLE ai_memories
  ADD COLUMN IF NOT EXISTS visibility TEXT NOT NULL DEFAULT 'private'
    CHECK (visibility IN ('private', 'team'));
-- Index for fetching team-visible memories efficiently
CREATE INDEX IF NOT EXISTS idx_ai_memories_team
  ON ai_memories (visibility, type, is_active)
  WHERE visibility = 'team' AND is_active = true;
-- ---------------------------------------------------------------------------
-- 2. Deduplication: find the closest existing memory before inserting
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION find_duplicate_memory(
  query_embedding   vector(1536),
  p_user_id         UUID,
  p_type            TEXT,
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
AS $$
BEGIN
  RETURN QUERY
  SELECT
    m.id,
    m.content,
    m.confidence,
    m.importance,
    1 - (m.embedding <=> query_embedding) AS similarity
  FROM ai_memories m
  WHERE
    m.user_id = p_user_id
    AND m.type = p_type
    AND m.is_active = true
    AND (m.expires_at IS NULL OR m.expires_at > NOW())
    AND m.embedding IS NOT NULL
    AND 1 - (m.embedding <=> query_embedding) > similarity_threshold
  ORDER BY m.embedding <=> query_embedding
  LIMIT 1;
END;
$$;
-- ---------------------------------------------------------------------------
-- 3. Team memory search (no user_id filter — returns team-wide memories)
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION search_team_memories(
  query_embedding   vector(1536),
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
AS $$
BEGIN
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
    1 - (m.embedding <=> query_embedding) AS similarity
  FROM ai_memories m
  WHERE
    m.visibility = 'team'
    AND m.is_active = true
    AND (m.expires_at IS NULL OR m.expires_at > NOW())
    AND m.embedding IS NOT NULL
    AND 1 - (m.embedding <=> query_embedding) > match_threshold
    AND (filter_type IS NULL OR m.type = filter_type)
  ORDER BY
    (1 - (m.embedding <=> query_embedding)) * 0.7 + m.importance * 0.3 DESC
  LIMIT match_count;
END;
$$;
-- ---------------------------------------------------------------------------
-- 4. Confidence decay (run weekly via cron)
-- Decrements importance by 5% on facts/lessons older than 90 days
-- that haven't been accessed since creation.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION decay_memory_confidence()
RETURNS TABLE (decayed_count INT, expired_count INT)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_decayed INT;
  v_expired INT;
BEGIN
  -- Decay importance on stale high-confidence facts and lessons
  UPDATE ai_memories
  SET
    importance  = GREATEST(0.1, importance * 0.95),
    confidence  = GREATEST(0.3, confidence * 0.97)
  WHERE
    type IN ('fact', 'lesson')
    AND is_active = true
    AND created_at < NOW() - INTERVAL '90 days'
    AND (last_accessed_at IS NULL OR last_accessed_at < NOW() - INTERVAL '60 days')
    AND access_count < 3;

  GET DIAGNOSTICS v_decayed = ROW_COUNT;

  -- Expire context memories past their TTL (belt-and-suspenders)
  UPDATE ai_memories
  SET is_active = false
  WHERE
    expires_at IS NOT NULL
    AND expires_at <= NOW()
    AND is_active = true;

  GET DIAGNOSTICS v_expired = ROW_COUNT;

  RETURN QUERY SELECT v_decayed, v_expired;
END;
$$;
