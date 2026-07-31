-- PostgreSQL resolves CASE expressions with mixed enum and unknown literals as
-- text. Cast the learner-status branches explicitly so start and completion
-- updates remain type-safe.

begin;

create or replace function public.start_learning_course(
  p_course_id uuid default null,
  p_enrollment_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  actor_id uuid := auth.uid();
  enrollment_id_value uuid;
  course_id_value uuid;
begin
  if actor_id is null then
    raise exception
      using errcode = '42501', message = 'Sign in before starting a course.';
  end if;
  if (p_course_id is null) = (p_enrollment_id is null) then
    raise exception
      using
        errcode = '22023',
        message = 'Provide exactly one course ID or enrollment ID.';
  end if;

  if p_enrollment_id is not null then
    select enrollment.id, enrollment.course_id
    into enrollment_id_value, course_id_value
    from public.learning_enrollment enrollment
    where enrollment.id = p_enrollment_id
      and enrollment.learner_id = actor_id
      and enrollment.status not in ('waived', 'cancelled');

    if enrollment_id_value is null then
      raise exception
        using
          errcode = '42501',
          message = 'The enrollment is unavailable or belongs to another employee.';
    end if;
  else
    course_id_value := p_course_id;
    if not exists (
      select 1
      from public.learning_course course
      where course.id = course_id_value
        and course.lifecycle_status = 'published'
        and public.can_view_knowledge_content(course.content_item_id)
    ) then
      raise exception
        using
          errcode = '42501',
          message = 'The course is unpublished or restricted for this employee.';
    end if;

    select enrollment.id
    into enrollment_id_value
    from public.learning_enrollment enrollment
    where enrollment.course_id = course_id_value
      and enrollment.learner_id = actor_id
      and enrollment.status not in ('completed', 'waived', 'cancelled')
    order by enrollment.due_at nulls last, enrollment.created_at
    limit 1;

    if enrollment_id_value is null then
      insert into public.learning_enrollment (
        course_id,
        learner_id,
        status,
        requirement,
        started_at
      )
      values (
        course_id_value,
        actor_id,
        'in_progress',
        'recommended',
        now()
      )
      returning id into enrollment_id_value;
    end if;
  end if;

  update public.learning_enrollment
  set
    status = case
      when status = 'completed' then status
      else 'in_progress'::public.learning_enrollment_status
    end,
    started_at = coalesce(started_at, now())
  where id = enrollment_id_value;

  insert into public.learning_event (
    learner_id,
    actor_user_id,
    event_type,
    object_type,
    object_id
  )
  values (
    actor_id,
    actor_id,
    'course_started',
    'learning_enrollment',
    enrollment_id_value::text
  );

  return enrollment_id_value;
end;
$$;

create or replace function public.complete_learning_item(
  p_enrollment_id uuid,
  p_course_item_id uuid,
  p_score numeric default null,
  p_evidence jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  actor_id uuid := auth.uid();
  course_id_value uuid;
  completion_rule_value public.learning_completion_rule;
  required_total integer;
  required_completed integer;
  progress_value numeric(5,2);
  course_completed boolean := false;
begin
  if actor_id is null then
    raise exception
      using errcode = '42501', message = 'Sign in before completing learning.';
  end if;

  select enrollment.course_id, course.completion_rule
  into course_id_value, completion_rule_value
  from public.learning_enrollment enrollment
  join public.learning_course course on course.id = enrollment.course_id
  where enrollment.id = p_enrollment_id
    and enrollment.learner_id = actor_id
    and enrollment.status not in ('waived', 'cancelled');

  if course_id_value is null then
    raise exception
      using
        errcode = '42501',
        message = 'The enrollment is unavailable or belongs to another employee.';
  end if;

  if not exists (
    select 1
    from public.learning_course_item course_item
    join public.learning_course_section section on section.id = course_item.section_id
    where course_item.id = p_course_item_id
      and section.course_id = course_id_value
  ) then
    raise exception
      using
        errcode = '23503',
        message = 'The learning item does not belong to this enrollment course.';
  end if;

  insert into public.learning_item_progress (
    enrollment_id,
    course_item_id,
    status,
    score,
    evidence,
    attempt_count,
    started_at,
    completed_at
  )
  values (
    p_enrollment_id,
    p_course_item_id,
    'completed',
    p_score,
    coalesce(p_evidence, '{}'::jsonb),
    1,
    now(),
    now()
  )
  on conflict (enrollment_id, course_item_id) do update
  set
    status = 'completed',
    score = excluded.score,
    evidence = excluded.evidence,
    attempt_count = public.learning_item_progress.attempt_count + 1,
    started_at = coalesce(public.learning_item_progress.started_at, now()),
    completed_at = now(),
    updated_at = now();

  select
    count(*) filter (where course_item.required),
    count(*) filter (
      where course_item.required and progress.status = 'completed'
    )
  into required_total, required_completed
  from public.learning_course_section section
  join public.learning_course_item course_item on course_item.section_id = section.id
  left join public.learning_item_progress progress
    on progress.course_item_id = course_item.id
    and progress.enrollment_id = p_enrollment_id
  where section.course_id = course_id_value;

  progress_value := case
    when required_total = 0 then 0
    else round((required_completed::numeric / required_total::numeric) * 100, 2)
  end;
  course_completed :=
    completion_rule_value = 'all_required'
    and required_total > 0
    and required_completed = required_total;

  update public.learning_enrollment
  set
    status = case
      when course_completed
        then 'completed'::public.learning_enrollment_status
      else 'in_progress'::public.learning_enrollment_status
    end,
    started_at = coalesce(started_at, now()),
    progress_percent = progress_value,
    completed_at = case when course_completed then now() else completed_at end
  where id = p_enrollment_id;

  insert into public.learning_event (
    learner_id,
    actor_user_id,
    event_type,
    object_type,
    object_id,
    context
  )
  values (
    actor_id,
    actor_id,
    'learning_item_completed',
    'learning_course_item',
    p_course_item_id::text,
    jsonb_build_object(
      'enrollment_id', p_enrollment_id,
      'progress_percent', progress_value
    )
  );

  if course_completed then
    insert into public.learning_event (
      learner_id,
      actor_user_id,
      event_type,
      object_type,
      object_id
    )
    values (
      actor_id,
      actor_id,
      'course_completed',
      'learning_enrollment',
      p_enrollment_id::text
    );
  end if;

  return jsonb_build_object(
    'enrollment_id', p_enrollment_id,
    'progress_percent', progress_value,
    'course_completed', course_completed
  );
end;
$$;

commit;
