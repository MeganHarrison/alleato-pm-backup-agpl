ALTER TABLE public.daily_logs
ADD COLUMN IF NOT EXISTS site_management_checklist jsonb;

COMMENT ON COLUMN public.daily_logs.site_management_checklist IS
  'Structured daily site management checklist responses for superintendent and site lead daily submissions.';
