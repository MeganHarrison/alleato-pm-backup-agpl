-- Link Outlook intake rows to document_metadata so PostgREST schema cache can
-- understand the relationship and new writes cannot point at missing metadata.

set statement_timeout = 0;
set lock_timeout = '5min';

BEGIN;

CREATE INDEX IF NOT EXISTS idx_outlook_email_intake_document_metadata
  ON public.outlook_email_intake(document_metadata_id)
  WHERE document_metadata_id IS NOT NULL AND deleted_at IS NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'outlook_email_intake_document_metadata_id_fkey'
      AND conrelid = 'public.outlook_email_intake'::regclass
  ) THEN
    ALTER TABLE public.outlook_email_intake
      ADD CONSTRAINT outlook_email_intake_document_metadata_id_fkey
      FOREIGN KEY (document_metadata_id)
      REFERENCES public.document_metadata(id)
      ON DELETE SET NULL
      NOT VALID;
  END IF;
END $$;

NOTIFY pgrst, 'reload schema';

COMMIT;
