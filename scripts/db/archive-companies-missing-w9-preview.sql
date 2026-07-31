-- ⚠️  SUPERSEDED 2026-07-18 — DO NOT RUN.
-- The missing-W-9 policy was replaced by the Acumatica-source policy:
--   scripts/db/archive-non-acumatica-companies-preview.sql
--   scripts/db/archive-non-acumatica-companies-apply.sql
-- Kept only as a record of the earlier approach.

-- ============================================================================
-- Company directory cleanup — PREVIEW (read-only, safe to run)
-- ============================================================================
--
-- This file NEVER modifies data. Run it first to see exactly what the apply
-- step (archive-companies-missing-w9-apply.sql) will archive.
--
--   psql "$DATABASE_URL" -f scripts/db/archive-companies-missing-w9-preview.sql
--   (or paste into the Supabase SQL editor)
--
-- CONTEXT / POLICY (approved 2026-07-18)
--   The `companies` table was populated from two syncs: Acumatica (the ERP,
--   marked by `acumatica_vendor_id IS NOT NULL`) and JobPlanner / manual entry
--   (everything with `acumatica_vendor_id IS NULL`). A company should only be
--   "live" if it carries its required documentation — for this pass, a W-9.
--     * A company "has a W-9" if any linked `company_documents` row is typed
--       `w9` — on the junction row (`company_documents.document_type`) OR on the
--       underlying file (`document_metadata.document_type`).
--     * Any company WITHOUT a W-9 -> archived (BOTH Acumatica and non-Acumatica).
--     * DELETE NOTHING. Archiving is reversible. Hard deletion of orphaned rows
--       is a later, manual step from the UI after review.
--
-- W-9 STORAGE (reference)
--   companies.id
--     └── company_documents.company_id      (junction; document_type may be 'w9')
--           └── document_metadata.id         (file row; document_type may be 'w9')
--                 └── file in Supabase Storage bucket `project-files`
-- ============================================================================


-- ----------------------------------------------------------------------------
-- SUMMARY — the buckets before any change.
-- ----------------------------------------------------------------------------
WITH classified AS (
  SELECT
    c.id,
    (c.acumatica_vendor_id IS NOT NULL) AS is_acumatica,
    EXISTS (
      SELECT 1
      FROM public.company_documents cd
      LEFT JOIN public.document_metadata dm ON dm.id = cd.document_metadata_id
      WHERE cd.company_id = c.id
        AND (cd.document_type = 'w9' OR dm.document_type = 'w9')
    ) AS has_w9,
    (c.status IS NOT DISTINCT FROM 'archived') AS already_archived
  FROM public.companies c
)
SELECT
  count(*)                                                    AS total_companies,
  count(*) FILTER (WHERE has_w9)                              AS have_w9_keep,
  count(*) FILTER (WHERE NOT has_w9)                          AS missing_w9_total,
  count(*) FILTER (WHERE NOT has_w9 AND is_acumatica)         AS missing_w9_acumatica,
  count(*) FILTER (WHERE NOT has_w9 AND NOT is_acumatica)     AS missing_w9_other,
  count(*) FILTER (WHERE NOT has_w9 AND NOT already_archived) AS will_be_archived_now,
  count(*) FILTER (WHERE NOT has_w9 AND already_archived)     AS already_archived_no_w9
FROM classified;


-- ----------------------------------------------------------------------------
-- PREVIEW LIST — the exact rows the apply step will archive, annotated with
-- whether they are still referenced by other records (worth reviewing before a
-- future hard delete).
-- ----------------------------------------------------------------------------
SELECT
  c.id,
  c.name,
  c.status                                   AS current_status,
  (c.acumatica_vendor_id IS NOT NULL)        AS is_acumatica,
  c.acumatica_vendor_id,
  (EXISTS (SELECT 1 FROM public.projects p           WHERE p.company_id = c.id)) AS in_projects,
  (EXISTS (SELECT 1 FROM public.people pe            WHERE pe.company_id = c.id)) AS has_contacts,
  (EXISTS (SELECT 1 FROM public.project_companies pc WHERE pc.company_id = c.id)) AS in_project_companies,
  (EXISTS (SELECT 1 FROM public.prime_contracts prc  WHERE prc.contract_company_id = c.id
                                                        OR prc.client_id = c.id
                                                        OR prc.contractor_id = c.id)) AS in_prime_contracts
FROM public.companies c
WHERE c.status IS DISTINCT FROM 'archived'
  AND NOT EXISTS (
    SELECT 1
    FROM public.company_documents cd
    LEFT JOIN public.document_metadata dm ON dm.id = cd.document_metadata_id
    WHERE cd.company_id = c.id
      AND (cd.document_type = 'w9' OR dm.document_type = 'w9')
  )
ORDER BY is_acumatica DESC, c.name;
