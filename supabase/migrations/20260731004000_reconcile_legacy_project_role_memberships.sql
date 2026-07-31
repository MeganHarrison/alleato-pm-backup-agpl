-- Mark only the memberships created by the initial role-membership repair as
-- auto-managed, then make role/access synchronization symmetric when an
-- employee becomes an external or unlinked person.

update public.project_directory_memberships
set metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object(
  'membership_source', 'project_role',
  'auto_permission_template', true,
  'migration_source', '20260730224500'
)
where created_at >= '2026-07-30 23:38:16+00'::timestamptz
  and created_at < '2026-07-30 23:38:17+00'::timestamptz
  and exists (
    select 1
    from public.project_role_members prm
    join public.project_roles pr on pr.id = prm.project_role_id
    where prm.person_id = project_directory_memberships.person_id
      and pr.project_id = project_directory_memberships.project_id
  );

create or replace function public.reconcile_project_role_directory_membership(
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
  v_is_internal_authenticated boolean;
begin
  select project_id
    into v_project_id
  from public.project_roles
  where id = p_project_role_id;

  if v_project_id is null then
    raise exception using
      errcode = '23503',
      message = 'PROJECT_ROLE_NOT_FOUND_FOR_MEMBERSHIP_SYNC',
      detail = format('Project role %s was not found while reconciling person %s.', p_project_role_id, p_person_id),
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

  if coalesce(v_is_internal_authenticated, false) then
    perform public.ensure_project_role_directory_membership(
      p_project_role_id,
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

create or replace function public.sync_project_role_member_directory_membership()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  perform public.reconcile_project_role_directory_membership(
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
  if tg_table_name = 'people' then
    v_person_id := new.id;
  elsif tg_table_name = 'users_auth' then
    v_person_id := new.person_id;
  else
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
    perform public.reconcile_project_role_directory_membership(
      v_role_member.project_role_id,
      v_person_id
    );
  end loop;

  return new;
end;
$$;

-- Replay all role assignments so the precisely tagged legacy rows pick up the
-- hardened template ownership behavior without altering unrelated manual rows.
do $$
declare
  v_role_member record;
begin
  for v_role_member in
    select project_role_id, person_id
    from public.project_role_members
  loop
    perform public.reconcile_project_role_directory_membership(
      v_role_member.project_role_id,
      v_role_member.person_id
    );
  end loop;
end;
$$;

revoke all on function public.reconcile_project_role_directory_membership(uuid, uuid) from public, anon, authenticated;
