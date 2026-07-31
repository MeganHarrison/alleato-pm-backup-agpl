CREATE TABLE IF NOT EXISTS public.app_page_role_access_policies (
  route text PRIMARY KEY,
  enforcement_mode text NOT NULL DEFAULT 'explicit_allowlist',
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  CONSTRAINT app_page_role_access_policies_route_check CHECK (route LIKE '/%'),
  CONSTRAINT app_page_role_access_policies_enforcement_mode_check CHECK (
    enforcement_mode = ANY (ARRAY['inherit_requirement', 'explicit_allowlist'])
  )
);

CREATE TABLE IF NOT EXISTS public.app_page_role_access_policy_templates (
  route text NOT NULL REFERENCES public.app_page_role_access_policies(route) ON DELETE CASCADE,
  permission_template_id uuid NOT NULL REFERENCES public.permission_templates(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  PRIMARY KEY (route, permission_template_id)
);

COMMENT ON TABLE public.app_page_role_access_policies IS
  'Admin-managed project-page role access policy. Presence of a route row makes the route policy explicit; child rows define allowed permission templates.';

COMMENT ON COLUMN public.app_page_role_access_policies.route IS
  'Canonical route pattern from the app inventory, such as /[projectId]/budget.';

COMMENT ON COLUMN public.app_page_role_access_policies.enforcement_mode IS
  'inherit_requirement keeps existing module/member behavior; explicit_allowlist restricts the route to listed permission templates.';

COMMENT ON TABLE public.app_page_role_access_policy_templates IS
  'Allowed permission templates for an explicit page-role access policy.';

CREATE INDEX IF NOT EXISTS idx_app_page_role_access_policy_templates_template
  ON public.app_page_role_access_policy_templates (permission_template_id);

DROP TRIGGER IF EXISTS update_app_page_role_access_policies_updated_at
  ON public.app_page_role_access_policies;

CREATE TRIGGER update_app_page_role_access_policies_updated_at
  BEFORE UPDATE ON public.app_page_role_access_policies
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.app_page_role_access_policies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_page_role_access_policy_templates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS app_page_role_access_policies_select_admin
  ON public.app_page_role_access_policies;
CREATE POLICY app_page_role_access_policies_select_admin
  ON public.app_page_role_access_policies
  FOR SELECT
  TO authenticated
  USING (public.current_is_app_admin());

DROP POLICY IF EXISTS app_page_role_access_policies_write_admin
  ON public.app_page_role_access_policies;
CREATE POLICY app_page_role_access_policies_write_admin
  ON public.app_page_role_access_policies
  FOR ALL
  TO authenticated
  USING (public.current_is_app_admin())
  WITH CHECK (public.current_is_app_admin());

DROP POLICY IF EXISTS app_page_role_access_policies_service_role
  ON public.app_page_role_access_policies;
CREATE POLICY app_page_role_access_policies_service_role
  ON public.app_page_role_access_policies
  TO service_role
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS app_page_role_access_policy_templates_select_admin
  ON public.app_page_role_access_policy_templates;
CREATE POLICY app_page_role_access_policy_templates_select_admin
  ON public.app_page_role_access_policy_templates
  FOR SELECT
  TO authenticated
  USING (public.current_is_app_admin());

DROP POLICY IF EXISTS app_page_role_access_policy_templates_write_admin
  ON public.app_page_role_access_policy_templates;
CREATE POLICY app_page_role_access_policy_templates_write_admin
  ON public.app_page_role_access_policy_templates
  FOR ALL
  TO authenticated
  USING (public.current_is_app_admin())
  WITH CHECK (public.current_is_app_admin());

DROP POLICY IF EXISTS app_page_role_access_policy_templates_service_role
  ON public.app_page_role_access_policy_templates;
CREATE POLICY app_page_role_access_policy_templates_service_role
  ON public.app_page_role_access_policy_templates
  TO service_role
  USING (true)
  WITH CHECK (true);
