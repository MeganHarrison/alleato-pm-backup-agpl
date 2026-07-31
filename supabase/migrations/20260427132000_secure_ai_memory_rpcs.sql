-- Secure AI memory RPCs against cross-user reads/writes.
--
-- Why:
-- - Several memory RPCs are SECURITY DEFINER and accept `p_user_id`, which can
--   be abused if RLS is bypassed by the definer role.
-- - The app calls these RPCs server-side with the service role client, but we
--   also grant EXECUTE to authenticated users. Make the contract safe even if
--   someone calls the RPC directly.

set statement_timeout = 0;
set lock_timeout = '5min';

BEGIN;

-- ---------------------------------------------------------------------------
-- search_ai_memories (private per-user memories)
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.search_ai_memories(
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
  -- Only the service role can query other users' memories.
  IF auth.role() <> 'service_role' AND auth.uid() IS DISTINCT FROM p_user_id THEN
    RAISE EXCEPTION 'Not authorized to read other users'' memories';
  END IF;

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
  FROM public.ai_memories m
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

-- ---------------------------------------------------------------------------
-- find_duplicate_memory (private per-user dedupe)
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.find_duplicate_memory(
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
  -- Only the service role can query other users' memories.
  IF auth.role() <> 'service_role' AND auth.uid() IS DISTINCT FROM p_user_id THEN
    RAISE EXCEPTION 'Not authorized to read other users'' memories';
  END IF;

  SET LOCAL hnsw.ef_search = 100;

  RETURN QUERY
  SELECT
    m.id,
    m.content,
    m.confidence,
    m.importance,
    (1 - (m.embedding <=> query_embedding))::FLOAT AS similarity
  FROM public.ai_memories m
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

-- ---------------------------------------------------------------------------
-- search_team_memories (shared team memories)
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.search_team_memories(
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
  -- Team memories should never be accessible to anon.
  IF auth.role() NOT IN ('authenticated', 'service_role') THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

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
  FROM public.ai_memories m
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

-- ---------------------------------------------------------------------------
-- touch_ai_memories (usage tracking)
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.touch_ai_memories(memory_ids UUID[])
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.role() = 'service_role' THEN
    UPDATE public.ai_memories
    SET
      last_accessed_at = NOW(),
      access_count = access_count + 1
    WHERE id = ANY(memory_ids);
    RETURN;
  END IF;

  -- Authenticated users may only touch their own memory rows.
  UPDATE public.ai_memories
  SET
    last_accessed_at = NOW(),
    access_count = access_count + 1
  WHERE id = ANY(memory_ids)
    AND user_id = auth.uid();
END;
$$;

-- Tighten EXECUTE grants: these are callable by the app (server-side) and by
-- authenticated users only. They should not be callable by anon/PUBLIC.
REVOKE ALL ON FUNCTION public.search_ai_memories(halfvec(3072), UUID, INT, FLOAT, TEXT, INT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.search_ai_memories(halfvec(3072), UUID, INT, FLOAT, TEXT, INT) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.find_duplicate_memory(halfvec(3072), UUID, TEXT, FLOAT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.find_duplicate_memory(halfvec(3072), UUID, TEXT, FLOAT) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.search_team_memories(halfvec(3072), INT, FLOAT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.search_team_memories(halfvec(3072), INT, FLOAT, TEXT) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.touch_ai_memories(UUID[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.touch_ai_memories(UUID[]) TO authenticated, service_role;

COMMIT;
