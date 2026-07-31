begin;

create table if not exists public.schedule_revisions (
  id uuid primary key default gen_random_uuid(),
  project_id integer not null references public.projects(id) on delete cascade,
  revision_number integer not null check (revision_number > 0),
  baseline_revision_id uuid references public.schedule_revisions(id) on delete restrict,
  status text not null default 'draft' check (status in ('draft', 'review', 'published', 'superseded')),
  created_by_user_id uuid not null,
  created_at timestamptz not null default now(),
  reviewed_at timestamptz,
  published_at timestamptz,
  superseded_at timestamptz,
  unique (project_id, revision_number)
);

create unique index if not exists schedule_revisions_one_published_per_project
  on public.schedule_revisions(project_id) where status = 'published';

create table if not exists public.schedule_revision_task_snapshots (
  id uuid primary key default gen_random_uuid(),
  revision_id uuid not null references public.schedule_revisions(id) on delete cascade,
  source_task_id uuid not null,
  name text not null,
  parent_source_task_id uuid,
  start_date date,
  finish_date date,
  duration_days integer,
  percent_complete integer not null,
  status text not null,
  is_milestone boolean not null,
  wbs_code text,
  sort_order integer not null,
  unique (revision_id, source_task_id)
);

create table if not exists public.schedule_revision_dependency_snapshots (
  id uuid primary key default gen_random_uuid(),
  revision_id uuid not null references public.schedule_revisions(id) on delete cascade,
  source_dependency_id uuid not null,
  task_source_id uuid not null,
  predecessor_source_id uuid not null,
  dependency_type text not null,
  lag_days integer not null default 0,
  unique (revision_id, source_dependency_id)
);

create table if not exists public.schedule_revision_events (
  id uuid primary key default gen_random_uuid(),
  project_id integer not null references public.projects(id) on delete cascade,
  revision_id uuid not null references public.schedule_revisions(id) on delete cascade,
  event_type text not null check (event_type in ('created', 'review_requested', 'published', 'superseded')),
  from_status text,
  to_status text not null,
  actor_user_id uuid not null,
  occurred_at timestamptz not null default now()
);

create index if not exists schedule_revision_events_project_occurred_at_idx
  on public.schedule_revision_events(project_id, occurred_at desc);

alter table public.schedule_revisions enable row level security;
alter table public.schedule_revision_task_snapshots enable row level security;
alter table public.schedule_revision_dependency_snapshots enable row level security;
alter table public.schedule_revision_events enable row level security;

revoke all on public.schedule_revisions, public.schedule_revision_task_snapshots,
  public.schedule_revision_dependency_snapshots, public.schedule_revision_events from anon, authenticated;
grant select on public.schedule_revisions, public.schedule_revision_events to authenticated;
grant select on public.schedule_revision_task_snapshots, public.schedule_revision_dependency_snapshots to authenticated;

create policy schedule_revisions_project_member_read on public.schedule_revisions for select to authenticated
  using (public.current_is_app_admin() or public.current_is_project_member(project_id));
create policy schedule_revision_events_project_member_read on public.schedule_revision_events for select to authenticated
  using (public.current_is_app_admin() or public.current_is_project_member(project_id));
create policy schedule_revision_task_snapshots_project_member_read on public.schedule_revision_task_snapshots for select to authenticated
  using (exists (
    select 1 from public.schedule_revisions r
    where r.id = revision_id and (public.current_is_app_admin() or public.current_is_project_member(r.project_id))
  ));
create policy schedule_revision_dependency_snapshots_project_member_read on public.schedule_revision_dependency_snapshots for select to authenticated
  using (exists (
    select 1 from public.schedule_revisions r
    where r.id = revision_id and (public.current_is_app_admin() or public.current_is_project_member(r.project_id))
  ));

create or replace function public.create_schedule_revision_snapshot(
  p_project_id integer,
  p_baseline_revision_id uuid default null
)
returns public.schedule_revisions
language plpgsql security definer set search_path = public, auth as $$
declare
  v_revision public.schedule_revisions;
  v_next_revision_number integer;
begin
  if auth.role() <> 'authenticated' or auth.uid() is null
     or not (public.current_is_app_admin() or public.current_is_project_member(p_project_id::bigint)) then
    raise exception 'You do not have permission to snapshot this project schedule.' using errcode = '42501';
  end if;
  perform 1 from public.projects where id = p_project_id for update;
  if not found then raise exception 'Project not found.' using errcode = 'P0002'; end if;
  if p_baseline_revision_id is not null and not exists (
    select 1 from public.schedule_revisions where id = p_baseline_revision_id and project_id = p_project_id
  ) then raise exception 'Baseline revision does not belong to this project.' using errcode = '42501'; end if;
  select coalesce(max(revision_number), 0) + 1 into v_next_revision_number
  from public.schedule_revisions where project_id = p_project_id;
  insert into public.schedule_revisions(project_id, revision_number, baseline_revision_id, created_by_user_id)
  values (p_project_id, v_next_revision_number, p_baseline_revision_id, auth.uid()) returning * into v_revision;
  insert into public.schedule_revision_task_snapshots(
    revision_id, source_task_id, name, parent_source_task_id, start_date, finish_date,
    duration_days, percent_complete, status, is_milestone, wbs_code, sort_order
  )
  select v_revision.id, t.id, t.name, t.parent_task_id, t.start_date, t.finish_date,
    t.duration_days, t.percent_complete, t.status, t.is_milestone, t.wbs_code, t.sort_order
  from public.schedule_tasks t where t.project_id = p_project_id;
  insert into public.schedule_revision_dependency_snapshots(
    revision_id, source_dependency_id, task_source_id, predecessor_source_id, dependency_type, lag_days
  )
  select v_revision.id, d.id, d.task_id, d.predecessor_task_id, d.dependency_type, coalesce(d.lag_days, 0)
  from public.schedule_dependencies d
  join public.schedule_tasks t on t.id = d.task_id
  where t.project_id = p_project_id;
  insert into public.schedule_revision_events(project_id, revision_id, event_type, to_status, actor_user_id)
  values (p_project_id, v_revision.id, 'created', 'draft', auth.uid());
  return v_revision;
end; $$;

create or replace function public.transition_schedule_revision(
  p_project_id integer,
  p_revision_id uuid,
  p_to_status text
)
returns public.schedule_revisions
language plpgsql security definer set search_path = public, auth as $$
declare
  v_revision public.schedule_revisions;
  v_event_type text;
begin
  if auth.role() <> 'authenticated' or auth.uid() is null
     or not (public.current_is_app_admin() or public.current_is_project_member(p_project_id::bigint)) then
    raise exception 'You do not have permission to transition this schedule revision.' using errcode = '42501';
  end if;
  select * into v_revision from public.schedule_revisions
  where id = p_revision_id and project_id = p_project_id for update;
  if not found then raise exception 'Schedule revision not found in this project.' using errcode = 'P0002'; end if;
  if p_to_status = 'review' and v_revision.status = 'draft' then
    update public.schedule_revisions set status = 'review', reviewed_at = now() where id = p_revision_id returning * into v_revision;
    v_event_type := 'review_requested';
  elsif p_to_status = 'published' and v_revision.status = 'review' then
    with superseded as (
      update public.schedule_revisions set status = 'superseded', superseded_at = now()
      where project_id = p_project_id and status = 'published'
      returning id
    )
    insert into public.schedule_revision_events(project_id, revision_id, event_type, from_status, to_status, actor_user_id)
    select p_project_id, id, 'superseded', 'published', 'superseded', auth.uid() from superseded;
    update public.schedule_revisions set status = 'published', published_at = now() where id = p_revision_id returning * into v_revision;
    v_event_type := 'published';
  else
    raise exception 'Invalid schedule revision transition from % to %.', v_revision.status, p_to_status using errcode = '22023';
  end if;
  insert into public.schedule_revision_events(project_id, revision_id, event_type, from_status, to_status, actor_user_id)
  values (p_project_id, p_revision_id, v_event_type, case when v_event_type = 'review_requested' then 'draft' else 'review' end, v_revision.status, auth.uid());
  return v_revision;
end; $$;

revoke all on function public.create_schedule_revision_snapshot(integer, uuid) from public, anon;
grant execute on function public.create_schedule_revision_snapshot(integer, uuid) to authenticated;
revoke all on function public.transition_schedule_revision(integer, uuid, text) from public, anon;
grant execute on function public.transition_schedule_revision(integer, uuid, text) to authenticated;

commit;
