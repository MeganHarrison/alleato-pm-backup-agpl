-- Add missing Procore fields to prime_contract_change_orders
ALTER TABLE prime_contract_change_orders
  ADD COLUMN IF NOT EXISTS rejection_reason text,
  ADD COLUMN IF NOT EXISTS review_date date,
  ADD COLUMN IF NOT EXISTS designated_reviewer text,
  ADD COLUMN IF NOT EXISTS revised_substantial_completion_date date;
-- Normalize prime_contract_change_orders status to lowercase
UPDATE prime_contract_change_orders
SET status = LOWER(status)
WHERE status IS NOT NULL AND status != LOWER(status);
-- Add missing Procore fields to contract_change_orders (commitment COs)
ALTER TABLE contract_change_orders
  ADD COLUMN IF NOT EXISTS title text,
  ADD COLUMN IF NOT EXISTS designated_reviewer text,
  ADD COLUMN IF NOT EXISTS due_date date,
  ADD COLUMN IF NOT EXISTS invoiced_date date,
  ADD COLUMN IF NOT EXISTS executed boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS field_change boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS paid_in_full boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS schedule_impact integer,
  ADD COLUMN IF NOT EXISTS location text,
  ADD COLUMN IF NOT EXISTS reference text,
  ADD COLUMN IF NOT EXISTS revision integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS created_by text,
  ADD COLUMN IF NOT EXISTS contract_company text,
  ADD COLUMN IF NOT EXISTS change_reason text,
  ADD COLUMN IF NOT EXISTS is_private boolean DEFAULT false;
