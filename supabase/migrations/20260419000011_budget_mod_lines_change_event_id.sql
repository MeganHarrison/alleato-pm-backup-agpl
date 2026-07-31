-- Add change_event_id FK to budget_mod_lines
-- Allows linking modifications to originating change events for audit trail
ALTER TABLE public.budget_mod_lines
  ADD COLUMN IF NOT EXISTS change_event_id UUID
  REFERENCES public.change_events(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_budget_mod_lines_change_event_id
  ON public.budget_mod_lines(change_event_id)
  WHERE change_event_id IS NOT NULL;
