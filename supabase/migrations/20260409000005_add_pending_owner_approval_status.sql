-- Add 'pending_owner_approval' to the invoice_status enum
-- Procore supports this status on subcontractor invoices for the intermediate
-- state where the GC has reviewed but the owner still needs to sign off before
-- the cost reflects in the budget.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum
    WHERE enumtypid = 'invoice_status'::regtype
      AND enumlabel = 'pending_owner_approval'
  ) THEN
    ALTER TYPE invoice_status ADD VALUE 'pending_owner_approval';
  END IF;
END $$;
