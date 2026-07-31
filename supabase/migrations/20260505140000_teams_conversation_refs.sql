-- Teams Conversation Refs
-- Stores a serialized Thread JSON per user so we can send proactive messages
-- without requiring the user to initiate a conversation first.
-- One row per (user, is_dm) — upserted every time the user messages us.

CREATE TABLE IF NOT EXISTS teams_conversation_refs (
  id                BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  supabase_user_id  UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  thread_json       JSONB       NOT NULL,
  is_dm             BOOLEAN     NOT NULL DEFAULT true,
  last_seen_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE (supabase_user_id, is_dm)
);

CREATE INDEX IF NOT EXISTS idx_teams_conv_refs_user
  ON teams_conversation_refs(supabase_user_id);

ALTER TABLE teams_conversation_refs ENABLE ROW LEVEL SECURITY;

-- Bot uses service role (bypasses RLS). Users cannot directly read/write these.
-- No user-facing RLS policies needed — this is internal bot state.

COMMENT ON TABLE teams_conversation_refs IS
  'Serialized Teams thread JSON per user for proactive DM delivery. Upserted on every inbound message.';
