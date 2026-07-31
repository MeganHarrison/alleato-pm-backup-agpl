-- ============================================================================
-- Non-Acumatica companies — SEGMENTATION + duplicate detection (read-only)
-- ============================================================================
--
--   psql "$DATABASE_URL" -f scripts/db/non-acumatica-company-segments-preview.sql
--
-- WHY THIS EXISTS
--   archive-non-acumatica-companies-preview.sql answers "is anything pointing at
--   this company?" — a yes/no safety check. It does not tell you WHY a company
--   is non-Acumatica, and that is the actual decision. The 252 non-Acumatica
--   companies are four different problems wearing one label (2026-07-18):
--
--     29  duplicate of an Acumatica company  -> merge the references, then archive
--     12  unique, has financial/contract rows -> KEEP (these are clients; the ERP
--                                                sync only creates vendors)
--    161  unique, contacts only               -> judgment call: real subs that were
--                                                never set up in the ERP
--     50  unique, no references at all        -> archive freely
--
--   Treating all 252 the same either deletes live clients or leaves the
--   directory full of duplicates. This script produces the four lists.
--
-- Duplicate matching normalizes the name (lowercase, strip punctuation and
-- entity suffixes like LLC/Inc/Co/Corp) and takes the best pg_trgm similarity
-- against the Acumatica set. >= 0.75 is the review threshold; eyeball the
-- 0.75-0.90 band before merging, >= 0.95 is effectively an exact match.
-- ============================================================================

\set ON_ERROR_STOP on
\set dup_threshold 0.75

CREATE EXTENSION IF NOT EXISTS pg_trgm;

DROP VIEW IF EXISTS _na_segments;
CREATE TEMP VIEW _na_segments AS
WITH norm AS (
  SELECT
    id, name, type, status, acumatica_vendor_id,
    -- ERP-backed = has an Acumatica vendor id OR an Acumatica customer id.
    -- Acumatica holds both; the vendor id alone misses every customer.
    (acumatica_vendor_id IS NOT NULL
      OR nullif(btrim(customer_id),'') IS NOT NULL) AS is_erp,
    btrim(regexp_replace(
      regexp_replace(
        regexp_replace(lower(name), '[^a-z0-9 ]', ' ', 'g'),
        '\s*\y(llc|l l c|inc|incorporated|co|corp|corporation|company|ltd|the|and|of)\y\s*', ' ', 'g'),
      '\s+', ' ', 'g')) AS n
  FROM public.companies
),
non_acumatica AS (SELECT * FROM norm WHERE NOT is_erp),
acumatica     AS (SELECT * FROM norm WHERE is_erp),
matched AS (
  SELECT na.*, m.name AS acumatica_twin, m.acumatica_vendor_id AS twin_vendor_id, m.sim
  FROM non_acumatica na
  JOIN LATERAL (
    SELECT ac.name, ac.acumatica_vendor_id, similarity(na.n, ac.n) AS sim
    FROM acumatica ac ORDER BY sim DESC LIMIT 1
  ) m ON true
),
counted AS (
  SELECT
    m.*,
    (SELECT count(*) FROM public.people p WHERE p.company_id = m.id) AS contacts,
    (EXISTS (SELECT 1 FROM public.projects p            WHERE p.company_id = m.id)
      OR EXISTS (SELECT 1 FROM public.prime_contracts pc WHERE pc.client_id = m.id
                                                            OR pc.contract_company_id = m.id)
      OR EXISTS (SELECT 1 FROM public.acumatica_ap_bills a        WHERE a.company_id = m.id)
      OR EXISTS (SELECT 1 FROM public.acumatica_project_budgets a WHERE a.company_id = m.id)
      OR EXISTS (SELECT 1 FROM public.acumatica_subcontracts a    WHERE a.company_id = m.id)
    ) AS has_financial
  FROM matched m
)
SELECT
  id, name, type, status, contacts, has_financial,
  acumatica_twin, twin_vendor_id, round(sim::numeric, 2) AS name_similarity,
  CASE
    WHEN sim >= 0.75          THEN '1_duplicate_of_acumatica'
    WHEN has_financial        THEN '2_unique_keep_has_financial'
    WHEN contacts > 0         THEN '3_unique_contacts_only'
    ELSE                           '4_unique_no_references'
  END AS segment
FROM counted;


-- 1. The four segments at a glance.
SELECT segment, count(*) AS companies, sum(contacts) AS contacts_affected
FROM _na_segments GROUP BY segment ORDER BY segment;


-- 2. 🔁 MERGE CANDIDATES — a non-Acumatica row that duplicates an Acumatica one.
--    Repoint their references at the twin, then archive the duplicate.
SELECT name, acumatica_twin, name_similarity, contacts, id, twin_vendor_id
FROM _na_segments WHERE segment = '1_duplicate_of_acumatica'
ORDER BY name_similarity DESC, name;


-- 3. ✋ KEEP — unique companies carrying financial or contract records.
SELECT name, type, contacts, id
FROM _na_segments WHERE segment = '2_unique_keep_has_financial' ORDER BY name;


-- 4. 🤔 JUDGMENT CALL — unique, contacts only. Real companies that were never
--    set up in the ERP. Archiving these removes their contacts from the directory.
SELECT name, type, contacts, id
FROM _na_segments WHERE segment = '3_unique_contacts_only'
ORDER BY contacts DESC, name;


-- 5. ✅ SAFE TO ARCHIVE — unique, nothing points at them.
SELECT name, type, id
FROM _na_segments WHERE segment = '4_unique_no_references' ORDER BY name;
