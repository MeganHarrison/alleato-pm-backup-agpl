-- ============================================================================
-- AI Memories
-- Typed, user-scoped, vector-searchable memory for the AI assistant.
--
-- Five memory types:
--   fact        - Objective facts about projects, people, the company
--   preference  - How a user likes information presented
--   lesson      - Patterns worth remembering across projects
--   commitment  - Specific commitments that need tracking
--   context     - Situational context worth carrying into future sessions
--
-- Memories are auto-extracted post-conversation, written mid-conversation by
-- the AI via the writeMemory tool, and auto-injected into every new session.
-- ============================================================================

CREATE TABLE IF NOT EXISTS ai_memories (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Core content
  type           TEXT        NOT NULL CHECK (type IN ('fact', 'preference', 'lesson', 'commitment', 'context')),
  content        TEXT        NOT NULL,
  embedding      vector(1536),

  -- Structural links (the Supabase advantage over file-based systems)
  project_id     INTEGER     REFERENCES projects(id) ON DELETE SET NULL,
  meeting_id     TEXT        REFERENCES document_metadata(id) ON DELETE SET NULL,

  -- Quality signals
  confidence     FLOAT       NOT NULL DEFAULT 0.9 CHECK (confidence >= 0 AND confidence <= 1),
  importance     FLOAT       NOT NULL DEFAULT 0.5 CHECK (importance >= 0 AND importance <= 1),

  -- Provenance
  source         TEXT        NOT NULL DEFAULT 'conversation'
                   CHECK (source IN ('conversation', 'extraction', 'meeting_ingest', 'manual')),

  -- Lifecycle
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_accessed_at TIMESTAMPTZ,
  access_count   INTEGER     NOT NULL DEFAULT 0,
  expires_at     TIMESTAMPTZ,           -- NULL = permanent; context memories get 30-day TTL

  -- Versioning: when a fact changes, old row points to new one
  superseded_by  UUID        REFERENCES ai_memories(id) ON DELETE SET NULL,
  is_active      BOOLEAN     NOT NULL DEFAULT TRUE
);
-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------

ALTER TABLE ai_memories ENABLE ROW LEVEL SECURITY;
-- Users can read/write their own memories
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can manage their own memories' AND tablename = 'ai_memories') THEN
    CREATE POLICY "Users can manage their own memories"
      ON ai_memories FOR ALL
      USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;
-- Service role (used by API routes) has full access
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Service role has full access to ai_memories' AND tablename = 'ai_memories') THEN
    CREATE POLICY "Service role has full access to ai_memories"
      ON ai_memories FOR ALL
      TO service_role
      USING (true)
      WITH CHECK (true);
  END IF;
END $$;
-- ---------------------------------------------------------------------------
-- Indexes
-- ---------------------------------------------------------------------------

-- Primary lookup: active memories for a user
CREATE INDEX IF NOT EXISTS idx_ai_memories_user_active
  ON ai_memories (user_id, is_active)
  WHERE is_active = true;
-- Type-filtered queries (e.g. fetch all preferences for a user)
CREATE INDEX IF NOT EXISTS idx_ai_memories_user_type
  ON ai_memories (user_id, type)
  WHERE is_active = true;
-- Project-scoped lookups
CREATE INDEX IF NOT EXISTS idx_ai_memories_project
  ON ai_memories (project_id)
  WHERE project_id IS NOT NULL;
-- Vector similarity search (cosine distance)
CREATE INDEX IF NOT EXISTS idx_ai_memories_embedding
  ON ai_memories USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 50);
-- Expiry cleanup queries
CREATE INDEX IF NOT EXISTS idx_ai_memories_expires
  ON ai_memories (expires_at)
  WHERE expires_at IS NOT NULL;
-- ---------------------------------------------------------------------------
-- RPC: Semantic search
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION search_ai_memories(
  query_embedding   vector(1536),
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
    m.meeting_id,
    m.source,
    m.created_at,
    1 - (m.embedding <=> query_embedding) AS similarity
  FROM ai_memories m
  WHERE
    m.user_id = p_user_id
    AND m.is_active = true
    AND (m.expires_at IS NULL OR m.expires_at > NOW())
    AND m.embedding IS NOT NULL
    AND 1 - (m.embedding <=> query_embedding) > match_threshold
    AND (filter_type IS NULL OR m.type = filter_type)
    AND (filter_project_id IS NULL OR m.project_id = filter_project_id)
  ORDER BY
    -- Blend similarity with importance so high-importance memories surface even at lower similarity
    (1 - (m.embedding <=> query_embedding)) * 0.7 + m.importance * 0.3 DESC
  LIMIT match_count;
END;
$$;
-- ---------------------------------------------------------------------------
-- RPC: Mark memories accessed (call after injection to track usage)
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION touch_ai_memories(memory_ids UUID[])
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE ai_memories
  SET
    last_accessed_at = NOW(),
    access_count = access_count + 1
  WHERE id = ANY(memory_ids);
END;
$$;
-- ---------------------------------------------------------------------------
-- RPC: Expire stale context memories (run periodically or at session start)
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION expire_ai_memories()
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  expired_count INT;
BEGIN
  UPDATE ai_memories
  SET is_active = false
  WHERE expires_at IS NOT NULL
    AND expires_at <= NOW()
    AND is_active = true;

  GET DIAGNOSTICS expired_count = ROW_COUNT;
  RETURN expired_count;
END;
$$;
