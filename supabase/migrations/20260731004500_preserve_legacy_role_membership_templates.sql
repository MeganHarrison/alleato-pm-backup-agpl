-- 20260730224500 repaired historical membership drift before the product had an
-- ownership marker. Do not infer that those existing rows are role-managed
-- from timestamps or a matching role/template shape: either can also describe
-- an intentional administrator assignment. Preserve them as explicit access.
--
-- New role-driven memberships are marked by
-- ensure_project_role_directory_membership() and retain the full lifecycle
-- synchronization contract. Historical rows continue to grant the access that
-- was repaired, but their templates are never overwritten or revoked by role
-- automation without an explicit administrator action.

update public.project_directory_memberships
set metadata = coalesce(metadata, '{}'::jsonb)
  - 'membership_source'
  - 'auto_permission_template'
  - 'migration_source'
where metadata ->> 'migration_source' = '20260730224500';
