-- Persist per-project Submittals tool settings.
-- Mirrors Procore project-level Submittals configuration defaults used when
-- creating and routing new submittals.

CREATE TABLE IF NOT EXISTS public.submittal_project_settings (
  project_id integer PRIMARY KEY REFERENCES public.projects(id) ON DELETE CASCADE,
  default_submittal_manager_id uuid NULL,
  default_distribution text NULL,
  package_sort_order text NOT NULL DEFAULT 'ascending'
    CHECK (package_sort_order IN ('ascending', 'descending')),
  default_submit_response_days integer NOT NULL DEFAULT 14
    CHECK (default_submit_response_days BETWEEN 0 AND 365),
  include_spec_section_number boolean NOT NULL DEFAULT true,
  submittals_private_by_default boolean NOT NULL DEFAULT false,
  allow_approvers_to_add_reviewers boolean NOT NULL DEFAULT true,
  approver_responses_required_by_default boolean NOT NULL DEFAULT true,
  enable_reject_workflow boolean NOT NULL DEFAULT false,
  enable_dynamic_approver_due_dates boolean NOT NULL DEFAULT false,
  enable_overdue_email_reminders boolean NOT NULL DEFAULT true,
  enable_qr_codes boolean NOT NULL DEFAULT false,
  enable_schedule_calculations boolean NOT NULL DEFAULT false,
  allow_email_attachment_download_without_login boolean NOT NULL DEFAULT false,
  email_notify_submittal_created boolean NOT NULL DEFAULT true,
  email_notify_submittal_updated boolean NOT NULL DEFAULT true,
  email_notify_submittal_distributed boolean NOT NULL DEFAULT true,
  email_notify_submittal_closed boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid NULL REFERENCES auth.users(id)
);

DROP TRIGGER IF EXISTS submittal_project_settings_updated_at
  ON public.submittal_project_settings;
CREATE TRIGGER submittal_project_settings_updated_at
  BEFORE UPDATE ON public.submittal_project_settings
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.submittal_project_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS submittal_project_settings_select
  ON public.submittal_project_settings;
DROP POLICY IF EXISTS submittal_project_settings_insert
  ON public.submittal_project_settings;
DROP POLICY IF EXISTS submittal_project_settings_update
  ON public.submittal_project_settings;

CREATE POLICY submittal_project_settings_select
  ON public.submittal_project_settings
  FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY submittal_project_settings_insert
  ON public.submittal_project_settings
  FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY submittal_project_settings_update
  ON public.submittal_project_settings
  FOR UPDATE
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);
