-- Clean up historical dangling Outlook intake metadata ids, then validate the
-- FK added in 20260506184031.

set statement_timeout = 0;
set lock_timeout = '5min';

BEGIN;

UPDATE public.outlook_email_intake AS intake
SET
  document_metadata_id = NULL,
  updated_at = now()
WHERE intake.document_metadata_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1
    FROM public.document_metadata AS metadata
    WHERE metadata.id = intake.document_metadata_id
  );

ALTER TABLE public.outlook_email_intake
  VALIDATE CONSTRAINT outlook_email_intake_document_metadata_id_fkey;

NOTIFY pgrst, 'reload schema';

COMMIT;
