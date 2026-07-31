-- Reconcile duplicate permission template generations
--
-- Two generations of system templates were seeded at different times:
--   Jan 2026:  Client (View Only), Project Admin, Superintendent
--   Apr 2026:  Owner / Client,     Field Engineer, Read Only
-- plus Project Manager and Subcontractor in both.
--
-- None of these rows are referenced by project_directory_memberships or
-- permission_audit_log (verified), so deletion/renaming is safe.
--
-- Target canonical set (Procore-aligned):
--   * Project Admin
--   * Project Manager
--   * Superintendent   (Procore-standard; enriched rules_json)
--   * Field Engineer
--   * Subcontractor
--   * Owner / Client
--   * Read Only
--
-- "Client (View Only)" is superseded by "Owner / Client" and deleted.

BEGIN;
-- 1. Drop superseded template.
DELETE FROM public.permission_templates
WHERE name = 'Client (View Only)';
-- 2. Enrich Superintendent defaults — original rules_json only covered
--    schedule + directory + documents + submittals. Add read access to the
--    financial + RFI modules so superintendents can see project context
--    without being able to edit budgets/contracts.
UPDATE public.permission_templates
SET rules_json = '{
  "directory":     ["read"],
  "budget":        ["read"],
  "contracts":     ["read"],
  "documents":     ["read","write"],
  "schedule":      ["read","write","admin"],
  "submittals":    ["read","write"],
  "rfis":          ["read","write"],
  "change_orders": ["read"]
}'::jsonb,
    description = 'Field operations lead. Full control of schedule; write access on field-execution modules (RFIs, submittals, documents); read-only on financials.'
WHERE name = 'Superintendent';
-- 3. Normalize Project Manager description so the two generations read
--    consistently (rules_json already matches the richer April version).
UPDATE public.permission_templates
SET description = 'Full write access across all project modules. Cannot administer directory or permissions.'
WHERE name = 'Project Manager';
COMMIT;
