-- Phase 5: Align commitment status values with Procore spec
-- Procore spec: Draft | Out for Bid | Out for Signature | Approved | Complete | Terminated
-- Ref: PRPs/commitments/TASKS.md

-- Drop old CHECK first so the data migration does not violate it
ALTER TABLE public.subcontracts DROP CONSTRAINT IF EXISTS subcontracts_status_check;
ALTER TABLE public.purchase_orders DROP CONSTRAINT IF EXISTS purchase_orders_status_check;
-- Map legacy values to Procore spec (case-insensitive)
UPDATE public.subcontracts SET status = CASE lower(status)
  WHEN 'draft' THEN 'Draft'
  WHEN 'sent' THEN 'Out for Bid'
  WHEN 'pending' THEN 'Out for Signature'
  WHEN 'approved' THEN 'Approved'
  WHEN 'executed' THEN 'Approved'
  WHEN 'closed' THEN 'Complete'
  WHEN 'complete' THEN 'Complete'
  WHEN 'void' THEN 'Terminated'
  WHEN 'terminated' THEN 'Terminated'
  WHEN 'out for bid' THEN 'Out for Bid'
  WHEN 'out for signature' THEN 'Out for Signature'
  ELSE 'Draft'
END
WHERE status IS NOT NULL;
UPDATE public.purchase_orders SET status = CASE lower(status)
  WHEN 'draft' THEN 'Draft'
  WHEN 'sent' THEN 'Out for Bid'
  WHEN 'pending' THEN 'Out for Signature'
  WHEN 'acknowledged' THEN 'Out for Signature'
  WHEN 'approved' THEN 'Approved'
  WHEN 'executed' THEN 'Approved'
  WHEN 'completed' THEN 'Complete'
  WHEN 'closed' THEN 'Complete'
  WHEN 'complete' THEN 'Complete'
  WHEN 'void' THEN 'Terminated'
  WHEN 'terminated' THEN 'Terminated'
  WHEN 'out for bid' THEN 'Out for Bid'
  WHEN 'out for signature' THEN 'Out for Signature'
  ELSE 'Draft'
END
WHERE status IS NOT NULL;
-- Re-add CHECK constraints with Procore spec values
ALTER TABLE public.subcontracts ADD CONSTRAINT subcontracts_status_check
  CHECK (status IN ('Draft','Out for Bid','Out for Signature','Approved','Complete','Terminated'));
ALTER TABLE public.purchase_orders ADD CONSTRAINT purchase_orders_status_check
  CHECK (status IN ('Draft','Out for Bid','Out for Signature','Approved','Complete','Terminated'));
