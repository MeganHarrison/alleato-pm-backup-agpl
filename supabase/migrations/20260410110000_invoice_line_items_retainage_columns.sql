-- Add missing retainage columns to subcontractor_invoice_line_items
-- to match Procore's G703 retainage breakdown

-- Split retainage_released into work/materials components
ALTER TABLE subcontractor_invoice_line_items
  ADD COLUMN IF NOT EXISTS work_retainage_released numeric DEFAULT 0 NOT NULL,
  ADD COLUMN IF NOT EXISTS materials_retainage_released numeric DEFAULT 0 NOT NULL;
-- Copy existing retainage_released to work_retainage_released (was only tracking work)
UPDATE subcontractor_invoice_line_items
  SET work_retainage_released = retainage_released
  WHERE retainage_released != 0;
-- Add budget_code column for G703 display
ALTER TABLE subcontractor_invoice_line_items
  ADD COLUMN IF NOT EXISTS budget_code text;
-- Add the same missing columns to owner_invoice_line_items
ALTER TABLE owner_invoice_line_items
  ADD COLUMN IF NOT EXISTS previous_work_retainage numeric DEFAULT 0 NOT NULL,
  ADD COLUMN IF NOT EXISTS previous_materials_retainage numeric DEFAULT 0 NOT NULL,
  ADD COLUMN IF NOT EXISTS work_retainage_released numeric DEFAULT 0 NOT NULL,
  ADD COLUMN IF NOT EXISTS materials_retainage_released numeric DEFAULT 0 NOT NULL,
  ADD COLUMN IF NOT EXISTS budget_code text;
-- Change owner_invoices.status from text to use invoice_status enum
-- First check if the enum type exists
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'invoice_status') THEN
    -- The enum exists, alter the column to use it
    ALTER TABLE owner_invoices
      ALTER COLUMN status TYPE invoice_status
      USING status::invoice_status;
  END IF;
END $$;
