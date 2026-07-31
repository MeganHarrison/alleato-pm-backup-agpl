-- ⚠️  SUPERSEDED 2026-07-18 — DO NOT RUN.
-- The missing-W-9 policy was replaced by the Acumatica-source policy:
--   scripts/db/archive-non-acumatica-companies-preview.sql
--   scripts/db/archive-non-acumatica-companies-apply.sql
-- Kept only as a record of the earlier approach.

-- ============================================================================
-- Company directory cleanup — APPLY (DESTRUCTIVE: mutates `companies.status`)
-- ============================================================================
--
-- ⚠️  This file ARCHIVES every company that lacks a W-9. Run it ONLY after you
--     have reviewed the output of archive-companies-missing-w9-preview.sql and
--     the counts look right. It is deliberately a SEPARATE file from the preview
--     so the read-only preview can never trigger a write.
--
-- It is wrapped in an explicit transaction that ROLLS BACK by default. To make
-- the change stick you must edit the final line from ROLLBACK to COMMIT (or run
-- the UPDATE yourself inside your own BEGIN/COMMIT). Running this file verbatim
-- with `psql -f` changes NOTHING — it archives, prints the new counts, then
-- rolls back — so you can dry-run the write safely first.
--
--   psql "$DATABASE_URL" -f scripts/db/archive-companies-missing-w9-apply.sql   -- dry-run write (auto ROLLBACK)
--   ...review the "after" counts, then change ROLLBACK -> COMMIT and re-run to apply.
--
-- POLICY: archive-all / delete-none. Applies to BOTH Acumatica and
-- non-Acumatica companies. Prior status is recorded in metadata for a one-line
-- RESTORE (see bottom). Idempotent: re-running only touches companies that are
-- not already archived and still lack a W-9.
-- ============================================================================

BEGIN;

UPDATE public.companies c
SET
  status = 'archived',
  updated_at = now(),
  metadata = coalesce(c.metadata, '{}'::jsonb)
    || jsonb_build_object(
         'archived_reason', 'missing_w9',
         'archived_at', now(),
         'archived_from_status', c.status,
         'archived_had_acumatica_link', (c.acumatica_vendor_id IS NOT NULL)
       )
WHERE c.status IS DISTINCT FROM 'archived'
  AND NOT EXISTS (
    SELECT 1
    FROM public.company_documents cd
    LEFT JOIN public.document_metadata dm ON dm.id = cd.document_metadata_id
    WHERE cd.company_id = c.id
      AND (cd.document_type = 'w9' OR dm.document_type = 'w9')
  );

-- Verify the write before deciding to keep it. After this runs there should be
-- 0 non-archived companies without a W-9.
SELECT
  count(*) FILTER (WHERE status = 'archived'
                     AND metadata->>'archived_reason' = 'missing_w9') AS archived_missing_w9,
  count(*) FILTER (WHERE status IS DISTINCT FROM 'archived'
                     AND NOT EXISTS (
                       SELECT 1 FROM public.company_documents cd
                       LEFT JOIN public.document_metadata dm ON dm.id = cd.document_metadata_id
                       WHERE cd.company_id = companies.id
                         AND (cd.document_type = 'w9' OR dm.document_type = 'w9')
                     )) AS still_live_without_w9
FROM public.companies;

-- Default is ROLLBACK so a verbatim `psql -f` run is a safe dry-run of the
-- write. Change to COMMIT to actually apply.
ROLLBACK;
-- COMMIT;


-- ============================================================================
-- RESTORE — undo the archive for anything this script touched, back to each
--           company's prior status (recorded in metadata).
-- ============================================================================
-- BEGIN;
-- UPDATE public.companies c
-- SET
--   status = coalesce(c.metadata->>'archived_from_status', 'active'),
--   updated_at = now(),
--   metadata = (c.metadata - 'archived_reason' - 'archived_at'
--                          - 'archived_from_status' - 'archived_had_acumatica_link')
-- WHERE c.status = 'archived'
--   AND c.metadata->>'archived_reason' = 'missing_w9';
-- COMMIT;
