-- Subcontractor SOV: submissions tracking table
CREATE TABLE IF NOT EXISTS public.subcontractor_sov_submissions (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id      integer NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  commitment_id   uuid NOT NULL REFERENCES public.subcontracts(id) ON DELETE CASCADE,
  status          text NOT NULL DEFAULT 'draft'
                    CHECK (status IN ('draft', 'under_review', 'approved', 'revise_resubmit')),
  submitted_at    timestamptz,
  reviewed_at     timestamptz,
  review_notes    text,
  invite_sent_at  timestamptz,
  created_at      timestamptz DEFAULT now(),
  updated_at      timestamptz DEFAULT now(),
  UNIQUE (commitment_id)
);
-- Subcontractor SOV: line items per submission
CREATE TABLE IF NOT EXISTS public.subcontractor_sov_items (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_id  uuid NOT NULL REFERENCES public.subcontractor_sov_submissions(id) ON DELETE CASCADE,
  line_number    integer,
  budget_code    text,
  description    text,
  amount         numeric(15,2) NOT NULL DEFAULT 0,
  billed_to_date numeric(15,2) NOT NULL DEFAULT 0,
  created_at     timestamptz DEFAULT now(),
  updated_at     timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_ssov_submissions_commitment
  ON public.subcontractor_sov_submissions(commitment_id);
CREATE INDEX IF NOT EXISTS idx_ssov_items_submission
  ON public.subcontractor_sov_items(submission_id);
-- RLS
ALTER TABLE public.subcontractor_sov_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subcontractor_sov_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Project members can access subcontractor SOV submissions"
  ON public.subcontractor_sov_submissions
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.project_directory_memberships pdm
      JOIN public.users_auth ua ON ua.person_id = pdm.person_id
      WHERE pdm.project_id = subcontractor_sov_submissions.project_id
        AND ua.auth_user_id = auth.uid()
        AND pdm.status = 'active'
    )
  );
CREATE POLICY "Project members can access subcontractor SOV items"
  ON public.subcontractor_sov_items
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.subcontractor_sov_submissions s
      JOIN public.project_directory_memberships pdm ON pdm.project_id = s.project_id
      JOIN public.users_auth ua ON ua.person_id = pdm.person_id
      WHERE s.id = subcontractor_sov_items.submission_id
        AND ua.auth_user_id = auth.uid()
        AND pdm.status = 'active'
    )
  );
