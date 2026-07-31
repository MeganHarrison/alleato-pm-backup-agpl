-- Extend the canonical Skill Wheel check-in with the private action plan from
-- the standalone "Own Your Growth" experience.
--
-- Depends on 20260726232000_create_training_skill_growth, which creates the
-- shared role skill library, private training_skill_checkin rows, and RLS.

begin;

do $$
begin
  if to_regclass('public.training_skill_checkin') is null
     or to_regclass('public.training_role_skill') is null then
    raise exception
      'Own Your Growth requires the canonical training skill growth migration.';
  end if;
end
$$;

alter table public.training_skill_checkin
  add column quarter_label text null,
  add column feedback_person text null,
  add column feedback_frequency text null,
  add column rescore_days smallint not null default 60,
  add column next_checkin_date date null,
  add column make_time_by text null,
  add column skill_plans jsonb not null default '[]'::jsonb;

update public.training_skill_checkin as checkin
set
  next_checkin_date = checkin.checkin_date + checkin.rescore_days,
  skill_plans = (
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
    select coalesce(
      jsonb_agg(
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
      ),
      '[]'::jsonb
    )
    from ranked_scores ranked
    left join public.training_role_skill canonical_skill
      on canonical_skill.id::text = ranked.item ->> 'skillId'
      and canonical_skill.role_id is not distinct from checkin.role_id
  )
where checkin.next_checkin_date is null;

alter table public.training_skill_checkin
  alter column next_checkin_date set not null,
  alter column next_checkin_date set default (current_date + 60);

alter table public.training_skill_checkin
  add constraint training_skill_checkin_quarter_label_check
    check (
      quarter_label is null
      or char_length(btrim(quarter_label)) between 1 and 40
    ),
  add constraint training_skill_checkin_feedback_person_check
    check (
      feedback_person is null
      or char_length(btrim(feedback_person)) between 1 and 100
    ),
  add constraint training_skill_checkin_feedback_frequency_check
    check (
      feedback_frequency is null
      or char_length(btrim(feedback_frequency)) between 1 and 160
    ),
  add constraint training_skill_checkin_rescore_days_check
    check (rescore_days in (30, 60, 90)),
  add constraint training_skill_checkin_next_date_check
    check (next_checkin_date = checkin_date + rescore_days),
  add constraint training_skill_checkin_make_time_by_check
    check (
      make_time_by is null
      or char_length(btrim(make_time_by)) between 1 and 300
    ),
  add constraint training_skill_checkin_skill_plans_array_check
    check (
      jsonb_typeof(skill_plans) = 'array'
      and jsonb_array_length(skill_plans) between 1 and 20
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

create trigger validate_training_growth_plan_write
before insert or update of
  scores,
  skill_plans,
  quarter_label,
  feedback_person,
  feedback_frequency,
  rescore_days,
  next_checkin_date,
  make_time_by
on public.training_skill_checkin
for each row
execute function public.validate_training_growth_plan();

comment on column public.training_skill_checkin.skill_plans is
  'Private evidence and action-plan snapshot paired to canonical scores by skillId.';

commit;
