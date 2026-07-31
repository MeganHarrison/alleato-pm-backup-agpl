-- Add Acumatica sync columns to vendors table (Phase 1A of Acumatica integration)
ALTER TABLE vendors ADD COLUMN IF NOT EXISTS acumatica_vendor_id TEXT;
ALTER TABLE vendors ADD COLUMN IF NOT EXISTS acumatica_sync_at TIMESTAMPTZ;
CREATE UNIQUE INDEX IF NOT EXISTS vendors_acumatica_vendor_id_key
  ON vendors (acumatica_vendor_id)
  WHERE acumatica_vendor_id IS NOT NULL;
