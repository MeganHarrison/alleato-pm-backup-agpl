-- Add voided_reason to budget_modification_lines
-- Required for Procore-aligned void workflow: user must provide a reason when voiding
ALTER TABLE public.budget_modification_lines
  ADD COLUMN IF NOT EXISTS voided_reason TEXT;
