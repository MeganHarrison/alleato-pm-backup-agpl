-- Dedupe permission_templates and prevent future duplicates
--
-- Context: production had 38 rows including 30 "Project Manager" and 2
-- "Subcontractor" duplicates. No FK references pointed at the duplicates
-- (project_directory_memberships.permission_template_id, permission_audit_log.template_id),
-- so deletion is safe. Root cause: the permissive RLS policies
-- `authenticated_insert_permission_templates` / `authenticated_update_permission_templates`
-- allowed any authenticated user to insert templates, and no unique constraint
-- existed on (name) for system templates.

BEGIN;
-- 1. Delete duplicate rows, keeping the earliest created_at per name.
WITH ranked AS (
  SELECT id,
         ROW_NUMBER() OVER (PARTITION BY name ORDER BY created_at ASC, id ASC) AS rn
  FROM public.permission_templates
)
DELETE FROM public.permission_templates pt
USING ranked r
WHERE pt.id = r.id
  AND r.rn > 1;
-- 2. Prevent future duplicates: one row per template name.
CREATE UNIQUE INDEX IF NOT EXISTS permission_templates_name_unique
  ON public.permission_templates (name);
-- 3. Drop the permissive RLS policies that allowed any authenticated user to
--    write to permission_templates. The stricter `pt_insert` / `pt_update` /
--    `pt_delete` policies added in 20260407200000_permissions_completion.sql
--    (admin-only) remain in force.
DROP POLICY IF EXISTS authenticated_insert_permission_templates ON public.permission_templates;
DROP POLICY IF EXISTS authenticated_update_permission_templates ON public.permission_templates;
COMMIT;
