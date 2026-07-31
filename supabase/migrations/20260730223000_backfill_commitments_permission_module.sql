-- Commitments was split from Contracts after existing role templates had been
-- created. Preserve each pre-existing role's financial access by copying its
-- Contracts level into the new Commitments module only when that module is
-- absent. Future edits remain independently manageable in User Management.
BEGIN;

UPDATE public.permission_templates
SET
  rules_json = jsonb_set(
    rules_json,
    '{commitments}',
    rules_json -> 'contracts',
    true
  ),
  updated_at = now()
WHERE NOT (rules_json ? 'commitments')
  AND rules_json ? 'contracts';

COMMIT;
