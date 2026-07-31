-- Relax the growth-plan evidence contract: allow blank evidence fields.
--
-- The guided assessment at /training/growth/assessment asks for ONE line of
-- evidence per skill (stored as `behavior`) and the full
-- situation/behavior/outcome only for the focus skills. Requiring all three
-- fields on every skill is what stopped check-ins from being finished, so the
-- Zod contract (skillEvidenceSchema) and the server validation were relaxed to
-- match. This trigger has to agree, or a valid payload fails at the database
-- with a bare 23514.
--
-- Still enforced: the three keys must be present, each must be a string, and
-- each is capped at 500 characters. Only the "must not be empty" rule is gone.
--
-- The focus-plan rule is relaxed the same way and for the same reason: a focus
-- skill still needs a cadence and at least one horizon carrying both a concrete
-- action and its measure, but no longer all three of 30/60/90 (that produced
-- filler for 60 and 90, or an unfinished check-in), and `resource` / `feedback`
-- are no longer mandatory. Non-focus skills still cannot carry phase plans, and
-- any phase that IS sent is validated exactly as before.

create or replace function public.validate_training_growth_plan()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
declare
  score_count integer;
  plan_count integer;
  focus_count integer;
begin
  score_count := jsonb_array_length(new.scores);
  plan_count := jsonb_array_length(new.skill_plans);

  if plan_count <> score_count then
    raise exception using
      errcode = '23514',
      message = 'Growth plans must include every scored skill exactly once.';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(new.skill_plans) as entry(item)
    where jsonb_typeof(item) <> 'object'
       or not (
         item ?& array[
           'skillId',
           'description',
           'evidence',
           'frequency',
           'resource',
           'feedback',
           'phases',
           'isFocus',
           'sortOrder'
         ]
       )
       or (
         item - array[
           'skillId',
           'description',
           'evidence',
           'frequency',
           'resource',
           'feedback',
           'phases',
           'isFocus',
           'sortOrder'
         ]
       ) <> '{}'::jsonb
       or jsonb_typeof(item -> 'skillId') <> 'string'
       or (item ->> 'skillId')
         !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
       or jsonb_typeof(item -> 'description') <> 'string'
       or char_length(item ->> 'description') > 500
       or jsonb_typeof(item -> 'evidence') <> 'object'
       or not ((item -> 'evidence') ?& array['situation', 'behavior', 'outcome'])
       or ((item -> 'evidence') - array['situation', 'behavior', 'outcome']) <> '{}'::jsonb
       or jsonb_typeof(item -> 'evidence' -> 'situation') <> 'string'
       or char_length(btrim(item -> 'evidence' ->> 'situation')) > 500
       or jsonb_typeof(item -> 'evidence' -> 'behavior') <> 'string'
       or char_length(btrim(item -> 'evidence' ->> 'behavior')) > 500
       or jsonb_typeof(item -> 'evidence' -> 'outcome') <> 'string'
       or char_length(btrim(item -> 'evidence' ->> 'outcome')) > 500
       or jsonb_typeof(item -> 'frequency') <> 'string'
       or char_length(item ->> 'frequency') > 160
       or jsonb_typeof(item -> 'resource') <> 'string'
       or char_length(item ->> 'resource') > 300
       or jsonb_typeof(item -> 'feedback') <> 'string'
       or char_length(item ->> 'feedback') > 300
       or jsonb_typeof(item -> 'phases') <> 'array'
       or jsonb_array_length(item -> 'phases') > 3
       or jsonb_typeof(item -> 'isFocus') <> 'boolean'
       or jsonb_typeof(item -> 'sortOrder') <> 'number'
       or (item ->> 'sortOrder') !~ '^(0|[1-9][0-9]?)$'
  ) then
    raise exception using
      errcode = '23514',
      message = 'Each growth plan entry must match the structured evidence and phased-plan contract.';
  end if;

  if (
    select count(distinct item ->> 'skillId')
    from jsonb_array_elements(new.skill_plans) as entry(item)
  ) <> plan_count then
    raise exception using
      errcode = '23514',
      message = 'Growth plan skill identifiers must be unique.';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(new.scores) as score(item)
    left join jsonb_array_elements(new.skill_plans) as plan(item)
      on plan.item ->> 'skillId' = score.item ->> 'skillId'
    where plan.item is null
  ) then
    raise exception using
      errcode = '23514',
      message = 'Growth plan skill identifiers must match the score snapshot.';
  end if;

  if exists (
    with canonical_skills as (
      select
        skill.id,
        skill.description,
        row_number() over (
          order by skill.is_core desc, skill.sort_order, skill.name
        ) - 1 as expected_sort_order
      from public.training_role_skill skill
      where skill.active
        and (
          (skill.role_id is null and skill.is_core)
          or (
            new.role_id is not null
            and skill.role_id = new.role_id
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
    select 1
    from jsonb_array_elements(new.skill_plans) as plan(item)
    left join canonical_skills canonical
      on canonical.id::text = plan.item ->> 'skillId'
    where canonical.id is null
       or plan.item ->> 'description'
         is distinct from canonical.description
       or (plan.item ->> 'sortOrder')::integer
         is distinct from canonical.expected_sort_order
  ) then
    raise exception using
      errcode = '23514',
      message = 'Growth plan metadata must match the current core and role skill library.';
  end if;

  select count(*)
    into focus_count
  from jsonb_array_elements(new.skill_plans) as plan(item)
  where (plan.item ->> 'isFocus')::boolean;

  if focus_count not between 2 and 4 then
    raise exception using
      errcode = '23514',
      message = 'Choose between two and four growth focus skills.';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(new.skill_plans) as plan(item)
    join jsonb_array_elements(new.scores) as score(item)
      on score.item ->> 'skillId' = plan.item ->> 'skillId'
    where (plan.item ->> 'isFocus')::boolean
      and (score.item ->> 'target')::integer
        <= (score.item ->> 'score')::integer
  ) then
    raise exception using
      errcode = '23514',
      message = 'Growth focus skills must have a target above the current score.';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(new.skill_plans) as plan(item)
    where (
      (plan.item ->> 'isFocus')::boolean
      and (
        char_length(btrim(plan.item ->> 'frequency')) not between 1 and 160
        or char_length(btrim(plan.item ->> 'resource')) > 300
        or char_length(btrim(plan.item ->> 'feedback')) > 300
        or jsonb_array_length(plan.item -> 'phases') not between 1 and 3
        or (
          select count(distinct phase.item ->> 'days')
          from jsonb_array_elements(plan.item -> 'phases') as phase(item)
        ) <> jsonb_array_length(plan.item -> 'phases')
        or exists (
          select 1
          from jsonb_array_elements(plan.item -> 'phases') as phase(item)
          where jsonb_typeof(phase.item) <> 'object'
             or not (phase.item ?& array['days', 'action', 'measure'])
             or (phase.item - array['days', 'action', 'measure']) <> '{}'::jsonb
             or jsonb_typeof(phase.item -> 'days') <> 'number'
             or (phase.item ->> 'days') !~ '^(30|60|90)$'
             or jsonb_typeof(phase.item -> 'action') <> 'string'
             or char_length(btrim(phase.item ->> 'action')) not between 1 and 500
             or jsonb_typeof(phase.item -> 'measure') <> 'string'
             or char_length(btrim(phase.item ->> 'measure')) not between 1 and 300
        )
      )
    )
    or (
      not (plan.item ->> 'isFocus')::boolean
      and jsonb_array_length(plan.item -> 'phases') <> 0
    )
  ) then
    raise exception using
      errcode = '23514',
      message = 'Every focus skill needs how often you will practice it, plus at least one 30-, 60- or 90-day action with the measure that proves it; non-focus skills cannot carry phase plans.';
  end if;

  return new;
end;
$function$;
