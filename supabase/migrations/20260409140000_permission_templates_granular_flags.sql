-- Add granular permission flags to permission_templates
--
-- Procore layers "granular permissions" on top of the base None/Read/Write/Admin
-- levels — named capability flags like "view private commitments" or "edit own
-- schedule of values". Our rules_json only modeled the base levels, so we
-- couldn't express "Read Only on Commitments except this one specific extra
-- capability".
--
-- This migration introduces a typed text[] column so each template can carry
-- an ordered set of granular flags without overloading rules_json.

BEGIN;
ALTER TABLE public.permission_templates
  ADD COLUMN IF NOT EXISTS granular_flags text[] NOT NULL DEFAULT '{}';
COMMENT ON COLUMN public.permission_templates.granular_flags IS
  'Named capability flags layered on top of rules_json. Procore-style '
  'granular permissions — e.g. view_private_commitments, edit_own_ssov, '
  'bulk_edit_subcontractor_invoice_status, approve_change_orders, '
  'approve_invoices, create_change_events, create_budget_modifications, '
  'manage_project_directory.';
-- Seed Procore-aligned defaults on system templates.
UPDATE public.permission_templates
SET granular_flags = ARRAY[
  'view_private_commitments',
  'edit_own_ssov',
  'bulk_edit_subcontractor_invoice_status',
  'approve_change_orders',
  'approve_invoices',
  'create_change_events',
  'create_budget_modifications',
  'manage_project_directory'
]
WHERE name = 'Project Admin';
UPDATE public.permission_templates
SET granular_flags = ARRAY[
  'view_private_commitments',
  'bulk_edit_subcontractor_invoice_status',
  'approve_change_orders',
  'approve_invoices',
  'create_change_events',
  'create_budget_modifications'
]
WHERE name = 'Project Manager';
UPDATE public.permission_templates
SET granular_flags = ARRAY['create_change_events']
WHERE name = 'Superintendent';
UPDATE public.permission_templates
SET granular_flags = ARRAY['edit_own_ssov']
WHERE name = 'Subcontractor';
-- Field Engineer, Owner / Client, and Read Only get no granular flags.

COMMIT;
