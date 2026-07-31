begin;

create table public.procurement_items (
  id uuid primary key default gen_random_uuid(),
  project_id integer not null references public.projects(id) on delete cascade,
  title text not null check (length(trim(title)) > 0),
  description text,
  lifecycle_status text not null default 'awaiting_submittal'
    check (lifecycle_status in (
      'unverified',
      'awaiting_submittal',
      'in_review',
      'approved_to_release',
      'released',
      'vendor_confirmed',
      'fabricating',
      'shipped',
      'partially_received',
      'received',
      'cancelled'
    )),
  responsible_user_id uuid,
  created_by_user_id uuid not null,
  updated_by_user_id uuid not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index procurement_items_project_status_idx
  on public.procurement_items(project_id, lifecycle_status, updated_at desc);

create table public.procurement_item_submittal_links (
  id uuid primary key default gen_random_uuid(),
  project_id integer not null references public.projects(id) on delete cascade,
  procurement_item_id uuid not null references public.procurement_items(id) on delete cascade,
  submittal_id uuid not null references public.submittals(id) on delete cascade,
  linked_by_user_id uuid not null,
  linked_at timestamptz not null default now(),
  unique (procurement_item_id, submittal_id)
);

create index procurement_item_submittal_links_item_idx
  on public.procurement_item_submittal_links(procurement_item_id);
create index procurement_item_submittal_links_submittal_idx
  on public.procurement_item_submittal_links(submittal_id);

create table public.procurement_item_schedule_task_links (
  id uuid primary key default gen_random_uuid(),
  project_id integer not null references public.projects(id) on delete cascade,
  procurement_item_id uuid not null references public.procurement_items(id) on delete cascade,
  schedule_task_id uuid not null references public.schedule_tasks(id) on delete cascade,
  linked_by_user_id uuid not null,
  linked_at timestamptz not null default now(),
  unique (procurement_item_id, schedule_task_id)
);

create index procurement_item_schedule_task_links_item_idx
  on public.procurement_item_schedule_task_links(procurement_item_id);
create index procurement_item_schedule_task_links_task_idx
  on public.procurement_item_schedule_task_links(schedule_task_id);

create table public.procurement_item_events (
  id uuid primary key default gen_random_uuid(),
  project_id integer not null references public.projects(id) on delete cascade,
  procurement_item_id uuid not null references public.procurement_items(id) on delete cascade,
  event_type text not null,
  actor_user_id uuid not null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index procurement_item_events_item_created_idx
  on public.procurement_item_events(procurement_item_id, created_at desc);

alter table public.procurement_items enable row level security;
alter table public.procurement_item_submittal_links enable row level security;
alter table public.procurement_item_schedule_task_links enable row level security;
alter table public.procurement_item_events enable row level security;

revoke all on public.procurement_items from anon, authenticated;
revoke all on public.procurement_item_submittal_links from anon, authenticated;
revoke all on public.procurement_item_schedule_task_links from anon, authenticated;
revoke all on public.procurement_item_events from anon, authenticated;
grant select on public.procurement_items, public.procurement_item_submittal_links,
  public.procurement_item_schedule_task_links, public.procurement_item_events to authenticated;

create policy procurement_items_project_member_read
  on public.procurement_items for select to authenticated
  using (public.current_is_app_admin() or public.current_is_project_member(project_id::bigint));
create policy procurement_item_submittal_links_project_member_read
  on public.procurement_item_submittal_links for select to authenticated
  using (public.current_is_app_admin() or public.current_is_project_member(project_id::bigint));
create policy procurement_item_schedule_task_links_project_member_read
  on public.procurement_item_schedule_task_links for select to authenticated
  using (public.current_is_app_admin() or public.current_is_project_member(project_id::bigint));
create policy procurement_item_events_project_member_read
  on public.procurement_item_events for select to authenticated
  using (public.current_is_app_admin() or public.current_is_project_member(project_id::bigint));

create or replace function public.assert_procurement_project_write(p_project_id integer)
returns void language plpgsql security definer set search_path = public, auth as $$
begin
  if auth.role() <> 'authenticated' or auth.uid() is null
    or not (public.current_is_app_admin() or public.current_is_project_member(p_project_id::bigint)) then
    raise exception 'You do not have permission to update procurement for this project.' using errcode = '42501';
  end if;
end;
$$;

create or replace function public.create_procurement_item(
  p_project_id integer,
  p_title text,
  p_description text default null,
  p_lifecycle_status text default 'awaiting_submittal',
  p_responsible_user_id uuid default null
)
returns public.procurement_items language plpgsql security definer set search_path = public, auth as $$
declare
  v_item public.procurement_items;
begin
  perform public.assert_procurement_project_write(p_project_id);
  if nullif(trim(p_title), '') is null then
    raise exception 'Procurement item title is required.' using errcode = '22023';
  end if;

  insert into public.procurement_items(
    project_id, title, description, lifecycle_status, responsible_user_id,
    created_by_user_id, updated_by_user_id
  ) values (
    p_project_id, trim(p_title), p_description, p_lifecycle_status, p_responsible_user_id,
    auth.uid(), auth.uid()
  ) returning * into v_item;

  insert into public.procurement_item_events(project_id, procurement_item_id, event_type, actor_user_id, payload)
  values (p_project_id, v_item.id, 'item_created', auth.uid(), jsonb_build_object('lifecycle_status', v_item.lifecycle_status));
  return v_item;
end;
$$;

create or replace function public.update_procurement_item(
  p_project_id integer,
  p_procurement_item_id uuid,
  p_title text,
  p_description text,
  p_lifecycle_status text,
  p_responsible_user_id uuid default null
)
returns public.procurement_items language plpgsql security definer set search_path = public, auth as $$
declare
  v_item public.procurement_items;
begin
  perform public.assert_procurement_project_write(p_project_id);
  if nullif(trim(p_title), '') is null then
    raise exception 'Procurement item title is required.' using errcode = '22023';
  end if;

  update public.procurement_items
  set title = trim(p_title), description = p_description, lifecycle_status = p_lifecycle_status,
      responsible_user_id = p_responsible_user_id, updated_by_user_id = auth.uid(), updated_at = now()
  where id = p_procurement_item_id and project_id = p_project_id
  returning * into v_item;
  if not found then
    raise exception 'Procurement item not found in this project.' using errcode = 'P0002';
  end if;

  insert into public.procurement_item_events(project_id, procurement_item_id, event_type, actor_user_id, payload)
  values (p_project_id, v_item.id, 'item_updated', auth.uid(), jsonb_build_object('lifecycle_status', v_item.lifecycle_status));
  return v_item;
end;
$$;

create or replace function public.link_procurement_item_submittal(
  p_project_id integer,
  p_procurement_item_id uuid,
  p_submittal_id uuid
)
returns public.procurement_item_submittal_links language plpgsql security definer set search_path = public, auth as $$
declare
  v_link public.procurement_item_submittal_links;
begin
  perform public.assert_procurement_project_write(p_project_id);
  if not exists (select 1 from public.procurement_items where id = p_procurement_item_id and project_id = p_project_id) then
    raise exception 'Procurement item not found in this project.' using errcode = 'P0002';
  end if;
  if not exists (select 1 from public.submittals where id = p_submittal_id and project_id = p_project_id) then
    raise exception 'Submittal does not belong to this project.' using errcode = '42501';
  end if;
  insert into public.procurement_item_submittal_links(project_id, procurement_item_id, submittal_id, linked_by_user_id)
  values (p_project_id, p_procurement_item_id, p_submittal_id, auth.uid())
  on conflict (procurement_item_id, submittal_id) do update set project_id = excluded.project_id
  returning * into v_link;
  insert into public.procurement_item_events(project_id, procurement_item_id, event_type, actor_user_id, payload)
  values (p_project_id, p_procurement_item_id, 'submittal_linked', auth.uid(), jsonb_build_object('submittal_id', p_submittal_id));
  return v_link;
end;
$$;

create or replace function public.unlink_procurement_item_submittal(
  p_project_id integer,
  p_procurement_item_id uuid,
  p_submittal_id uuid
)
returns void language plpgsql security definer set search_path = public, auth as $$
begin
  perform public.assert_procurement_project_write(p_project_id);
  delete from public.procurement_item_submittal_links
  where project_id = p_project_id and procurement_item_id = p_procurement_item_id and submittal_id = p_submittal_id;
  if not found then
    raise exception 'Submittal link not found in this procurement item.' using errcode = 'P0002';
  end if;
  insert into public.procurement_item_events(project_id, procurement_item_id, event_type, actor_user_id, payload)
  values (p_project_id, p_procurement_item_id, 'submittal_unlinked', auth.uid(), jsonb_build_object('submittal_id', p_submittal_id));
end;
$$;

create or replace function public.link_procurement_item_schedule_task(
  p_project_id integer,
  p_procurement_item_id uuid,
  p_schedule_task_id uuid
)
returns public.procurement_item_schedule_task_links language plpgsql security definer set search_path = public, auth as $$
declare
  v_link public.procurement_item_schedule_task_links;
begin
  perform public.assert_procurement_project_write(p_project_id);
  if not exists (select 1 from public.procurement_items where id = p_procurement_item_id and project_id = p_project_id) then
    raise exception 'Procurement item not found in this project.' using errcode = 'P0002';
  end if;
  if not exists (select 1 from public.schedule_tasks where id = p_schedule_task_id and project_id = p_project_id) then
    raise exception 'Schedule task does not belong to this project.' using errcode = '42501';
  end if;
  insert into public.procurement_item_schedule_task_links(project_id, procurement_item_id, schedule_task_id, linked_by_user_id)
  values (p_project_id, p_procurement_item_id, p_schedule_task_id, auth.uid())
  on conflict (procurement_item_id, schedule_task_id) do update set project_id = excluded.project_id
  returning * into v_link;
  insert into public.procurement_item_events(project_id, procurement_item_id, event_type, actor_user_id, payload)
  values (p_project_id, p_procurement_item_id, 'schedule_task_linked', auth.uid(), jsonb_build_object('schedule_task_id', p_schedule_task_id));
  return v_link;
end;
$$;

create or replace function public.unlink_procurement_item_schedule_task(
  p_project_id integer,
  p_procurement_item_id uuid,
  p_schedule_task_id uuid
)
returns void language plpgsql security definer set search_path = public, auth as $$
begin
  perform public.assert_procurement_project_write(p_project_id);
  delete from public.procurement_item_schedule_task_links
  where project_id = p_project_id and procurement_item_id = p_procurement_item_id and schedule_task_id = p_schedule_task_id;
  if not found then
    raise exception 'Schedule-task link not found in this procurement item.' using errcode = 'P0002';
  end if;
  insert into public.procurement_item_events(project_id, procurement_item_id, event_type, actor_user_id, payload)
  values (p_project_id, p_procurement_item_id, 'schedule_task_unlinked', auth.uid(), jsonb_build_object('schedule_task_id', p_schedule_task_id));
end;
$$;

revoke all on function public.assert_procurement_project_write(integer) from public, anon, authenticated;
revoke all on function public.create_procurement_item(integer, text, text, text, uuid) from public, anon;
revoke all on function public.update_procurement_item(integer, uuid, text, text, text, uuid) from public, anon;
revoke all on function public.link_procurement_item_submittal(integer, uuid, uuid) from public, anon;
revoke all on function public.unlink_procurement_item_submittal(integer, uuid, uuid) from public, anon;
revoke all on function public.link_procurement_item_schedule_task(integer, uuid, uuid) from public, anon;
revoke all on function public.unlink_procurement_item_schedule_task(integer, uuid, uuid) from public, anon;
grant execute on function public.create_procurement_item(integer, text, text, text, uuid) to authenticated;
grant execute on function public.update_procurement_item(integer, uuid, text, text, text, uuid) to authenticated;
grant execute on function public.link_procurement_item_submittal(integer, uuid, uuid) to authenticated;
grant execute on function public.unlink_procurement_item_submittal(integer, uuid, uuid) to authenticated;
grant execute on function public.link_procurement_item_schedule_task(integer, uuid, uuid) to authenticated;
grant execute on function public.unlink_procurement_item_schedule_task(integer, uuid, uuid) to authenticated;

comment on table public.procurement_items is 'Canonical project procurement control items. Schedule, submittal, and commercial systems remain the source of their own facts.';
comment on table public.procurement_item_events is 'Append-only controlled history for procurement-item mutations and source-link changes.';

commit;
