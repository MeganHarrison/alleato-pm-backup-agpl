-- Keep course catalog identities distinct from standalone articles.
create or replace function public.sync_learning_course_catalog()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  update public.knowledge_content_item
  set
    slug = 'course-' || new.slug,
    title = new.title,
    summary = new.summary,
    content_kind = 'internal_course',
    lifecycle_status = new.lifecycle_status,
    visibility = new.visibility,
    owner_user_id = new.owner_user_id,
    reviewer_user_id = new.reviewer_user_id,
    published_at = new.published_at,
    metadata = metadata || jsonb_build_object(
      'outcome', new.outcome,
      'difficulty', new.difficulty,
      'estimated_minutes', new.estimated_minutes,
      'completion_rule', new.completion_rule
    ),
    updated_at = new.updated_at
  where id = new.content_item_id;

  if not found then
    raise exception
      using
        errcode = '23503',
        message = format('Course "%s" has no catalog identity to synchronize.', new.title),
        hint = 'Create courses through create_learning_course.';
  end if;
  return new;
end;
$$;

drop trigger if exists sync_learning_course_to_catalog
  on public.learning_course;

create trigger sync_learning_course_to_catalog
  after insert or update on public.learning_course
  for each row execute function public.sync_learning_course_catalog();

update public.knowledge_content_item
set content_kind = 'internal_course'
where source_type = 'learning_course'
  and content_kind <> 'internal_course';
