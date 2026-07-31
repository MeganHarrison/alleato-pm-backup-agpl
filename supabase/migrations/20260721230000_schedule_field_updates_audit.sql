-- Field schedule facts must not be writable through the generic task update
-- surface. The RPC below is the only path that can change these columns and
-- append the immutable audit record.
begin;

alter table public.schedule_tasks
  add column if not exists actual_start_date date,
  add column if not exists actual_finish_date date,
  add column if not exists forecast_start_date date,
  add column if not exists forecast_finish_date date,
  add column if not exists remaining_duration_days integer;

do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'schedule_tasks_remaining_duration_nonnegative') then
    alter table public.schedule_tasks add constraint schedule_tasks_remaining_duration_nonnegative check (remaining_duration_days is null or remaining_duration_days >= 0);
  end if;
end $$;

create table if not exists public.schedule_task_field_updates (
  id uuid primary key default gen_random_uuid(),
  project_id integer not null references public.projects(id) on delete cascade,
  task_id uuid not null references public.schedule_tasks(id) on delete cascade,
  actor_user_id uuid not null,
  changed_at timestamptz not null default now(),
  prior_values jsonb not null,
  new_values jsonb not null,
  delay_reason text,
  note text,
  attachment_urls jsonb not null default '[]'::jsonb,
  downstream_impact jsonb not null default '[]'::jsonb
);

create index if not exists idx_schedule_task_field_updates_task_changed
  on public.schedule_task_field_updates(task_id, changed_at desc);

alter table public.schedule_tasks enable row level security;
alter table public.schedule_task_field_updates enable row level security;

drop policy if exists schedule_tasks_project_member_read on public.schedule_tasks;
drop policy if exists schedule_tasks_project_member_legacy_write on public.schedule_tasks;
drop policy if exists schedule_tasks_project_member_insert on public.schedule_tasks;
drop policy if exists schedule_tasks_project_member_delete on public.schedule_tasks;
create policy schedule_tasks_project_member_read on public.schedule_tasks for select to authenticated
  using (public.current_is_app_admin() or public.current_is_project_member(project_id));
create policy schedule_tasks_project_member_legacy_write on public.schedule_tasks for update to authenticated
  using (public.current_is_app_admin() or public.current_is_project_member(project_id))
  with check (public.current_is_app_admin() or public.current_is_project_member(project_id));
create policy schedule_tasks_project_member_insert on public.schedule_tasks for insert to authenticated
  with check (public.current_is_app_admin() or public.current_is_project_member(project_id));
create policy schedule_tasks_project_member_delete on public.schedule_tasks for delete to authenticated
  using (public.current_is_app_admin() or public.current_is_project_member(project_id));

create policy schedule_task_field_updates_project_member_read on public.schedule_task_field_updates for select to authenticated
  using (public.current_is_app_admin() or public.current_is_project_member(project_id));

revoke all on table public.schedule_task_field_updates from anon, authenticated;
grant select on public.schedule_task_field_updates to authenticated;
revoke update on public.schedule_tasks from authenticated;
grant update (name, parent_task_id, start_date, finish_date, duration_days, percent_complete, status, is_milestone, constraint_type, constraint_date, wbs_code, sort_order, assignee, assignee_person_id, priority) on public.schedule_tasks to authenticated;

create or replace function public.apply_schedule_field_update(
  p_project_id integer,
  p_task_id uuid,
  p_actual_start_date date default null,
  p_actual_finish_date date default null,
  p_forecast_start_date date default null,
  p_forecast_finish_date date default null,
  p_remaining_duration_days integer default null,
  p_delay_reason text default null,
  p_note text default null,
  p_attachment_urls jsonb default '[]'::jsonb
)
returns jsonb language plpgsql security definer set search_path = public, auth as $$
declare
  v_task public.schedule_tasks;
  v_prior jsonb;
  v_new jsonb;
  v_impact jsonb;
begin
  if auth.role() <> 'authenticated' or auth.uid() is null
     or not (public.current_is_app_admin() or public.current_is_project_member(p_project_id::bigint)) then
    raise exception 'You do not have permission to update this project schedule activity.' using errcode = '42501';
  end if;
  if p_remaining_duration_days is not null and p_remaining_duration_days < 0 then
    raise exception 'remaining_duration_days must be zero or greater.' using errcode = '22023';
  end if;
  if (p_forecast_start_date is not null or p_forecast_finish_date is not null or p_remaining_duration_days is not null)
     and coalesce(nullif(trim(p_delay_reason), ''), '') = '' then
    raise exception 'Provide a delay reason when changing forecast dates or remaining duration.' using errcode = '22023';
  end if;
  select * into v_task from public.schedule_tasks where id = p_task_id and project_id = p_project_id for update;
  if not found then raise exception 'Schedule task not found in this project.' using errcode = 'P0002'; end if;
  v_prior := jsonb_build_object('actual_start_date', v_task.actual_start_date, 'actual_finish_date', v_task.actual_finish_date, 'forecast_start_date', v_task.forecast_start_date, 'forecast_finish_date', v_task.forecast_finish_date, 'remaining_duration_days', v_task.remaining_duration_days);
  update public.schedule_tasks set actual_start_date = coalesce(p_actual_start_date, actual_start_date), actual_finish_date = coalesce(p_actual_finish_date, actual_finish_date), forecast_start_date = coalesce(p_forecast_start_date, forecast_start_date), forecast_finish_date = coalesce(p_forecast_finish_date, forecast_finish_date), remaining_duration_days = coalesce(p_remaining_duration_days, remaining_duration_days), updated_at = now() where id = p_task_id returning jsonb_build_object('actual_start_date', actual_start_date, 'actual_finish_date', actual_finish_date, 'forecast_start_date', forecast_start_date, 'forecast_finish_date', forecast_finish_date, 'remaining_duration_days', remaining_duration_days) into v_new;
  with recursive downstream as (select d.task_id from public.schedule_dependencies d where d.project_id = p_project_id and d.predecessor_task_id = p_task_id union select d.task_id from public.schedule_dependencies d join downstream x on d.predecessor_task_id = x.task_id where d.project_id = p_project_id) select coalesce(jsonb_agg(jsonb_build_object('task_id', t.id, 'name', t.name, 'start_date', t.start_date, 'finish_date', t.finish_date)), '[]'::jsonb) into v_impact from downstream x join public.schedule_tasks t on t.id = x.task_id;
  insert into public.schedule_task_field_updates(project_id, task_id, actor_user_id, prior_values, new_values, delay_reason, note, attachment_urls, downstream_impact) values (p_project_id, p_task_id, auth.uid(), v_prior, v_new, nullif(trim(p_delay_reason), ''), nullif(trim(p_note), ''), coalesce(p_attachment_urls, '[]'::jsonb), v_impact);
  return jsonb_build_object('prior_values', v_prior, 'new_values', v_new, 'downstream_impact', v_impact);
end; $$;

revoke all on function public.apply_schedule_field_update(integer, uuid, date, date, date, date, integer, text, text, jsonb) from public, anon;
grant execute on function public.apply_schedule_field_update(integer, uuid, date, date, date, date, integer, text, text, jsonb) to authenticated;
commit;
