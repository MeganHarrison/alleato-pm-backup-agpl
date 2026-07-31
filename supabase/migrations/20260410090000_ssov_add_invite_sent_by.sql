-- Ensure invite sender actor column exists for SSOV notification workflow.
ALTER TABLE public.subcontractor_sov_submissions
  ADD COLUMN IF NOT EXISTS invite_sent_by uuid REFERENCES public.people(id) ON DELETE SET NULL;
