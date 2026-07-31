-- ============================================================================
-- Duplicate company merge — PREVIEW (never modifies application data)
-- ============================================================================
--
--   psql "$DATABASE_URL" -f scripts/db/merge-duplicate-companies-preview.sql
--
-- WHAT COUNTS AS A DUPLICATE
--   Two live companies whose names normalize to the same string — lowercased,
--   punctuation stripped, and entity suffixes removed (LLC / Inc / Co / Corp /
--   Ltd / LP / the / and / of). "R.J.Skelding Co. Inc." and "R.J. Skelding Co,
--   Inc" collapse to the same key.
--
-- THE CRITICAL SPLIT — not every duplicate can be merged here
--   * MERGEABLE: at most ONE row in the group carries an Acumatica vendor id.
--     The extra rows are local artifacts; repointing their references onto the
--     survivor and archiving them is safe and sticks.
--   * ERP-SIDE: two or more rows each carry a DIFFERENT Acumatica vendor id
--     (as of 2026-07-20: APEC vs APENGR, CEVA vs CEVA U.S, CSU vs CSUPRO,
--     ERELLC vs EXELEVATOR, 0002 vs FBM, LEGACY vs LEGACY FIR). These are
--     duplicated *inside Acumatica*. Merging them locally is pointless — the
--     vendor sync matches on acumatica_vendor_id and will recreate the row it
--     no longer finds on the very next run. They must be merged in Acumatica,
--     or given a deliberate alias mapping. This script REFUSES to touch them.
--
-- SURVIVOR SELECTION (deterministic, in order)
--   1. the row with an Acumatica vendor id  — the sync owns it, so it must live
--   2. the row with a real AR customer id
--   3. the oldest row
-- ============================================================================

\set ON_ERROR_STOP on

DROP VIEW IF EXISTS _dup_groups;
CREATE TEMP VIEW _dup_groups AS
WITH norm AS (
  SELECT
    id, name, type, status, acumatica_vendor_id, customer_id, created_at,
    btrim(regexp_replace(
      regexp_replace(
        regexp_replace(lower(name), '[^a-z0-9 ]', ' ', 'g'),
        '\s*\y(llc|l l c|inc|incorporated|co|corp|corporation|company|ltd|lp|the|and|of)\y\s*', ' ', 'g'),
      '\s+', ' ', 'g')) AS norm_name
  FROM public.companies
  WHERE status IS DISTINCT FROM 'archived' AND status NOT ILIKE 'archived'
),
grouped AS (
  SELECT norm_name,
         count(*) AS row_count,
         count(DISTINCT acumatica_vendor_id) AS distinct_vendor_ids
  FROM norm WHERE norm_name <> ''
  GROUP BY norm_name HAVING count(*) > 1
),
ranked AS (
  SELECT n.*, g.row_count, g.distinct_vendor_ids,
    row_number() OVER (
      PARTITION BY n.norm_name
      ORDER BY
        (n.acumatica_vendor_id IS NULL),                                   -- vendor id first
        (nullif(btrim(n.customer_id), '') IS NULL),                        -- then customer id
        n.created_at                                                       -- then oldest
    ) AS rank_in_group
  FROM norm n JOIN grouped g ON g.norm_name = n.norm_name
)
SELECT *,
  (distinct_vendor_ids <= 1) AS mergeable,
  (rank_in_group = 1)        AS is_survivor
FROM ranked;


-- 1. Summary.
SELECT
  count(DISTINCT norm_name)                                    AS duplicate_groups,
  count(DISTINCT norm_name) FILTER (WHERE mergeable)           AS mergeable_groups,
  count(DISTINCT norm_name) FILTER (WHERE NOT mergeable)       AS erp_side_groups,
  count(*) FILTER (WHERE mergeable AND NOT is_survivor)        AS rows_to_merge_away
FROM _dup_groups;


-- 2. ⛔ ERP-SIDE — duplicated inside Acumatica. Fix there, not here.
SELECT norm_name, string_agg(name || ' [' || acumatica_vendor_id || ']', '  vs  ' ORDER BY name) AS competing_rows
FROM _dup_groups WHERE NOT mergeable AND acumatica_vendor_id IS NOT NULL
GROUP BY norm_name ORDER BY norm_name;


-- 3. ✅ THE MERGE PLAN — survivor and what folds into it.
SELECT
  s.name  AS survivor,
  coalesce(s.acumatica_vendor_id, '—') AS survivor_vendor_id,
  coalesce(nullif(btrim(s.customer_id), ''), '—') AS survivor_customer_id,
  d.name  AS merged_away,
  d.id    AS merged_away_id,
  (SELECT count(*) FROM public.people p WHERE p.company_id = d.id) AS contacts_moving
FROM _dup_groups s
JOIN _dup_groups d ON d.norm_name = s.norm_name AND NOT d.is_survivor
WHERE s.is_survivor AND s.mergeable
ORDER BY s.name;


-- 4. Every reference that will be repointed, by table.
DROP TABLE IF EXISTS _merge_pairs;
CREATE TEMP TABLE _merge_pairs AS
SELECT d.id AS loser_id, s.id AS winner_id
FROM _dup_groups s
JOIN _dup_groups d ON d.norm_name = s.norm_name AND NOT d.is_survivor
WHERE s.is_survivor AND s.mergeable;

DROP TABLE IF EXISTS _merge_refs;
CREATE TEMP TABLE _merge_refs (ref_table text, ref_column text, rows_to_move bigint);

DO $$
DECLARE fk record;
BEGIN
  FOR fk IN
    SELECT con.conrelid::regclass::text AS ref_table, att.attname::text AS ref_column
    FROM pg_constraint con
    JOIN pg_class rel ON rel.oid = con.confrelid
    JOIN pg_namespace nsp ON nsp.oid = rel.relnamespace
    JOIN unnest(con.conkey) WITH ORDINALITY AS k(attnum, ord) ON true
    JOIN pg_attribute att ON att.attrelid = con.conrelid AND att.attnum = k.attnum
    WHERE con.contype = 'f' AND nsp.nspname = 'public'
      AND rel.relname = 'companies' AND array_length(con.conkey, 1) = 1
  LOOP
    EXECUTE format(
      'INSERT INTO _merge_refs
       SELECT %1$L, %2$L, count(*) FROM %3$s t JOIN _merge_pairs p ON p.loser_id = t.%2$I',
      fk.ref_table, fk.ref_column, fk.ref_table
    );
  END LOOP;
END $$;

SELECT ref_table, ref_column, rows_to_move
FROM _merge_refs WHERE rows_to_move > 0
ORDER BY rows_to_move DESC, ref_table;
