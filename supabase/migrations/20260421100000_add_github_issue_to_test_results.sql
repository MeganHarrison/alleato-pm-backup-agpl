-- Add GitHub issue tracking columns to test_results so failures can be
-- automatically linked to GitHub issues (mirrors admin_feedback_items pattern).
ALTER TABLE test_results
  ADD COLUMN IF NOT EXISTS github_issue_number integer,
  ADD COLUMN IF NOT EXISTS github_issue_url    text,
  ADD COLUMN IF NOT EXISTS github_issue_state  text;
