-- Add missing actor columns to subcontractor_sov_submissions
ALTER TABLE public.subcontractor_sov_submissions
  ADD COLUMN IF NOT EXISTS submitted_by uuid REFERENCES public.people(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS reviewed_by  uuid REFERENCES public.people(id) ON DELETE SET NULL;
