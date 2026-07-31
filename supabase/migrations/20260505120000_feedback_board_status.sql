-- Add board_status column to admin_feedback_items for the product board kanban view.
-- Separate from the existing `status` field (which tracks bug workflow state).
-- Only meaningful for feature_request items.
ALTER TABLE admin_feedback_items
  ADD COLUMN IF NOT EXISTS board_status TEXT NOT NULL DEFAULT 'submitted'
    CHECK (board_status IN ('submitted', 'planned', 'in_progress', 'shipped'));

-- Expand request_type constraint to allow feature_request
ALTER TABLE admin_feedback_items
  DROP CONSTRAINT IF EXISTS admin_feedback_items_request_type_check;

ALTER TABLE admin_feedback_items
  ADD CONSTRAINT admin_feedback_items_request_type_check
  CHECK (request_type IN ('bug', 'change_request', 'copy', 'question', 'feature_request'));

-- Index for fast column queries on the board
CREATE INDEX IF NOT EXISTS idx_admin_feedback_board
  ON admin_feedback_items (request_type, board_status)
  WHERE request_type = 'feature_request';
