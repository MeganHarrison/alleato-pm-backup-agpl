-- Persist AI review results on submittals so they survive page refresh
ALTER TABLE submittals
  ADD COLUMN IF NOT EXISTS ai_review_result JSONB,
  ADD COLUMN IF NOT EXISTS ai_review_ran_at TIMESTAMPTZ;
