-- Allow current internal employee identities to use the canonical project
-- access helper. The original helper predated the employee person type and
-- accepted only the legacy user value, which made valid directory memberships
-- disappear behind RLS.
-- Migration version: 20260731010000.
--
-- Forward-only rollback: publish a new migration restoring the prior helper
-- definition after verifying every policy that depends on it. Do not edit this
-- migration after it has been applied.

create or replace function public.current_has_project_access(
  p_project_id bigint
)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  with current_person as (
    select p.id
    from public.people p
    where p.id = public.current_person_id()
      and p.person_type in ('user', 'employee')
      and p.status = 'active'
  )
  select exists (
    select 1
    from current_person cp
    join public.person_company_templates pct on pct.person_id = cp.id
    join public.permission_templates pt on pt.id = pct.template_id
    where pt.scope = 'company'
      and exists (
        select 1
        from jsonb_each(pt.rules_json) as module_rules(module, levels)
        where levels ? 'read'
           or levels ? 'write'
           or levels ? 'admin'
      )
  )
  or exists (
    select 1
    from current_person cp
    join public.project_directory_memberships m on m.person_id = cp.id
    join public.permission_templates pt on pt.id = m.permission_template_id
    where m.project_id = p_project_id
      and m.status = 'active'
      and pt.scope in ('project', 'global')
      and exists (
        select 1
        from jsonb_each(pt.rules_json) as module_rules(module, levels)
        where levels ? 'read'
           or levels ? 'write'
           or levels ? 'admin'
      )
  );
$$;

comment on function public.current_has_project_access(bigint) is
  'Returns true for active auth-linked internal people (legacy user or employee) with company-wide access or an active project membership assigned to an access-bearing project/global template.';

revoke all on function public.current_has_project_access(bigint) from public;
grant execute on function public.current_has_project_access(bigint)
  to authenticated, service_role;

do $$
declare
  helper_definition text;
begin
  select lower(pg_get_functiondef(
    'public.current_has_project_access(bigint)'::regprocedure
  ))
  into helper_definition;

  if position(
    'person_type in (''user'', ''employee'')'
    in helper_definition
  ) = 0 then
    raise exception
      'current_has_project_access does not recognize both internal person types';
  end if;

  if position('p.status = ''active''' in helper_definition) = 0 then
    raise exception
      'current_has_project_access does not require an active person';
  end if;

  if not has_function_privilege(
    'authenticated',
    'public.current_has_project_access(bigint)',
    'EXECUTE'
  ) then
    raise exception
      'authenticated cannot execute current_has_project_access';
  end if;

  if not has_function_privilege(
    'service_role',
    'public.current_has_project_access(bigint)',
    'EXECUTE'
  ) then
    raise exception
      'service_role cannot execute current_has_project_access';
  end if;

  if has_function_privilege(
    'anon',
    'public.current_has_project_access(bigint)',
    'EXECUTE'
  ) then
    raise exception
      'anon can execute current_has_project_access';
  end if;
end
$$;
