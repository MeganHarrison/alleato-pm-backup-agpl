-- Bot debug log — durable per-checkpoint signal for diagnosing bot handler failures.
--
-- The Teams/Telegram bot handler runs as a waitUntil task scheduled during
-- chat.webhooks.teams(), which means console.logs inside the handler fire
-- AFTER the HTTP response is committed. Vercel routinely drops post-response
-- logs, so when handleMessage fails we lose all observability — we can see
-- the route hit but not why the handler died.
--
-- This table is written from inside the handler at every checkpoint so we can
-- query it directly to see exactly which step succeeded for each message.
-- No FKs (debug log shouldn't fail because a user record was deleted), no
-- RLS (service role only).

CREATE TABLE IF NOT EXISTS public.bot_debug_log (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at    timestamptz NOT NULL DEFAULT now(),
  platform      text        NOT NULL,
  checkpoint    text        NOT NULL,
  platform_user_id  text,
  supabase_user_id  uuid,
  thread_id     text,
  message_preview text,
  extra         jsonb       DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS bot_debug_log_created_at_idx
  ON public.bot_debug_log (created_at DESC);

CREATE INDEX IF NOT EXISTS bot_debug_log_platform_user_idx
  ON public.bot_debug_log (platform, platform_user_id, created_at DESC);

COMMENT ON TABLE public.bot_debug_log IS
  'Per-checkpoint diagnostic log for bot handlers. Bypasses Vercel post-response log capture.';
