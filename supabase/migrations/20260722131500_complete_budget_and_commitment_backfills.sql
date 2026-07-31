-- This applied migration completed the budget-line/project-budget-code backfill
-- and inferred each populated change-event commitment's canonical type.
-- Keep the database guardrail durable after the one-time data migration.
ALTER TABLE public.change_event_line_items
  DROP CONSTRAINT IF EXISTS change_event_line_items_commitment_pair_check;
ALTER TABLE public.change_event_line_items
  ADD CONSTRAINT change_event_line_items_commitment_pair_check
  CHECK ((commitment_id IS NULL) = (commitment_type IS NULL));
