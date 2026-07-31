begin;

-- Revisions that predate the Phase 3 context capture received calendar,
-- deadline, and submittal context reconstructed from migration-time live data.
alter table public.schedule_revisions
  add column if not exists snapshot_context_provenance text;
update public.schedule_revisions
set snapshot_context_provenance = 'reconstructed'
where snapshot_context_provenance is null;
alter table public.schedule_revisions
  alter column snapshot_context_provenance set default 'captured',
  alter column snapshot_context_provenance set not null;
do $$
begin
  alter table public.schedule_revisions
    add constraint schedule_revisions_snapshot_context_provenance_check
    check (snapshot_context_provenance in ('captured', 'reconstructed'));
exception when duplicate_object then null;
end;
$$;

-- Foreign-key checks and cleanup need leading indexes.
create index if not exists projects_current_schedule_revision_id_idx
  on public.projects(current_schedule_revision_id)
  where current_schedule_revision_id is not null;
create index if not exists schedule_baselines_revision_id_idx
  on public.schedule_baselines(revision_id);
create index if not exists schedule_baseline_events_baseline_id_idx
  on public.schedule_baseline_events(baseline_id);

-- Tie every duplicated tenant key to its owning row so RLS cannot be made to
-- trust a project_id that disagrees with the referenced revision/baseline.
create unique index if not exists schedule_revisions_id_project_id_unique
  on public.schedule_revisions(id, project_id);
create unique index if not exists schedule_baselines_id_project_id_unique
  on public.schedule_baselines(id, project_id);

alter table public.schedule_baselines
  drop constraint if exists schedule_baselines_revision_id_fkey;
alter table public.schedule_baselines
  add constraint schedule_baselines_revision_project_fkey
  foreign key (revision_id, project_id)
  references public.schedule_revisions(id, project_id)
  on delete cascade;

alter table public.schedule_baseline_events
  drop constraint if exists schedule_baseline_events_baseline_id_fkey;
alter table public.schedule_baseline_events
  add constraint schedule_baseline_events_baseline_project_fkey
  foreign key (baseline_id, project_id)
  references public.schedule_baselines(id, project_id)
  on delete cascade;

alter table public.schedule_revision_dependency_snapshots
  add constraint schedule_revision_dependency_task_snapshot_fkey
  foreign key (revision_id, task_source_id)
  references public.schedule_revision_task_snapshots(revision_id, source_task_id)
  on delete cascade;
alter table public.schedule_revision_dependency_snapshots
  add constraint schedule_revision_dependency_predecessor_snapshot_fkey
  foreign key (revision_id, predecessor_source_id)
  references public.schedule_revision_task_snapshots(revision_id, source_task_id)
  on delete cascade;
alter table public.schedule_revision_submittal_snapshots
  add constraint schedule_revision_submittal_task_snapshot_fkey
  foreign key (revision_id, source_task_id)
  references public.schedule_revision_task_snapshots(revision_id, source_task_id)
  on delete cascade;

-- The pointer is owned exclusively by trusted publish transactions. Even an
-- authenticated project member with broad projects UPDATE permission cannot
-- null it or point it across projects/statuses.
create or replace function public.guard_schedule_current_revision_pointer()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if new.current_schedule_revision_id is not distinct from old.current_schedule_revision_id then
    return new;
  end if;

  if current_user not in ('postgres', 'supabase_admin', 'service_role') then
    raise exception 'The published schedule pointer can only be changed by the guarded publish transaction.' using errcode = '42501';
  end if;

  if new.current_schedule_revision_id is not null and not exists (
    select 1
    from public.schedule_revisions revision
    where revision.id = new.current_schedule_revision_id
      and revision.project_id = new.id
      and revision.status = 'published'
  ) then
    raise exception 'The current schedule revision must be a published revision in this project.' using errcode = '23514';
  end if;

  return new;
end;
$$;

drop trigger if exists projects_guard_schedule_current_revision_pointer on public.projects;
create trigger projects_guard_schedule_current_revision_pointer
before update of current_schedule_revision_id on public.projects
for each row execute function public.guard_schedule_current_revision_pointer();

-- A schedule revision must represent one coherent point in time. The existing
-- schedule writers do not share a project advisory lock, so this rare capture
-- transaction takes SHARE table locks across every mutable source family.
-- Normal reads continue; writes wait only for the short snapshot transaction.
create or replace function public.create_schedule_revision_snapshot(
  p_project_id integer,
  p_baseline_revision_id uuid default null
)
returns public.schedule_revisions
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_revision public.schedule_revisions;
  v_next_revision_number integer;
  v_active_baseline_revision_id uuid;
  v_working_weekdays smallint[];
  v_calendar_exceptions jsonb;
  v_source_count integer;
  v_inserted_count integer;
begin
  if auth.uid() is null
     or not (public.current_is_app_admin() or public.current_is_project_member(p_project_id::bigint)) then
    raise exception 'You do not have permission to snapshot this project schedule.' using errcode = '42501';
  end if;

  perform 1 from public.projects where id = p_project_id for update;
  if not found then raise exception 'Project not found.' using errcode = 'P0002'; end if;

  lock table
    public.schedule_tasks,
    public.schedule_dependencies,
    public.schedule_deadlines,
    public.schedule_task_submittal_links,
    public.submittals,
    public.submittal_responses,
    public.project_schedule_calendars,
    public.project_schedule_calendar_exceptions
  in share mode;

  select baseline.revision_id into v_active_baseline_revision_id
  from public.schedule_baselines baseline
  where baseline.project_id = p_project_id and baseline.is_active;

  if p_baseline_revision_id is not null
     and p_baseline_revision_id is distinct from v_active_baseline_revision_id then
    raise exception 'The requested baseline is not the project active baseline.' using errcode = '22023';
  end if;

  select coalesce(max(revision_number), 0) + 1 into v_next_revision_number
  from public.schedule_revisions where project_id = p_project_id;

  insert into public.schedule_revisions(project_id, revision_number, baseline_revision_id, created_by_user_id)
  values (p_project_id, v_next_revision_number, v_active_baseline_revision_id, auth.uid())
  returning * into v_revision;

  select count(*) into v_source_count from public.schedule_tasks where project_id = p_project_id;
  insert into public.schedule_revision_task_snapshots(
    revision_id, source_task_id, name, parent_source_task_id, start_date, finish_date,
    duration_days, percent_complete, status, is_milestone, wbs_code, sort_order,
    actual_start_date, actual_finish_date, forecast_start_date, forecast_finish_date,
    remaining_duration_days, constraint_type, constraint_date, assignee_person_id, deadline_date
  )
  select
    v_revision.id, task.id, task.name, task.parent_task_id, task.start_date, task.finish_date,
    task.duration_days, task.percent_complete, task.status, task.is_milestone, task.wbs_code, task.sort_order,
    task.actual_start_date, task.actual_finish_date, task.forecast_start_date, task.forecast_finish_date,
    task.remaining_duration_days, task.constraint_type, task.constraint_date, task.assignee_person_id,
    deadline.deadline_date
  from public.schedule_tasks task
  left join lateral (
    select schedule_deadline.deadline_date
    from public.schedule_deadlines schedule_deadline
    where schedule_deadline.task_id = task.id
    order by schedule_deadline.created_at desc
    limit 1
  ) deadline on true
  where task.project_id = p_project_id;
  get diagnostics v_inserted_count = row_count;
  if v_inserted_count <> v_source_count then
    raise exception 'Schedule task snapshot count mismatch.' using errcode = '55000';
  end if;

  select count(*) into v_source_count
  from public.schedule_dependencies dependency
  join public.schedule_tasks task on task.id = dependency.task_id
  where task.project_id = p_project_id;
  insert into public.schedule_revision_dependency_snapshots(
    revision_id, source_dependency_id, task_source_id, predecessor_source_id, dependency_type, lag_days
  )
  select v_revision.id, dependency.id, dependency.task_id, dependency.predecessor_task_id,
    dependency.dependency_type, coalesce(dependency.lag_days, 0)
  from public.schedule_dependencies dependency
  join public.schedule_tasks task on task.id = dependency.task_id
  where task.project_id = p_project_id;
  get diagnostics v_inserted_count = row_count;
  if v_inserted_count <> v_source_count then
    raise exception 'Schedule dependency snapshot count mismatch.' using errcode = '55000';
  end if;

  select count(*) into v_source_count
  from public.schedule_task_submittal_links link
  join public.submittals submittal on submittal.id = link.submittal_id
  where link.project_id = p_project_id;
  insert into public.schedule_revision_submittal_snapshots(
    revision_id, source_task_id, submittal_id, submittal_status,
    required_approval_date, submittal_number, title, response_statuses
  )
  select
    v_revision.id, link.task_id, submittal.id, submittal.status,
    submittal.required_approval_date, submittal.submittal_number, submittal.title,
    coalesce((
      select array_agg(response.response_status order by response.responded_at nulls last, response.id)
      from public.submittal_responses response
      where response.submittal_id = submittal.id
    ), '{}'::text[])
  from public.schedule_task_submittal_links link
  join public.submittals submittal on submittal.id = link.submittal_id
  where link.project_id = p_project_id;
  get diagnostics v_inserted_count = row_count;
  if v_inserted_count <> v_source_count then
    raise exception 'Schedule submittal snapshot count mismatch.' using errcode = '55000';
  end if;

  select coalesce(calendar.working_weekdays, array[1, 2, 3, 4, 5]::smallint[])
  into v_working_weekdays
  from (select 1) seed
  left join public.project_schedule_calendars calendar on calendar.project_id = p_project_id;

  select coalesce(jsonb_agg(
    jsonb_build_object(
      'date', exception.exception_date,
      'is_working', exception.is_working,
      'reason', exception.reason
    ) order by exception.exception_date
  ), '[]'::jsonb)
  into v_calendar_exceptions
  from public.project_schedule_calendar_exceptions exception
  where exception.project_id = p_project_id;

  insert into public.schedule_revision_calendar_snapshots(revision_id, working_weekdays, exceptions)
  values (v_revision.id, v_working_weekdays, v_calendar_exceptions);

  insert into public.schedule_revision_events(project_id, revision_id, event_type, to_status, actor_user_id)
  values (p_project_id, v_revision.id, 'created', 'draft', auth.uid());

  return v_revision;
end;
$$;

revoke all on function public.create_schedule_revision_snapshot(integer, uuid) from public, anon;
grant execute on function public.create_schedule_revision_snapshot(integer, uuid) to authenticated;

commit;
