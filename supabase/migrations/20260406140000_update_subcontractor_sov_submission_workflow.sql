-- Align SSOV workflow with invitation + revise/resubmit lifecycle.

ALTER TABLE public.subcontractor_sov_submissions
  ADD COLUMN IF NOT EXISTS invite_sent_at timestamptz NULL,
  ADD COLUMN IF NOT EXISTS invite_sent_by uuid NULL REFERENCES public.people(id) ON DELETE SET NULL;
-- Migrate legacy status label to the lifecycle term used in the UI/API.
UPDATE public.subcontractor_sov_submissions
SET status = 'revise_resubmit'
WHERE status = 'rejected';
ALTER TABLE public.subcontractor_sov_submissions
  DROP CONSTRAINT IF EXISTS subcontractor_sov_submissions_status_check;
ALTER TABLE public.subcontractor_sov_submissions
  ADD CONSTRAINT subcontractor_sov_submissions_status_check
  CHECK (status IN ('draft', 'under_review', 'approved', 'revise_resubmit'));
