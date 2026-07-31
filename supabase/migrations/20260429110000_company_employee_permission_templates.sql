-- Company-wide employee permission templates
--
-- The user-management UI separates project-limited templates from company-wide
-- templates. Template names therefore need to be unique within a scope, not
-- globally, so employees can choose "Project Manager" for all projects or for
-- specific projects without learning a second naming system.

BEGIN;
DROP INDEX IF EXISTS public.permission_templates_name_unique;
CREATE UNIQUE INDEX IF NOT EXISTS permission_templates_scope_name_unique
  ON public.permission_templates (scope, name);
INSERT INTO public.permission_templates (
  name,
  description,
  scope,
  is_system,
  rules_json,
  granular_flags
)
VALUES
  (
    'Admin',
    'Full application access across every project and admin-only company tools.',
    'company',
    true,
    '{
      "directory":     ["read","write","admin"],
      "budget":        ["read","write","admin"],
      "contracts":     ["read","write","admin"],
      "documents":     ["read","write","admin"],
      "schedule":      ["read","write","admin"],
      "submittals":    ["read","write","admin"],
      "rfis":          ["read","write","admin"],
      "change_orders": ["read","write","admin"]
    }'::jsonb,
    ARRAY[
      'view_private_commitments',
      'edit_own_ssov',
      'bulk_edit_subcontractor_invoice_status',
      'approve_change_orders',
      'approve_invoices',
      'create_change_events',
      'create_budget_modifications',
      'manage_project_directory'
    ]
  ),
  (
    'Project Manager',
    'Company-wide project manager access across every current and future project.',
    'company',
    true,
    '{
      "directory":     ["read","write"],
      "budget":        ["read","write","admin"],
      "contracts":     ["read","write","admin"],
      "documents":     ["read","write"],
      "schedule":      ["read","write","admin"],
      "submittals":    ["read","write","admin"],
      "rfis":          ["read","write","admin"],
      "change_orders": ["read","write","admin"]
    }'::jsonb,
    ARRAY[
      'view_private_commitments',
      'bulk_edit_subcontractor_invoice_status',
      'approve_change_orders',
      'approve_invoices',
      'create_change_events',
      'create_budget_modifications',
      'manage_project_directory'
    ]
  ),
  (
    'Superintendent',
    'Company-wide field operations access across every current and future project.',
    'company',
    true,
    '{
      "directory":     ["read"],
      "budget":        ["read"],
      "contracts":     ["read"],
      "documents":     ["read","write"],
      "schedule":      ["read","write","admin"],
      "submittals":    ["read","write"],
      "rfis":          ["read","write"],
      "change_orders": ["read"]
    }'::jsonb,
    ARRAY[
      'create_change_events',
      'manage_project_directory'
    ]
  )
ON CONFLICT (scope, name) DO UPDATE
SET description = EXCLUDED.description,
    is_system = true,
    rules_json = EXCLUDED.rules_json,
    granular_flags = EXCLUDED.granular_flags,
    updated_at = now();
WITH admin_template AS (
  SELECT id
  FROM public.permission_templates
  WHERE scope = 'company'
    AND name = 'Admin'
  LIMIT 1
),
admin_people AS (
  SELECT p.id AS person_id, up.id AS auth_user_id
  FROM public.user_profiles up
  JOIN public.people p ON p.auth_user_id = up.id
  WHERE up.is_admin = true
)
INSERT INTO public.person_company_templates (
  person_id,
  template_id,
  assigned_by,
  assigned_at
)
SELECT admin_people.person_id, admin_template.id, admin_people.auth_user_id, now()
FROM admin_people
CROSS JOIN admin_template
ON CONFLICT (person_id) DO UPDATE
SET template_id = EXCLUDED.template_id,
    assigned_by = EXCLUDED.assigned_by,
    assigned_at = EXCLUDED.assigned_at;
COMMIT;
