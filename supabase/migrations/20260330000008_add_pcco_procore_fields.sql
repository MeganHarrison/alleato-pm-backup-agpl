-- Add missing Procore fields to prime_contract_change_orders
ALTER TABLE prime_contract_change_orders
  ADD COLUMN IF NOT EXISTS description text,
  ADD COLUMN IF NOT EXISTS revision integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS change_reason text,
  ADD COLUMN IF NOT EXISTS is_private boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS schedule_impact integer,
  ADD COLUMN IF NOT EXISTS field_change boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS reference text,
  ADD COLUMN IF NOT EXISTS paid_in_full boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS signed_co_received_date date,
  ADD COLUMN IF NOT EXISTS request_received_from text,
  ADD COLUMN IF NOT EXISTS location text,
  ADD COLUMN IF NOT EXISTS due_date date,
  ADD COLUMN IF NOT EXISTS invoiced_date date,
  ADD COLUMN IF NOT EXISTS created_by text,
  ADD COLUMN IF NOT EXISTS contract_company text;
