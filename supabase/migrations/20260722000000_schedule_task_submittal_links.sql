begin;

create table if not exists public.schedule_task_submittal_links (
  id uuid primary key default gen_random_uuid(),
  project_id integer not null references public.projects(id) on delete cascade,
  task_id uuid not null references public.schedule_tasks(id) on delete cascade,
  submittal_id uuid not null references public.submittals(id) on delete cascade,
  linked_by_user_id uuid not null,
  linked_at timestamptz not null default now(),
  unique (task_id, submittal_id)
);

create index if not exists idx_schedule_task_submittal_links_task
  on public.schedule_task_submittal_links(task_id);
create index if not exists idx_schedule_task_submittal_links_submittal
  on public.schedule_task_submittal_links(submittal_id);

alter table public.schedule_task_submittal_links enable row level security;
revoke all on table public.schedule_task_submittal_links from anon, authenticated;
grant select on public.schedule_task_submittal_links to authenticated;

drop policy if exists schedule_task_submittal_links_project_member_read on public.schedule_task_submittal_links;
create policy schedule_task_submittal_links_project_member_read
  on public.schedule_task_submittal_links for select to authenticated
  using (public.current_is_app_admin() or public.current_is_project_member(project_id));

create or replace function public.link_schedule_task_submittal(
  p_project_id integer,
  p_task_id uuid,
  p_submittal_id uuid
)
returns public.schedule_task_submittal_links
language plpgsql security definer set search_path = public, auth as $$
declare
  v_link public.schedule_task_submittal_links;
begin
  if auth.role() <> 'authenticated' or auth.uid() is null
     or not (public.current_is_app_admin() or public.current_is_project_member(p_project_id::bigint)) then
    raise exception 'You do not have permission to link submittals to this schedule activity.' using errcode = '42501';
  end if;
  if not exists (select 1 from public.schedule_tasks where id = p_task_id and project_id = p_project_id) then
    raise exception 'Schedule task not found in this project.' using errcode = 'P0002';
  end if;
  if not exists (select 1 from public.submittals where id = p_submittal_id and project_id = p_project_id) then
    raise exception 'Submittal does not belong to this project.' using errcode = '42501';
  end if;
  insert into public.schedule_task_submittal_links(project_id, task_id, submittal_id, linked_by_user_id)
  values (p_project_id, p_task_id, p_submittal_id, auth.uid())
  on conflict (task_id, submittal_id) do update set project_id = excluded.project_id
  returning * into v_link;
  return v_link;
end; $$;

create or replace function public.unlink_schedule_task_submittal(
  p_project_id integer,
  p_task_id uuid,
  p_submittal_id uuid
)
returns void language plpgsql security definer set search_path = public, auth as $$
begin
  if auth.role() <> 'authenticated' or auth.uid() is null
     or not (public.current_is_app_admin() or public.current_is_project_member(p_project_id::bigint)) then
    raise exception 'You do not have permission to unlink submittals from this schedule activity.' using errcode = '42501';
  end if;
  delete from public.schedule_task_submittal_links
  where project_id = p_project_id and task_id = p_task_id and submittal_id = p_submittal_id;
  if not found then
    raise exception 'Submittal link not found in this project.' using errcode = 'P0002';
  end if;
end; $$;

revoke all on function public.link_schedule_task_submittal(integer, uuid, uuid) from public, anon;
grant execute on function public.link_schedule_task_submittal(integer, uuid, uuid) to authenticated;
revoke all on function public.unlink_schedule_task_submittal(integer, uuid, uuid) from public, anon;
grant execute on function public.unlink_schedule_task_submittal(integer, uuid, uuid) to authenticated;

commit;
