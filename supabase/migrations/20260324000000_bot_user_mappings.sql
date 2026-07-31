-- Bot User Mappings
-- Maps external platform user IDs (Slack, Teams, Telegram) to Supabase auth users.
-- This allows the AI agent on external channels to query data scoped to the correct user.

CREATE TABLE IF NOT EXISTS bot_user_mappings (
  id            BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  platform      TEXT NOT NULL,              -- 'slack', 'teams', 'telegram'
  platform_user_id TEXT NOT NULL,           -- e.g. 'slack:U12345ABC'
  supabase_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name  TEXT,                       -- optional cached display name
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE (platform_user_id)
);
-- Index for fast lookups by platform user ID
CREATE INDEX IF NOT EXISTS idx_bot_user_mappings_platform_user_id
  ON bot_user_mappings(platform_user_id);
-- Index for looking up all mappings for a Supabase user
CREATE INDEX IF NOT EXISTS idx_bot_user_mappings_supabase_user_id
  ON bot_user_mappings(supabase_user_id);
-- RLS: only authenticated users can read/write their own mappings
ALTER TABLE bot_user_mappings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can read their own mappings"
  ON bot_user_mappings FOR SELECT
  USING (supabase_user_id = auth.uid());
CREATE POLICY "Users can insert their own mappings"
  ON bot_user_mappings FOR INSERT
  WITH CHECK (supabase_user_id = auth.uid());
CREATE POLICY "Users can update their own mappings"
  ON bot_user_mappings FOR UPDATE
  USING (supabase_user_id = auth.uid());
-- Service role bypasses RLS, so the bot (using createServiceClient) can
-- read any mapping without restrictions.

COMMENT ON TABLE bot_user_mappings IS 'Maps external chat platform users to Supabase auth users for the multi-channel AI agent.';
