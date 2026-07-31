-- ==========================================================================
-- Prime Contract PCO Attachments
-- ==========================================================================
-- Adds persistent attachment storage metadata for Prime Contract Potential
-- Change Orders (PCOs). Files are expected to live in Supabase Storage
-- (typically the existing "project-files" bucket), while this table stores
-- relational metadata and audit fields.
--
-- Notes:
-- - This migration adds database support only (no UI/API wiring).
-- - RLS is project-scoped through prime_contract_pcos.project_id.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.prime_contract_pco_attachments (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pco_id       uuid NOT NULL
    REFERENCES public.prime_contract_pcos(id) ON DELETE CASCADE,
  file_name    varchar NOT NULL,
  file_path    text NOT NULL,
  file_size    bigint NOT NULL CHECK (file_size >= 0),
  mime_type    varchar NOT NULL,
  uploaded_by  uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  uploaded_at  timestamptz NOT NULL DEFAULT now()
);
COMMENT ON TABLE public.prime_contract_pco_attachments IS
  'File attachments for Prime Contract Potential Change Orders (PCOs). Files are stored in Supabase Storage; metadata is stored here.';
COMMENT ON COLUMN public.prime_contract_pco_attachments.file_path IS
  'Path/key in Supabase Storage bucket (for example: project-files/<project>/<pco>/<filename>).';
COMMENT ON COLUMN public.prime_contract_pco_attachments.uploaded_by IS
  'Auth user who uploaded the file; null if uploader was removed.';
CREATE INDEX IF NOT EXISTS idx_prime_contract_pco_attachments_pco_id
  ON public.prime_contract_pco_attachments (pco_id, uploaded_at DESC);
CREATE INDEX IF NOT EXISTS idx_prime_contract_pco_attachments_uploaded_by
  ON public.prime_contract_pco_attachments (uploaded_by);
ALTER TABLE public.prime_contract_pco_attachments ENABLE ROW LEVEL SECURITY;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'prime_contract_pco_attachments'
      AND policyname = 'prime_contract_pco_attachments_select'
  ) THEN
    CREATE POLICY prime_contract_pco_attachments_select
      ON public.prime_contract_pco_attachments
      FOR SELECT
      TO authenticated
      USING (
        auth.uid() IS NOT NULL
        AND (
          public.current_is_app_admin()
          OR EXISTS (
            SELECT 1
            FROM public.prime_contract_pcos p
            WHERE p.id = prime_contract_pco_attachments.pco_id
              AND public.current_is_project_member(p.project_id::bigint)
          )
        )
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'prime_contract_pco_attachments'
      AND policyname = 'prime_contract_pco_attachments_insert'
  ) THEN
    CREATE POLICY prime_contract_pco_attachments_insert
      ON public.prime_contract_pco_attachments
      FOR INSERT
      TO authenticated
      WITH CHECK (
        auth.uid() IS NOT NULL
        AND (
          uploaded_by IS NULL OR uploaded_by = auth.uid()
        )
        AND (
          public.current_is_app_admin()
          OR EXISTS (
            SELECT 1
            FROM public.prime_contract_pcos p
            WHERE p.id = prime_contract_pco_attachments.pco_id
              AND public.current_is_project_member(p.project_id::bigint)
          )
        )
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'prime_contract_pco_attachments'
      AND policyname = 'prime_contract_pco_attachments_delete'
  ) THEN
    CREATE POLICY prime_contract_pco_attachments_delete
      ON public.prime_contract_pco_attachments
      FOR DELETE
      TO authenticated
      USING (
        auth.uid() IS NOT NULL
        AND (
          public.current_is_app_admin()
          OR EXISTS (
            SELECT 1
            FROM public.prime_contract_pcos p
            WHERE p.id = prime_contract_pco_attachments.pco_id
              AND public.current_is_project_member(p.project_id::bigint)
          )
        )
      );
  END IF;
END $$;
