-- ============================================================================
-- People/contacts cleanup — APPLY (mutates `people.status`; reversible)
-- ============================================================================
--
-- ⚠️  Run scripts/db/cleanup-email-junk-contacts-preview.sql FIRST and review
--     the counts. This file is separate so the read-only preview can never write.
--
-- WHAT IT DOES
--   Marks every self-identified email/meeting auto-created contact as
--   `status = 'inactive'` so it drops out of the active directory, and records
--   the prior status + reason in `metadata` for a one-line RESTORE. It does NOT
--   delete anything and touches NO app users. Fully reversible.
--
--   Why inactivate (not hard-delete) here: `people` is referenced by ~35 FK
--   columns; a blind hard-delete can trip a RESTRICT FK. Inactivating is
--   guaranteed-correct and reversible. Once you've reviewed the inactivated set,
--   a separately governed deletion/export workflow can remove safe orphans
--   permanently after its retention evidence is externalized.
--
--   `people.status` only allows 'active' | 'inactive' (CHECK constraint), so
--   'inactive' is the archive state for this table (there is no 'archived').
--
-- TARGET (self-identifying junk only — see preview header for the full rationale)
--   metadata->>'auto_created_from' = 'document_metadata'
--     AND person_type <> 'user' AND auth_user_id IS NULL
--
-- RUN
--   The transaction ROLLS BACK by default, so a verbatim run is a safe dry-run
--   of the write (it inactivates, prints the new counts, then rolls back). Flip
--   ROLLBACK -> COMMIT to actually apply.
--
--   psql "$DATABASE_URL" -f scripts/db/cleanup-email-junk-contacts-apply.sql   -- dry-run write (auto ROLLBACK)
--
--   Idempotent: re-running only touches junk rows not already marked.
-- ============================================================================

BEGIN;

UPDATE public.people p
SET
  status = 'inactive',
  updated_at = now(),
  metadata = coalesce(p.metadata, '{}'::jsonb)
    || jsonb_build_object(
         'cleanup_inactivated_reason', 'email_auto_contact',
         'cleanup_inactivated_at', now(),
         'cleanup_prev_status', p.status
       )
WHERE p.metadata->>'auto_created_from' = 'document_metadata'
  AND p.person_type <> 'user'
  AND p.auth_user_id IS NULL
  AND (p.metadata->>'cleanup_inactivated_reason') IS DISTINCT FROM 'email_auto_contact';

-- Verify. After this runs there should be 0 ACTIVE self-identified email-junk
-- contacts, and inactivated_email_junk should equal the preview's removable count.
SELECT
  count(*) FILTER (WHERE status = 'inactive'
                     AND metadata->>'cleanup_inactivated_reason' = 'email_auto_contact')
                                                                    AS inactivated_email_junk,
  count(*) FILTER (WHERE status <> 'inactive'
                     AND metadata->>'auto_created_from' = 'document_metadata'
                     AND person_type <> 'user'
                     AND auth_user_id IS NULL)                      AS still_active_email_junk
FROM public.people;

-- Default is ROLLBACK so a verbatim run is a safe dry-run. Change to COMMIT to apply.
ROLLBACK;
-- COMMIT;


-- ============================================================================
-- RESTORE — reactivate everything this script inactivated, back to prior status.
-- ============================================================================
-- BEGIN;
-- UPDATE public.people p
-- SET
--   status = coalesce(p.metadata->>'cleanup_prev_status', 'active'),
--   updated_at = now(),
--   metadata = (p.metadata - 'cleanup_inactivated_reason'
--                          - 'cleanup_inactivated_at'
--                          - 'cleanup_prev_status')
-- WHERE p.metadata->>'cleanup_inactivated_reason' = 'email_auto_contact';
-- COMMIT;
