-- ============================================================================
-- CREATE PUNCH ITEM ATTACHMENTS TABLE
-- ============================================================================
-- Stores file attachments for punch items (photos, documents, etc.)
-- Files live in Supabase Storage bucket "punch-item-attachments".
-- RLS mirrors punch_items: project membership required.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.punch_item_attachments (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  punch_item_id    UUID NOT NULL REFERENCES public.punch_items(id) ON DELETE CASCADE,
  project_id       INTEGER NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,

  -- Storage reference
  storage_path     TEXT NOT NULL,          -- relative path inside bucket
  file_name        TEXT NOT NULL,          -- original filename for display
  content_type     TEXT,                   -- MIME type
  size_bytes       BIGINT,                 -- file size

  -- Audit
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_punch_item_attachments_item
  ON public.punch_item_attachments(punch_item_id);

CREATE INDEX IF NOT EXISTS idx_punch_item_attachments_project
  ON public.punch_item_attachments(project_id);

-- RLS
ALTER TABLE public.punch_item_attachments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "punch_item_attachments_select" ON public.punch_item_attachments;
DROP POLICY IF EXISTS "punch_item_attachments_insert" ON public.punch_item_attachments;
DROP POLICY IF EXISTS "punch_item_attachments_delete" ON public.punch_item_attachments;

CREATE POLICY "punch_item_attachments_select" ON public.punch_item_attachments
  FOR SELECT TO authenticated
  USING (
    project_id IN (
      SELECT pdm.project_id
      FROM public.project_directory_memberships pdm
      JOIN public.users_auth ua ON ua.person_id = pdm.person_id
      WHERE ua.auth_user_id = auth.uid()
    )
  );

CREATE POLICY "punch_item_attachments_insert" ON public.punch_item_attachments
  FOR INSERT TO authenticated
  WITH CHECK (
    project_id IN (
      SELECT pdm.project_id
      FROM public.project_directory_memberships pdm
      JOIN public.users_auth ua ON ua.person_id = pdm.person_id
      WHERE ua.auth_user_id = auth.uid()
    )
  );

CREATE POLICY "punch_item_attachments_delete" ON public.punch_item_attachments
  FOR DELETE TO authenticated
  USING (created_by = auth.uid());
