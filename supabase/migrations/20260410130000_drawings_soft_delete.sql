-- Add soft-delete columns to drawings table
ALTER TABLE drawings
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS deleted_by uuid DEFAULT NULL REFERENCES auth.users(id);
-- Index for efficient filtering of non-deleted drawings
CREATE INDEX IF NOT EXISTS idx_drawings_deleted_at ON drawings(deleted_at) WHERE deleted_at IS NULL;
-- Recreate the drawing_log view to include deleted_at column
-- Must DROP first because CREATE OR REPLACE cannot change column order
DROP VIEW IF EXISTS drawing_log;
CREATE VIEW drawing_log AS
SELECT
  d.id,
  d.project_id,
  d.area_id,
  d.drawing_number,
  d.title,
  d.discipline,
  d.drawing_type,
  d.is_published,
  d.is_obsolete,
  d.created_at AS drawing_created_at,
  d.updated_at AS drawing_updated_at,
  d.deleted_at,
  d.deleted_by,
  r.id AS revision_id,
  r.revision_number,
  r.drawing_date,
  r.received_date,
  r.status,
  r.file_url,
  r.file_name,
  r.file_size,
  r.file_type,
  r.description AS revision_description,
  r.uploaded_by,
  r.created_at AS revision_created_at,
  da.name AS area_name,
  ds.name AS set_name,
  u.email AS uploaded_by_email
FROM drawings d
LEFT JOIN drawing_revisions r ON r.id = d.current_revision_id
LEFT JOIN drawing_areas da ON da.id = d.area_id
LEFT JOIN drawing_sets ds ON ds.id = r.drawing_set_id
LEFT JOIN auth.users u ON u.id = r.uploaded_by;
