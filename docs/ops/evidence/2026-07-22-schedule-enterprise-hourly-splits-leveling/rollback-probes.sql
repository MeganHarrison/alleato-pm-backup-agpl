begin;

do $$
declare
  v_actor uuid;
  v_person_id uuid;
  v_project_id integer;
  v_resource_id uuid;
  v_task_id uuid;
  v_task_version bigint;
  v_person_version bigint;
  v_calendar_version bigint;
  v_source_token text;
  v_context jsonb;
  v_run jsonb;
  v_run_id uuid;
  v_apply jsonb;
  v_apply_event_id uuid;
  v_change_state jsonb;
  v_calendar_conflict boolean := false;
  v_segment_conflict boolean := false;
  v_vector_rejected boolean := false;
begin
  select profile.id, mapping.person_id
  into v_actor, v_person_id
  from public.user_profiles profile
  join public.users_auth mapping on mapping.auth_user_id = profile.id
  join public.people person on person.id = mapping.person_id
  where profile.is_admin = true and person.status = 'active'
  order by profile.id
  limit 1;
  if v_actor is null or v_person_id is null then
    raise exception 'Rollback probe requires one active application administrator.';
  end if;

  perform set_config(
    'request.jwt.claims',
    jsonb_build_object('sub', v_actor, 'role', 'authenticated')::text,
    true
  );
  if not public.current_is_app_admin() then
    raise exception 'Rollback probe could not establish the administrator claim.';
  end if;

  select project.id into v_project_id
  from public.projects project
  order by project.id
  limit 1;
  if v_project_id is null then
    raise exception 'Rollback probe requires one project.';
  end if;

  insert into public.project_directory_memberships(project_id, person_id, status)
  values (v_project_id, v_person_id, 'active')
  on conflict(project_id, person_id) do update set status = 'active';

  insert into public.schedule_resources(project_id, person_id, created_by_user_id)
  values (v_project_id, v_person_id, v_actor)
  on conflict(project_id, person_id) do update set updated_at = now()
  returning id into v_resource_id;

  insert into public.schedule_tasks(
    project_id, name, start_date, finish_date, duration_days,
    percent_complete, status, is_milestone, sort_order,
    work_minutes, allow_leveling_split, leveling_priority
  ) values (
    v_project_id, 'Phase 4C rollback probe', date '2030-01-07', date '2030-01-07', 1,
    0, 'not_started', false, 2147483000, 60, true, 500
  ) returning id, schedule_version into v_task_id, v_task_version;

  insert into public.schedule_task_assignments(
    project_id, task_id, resource_id, allocation_percent,
    created_by_user_id, updated_by_user_id
  ) values (
    v_project_id, v_task_id, v_resource_id, 100, v_actor, v_actor
  );

  select calendar.version into v_calendar_version
  from public.schedule_person_work_calendars calendar
  where calendar.person_id = v_person_id;

  perform public.replace_schedule_person_work_calendar(
    v_project_id,
    v_person_id,
    'America/Indiana/Indianapolis',
    '[{"weekday":1,"start_minute":480,"end_minute":1020,"capacity_percent":100}]'::jsonb,
    '[]'::jsonb,
    v_calendar_version
  );
  begin
    perform public.replace_schedule_person_work_calendar(
      v_project_id,
      v_person_id,
      'America/Indiana/Indianapolis',
      '[{"weekday":1,"start_minute":480,"end_minute":1020,"capacity_percent":100}]'::jsonb,
      '[]'::jsonb,
      v_calendar_version
    );
  exception when sqlstate '40001' then
    v_calendar_conflict := true;
  end;
  if not v_calendar_conflict then
    raise exception 'Work-calendar stale-version probe did not raise SQLSTATE 40001.';
  end if;

  select schedule_version into v_task_version
  from public.schedule_tasks where id = v_task_id;
  perform public.replace_schedule_task_segments(
    v_project_id,
    v_task_id,
    jsonb_build_array(jsonb_build_object(
      'segment_index', 0,
      'starts_at', '2030-01-07T13:00:00Z',
      'ends_at', '2030-01-07T14:00:00Z',
      'planned_minutes', 60,
      'lock_reason', null
    )),
    v_task_version
  );
  begin
    perform public.replace_schedule_task_segments(
      v_project_id,
      v_task_id,
      '[]'::jsonb,
      v_task_version
    );
  exception when sqlstate '40001' then
    v_segment_conflict := true;
  end;
  if not v_segment_conflict then
    raise exception 'Task-segment stale-version probe did not raise SQLSTATE 40001.';
  end if;

  v_context := public.get_schedule_hourly_leveling_context(
    v_project_id,
    '2030-01-07T00:00:00Z',
    '2030-01-08T00:00:00Z'
  );
  if v_context->>'project_timezone' is null
     or jsonb_array_length(v_context->'tasks') = 0
     or jsonb_array_length(v_context->'assignments') = 0 then
    raise exception 'Authoritative hourly-leveling context is incomplete.';
  end if;

  select version into v_person_version
  from public.schedule_person_allocation_revisions where person_id = v_person_id;
  if (v_context->'person_revisions'->>v_person_id::text)::bigint is distinct from v_person_version then
    raise exception 'Authoritative context returned a stale person revision.';
  end if;

  select schedule_version into v_task_version
  from public.schedule_tasks where id = v_task_id;
  select private.schedule_project_leveling_source_token(v_project_id) into v_source_token;

  begin
    perform public.create_schedule_leveling_run(
      v_project_id,
      'rollback-probe-vector-v2',
      v_source_token,
      '{}'::jsonb,
      '{"slot_minutes":15,"probe":true}'::jsonb,
      '[]'::jsonb,
      jsonb_build_array(jsonb_build_object(
        'task_id', v_task_id,
        'expected_task_version', v_task_version,
        'after_state', jsonb_build_object('segments', jsonb_build_array(jsonb_build_object(
          'segment_index', 0,
          'starts_at', '2030-01-07T14:00:00Z',
          'ends_at', '2030-01-07T15:00:00Z',
          'planned_minutes', 60,
          'lock_reason', null
        ))),
        'reasons', jsonb_build_array('probe')
      ))
    );
    set constraints schedule_leveling_runs_validate_person_vector immediate;
  exception when sqlstate '22023' then
    v_vector_rejected := true;
  end;
  if not v_vector_rejected then
    raise exception 'Missing person revision vector was not rejected.';
  end if;

  set constraints schedule_leveling_runs_validate_person_vector deferred;
  select private.schedule_project_leveling_source_token(v_project_id) into v_source_token;
  v_run := public.create_schedule_leveling_run(
    v_project_id,
    'rollback-probe-v2',
    v_source_token,
    jsonb_build_object(v_person_id::text, v_person_version),
    '{"slot_minutes":15,"probe":true}'::jsonb,
    '[]'::jsonb,
    jsonb_build_array(jsonb_build_object(
      'task_id', v_task_id,
      'expected_task_version', v_task_version,
      'after_state', jsonb_build_object(
        'task', jsonb_build_object('start_date', '1900-01-01', 'work_minutes', 9999),
        'segments', jsonb_build_array(jsonb_build_object(
          'segment_index', 0,
          'starts_at', '2030-01-07T14:00:00Z',
          'ends_at', '2030-01-07T15:00:00Z',
          'planned_minutes', 60,
          'lock_reason', null
        ))
      ),
      'reasons', jsonb_build_array('probe')
    ))
  );
  set constraints schedule_leveling_runs_validate_person_vector immediate;
  v_run_id := (v_run->'run'->>'id')::uuid;

  select change.after_state into v_change_state
  from public.schedule_leveling_run_changes change
  where change.run_id = v_run_id;
  if v_change_state #>> '{task,start_date}' = '1900-01-01'
     or (v_change_state #>> '{task,work_minutes}')::integer <> 60 then
    raise exception 'Leveling change task fields were not derived from segments.';
  end if;

  v_apply := public.apply_schedule_leveling_run(
    v_project_id, v_run_id, 'Rollback-only verification'
  );
  v_apply_event_id := (v_apply->'event'->>'id')::uuid;
  perform public.undo_schedule_leveling_event(
    v_project_id, v_apply_event_id, 'Rollback-only verification'
  );

  delete from public.schedule_tasks where id = v_task_id;
  if not exists (
    select 1 from public.schedule_leveling_run_changes change
    where change.run_id = v_run_id and change.task_id = v_task_id
  ) then
    raise exception 'Deleting a live task incorrectly deleted immutable leveling history.';
  end if;

  raise notice 'Phase 4C rollback probes passed: admin calendar, CAS, context, exact vector, canonical state, apply, undo, and task deletion.';
end;
$$;

rollback;
