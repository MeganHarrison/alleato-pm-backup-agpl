CREATE TABLE IF NOT EXISTS public.app_page_access_policies (
  route text PRIMARY KEY,
  access_level text NOT NULL DEFAULT 'signed_in',
  permission_module text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  CONSTRAINT app_page_access_policies_access_level_check CHECK (
    access_level = ANY (
      ARRAY[
        'public',
        'signed_in',
        'project_member',
        'module_read',
        'module_write',
        'module_admin',
        'app_admin',
        'developer'
      ]
    )
  ),
  CONSTRAINT app_page_access_policies_module_check CHECK (
    permission_module IS NULL
    OR permission_module = ANY (
      ARRAY[
        'directory',
        'budget',
        'contracts',
        'documents',
        'schedule',
        'submittals',
        'rfis',
        'change_orders'
      ]
    )
  ),
  CONSTRAINT app_page_access_policies_module_required_check CHECK (
    (
      access_level IN ('module_read', 'module_write', 'module_admin')
      AND permission_module IS NOT NULL
    )
    OR (
      access_level NOT IN ('module_read', 'module_write', 'module_admin')
      AND permission_module IS NULL
    )
  )
);

COMMENT ON TABLE public.app_page_access_policies IS
  'Admin-managed route access inventory. Records explicit per-page access levels so page visibility decisions are reviewable and auditable.';

COMMENT ON COLUMN public.app_page_access_policies.route IS
  'Concrete route pattern from the generated app route inventory, such as /[projectId]/budget.';

COMMENT ON COLUMN public.app_page_access_policies.access_level IS
  'Required access gate for this page: public, signed_in, project_member, module_read, module_write, module_admin, app_admin, or developer.';

COMMENT ON COLUMN public.app_page_access_policies.permission_module IS
  'Required permission module when access_level is module_read, module_write, or module_admin.';

CREATE INDEX IF NOT EXISTS idx_app_page_access_policies_access_level
  ON public.app_page_access_policies (access_level);

CREATE INDEX IF NOT EXISTS idx_app_page_access_policies_permission_module
  ON public.app_page_access_policies (permission_module);

DROP TRIGGER IF EXISTS update_app_page_access_policies_updated_at
  ON public.app_page_access_policies;

CREATE TRIGGER update_app_page_access_policies_updated_at
  BEFORE UPDATE ON public.app_page_access_policies
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.app_page_access_policies ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS app_page_access_policies_select_admin
  ON public.app_page_access_policies;
CREATE POLICY app_page_access_policies_select_admin
  ON public.app_page_access_policies
  FOR SELECT
  TO authenticated
  USING (public.current_is_app_admin());

DROP POLICY IF EXISTS app_page_access_policies_write_admin
  ON public.app_page_access_policies;
CREATE POLICY app_page_access_policies_write_admin
  ON public.app_page_access_policies
  FOR ALL
  TO authenticated
  USING (public.current_is_app_admin())
  WITH CHECK (public.current_is_app_admin());

DROP POLICY IF EXISTS app_page_access_policies_service_role
  ON public.app_page_access_policies;
CREATE POLICY app_page_access_policies_service_role
  ON public.app_page_access_policies
  TO service_role
  USING (true)
  WITH CHECK (true);
