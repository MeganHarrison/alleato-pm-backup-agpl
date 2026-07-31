-- ============================================================================
-- USER GRANULAR PERMISSION OVERRIDES
--
-- Lets admins grant or deny named granular capabilities for a specific user
-- without cloning role templates. This supports onboarding guardrails such as:
-- "Project Manager, but cannot approve change orders yet."
-- ============================================================================

BEGIN;
CREATE TABLE IF NOT EXISTS public.user_granular_permission_overrides (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id  INTEGER REFERENCES public.projects(id) ON DELETE CASCADE,
  person_id   UUID    NOT NULL REFERENCES public.people(id) ON DELETE CASCADE,
  flag        TEXT    NOT NULL,
  effect      TEXT    NOT NULL CHECK (effect IN ('allow', 'deny')),
  updated_by  UUID    REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS ugpo_company_unique
  ON public.user_granular_permission_overrides (person_id, flag)
  WHERE project_id IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS ugpo_project_unique
  ON public.user_granular_permission_overrides (project_id, person_id, flag)
  WHERE project_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_ugpo_person
  ON public.user_granular_permission_overrides (person_id);
ALTER TABLE public.user_granular_permission_overrides ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ugpo_select" ON public.user_granular_permission_overrides
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_profiles
      WHERE id = auth.uid() AND is_admin = true
    )
    OR EXISTS (
      SELECT 1 FROM public.users_auth ua
      WHERE ua.person_id = user_granular_permission_overrides.person_id
        AND ua.auth_user_id = auth.uid()
    )
    OR (
      project_id IS NOT NULL
      AND project_id IN (
        SELECT pdm.project_id
        FROM public.project_directory_memberships pdm
        JOIN public.users_auth ua ON ua.person_id = pdm.person_id
        WHERE ua.auth_user_id = auth.uid()
          AND pdm.status = 'active'
      )
    )
  );
CREATE POLICY "ugpo_write" ON public.user_granular_permission_overrides
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_profiles
      WHERE id = auth.uid() AND is_admin = true
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_profiles
      WHERE id = auth.uid() AND is_admin = true
    )
  );
-- Seed the all-project system role requested by AAI-141/AAI-162.
INSERT INTO public.permission_templates (
  name,
  description,
  scope,
  is_system,
  rules_json,
  granular_flags
)
SELECT
  'Senior Project Manager',
  'All-project access for senior PMs who should inherit project-manager permissions across current and future projects.',
  'company',
  true,
  '{"directory":["read","write"],"budget":["read","write","admin"],"contracts":["read","write","admin"],"documents":["read","write"],"schedule":["read","write","admin"],"submittals":["read","write","admin"],"rfis":["read","write","admin"],"change_orders":["read","write","admin"]}'::jsonb,
  ARRAY[
    'view_private_commitments',
    'bulk_edit_subcontractor_invoice_status',
    'approve_change_orders',
    'approve_invoices',
    'create_change_events',
    'create_budget_modifications',
    'manage_project_directory'
  ]
WHERE NOT EXISTS (
  SELECT 1
  FROM public.permission_templates
  WHERE name = 'Senior Project Manager'
    AND scope = 'company'
);
COMMIT;
