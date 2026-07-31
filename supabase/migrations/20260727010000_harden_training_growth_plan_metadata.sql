-- Keep pre-extension Skill Wheel history readable and enforce canonical plan
-- descriptions/order even when an authenticated owner writes through
-- PostgREST instead of the application route.

begin;

update public.training_skill_checkin as checkin
set skill_plans = (
  with ranked_scores as (
    select
      score.item,
      score.ordinality,
      greatest(
        (score.item ->> 'target')::integer
          - (score.item ->> 'score')::integer,
        0
      ) as gap,
      row_number() over (
        order by
          greatest(
            (score.item ->> 'target')::integer
              - (score.item ->> 'score')::integer,
            0
          ) desc,
          score.ordinality
      ) as gap_rank
    from jsonb_array_elements(checkin.scores)
      with ordinality as score(item, ordinality)
  )
  select jsonb_agg(
    jsonb_build_object(
      'skillId', ranked.item ->> 'skillId',
      'description', coalesce(
        canonical_skill.description,
        'Legacy skill snapshot'
      ),
      'evidence',
        'Imported from a Skill Wheel check-in recorded before evidence tracking.',
      'action', case
        when ranked.gap > 0 and ranked.gap_rank <= 4
          then 'Define the next practice action during the follow-up review.'
        else ''
      end,
      'frequency', case
        when ranked.gap > 0 and ranked.gap_rank <= 4
          then 'Choose a repeatable cadence during the follow-up review.'
        else ''
      end,
      'measure', case
        when ranked.gap > 0 and ranked.gap_rank <= 4
          then 'Choose an observable measure during the follow-up review.'
        else ''
      end,
      'isFocus', ranked.gap > 0 and ranked.gap_rank <= 4,
      'sortOrder', ranked.ordinality - 1
    )
    order by ranked.ordinality
  )
  from ranked_scores ranked
  left join public.training_role_skill canonical_skill
    on canonical_skill.id::text = ranked.item ->> 'skillId'
    and canonical_skill.role_id is not distinct from checkin.role_id
)
where jsonb_array_length(checkin.skill_plans)
    <> jsonb_array_length(checkin.scores)
   or exists (
     select 1
     from jsonb_array_elements(checkin.skill_plans) as plan(item)
     where nullif(btrim(plan.item ->> 'evidence'), '') is null
   );

create or replace function public.validate_training_growth_plan()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  score_count integer;
  plan_count integer;
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
           'action',
           'frequency',
           'measure',
           'isFocus',
           'sortOrder'
         ]
       )
       or (
         item - array[
           'skillId',
           'description',
           'evidence',
           'action',
           'frequency',
           'measure',
           'isFocus',
           'sortOrder'
         ]
       ) <> '{}'::jsonb
       or jsonb_typeof(item -> 'skillId') <> 'string'
       or (item ->> 'skillId')
         !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
       or jsonb_typeof(item -> 'description') <> 'string'
       or char_length(item ->> 'description') > 500
       or jsonb_typeof(item -> 'evidence') <> 'string'
       or char_length(btrim(item ->> 'evidence')) not between 1 and 500
       or jsonb_typeof(item -> 'action') <> 'string'
       or char_length(item ->> 'action') > 500
       or jsonb_typeof(item -> 'frequency') <> 'string'
       or char_length(item ->> 'frequency') > 160
       or jsonb_typeof(item -> 'measure') <> 'string'
       or char_length(item ->> 'measure') > 300
       or jsonb_typeof(item -> 'isFocus') <> 'boolean'
       or jsonb_typeof(item -> 'sortOrder') <> 'number'
       or (item ->> 'sortOrder') !~ '^(0|[1-9][0-9]?)$'
  ) then
    raise exception using
      errcode = '23514',
      message = 'Each growth plan entry must match the private action-plan contract.';
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
          order by skill.sort_order, skill.name
        ) - 1 as expected_sort_order
      from public.training_role_skill skill
      where skill.active
        and skill.role_id is not distinct from new.role_id
        and skill.is_core = (new.role_id is null)
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
      message = 'Growth plan metadata must match the canonical skill library.';
  end if;

  if exists (
    with ranked_scores as (
      select
        score.item ->> 'skillId' as skill_id,
        greatest(
          (score.item ->> 'target')::integer
            - (score.item ->> 'score')::integer,
          0
        ) as gap,
        row_number() over (
          order by
            greatest(
              (score.item ->> 'target')::integer
                - (score.item ->> 'score')::integer,
              0
            ) desc,
            score.ordinality
        ) as gap_rank
      from jsonb_array_elements(new.scores)
        with ordinality as score(item, ordinality)
    )
    select 1
    from ranked_scores
    join jsonb_array_elements(new.skill_plans) as plan(item)
      on plan.item ->> 'skillId' = ranked_scores.skill_id
    where (plan.item ->> 'isFocus')::boolean
      is distinct from (ranked_scores.gap > 0 and ranked_scores.gap_rank <= 4)
  ) then
    raise exception using
      errcode = '23514',
      message = 'Growth focus skills must be the four largest positive score gaps.';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(new.skill_plans) as entry(item)
    where (item ->> 'isFocus')::boolean
      and (
        char_length(btrim(item ->> 'action')) not between 1 and 500
        or char_length(btrim(item ->> 'frequency')) not between 1 and 160
        or char_length(btrim(item ->> 'measure')) not between 1 and 300
      )
  ) then
    raise exception using
      errcode = '23514',
      message = 'Every focus skill needs an action, frequency, and measure.';
  end if;

  return new;
end;
$$;

revoke all on function public.validate_training_growth_plan() from public;

commit;
