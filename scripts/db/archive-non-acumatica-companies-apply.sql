-- ============================================================================
-- Company directory cleanup — APPLY (mutates `companies.status`)
-- ============================================================================
--
-- ⚠️  Run archive-non-acumatica-companies-preview.sql FIRST and review its
--     output. This file is deliberately separate so the preview can never
--     trigger a write.
--
-- It is wrapped in a transaction that ROLLS BACK by default. Running it
-- verbatim changes NOTHING — it archives, prints the resulting counts, then
-- rolls back, so you can dry-run the write safely. To make it stick, change the
-- final ROLLBACK to COMMIT and re-run.
--
--   psql "$DATABASE_URL" -f scripts/db/archive-non-acumatica-companies-apply.sql
--
-- POLICY (approved 2026-07-18)
--   KEEP    — every Acumatica-backed company: one carrying an Acumatica VENDOR
--             id OR an Acumatica CUSTOMER id. Both live in Acumatica; testing
--             the vendor id alone misclassifies every customer as manual entry.
--   ARCHIVE — non-Acumatica companies with NO rows pointing at them.
--   HOLD    — non-Acumatica companies that ARE referenced by another table are
--             NOT archived here. They are the review list in section 3 of the
--             preview. Archiving them would soft-delete records that live data
--             still points at (as of 2026-07-18 that includes active clients
--             like Ulta, Uniqlo and Aspire Health Group, which are non-Acumatica
--             because the ERP sync only creates *vendors*).
--   DELETE NOTHING. Archiving is reversible — see RESTORE at the bottom.
--
--   To archive the referenced ones too, after reviewing them: set
--   `:include_referenced` to true below. Read that flag's warning first.
--
-- The reference scan is rebuilt from the live FK catalog on every run, so a
-- newly added foreign key to companies.id is picked up automatically and can
-- never cause an in-use company to be archived by omission.
-- ============================================================================

\set ON_ERROR_STOP on

-- Set to true ONLY after reviewing the flagged list in the preview.
\set include_referenced false

BEGIN;

-- ----------------------------------------------------------------------------
-- Rebuild the reference map (same logic as the preview) inside this transaction
-- so the archive decision is made against current data, not a stale snapshot.
-- ----------------------------------------------------------------------------
CREATE TEMP TABLE _company_refs (company_id uuid) ON COMMIT DROP;

DO $$
DECLARE
  fk record;
BEGIN
  FOR fk IN
    SELECT con.conrelid::regclass::text AS ref_table, att.attname::text AS ref_column
    FROM pg_constraint con
    JOIN pg_class rel ON rel.oid = con.confrelid
    JOIN pg_namespace nsp ON nsp.oid = rel.relnamespace
    JOIN unnest(con.conkey) WITH ORDINALITY AS k(attnum, ord) ON true
    JOIN pg_attribute att ON att.attrelid = con.conrelid AND att.attnum = k.attnum
    WHERE con.contype = 'f'
      AND nsp.nspname = 'public'
      AND rel.relname = 'companies'
      AND array_length(con.conkey, 1) = 1
  LOOP
    EXECUTE format(
      'INSERT INTO _company_refs (company_id)
       SELECT DISTINCT t.%1$I FROM %2$s t WHERE t.%1$I IS NOT NULL',
      fk.ref_column, fk.ref_table
    );
  END LOOP;
END $$;

CREATE INDEX ON _company_refs (company_id);


-- ----------------------------------------------------------------------------
-- The soft delete. Idempotent: only touches non-archived, non-Acumatica rows.
-- Prior status is recorded in metadata so RESTORE is a one-liner.
-- ----------------------------------------------------------------------------
UPDATE public.companies c
SET
  status = 'archived',
  updated_at = now(),
  metadata = coalesce(c.metadata, '{}'::jsonb)
    || jsonb_build_object(
         'archived_reason', 'not_synced_from_acumatica',
         'archived_at', now(),
         'archived_from_status', c.status,
         'archived_was_referenced',
           EXISTS (SELECT 1 FROM _company_refs r WHERE r.company_id = c.id)
       )
WHERE (c.acumatica_vendor_id IS NULL AND nullif(btrim(c.customer_id),'') IS NULL)
  AND c.status IS DISTINCT FROM 'archived'
  AND (
    :include_referenced
    OR NOT EXISTS (SELECT 1 FROM _company_refs r WHERE r.company_id = c.id)
  );


-- ----------------------------------------------------------------------------
-- Verify the write before deciding to keep it.
-- ----------------------------------------------------------------------------
SELECT
  count(*) FILTER (WHERE (acumatica_vendor_id IS NOT NULL OR nullif(btrim(customer_id),'') IS NOT NULL)
                     AND status = 'archived')                    AS acumatica_archived_MUST_BE_0,
  count(*) FILTER (WHERE status = 'archived'
                     AND metadata->>'archived_reason'
                         = 'not_synced_from_acumatica')           AS archived_by_this_script,
  count(*) FILTER (WHERE (acumatica_vendor_id IS NULL AND nullif(btrim(customer_id),'') IS NULL)
                     AND status IS DISTINCT FROM 'archived')      AS non_acumatica_still_live,
  count(*) FILTER (WHERE status IS DISTINCT FROM 'archived')      AS live_companies_remaining
FROM public.companies;

-- Default is ROLLBACK so a verbatim run is a safe dry-run. Change to COMMIT to apply.
ROLLBACK;
-- COMMIT;


-- ============================================================================
-- RESTORE — undo everything this script archived, back to each company's prior
--           status. Safe to run any time; only touches rows it tagged.
-- ============================================================================
-- BEGIN;
-- UPDATE public.companies c
-- SET
--   status = coalesce(c.metadata->>'archived_from_status', 'active'),
--   updated_at = now(),
--   metadata = (c.metadata - 'archived_reason' - 'archived_at'
--                          - 'archived_from_status' - 'archived_was_referenced')
-- WHERE c.status = 'archived'
--   AND c.metadata->>'archived_reason' = 'not_synced_from_acumatica';
-- COMMIT;
