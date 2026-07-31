-- Fix invoice status enum to match Procore workflow
-- Procore owner statuses:        DRAFT → UNDER_REVIEW → APPROVED (or REVISE_AND_RESUBMIT)
-- Procore subcontractor statuses: NOT_INVITED → INVITED → UNDER_REVIEW → APPROVED (or REVISE_AND_RESUBMIT)
-- Previous enum:                  draft | pending | approved | paid | void
-- New enum adds:                  under_review | revise_and_resubmit | not_invited | invited
-- Keeps:                          draft | approved | paid | void
-- Renames:                        pending → under_review (data migration below)

-- Step 1: Add new values to the existing enum (if it exists as a type)
DO $$
BEGIN
  -- Add under_review
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum
    WHERE enumtypid = 'invoice_status'::regtype AND enumlabel = 'under_review'
  ) THEN
    ALTER TYPE invoice_status ADD VALUE 'under_review';
  END IF;

  -- Add revise_and_resubmit
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum
    WHERE enumtypid = 'invoice_status'::regtype AND enumlabel = 'revise_and_resubmit'
  ) THEN
    ALTER TYPE invoice_status ADD VALUE 'revise_and_resubmit';
  END IF;

  -- Add not_invited (subcontractor workflow)
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum
    WHERE enumtypid = 'invoice_status'::regtype AND enumlabel = 'not_invited'
  ) THEN
    ALTER TYPE invoice_status ADD VALUE 'not_invited';
  END IF;

  -- Add invited (subcontractor workflow)
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum
    WHERE enumtypid = 'invoice_status'::regtype AND enumlabel = 'invited'
  ) THEN
    ALTER TYPE invoice_status ADD VALUE 'invited';
  END IF;

EXCEPTION
  WHEN undefined_object THEN
    -- invoice_status type doesn't exist yet — create it fresh with all values
    CREATE TYPE invoice_status AS ENUM (
      'draft',
      'under_review',
      'approved',
      'revise_and_resubmit',
      'paid',
      'void',
      'not_invited',
      'invited'
    );
END $$;
-- Step 2: Migrate existing 'pending' rows to 'under_review'
-- (pending was the old name for the same workflow state)
UPDATE owner_invoices
SET status = 'under_review'
WHERE status = 'pending';
-- Step 3: Migrate existing 'submitted' rows to 'under_review'
-- (submitted was the old name before aligning with Procore terminology)
UPDATE owner_invoices
SET status = 'under_review'
WHERE status = 'submitted';
-- Step 4: Add performance indexes that were missing
CREATE INDEX IF NOT EXISTS idx_owner_invoices_status
  ON owner_invoices(status);
CREATE INDEX IF NOT EXISTS idx_owner_invoices_billing_period_id
  ON owner_invoices(billing_period_id);
CREATE INDEX IF NOT EXISTS idx_owner_invoices_prime_contract_status
  ON owner_invoices(prime_contract_id, status);
-- Step 5: Add missing financial columns to owner_invoices
ALTER TABLE owner_invoices
  ADD COLUMN IF NOT EXISTS gross_amount        numeric(15, 2),
  ADD COLUMN IF NOT EXISTS net_amount          numeric(15, 2),
  ADD COLUMN IF NOT EXISTS paid_amount         numeric(15, 2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS percent_complete    numeric(5, 2),
  ADD COLUMN IF NOT EXISTS due_date            date,
  ADD COLUMN IF NOT EXISTS billing_date        date;
-- Step 6: Add name column to billing_periods for display labels
ALTER TABLE billing_periods
  ADD COLUMN IF NOT EXISTS name varchar(255);
-- Backfill name from date range for existing rows
UPDATE billing_periods
SET name = to_char(start_date, 'MM/DD/YY') || ' - ' || to_char(end_date, 'MM/DD/YY')
WHERE name IS NULL AND start_date IS NOT NULL AND end_date IS NOT NULL;
