-- Drawing annotations support both the retired image-overlay viewer and the
-- canonical PDF.js Express viewer. Legacy rows retain image-space geometry in
-- `data`; PDF.js Express rows retain the vendor's XFDF payload in `xfdf`.
-- Keeping formats explicit prevents an image-coordinate shape from being
-- interpreted as PDF-page markup.
--
-- Geometry is stored in the viewer's image-pixel space inside `data` (the same
-- coordinate space the overlay draws in); the PDF is rendered to a stable
-- longest-side target so those coordinates reload consistently for a drawing.
--
-- `is_published` mirrors Procore's personal vs published markup layers: markup
-- is private to its author until published, after which the whole project can
-- see it.

CREATE TABLE drawing_annotations (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  drawing_id uuid NOT NULL REFERENCES drawings(id) ON DELETE CASCADE,
  project_id integer NOT NULL REFERENCES projects(id) ON DELETE CASCADE,

  page integer NOT NULL DEFAULT 1,

  -- Vendor subject or legacy shape type (for example Ink, Highlight, cloud).
  annotation_type text NOT NULL,

  -- `legacy_image` rows use image-pixel geometry in `data`. `xfdf` rows use
  -- the native PDF.js Express payload and a stable vendor annotation id.
  storage_format text NOT NULL DEFAULT 'legacy_image',
  annotation_id text,
  data jsonb,
  xfdf text,

  -- Personal (author-only) until published to the project.
  is_published boolean NOT NULL DEFAULT false,

  -- App identity can be supplied by a trusted SSO bridge and is not always a
  -- row in auth.users. The API owns author validation before service writes.
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT drawing_annotations_storage_format_check
    CHECK (storage_format IN ('legacy_image', 'xfdf')),
  CONSTRAINT drawing_annotations_payload_check
    CHECK (
      (storage_format = 'legacy_image' AND data IS NOT NULL)
      OR (
        storage_format = 'xfdf'
        AND annotation_id IS NOT NULL
        AND length(annotation_id) BETWEEN 1 AND 255
        AND xfdf IS NOT NULL
        AND length(xfdf) BETWEEN 1 AND 1048576
      )
    )
);

CREATE INDEX drawing_annotations_drawing_id_idx ON drawing_annotations(drawing_id);
CREATE INDEX drawing_annotations_project_id_idx ON drawing_annotations(project_id);
CREATE INDEX drawing_annotations_created_by_idx ON drawing_annotations(created_by);
CREATE UNIQUE INDEX drawing_annotations_xfdf_id_key
  ON drawing_annotations(drawing_id, annotation_id)
  WHERE annotation_id IS NOT NULL;

ALTER TABLE drawing_annotations ENABLE ROW LEVEL SECURITY;

-- Access is scoped to members of the drawing's project (matching the `drawings`
-- table's own membership boundary). Within a project a member sees published
-- markup plus their own personal (unpublished) markup; only the author can
-- create/update/delete, and only in projects they belong to. App admins see all.
CREATE POLICY "View project or own drawing annotations"
  ON drawing_annotations FOR SELECT
  TO authenticated
  USING (
    public.current_is_app_admin()
    OR (
      public.current_is_project_member(project_id)
      AND (is_published OR created_by = (select auth.uid()))
    )
  );

CREATE POLICY "Insert own drawing annotations in member projects"
  ON drawing_annotations FOR INSERT
  TO authenticated
  WITH CHECK (
    created_by = (select auth.uid())
    AND public.current_is_project_member(project_id)
  );

CREATE POLICY "Update own drawing annotations in member projects"
  ON drawing_annotations FOR UPDATE
  TO authenticated
  USING (
    created_by = (select auth.uid())
    AND public.current_is_project_member(project_id)
  )
  WITH CHECK (
    created_by = (select auth.uid())
    AND public.current_is_project_member(project_id)
  );

CREATE POLICY "Delete own drawing annotations in member projects"
  ON drawing_annotations FOR DELETE
  TO authenticated
  USING (
    created_by = (select auth.uid())
    AND public.current_is_project_member(project_id)
  );

CREATE POLICY "Service role full access to drawing annotations"
  ON drawing_annotations FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);
