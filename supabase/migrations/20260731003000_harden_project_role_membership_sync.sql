-- Harden the Project Team -> product access invariant introduced by
-- 20260730224500_sync_project_role_memberships.sql.
--
-- The role catalog and permission catalog are separate domains. Only explicit
-- aliases below may map a role to a different permission template; every other
-- role uses an exact match or the least-privilege Read Only fallback.

create or replace function public.resolve_project_role_membership_template_id(
  p_role_name text
)
returns uuid
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  with templates as (
    select id, lower(btrim(name)) as normalized_name
    from public.permission_templates
    where scope = 'project'
  ), target as (
    select case lower(btrim(coalesce(p_role_name, '')))
      when 'assistant project manager' then 'project manager'
      when 'senior project manager' then 'project manager'
      else lower(btrim(coalesce(p_role_name, '')))
    end as normalized_name
  )
  select candidate.id
  from (
    select templates.id, 0 as priority
    from templates
    join target on target.normalized_name = templates.normalized_name
    union all
    select templates.id, 1 as priority
    from templates
    where templates.normalized_name = 'read only'
  ) candidate
  order by candidate.priority
  limit 1;
$$;

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
end;
$$;

create or replace function public.sync_project_role_member_directory_membership()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  perform public.ensure_project_role_directory_membership(
    new.project_role_id,
    new.person_id
  );
  return new;
end;
$$;

create or replace function public.sync_person_role_memberships_after_auth_link()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_role_member record;
  v_person_id uuid;
begin
  v_person_id := case
    when tg_table_name = 'people' then new.id
    when tg_table_name = 'users_auth' then new.person_id
    else null
  end;

  if v_person_id is null then
    raise exception using
      errcode = '55000',
      message = 'PROJECT_ROLE_AUTH_LINK_SYNC_UNSUPPORTED_TABLE',
      detail = format('Project-role access reconciliation received trigger table %s.', tg_table_name);
  end if;

  for v_role_member in
    select project_role_id
    from public.project_role_members
    where person_id = v_person_id
  loop
    perform public.ensure_project_role_directory_membership(
      v_role_member.project_role_id,
      v_person_id
    );
  end loop;

  return new;
end;
$$;

create or replace function public.release_manual_project_membership_template()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if old.metadata ->> 'membership_source' = 'project_role'
    and new.permission_template_id is distinct from old.permission_template_id
    and coalesce(current_setting('app.project_role_membership_sync', true), '') <> 'true'
  then
    new.metadata := coalesce(new.metadata, '{}'::jsonb)
      - 'membership_source'
      - 'auto_permission_template';
  end if;
  return new;
end;
$$;

do $$
begin
  if not exists (
    select 1
    from public.permission_templates
    where scope = 'project'
      and lower(btrim(name)) = 'read only'
  ) then
    raise exception using
      errcode = '23514',
      message = 'PROJECT_ROLE_MEMBERSHIP_READ_ONLY_TEMPLATE_MISSING',
      hint = 'Create the Read Only project permission template before applying role-membership synchronization.';
  end if;
end;
$$;

drop trigger if exists project_role_member_directory_membership_sync on public.project_role_members;
create trigger project_role_member_directory_membership_sync
after insert or update of project_role_id, person_id on public.project_role_members
for each row execute function public.sync_project_role_member_directory_membership();

drop trigger if exists people_project_role_auth_link_sync on public.people;
create trigger people_project_role_auth_link_sync
after update of auth_user_id, person_type on public.people
for each row execute function public.sync_person_role_memberships_after_auth_link();

drop trigger if exists users_auth_project_role_auth_link_sync on public.users_auth;
create trigger users_auth_project_role_auth_link_sync
after insert or update of person_id, auth_user_id on public.users_auth
for each row execute function public.sync_person_role_memberships_after_auth_link();

drop trigger if exists project_membership_manual_template_release on public.project_directory_memberships;
create trigger project_membership_manual_template_release
before update of permission_template_id on public.project_directory_memberships
for each row execute function public.release_manual_project_membership_template();

-- Reconcile every already-authenticated internal role assignment through the
-- same shared function. This both catches delayed account links and fails
-- loudly if the required fallback template was removed.
do $$
declare
  v_role_member record;
begin
  for v_role_member in
    select prm.project_role_id, prm.person_id
    from public.project_role_members prm
    join public.people p on p.id = prm.person_id
    where p.person_type in ('employee', 'user')
      and (
        p.auth_user_id is not null
        or exists (
          select 1
          from public.users_auth ua
          where ua.person_id = p.id
            and ua.auth_user_id is not null
        )
      )
  loop
    perform public.ensure_project_role_directory_membership(
      v_role_member.project_role_id,
      v_role_member.person_id
    );
  end loop;
end;
$$;

revoke all on function public.ensure_project_role_directory_membership(uuid, uuid) from public, anon, authenticated;
revoke all on function public.sync_person_role_memberships_after_auth_link() from public, anon, authenticated;
revoke all on function public.release_manual_project_membership_template() from public, anon, authenticated;
