-- A company is eligible for deletion only when Acumatica does not own it and
-- no foreign-key relationship points at it. The relationship test is driven
-- from pg_constraint rather than a hand-maintained table list, so a future
-- company FK becomes an automatic retention boundary.
CREATE OR REPLACE FUNCTION public.purge_unlinked_non_acumatica_companies()
RETURNS TABLE (
  deleted_company_id uuid,
  deleted_company_name text
)
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = pg_catalog, public
AS $$
DECLARE
  candidate public.companies%ROWTYPE;
  company_reference record;
  has_reference boolean;
BEGIN
  -- Lock each candidate before examining references. This prevents a concurrent
  -- FK insert from racing the inspection and being cascaded/nullified by delete.
  FOR candidate IN
    SELECT *
    FROM public.companies
    WHERE acumatica_vendor_id IS NULL
      AND customer_id IS NULL
    FOR UPDATE SKIP LOCKED
  LOOP
    has_reference := false;

    FOR company_reference IN
      SELECT
        referencing_namespace.nspname AS table_schema,
        referencing_relation.relname AS table_name,
        referencing_column.attname AS column_name
      FROM pg_constraint AS constraint_row
      JOIN pg_class AS referencing_relation
        ON referencing_relation.oid = constraint_row.conrelid
      JOIN pg_namespace AS referencing_namespace
        ON referencing_namespace.oid = referencing_relation.relnamespace
      JOIN LATERAL unnest(constraint_row.conkey) AS constraint_key(attnum)
        ON true
      JOIN pg_attribute AS referencing_column
        ON referencing_column.attrelid = constraint_row.conrelid
       AND referencing_column.attnum = constraint_key.attnum
      WHERE constraint_row.contype = 'f'
        AND constraint_row.confrelid = 'public.companies'::regclass
    LOOP
      EXECUTE format(
        'SELECT EXISTS (SELECT 1 FROM %I.%I WHERE %I = $1)',
        company_reference.table_schema,
        company_reference.table_name,
        company_reference.column_name
      )
      INTO has_reference
      USING candidate.id;

      EXIT WHEN has_reference;
    END LOOP;

    IF NOT has_reference THEN
      -- Recheck source linkage while holding the row lock. If Acumatica linked
      -- this company after the candidate scan began, it is no longer eligible.
      DELETE FROM public.companies
      WHERE id = candidate.id
        AND acumatica_vendor_id IS NULL
        AND customer_id IS NULL;

      IF FOUND THEN
        deleted_company_id := candidate.id;
        deleted_company_name := candidate.name;
        RETURN NEXT;
      END IF;
    END IF;
  END LOOP;
END;
$$;

REVOKE ALL ON FUNCTION public.purge_unlinked_non_acumatica_companies() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.purge_unlinked_non_acumatica_companies() TO service_role;

COMMENT ON FUNCTION public.purge_unlinked_non_acumatica_companies() IS
  'Deletes only companies without Acumatica linkage and without any incoming company foreign-key reference.';
