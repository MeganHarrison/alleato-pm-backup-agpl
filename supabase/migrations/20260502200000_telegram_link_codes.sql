-- Telegram link codes
-- Short-lived tokens that let a Telegram user prove they own an Alleato account.
-- Flow: app generates code → user sends /start <code> to bot → bot inserts bot_user_mappings row.

CREATE TABLE IF NOT EXISTS telegram_link_codes (
  id            BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  code          TEXT        NOT NULL UNIQUE,
  user_id       UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  expires_at    TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '10 minutes'),
  used_at       TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_telegram_link_codes_code
  ON telegram_link_codes(code)
  WHERE used_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_telegram_link_codes_user_id
  ON telegram_link_codes(user_id);

-- RLS: users can only read their own codes (bot uses service role, bypasses RLS)
ALTER TABLE telegram_link_codes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read their own link codes"
  ON telegram_link_codes FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Users can insert their own link codes"
  ON telegram_link_codes FOR INSERT
  WITH CHECK (user_id = auth.uid());

-- Auto-cleanup expired codes daily (optional; codes expire via expires_at check)
COMMENT ON TABLE telegram_link_codes IS 'Short-lived codes for linking Telegram accounts to Alleato users. Expire after 10 minutes.';
