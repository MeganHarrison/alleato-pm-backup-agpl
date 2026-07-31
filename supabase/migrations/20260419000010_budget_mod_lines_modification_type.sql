-- Add modification_type to budget_mod_lines
-- Supports Procore-aligned addition/deduction workflow
ALTER TABLE public.budget_mod_lines
  ADD COLUMN IF NOT EXISTS modification_type TEXT
  CHECK (modification_type IN ('addition', 'deduction'));
