begin;

do $$
declare
  v_manager_user_id constant uuid := '6ae4299f-6c21-4e99-b6a1-ccb1fe5aa7f6';
  v_target_person_id uuid;
  v_cross_project_id integer;
  v_cross_person_id uuid;
begin
  perform set_config('request.jwt.claim.sub', v_manager_user_id::text, true);
  if not public.current_can_manage_schedule(67) then
    raise exception 'The authenticated E2E identity is not a schedule manager for project 67.';
  end if;

  select membership.person_id
  into v_target_person_id
  from public.project_directory_memberships membership
  where membership.project_id = 67
    and membership.status = 'active'
    and not exists (
      select 1
      from public.schedule_resources resource
      where resource.project_id = membership.project_id
        and resource.person_id = membership.person_id
    )
  order by membership.person_id
  limit 1;

  if v_target_person_id is null then
    raise exception 'No unused active project 67 member is available for rollback-only probes.';
  end if;

  insert into public.schedule_resources(id, project_id, person_id, created_by_user_id)
  values ('f4b00000-0000-4000-8000-000000000067', 67, v_target_person_id, v_manager_user_id);

  select membership.project_id, membership.person_id
  into v_cross_project_id, v_cross_person_id
  from public.project_directory_memberships membership
  where membership.project_id <> 67
    and membership.status = 'active'
    and not exists (
      select 1
      from public.schedule_resources resource
      where resource.project_id = membership.project_id
        and resource.person_id = membership.person_id
    )
  order by membership.project_id, membership.person_id
  limit 1;

  if v_cross_person_id is null then
    raise exception 'No unused active cross-project member is available for rollback-only probes.';
  end if;

  insert into public.schedule_resources(id, project_id, person_id, created_by_user_id)
  values ('f4b00000-0000-4000-8000-000000000068', v_cross_project_id, v_cross_person_id, v_manager_user_id);
end;
$$;

set local role authenticated;

do $$
declare
  v_manager_user_id constant uuid := '6ae4299f-6c21-4e99-b6a1-ccb1fe5aa7f6';
  v_target_resource_id constant uuid := 'f4b00000-0000-4000-8000-000000000067';
  v_cross_resource_id constant uuid := 'f4b00000-0000-4000-8000-000000000068';
begin
  perform set_config('request.jwt.claim.sub', v_manager_user_id::text, true);

  begin
    insert into public.schedule_resource_capacity_profiles(
      project_id,
      resource_id,
      created_by_user_id,
      updated_by_user_id
    ) values (67, v_target_resource_id, v_manager_user_id, v_manager_user_id);
    raise exception 'Direct authenticated capacity-profile DML unexpectedly succeeded.';
  exception when insufficient_privilege then
    null;
  end;

  begin
    perform public.replace_schedule_resource_capacity_profile(
      67,
      v_target_resource_id,
      '[{"weekday":1,"capacity_percent":101}]'::jsonb,
      '[]'::jsonb,
      null
    );
    raise exception 'Out-of-range capacity unexpectedly succeeded.';
  exception when sqlstate '22003' then
    null;
  end;

  begin
    perform public.replace_schedule_resource_capacity_profile(
      67,
      v_target_resource_id,
      '[{"weekday":1,"capacity_percent":50},{"weekday":1,"capacity_percent":60}]'::jsonb,
      '[]'::jsonb,
      null
    );
    raise exception 'Duplicate weekday capacity unexpectedly succeeded.';
  exception when unique_violation then
    null;
  end;

  begin
    perform public.replace_schedule_resource_capacity_profile(
      67,
      v_target_resource_id,
      '{"weekday":1}'::jsonb,
      '[]'::jsonb,
      null
    );
    raise exception 'Malformed weekday JSON unexpectedly succeeded.';
  exception when invalid_parameter_value then
    null;
  end;

  begin
    perform public.replace_schedule_resource_capacity_profile(
      67,
      v_cross_resource_id,
      '[]'::jsonb,
      '[]'::jsonb,
      null
    );
    raise exception 'Cross-project resource replacement unexpectedly succeeded.';
  exception when foreign_key_violation then
    null;
  end;

  perform public.replace_schedule_resource_capacity_profile(
    67,
    v_target_resource_id,
    '[]'::jsonb,
    '[]'::jsonb,
    null
  );
  perform public.replace_schedule_resource_capacity_profile(
    67,
    v_target_resource_id,
    '[]'::jsonb,
    '[]'::jsonb,
    1
  );
  begin
    perform public.replace_schedule_resource_capacity_profile(
      67,
      v_target_resource_id,
      '[]'::jsonb,
      '[]'::jsonb,
      1
    );
    raise exception 'A stale capacity-profile version unexpectedly overwrote current facts.';
  exception when serialization_failure then
    null;
  end;

  begin
    perform public.get_schedule_resource_read_model(
      67,
      date '2026-01-01',
      date '2026-04-03',
      null,
      null,
      false
    );
    raise exception 'An oversized direct project-capacity read unexpectedly succeeded.';
  exception when invalid_parameter_value then
    null;
  end;

  perform set_config('request.jwt.claim.sub', '11111111-1111-4111-8111-111111111111', true);
  begin
    perform public.replace_schedule_resource_capacity_profile(
      67,
      v_target_resource_id,
      '[]'::jsonb,
      '[]'::jsonb,
      2
    );
    raise exception 'Non-manager resource replacement unexpectedly succeeded.';
  exception when insufficient_privilege then
    null;
  end;
end;
$$;

rollback;

select 'all rollback-only Phase 4B mutation, CAS, and bounded-read probes passed' as result;
