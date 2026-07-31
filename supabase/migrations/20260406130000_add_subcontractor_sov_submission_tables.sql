-- Separate Subcontractor SOV workflow from commitment SOV:
-- - A dedicated submission record per subcontract commitment
-- - Dedicated subcontractor-entered SSOV line items

CREATE TABLE IF NOT EXISTS public.subcontractor_sov_submissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id integer NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  commitment_id uuid NOT NULL REFERENCES public.subcontracts(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'under_review', 'approved', 'rejected')),
  submitted_by uuid NULL REFERENCES public.people(id) ON DELETE SET NULL,
  submitted_at timestamptz NULL,
  reviewed_by uuid NULL REFERENCES public.people(id) ON DELETE SET NULL,
  reviewed_at timestamptz NULL,
  review_notes text NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (commitment_id)
);
CREATE TABLE IF NOT EXISTS public.subcontractor_sov_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_id uuid NOT NULL REFERENCES public.subcontractor_sov_submissions(id) ON DELETE CASCADE,
  line_number integer NULL,
  budget_code text NULL,
  description text NULL,
  amount numeric NULL DEFAULT 0,
  billed_to_date numeric NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_ssov_submissions_project_status
  ON public.subcontractor_sov_submissions(project_id, status);
CREATE INDEX IF NOT EXISTS idx_ssov_items_submission
  ON public.subcontractor_sov_items(submission_id, line_number);
DROP TRIGGER IF EXISTS update_subcontractor_sov_submissions_updated_at
  ON public.subcontractor_sov_submissions;
CREATE TRIGGER update_subcontractor_sov_submissions_updated_at
  BEFORE UPDATE ON public.subcontractor_sov_submissions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
DROP TRIGGER IF EXISTS update_subcontractor_sov_items_updated_at
  ON public.subcontractor_sov_items;
CREATE TRIGGER update_subcontractor_sov_items_updated_at
  BEFORE UPDATE ON public.subcontractor_sov_items
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
ALTER TABLE public.subcontractor_sov_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subcontractor_sov_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view SSOV submissions in their projects"
  ON public.subcontractor_sov_submissions
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.users_auth ua
      JOIN public.project_directory_memberships pdm
        ON pdm.person_id = ua.person_id
      WHERE ua.auth_user_id = auth.uid()
        AND pdm.project_id = subcontractor_sov_submissions.project_id
        AND pdm.status = 'active'
    )
  );
CREATE POLICY "Users can manage SSOV submissions in their projects"
  ON public.subcontractor_sov_submissions
  FOR ALL
  USING (
    EXISTS (
      SELECT 1
      FROM public.users_auth ua
      JOIN public.project_directory_memberships pdm
        ON pdm.person_id = ua.person_id
      WHERE ua.auth_user_id = auth.uid()
        AND pdm.project_id = subcontractor_sov_submissions.project_id
        AND pdm.status = 'active'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.users_auth ua
      JOIN public.project_directory_memberships pdm
        ON pdm.person_id = ua.person_id
      WHERE ua.auth_user_id = auth.uid()
        AND pdm.project_id = subcontractor_sov_submissions.project_id
        AND pdm.status = 'active'
    )
  );
CREATE POLICY "Users can view SSOV items in their projects"
  ON public.subcontractor_sov_items
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.subcontractor_sov_submissions s
      JOIN public.users_auth ua ON true
      JOIN public.project_directory_memberships pdm
        ON pdm.person_id = ua.person_id
      WHERE s.id = subcontractor_sov_items.submission_id
        AND ua.auth_user_id = auth.uid()
        AND pdm.project_id = s.project_id
        AND pdm.status = 'active'
    )
  );
CREATE POLICY "Users can manage SSOV items in their projects"
  ON public.subcontractor_sov_items
  FOR ALL
  USING (
    EXISTS (
      SELECT 1
      FROM public.subcontractor_sov_submissions s
      JOIN public.users_auth ua ON true
      JOIN public.project_directory_memberships pdm
        ON pdm.person_id = ua.person_id
      WHERE s.id = subcontractor_sov_items.submission_id
        AND ua.auth_user_id = auth.uid()
        AND pdm.project_id = s.project_id
        AND pdm.status = 'active'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.subcontractor_sov_submissions s
      JOIN public.users_auth ua ON true
      JOIN public.project_directory_memberships pdm
        ON pdm.person_id = ua.person_id
      WHERE s.id = subcontractor_sov_items.submission_id
        AND ua.auth_user_id = auth.uid()
        AND pdm.project_id = s.project_id
        AND pdm.status = 'active'
    )
  );
