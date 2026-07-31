-- Transactional contract proof for the completed Skill Wheel assessment.
-- Safe against a linked database: all fixture writes roll back.

begin;

do $$
declare
  test_user_id uuid;
  test_role_id uuid;
  test_role_name text;
  test_checkin_id uuid;
  score_snapshot jsonb;
  plan_snapshot jsonb;
  rejected_single_focus boolean := false;
begin
  select id
    into test_user_id
  from auth.users
  order by created_at
  limit 1;

  select id, name
    into test_role_id, test_role_name
  from public.training_role
  where active
  order by sort_order, name
  limit 1;

  if test_user_id is null or test_role_id is null then
    raise exception
      'Training growth contract test requires one auth user and one active role';
  end if;

  with canonical as (
    select
      skill.*,
      row_number() over (
        order by skill.is_core desc, skill.sort_order, skill.name
      ) as position
    from public.training_role_skill skill
    where skill.active
      and (
        (skill.role_id is null and skill.is_core)
        or (
          skill.role_id = test_role_id
          and not skill.is_core
          and not exists (
            select 1
            from public.training_role_skill as core
            where core.active
              and core.role_id is null
              and core.is_core
              and lower(btrim(core.name)) = lower(btrim(skill.name))
          )
        )
      )
  )
  select
    jsonb_agg(
      jsonb_build_object(
        'skillId', id,
        'name', name,
        'score', 30,
        'target', 70,
        'importance', importance,
        'isCore', is_core
      )
      order by position
    ),
    jsonb_agg(
      jsonb_build_object(
        'skillId', id,
        'description', description,
        'evidence', jsonb_build_object(
          'situation', 'Transactional contract test',
          'behavior', 'Prepared the canonical training fixture',
          'outcome', 'The trigger validated the completed assessment contract'
        ),
        'frequency', case when position <= 2 then 'Weekly' else '' end,
        'resource', case when position <= 2 then 'Training SOP' else '' end,
        'feedback', case when position <= 2 then 'Manager reviews next day' else '' end,
        'phases', case
          when position <= 2 then jsonb_build_array(
            jsonb_build_object(
              'days', 30,
              'action', 'Complete the 30-day rep',
              'measure', 'Review the 30-day evidence'
            ),
            jsonb_build_object(
              'days', 60,
              'action', 'Complete the 60-day rep',
              'measure', 'Review the 60-day evidence'
            ),
            jsonb_build_object(
              'days', 90,
              'action', 'Complete the 90-day rep',
              'measure', 'Review the 90-day evidence'
            )
          )
          else '[]'::jsonb
        end,
        'isFocus', position <= 2,
        'sortOrder', position - 1
      )
      order by position
    )
    into score_snapshot, plan_snapshot
  from canonical;

  insert into public.training_skill_checkin (
    user_id,
    role_id,
    role_name,
    checkin_date,
    scores,
    quarter_label,
    feedback_person,
    feedback_frequency,
    rescore_days,
    next_checkin_date,
    make_time_by,
    skill_plans
  )
  values (
    test_user_id,
    test_role_id,
    test_role_name,
    date '1990-01-01',
    score_snapshot,
    'Contract test',
    'Test manager',
    'Weekly',
    30,
    date '1990-01-31',
    'Delegate test setup',
    plan_snapshot
  )
  on conflict (user_id, role_context_key, checkin_date)
  do update set
    scores = excluded.scores,
    skill_plans = excluded.skill_plans,
    role_name = excluded.role_name,
    rescore_days = excluded.rescore_days,
    next_checkin_date = excluded.next_checkin_date
  returning id into test_checkin_id;

  if (
    select count(*)
    from jsonb_array_elements(plan_snapshot) plan(item)
    where (item ->> 'isFocus')::boolean
  ) <> 2 then
    raise exception 'Contract fixture did not preserve exactly two focus skills';
  end if;

  if not exists (
    select 1
    from jsonb_array_elements(score_snapshot) score(item)
    where (item ->> 'isCore')::boolean
  ) then
    raise exception 'Role assessment omitted universal core skills';
  end if;

  begin
    update public.training_skill_checkin
    set skill_plans = (
      select jsonb_agg(
        case
          when ordinality = 2 then
            jsonb_set(item, '{isFocus}', 'false'::jsonb)
          else item
        end
        order by ordinality
      )
      from jsonb_array_elements(skill_plans)
        with ordinality as plan(item, ordinality)
    )
    where id = test_checkin_id;
  exception
    when check_violation then
      rejected_single_focus := true;
  end;

  if not rejected_single_focus then
    raise exception 'Database accepted fewer than two focus skills';
  end if;
end;
$$;

rollback;
