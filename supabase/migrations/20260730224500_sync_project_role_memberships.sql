-- Keep the Project Team roster and product-access membership in one consistent
-- state. A role assignment is an explicit staffing decision; for an internal
-- authenticated person it must also create the active project membership that
-- RLS, navigation, and User Management use for access.
--
-- External contacts deliberately remain roster-only. They do not receive an
-- Alleato account merely because they are listed under a project role.

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
  )
  select id
  from templates
  where normalized_name = case
    when lower(coalesce(p_role_name, '')) like '%project manager%'
      then 'project manager'
    else lower(btrim(coalesce(p_role_name, '')))
  end
  union all
  select id
  from templates
  where normalized_name = 'read only'
  limit 1;
$$;

comment on function public.resolve_project_role_membership_template_id(text) is
  'Returns the project permission template for a Project Team role, falling back to Read Only so an unmatched internal role receives least-privilege access.';

create or replace function public.sync_project_role_member_directory_membership()
returns trigger
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
  where id = new.project_role_id;

  if v_project_id is null then
    raise exception using
      errcode = '23503',
      message = 'PROJECT_ROLE_NOT_FOUND_FOR_MEMBERSHIP_SYNC',
      detail = format('Project role %s was not found while synchronizing person %s.', new.project_role_id, new.person_id),
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
  where p.id = new.person_id;

  if coalesce(v_is_internal_authenticated, false) is false then
    return new;
  end if;

  v_template_id := public.resolve_project_role_membership_template_id(v_role_name);

  if v_template_id is null then
    raise exception using
      errcode = '23514',
      message = 'PROJECT_ROLE_MEMBERSHIP_TEMPLATE_MISSING',
      detail = format('No project permission template or Read Only fallback exists for role "%s".', coalesce(v_role_name, '')),
      hint = 'Create a project permission template named Read Only before assigning internal project team members.';
  end if;

  insert into public.project_directory_memberships (
    project_id,
    person_id,
    permission_template_id,
    status,
    user_type,
    invite_status
  )
  values (
    v_project_id,
    new.person_id,
    v_template_id,
    'active',
    'employee',
    'not_invited'
  )
  on conflict (project_id, person_id) do update
    set status = 'active',
        permission_template_id = coalesce(
          public.project_directory_memberships.permission_template_id,
          excluded.permission_template_id
        ),
        updated_at = now()
    where public.project_directory_memberships.status is distinct from 'active'
       or public.project_directory_memberships.permission_template_id is null;

  return new;
end;
$$;

comment on function public.sync_project_role_member_directory_membership() is
  'Activates directory membership for authenticated internal project-role assignees without overwriting a configured permission template.';

revoke all on function public.resolve_project_role_membership_template_id(text) from public;
revoke all on function public.resolve_project_role_membership_template_id(text) from anon;
revoke all on function public.resolve_project_role_membership_template_id(text) from authenticated;
revoke all on function public.sync_project_role_member_directory_membership() from public;
revoke all on function public.sync_project_role_member_directory_membership() from anon;
revoke all on function public.sync_project_role_member_directory_membership() from authenticated;

drop trigger if exists project_role_member_directory_membership_sync on public.project_role_members;
create trigger project_role_member_directory_membership_sync
after insert or update of project_role_id, person_id on public.project_role_members
for each row execute function public.sync_project_role_member_directory_membership();

-- Repair historical drift using the same identity and least-privilege template
-- policy. Existing explicit templates are preserved; only missing templates are
-- populated and inactive memberships are reactivated to match the active role.
with candidates as (
  select distinct on (pr.project_id, prm.person_id)
    pr.project_id,
    prm.person_id,
    public.resolve_project_role_membership_template_id(pr.role_name) as permission_template_id
  from public.project_role_members prm
  join public.project_roles pr on pr.id = prm.project_role_id
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
  order by
    pr.project_id,
    prm.person_id,
    case
      when lower(pr.role_name) = 'project manager' then 0
      when lower(pr.role_name) like '%project manager%' then 1
      when exists (
        select 1
        from public.permission_templates pt
        where pt.scope = 'project'
          and lower(btrim(pt.name)) = lower(btrim(pr.role_name))
      ) then 2
      else 3
    end,
    pr.display_order nulls last,
    pr.id
)
insert into public.project_directory_memberships (
  project_id,
  person_id,
  permission_template_id,
  status,
  user_type,
  invite_status
)
select
  project_id,
  person_id,
  permission_template_id,
  'active',
  'employee',
  'not_invited'
from candidates
where permission_template_id is not null
on conflict (project_id, person_id) do update
  set status = 'active',
      permission_template_id = coalesce(
        public.project_directory_memberships.permission_template_id,
        excluded.permission_template_id
      ),
      updated_at = now()
  where public.project_directory_memberships.status is distinct from 'active'
     or public.project_directory_memberships.permission_template_id is null;
