begin;

-- A removed predecessor or linked submittal is as material as an added one.
-- Keep the existing event key and delivery ledger so repeated publication work
-- remains idempotent while the assignee receives one causal alert per kind.
create or replace function public.emit_published_schedule_change_alerts(p_project_id integer, p_revision_id uuid, p_previous_revision_id uuid, p_actor_id uuid)
returns void language plpgsql security definer set search_path = public, auth as $$
declare v_change record; v_notification_id uuid; v_event_key text;
begin
  if p_previous_revision_id is null then return; end if;
  for v_change in
    select c.source_task_id, p.auth_user_id recipient_user_id, 'date_changed'::text change_kind, c.name || ' dates changed' title, 'Published schedule dates changed.' body
    from public.schedule_revision_task_snapshots c join public.schedule_revision_task_snapshots prior on prior.revision_id = p_previous_revision_id and prior.source_task_id = c.source_task_id join public.people p on p.id = c.assignee_person_id
    where c.revision_id = p_revision_id and p.auth_user_id is not null and (c.start_date, c.finish_date, c.forecast_start_date, c.forecast_finish_date) is distinct from (prior.start_date, prior.finish_date, prior.forecast_start_date, prior.forecast_finish_date)
    union all
    select c.source_task_id, p.auth_user_id, 'dependency_changed', c.name || ' predecessor changed', 'A predecessor relationship changed in the published schedule.'
    from public.schedule_revision_task_snapshots c join public.people p on p.id = c.assignee_person_id
    where c.revision_id = p_revision_id and p.auth_user_id is not null and (
      exists (select 1 from public.schedule_revision_dependency_snapshots d where d.revision_id = p_revision_id and d.task_source_id = c.source_task_id and not exists (select 1 from public.schedule_revision_dependency_snapshots old where old.revision_id = p_previous_revision_id and old.task_source_id = d.task_source_id and old.predecessor_source_id = d.predecessor_source_id and old.dependency_type = d.dependency_type and old.lag_days = d.lag_days))
      or exists (select 1 from public.schedule_revision_dependency_snapshots old where old.revision_id = p_previous_revision_id and old.task_source_id = c.source_task_id and not exists (select 1 from public.schedule_revision_dependency_snapshots d where d.revision_id = p_revision_id and d.task_source_id = old.task_source_id and d.predecessor_source_id = old.predecessor_source_id and d.dependency_type = old.dependency_type and d.lag_days = old.lag_days))
    )
    union all
    select c.source_task_id, p.auth_user_id, 'submittal_changed', c.name || ' linked submittal changed', 'A linked submittal changed in the published schedule.'
    from public.schedule_revision_task_snapshots c join public.people p on p.id = c.assignee_person_id
    where c.revision_id = p_revision_id and p.auth_user_id is not null and (
      exists (select 1 from public.schedule_revision_submittal_snapshots s where s.revision_id = p_revision_id and s.source_task_id = c.source_task_id and not exists (select 1 from public.schedule_revision_submittal_snapshots old where old.revision_id = p_previous_revision_id and old.source_task_id = s.source_task_id and old.submittal_id = s.submittal_id and old.submittal_status = s.submittal_status and old.required_approval_date is not distinct from s.required_approval_date))
      or exists (select 1 from public.schedule_revision_submittal_snapshots old where old.revision_id = p_previous_revision_id and old.source_task_id = c.source_task_id and not exists (select 1 from public.schedule_revision_submittal_snapshots s where s.revision_id = p_revision_id and s.source_task_id = old.source_task_id and s.submittal_id = old.submittal_id and s.submittal_status = old.submittal_status and s.required_approval_date is not distinct from old.required_approval_date))
    )
  loop
    v_event_key := format('schedule-alert:%s:%s:%s:%s', p_revision_id, v_change.source_task_id, v_change.recipient_user_id, v_change.change_kind);
    begin
      insert into public.collaboration_notifications(user_id, project_id, entity_type, entity_id, actor_id, kind, title, body, metadata) values (v_change.recipient_user_id, p_project_id, 'schedule_task', v_change.source_task_id::text, p_actor_id, 'schedule_change', v_change.title, v_change.body, jsonb_build_object('event_key', v_event_key, 'revision_id', p_revision_id, 'source_task_id', v_change.source_task_id, 'change_kind', v_change.change_kind)) returning id into v_notification_id;
      insert into public.schedule_alert_deliveries(event_key, project_id, revision_id, source_task_id, recipient_user_id, change_kind, notification_id) values (v_event_key, p_project_id, p_revision_id, v_change.source_task_id, v_change.recipient_user_id, v_change.change_kind, v_notification_id);
    exception when unique_violation then null;
    end;
  end loop;
end; $$;

commit;
