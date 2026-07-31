-- PSR Comments: Project Status Report freetext notes per section per month
-- PMs can annotate any section of the PSR (budget line, change requests, general, etc.)

CREATE TABLE IF NOT EXISTS psr_comments (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id  INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  month       TEXT NOT NULL CHECK (month ~ '^[0-9]{4}-[0-9]{2}$'),
  section     TEXT NOT NULL,
  body        TEXT NOT NULL DEFAULT '',
  created_by  UUID REFERENCES auth.users(id),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(project_id, month, section)
);

CREATE INDEX idx_psr_comments_project_month ON psr_comments(project_id, month);

-- RLS: Allow authenticated users to read/write comments for projects they can access
ALTER TABLE psr_comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "psr_comments_select" ON psr_comments
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "psr_comments_insert" ON psr_comments
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "psr_comments_update" ON psr_comments
  FOR UPDATE USING (auth.uid() IS NOT NULL);
