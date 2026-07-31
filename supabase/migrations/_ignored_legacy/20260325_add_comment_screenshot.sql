ALTER TABLE admin_feedback_comments ADD COLUMN IF NOT EXISTS screenshot_url TEXT;
ALTER TABLE admin_feedback_comments ADD COLUMN IF NOT EXISTS screenshot_path TEXT;
