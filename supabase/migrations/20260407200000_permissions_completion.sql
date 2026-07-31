-- ============================================================================
-- PERMISSIONS COMPLETION
-- 1. user_module_permissions  — per-user per-module overrides for all modules
-- 2. permission_audit_log     — immutable audit trail for permission changes
-- 3. Fix RLS on permission_templates  — restrict writes to app admins only
-- 4. Seed 5 default system permission templates
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. user_module_permissions
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.user_module_permissions (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id   INTEGER NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  person_id    UUID    NOT NULL REFERENCES public.people(id)   ON DELETE CASCADE,
  module       TEXT    NOT NULL,
  level        TEXT    NOT NULL CHECK (level IN ('none','read','write','admin')),
  updated_by   UUID    REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (project_id, person_id, module)
);
ALTER TABLE public.user_module_permissions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ump_select" ON public.user_module_permissions
  FOR SELECT TO authenticated
  USING (
    project_id IN (
      SELECT pdm.project_id
      FROM public.project_directory_memberships pdm
      JOIN public.users_auth ua ON ua.person_id = pdm.person_id
      WHERE ua.auth_user_id = auth.uid() AND pdm.status = 'active'
    )
  );
CREATE POLICY "ump_write" ON public.user_module_permissions
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
-- ----------------------------------------------------------------------------
-- 2. permission_audit_log
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.permission_audit_log (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id   INTEGER NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  person_id    UUID    NOT NULL REFERENCES public.people(id)   ON DELETE CASCADE,
  changed_by   UUID    REFERENCES auth.users(id) ON DELETE SET NULL,
  action       TEXT    NOT NULL,
  module       TEXT,
  old_level    TEXT,
  new_level    TEXT,
  template_id  UUID    REFERENCES public.permission_templates(id),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.permission_audit_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "pal_select" ON public.permission_audit_log
  FOR SELECT TO authenticated
  USING (
    project_id IN (
      SELECT pdm.project_id
      FROM public.project_directory_memberships pdm
      JOIN public.users_auth ua ON ua.person_id = pdm.person_id
      WHERE ua.auth_user_id = auth.uid() AND pdm.status = 'active'
    )
  );
CREATE POLICY "pal_insert" ON public.permission_audit_log
  FOR INSERT TO authenticated
  WITH CHECK (
    project_id IN (
      SELECT pdm.project_id
      FROM public.project_directory_memberships pdm
      JOIN public.users_auth ua ON ua.person_id = pdm.person_id
      WHERE ua.auth_user_id = auth.uid() AND pdm.status = 'active'
    )
    OR EXISTS (
      SELECT 1 FROM public.user_profiles
      WHERE id = auth.uid() AND is_admin = true
    )
  );
CREATE INDEX IF NOT EXISTS idx_pal_project_person
  ON public.permission_audit_log (project_id, person_id);
-- ----------------------------------------------------------------------------
-- 3. Fix RLS on permission_templates — restrict mutations to app admins
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "permission_templates_insert" ON public.permission_templates;
DROP POLICY IF EXISTS "permission_templates_update" ON public.permission_templates;
DROP POLICY IF EXISTS "permission_templates_delete" ON public.permission_templates;
CREATE POLICY "pt_insert" ON public.permission_templates
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_profiles
      WHERE id = auth.uid() AND is_admin = true
    )
  );
CREATE POLICY "pt_update" ON public.permission_templates
  FOR UPDATE TO authenticated
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
CREATE POLICY "pt_delete" ON public.permission_templates
  FOR DELETE TO authenticated
  USING (
    is_system = false AND
    EXISTS (
      SELECT 1 FROM public.user_profiles
      WHERE id = auth.uid() AND is_admin = true
    )
  );
-- ----------------------------------------------------------------------------
-- 4. Seed default system permission templates
-- ----------------------------------------------------------------------------
INSERT INTO public.permission_templates (name, description, scope, is_system, rules_json)
SELECT name, description, scope, is_system, rules_json
FROM (VALUES
  (
    'Owner / Client',
    'Read-only access to all modules. Suitable for project owners and clients.',
    'project',
    true,
    '{"directory":["read"],"budget":["read"],"contracts":["read"],"documents":["read"],"schedule":["read"],"submittals":["read"],"rfis":["read"],"change_orders":["read"]}'::jsonb
  ),
  (
    'Project Manager',
    'Full write access to all modules except cannot administer directory or permissions.',
    'project',
    true,
    '{"directory":["read","write"],"budget":["read","write","admin"],"contracts":["read","write","admin"],"documents":["read","write"],"schedule":["read","write","admin"],"submittals":["read","write","admin"],"rfis":["read","write","admin"],"change_orders":["read","write","admin"]}'::jsonb
  ),
  (
    'Field Engineer',
    'Write access for field modules (RFIs, submittals, schedule, documents). Read-only for financials.',
    'project',
    true,
    '{"directory":["read"],"budget":["read"],"contracts":["read"],"documents":["read","write"],"schedule":["read","write"],"submittals":["read","write"],"rfis":["read","write"],"change_orders":["read"]}'::jsonb
  ),
  (
    'Subcontractor',
    'Read-only for most modules. Can create and respond to RFIs and submittals.',
    'project',
    true,
    '{"directory":["read"],"budget":["none"],"contracts":["read"],"documents":["read"],"schedule":["read"],"submittals":["read","write"],"rfis":["read","write"],"change_orders":["read"]}'::jsonb
  ),
  (
    'Read Only',
    'View-only access to all modules. No write permissions.',
    'project',
    true,
    '{"directory":["read"],"budget":["read"],"contracts":["read"],"documents":["read"],"schedule":["read"],"submittals":["read"],"rfis":["read"],"change_orders":["read"]}'::jsonb
  )
) AS v(name, description, scope, is_system, rules_json)
WHERE NOT EXISTS (
  SELECT 1 FROM public.permission_templates pt
  WHERE pt.name = v.name AND pt.is_system = true
);
