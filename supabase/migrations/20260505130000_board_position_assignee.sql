-- Add position for within-column drag ordering and assignee for card ownership
ALTER TABLE admin_feedback_items
  ADD COLUMN IF NOT EXISTS position FLOAT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS assignee_id UUID REFERENCES user_profiles(id) ON DELETE SET NULL;

-- Initialise positions for existing feature_request cards
WITH ranked AS (
  SELECT id,
    ROW_NUMBER() OVER (
      PARTITION BY board_status
      ORDER BY created_at
    ) * 1000.0 AS new_position
  FROM admin_feedback_items
  WHERE request_type = 'feature_request'
)
UPDATE admin_feedback_items afi
SET position = ranked.new_position
FROM ranked
WHERE afi.id = ranked.id;

CREATE INDEX IF NOT EXISTS idx_admin_feedback_board_position
  ON admin_feedback_items (board_status, position)
  WHERE request_type = 'feature_request';
