-- Idempotency key for importing JobPlanner photos into project_photos.
-- The photos page reads project_photos; this column lets the JobPlanner photo
-- importer skip photos already imported and re-run safely.
ALTER TABLE public.project_photos
  ADD COLUMN IF NOT EXISTS jobplanner_photo_guid text;

CREATE UNIQUE INDEX IF NOT EXISTS uq_project_photos_jobplanner_guid
  ON public.project_photos (project_id, jobplanner_photo_guid)
  WHERE jobplanner_photo_guid IS NOT NULL;
