-- Complete the project-team access lifecycle.
--
-- A membership created by a Project Team role is auto-managed only while a
-- corresponding role assignment remains. Explicit administrator-managed
-- memberships are intentionally never revoked by this automation.

create or replace function public.ensure_project_role_directory_membership(
  p_project_role_id uuid,
  p_person_id uuid
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_project_id integer;
  v_role_name text;
  v_template_id uuid;
  v_is_internal_authenticated boolean;
begin
  select project_id, role_name
    into v_project_id, v_role_name
  from public.project_roles
  where id = p_project_role_id;

  if v_project_id is null then
    raise exception using
      errcode = '23503',
      message = 'PROJECT_ROLE_NOT_FOUND_FOR_MEMBERSHIP_SYNC',
      detail = format('Project role %s was not found while synchronizing person %s.', p_project_role_id, p_person_id),
      hint = 'Create the project role before assigning a project team member.';
  end if;

  select (
    p.person_type in ('employee', 'user')
    and (
      p.auth_user_id is not null
      or exists (
        select 1
        from public.users_auth ua
        where ua.person_id = p.id
          and ua.auth_user_id is not null
      )
    )
  )
    into v_is_internal_authenticated
  from public.people p
  where p.id = p_person_id;

  if coalesce(v_is_internal_authenticated, false) is false then
    return;
  end if;

  v_template_id := public.resolve_project_role_membership_template_id(v_role_name);

  if v_template_id is null then
    raise exception using
      errcode = '23514',
      message = 'PROJECT_ROLE_MEMBERSHIP_TEMPLATE_MISSING',
      detail = format('No project permission template or Read Only fallback exists for role "%s".', coalesce(v_role_name, '')),
      hint = 'Create a project permission template named Read Only before assigning internal project team members.';
  end if;

  -- Suppress the manual-override trigger only for this one synchronization
  -- write. Reset the transaction-local flag before returning so a later
  -- administrator edit in the same transaction is still recognized as manual.
  perform set_config('app.project_role_membership_sync', 'true', true);

  insert into public.project_directory_memberships (
    project_id,
    person_id,
    permission_template_id,
    status,
    user_type,
    invite_status,
    metadata
  )
  values (
    v_project_id,
    p_person_id,
    v_template_id,
    'active',
    'employee',
    'not_invited',
    jsonb_build_object(
      'membership_source', 'project_role',
      'auto_permission_template', true
    )
  )
  on conflict (project_id, person_id) do update
    set status = 'active',
        permission_template_id = case
          when public.project_directory_memberships.permission_template_id is null
            or public.project_directory_memberships.metadata ->> 'membership_source' = 'project_role'
            then excluded.permission_template_id
          else public.project_directory_memberships.permission_template_id
        end,
        metadata = case
          when public.project_directory_memberships.permission_template_id is null
            or public.project_directory_memberships.metadata ->> 'membership_source' = 'project_role'
            then coalesce(public.project_directory_memberships.metadata, '{}'::jsonb) || excluded.metadata
          else public.project_directory_memberships.metadata
        end,
        updated_at = now()
    where public.project_directory_memberships.status is distinct from 'active'
       or public.project_directory_memberships.permission_template_id is null
       or (
         public.project_directory_memberships.metadata ->> 'membership_source' = 'project_role'
         and public.project_directory_memberships.permission_template_id is distinct from excluded.permission_template_id
       );

  perform set_config('app.project_role_membership_sync', 'false', true);
end;
$$;

create or replace function public.reconcile_removed_project_role_member_directory_membership(
  p_project_role_member_id uuid,
  p_project_role_id uuid,
  p_person_id uuid
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_project_id integer;
  v_remaining_project_role_id uuid;
begin
  select project_id
    into v_project_id
  from public.project_roles
  where id = p_project_role_id;

  if v_project_id is null then
    raise exception using
      errcode = '23503',
      message = 'PROJECT_ROLE_NOT_FOUND_FOR_MEMBERSHIP_SYNC',
      detail = format('Project role %s was not found while removing person %s.', p_project_role_id, p_person_id),
      hint = 'Remove the role member before deleting its project role.';
  end if;

  select prm.project_role_id
    into v_remaining_project_role_id
  from public.project_role_members prm
  join public.project_roles pr on pr.id = prm.project_role_id
  where prm.person_id = p_person_id
    and prm.id <> p_project_role_member_id
    and pr.project_id = v_project_id
  order by prm.assigned_at, prm.id
  limit 1;

  if v_remaining_project_role_id is not null then
    perform public.reconcile_project_role_directory_membership(
      v_remaining_project_role_id,
      p_person_id
    );
    return;
  end if;

  update public.project_directory_memberships
  set status = 'inactive',
      updated_at = now()
  where project_id = v_project_id
    and person_id = p_person_id
    and status = 'active'
    and metadata ->> 'membership_source' = 'project_role';
end;
$$;

create or replace function public.cleanup_removed_project_role_member_directory_membership()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  perform public.reconcile_removed_project_role_member_directory_membership(
    old.id,
    old.project_role_id,
    old.person_id
  );

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

drop trigger if exists project_role_member_directory_membership_cleanup on public.project_role_members;
create trigger project_role_member_directory_membership_cleanup
before delete or update of project_role_id, person_id on public.project_role_members
for each row execute function public.cleanup_removed_project_role_member_directory_membership();

revoke all on function public.reconcile_removed_project_role_member_directory_membership(uuid, uuid, uuid) from public, anon, authenticated;
