-- ALL-28 follow-up: make the database the final authority for Skill Wheel
-- snapshots, including writes made directly through PostgREST.

create or replace function public.validate_training_skill_checkin()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  expected_role_name text;
  expected_skill_count integer;
  submitted_skill_count integer;
begin
  if new.checkin_date > current_date then
    raise exception using
      errcode = '23514',
      message = 'Skill Wheel check-in dates cannot be in the future.';
  end if;

  if jsonb_typeof(new.scores) <> 'array'
     or jsonb_array_length(new.scores) not between 1 and 20 then
    raise exception using
      errcode = '23514',
      message = 'Skill Wheel scores must be a non-empty JSON array with at most 20 entries.';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(new.scores) as entry(item)
    where jsonb_typeof(item) <> 'object'
       or not (
         item ?& array[
           'skillId',
           'name',
           'score',
           'target',
           'importance',
           'isCore'
         ]
       )
       or (
         item - array[
           'skillId',
           'name',
           'score',
           'target',
           'importance',
           'isCore'
         ]
       ) <> '{}'::jsonb
       or jsonb_typeof(item -> 'skillId') <> 'string'
       or (item ->> 'skillId') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
       or jsonb_typeof(item -> 'name') <> 'string'
       or char_length(btrim(item ->> 'name')) not between 1 and 120
       or jsonb_typeof(item -> 'score') <> 'number'
       or (item ->> 'score') !~ '^(0|[1-9][0-9]?|100)$'
       or jsonb_typeof(item -> 'target') <> 'number'
       or (item ->> 'target') !~ '^(0|[1-9][0-9]?|100)$'
       or jsonb_typeof(item -> 'importance') <> 'number'
       or (item ->> 'importance') !~ '^[1-5]$'
       or jsonb_typeof(item -> 'isCore') <> 'boolean'
  ) then
    raise exception using
      errcode = '23514',
      message = 'Each Skill Wheel score must match the canonical score snapshot shape.';
  end if;

  if new.role_id is null then
    expected_role_name := 'Alleato Core';
  else
    select role.name
      into expected_role_name
    from public.training_role as role
    where role.id = new.role_id
      and role.active;

    if expected_role_name is null then
      raise exception using
        errcode = '23514',
        message = 'Skill Wheel check-ins require an active training role.';
    end if;
  end if;

  if new.role_name is distinct from expected_role_name then
    raise exception using
      errcode = '23514',
      message = 'Skill Wheel role names must match the canonical training role.';
  end if;

  select count(*)
    into expected_skill_count
  from public.training_role_skill as skill
  where skill.active
    and (
      (new.role_id is null and skill.role_id is null and skill.is_core)
      or (
        new.role_id is not null
        and skill.role_id = new.role_id
        and not skill.is_core
      )
    );

  select count(distinct entry.item ->> 'skillId')
    into submitted_skill_count
  from jsonb_array_elements(new.scores) as entry(item);

  if expected_skill_count = 0
     or submitted_skill_count <> expected_skill_count
     or jsonb_array_length(new.scores) <> expected_skill_count then
    raise exception using
      errcode = '23514',
      message = 'Skill Wheel scores must contain each current role skill exactly once.';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(new.scores) as entry(item)
    left join public.training_role_skill as skill
      on skill.id::text = entry.item ->> 'skillId'
    where skill.id is null
       or not skill.active
       or (
         new.role_id is null
         and not (skill.role_id is null and skill.is_core)
       )
       or (
         new.role_id is not null
         and not (skill.role_id = new.role_id and not skill.is_core)
       )
       or entry.item ->> 'name' is distinct from skill.name
       or (entry.item ->> 'importance')::integer is distinct from skill.importance
       or (entry.item ->> 'isCore')::boolean is distinct from skill.is_core
  ) then
    raise exception using
      errcode = '23514',
      message = 'Skill Wheel score metadata must match the current canonical skill library.';
  end if;

  return new;
end;
$$;

drop trigger if exists validate_training_skill_checkin_write
  on public.training_skill_checkin;
create trigger validate_training_skill_checkin_write
before insert or update of role_id, role_name, checkin_date, scores
on public.training_skill_checkin
for each row execute function public.validate_training_skill_checkin();

comment on function public.validate_training_skill_checkin() is
  'Rejects malformed, stale, incomplete, or non-canonical Skill Wheel snapshots at the database boundary.';
