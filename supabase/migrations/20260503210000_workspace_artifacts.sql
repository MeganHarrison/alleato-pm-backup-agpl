CREATE TABLE public.workspace_artifacts (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  project_id       INTEGER     REFERENCES public.projects(id) ON DELETE SET NULL,
  artifact_type    TEXT        NOT NULL,
  title            TEXT        NOT NULL,
  status           TEXT        NOT NULL DEFAULT 'draft',
  version          INTEGER     NOT NULL DEFAULT 1,
  content          JSONB       NOT NULL DEFAULT '{}',
  context_snapshot JSONB       NOT NULL DEFAULT '{}',
  session_id       TEXT,
  promoted_to      TEXT,
  promoted_at      TIMESTAMPTZ,
  embedding        HALFVEC(3072),
  tags             TEXT[]      NOT NULL DEFAULT '{}',
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_workspace_artifacts_user_id ON public.workspace_artifacts(user_id);
CREATE INDEX idx_workspace_artifacts_project ON public.workspace_artifacts(project_id);
CREATE INDEX idx_workspace_artifacts_status  ON public.workspace_artifacts(status);
CREATE INDEX idx_workspace_artifacts_type    ON public.workspace_artifacts(artifact_type);
CREATE INDEX idx_workspace_artifacts_updated ON public.workspace_artifacts(updated_at DESC);

CREATE INDEX idx_workspace_artifacts_embedding
  ON public.workspace_artifacts USING hnsw (embedding halfvec_cosine_ops)
  WITH (m = 16, ef_construction = 64);

CREATE OR REPLACE FUNCTION public.set_workspace_artifact_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_workspace_artifacts_updated_at
  BEFORE UPDATE ON public.workspace_artifacts
  FOR EACH ROW EXECUTE FUNCTION public.set_workspace_artifact_updated_at();

ALTER TABLE public.workspace_artifacts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read their own artifacts"
  ON public.workspace_artifacts FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own artifacts"
  ON public.workspace_artifacts FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own artifacts"
  ON public.workspace_artifacts FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own artifacts"
  ON public.workspace_artifacts FOR DELETE
  USING (auth.uid() = user_id);

CREATE POLICY "Service role full access"
  ON public.workspace_artifacts FOR ALL
  USING (auth.role() = 'service_role');

CREATE OR REPLACE FUNCTION public.search_workspace_artifacts(
  query_embedding  HALFVEC(3072),
  p_user_id        UUID,
  p_project_id     INTEGER DEFAULT NULL,
  p_status         TEXT    DEFAULT NULL,
  match_count      INTEGER DEFAULT 5,
  match_threshold  FLOAT   DEFAULT 0.35
)
RETURNS TABLE (
  id               UUID,
  artifact_type    TEXT,
  title            TEXT,
  status           TEXT,
  version          INTEGER,
  content          JSONB,
  context_snapshot JSONB,
  session_id       TEXT,
  promoted_to      TEXT,
  tags             TEXT[],
  updated_at       TIMESTAMPTZ,
  similarity       FLOAT
)
LANGUAGE sql STABLE AS $$
  SELECT
    wa.id,
    wa.artifact_type,
    wa.title,
    wa.status,
    wa.version,
    wa.content,
    wa.context_snapshot,
    wa.session_id,
    wa.promoted_to,
    wa.tags,
    wa.updated_at,
    1 - (wa.embedding <=> query_embedding) AS similarity
  FROM public.workspace_artifacts wa
  WHERE
    wa.user_id = p_user_id
    AND (p_project_id IS NULL OR wa.project_id = p_project_id)
    AND (p_status IS NULL OR wa.status = p_status)
    AND wa.embedding IS NOT NULL
    AND 1 - (wa.embedding <=> query_embedding) >= match_threshold
  ORDER BY wa.embedding <=> query_embedding
  LIMIT match_count;
$$;
