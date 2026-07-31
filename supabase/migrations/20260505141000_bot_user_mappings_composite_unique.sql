-- Fix bot_user_mappings unique constraint.
-- The original migration has UNIQUE(platform_user_id) only, but the upsert
-- in teams-chat.ts uses onConflict: "platform,platform_user_id".
-- Supabase requires the conflict target to match an actual unique constraint,
-- so this migration adds the composite constraint and removes the old one.

ALTER TABLE bot_user_mappings
  DROP CONSTRAINT IF EXISTS bot_user_mappings_platform_user_id_key;

ALTER TABLE bot_user_mappings
  ADD CONSTRAINT bot_user_mappings_platform_platform_user_id_key
  UNIQUE (platform, platform_user_id);
