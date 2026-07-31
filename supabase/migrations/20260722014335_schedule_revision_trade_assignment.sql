begin;

alter table public.schedule_revision_task_snapshots
  add column if not exists assignee_person_id uuid references public.people(id) on delete set null;

create index if not exists schedule_revision_task_snapshots_assignee_idx
  on public.schedule_revision_task_snapshots (revision_id, assignee_person_id)
  where assignee_person_id is not null;

create or replace function public.create_schedule_revision_snapshot(
  p_project_id integer,
  p_baseline_revision_id uuid default null
)
returns public.schedule_revisions
language plpgsql security definer set search_path = public, auth as $$
declare v_revision public.schedule_revisions; v_next_revision_number integer;
begin
  if auth.role() <> 'authenticated' or auth.uid() is null or not (public.current_is_app_admin() or public.current_is_project_member(p_project_id::bigint)) then
    raise exception 'You do not have permission to snapshot this project schedule.' using errcode = '42501';
  end if;
  perform 1 from public.projects where id = p_project_id for update;
  if not found then raise exception 'Project not found.' using errcode = 'P0002'; end if;
  if p_baseline_revision_id is not null and not exists (select 1 from public.schedule_revisions where id = p_baseline_revision_id and project_id = p_project_id) then
    raise exception 'Baseline revision does not belong to this project.' using errcode = '42501'; end if;
  select coalesce(max(revision_number), 0) + 1 into v_next_revision_number from public.schedule_revisions where project_id = p_project_id;
  insert into public.schedule_revisions(project_id, revision_number, baseline_revision_id, created_by_user_id)
  values (p_project_id, v_next_revision_number, p_baseline_revision_id, auth.uid()) returning * into v_revision;
  insert into public.schedule_revision_task_snapshots(
    revision_id, source_task_id, name, parent_source_task_id, start_date, finish_date, duration_days, percent_complete, status, is_milestone, wbs_code, sort_order,
    actual_start_date, actual_finish_date, forecast_start_date, forecast_finish_date, remaining_duration_days, constraint_type, constraint_date, assignee_person_id
  ) select v_revision.id, t.id, t.name, t.parent_task_id, t.start_date, t.finish_date, t.duration_days, t.percent_complete, t.status, t.is_milestone, t.wbs_code, t.sort_order,
    t.actual_start_date, t.actual_finish_date, t.forecast_start_date, t.forecast_finish_date, t.remaining_duration_days, t.constraint_type, t.constraint_date, t.assignee_person_id
  from public.schedule_tasks t where t.project_id = p_project_id;
  insert into public.schedule_revision_dependency_snapshots(revision_id, source_dependency_id, task_source_id, predecessor_source_id, dependency_type, lag_days)
  select v_revision.id, d.id, d.task_id, d.predecessor_task_id, d.dependency_type, coalesce(d.lag_days, 0)
  from public.schedule_dependencies d join public.schedule_tasks t on t.id = d.task_id where t.project_id = p_project_id;
  insert into public.schedule_revision_events(project_id, revision_id, event_type, to_status, actor_user_id)
  values (p_project_id, v_revision.id, 'created', 'draft', auth.uid());
  return v_revision;
end; $$;

commit;
