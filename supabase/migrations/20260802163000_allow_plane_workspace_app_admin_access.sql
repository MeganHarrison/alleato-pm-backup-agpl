-- Preserve Plane workspace Favorites and Recents for active Alleato app admins
-- even when they do not carry redundant project or company permission templates.
--
-- The module-permission helper already grants app admins. The generic project
-- branch must apply the same rule because Home, Projects, Pages, Views, Drafts,
-- and Stickies are stored as project-scoped workspace entities.
--
-- Forward-only rollback: publish a new migration restoring the prior function
-- body after verifying the impact on user_workspace_items RLS.

begin;

create or replace function public.current_has_plane_workspace_entity_access(
  p_project_id bigint,
  p_entity_type text
)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_module text;
begin
  if p_project_id is null or p_entity_type is null then
    return false;
  end if;

  if public.current_is_app_admin() then
    return true;
  end if;

  v_module := case p_entity_type
    when 'work_item' then 'schedule'
    when 'cycle' then 'schedule'
    when 'module' then 'schedule'
    when 'intake' then 'schedule'
    when 'submittal' then 'submittals'
    when 'rfi' then 'rfis'
    when 'change_event' then 'change_events'
    when 'commitment' then 'commitments'
    when 'prime_contract' then 'contracts'
    else null
  end;

  if v_module is not null then
    return public.current_has_project_module_permission(
      p_project_id,
      v_module,
      'read'
    );
  end if;

  return public.current_has_project_access(p_project_id);
end;
$$;

revoke all
  on function public.current_has_plane_workspace_entity_access(bigint, text)
  from public, anon;
grant execute
  on function public.current_has_plane_workspace_entity_access(bigint, text)
  to authenticated, service_role;

do $$
declare
  helper_definition text;
begin
  select lower(pg_get_functiondef(
    'public.current_has_plane_workspace_entity_access(bigint,text)'::regprocedure
  ))
  into helper_definition;

  if position('if public.current_is_app_admin() then' in helper_definition) = 0
  then
    raise exception
      'Plane workspace entity access does not grant active app admins';
  end if;

  if not has_function_privilege(
    'authenticated',
    'public.current_has_plane_workspace_entity_access(bigint,text)',
    'EXECUTE'
  ) then
    raise exception
      'authenticated cannot evaluate Plane workspace entity access';
  end if;

  if has_function_privilege(
    'anon',
    'public.current_has_plane_workspace_entity_access(bigint,text)',
    'EXECUTE'
  ) then
    raise exception
      'anon can evaluate Plane workspace entity access';
  end if;
end
$$;

commit;

