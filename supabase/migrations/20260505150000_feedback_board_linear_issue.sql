-- Add linear_issue_id to admin_feedback_items so product-board cards can link to Linear issues.
ALTER TABLE admin_feedback_items
  ADD COLUMN IF NOT EXISTS linear_issue_id TEXT;
