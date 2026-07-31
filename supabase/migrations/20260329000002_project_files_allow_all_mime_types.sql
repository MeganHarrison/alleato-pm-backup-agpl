-- Allow all MIME types in the project-files storage bucket.
-- Keep this in source control so local/dev/prod environments stay consistent.
UPDATE storage.buckets
SET allowed_mime_types = NULL
WHERE id = 'project-files';
