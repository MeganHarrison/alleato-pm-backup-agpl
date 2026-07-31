-- Repair pco_line_items for the two-tier Prime/Commitment PCO model.
--
-- 20260410140000_create_pco_tables.sql defined pco_line_items.pco_id as UUID,
-- but on databases where the legacy pco_line_items table already existed,
-- CREATE TABLE IF NOT EXISTS left the old BIGINT column and FK to
-- potential_change_orders in place. The change-event -> PCO flow stores UUID
-- IDs from prime_contract_pcos / commitment_pcos, so the old BIGINT column
-- makes the user flow impossible.

DO $$
DECLARE
  current_udt text;
  existing_rows bigint;
BEGIN
  SELECT c.udt_name
    INTO current_udt
  FROM information_schema.columns c
  WHERE c.table_schema = 'public'
    AND c.table_name = 'pco_line_items'
    AND c.column_name = 'pco_id';

  IF current_udt IS NULL THEN
    RAISE EXCEPTION 'public.pco_line_items.pco_id does not exist';
  END IF;

  IF current_udt <> 'uuid' THEN
    SELECT count(*) INTO existing_rows FROM public.pco_line_items;

    IF existing_rows > 0 THEN
      RAISE EXCEPTION
        'Cannot convert public.pco_line_items.pco_id from % to uuid while % existing row(s) need migration mapping',
        current_udt,
        existing_rows;
    END IF;

    ALTER TABLE public.pco_line_items
      DROP CONSTRAINT IF EXISTS pco_line_items_pco_id_fkey;

    ALTER TABLE public.pco_line_items
      ALTER COLUMN pco_id TYPE uuid USING NULL;
  END IF;
END $$;
ALTER TABLE public.pco_line_items
  ALTER COLUMN pco_id SET NOT NULL;
CREATE INDEX IF NOT EXISTS idx_pco_line_items_pco
  ON public.pco_line_items(pco_id, pco_type);
