-- Add pin support to AI assistant conversations.
-- Lets users pin important chat threads to the top of the history sidebar,
-- mirroring the Claude desktop "Pinned" section.

ALTER TABLE public.conversations
  ADD COLUMN IF NOT EXISTS is_pinned boolean NOT NULL DEFAULT false;

-- Order pinned threads first within each user's list.
CREATE INDEX IF NOT EXISTS conversations_user_pinned_idx
  ON public.conversations (user_id, is_pinned DESC, last_message_at DESC NULLS LAST);
