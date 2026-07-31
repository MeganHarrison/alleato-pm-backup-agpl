-- Enforce course release integrity and learner authorization at the database
-- boundary, and make creator resource submissions atomic.

begin;

create or replace function public.guard_learning_course_structure()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  course_id_value uuid;
  old_course_id_value uuid;
  course_status public.knowledge_lifecycle_status;
  content_kind_value public.knowledge_content_kind;
begin
  if tg_table_name = 'learning_course_section' then
    course_id_value := case when tg_op = 'DELETE' then old.course_id else new.course_id end;
    if tg_op = 'UPDATE' then
      old_course_id_value := old.course_id;
    end if;
  else
    select section.course_id
    into course_id_value
    from public.learning_course_section section
    where section.id = case when tg_op = 'DELETE' then old.section_id else new.section_id end;

    if course_id_value is null then
      raise exception
        using
          errcode = '23503',
          message = 'The learning item must belong to an existing course module.';
    end if;

    if tg_op = 'UPDATE' then
      select section.course_id
      into old_course_id_value
      from public.learning_course_section section
      where section.id = old.section_id;
    end if;

    if tg_op <> 'DELETE' then
      select content.content_kind
      into content_kind_value
      from public.knowledge_content_item content
      where content.id = new.content_item_id;

      if content_kind_value is null then
        raise exception
          using
            errcode = '23503',
            message = 'The selected catalog content does not exist.';
      end if;

      if content_kind_value = 'internal_course' then
        raise exception
          using
            errcode = '23514',
            message = 'An internal course cannot be nested inside another course.',
            hint = 'Add the course to a learning program instead.';
      end if;
    end if;
  end if;

  select course.lifecycle_status
  into course_status
  from public.learning_course course
  where course.id = course_id_value;

  if course_status is null then
    raise exception
      using
        errcode = '23503',
        message = 'The course structure points to a course that does not exist.';
  end if;

  if course_status <> 'draft' then
    raise exception
      using
        errcode = '23514',
        message = format(
          'Course structure cannot change while the course is "%s".',
          course_status
        ),
        hint = 'Create a new draft revision before changing released course content.';
  end if;

  if old_course_id_value is not null and old_course_id_value <> course_id_value then
    select course.lifecycle_status
    into course_status
    from public.learning_course course
    where course.id = old_course_id_value;

    if course_status <> 'draft' then
      raise exception
        using
          errcode = '23514',
          message = format(
            'Course structure cannot move out of a course while it is "%s".',
            course_status
          ),
          hint = 'Create a new draft revision before changing released course content.';
    end if;
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

drop trigger if exists learning_course_section_structure_guard
  on public.learning_course_section;
create trigger learning_course_section_structure_guard
  before insert or update or delete on public.learning_course_section
  for each row execute function public.guard_learning_course_structure();

drop trigger if exists learning_course_item_structure_guard
  on public.learning_course_item;
create trigger learning_course_item_structure_guard
  before insert or update or delete on public.learning_course_item
  for each row execute function public.guard_learning_course_structure();

create or replace function public.guard_learning_progress_access()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  actor_id uuid := auth.uid();
  enrollment_id_value uuid;
begin
  enrollment_id_value := case
    when tg_table_name = 'learning_enrollment' then new.id
    else new.enrollment_id
  end;

  if actor_id is null then
    raise exception
      using
        errcode = '42501',
        message = 'Sign in before changing learning progress.';
  end if;

  if public.current_is_app_admin() then
    return new;
  end if;

  if not exists (
    select 1
    from public.learning_enrollment enrollment
    join public.learning_course course on course.id = enrollment.course_id
    where enrollment.id = enrollment_id_value
      and enrollment.learner_id = actor_id
      and enrollment.status not in ('waived', 'cancelled')
      and course.lifecycle_status = 'published'
      and public.can_view_knowledge_content(course.content_item_id)
  ) then
    raise exception
      using
        errcode = '42501',
        message = 'Learning progress is blocked because the enrollment is unavailable or course access was revoked.',
        hint = 'Ask a learning administrator to verify the assignment and course audience.';
  end if;

  return new;
end;
$$;

drop trigger if exists learning_enrollment_progress_access_guard
  on public.learning_enrollment;
create trigger learning_enrollment_progress_access_guard
  before update of status, started_at, progress_percent, completed_at
  on public.learning_enrollment
  for each row execute function public.guard_learning_progress_access();

drop trigger if exists learning_item_progress_access_guard
  on public.learning_item_progress;
create trigger learning_item_progress_access_guard
  before insert or update on public.learning_item_progress
  for each row execute function public.guard_learning_progress_access();

create or replace function public.create_training_resource_with_roles(
  p_title text,
  p_description text,
  p_url text,
  p_topic_id uuid,
  p_resource_type public.training_resource_type,
  p_level public.training_resource_level,
  p_track text,
  p_provider text default null,
  p_duration_minutes integer default null,
  p_role_ids uuid[] default '{}'::uuid[]
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  actor_id uuid := auth.uid();
  resource_id_value uuid;
  provided_role_count integer;
  distinct_role_count integer;
  valid_role_count integer;
begin
  if actor_id is null or not public.current_is_app_admin() then
    raise exception
      using
        errcode = '42501',
        message = 'Training reviewer access is required to create a resource.';
  end if;

  select count(*), count(distinct role_id)
  into provided_role_count, distinct_role_count
  from unnest(coalesce(p_role_ids, '{}'::uuid[])) role_id;

  select count(*)
  into valid_role_count
  from public.training_role role
  where role.id = any(coalesce(p_role_ids, '{}'::uuid[]))
    and role.active;

  if provided_role_count <> distinct_role_count
    or distinct_role_count <> valid_role_count
  then
    raise exception
      using
        errcode = '23503',
        message = 'One or more selected training roles are missing, inactive, or duplicated.',
        hint = 'Reload the resource form and choose active roles.';
  end if;

  insert into public.training_resource (
    title,
    description,
    url,
    topic_id,
    resource_type,
    level,
    track,
    provider,
    duration_minutes,
    status,
    created_by,
    updated_by
  )
  values (
    p_title,
    nullif(btrim(p_description), ''),
    p_url,
    p_topic_id,
    p_resource_type,
    p_level,
    p_track,
    nullif(btrim(p_provider), ''),
    p_duration_minutes,
    'review',
    actor_id,
    actor_id
  )
  returning id into resource_id_value;

  insert into public.training_resource_role (
    resource_id,
    role_id,
    created_by
  )
  select resource_id_value, role_id, actor_id
  from unnest(coalesce(p_role_ids, '{}'::uuid[])) role_id;

  return resource_id_value;
end;
$$;

revoke all on function public.create_training_resource_with_roles(
  text,
  text,
  text,
  uuid,
  public.training_resource_type,
  public.training_resource_level,
  text,
  text,
  integer,
  uuid[]
) from public, anon;
grant execute on function public.create_training_resource_with_roles(
  text,
  text,
  text,
  uuid,
  public.training_resource_type,
  public.training_resource_level,
  text,
  text,
  integer,
  uuid[]
) to authenticated;

comment on function public.guard_learning_course_structure() is
  'Blocks direct or UI-bypassed changes to released course structure and prevents nested internal courses.';
comment on function public.guard_learning_progress_access() is
  'Rechecks enrollment ownership, published lifecycle, and current catalog visibility for every learner progress mutation.';
comment on function public.create_training_resource_with_roles(
  text,
  text,
  text,
  uuid,
  public.training_resource_type,
  public.training_resource_level,
  text,
  text,
  integer,
  uuid[]
) is
  'Creates a review resource and all active role links in one transaction.';

commit;
