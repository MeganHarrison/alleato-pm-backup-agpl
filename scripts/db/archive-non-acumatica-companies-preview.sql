-- ============================================================================
-- Company directory cleanup — PREVIEW (never modifies application data)
-- ============================================================================
--
-- Run this first. It shows exactly what archive-non-acumatica-companies-apply.sql
-- will archive, and — critically — which non-Acumatica companies are still
-- referenced by rows in other tables so you can review them before they go.
--
--   psql "$DATABASE_URL" -f scripts/db/archive-non-acumatica-companies-preview.sql
--   (or paste into the Supabase SQL editor)
--
-- CONTEXT / POLICY (approved 2026-07-18, supersedes the W-9 policy in
-- archive-companies-missing-w9-*.sql)
--   `companies` was populated from two sources: the Acumatica ERP sync
--   and JobPlanner / manual entry. A company is ERP-backed if it carries an
--   Acumatica VENDOR id or an Acumatica CUSTOMER id — Acumatica holds both, and
--   testing `acumatica_vendor_id` alone misclassifies every customer (Ulta,
--   Uniqlo, Niemann Holdings, ...) as manual entry. New policy:
--     * KEEP  — every company synced from Acumatica. Untouched, always.
--     * ARCHIVE — every non-Acumatica company (soft delete: status='archived').
--     * FLAG  — any non-Acumatica company that still has a row pointing at it
--               from ANY other table. Those are held back from the archive by
--               default and listed below for manual review.
--     * DELETE NOTHING. Archiving is reversible (see RESTORE in the apply file).
--
-- WHY THE REFERENCE SCAN IS DYNAMIC
--   The set of tables with a foreign key to companies.id changes as the schema
--   grows (35 FK columns across 30 tables as of 2026-07-18). A hardcoded list
--   would silently miss new ones and archive a company that is actually in use.
--   This script reads the FK catalog at run time, so it can never go stale.
-- ============================================================================

\set ON_ERROR_STOP on

-- ----------------------------------------------------------------------------
-- Build the reference map dynamically from the live FK catalog.
-- TEMP tables only — no application data is touched.
-- ----------------------------------------------------------------------------
DROP TABLE IF EXISTS _company_fk_cols;
CREATE TEMP TABLE _company_fk_cols AS
SELECT
  con.conrelid::regclass::text AS ref_table,
  att.attname::text            AS ref_column
FROM pg_constraint con
JOIN pg_class rel ON rel.oid = con.confrelid
JOIN pg_namespace nsp ON nsp.oid = rel.relnamespace
JOIN unnest(con.conkey) WITH ORDINALITY AS k(attnum, ord) ON true
JOIN pg_attribute att ON att.attrelid = con.conrelid AND att.attnum = k.attnum
WHERE con.contype = 'f'
  AND nsp.nspname = 'public'
  AND rel.relname = 'companies'
  AND array_length(con.conkey, 1) = 1;

DROP TABLE IF EXISTS _company_refs;
CREATE TEMP TABLE _company_refs (
  company_id uuid,
  ref_table  text,
  ref_column text,
  ref_count  bigint
);

-- The cleanup candidates, resolved ONCE here rather than inside the dynamic SQL
-- below. Keeping the predicate out of the format() string avoids quote-escaping
-- bugs and means the ERP definition lives in exactly one place in this file.
DROP TABLE IF EXISTS _non_erp_companies;
CREATE TEMP TABLE _non_erp_companies AS
SELECT c.id
FROM public.companies c
WHERE c.acumatica_vendor_id IS NULL
  AND nullif(btrim(c.customer_id), '') IS NULL;
CREATE INDEX ON _non_erp_companies (id);

DO $$
DECLARE
  fk record;
BEGIN
  FOR fk IN SELECT * FROM _company_fk_cols LOOP
    EXECUTE format(
      'INSERT INTO _company_refs (company_id, ref_table, ref_column, ref_count)
       SELECT t.%1$I, %2$L, %3$L, count(*)
       FROM %4$s t
       JOIN _non_erp_companies c ON c.id = t.%1$I
       GROUP BY t.%1$I',
      fk.ref_column, fk.ref_table, fk.ref_column, fk.ref_table
    );
  END LOOP;
END $$;


-- ----------------------------------------------------------------------------
-- 1. SUMMARY — the buckets, before any change.
-- ----------------------------------------------------------------------------
WITH classified AS (
  SELECT
    c.id,
    (c.acumatica_vendor_id IS NOT NULL OR nullif(btrim(c.customer_id),'') IS NOT NULL) AS is_acumatica,
    (c.status IS NOT DISTINCT FROM 'archived') AS already_archived,
    EXISTS (SELECT 1 FROM _company_refs r WHERE r.company_id = c.id) AS is_referenced
  FROM public.companies c
)
SELECT
  count(*)                                                              AS total_companies,
  count(*) FILTER (WHERE is_acumatica)                                  AS acumatica_keep,
  count(*) FILTER (WHERE NOT is_acumatica)                              AS non_acumatica_total,
  count(*) FILTER (WHERE NOT is_acumatica AND NOT is_referenced
                     AND NOT already_archived)                          AS will_archive_now,
  count(*) FILTER (WHERE NOT is_acumatica AND is_referenced
                     AND NOT already_archived)                          AS flagged_for_review,
  count(*) FILTER (WHERE NOT is_acumatica AND already_archived)         AS already_archived
FROM classified;


-- ----------------------------------------------------------------------------
-- 2. WHERE THE REFERENCES LIVE — which tables are holding non-Acumatica
--    companies alive, so a whole class can be cleaned up at once.
-- ----------------------------------------------------------------------------
SELECT
  ref_table,
  ref_column,
  count(DISTINCT company_id) AS companies_referenced,
  sum(ref_count)             AS total_rows
FROM _company_refs
GROUP BY ref_table, ref_column
ORDER BY companies_referenced DESC, total_rows DESC;


-- ----------------------------------------------------------------------------
-- 3. 🚩 FLAGGED FOR REVIEW — non-Acumatica companies that other records still
--    point at. The apply script does NOT archive these by default.
-- ----------------------------------------------------------------------------
SELECT
  c.name,
  c.id,
  c.status,
  c.type,
  string_agg(r.ref_table || '.' || r.ref_column || ' (' || r.ref_count || ')',
             ', ' ORDER BY r.ref_count DESC, r.ref_table) AS referenced_by
FROM public.companies c
JOIN _company_refs r ON r.company_id = c.id
WHERE (c.acumatica_vendor_id IS NULL AND nullif(btrim(c.customer_id),'') IS NULL)
  AND c.status IS DISTINCT FROM 'archived'
GROUP BY c.id, c.name, c.status, c.type
ORDER BY sum(r.ref_count) DESC, c.name;


-- ----------------------------------------------------------------------------
-- 4. THE ARCHIVE LIST — unreferenced non-Acumatica companies. These are what
--    the apply script will soft delete.
-- ----------------------------------------------------------------------------
SELECT c.name, c.id, c.status, c.type, c.created_at
FROM public.companies c
WHERE (c.acumatica_vendor_id IS NULL AND nullif(btrim(c.customer_id),'') IS NULL)
  AND c.status IS DISTINCT FROM 'archived'
  AND NOT EXISTS (SELECT 1 FROM _company_refs r WHERE r.company_id = c.id)
ORDER BY c.name;
