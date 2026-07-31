-- Add notes column to owner_invoices so void reasons and other annotations can persist
ALTER TABLE owner_invoices ADD COLUMN IF NOT EXISTS notes TEXT;
