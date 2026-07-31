-- Add missing columns for the product board kanban feature.
-- board_status was added in 20260505120000; these complete the set.

ALTER TABLE admin_feedback_items
  ADD COLUMN IF NOT EXISTS position        INTEGER,
  ADD COLUMN IF NOT EXISTS assignee_id     UUID REFERENCES user_profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS screenshot_url  TEXT;

-- Index for assignee lookups
CREATE INDEX IF NOT EXISTS idx_admin_feedback_assignee
  ON admin_feedback_items (assignee_id)
  WHERE assignee_id IS NOT NULL;
