begin;

-- Documentation remains authored and hosted by the docs site. This small
-- source table supplies the same referential-integrity boundary that every
-- other knowledge source has before it can enter the shared content catalog.
create table public.docs_learning_source (
  id text primary key,
  title text not null,
  source_url text not null,
  playback_url text not null,
  provider text not null default 'html5',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint docs_learning_source_provider_check
    check (provider in ('html5', 'youtube', 'vimeo', 'loom'))
);

alter table public.docs_learning_source enable row level security;

revoke all on table public.docs_learning_source from anon, authenticated;
grant select, insert, update, delete on table public.docs_learning_source to service_role;

create trigger set_docs_learning_source_updated_at
  before update on public.docs_learning_source
  for each row execute function public.update_updated_at_column();

create or replace function public.validate_knowledge_content_source()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
declare
  source_exists boolean := false;
begin
  case new.source_type
    when 'training_doc' then
      select exists (select 1 from public.training_docs source where source.id::text = new.source_id) into source_exists;
    when 'document' then
      select exists (select 1 from public.document_metadata source where source.id = new.source_id) into source_exists;
    when 'training_resource' then
      select exists (select 1 from public.training_resource source where source.id::text = new.source_id) into source_exists;
    when 'native_content' then
      select exists (select 1 from public.knowledge_native_content source where source.id::text = new.source_id) into source_exists;
    when 'learning_course' then
      select exists (select 1 from public.learning_course source where source.id::text = new.source_id) into source_exists;
    when 'docs' then
      select exists (select 1 from public.docs_learning_source source where source.id = new.source_id) into source_exists;
  end case;

  if not source_exists then
    raise exception using
      errcode = '23503',
      message = format('Knowledge content "%s" references missing %s source "%s".', new.title, new.source_type, new.source_id),
      hint = 'Restore the authoritative source or correct the catalog source identity.';
  end if;
  return new;
end;
$$;

create or replace function public.prevent_referenced_knowledge_source_delete()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
declare
  source_type_value public.knowledge_source_type;
  source_id_value text;
  content_id uuid;
  affected_courses text;
begin
  source_type_value := case tg_table_name
    when 'training_docs' then 'training_doc'::public.knowledge_source_type
    when 'document_metadata' then 'document'::public.knowledge_source_type
    when 'training_resource' then 'training_resource'::public.knowledge_source_type
    when 'knowledge_native_content' then 'native_content'::public.knowledge_source_type
    when 'learning_course' then 'learning_course'::public.knowledge_source_type
    when 'docs_learning_source' then 'docs'::public.knowledge_source_type
  end;
  source_id_value := old.id::text;

  select item.id into content_id
  from public.knowledge_content_item item
  where item.source_type = source_type_value and item.source_id = source_id_value;

  if content_id is not null then
    select string_agg(distinct course.title, ', ' order by course.title) into affected_courses
    from public.learning_course_item course_item
    join public.learning_course_section section on section.id = course_item.section_id
    join public.learning_course course on course.id = section.course_id
    where course_item.content_item_id = content_id;
    raise exception using
      errcode = '23503',
      message = format('Cannot delete %s source "%s" while catalog content exists.', source_type_value, source_id_value),
      detail = case when affected_courses is null then 'The source is still published or governed through the shared catalog.' else 'Referenced by courses: ' || affected_courses end,
      hint = 'Archive the catalog content, preserve learner history, and remove all course references before destructive deletion.';
  end if;
  return old;
end;
$$;

create trigger prevent_cataloged_docs_learning_source_delete
  before delete on public.docs_learning_source
  for each row execute function public.prevent_referenced_knowledge_source_delete();

comment on table public.docs_learning_source is
  'Authoritative identity and hosted playback metadata for documentation-site learning videos.';

notify pgrst, 'reload schema';

commit;
