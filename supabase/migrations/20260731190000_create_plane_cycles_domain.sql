-- Plane-derived project cycle domain.
--
-- Lifecycle boundary:
--   * public.tasks remains the canonical work-item record.
--   * public.schedule_tasks remains the construction schedule record.
--   * public.project_cycles groups canonical tasks into time-boxed iterations.
--   * public.cycle_task_memberships is the only cycle-to-task association.
--
-- This migration intentionally does not backfill from schedule_tasks. The
-- temporary Cycles UI relabeling is a presentation concern, not cycle data.

create table public.project_cycles (
  id uuid primary key default gen_random_uuid(),
  project_id bigint not null references public.projects(id) on delete cascade,
  name text not null check (length(btrim(name)) between 1 and 255),
  description text not null default '',
  start_date date,
  end_date date,
  owned_by uuid references auth.users(id) on delete set null,
  timezone text not null default 'UTC',
  sort_order double precision not null default 65535,
  view_props jsonb not null default '{}'::jsonb,
  progress_snapshot jsonb not null default '{}'::jsonb,
  external_source text,
  external_id text,
  archived_at timestamptz,
  version integer not null default 1 check (version > 0),
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint project_cycles_dates_complete check (
    (start_date is null and end_date is null)
    or (start_date is not null and end_date is not null)
  ),
  constraint project_cycles_dates_ordered check (
    start_date is null or start_date <= end_date
  )
);

create unique index project_cycles_external_identity_unique
  on public.project_cycles(project_id, external_source, external_id)
  where external_source is not null and external_id is not null;

create index project_cycles_project_dates_idx
  on public.project_cycles(project_id, start_date, end_date)
  where archived_at is null;

create index project_cycles_project_sort_idx
  on public.project_cycles(project_id, sort_order, created_at desc);

create table public.cycle_task_memberships (
  id uuid primary key default gen_random_uuid(),
  project_id bigint not null references public.projects(id) on delete cascade,
  cycle_id uuid not null references public.project_cycles(id) on delete cascade,
  task_id uuid not null references public.tasks(id) on delete cascade,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  constraint cycle_task_memberships_one_cycle_per_task unique (task_id),
  constraint cycle_task_memberships_cycle_task_unique unique (cycle_id, task_id)
);

create index cycle_task_memberships_cycle_idx
  on public.cycle_task_memberships(cycle_id, created_at);

create index cycle_task_memberships_project_idx
  on public.cycle_task_memberships(project_id, cycle_id);

create or replace function public.resolve_cycle_task_project_id(p_task_id uuid)
returns bigint
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_direct_project_id bigint;
  v_project_ids integer[];
  v_metadata_project_id bigint;
begin
  select
    t.project_id,
    t.project_ids,
    dm.project_id
  into
    v_direct_project_id,
    v_project_ids,
    v_metadata_project_id
  from public.tasks t
  left join public.document_metadata dm on dm.id = t.metadata_id
  where t.id = p_task_id;

  if not found then
    raise exception using
      errcode = '23503',
      message = 'Cycle membership task does not exist.';
  end if;

  if v_direct_project_id is not null then
    return v_direct_project_id;
  end if;

  if coalesce(cardinality(v_project_ids), 0) > 1 then
    raise exception using
      errcode = '23514',
      message = 'Cycle membership task has ambiguous legacy project ownership.';
  end if;

  if coalesce(cardinality(v_project_ids), 0) = 1 then
    if v_project_ids[1] is null then
      raise exception using
        errcode = '23514',
        message = 'Cycle membership task has invalid legacy project ownership.';
    end if;
    if v_metadata_project_id is not null
       and v_metadata_project_id <> v_project_ids[1] then
      raise exception using
        errcode = '23514',
        message = 'Cycle membership task and source document identify different projects.';
    end if;
    return v_project_ids[1];
  end if;

  if v_metadata_project_id is not null then
    return v_metadata_project_id;
  end if;

  raise exception using
    errcode = '23514',
    message = 'Cycle membership task is not associated with a project.';
end;
$$;

create or replace function public.enforce_cycle_task_project_scope()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_cycle_project_id bigint;
  v_task_project_id bigint;
begin
  select project_id
  into v_cycle_project_id
  from public.project_cycles
  where id = new.cycle_id;

  if v_cycle_project_id is null then
    raise exception using
      errcode = '23503',
      message = 'Cycle membership cycle does not exist.';
  end if;

  v_task_project_id := public.resolve_cycle_task_project_id(new.task_id);

  if new.project_id is distinct from v_cycle_project_id
     or new.project_id is distinct from v_task_project_id then
    raise exception using
      errcode = '23514',
      message = 'Cycle, task, and membership must belong to the same project.';
  end if;

  return new;
end;
$$;

create trigger cycle_task_memberships_project_scope
before insert or update of project_id, cycle_id, task_id
on public.cycle_task_memberships
for each row execute function public.enforce_cycle_task_project_scope();

create or replace function public.set_cycle_task_memberships(
  p_project_id bigint,
  p_cycle_id uuid,
  p_task_ids uuid[],
  p_created_by uuid
)
returns setof public.cycle_task_memberships
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_task_id uuid;
begin
  if coalesce(cardinality(p_task_ids), 0) < 1
     or cardinality(p_task_ids) > 500 then
    raise exception using
      errcode = '22023',
      message = 'Cycle membership requires between 1 and 500 tasks.';
  end if;

  if not exists (
    select 1
    from public.project_cycles
    where id = p_cycle_id and project_id = p_project_id
  ) then
    raise exception using
      errcode = '23503',
      message = 'Cycle does not belong to the requested project.';
  end if;

  foreach v_task_id in array p_task_ids loop
    if public.resolve_cycle_task_project_id(v_task_id) <> p_project_id then
      raise exception using
        errcode = '23514',
        message = 'Every cycle task must belong to the requested project.';
    end if;
  end loop;

  delete from public.cycle_task_memberships
  where task_id = any(p_task_ids);

  return query
  insert into public.cycle_task_memberships (
    project_id,
    cycle_id,
    task_id,
    created_by
  )
  select
    p_project_id,
    p_cycle_id,
    task_id,
    p_created_by
  from (
    select distinct task_id
    from unnest(p_task_ids) as task_id
  ) unique_tasks
  returning *;
end;
$$;

create or replace function public.touch_project_cycle_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  new.version = old.version + 1;
  return new;
end;
$$;

create trigger project_cycles_touch_updated_at
before update on public.project_cycles
for each row execute function public.touch_project_cycle_updated_at();

revoke all on function public.resolve_cycle_task_project_id(uuid)
  from public, anon, authenticated;
revoke all on function public.enforce_cycle_task_project_scope()
  from public, anon, authenticated;
revoke all on function public.set_cycle_task_memberships(bigint, uuid, uuid[], uuid)
  from public, anon, authenticated;
revoke all on function public.touch_project_cycle_updated_at()
  from public, anon, authenticated;
grant execute on function public.set_cycle_task_memberships(bigint, uuid, uuid[], uuid)
  to service_role;

grant select, insert, update, delete on public.project_cycles
  to authenticated, service_role;
grant select, insert, delete on public.cycle_task_memberships
  to authenticated, service_role;

alter table public.project_cycles enable row level security;
alter table public.cycle_task_memberships enable row level security;

create policy project_cycles_select_project_member
  on public.project_cycles for select to authenticated
  using (
    (select public.current_is_app_admin())
    or public.current_is_project_member(project_id)
  );

create policy project_cycles_insert_schedule_writer
  on public.project_cycles for insert to authenticated
  with check (
    public.current_has_project_module_permission(project_id, 'schedule', 'write')
  );

create policy project_cycles_update_schedule_writer
  on public.project_cycles for update to authenticated
  using (
    public.current_has_project_module_permission(project_id, 'schedule', 'write')
  )
  with check (
    public.current_has_project_module_permission(project_id, 'schedule', 'write')
  );

create policy project_cycles_delete_schedule_writer
  on public.project_cycles for delete to authenticated
  using (
    public.current_has_project_module_permission(project_id, 'schedule', 'write')
  );

create policy cycle_task_memberships_select_project_member
  on public.cycle_task_memberships for select to authenticated
  using (
    (select public.current_is_app_admin())
    or public.current_is_project_member(project_id)
  );

create policy cycle_task_memberships_insert_schedule_writer
  on public.cycle_task_memberships for insert to authenticated
  with check (
    public.current_has_project_module_permission(project_id, 'schedule', 'write')
  );

create policy cycle_task_memberships_delete_schedule_writer
  on public.cycle_task_memberships for delete to authenticated
  using (
    public.current_has_project_module_permission(project_id, 'schedule', 'write')
  );

comment on table public.project_cycles is
  'Project-scoped Plane-style iterations. Independent from construction schedule_tasks.';

comment on table public.cycle_task_memberships is
  'Canonical task membership in project cycles. A task belongs to at most one cycle.';

-- Rollback (manual, destructive, and only before dependent releases):
-- drop function if exists public.set_cycle_task_memberships(bigint, uuid, uuid[], uuid);
-- drop table if exists public.cycle_task_memberships;
-- drop table if exists public.project_cycles;
-- drop function if exists public.enforce_cycle_task_project_scope();
-- drop function if exists public.resolve_cycle_task_project_id(uuid);
-- drop function if exists public.touch_project_cycle_updated_at();
