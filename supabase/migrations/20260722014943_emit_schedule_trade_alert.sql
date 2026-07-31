begin;

create or replace function public.emit_schedule_trade_alert(
  p_project_id integer,
  p_revision_id uuid,
  p_source_task_id uuid,
  p_change_kind text,
  p_title text,
  p_body text default null
)
returns public.collaboration_notifications
language plpgsql security definer set search_path = public, auth as $$
declare
  v_revision public.schedule_revisions;
  v_assignee_person_id uuid;
  v_recipient_user_id uuid;
  v_event_key text;
  v_notification public.collaboration_notifications;
begin
  if auth.role() <> 'authenticated' or auth.uid() is null
     or not (public.current_is_app_admin() or public.current_is_project_member(p_project_id::bigint)) then
    raise exception 'You do not have permission to emit this schedule alert.' using errcode = '42501';
  end if;
  if p_change_kind not in ('date_changed', 'dependency_changed', 'submittal_changed') then
    raise exception 'Unsupported schedule alert kind.' using errcode = '22023';
  end if;
  select * into v_revision from public.schedule_revisions
  where id = p_revision_id and project_id = p_project_id and status = 'published';
  if not found then raise exception 'Only a published schedule revision can emit alerts.' using errcode = '22023'; end if;
  select assignee_person_id into v_assignee_person_id from public.schedule_revision_task_snapshots
  where revision_id = p_revision_id and source_task_id = p_source_task_id;
  if v_assignee_person_id is null then raise exception 'The published activity has no assigned trade recipient.' using errcode = 'P0002'; end if;
  select auth_user_id into v_recipient_user_id from public.people where id = v_assignee_person_id;
  if v_recipient_user_id is null then raise exception 'The assigned trade person has no application user.' using errcode = 'P0002'; end if;
  v_event_key := format('schedule-alert:%s:%s:%s:%s', p_revision_id, p_source_task_id, v_recipient_user_id, p_change_kind);
  perform pg_advisory_xact_lock(hashtext(v_event_key));
  if exists (select 1 from public.schedule_alert_deliveries where event_key = v_event_key) then return null; end if;
  insert into public.collaboration_notifications(user_id, project_id, entity_type, entity_id, actor_id, kind, title, body, metadata)
  values (v_recipient_user_id, p_project_id, 'schedule_task', p_source_task_id::text, auth.uid(), 'schedule_change', p_title, p_body,
    jsonb_build_object('event_key', v_event_key, 'revision_id', p_revision_id, 'source_task_id', p_source_task_id, 'change_kind', p_change_kind))
  returning * into v_notification;
  insert into public.schedule_alert_deliveries(event_key, project_id, revision_id, source_task_id, recipient_user_id, change_kind, notification_id)
  values (v_event_key, p_project_id, p_revision_id, p_source_task_id, v_recipient_user_id, p_change_kind, v_notification.id);
  return v_notification;
end; $$;

revoke all on function public.emit_schedule_trade_alert(integer, uuid, uuid, text, text, text) from public, anon;
grant execute on function public.emit_schedule_trade_alert(integer, uuid, uuid, text, text, text) to authenticated;

commit;
