-- Add the Leadership review lane to the product board workflow.
-- Keep this constraint aligned with frontend/src/lib/admin-feedback/constants.ts.

ALTER TABLE admin_feedback_items
  DROP CONSTRAINT IF EXISTS admin_feedback_items_board_status_check;

ALTER TABLE admin_feedback_items
  ADD CONSTRAINT admin_feedback_items_board_status_check
  CHECK (board_status IN (
    'submitted',
    'planned',
    'in_progress',
    'leadership_review',
    'shipped'
  ));
