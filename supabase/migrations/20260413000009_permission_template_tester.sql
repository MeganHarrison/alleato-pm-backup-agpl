-- Add system permission template for Testers
--
-- Testers need enough write access to exercise all modules, but must not
-- be able to approve financials, modify budgets, or manage the directory.
-- Project-level scoping (test projects + self-created only) is enforced by
-- membership assignment, not by the template itself.

INSERT INTO public.permission_templates (
  name,
  description,
  scope,
  is_system,
  rules_json,
  granular_flags
)
VALUES (
  'Tester',
  'QA/testing role. Write access to field-execution modules (documents, submittals, RFIs); read-only on financials and schedule. Cannot approve change orders, invoices, or modify budgets. Intended for test projects only.',
  'project',
  true,
  '{
    "directory":     ["read"],
    "budget":        ["read"],
    "contracts":     ["read"],
    "documents":     ["read", "write"],
    "schedule":      ["read"],
    "submittals":    ["read", "write"],
    "rfis":          ["read", "write"],
    "change_orders": ["read"]
  }'::jsonb,
  ARRAY['edit_own_ssov', 'view_private_commitments', 'create_change_events']
)
ON CONFLICT (name) DO NOTHING;
