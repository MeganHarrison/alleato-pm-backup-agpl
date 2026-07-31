-- Copyright (c) 2023-present Plane Software, Inc. and contributors
-- SPDX-License-Identifier: AGPL-3.0-only
-- Adapted for Alleato; see LICENSES/NOTICE-PLANE.md.
--
-- Dedicated Plane-compatible Modules domain. Modules organize canonical
-- public.tasks rows and never replace or mutate public.schedule_tasks.

begin;

create table public.project_modules (
  id uuid primary key default gen_random_uuid(),
  project_id integer not null references public.projects(id) on delete cascade,
  name text not null,
  description text not null default '',
  status text not null default 'planned',
  lead_person_id uuid references public.people(id) on delete set null,
  start_date date,
  target_date date,
  sort_order double precision not null default 65535,
  archived_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint project_modules_name_present
    check (char_length(btrim(name)) between 1 and 255),
  constraint project_modules_status_valid
    check (status in ('backlog', 'planned', 'in-progress', 'paused', 'completed', 'cancelled')),
  constraint project_modules_date_range_valid
    check (start_date is null or target_date is null or start_date <= target_date),
  constraint project_modules_id_project_unique unique (id, project_id)
);

create unique index project_modules_project_name_unique
  on public.project_modules (project_id, lower(btrim(name)));
create index project_modules_project_active_sort_idx
  on public.project_modules (project_id, sort_order, created_at)
  where archived_at is null;
create index project_modules_project_status_idx
  on public.project_modules (project_id, status);
create index project_modules_project_target_date_idx
  on public.project_modules (project_id, target_date)
  where target_date is not null;

create table public.project_module_members (
  id uuid primary key default gen_random_uuid(),
  module_id uuid not null,
  project_id integer not null,
  person_id uuid not null references public.people(id) on delete cascade,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  constraint project_module_members_module_project_fkey
    foreign key (module_id, project_id)
    references public.project_modules(id, project_id)
    on delete cascade,
  constraint project_module_members_unique unique (module_id, person_id)
);

create index project_module_members_project_person_idx
  on public.project_module_members (project_id, person_id);

create table public.module_task_memberships (
  id uuid primary key default gen_random_uuid(),
  module_id uuid not null,
  project_id integer not null,
  task_id uuid not null references public.tasks(id) on delete cascade,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  constraint module_task_memberships_module_project_fkey
    foreign key (module_id, project_id)
    references public.project_modules(id, project_id)
    on delete cascade,
  constraint module_task_memberships_unique unique (module_id, task_id)
);

create index module_task_memberships_project_task_idx
  on public.module_task_memberships (project_id, task_id);

create or replace function public.plane_modules_set_updated_at()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger project_modules_set_updated_at
before update on public.project_modules
for each row execute function public.plane_modules_set_updated_at();

create or replace function public.plane_modules_assert_active_project_person(
  p_project_id integer,
  p_person_id uuid,
  p_field_name text
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if not exists (
    select 1
    from public.project_directory_memberships membership
    where membership.project_id = p_project_id
      and membership.person_id = p_person_id
      and membership.status = 'active'
  ) then
    raise exception '% must be an active member of project %', p_field_name, p_project_id
      using errcode = '23514';
  end if;
end;
$$;

create or replace function public.plane_modules_validate_lead()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if new.lead_person_id is not null then
    perform public.plane_modules_assert_active_project_person(
      new.project_id,
      new.lead_person_id,
      'lead_person_id'
    );
  end if;
  return new;
end;
$$;

create trigger project_modules_validate_lead
before insert or update of project_id, lead_person_id on public.project_modules
for each row execute function public.plane_modules_validate_lead();

create or replace function public.plane_modules_validate_member()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  perform public.plane_modules_assert_active_project_person(
    new.project_id,
    new.person_id,
    'person_id'
  );
  return new;
end;
$$;

create trigger project_module_members_validate_member
before insert or update of project_id, person_id on public.project_module_members
for each row execute function public.plane_modules_validate_member();

create or replace function public.plane_modules_validate_task()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if not exists (
    select 1
    from public.tasks task
    where task.id = new.task_id
      and (
        task.project_id = new.project_id
        or new.project_id = any(coalesce(task.project_ids, '{}'::integer[]))
      )
  ) then
    raise exception 'task_id % does not belong to project %', new.task_id, new.project_id
      using errcode = '23514';
  end if;
  return new;
end;
$$;

create trigger module_task_memberships_validate_task
before insert or update of project_id, task_id on public.module_task_memberships
for each row execute function public.plane_modules_validate_task();

revoke all on function public.plane_modules_set_updated_at() from public, anon, authenticated;
revoke all on function public.plane_modules_assert_active_project_person(
  integer, uuid, text
) from public, anon, authenticated;
revoke all on function public.plane_modules_validate_lead() from public, anon, authenticated;
revoke all on function public.plane_modules_validate_member() from public, anon, authenticated;
revoke all on function public.plane_modules_validate_task() from public, anon, authenticated;

create or replace function public.plane_create_project_module(
  p_project_id integer,
  p_name text,
  p_description text,
  p_status text,
  p_lead_person_id uuid,
  p_start_date date,
  p_target_date date,
  p_sort_order double precision,
  p_member_person_ids uuid[],
  p_actor_id uuid
)
returns public.project_modules
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  created_module public.project_modules;
begin
  insert into public.project_modules (
    project_id,
    name,
    description,
    status,
    lead_person_id,
    start_date,
    target_date,
    sort_order,
    created_by,
    updated_by
  )
  values (
    p_project_id,
    btrim(p_name),
    coalesce(p_description, ''),
    p_status,
    p_lead_person_id,
    p_start_date,
    p_target_date,
    coalesce(p_sort_order, 65535),
    p_actor_id,
    p_actor_id
  )
  returning * into created_module;

  insert into public.project_module_members (
    module_id,
    project_id,
    person_id,
    created_by
  )
  select
    created_module.id,
    p_project_id,
    member_id,
    p_actor_id
  from (
    select distinct unnest(coalesce(p_member_person_ids, '{}'::uuid[])) as member_id
  ) members;

  return created_module;
end;
$$;

create or replace function public.plane_update_project_module(
  p_module_id uuid,
  p_project_id integer,
  p_name text,
  p_description text,
  p_status text,
  p_lead_person_id uuid,
  p_start_date date,
  p_target_date date,
  p_sort_order double precision,
  p_archived_at timestamptz,
  p_member_person_ids uuid[],
  p_actor_id uuid
)
returns public.project_modules
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  updated_module public.project_modules;
begin
  update public.project_modules
  set
    name = btrim(p_name),
    description = coalesce(p_description, ''),
    status = p_status,
    lead_person_id = p_lead_person_id,
    start_date = p_start_date,
    target_date = p_target_date,
    sort_order = coalesce(p_sort_order, 65535),
    archived_at = p_archived_at,
    updated_by = p_actor_id
  where id = p_module_id
    and project_id = p_project_id
  returning * into updated_module;

  if updated_module.id is null then
    raise exception 'module % was not found in project %', p_module_id, p_project_id
      using errcode = 'P0002';
  end if;

  delete from public.project_module_members
  where module_id = p_module_id;

  insert into public.project_module_members (
    module_id,
    project_id,
    person_id,
    created_by
  )
  select
    p_module_id,
    p_project_id,
    member_id,
    p_actor_id
  from (
    select distinct unnest(coalesce(p_member_person_ids, '{}'::uuid[])) as member_id
  ) members;

  return updated_module;
end;
$$;

create or replace function public.plane_replace_module_tasks(
  p_module_id uuid,
  p_project_id integer,
  p_task_ids uuid[],
  p_actor_id uuid
)
returns uuid[]
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  task_ids uuid[];
begin
  if not exists (
    select 1
    from public.project_modules module
    where module.id = p_module_id
      and module.project_id = p_project_id
  ) then
    raise exception 'module % was not found in project %', p_module_id, p_project_id
      using errcode = 'P0002';
  end if;

  delete from public.module_task_memberships
  where module_id = p_module_id;

  insert into public.module_task_memberships (
    module_id,
    project_id,
    task_id,
    created_by
  )
  select
    p_module_id,
    p_project_id,
    task_id,
    p_actor_id
  from (
    select distinct unnest(coalesce(p_task_ids, '{}'::uuid[])) as task_id
  ) tasks;

  select coalesce(array_agg(membership.task_id order by membership.task_id), '{}'::uuid[])
  into task_ids
  from public.module_task_memberships membership
  where membership.module_id = p_module_id;

  return task_ids;
end;
$$;

revoke all on function public.plane_create_project_module(
  integer, text, text, text, uuid, date, date, double precision, uuid[], uuid
) from public, anon, authenticated;
revoke all on function public.plane_update_project_module(
  uuid, integer, text, text, text, uuid, date, date, double precision, timestamptz, uuid[], uuid
) from public, anon, authenticated;
revoke all on function public.plane_replace_module_tasks(
  uuid, integer, uuid[], uuid
) from public, anon, authenticated;
grant execute on function public.plane_create_project_module(
  integer, text, text, text, uuid, date, date, double precision, uuid[], uuid
) to service_role;
grant execute on function public.plane_update_project_module(
  uuid, integer, text, text, text, uuid, date, date, double precision, timestamptz, uuid[], uuid
) to service_role;
grant execute on function public.plane_replace_module_tasks(
  uuid, integer, uuid[], uuid
) to service_role;

grant select, insert, update, delete on table public.project_modules to authenticated;
grant select, insert, update, delete on table public.project_module_members to authenticated;
grant select, insert, update, delete on table public.module_task_memberships to authenticated;

alter table public.project_modules enable row level security;
alter table public.project_modules force row level security;
alter table public.project_module_members enable row level security;
alter table public.project_module_members force row level security;
alter table public.module_task_memberships enable row level security;
alter table public.module_task_memberships force row level security;

create policy project_modules_select on public.project_modules
  for select to authenticated
  using (public.current_is_app_admin() or public.current_has_project_access(project_id));
create policy project_modules_insert on public.project_modules
  for insert to authenticated
  with check (
    public.current_is_app_admin()
    or public.current_has_project_module_permission(project_id, 'schedule', 'write')
  );
create policy project_modules_update on public.project_modules
  for update to authenticated
  using (
    public.current_is_app_admin()
    or public.current_has_project_module_permission(project_id, 'schedule', 'write')
  )
  with check (
    public.current_is_app_admin()
    or public.current_has_project_module_permission(project_id, 'schedule', 'write')
  );
create policy project_modules_delete on public.project_modules
  for delete to authenticated
  using (
    public.current_is_app_admin()
    or public.current_has_project_module_permission(project_id, 'schedule', 'write')
  );

create policy project_module_members_select on public.project_module_members
  for select to authenticated
  using (public.current_is_app_admin() or public.current_has_project_access(project_id));
create policy project_module_members_insert on public.project_module_members
  for insert to authenticated
  with check (
    public.current_is_app_admin()
    or public.current_has_project_module_permission(project_id, 'schedule', 'write')
  );
create policy project_module_members_update on public.project_module_members
  for update to authenticated
  using (
    public.current_is_app_admin()
    or public.current_has_project_module_permission(project_id, 'schedule', 'write')
  )
  with check (
    public.current_is_app_admin()
    or public.current_has_project_module_permission(project_id, 'schedule', 'write')
  );
create policy project_module_members_delete on public.project_module_members
  for delete to authenticated
  using (
    public.current_is_app_admin()
    or public.current_has_project_module_permission(project_id, 'schedule', 'write')
  );

create policy module_task_memberships_select on public.module_task_memberships
  for select to authenticated
  using (public.current_is_app_admin() or public.current_has_project_access(project_id));
create policy module_task_memberships_insert on public.module_task_memberships
  for insert to authenticated
  with check (
    public.current_is_app_admin()
    or public.current_has_project_module_permission(project_id, 'schedule', 'write')
  );
create policy module_task_memberships_update on public.module_task_memberships
  for update to authenticated
  using (
    public.current_is_app_admin()
    or public.current_has_project_module_permission(project_id, 'schedule', 'write')
  )
  with check (
    public.current_is_app_admin()
    or public.current_has_project_module_permission(project_id, 'schedule', 'write')
  );
create policy module_task_memberships_delete on public.module_task_memberships
  for delete to authenticated
  using (
    public.current_is_app_admin()
    or public.current_has_project_module_permission(project_id, 'schedule', 'write')
  );

comment on table public.project_modules is
  'Plane-compatible project Modules. Modules organize public.tasks and do not replace public.schedule_tasks.';
comment on table public.module_task_memberships is
  'Many-to-many membership between Modules and canonical work items in public.tasks.';

commit;

-- Controlled rollback (run only after confirming no production consumer):
-- begin;
-- drop policy if exists module_task_memberships_delete on public.module_task_memberships;
-- drop policy if exists module_task_memberships_update on public.module_task_memberships;
-- drop policy if exists module_task_memberships_insert on public.module_task_memberships;
-- drop policy if exists module_task_memberships_select on public.module_task_memberships;
-- drop policy if exists project_module_members_delete on public.project_module_members;
-- drop policy if exists project_module_members_update on public.project_module_members;
-- drop policy if exists project_module_members_insert on public.project_module_members;
-- drop policy if exists project_module_members_select on public.project_module_members;
-- drop policy if exists project_modules_delete on public.project_modules;
-- drop policy if exists project_modules_update on public.project_modules;
-- drop policy if exists project_modules_insert on public.project_modules;
-- drop policy if exists project_modules_select on public.project_modules;
-- drop trigger if exists module_task_memberships_validate_task on public.module_task_memberships;
-- drop trigger if exists project_module_members_validate_member on public.project_module_members;
-- drop trigger if exists project_modules_validate_lead on public.project_modules;
-- drop trigger if exists project_modules_set_updated_at on public.project_modules;
-- drop function if exists public.plane_replace_module_tasks(uuid, integer, uuid[], uuid);
-- drop function if exists public.plane_update_project_module(uuid, integer, text, text, text, uuid, date, date, double precision, timestamptz, uuid[], uuid);
-- drop function if exists public.plane_create_project_module(integer, text, text, text, uuid, date, date, double precision, uuid[], uuid);
-- drop function if exists public.plane_modules_validate_task();
-- drop function if exists public.plane_modules_validate_member();
-- drop function if exists public.plane_modules_validate_lead();
-- drop function if exists public.plane_modules_assert_active_project_person(integer, uuid, text);
-- drop function if exists public.plane_modules_set_updated_at();
-- drop table if exists public.module_task_memberships;
-- drop table if exists public.project_module_members;
-- drop table if exists public.project_modules;
-- commit;
