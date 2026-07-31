-- Add missing fields to commitment_pcos to match Procore's PCO form
-- These fields mirror what exists on contract_change_orders

ALTER TABLE commitment_pcos
  ADD COLUMN IF NOT EXISTS change_reason text,
  ADD COLUMN IF NOT EXISTS revision integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS is_private boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS executed boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS signed_co_received_date date,
  ADD COLUMN IF NOT EXISTS requested_by text,
  ADD COLUMN IF NOT EXISTS location text,
  ADD COLUMN IF NOT EXISTS field_change boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS reference text,
  ADD COLUMN IF NOT EXISTS paid_in_full boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS contract_company text;
