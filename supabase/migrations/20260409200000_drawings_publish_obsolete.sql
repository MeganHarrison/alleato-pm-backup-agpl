-- Add published/obsolete workflow columns to drawings
ALTER TABLE drawings
  ADD COLUMN IF NOT EXISTS is_published boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS is_obsolete  boolean NOT NULL DEFAULT false;
-- Index for efficient filtering
CREATE INDEX IF NOT EXISTS idx_drawings_is_published ON drawings (is_published);
CREATE INDEX IF NOT EXISTS idx_drawings_is_obsolete  ON drawings (is_obsolete);
-- Drop and recreate drawing_log view to include is_published and is_obsolete
DROP VIEW IF EXISTS public.drawing_log;
CREATE VIEW public.drawing_log AS
 SELECT d.id,
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
    dr.id AS revision_id,
    dr.revision_number,
    dr.drawing_date,
    dr.received_date,
    dr.status,
    dr.file_url,
    dr.file_name,
    dr.file_size,
    dr.file_type,
    dr.description AS revision_description,
    dr.uploaded_by,
    dr.created_at AS revision_created_at,
    da.name AS area_name,
    ds.name AS set_name,
    u.email AS uploaded_by_email
   FROM drawings d
     LEFT JOIN drawing_revisions dr ON dr.id = d.current_revision_id
     LEFT JOIN drawing_areas da ON da.id = d.area_id
     LEFT JOIN drawing_sets ds ON ds.id = dr.drawing_set_id
     LEFT JOIN auth.users u ON u.id = dr.uploaded_by;
