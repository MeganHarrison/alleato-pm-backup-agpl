-- Trigger records expose only the columns of their relation. Use procedural
-- branching so PostgreSQL never resolves a column from the other relation.

begin;

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
  if tg_table_name = 'learning_enrollment' then
    enrollment_id_value := new.id;
  elsif tg_table_name = 'learning_item_progress' then
    enrollment_id_value := new.enrollment_id;
  else
    raise exception
      using
        errcode = '55000',
        message = format(
          'Learning progress guard is attached to unsupported relation "%s".',
          tg_table_name
        );
  end if;

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

commit;
