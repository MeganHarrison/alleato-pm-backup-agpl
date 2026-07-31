-- Add new permission modules to the app_page_access_policies CHECK constraint.
-- Mirrors PermissionModule in frontend/src/lib/permissions-shared.ts.
-- New modules: commitments, estimates, change_events, emails.

ALTER TABLE public.app_page_access_policies
  DROP CONSTRAINT IF EXISTS app_page_access_policies_module_check;

ALTER TABLE public.app_page_access_policies
  ADD CONSTRAINT app_page_access_policies_module_check CHECK (
    permission_module IS NULL
    OR permission_module = ANY (
      ARRAY[
        'directory',
        'budget',
        'contracts',
        'commitments',
        'estimates',
        'documents',
        'schedule',
        'submittals',
        'rfis',
        'change_orders',
        'change_events',
        'emails'
      ]
    )
  );
