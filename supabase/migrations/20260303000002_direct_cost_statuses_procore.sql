-- Align direct cost statuses with Procore workflow
-- Draft, Pending, Revise and Resubmit, Approved

-- Drop the old constraint first so data updates don't violate it
ALTER TABLE public.direct_costs
DROP CONSTRAINT IF EXISTS direct_costs_status_check;
-- Normalize legacy statuses to new Procore-aligned values
UPDATE public.direct_costs
SET status = 'Revise and Resubmit'
WHERE status = 'Rejected';
UPDATE public.direct_costs
SET status = 'Approved'
WHERE status = 'Paid';
-- Also normalize any other unexpected values to Draft as a safe fallback
UPDATE public.direct_costs
SET status = 'Draft'
WHERE status NOT IN ('Draft', 'Pending', 'Revise and Resubmit', 'Approved');
-- Add the new tightened constraint
ALTER TABLE public.direct_costs
ADD CONSTRAINT direct_costs_status_check
CHECK (
  status = ANY (
    ARRAY[
      'Draft'::text,
      'Pending'::text,
      'Revise and Resubmit'::text,
      'Approved'::text
    ]
  )
);
