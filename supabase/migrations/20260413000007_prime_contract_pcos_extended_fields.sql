-- Migration: Add extended fields to prime_contract_pcos
-- Matches the field set on prime_contract_change_orders for consistency

ALTER TABLE prime_contract_pcos
  ADD COLUMN IF NOT EXISTS revision            INTEGER        DEFAULT 0,
  ADD COLUMN IF NOT EXISTS change_reason       TEXT,
  ADD COLUMN IF NOT EXISTS is_private          BOOLEAN        DEFAULT FALSE NOT NULL,
  ADD COLUMN IF NOT EXISTS executed            BOOLEAN        DEFAULT FALSE NOT NULL,
  ADD COLUMN IF NOT EXISTS signed_co_received_date DATE,
  ADD COLUMN IF NOT EXISTS request_received_from   TEXT,
  ADD COLUMN IF NOT EXISTS location            TEXT,
  ADD COLUMN IF NOT EXISTS field_change        BOOLEAN        DEFAULT FALSE NOT NULL,
  ADD COLUMN IF NOT EXISTS reference           TEXT,
  ADD COLUMN IF NOT EXISTS paid_in_full        BOOLEAN        DEFAULT FALSE NOT NULL;
