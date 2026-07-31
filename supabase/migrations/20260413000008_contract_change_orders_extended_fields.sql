-- Migration: Add extended fields to contract_change_orders
ALTER TABLE contract_change_orders
  ADD COLUMN IF NOT EXISTS signed_co_received_date DATE,
  ADD COLUMN IF NOT EXISTS paid_date               DATE,
  ADD COLUMN IF NOT EXISTS request_received_from   TEXT;
