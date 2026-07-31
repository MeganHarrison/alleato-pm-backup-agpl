-- Training docs store screenshot assets in the existing documents bucket.
-- Keep the bucket allowlist source-controlled so the admin upload workflow
-- does not fail at runtime for image screenshots.

UPDATE storage.buckets
SET allowed_mime_types = ARRAY[
  'text/plain',
  'text/markdown',
  'text/csv',
  'text/tab-separated-values',
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/octet-stream',
  'image/png',
  'image/jpeg',
  'image/webp'
]::text[]
WHERE id = 'documents';
