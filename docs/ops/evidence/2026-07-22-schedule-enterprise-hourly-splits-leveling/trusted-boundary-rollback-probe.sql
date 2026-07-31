begin;
set local role service_role;

do $$
declare
  v_actor uuid;
  v_person_id uuid;
  v_project_id integer;
  v_resource_id uuid;
  v_task_id uuid;
  v_task_version bigint;
  v_context jsonb;
  v_run jsonb;
begin
  select profile.id, mapping.person_id
  into v_actor, v_person_id
  from public.user_profiles profile
  join public.users_auth mapping on mapping.auth_user_id = profile.id
  join public.people person on person.id = mapping.person_id
  where profile.is_admin = true and person.status = 'active'
  order by profile.id
  limit 1;
  if v_actor is null then
    raise exception 'Trusted-boundary probe requires one active application administrator.';
  end if;

  perform set_config(
    'request.jwt.claims',
    jsonb_build_object('sub', v_actor, 'role', 'authenticated')::text,
    true
  );

  select project.id into v_project_id
  from public.projects project
  order by project.id
  limit 1;

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
    v_project_id, 'Trusted boundary rollback probe', date '2030-02-04', date '2030-02-04', 1,
    0, 'not_started', false, 2147482999, 60, true, 500
  ) returning id, schedule_version into v_task_id, v_task_version;

  insert into public.schedule_task_assignments(
    project_id, task_id, resource_id, allocation_percent,
    created_by_user_id, updated_by_user_id
  ) values (
    v_project_id, v_task_id, v_resource_id, 100, v_actor, v_actor
  );

  v_context := public.get_schedule_hourly_leveling_context(
    v_project_id,
    '2030-02-04T00:00:00Z',
    '2030-02-05T00:00:00Z'
  );

  v_run := public.create_authoritative_schedule_leveling_run(
    v_actor,
    v_project_id,
    'trusted-boundary-probe-v1',
    v_context->>'source_token',
    jsonb_build_object(
      v_person_id::text,
      (v_context->'person_revisions'->>v_person_id::text)::bigint
    ),
    '{"slot_minutes":15,"probe":true}'::jsonb,
    '[]'::jsonb,
    jsonb_build_array(jsonb_build_object(
      'task_id', v_task_id,
      'expected_task_version', v_task_version,
      'after_state', jsonb_build_object('segments', jsonb_build_array(jsonb_build_object(
        'segment_index', 0,
        'starts_at', '2030-02-04T14:00:00Z',
        'ends_at', '2030-02-04T15:00:00Z',
        'planned_minutes', 60,
        'lock_reason', null
      ))),
      'reasons', jsonb_build_array('trusted-boundary-probe')
    ))
  );
  set constraints schedule_leveling_runs_validate_person_vector immediate;

  if v_run->'run'->>'created_by_user_id' is distinct from v_actor::text then
    raise exception 'Trusted boundary did not preserve the authenticated actor.';
  end if;
  raise notice 'Trusted service boundary rollback probe passed.';
end;
$$;

rollback;
