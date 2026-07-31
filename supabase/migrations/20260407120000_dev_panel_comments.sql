-- Dev Panel Comments
-- Thread-based comments attached to a feature slug, visible in the bottom dev panel.
-- Supports @mentions of team members, @Codex, and @ClaudeCode.

CREATE TABLE IF NOT EXISTS dev_panel_comments (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  feature       TEXT        NOT NULL,             -- e.g. 'budget', 'commitments'
  page_url      TEXT,                             -- optional specific page for context
  author_id     UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
  author_name   TEXT        NOT NULL,
  author_email  TEXT,
  content       TEXT        NOT NULL,
  mentions      TEXT[]      NOT NULL DEFAULT '{}', -- ['@Codex', '@ClaudeCode', '@username']
  parent_id     UUID        REFERENCES dev_panel_comments(id) ON DELETE CASCADE,
  resolved      BOOLEAN     NOT NULL DEFAULT FALSE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS dev_panel_comments_feature_idx ON dev_panel_comments (feature);
CREATE INDEX IF NOT EXISTS dev_panel_comments_parent_idx  ON dev_panel_comments (parent_id);
-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_dev_panel_comments_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;
CREATE TRIGGER dev_panel_comments_updated_at
  BEFORE UPDATE ON dev_panel_comments
  FOR EACH ROW EXECUTE FUNCTION update_dev_panel_comments_updated_at();
-- RLS: authenticated users can read all, write their own
ALTER TABLE dev_panel_comments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "dev_panel_comments_read"  ON dev_panel_comments FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "dev_panel_comments_insert" ON dev_panel_comments FOR INSERT WITH CHECK (auth.uid() = author_id OR author_id IS NULL);
CREATE POLICY "dev_panel_comments_update" ON dev_panel_comments FOR UPDATE USING (auth.uid() = author_id);
CREATE POLICY "dev_panel_comments_delete" ON dev_panel_comments FOR DELETE USING (auth.uid() = author_id);
