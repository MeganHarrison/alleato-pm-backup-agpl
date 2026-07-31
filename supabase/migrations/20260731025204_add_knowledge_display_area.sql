begin;

create type public.knowledge_display_area as enum (
  'training',
  'resources',
  'sops',
  'documentation'
);

alter table public.knowledge_content_item
  add column display_area public.knowledge_display_area null;

comment on column public.knowledge_content_item.display_area is
  'Primary employee-facing destination for this catalog item.';

create or replace function public.set_default_knowledge_display_area()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.display_area is null then
    new.display_area := case
      when new.source_type = 'learning_course'
        or new.content_kind in ('internal_course', 'external_course', 'assessment')
        then 'training'::public.knowledge_display_area
      when new.content_kind = 'sop'
        then 'sops'::public.knowledge_display_area
      when new.source_type = 'training_resource'
        then 'resources'::public.knowledge_display_area
      else 'documentation'::public.knowledge_display_area
    end;
  end if;
  return new;
end;
$$;

create trigger knowledge_content_default_display_area
before insert on public.knowledge_content_item
for each row execute function public.set_default_knowledge_display_area();

update public.knowledge_content_item
set display_area = case
  when source_type = 'learning_course'
    or content_kind in ('internal_course', 'external_course', 'assessment')
    then 'training'::public.knowledge_display_area
  when content_kind = 'sop'
    then 'sops'::public.knowledge_display_area
  when source_type = 'training_resource'
    then 'resources'::public.knowledge_display_area
  else 'documentation'::public.knowledge_display_area
end
where display_area is null;

alter table public.knowledge_content_item
  alter column display_area set not null;

create index knowledge_content_display_area_idx
  on public.knowledge_content_item (
    display_area,
    lifecycle_status,
    updated_at desc
  );

create or replace view public.knowledge_content_catalog_view
with (security_invoker = true)
as
select
  item.id,
  item.slug,
  item.title,
  item.summary,
  item.content_kind,
  item.lifecycle_status,
  item.visibility,
  item.source_type,
  item.source_id,
  item.source_url,
  item.owner_user_id,
  owner.full_name as owner_name,
  item.reviewer_user_id,
  reviewer.full_name as reviewer_name,
  item.published_at,
  item.last_reviewed_at,
  item.next_review_at,
  item.metadata,
  item.created_at,
  item.updated_at,
  coalesce((
    select jsonb_agg(
      jsonb_build_object(
        'id', topic.id,
        'slug', topic.slug,
        'name', topic.name
      )
      order by topic.sort_order, topic.name
    )
    from public.knowledge_content_topic item_topic
    join public.training_topic topic on topic.id = item_topic.topic_id
    where item_topic.content_item_id = item.id
  ), '[]'::jsonb) as topics,
  coalesce((
    select jsonb_agg(
      jsonb_build_object(
        'id', role.id,
        'slug', role.slug,
        'name', role.name
      )
      order by role.sort_order, role.name
    )
    from public.knowledge_content_role item_role
    join public.training_role role on role.id = item_role.role_id
    where item_role.content_item_id = item.id
  ), '[]'::jsonb) as roles,
  coalesce((
    select jsonb_agg(
      jsonb_build_object(
        'id', skill.id,
        'slug', skill.slug,
        'name', skill.name
      )
      order by skill.sort_order, skill.name
    )
    from public.knowledge_content_skill item_skill
    join public.training_role_skill skill on skill.id = item_skill.skill_id
    where item_skill.content_item_id = item.id
  ), '[]'::jsonb) as skills,
  coalesce((
    select jsonb_agg(
      jsonb_build_object(
        'id', area.id,
        'key', area.key,
        'name', area.name
      )
      order by area.name
    )
    from public.knowledge_content_business_area item_area
    join public.business_areas area on area.id = item_area.business_area_id
    where item_area.content_item_id = item.id
  ), '[]'::jsonb) as business_areas,
  item.display_area
from public.knowledge_content_item item
left join public.user_profiles owner on owner.id = item.owner_user_id
left join public.user_profiles reviewer on reviewer.id = item.reviewer_user_id;

create or replace view public.training_library_view
with (security_invoker = true)
as
select
  catalog.id,
  catalog.slug,
  catalog.title,
  catalog.summary,
  catalog.content_kind,
  catalog.lifecycle_status,
  catalog.visibility,
  catalog.source_type,
  catalog.source_id,
  catalog.source_url,
  catalog.owner_user_id,
  catalog.owner_name,
  catalog.reviewer_user_id,
  catalog.reviewer_name,
  catalog.published_at,
  catalog.last_reviewed_at,
  catalog.next_review_at,
  catalog.metadata,
  catalog.created_at,
  catalog.updated_at,
  catalog.topics,
  catalog.roles,
  catalog.skills,
  catalog.business_areas,
  course.id as course_id,
  course.outcome as course_outcome,
  course.difficulty as course_difficulty,
  course.estimated_minutes as course_estimated_minutes,
  course.completion_rule as course_completion_rule,
  exists (
    select 1
    from public.learning_course course_match
    where course_match.content_item_id = catalog.id
  ) as is_internal_course,
  catalog.display_area
from public.knowledge_content_catalog_view catalog
left join public.learning_course course on course.content_item_id = catalog.id
where catalog.lifecycle_status = 'published'
  and catalog.display_area in ('training', 'resources');

commit;
