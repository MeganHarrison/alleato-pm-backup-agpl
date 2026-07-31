-- ============================================================================
-- Agent Learnings
-- Closed-loop learning layer for recurring agent mistakes, regressions, and
-- verified issue patterns.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.agent_learnings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  learning_key TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  source TEXT NOT NULL CHECK (
    source IN ('thumbs_down', 'admin_feedback', 'eval_failure')
  ),
  status TEXT NOT NULL DEFAULT 'candidate' CHECK (
    status IN ('candidate', 'active', 'archived')
  ),
  problem_signature TEXT NOT NULL,
  symptoms TEXT NOT NULL,
  root_cause TEXT,
  fix_pattern TEXT,
  prevention_prompt TEXT NOT NULL,
  scope_tags TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  page_path TEXT,
  tool_id INTEGER REFERENCES public.procore_tools(id) ON DELETE SET NULL,
  project_id INTEGER REFERENCES public.projects(id) ON DELETE SET NULL,
  occurrences INTEGER NOT NULL DEFAULT 1 CHECK (occurrences >= 1),
  confidence DOUBLE PRECISION NOT NULL DEFAULT 0.5 CHECK (confidence >= 0 AND confidence <= 1),
  evidence JSONB NOT NULL DEFAULT '[]'::JSONB,
  embedding halfvec(3072),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  activated_at TIMESTAMPTZ
);
COMMENT ON TABLE public.agent_learnings IS
  'Durable agent failure-prevention patterns promoted from feedback, eval failures, and resolved issues.';
COMMENT ON COLUMN public.agent_learnings.learning_key IS
  'Deterministic fingerprint used to merge repeated signals into the same learning.';
COMMENT ON COLUMN public.agent_learnings.prevention_prompt IS
  'Short instruction block injected into future prompts when this learning is relevant.';
CREATE INDEX IF NOT EXISTS idx_agent_learnings_status_last_seen
  ON public.agent_learnings(status, last_seen_at DESC);
CREATE INDEX IF NOT EXISTS idx_agent_learnings_tool
  ON public.agent_learnings(tool_id)
  WHERE tool_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_agent_learnings_project
  ON public.agent_learnings(project_id)
  WHERE project_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_agent_learnings_scope_tags
  ON public.agent_learnings
  USING GIN(scope_tags);
CREATE INDEX IF NOT EXISTS idx_agent_learnings_embedding
  ON public.agent_learnings
  USING hnsw (embedding halfvec_cosine_ops)
  WITH (m = 32, ef_construction = 200);
ALTER TABLE public.agent_learnings ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE policyname = 'Service role has full access to agent_learnings'
      AND tablename = 'agent_learnings'
  ) THEN
    CREATE POLICY "Service role has full access to agent_learnings"
      ON public.agent_learnings
      FOR ALL
      TO service_role
      USING (true)
      WITH CHECK (true);
  END IF;
END $$;
DROP TRIGGER IF EXISTS set_agent_learnings_updated_at ON public.agent_learnings;
CREATE TRIGGER set_agent_learnings_updated_at
  BEFORE UPDATE ON public.agent_learnings
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
CREATE TABLE IF NOT EXISTS public.agent_learning_usages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  learning_id UUID NOT NULL REFERENCES public.agent_learnings(id) ON DELETE CASCADE,
  session_id TEXT NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  outcome TEXT NOT NULL DEFAULT 'unknown' CHECK (
    outcome IN ('unknown', 'positive', 'negative')
  ),
  response_quality_score INTEGER,
  message_excerpt TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::JSONB
);
COMMENT ON TABLE public.agent_learning_usages IS
  'Tracks when agent learnings were injected into a session and whether the outcome was positive or negative.';
CREATE UNIQUE INDEX IF NOT EXISTS idx_agent_learning_usages_learning_session
  ON public.agent_learning_usages(learning_id, session_id);
CREATE INDEX IF NOT EXISTS idx_agent_learning_usages_session
  ON public.agent_learning_usages(session_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_agent_learning_usages_outcome
  ON public.agent_learning_usages(outcome, created_at DESC);
ALTER TABLE public.agent_learning_usages ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE policyname = 'Service role has full access to agent_learning_usages'
      AND tablename = 'agent_learning_usages'
  ) THEN
    CREATE POLICY "Service role has full access to agent_learning_usages"
      ON public.agent_learning_usages
      FOR ALL
      TO service_role
      USING (true)
      WITH CHECK (true);
  END IF;
END $$;
CREATE OR REPLACE FUNCTION public.search_agent_learnings(
  query_embedding halfvec(3072),
  match_count INT DEFAULT 5,
  match_threshold FLOAT DEFAULT 0.45,
  filter_project_id INT DEFAULT NULL,
  filter_tool_id INT DEFAULT NULL
)
RETURNS TABLE (
  id UUID,
  title TEXT,
  source TEXT,
  status TEXT,
  prevention_prompt TEXT,
  scope_tags TEXT[],
  tool_id INTEGER,
  project_id INTEGER,
  occurrences INTEGER,
  confidence DOUBLE PRECISION,
  similarity DOUBLE PRECISION
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT
    l.id,
    l.title,
    l.source,
    l.status,
    l.prevention_prompt,
    l.scope_tags,
    l.tool_id,
    l.project_id,
    l.occurrences,
    l.confidence,
    1 - (l.embedding <=> query_embedding) AS similarity
  FROM public.agent_learnings l
  WHERE
    l.status = 'active'
    AND l.embedding IS NOT NULL
    AND (filter_project_id IS NULL OR l.project_id IS NULL OR l.project_id = filter_project_id)
    AND (filter_tool_id IS NULL OR l.tool_id IS NULL OR l.tool_id = filter_tool_id)
    AND 1 - (l.embedding <=> query_embedding) > match_threshold
  ORDER BY
    CASE
      WHEN filter_project_id IS NOT NULL AND l.project_id = filter_project_id THEN 1
      ELSE 0
    END DESC,
    (
      (1 - (l.embedding <=> query_embedding)) * 0.65
      + LEAST(1.0, l.confidence) * 0.2
      + LEAST(1.0, l.occurrences::DOUBLE PRECISION / 5.0) * 0.15
    ) DESC,
    l.last_seen_at DESC
  LIMIT match_count;
END;
$$;
