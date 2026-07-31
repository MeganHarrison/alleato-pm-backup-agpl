-- Add video_url to test_results so testers can attach a recording link (e.g. Loom) to a failure.
ALTER TABLE test_results ADD COLUMN IF NOT EXISTS video_url text;
