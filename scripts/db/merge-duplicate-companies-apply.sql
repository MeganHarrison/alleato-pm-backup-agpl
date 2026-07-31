-- ============================================================================
-- Duplicate company merge — APPLY (repoints references, archives the loser)
-- ============================================================================
--
-- ⚠️  Run merge-duplicate-companies-preview.sql first and read section 3.
--
-- ROLLS BACK by default. Running this verbatim performs the merge, prints the
-- verification counts, then throws it away — a safe dry-run of the write.
-- Change the final ROLLBACK to COMMIT to actually apply.
--
--   psql "$DATABASE_URL" -f scripts/db/merge-duplicate-companies-apply.sql
--
-- WHAT IT DOES, per mergeable group
--   1. repoints every FK pointing at the loser onto the survivor
--   2. clears the loser's customer_id, so the Acumatica customer projection
--      cannot re-target the dead row and silently undo this merge
--   3. archives the loser, recording `merged_into` for a reversible trail
--   NOTHING IS DELETED. The loser row survives, archived and tagged.
--
-- Groups duplicated inside Acumatica (two distinct acumatica_vendor_id values)
-- are EXCLUDED — the vendor sync would recreate whichever row it stopped
-- finding on the next run. Fix those in Acumatica.
--
-- COLLISIONS: some junction tables are unique on (parent, company_id), so
-- repointing collides when BOTH companies are already attached to the same
-- parent. Only the individually-colliding loser rows are dropped — the survivor
-- already carries that association, so nothing is lost — and every other row in
-- the same table is still repointed. Each deletion is reported below.
-- (An earlier version caught unique_violation and deleted every loser row in
-- the table; on project_companies that destroyed a row which should have been
-- repointed. Collisions are now detected per row, before the update runs.)
-- ============================================================================

\set ON_ERROR_STOP on

BEGIN;

CREATE TEMP TABLE _merge_pairs ON COMMIT DROP AS
WITH norm AS (
  SELECT id, name, acumatica_vendor_id, customer_id, created_at,
    btrim(regexp_replace(
      regexp_replace(
        regexp_replace(lower(name), '[^a-z0-9 ]', ' ', 'g'),
        '\s*\y(llc|l l c|inc|incorporated|co|corp|corporation|company|ltd|lp|the|and|of)\y\s*', ' ', 'g'),
      '\s+', ' ', 'g')) AS norm_name
  FROM public.companies WHERE status NOT ILIKE 'archived'
),
grouped AS (
  SELECT norm_name FROM norm WHERE norm_name <> ''
  GROUP BY norm_name
  HAVING count(*) > 1 AND count(DISTINCT acumatica_vendor_id) <= 1
),
ranked AS (
  SELECT n.*, row_number() OVER (
      PARTITION BY n.norm_name
      ORDER BY (n.acumatica_vendor_id IS NULL),
               (nullif(btrim(n.customer_id), '') IS NULL),
               n.created_at
    ) AS rnk
  FROM norm n JOIN grouped g ON g.norm_name = n.norm_name
)
SELECT l.id AS loser_id, w.id AS winner_id, l.name AS loser_name, w.name AS winner_name
FROM ranked l
JOIN ranked w ON w.norm_name = l.norm_name AND w.rnk = 1
WHERE l.rnk > 1;

CREATE TEMP TABLE _merge_log (
  ref_table text, ref_column text, repointed bigint, deleted_as_duplicate bigint
) ON COMMIT DROP;

-- Attribute number of a column, used to test unique-key membership.
CREATE OR REPLACE FUNCTION pg_temp.att_num(tbl text, col text) RETURNS smallint
LANGUAGE sql STABLE AS $fn$
  SELECT attnum FROM pg_attribute
  WHERE attrelid = tbl::regclass AND attname = col AND NOT attisdropped
$fn$;

DO $$
DECLARE
  fk         record;
  uq         record;
  other_cols text;
  moved      bigint;
  removed    bigint;
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
      AND con.conrelid::regclass::text <> 'companies'
  LOOP
    removed := 0;

    -- Delete ONLY the loser rows that would actually collide: those whose
    -- survivor already has a row with the same values in the rest of a unique
    -- key. Doing this first means the repoint below cannot raise, and — unlike
    -- a blanket exception handler — rows that merely share a table with a
    -- colliding row are still repointed rather than destroyed.
    FOR uq IN
      SELECT con.conkey
      FROM pg_constraint con
      WHERE con.contype IN ('u', 'p')
        AND con.conrelid = fk.ref_table::regclass
        AND pg_temp.att_num(fk.ref_table, fk.ref_column) = ANY (con.conkey)
        AND array_length(con.conkey, 1) > 1
    LOOP
      SELECT string_agg(format('t.%I IS NOT DISTINCT FROM w.%I', a.attname, a.attname), ' AND ')
        INTO other_cols
      FROM unnest(uq.conkey) AS k(attnum)
      JOIN pg_attribute a ON a.attrelid = fk.ref_table::regclass AND a.attnum = k.attnum
      WHERE a.attname <> fk.ref_column;

      CONTINUE WHEN other_cols IS NULL;

      EXECUTE format(
        'DELETE FROM %1$s t USING _merge_pairs p
         WHERE t.%2$I = p.loser_id
           AND EXISTS (SELECT 1 FROM %1$s w WHERE w.%2$I = p.winner_id AND %3$s)',
        fk.ref_table, fk.ref_column, other_cols
      );
      GET DIAGNOSTICS moved = ROW_COUNT;
      removed := removed + moved;
      IF moved > 0 THEN
        RAISE NOTICE 'collision on %.% — % duplicate association(s) dropped',
          fk.ref_table, fk.ref_column, moved;
      END IF;
    END LOOP;

    EXECUTE format(
      'UPDATE %1$s t SET %2$I = p.winner_id FROM _merge_pairs p WHERE t.%2$I = p.loser_id',
      fk.ref_table, fk.ref_column
    );
    GET DIAGNOSTICS moved = ROW_COUNT;

    IF moved > 0 OR removed > 0 THEN
      INSERT INTO _merge_log VALUES (fk.ref_table, fk.ref_column, moved, removed);
    END IF;
  END LOOP;
END $$;

-- Archive the losers. customer_id is cleared so the Acumatica customer
-- projection cannot re-target this dead row on the next sync.
UPDATE public.companies c
SET status = 'archived',
    customer_id = NULL,
    updated_at = now(),
    metadata = coalesce(c.metadata, '{}'::jsonb) || jsonb_build_object(
      'archived_reason', 'merged_duplicate',
      'archived_at', now(),
      'archived_from_status', c.status,
      'merged_into', p.winner_id,
      'merged_into_name', p.winner_name,
      'customer_id_before_merge', c.customer_id
    )
FROM _merge_pairs p
WHERE c.id = p.loser_id;


-- ---------------------------------------------------------------------------
-- Verification
-- ---------------------------------------------------------------------------
SELECT ref_table, ref_column, repointed, deleted_as_duplicate FROM _merge_log
ORDER BY repointed DESC, ref_table;

SELECT
  (SELECT count(*) FROM _merge_pairs)                                        AS groups_merged,
  (SELECT count(*) FROM public.companies WHERE metadata->>'archived_reason'='merged_duplicate') AS losers_archived,
  (SELECT count(*) FROM public.companies c JOIN _merge_pairs p ON p.loser_id=c.id
     WHERE c.status NOT ILIKE 'archived')                                    AS losers_still_live_MUST_BE_0,
  (SELECT count(*) FROM public.people pe JOIN _merge_pairs p ON p.loser_id=pe.company_id) AS contacts_left_behind_MUST_BE_0,
  (SELECT count(*) FROM public.companies c JOIN _merge_pairs p ON p.winner_id=c.id
     WHERE c.status ILIKE 'archived')                                        AS survivors_archived_MUST_BE_0;

ROLLBACK;
-- COMMIT;


-- ============================================================================
-- RESTORE — un-merge. Reverses the archive and the customer_id clear. It does
-- NOT move references back; re-run the preview afterwards to see what moved.
-- ============================================================================
-- BEGIN;
-- UPDATE public.companies c
-- SET status = coalesce(c.metadata->>'archived_from_status','active'),
--     customer_id = c.metadata->>'customer_id_before_merge',
--     metadata = (c.metadata - 'archived_reason' - 'archived_at' - 'archived_from_status'
--                            - 'merged_into' - 'merged_into_name' - 'customer_id_before_merge')
-- WHERE c.metadata->>'archived_reason' = 'merged_duplicate';
-- COMMIT;
