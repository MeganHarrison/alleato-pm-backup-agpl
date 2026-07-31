begin;

-- Preserve the manager-only state machine and explicit current pointer from
-- 20260722045025 while restoring the publish alert side effect introduced by
-- 20260722015648. Publication and notification delivery remain atomic.
create or replace function public.transition_schedule_revision(
  p_project_id integer,
  p_revision_id uuid,
  p_to_status text
)
returns public.schedule_revisions
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_revision public.schedule_revisions;
  v_previous_revision_id uuid;
  v_superseded record;
begin
  if auth.uid() is null
     or not public.current_can_manage_schedule(p_project_id::bigint) then
    raise exception 'Only a project schedule admin can transition a schedule revision.' using errcode = '42501';
  end if;

  perform 1 from public.projects where id = p_project_id for update;
  if not found then raise exception 'Project not found.' using errcode = 'P0002'; end if;

  select * into v_revision from public.schedule_revisions
  where id = p_revision_id and project_id = p_project_id for update;
  if not found then raise exception 'Schedule revision not found in this project.' using errcode = 'P0002'; end if;

  if p_to_status = 'review' and v_revision.status = 'draft' then
    update public.schedule_revisions
    set status = 'review', reviewed_at = now()
    where id = p_revision_id returning * into v_revision;
    insert into public.schedule_revision_events(project_id, revision_id, event_type, from_status, to_status, actor_user_id)
    values (p_project_id, p_revision_id, 'review_requested', 'draft', 'review', auth.uid());
  elsif p_to_status = 'published' and v_revision.status = 'review' then
    select id into v_previous_revision_id
    from public.schedule_revisions
    where project_id = p_project_id and status = 'published' and id <> p_revision_id
    for update;

    for v_superseded in
      update public.schedule_revisions
      set status = 'superseded', superseded_at = now()
      where project_id = p_project_id and status = 'published' and id <> p_revision_id
      returning id
    loop
      insert into public.schedule_revision_events(project_id, revision_id, event_type, from_status, to_status, actor_user_id)
      values (p_project_id, v_superseded.id, 'superseded', 'published', 'superseded', auth.uid());
    end loop;

    update public.schedule_revisions
    set status = 'published', published_at = now(), superseded_at = null
    where id = p_revision_id returning * into v_revision;
    update public.projects set current_schedule_revision_id = p_revision_id where id = p_project_id;

    perform public.emit_published_schedule_change_alerts(
      p_project_id,
      p_revision_id,
      v_previous_revision_id,
      auth.uid()
    );

    insert into public.schedule_revision_events(project_id, revision_id, event_type, from_status, to_status, actor_user_id)
    values (p_project_id, p_revision_id, 'published', 'review', 'published', auth.uid());
  else
    raise exception 'Invalid schedule revision transition from % to %.', v_revision.status, p_to_status using errcode = '22023';
  end if;

  return v_revision;
end;
$$;

revoke all on function public.transition_schedule_revision(integer, uuid, text) from public, anon;
grant execute on function public.transition_schedule_revision(integer, uuid, text) to authenticated;

-- This is an internal side effect of the guarded transition transaction, not
-- a client RPC. The owner-executed transition can still invoke it.
alter function public.emit_published_schedule_change_alerts(integer, uuid, uuid, uuid)
  set search_path = pg_catalog, pg_temp;
revoke all on function public.emit_published_schedule_change_alerts(integer, uuid, uuid, uuid)
  from public, anon, authenticated, service_role;

commit;
