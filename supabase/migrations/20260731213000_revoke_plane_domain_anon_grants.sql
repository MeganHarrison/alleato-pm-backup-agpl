-- Close inherited anonymous table privileges on the Plane Modules and Cycles domains.
-- Authenticated and service-role privileges intentionally remain unchanged.

begin;

revoke all privileges on table public.project_modules from public;
revoke all privileges on table public.project_modules from anon;

revoke all privileges on table public.project_module_members from public;
revoke all privileges on table public.project_module_members from anon;

revoke all privileges on table public.module_task_memberships from public;
revoke all privileges on table public.module_task_memberships from anon;

grant select, insert, update, delete on table public.project_modules to service_role;
grant select, insert, update, delete on table public.project_module_members to service_role;
grant select, insert, update, delete on table public.module_task_memberships to service_role;

revoke all privileges on table public.project_cycles from public;
revoke all privileges on table public.project_cycles from anon;

revoke all privileges on table public.cycle_task_memberships from public;
revoke all privileges on table public.cycle_task_memberships from anon;

commit;
