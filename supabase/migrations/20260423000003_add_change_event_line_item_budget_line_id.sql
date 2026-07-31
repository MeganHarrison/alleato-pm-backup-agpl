-- Make the change event line item budget relationship explicit.
-- `budget_code_id` has historically stored budget_lines.id, despite its name.
-- Keep it as a legacy alias during the app migration, but add the correctly
-- named `budget_line_id` and enforce that both columns cannot diverge.

ALTER TABLE public.change_event_line_items
  ADD COLUMN IF NOT EXISTS budget_line_id uuid;
UPDATE public.change_event_line_items
SET budget_line_id = budget_code_id
WHERE budget_line_id IS NULL
  AND budget_code_id IS NOT NULL;
ALTER TABLE public.change_event_line_items
  DROP CONSTRAINT IF EXISTS change_event_line_items_budget_line_id_fkey;
ALTER TABLE public.change_event_line_items
  ADD CONSTRAINT change_event_line_items_budget_line_id_fkey
  FOREIGN KEY (budget_line_id) REFERENCES public.budget_lines(id) ON DELETE SET NULL;
ALTER TABLE public.change_event_line_items
  DROP CONSTRAINT IF EXISTS change_event_line_items_budget_line_alias_match;
ALTER TABLE public.change_event_line_items
  ADD CONSTRAINT change_event_line_items_budget_line_alias_match
  CHECK (
    budget_code_id IS NULL
    OR budget_line_id IS NULL
    OR budget_code_id = budget_line_id
  );
CREATE INDEX IF NOT EXISTS idx_ce_line_items_budget_line
  ON public.change_event_line_items USING btree (budget_line_id);
CREATE OR REPLACE FUNCTION public.sync_change_event_line_item_budget_line_alias()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.budget_line_id IS NULL AND NEW.budget_code_id IS NOT NULL THEN
    NEW.budget_line_id := NEW.budget_code_id;
  ELSIF NEW.budget_code_id IS NULL AND NEW.budget_line_id IS NOT NULL THEN
    NEW.budget_code_id := NEW.budget_line_id;
  ELSIF NEW.budget_line_id IS NOT NULL
    AND NEW.budget_code_id IS NOT NULL
    AND NEW.budget_line_id <> NEW.budget_code_id THEN
    RAISE EXCEPTION
      'change_event_line_items budget_line_id (%) must match legacy budget_code_id (%)',
      NEW.budget_line_id,
      NEW.budget_code_id
      USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS sync_change_event_line_item_budget_line_alias
  ON public.change_event_line_items;
CREATE TRIGGER sync_change_event_line_item_budget_line_alias
  BEFORE INSERT OR UPDATE OF budget_line_id, budget_code_id
  ON public.change_event_line_items
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_change_event_line_item_budget_line_alias();
COMMENT ON COLUMN public.change_event_line_items.budget_line_id IS
  'Explicit FK to budget_lines.id. Preferred replacement for legacy budget_code_id.';
COMMENT ON COLUMN public.change_event_line_items.budget_code_id IS
  'Legacy alias that also stores budget_lines.id, not project_budget_codes.id. Use budget_line_id in new code.';
