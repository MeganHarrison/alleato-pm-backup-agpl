-- Project creation is already restricted to active app admins by projects_insert.
-- The default-role trigger runs before a new project can have directory members,
-- so its fixed bootstrap writes must not be evaluated against membership-based
-- project_roles RLS using the invoking user's privileges.

create or replace function public.create_default_project_roles()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, pg_temp
as $function$
begin
  insert into public.project_roles (project_id, role_name, display_order)
  values
    (new.id, 'Architect', 1),
    (new.id, 'Project Manager', 2),
    (new.id, 'Superintendent', 3)
  on conflict (project_id, role_name) do nothing;

  return new;
end;
$function$;

revoke all on function public.create_default_project_roles() from public;
revoke all on function public.create_default_project_roles() from anon;
revoke all on function public.create_default_project_roles() from authenticated;
grant execute on function public.create_default_project_roles() to service_role;

comment on function public.create_default_project_roles() is
  'Creates the three fixed project roles from the projects insert trigger. Runs as a hardened definer because project membership cannot exist until after project creation.';

do $guardrail$
declare
  function_is_hardened boolean;
begin
  select
    p.prosecdef
    and coalesce(
      'search_path=pg_catalog, pg_temp' = any(p.proconfig),
      false
    )
    and not has_function_privilege(
      'anon',
      'public.create_default_project_roles()',
      'execute'
    )
    and not has_function_privilege(
      'authenticated',
      'public.create_default_project_roles()',
      'execute'
    )
    and has_function_privilege(
      'service_role',
      'public.create_default_project_roles()',
      'execute'
    )
  into function_is_hardened
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and p.proname = 'create_default_project_roles'
    and p.pronargs = 0;

  if function_is_hardened is not true then
    raise exception
      'create_default_project_roles must be a hardened security-definer trigger function';
  end if;
end;
$guardrail$;
