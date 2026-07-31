-- Add missing fields to potential_change_orders table
-- These fields mirror Procore's PCO form: change reason, location, reference,
-- request received from, due date, privacy/field change/paid-in-full flags.

ALTER TABLE potential_change_orders
  ADD COLUMN IF NOT EXISTS change_reason text,
  ADD COLUMN IF NOT EXISTS location text,
  ADD COLUMN IF NOT EXISTS reference text,
  ADD COLUMN IF NOT EXISTS request_received_from text,
  ADD COLUMN IF NOT EXISTS due_date date,
  ADD COLUMN IF NOT EXISTS is_private boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS field_change boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS paid_in_full boolean DEFAULT false;
