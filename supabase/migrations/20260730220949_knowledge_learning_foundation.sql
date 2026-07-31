-- Unified knowledge catalog and composable learning foundation.
--
-- This migration is additive. Existing source tables remain authoritative:
--   * training_docs owns software-guide bodies and QA
--   * document_metadata owns controlled SOP and policy files
--   * training_resource owns vetted external resources
-- The catalog stores a shared identity and governance projection. Courses
-- reference catalog identities without copying source bodies.

begin;

create type public.knowledge_content_kind as enum (
  'software_guide',
  'sop',
  'policy',
  'reference',
  'video',
  'template',
  'checklist',
  'article',
  'assessment',
  'external_course'
);

create type public.knowledge_lifecycle_status as enum (
  'draft',
  'in_review',
  'approved',
  'published',
  'archived'
);

create type public.knowledge_visibility as enum (
  'internal',
  'leadership',
  'role',
  'business_area',
  'project',
  'customer'
);

create type public.knowledge_source_type as enum (
  'training_doc',
  'document',
  'training_resource',
  'native_content',
  'learning_course'
);

create type public.learning_assignment_target_type as enum (
  'user',
  'role',
  'business_area',
  'all'
);

create type public.learning_assignment_kind as enum (
  'course',
  'program'
);

create type public.learning_requirement as enum (
  'required',
  'recommended'
);

create type public.learning_enrollment_status as enum (
  'assigned',
  'in_progress',
  'completed',
  'overdue',
  'waived',
  'cancelled'
);

create type public.learning_item_status as enum (
  'not_started',
  'in_progress',
  'completed'
);

create type public.learning_completion_rule as enum (
  'all_required',
  'manual'
);

create table public.knowledge_native_content (
  id uuid primary key default gen_random_uuid(),
  body_markdown text not null default '',
  content_format text not null default 'markdown'
    check (content_format in ('markdown', 'assessment')),
  created_by uuid null references public.user_profiles(id) on delete set null,
  updated_by uuid null references public.user_profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint knowledge_native_content_body_check
    check (content_format = 'assessment' or btrim(body_markdown) <> '')
);

create table public.knowledge_content_item (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title text not null,
  summary text null,
  content_kind public.knowledge_content_kind not null,
  lifecycle_status public.knowledge_lifecycle_status not null default 'draft',
  visibility public.knowledge_visibility not null default 'internal',
  source_type public.knowledge_source_type not null,
  source_id text not null,
  source_url text null,
  owner_user_id uuid null references public.user_profiles(id) on delete set null,
  reviewer_user_id uuid null references public.user_profiles(id) on delete set null,
  published_at timestamptz null,
  last_reviewed_at timestamptz null,
  next_review_at timestamptz null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  search_vector tsvector generated always as (
    to_tsvector(
      'english',
      coalesce(title, '') || ' ' ||
      coalesce(summary, '')
    )
  ) stored,
  constraint knowledge_content_source_unique unique (source_type, source_id),
  constraint knowledge_content_slug_format_check
    check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  constraint knowledge_content_title_not_blank_check
    check (btrim(title) <> ''),
  constraint knowledge_content_source_id_not_blank_check
    check (btrim(source_id) <> ''),
  constraint knowledge_content_metadata_object_check
    check (jsonb_typeof(metadata) = 'object'),
  constraint knowledge_content_publish_audit_check
    check (
      lifecycle_status <> 'published'
      or published_at is not null
    )
);

create table public.knowledge_content_topic (
  content_item_id uuid not null
    references public.knowledge_content_item(id) on delete cascade,
  topic_id uuid not null
    references public.training_topic(id) on delete restrict,
  created_at timestamptz not null default now(),
  primary key (content_item_id, topic_id)
);

create table public.knowledge_content_role (
  content_item_id uuid not null
    references public.knowledge_content_item(id) on delete cascade,
  role_id uuid not null
    references public.training_role(id) on delete restrict,
  created_at timestamptz not null default now(),
  primary key (content_item_id, role_id)
);

create table public.knowledge_content_skill (
  content_item_id uuid not null
    references public.knowledge_content_item(id) on delete cascade,
  skill_id uuid not null
    references public.training_role_skill(id) on delete restrict,
  created_at timestamptz not null default now(),
  primary key (content_item_id, skill_id)
);

create table public.knowledge_content_business_area (
  content_item_id uuid not null
    references public.knowledge_content_item(id) on delete cascade,
  business_area_id bigint not null
    references public.business_areas(id) on delete restrict,
  created_at timestamptz not null default now(),
  primary key (content_item_id, business_area_id)
);

create table public.knowledge_content_project (
  content_item_id uuid not null
    references public.knowledge_content_item(id) on delete cascade,
  project_id bigint not null
    references public.projects(id) on delete restrict,
  created_at timestamptz not null default now(),
  primary key (content_item_id, project_id)
);

create table public.learning_program (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title text not null,
  description text null,
  lifecycle_status public.knowledge_lifecycle_status not null default 'draft',
  owner_user_id uuid null references public.user_profiles(id) on delete set null,
  reviewer_user_id uuid null references public.user_profiles(id) on delete set null,
  published_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint learning_program_slug_format_check
    check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  constraint learning_program_title_not_blank_check
    check (btrim(title) <> ''),
  constraint learning_program_publish_audit_check
    check (
      lifecycle_status <> 'published'
      or published_at is not null
    )
);

create table public.learning_course (
  id uuid primary key default gen_random_uuid(),
  content_item_id uuid not null unique
    references public.knowledge_content_item(id) on delete restrict,
  slug text not null unique,
  title text not null,
  summary text null,
  outcome text not null,
  difficulty text null
    check (difficulty is null or difficulty in ('intro', 'intermediate', 'advanced')),
  estimated_minutes integer null
    check (estimated_minutes is null or estimated_minutes > 0),
  prerequisites text null,
  lifecycle_status public.knowledge_lifecycle_status not null default 'draft',
  visibility public.knowledge_visibility not null default 'internal',
  owner_user_id uuid null references public.user_profiles(id) on delete set null,
  reviewer_user_id uuid null references public.user_profiles(id) on delete set null,
  completion_rule public.learning_completion_rule not null default 'all_required',
  published_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint learning_course_slug_format_check
    check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  constraint learning_course_title_not_blank_check
    check (btrim(title) <> ''),
  constraint learning_course_outcome_not_blank_check
    check (btrim(outcome) <> ''),
  constraint learning_course_publish_audit_check
    check (
      lifecycle_status <> 'published'
      or published_at is not null
    )
);

create table public.learning_program_course (
  program_id uuid not null
    references public.learning_program(id) on delete cascade,
  course_id uuid not null
    references public.learning_course(id) on delete restrict,
  sort_order integer not null check (sort_order >= 0),
  required boolean not null default true,
  created_at timestamptz not null default now(),
  primary key (program_id, course_id),
  constraint learning_program_course_order_unique
    unique (program_id, sort_order)
);

create table public.learning_course_section (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null
    references public.learning_course(id) on delete cascade,
  title text not null,
  description text null,
  sort_order integer not null check (sort_order >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint learning_course_section_title_not_blank_check
    check (btrim(title) <> ''),
  constraint learning_course_section_order_unique
    unique (course_id, sort_order)
);

create table public.learning_course_item (
  id uuid primary key default gen_random_uuid(),
  section_id uuid not null
    references public.learning_course_section(id) on delete cascade,
  content_item_id uuid not null
    references public.knowledge_content_item(id) on delete restrict,
  title_override text null,
  instructions text null,
  sort_order integer not null check (sort_order >= 0),
  required boolean not null default true,
  estimated_minutes integer null
    check (estimated_minutes is null or estimated_minutes > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint learning_course_item_order_unique
    unique (section_id, sort_order),
  constraint learning_course_item_content_unique
    unique (section_id, content_item_id)
);

create table public.learning_assignment (
  id uuid primary key default gen_random_uuid(),
  assignment_kind public.learning_assignment_kind not null,
  course_id uuid null references public.learning_course(id) on delete restrict,
  program_id uuid null references public.learning_program(id) on delete restrict,
  target_type public.learning_assignment_target_type not null,
  target_user_id uuid null references public.user_profiles(id) on delete restrict,
  target_role_id uuid null references public.training_role(id) on delete restrict,
  target_business_area_id bigint null
    references public.business_areas(id) on delete restrict,
  requirement public.learning_requirement not null default 'required',
  assigned_by uuid not null references public.user_profiles(id) on delete restrict
    default auth.uid(),
  reason text null,
  due_at timestamptz null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint learning_assignment_object_check check (
    (assignment_kind = 'course' and course_id is not null and program_id is null)
    or
    (assignment_kind = 'program' and program_id is not null and course_id is null)
  ),
  constraint learning_assignment_target_check check (
    (
      target_type = 'user'
      and target_user_id is not null
      and target_role_id is null
      and target_business_area_id is null
    )
    or
    (
      target_type = 'role'
      and target_user_id is null
      and target_role_id is not null
      and target_business_area_id is null
    )
    or
    (
      target_type = 'business_area'
      and target_user_id is null
      and target_role_id is null
      and target_business_area_id is not null
    )
    or
    (
      target_type = 'all'
      and target_user_id is null
      and target_role_id is null
      and target_business_area_id is null
    )
  )
);

create table public.learning_enrollment (
  id uuid primary key default gen_random_uuid(),
  assignment_id uuid null references public.learning_assignment(id) on delete restrict,
  course_id uuid not null references public.learning_course(id) on delete restrict,
  learner_id uuid not null references public.user_profiles(id) on delete restrict,
  status public.learning_enrollment_status not null default 'assigned',
  requirement public.learning_requirement not null default 'recommended',
  due_at timestamptz null,
  progress_percent numeric(5,2) not null default 0
    check (progress_percent >= 0 and progress_percent <= 100),
  started_at timestamptz null,
  completed_at timestamptz null,
  waived_at timestamptz null,
  waived_by uuid null references public.user_profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint learning_enrollment_assignment_unique
    unique nulls not distinct (learner_id, course_id, assignment_id),
  constraint learning_enrollment_completion_check check (
    (status = 'completed' and completed_at is not null)
    or status <> 'completed'
  ),
  constraint learning_enrollment_waiver_check check (
    (status = 'waived' and waived_at is not null and waived_by is not null)
    or status <> 'waived'
  )
);

create table public.learning_item_progress (
  id uuid primary key default gen_random_uuid(),
  enrollment_id uuid not null
    references public.learning_enrollment(id) on delete cascade,
  course_item_id uuid not null
    references public.learning_course_item(id) on delete restrict,
  status public.learning_item_status not null default 'not_started',
  score numeric(6,2) null,
  evidence jsonb not null default '{}'::jsonb,
  attempt_count integer not null default 0 check (attempt_count >= 0),
  started_at timestamptz null,
  completed_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint learning_item_progress_unique
    unique (enrollment_id, course_item_id),
  constraint learning_item_progress_evidence_object_check
    check (jsonb_typeof(evidence) = 'object'),
  constraint learning_item_progress_completion_check check (
    (status = 'completed' and completed_at is not null)
    or status <> 'completed'
  )
);

create table public.learning_event (
  id bigint generated always as identity primary key,
  learner_id uuid null references public.user_profiles(id) on delete set null,
  actor_user_id uuid null references public.user_profiles(id) on delete set null,
  event_type text not null,
  object_type text not null,
  object_id text not null,
  context jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default now(),
  constraint learning_event_type_not_blank_check check (btrim(event_type) <> ''),
  constraint learning_event_object_type_not_blank_check check (btrim(object_type) <> ''),
  constraint learning_event_object_id_not_blank_check check (btrim(object_id) <> ''),
  constraint learning_event_context_object_check
    check (jsonb_typeof(context) = 'object')
);

create index knowledge_content_lifecycle_kind_idx
  on public.knowledge_content_item (lifecycle_status, content_kind, updated_at desc);
create index knowledge_content_owner_review_idx
  on public.knowledge_content_item (owner_user_id, next_review_at)
  where lifecycle_status <> 'archived';
create index knowledge_content_search_idx
  on public.knowledge_content_item using gin (search_vector);
create index knowledge_content_topic_lookup_idx
  on public.knowledge_content_topic (topic_id, content_item_id);
create index knowledge_content_role_lookup_idx
  on public.knowledge_content_role (role_id, content_item_id);
create index knowledge_content_skill_lookup_idx
  on public.knowledge_content_skill (skill_id, content_item_id);
create index knowledge_content_business_area_lookup_idx
  on public.knowledge_content_business_area (business_area_id, content_item_id);
create index knowledge_content_project_lookup_idx
  on public.knowledge_content_project (project_id, content_item_id);
create index learning_program_course_order_idx
  on public.learning_program_course (program_id, sort_order);
create index learning_course_section_order_idx
  on public.learning_course_section (course_id, sort_order);
create index learning_course_item_order_idx
  on public.learning_course_item (section_id, sort_order);
create index learning_assignment_active_due_idx
  on public.learning_assignment (active, due_at)
  where active;
create index learning_enrollment_learner_status_idx
  on public.learning_enrollment (learner_id, status, due_at);
create index learning_enrollment_course_status_idx
  on public.learning_enrollment (course_id, status);
create index learning_item_progress_enrollment_idx
  on public.learning_item_progress (enrollment_id, status);
create index learning_event_learner_time_idx
  on public.learning_event (learner_id, occurred_at desc);

create trigger set_knowledge_native_content_updated_at
  before update on public.knowledge_native_content
  for each row execute function public.update_updated_at_column();
create trigger set_knowledge_content_item_updated_at
  before update on public.knowledge_content_item
  for each row execute function public.update_updated_at_column();
create trigger set_learning_program_updated_at
  before update on public.learning_program
  for each row execute function public.update_updated_at_column();
create trigger set_learning_course_updated_at
  before update on public.learning_course
  for each row execute function public.update_updated_at_column();
create trigger set_learning_course_section_updated_at
  before update on public.learning_course_section
  for each row execute function public.update_updated_at_column();
create trigger set_learning_course_item_updated_at
  before update on public.learning_course_item
  for each row execute function public.update_updated_at_column();
create trigger set_learning_assignment_updated_at
  before update on public.learning_assignment
  for each row execute function public.update_updated_at_column();
create trigger set_learning_enrollment_updated_at
  before update on public.learning_enrollment
  for each row execute function public.update_updated_at_column();
create trigger set_learning_item_progress_updated_at
  before update on public.learning_item_progress
  for each row execute function public.update_updated_at_column();

create or replace function public.current_is_learning_admin()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select
    public.current_is_app_admin()
    or exists (
      select 1
      from public.user_profiles profile
      where profile.id = (select auth.uid())
        and profile.is_active
        and profile.is_leadership
    );
$$;

create or replace function public.can_view_knowledge_content(p_content_item_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select
    public.current_is_app_admin()
    or exists (
      select 1
      from public.knowledge_content_item item
      where item.id = p_content_item_id
        and item.lifecycle_status = 'published'
        and (
          item.visibility in ('internal', 'customer')
          or (
            item.visibility = 'leadership'
            and exists (
              select 1
              from public.user_profiles profile
              where profile.id = (select auth.uid())
                and profile.is_active
                and profile.is_leadership
            )
          )
          or (
            item.visibility = 'role'
            and exists (
              select 1
              from public.knowledge_content_role item_role
              join public.training_role role on role.id = item_role.role_id
              join public.user_profiles profile
                on profile.id = (select auth.uid())
              where item_role.content_item_id = item.id
                and profile.is_active
                and profile.role is not null
                and (
                  lower(btrim(profile.role)) = lower(role.name)
                  or lower(btrim(profile.role)) = lower(role.slug)
                  or exists (
                    select 1
                    from unnest(role.aliases) alias
                    where lower(btrim(alias)) = lower(btrim(profile.role))
                  )
                )
            )
          )
          or (
            item.visibility = 'business_area'
            and exists (
              select 1
              from public.knowledge_content_business_area item_area
              join public.business_area_memberships membership
                on membership.business_area_id = item_area.business_area_id
                and membership.status = 'active'
              join public.users_auth identity
                on identity.person_id = membership.person_id
              where item_area.content_item_id = item.id
                and identity.auth_user_id = (select auth.uid())
            )
          )
          or (
            item.visibility = 'project'
            and exists (
              select 1
              from public.knowledge_content_project item_project
              where item_project.content_item_id = item.id
                and public.current_is_project_member(item_project.project_id)
            )
          )
        )
    );
$$;

create or replace function public.learning_assignment_targets_current_user(
  p_assignment_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select
    public.current_is_app_admin()
    or exists (
      select 1
      from public.learning_assignment assignment
      left join public.training_role role
        on role.id = assignment.target_role_id
      left join public.user_profiles profile
        on profile.id = (select auth.uid())
      where assignment.id = p_assignment_id
        and assignment.active
        and (
          assignment.target_type = 'all'
          or (
            assignment.target_type = 'user'
            and assignment.target_user_id = (select auth.uid())
          )
          or (
            assignment.target_type = 'role'
            and profile.is_active
            and profile.role is not null
            and (
              lower(btrim(profile.role)) = lower(role.name)
              or lower(btrim(profile.role)) = lower(role.slug)
              or exists (
                select 1
                from unnest(role.aliases) alias
                where lower(btrim(alias)) = lower(btrim(profile.role))
              )
            )
          )
          or (
            assignment.target_type = 'business_area'
            and exists (
              select 1
              from public.business_area_memberships membership
              join public.users_auth identity
                on identity.person_id = membership.person_id
              where membership.business_area_id = assignment.target_business_area_id
                and membership.status = 'active'
                and identity.auth_user_id = (select auth.uid())
            )
          )
        )
    );
$$;

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
      select exists (
        select 1 from public.training_docs source where source.id::text = new.source_id
      ) into source_exists;
    when 'document' then
      select exists (
        select 1 from public.document_metadata source where source.id = new.source_id
      ) into source_exists;
    when 'training_resource' then
      select exists (
        select 1 from public.training_resource source where source.id::text = new.source_id
      ) into source_exists;
    when 'native_content' then
      select exists (
        select 1 from public.knowledge_native_content source where source.id::text = new.source_id
      ) into source_exists;
    when 'learning_course' then
      select exists (
        select 1 from public.learning_course source where source.id::text = new.source_id
      ) into source_exists;
  end case;

  if not source_exists then
    raise exception
      using
        errcode = '23503',
        message = format(
          'Knowledge content "%s" references missing %s source "%s".',
          new.title,
          new.source_type,
          new.source_id
        ),
        hint = 'Restore the authoritative source or correct the catalog source identity.';
  end if;

  return new;
end;
$$;

create constraint trigger knowledge_content_source_exists
  after insert or update of source_type, source_id
  on public.knowledge_content_item
  deferrable initially deferred
  for each row execute function public.validate_knowledge_content_source();

create or replace function public.validate_learning_course_catalog()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if not exists (
    select 1
    from public.knowledge_content_item item
    where item.id = new.content_item_id
      and item.source_type = 'learning_course'
      and item.source_id = new.id::text
      and item.content_kind = 'article'
  ) then
    raise exception
      using
        errcode = '23514',
        message = format(
          'Course "%s" is not paired with its required catalog identity.',
          new.title
        ),
        hint = 'Create courses through create_learning_course so the course and catalog identity commit atomically.';
  end if;
  return new;
end;
$$;

create constraint trigger learning_course_catalog_matches
  after insert or update of content_item_id
  on public.learning_course
  deferrable initially deferred
  for each row execute function public.validate_learning_course_catalog();

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
  end;
  source_id_value := old.id::text;

  select item.id
  into content_id
  from public.knowledge_content_item item
  where item.source_type = source_type_value
    and item.source_id = source_id_value;

  if content_id is not null then
    select string_agg(distinct course.title, ', ' order by course.title)
    into affected_courses
    from public.learning_course_item course_item
    join public.learning_course_section section
      on section.id = course_item.section_id
    join public.learning_course course
      on course.id = section.course_id
    where course_item.content_item_id = content_id;

    raise exception
      using
        errcode = '23503',
        message = format(
          'Cannot delete %s source "%s" while catalog content exists.',
          source_type_value,
          source_id_value
        ),
        detail = case
          when affected_courses is null
            then 'The source is still published or governed through the shared catalog.'
          else 'Referenced by courses: ' || affected_courses
        end,
        hint = 'Archive the catalog content, preserve learner history, and remove all course references before destructive deletion.';
  end if;

  return old;
end;
$$;

create trigger prevent_cataloged_training_doc_delete
  before delete on public.training_docs
  for each row execute function public.prevent_referenced_knowledge_source_delete();
create trigger prevent_cataloged_document_delete
  before delete on public.document_metadata
  for each row execute function public.prevent_referenced_knowledge_source_delete();
create trigger prevent_cataloged_training_resource_delete
  before delete on public.training_resource
  for each row execute function public.prevent_referenced_knowledge_source_delete();
create trigger prevent_cataloged_native_content_delete
  before delete on public.knowledge_native_content
  for each row execute function public.prevent_referenced_knowledge_source_delete();
create trigger prevent_cataloged_learning_course_delete
  before delete on public.learning_course
  for each row execute function public.prevent_referenced_knowledge_source_delete();

create or replace function public.guard_training_doc_publication()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if new.status = 'published'
    and old.status is distinct from 'published'
    and new.qa_status <> 'passing'
  then
    raise exception
      using
        errcode = '23514',
        message = format(
          'Software guide "%s" cannot publish while QA status is "%s".',
          new.title,
          new.qa_status
        ),
        hint = 'Run the documented flow successfully and set QA status to passing before publishing.';
  end if;
  return new;
end;
$$;

create trigger training_doc_publish_requires_passing_qa
  before update of status, qa_status on public.training_docs
  for each row execute function public.guard_training_doc_publication();

create or replace function public.sync_training_doc_catalog()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  insert into public.knowledge_content_item (
    slug,
    title,
    summary,
    content_kind,
    lifecycle_status,
    visibility,
    source_type,
    source_id,
    source_url,
    owner_user_id,
    published_at,
    metadata,
    created_at,
    updated_at
  )
  values (
    'guide-' || new.slug,
    new.title,
    new.summary,
    'software_guide',
    case
      when new.status = 'planned' then 'draft'::public.knowledge_lifecycle_status
      else new.status::public.knowledge_lifecycle_status
    end,
    case
      when new.audience = 'admin' then 'leadership'::public.knowledge_visibility
      when new.audience in ('client', 'subcontractor') then 'customer'::public.knowledge_visibility
      else 'internal'::public.knowledge_visibility
    end,
    'training_doc',
    new.id::text,
    coalesce(new.source_route, new.published_doc_path),
    coalesce(new.updated_by, new.created_by),
    case when new.status = 'published' then coalesce(new.last_published_at, now()) end,
    jsonb_build_object(
      'qa_status', new.qa_status,
      'target_collection', new.target_collection,
      'tool_category', new.tool_category,
      'tool_module', new.tool_module
    ),
    new.created_at,
    new.updated_at
  )
  on conflict (source_type, source_id) do update
  set
    slug = excluded.slug,
    title = excluded.title,
    summary = excluded.summary,
    content_kind = excluded.content_kind,
    lifecycle_status = excluded.lifecycle_status,
    visibility = excluded.visibility,
    source_url = excluded.source_url,
    owner_user_id = coalesce(excluded.owner_user_id, public.knowledge_content_item.owner_user_id),
    published_at = excluded.published_at,
    metadata = public.knowledge_content_item.metadata || excluded.metadata,
    updated_at = excluded.updated_at;

  return new;
end;
$$;

create trigger sync_training_doc_to_catalog
  after insert or update on public.training_docs
  for each row execute function public.sync_training_doc_catalog();

create or replace function public.sync_training_resource_catalog()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
declare
  catalog_id uuid;
begin
  insert into public.knowledge_content_item (
    slug,
    title,
    summary,
    content_kind,
    lifecycle_status,
    visibility,
    source_type,
    source_id,
    source_url,
    owner_user_id,
    reviewer_user_id,
    published_at,
    last_reviewed_at,
    metadata,
    created_at,
    updated_at
  )
  values (
    'resource-' || replace(new.id::text, '-', ''),
    new.title,
    new.description,
    case new.resource_type
      when 'video' then 'video'::public.knowledge_content_kind
      when 'course' then 'external_course'::public.knowledge_content_kind
      else 'reference'::public.knowledge_content_kind
    end,
    case new.status
      when 'review' then 'in_review'::public.knowledge_lifecycle_status
      when 'published' then 'published'::public.knowledge_lifecycle_status
      else 'archived'::public.knowledge_lifecycle_status
    end,
    'internal',
    'training_resource',
    new.id::text,
    new.url,
    coalesce(new.updated_by, new.created_by),
    new.reviewed_by,
    case when new.status = 'published' then coalesce(new.published_at, now()) end,
    new.reviewed_at,
    jsonb_build_object(
      'provider', new.provider,
      'level', new.level,
      'track', new.track,
      'duration_minutes', new.duration_minutes,
      'embed_url', new.embed_url,
      'thumbnail_url', new.thumbnail_url
    ),
    new.created_at,
    new.updated_at
  )
  on conflict (source_type, source_id) do update
  set
    title = excluded.title,
    summary = excluded.summary,
    content_kind = excluded.content_kind,
    lifecycle_status = excluded.lifecycle_status,
    source_url = excluded.source_url,
    owner_user_id = coalesce(excluded.owner_user_id, public.knowledge_content_item.owner_user_id),
    reviewer_user_id = coalesce(excluded.reviewer_user_id, public.knowledge_content_item.reviewer_user_id),
    published_at = excluded.published_at,
    last_reviewed_at = excluded.last_reviewed_at,
    metadata = public.knowledge_content_item.metadata || excluded.metadata,
    updated_at = excluded.updated_at
  returning id into catalog_id;

  delete from public.knowledge_content_topic
  where content_item_id = catalog_id;
  insert into public.knowledge_content_topic (content_item_id, topic_id)
  values (catalog_id, new.topic_id)
  on conflict do nothing;

  return new;
end;
$$;

create trigger sync_training_resource_to_catalog
  after insert or update on public.training_resource
  for each row execute function public.sync_training_resource_catalog();

create or replace function public.sync_training_resource_role_catalog()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
declare
  resource_id_value uuid := coalesce(new.resource_id, old.resource_id);
  role_id_value uuid := coalesce(new.role_id, old.role_id);
  catalog_id uuid;
begin
  select item.id
  into catalog_id
  from public.knowledge_content_item item
  where item.source_type = 'training_resource'
    and item.source_id = resource_id_value::text;

  if catalog_id is null then
    raise exception
      using
        errcode = '23503',
        message = format(
          'Cannot synchronize role "%s" because resource "%s" has no catalog identity.',
          role_id_value,
          resource_id_value
        ),
        hint = 'Resave or backfill the training resource before editing its role targeting.';
  end if;

  if tg_op = 'DELETE' then
    delete from public.knowledge_content_role
    where content_item_id = catalog_id
      and role_id = role_id_value;
    return old;
  end if;

  insert into public.knowledge_content_role (content_item_id, role_id)
  values (catalog_id, role_id_value)
  on conflict do nothing;
  return new;
end;
$$;

create trigger sync_training_resource_role_to_catalog
  after insert or update or delete on public.training_resource_role
  for each row execute function public.sync_training_resource_role_catalog();

create or replace function public.sync_document_catalog()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
declare
  qualifies boolean;
  catalog_id uuid;
  normalized_type text;
begin
  normalized_type := lower(coalesce(new.document_type, new.category, ''));
  qualifies :=
    lower(coalesce(new.category, '')) = 'sop'
    or lower(coalesce(new.document_type, '')) in ('sop', 'policy', 'checklist', 'template');

  if not qualifies then
    update public.knowledge_content_item
    set lifecycle_status = 'archived'
    where source_type = 'document'
      and source_id = new.id
      and lifecycle_status <> 'archived';
    return new;
  end if;

  insert into public.knowledge_content_item (
    slug,
    title,
    summary,
    content_kind,
    lifecycle_status,
    visibility,
    source_type,
    source_id,
    source_url,
    metadata,
    created_at,
    updated_at
  )
  values (
    'document-' || md5(new.id),
    coalesce(nullif(btrim(new.title), ''), nullif(btrim(new.description), ''), 'Untitled controlled document'),
    coalesce(new.summary, new.description),
    case
      when lower(coalesce(new.document_type, '')) = 'policy' then 'policy'::public.knowledge_content_kind
      when lower(coalesce(new.document_type, '')) = 'checklist' then 'checklist'::public.knowledge_content_kind
      when lower(coalesce(new.document_type, '')) = 'template' then 'template'::public.knowledge_content_kind
      else 'sop'::public.knowledge_content_kind
    end,
    case
      when new.deleted_at is null then 'published'::public.knowledge_lifecycle_status
      else 'archived'::public.knowledge_lifecycle_status
    end,
    case
      when new.business_area_id is not null then 'business_area'::public.knowledge_visibility
      when lower(coalesce(new.access_level, '')) = 'restricted' then 'leadership'::public.knowledge_visibility
      else 'internal'::public.knowledge_visibility
    end,
    'document',
    new.id,
    coalesce(new.source_web_url, new.url),
    jsonb_build_object(
      'category', new.category,
      'document_type', new.document_type,
      'access_level', new.access_level
    ),
    coalesce(new.created_at at time zone 'UTC', now()),
    now()
  )
  on conflict (source_type, source_id) do update
  set
    title = excluded.title,
    summary = excluded.summary,
    content_kind = excluded.content_kind,
    lifecycle_status = excluded.lifecycle_status,
    visibility = excluded.visibility,
    source_url = excluded.source_url,
    metadata = public.knowledge_content_item.metadata || excluded.metadata,
    updated_at = now()
  returning id into catalog_id;

  delete from public.knowledge_content_business_area
  where content_item_id = catalog_id;
  if new.business_area_id is not null then
    insert into public.knowledge_content_business_area (
      content_item_id,
      business_area_id
    )
    values (catalog_id, new.business_area_id)
    on conflict do nothing;
  end if;

  return new;
end;
$$;

create trigger sync_controlled_document_to_catalog
  after insert or update of title, description, summary, document_type, category,
    access_level, source_web_url, url, business_area_id, deleted_at
  on public.document_metadata
  for each row execute function public.sync_document_catalog();

create or replace function public.touch_native_content_catalog()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  update public.knowledge_content_item
  set updated_at = new.updated_at
  where source_type = 'native_content'
    and source_id = new.id::text;
  return new;
end;
$$;

create trigger touch_native_content_catalog_on_update
  after update on public.knowledge_native_content
  for each row execute function public.touch_native_content_catalog();

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

create trigger sync_learning_course_to_catalog
  after update on public.learning_course
  for each row execute function public.sync_learning_course_catalog();

create or replace function public.create_learning_course(
  p_slug text,
  p_title text,
  p_outcome text,
  p_summary text default null,
  p_difficulty text default null,
  p_estimated_minutes integer default null,
  p_visibility public.knowledge_visibility default 'internal',
  p_completion_rule public.learning_completion_rule default 'all_required'
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  course_id uuid := gen_random_uuid();
  content_id uuid := gen_random_uuid();
  actor_id uuid := auth.uid();
begin
  if actor_id is null or not public.current_is_app_admin() then
    raise exception
      using
        errcode = '42501',
        message = 'Only a learning administrator can create an internal course.';
  end if;

  if p_slug is null or p_slug !~ '^[a-z0-9]+(-[a-z0-9]+)*$' then
    raise exception
      using
        errcode = '23514',
        message = 'Course slug must use lowercase words separated by hyphens.';
  end if;

  insert into public.knowledge_content_item (
    id,
    slug,
    title,
    summary,
    content_kind,
    lifecycle_status,
    visibility,
    source_type,
    source_id,
    owner_user_id
  )
  values (
    content_id,
    'course-' || p_slug,
    p_title,
    p_summary,
    'article',
    'draft',
    p_visibility,
    'learning_course',
    course_id::text,
    actor_id
  );

  insert into public.learning_course (
    id,
    content_item_id,
    slug,
    title,
    summary,
    outcome,
    difficulty,
    estimated_minutes,
    visibility,
    owner_user_id,
    completion_rule
  )
  values (
    course_id,
    content_id,
    p_slug,
    p_title,
    p_summary,
    p_outcome,
    p_difficulty,
    p_estimated_minutes,
    p_visibility,
    actor_id,
    p_completion_rule
  );

  insert into public.learning_event (
    actor_user_id,
    event_type,
    object_type,
    object_id
  )
  values (actor_id, 'course_created', 'learning_course', course_id::text);

  return course_id;
end;
$$;

create or replace function public.learning_course_publication_blockers(
  p_course_id uuid
)
returns text[]
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select array_remove(array[
    case when course.owner_user_id is null then 'Assign a course owner.' end,
    case when course.reviewer_user_id is null then 'Assign a reviewer.' end,
    case when btrim(course.outcome) = '' then 'Define the learner outcome.' end,
    case when not exists (
      select 1 from public.learning_course_section section
      where section.course_id = course.id
    ) then 'Add at least one module.' end,
    case when not exists (
      select 1
      from public.learning_course_section section
      join public.learning_course_item item on item.section_id = section.id
      where section.course_id = course.id
    ) then 'Add at least one learning item.' end,
    case when exists (
      select 1
      from public.learning_course_section section
      join public.learning_course_item course_item on course_item.section_id = section.id
      join public.knowledge_content_item content on content.id = course_item.content_item_id
      where section.course_id = course.id
        and content.lifecycle_status <> 'published'
    ) then 'Publish or replace every draft and archived learning item.' end
  ], null)
  from public.learning_course course
  where course.id = p_course_id;
$$;

create or replace function public.publish_learning_course(p_course_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  blockers text[];
  actor_id uuid := auth.uid();
begin
  if actor_id is null or not public.current_is_app_admin() then
    raise exception
      using
        errcode = '42501',
        message = 'Only a learning administrator can publish a course.';
  end if;

  select public.learning_course_publication_blockers(p_course_id)
  into blockers;

  if blockers is null then
    raise exception
      using
        errcode = 'P0002',
        message = format('Course "%s" does not exist.', p_course_id);
  end if;

  if cardinality(blockers) > 0 then
    raise exception
      using
        errcode = '23514',
        message = 'Course publication is blocked.',
        detail = array_to_string(blockers, ' '),
        hint = 'Resolve every listed blocker in Content Studio, then publish again.';
  end if;

  update public.learning_course
  set
    lifecycle_status = 'published',
    published_at = now()
  where id = p_course_id;

  insert into public.learning_event (
    actor_user_id,
    event_type,
    object_type,
    object_id
  )
  values (actor_id, 'course_published', 'learning_course', p_course_id::text);

  return p_course_id;
end;
$$;

create or replace function public.materialize_learning_assignment()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  learner_count integer;
  course_count integer;
begin
  if not new.active then
    return new;
  end if;

  create temporary table if not exists pg_temp.assignment_learners (
    learner_id uuid primary key
  ) on commit drop;
  truncate table pg_temp.assignment_learners;

  if new.target_type = 'user' then
    insert into pg_temp.assignment_learners
    select profile.id
    from public.user_profiles profile
    where profile.id = new.target_user_id
      and profile.is_active;
  elsif new.target_type = 'all' then
    insert into pg_temp.assignment_learners
    select profile.id
    from public.user_profiles profile
    where profile.is_active;
  elsif new.target_type = 'role' then
    insert into pg_temp.assignment_learners
    select profile.id
    from public.user_profiles profile
    join public.training_role role on role.id = new.target_role_id
    where profile.is_active
      and profile.role is not null
      and (
        lower(btrim(profile.role)) = lower(role.name)
        or lower(btrim(profile.role)) = lower(role.slug)
        or exists (
          select 1
          from unnest(role.aliases) alias
          where lower(btrim(alias)) = lower(btrim(profile.role))
        )
      );
  elsif new.target_type = 'business_area' then
    insert into pg_temp.assignment_learners
    select distinct profile.id
    from public.user_profiles profile
    join public.users_auth identity on identity.auth_user_id = profile.id
    join public.business_area_memberships membership
      on membership.person_id = identity.person_id
    where profile.is_active
      and membership.status = 'active'
      and membership.business_area_id = new.target_business_area_id;
  end if;

  select count(*) into learner_count from pg_temp.assignment_learners;
  if learner_count = 0 then
    raise exception
      using
        errcode = '23514',
        message = format(
          'Assignment target "%s" did not resolve to any active employees.',
          new.target_type
        ),
        hint = 'Correct the user, role aliases, or business-area membership before assigning.';
  end if;

  create temporary table if not exists pg_temp.assignment_courses (
    course_id uuid primary key
  ) on commit drop;
  truncate table pg_temp.assignment_courses;

  if new.assignment_kind = 'course' then
    insert into pg_temp.assignment_courses values (new.course_id);
  else
    insert into pg_temp.assignment_courses
    select program_course.course_id
    from public.learning_program_course program_course
    where program_course.program_id = new.program_id;
  end if;

  select count(*) into course_count from pg_temp.assignment_courses;
  if course_count = 0 then
    raise exception
      using
        errcode = '23514',
        message = 'Assignment contains no courses.',
        hint = 'Add at least one course to the program before assigning it.';
  end if;

  if exists (
    select 1
    from pg_temp.assignment_courses assignment_course
    join public.learning_course course on course.id = assignment_course.course_id
    where course.lifecycle_status <> 'published'
  ) then
    raise exception
      using
        errcode = '23514',
        message = 'Assignment contains an unpublished course.',
        hint = 'Publish every assigned course before creating the assignment.';
  end if;

  insert into public.learning_enrollment (
    assignment_id,
    course_id,
    learner_id,
    status,
    requirement,
    due_at
  )
  select
    new.id,
    assignment_course.course_id,
    learner.learner_id,
    'assigned',
    new.requirement,
    new.due_at
  from pg_temp.assignment_learners learner
  cross join pg_temp.assignment_courses assignment_course
  on conflict (learner_id, course_id, assignment_id) do update
  set
    requirement = excluded.requirement,
    due_at = excluded.due_at,
    updated_at = now();

  insert into public.learning_event (
    learner_id,
    actor_user_id,
    event_type,
    object_type,
    object_id,
    context
  )
  select
    learner.learner_id,
    new.assigned_by,
    'learning_assigned',
    'learning_assignment',
    new.id::text,
    jsonb_build_object('requirement', new.requirement)
  from pg_temp.assignment_learners learner;

  return new;
end;
$$;

create trigger materialize_learning_assignment_on_insert
  after insert on public.learning_assignment
  for each row execute function public.materialize_learning_assignment();

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
    status = case when status = 'completed' then status else 'in_progress' end,
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
    status = case when course_completed then 'completed' else 'in_progress' end,
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

-- Backfill source identities without copying source bodies.
insert into public.knowledge_content_item (
  slug,
  title,
  summary,
  content_kind,
  lifecycle_status,
  visibility,
  source_type,
  source_id,
  source_url,
  owner_user_id,
  published_at,
  metadata,
  created_at,
  updated_at
)
select
  'guide-' || doc.slug,
  doc.title,
  doc.summary,
  'software_guide',
  case
    when doc.status = 'planned' then 'draft'::public.knowledge_lifecycle_status
    else doc.status::public.knowledge_lifecycle_status
  end,
  case
    when doc.audience = 'admin' then 'leadership'::public.knowledge_visibility
    when doc.audience in ('client', 'subcontractor') then 'customer'::public.knowledge_visibility
    else 'internal'::public.knowledge_visibility
  end,
  'training_doc',
  doc.id::text,
  coalesce(doc.source_route, doc.published_doc_path),
  coalesce(doc.updated_by, doc.created_by),
  case when doc.status = 'published' then coalesce(doc.last_published_at, now()) end,
  jsonb_build_object(
    'qa_status', doc.qa_status,
    'target_collection', doc.target_collection,
    'tool_category', doc.tool_category,
    'tool_module', doc.tool_module
  ),
  doc.created_at,
  doc.updated_at
from public.training_docs doc
on conflict (source_type, source_id) do nothing;

insert into public.knowledge_content_item (
  slug,
  title,
  summary,
  content_kind,
  lifecycle_status,
  visibility,
  source_type,
  source_id,
  source_url,
  owner_user_id,
  reviewer_user_id,
  published_at,
  last_reviewed_at,
  metadata,
  created_at,
  updated_at
)
select
  'resource-' || replace(resource.id::text, '-', ''),
  resource.title,
  resource.description,
  case resource.resource_type
    when 'video' then 'video'::public.knowledge_content_kind
    when 'course' then 'external_course'::public.knowledge_content_kind
    else 'reference'::public.knowledge_content_kind
  end,
  case resource.status
    when 'review' then 'in_review'::public.knowledge_lifecycle_status
    when 'published' then 'published'::public.knowledge_lifecycle_status
    else 'archived'::public.knowledge_lifecycle_status
  end,
  'internal',
  'training_resource',
  resource.id::text,
  resource.url,
  coalesce(resource.updated_by, resource.created_by),
  resource.reviewed_by,
  case when resource.status = 'published' then coalesce(resource.published_at, now()) end,
  resource.reviewed_at,
  jsonb_build_object(
    'provider', resource.provider,
    'level', resource.level,
    'track', resource.track,
    'duration_minutes', resource.duration_minutes,
    'embed_url', resource.embed_url,
    'thumbnail_url', resource.thumbnail_url
  ),
  resource.created_at,
  resource.updated_at
from public.training_resource resource
on conflict (source_type, source_id) do nothing;

insert into public.knowledge_content_topic (content_item_id, topic_id)
select item.id, resource.topic_id
from public.training_resource resource
join public.knowledge_content_item item
  on item.source_type = 'training_resource'
  and item.source_id = resource.id::text
on conflict do nothing;

insert into public.knowledge_content_role (content_item_id, role_id)
select item.id, resource_role.role_id
from public.training_resource_role resource_role
join public.knowledge_content_item item
  on item.source_type = 'training_resource'
  and item.source_id = resource_role.resource_id::text
on conflict do nothing;

insert into public.knowledge_content_item (
  slug,
  title,
  summary,
  content_kind,
  lifecycle_status,
  visibility,
  source_type,
  source_id,
  source_url,
  published_at,
  metadata,
  created_at,
  updated_at
)
select
  'document-' || md5(document.id),
  coalesce(nullif(btrim(document.title), ''), nullif(btrim(document.description), ''), 'Untitled controlled document'),
  coalesce(document.summary, document.description),
  case
    when lower(coalesce(document.document_type, '')) = 'policy' then 'policy'::public.knowledge_content_kind
    when lower(coalesce(document.document_type, '')) = 'checklist' then 'checklist'::public.knowledge_content_kind
    when lower(coalesce(document.document_type, '')) = 'template' then 'template'::public.knowledge_content_kind
    else 'sop'::public.knowledge_content_kind
  end,
  case
    when document.deleted_at is null then 'published'::public.knowledge_lifecycle_status
    else 'archived'::public.knowledge_lifecycle_status
  end,
  case
    when document.business_area_id is not null then 'business_area'::public.knowledge_visibility
    when lower(coalesce(document.access_level, '')) = 'restricted' then 'leadership'::public.knowledge_visibility
    else 'internal'::public.knowledge_visibility
  end,
  'document',
  document.id,
  coalesce(document.source_web_url, document.url),
  case when document.deleted_at is null then now() end,
  jsonb_build_object(
    'category', document.category,
    'document_type', document.document_type,
    'access_level', document.access_level
  ),
  coalesce(document.created_at at time zone 'UTC', now()),
  now()
from public.document_metadata document
where
  lower(coalesce(document.category, '')) = 'sop'
  or lower(coalesce(document.document_type, '')) in ('sop', 'policy', 'checklist', 'template')
on conflict (source_type, source_id) do nothing;

insert into public.knowledge_content_business_area (
  content_item_id,
  business_area_id
)
select item.id, document.business_area_id
from public.document_metadata document
join public.knowledge_content_item item
  on item.source_type = 'document'
  and item.source_id = document.id
where document.business_area_id is not null
on conflict do nothing;

-- Fire the deferred polymorphic source checks before later ALTER TABLE
-- statements. PostgreSQL rejects ALTER TABLE while a relation has pending
-- trigger events.
set constraints knowledge_content_source_exists immediate;

create view public.knowledge_content_catalog_view
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
      jsonb_build_object('id', topic.id, 'slug', topic.slug, 'name', topic.name)
      order by topic.sort_order, topic.name
    )
    from public.knowledge_content_topic item_topic
    join public.training_topic topic on topic.id = item_topic.topic_id
    where item_topic.content_item_id = item.id
  ), '[]'::jsonb) as topics,
  coalesce((
    select jsonb_agg(
      jsonb_build_object('id', role.id, 'slug', role.slug, 'name', role.name)
      order by role.sort_order, role.name
    )
    from public.knowledge_content_role item_role
    join public.training_role role on role.id = item_role.role_id
    where item_role.content_item_id = item.id
  ), '[]'::jsonb) as roles,
  coalesce((
    select jsonb_agg(
      jsonb_build_object('id', skill.id, 'slug', skill.slug, 'name', skill.name)
      order by skill.sort_order, skill.name
    )
    from public.knowledge_content_skill item_skill
    join public.training_role_skill skill on skill.id = item_skill.skill_id
    where item_skill.content_item_id = item.id
  ), '[]'::jsonb) as skills,
  coalesce((
    select jsonb_agg(
      jsonb_build_object('id', area.id, 'key', area.key, 'name', area.name)
      order by area.name
    )
    from public.knowledge_content_business_area item_area
    join public.business_areas area on area.id = item_area.business_area_id
    where item_area.content_item_id = item.id
  ), '[]'::jsonb) as business_areas
from public.knowledge_content_item item
left join public.user_profiles owner on owner.id = item.owner_user_id
left join public.user_profiles reviewer on reviewer.id = item.reviewer_user_id;

create view public.training_library_view
with (security_invoker = true)
as
select
  catalog.*,
  course.id as course_id,
  course.outcome as course_outcome,
  course.difficulty as course_difficulty,
  course.estimated_minutes as course_estimated_minutes,
  course.completion_rule as course_completion_rule,
  exists (
    select 1
    from public.learning_course course_match
    where course_match.content_item_id = catalog.id
  ) as is_internal_course
from public.knowledge_content_catalog_view catalog
left join public.learning_course course on course.content_item_id = catalog.id
where catalog.lifecycle_status = 'published';

create view public.learner_assignments_view
with (security_invoker = true)
as
select
  enrollment.id as enrollment_id,
  enrollment.learner_id,
  enrollment.assignment_id,
  enrollment.course_id,
  course.slug as course_slug,
  course.title as course_title,
  course.summary as course_summary,
  course.outcome,
  course.estimated_minutes,
  enrollment.status,
  enrollment.requirement,
  enrollment.due_at,
  enrollment.progress_percent,
  enrollment.started_at,
  enrollment.completed_at,
  assignment.reason as assignment_reason,
  enrollment.created_at as assigned_at
from public.learning_enrollment enrollment
join public.learning_course course on course.id = enrollment.course_id
left join public.learning_assignment assignment on assignment.id = enrollment.assignment_id;

create view public.learner_course_progress_view
with (security_invoker = true)
as
select
  enrollment.id as enrollment_id,
  enrollment.learner_id,
  enrollment.course_id,
  course.title as course_title,
  enrollment.status,
  enrollment.progress_percent,
  count(course_item.id) filter (where course_item.required) as required_item_count,
  count(progress.id) filter (
    where course_item.required and progress.status = 'completed'
  ) as completed_required_item_count,
  enrollment.due_at,
  enrollment.started_at,
  enrollment.completed_at
from public.learning_enrollment enrollment
join public.learning_course course on course.id = enrollment.course_id
left join public.learning_course_section section on section.course_id = course.id
left join public.learning_course_item course_item on course_item.section_id = section.id
left join public.learning_item_progress progress
  on progress.enrollment_id = enrollment.id
  and progress.course_item_id = course_item.id
group by enrollment.id, course.id;

create view public.content_governance_exceptions_view
with (security_invoker = true)
as
select
  item.id as content_item_id,
  item.title,
  item.content_kind,
  item.lifecycle_status,
  item.owner_user_id,
  item.reviewer_user_id,
  item.next_review_at,
  array_remove(array[
    case when item.owner_user_id is null then 'Missing owner' end,
    case when item.lifecycle_status in ('in_review', 'approved', 'published')
      and item.reviewer_user_id is null then 'Missing reviewer' end,
    case when item.next_review_at is not null
      and item.next_review_at < now() then 'Review overdue' end,
    case when item.source_url is null
      and item.source_type in ('document', 'training_resource') then 'Missing source URL' end,
    case when item.content_kind = 'software_guide'
      and item.lifecycle_status = 'published'
      and coalesce(item.metadata->>'qa_status', 'not_tested') <> 'passing'
      then 'Published legacy guide needs QA remediation' end
  ], null) as exceptions
from public.knowledge_content_item item
where public.current_is_learning_admin()
  and cardinality(array_remove(array[
    case when item.owner_user_id is null then 'Missing owner' end,
    case when item.lifecycle_status in ('in_review', 'approved', 'published')
      and item.reviewer_user_id is null then 'Missing reviewer' end,
    case when item.next_review_at is not null
      and item.next_review_at < now() then 'Review overdue' end,
    case when item.source_url is null
      and item.source_type in ('document', 'training_resource') then 'Missing source URL' end,
    case when item.content_kind = 'software_guide'
      and item.lifecycle_status = 'published'
      and coalesce(item.metadata->>'qa_status', 'not_tested') <> 'passing'
      then 'Published legacy guide needs QA remediation' end
  ], null)) > 0;

alter table public.knowledge_native_content enable row level security;
alter table public.knowledge_content_item enable row level security;
alter table public.knowledge_content_topic enable row level security;
alter table public.knowledge_content_role enable row level security;
alter table public.knowledge_content_skill enable row level security;
alter table public.knowledge_content_business_area enable row level security;
alter table public.knowledge_content_project enable row level security;
alter table public.learning_program enable row level security;
alter table public.learning_course enable row level security;
alter table public.learning_program_course enable row level security;
alter table public.learning_course_section enable row level security;
alter table public.learning_course_item enable row level security;
alter table public.learning_assignment enable row level security;
alter table public.learning_enrollment enable row level security;
alter table public.learning_item_progress enable row level security;
alter table public.learning_event enable row level security;

create policy knowledge_content_item_select
  on public.knowledge_content_item for select to authenticated
  using (public.can_view_knowledge_content(id));
create policy knowledge_content_item_admin_write
  on public.knowledge_content_item for all to authenticated
  using (public.current_is_app_admin())
  with check (public.current_is_app_admin());

create policy knowledge_native_content_select
  on public.knowledge_native_content for select to authenticated
  using (
    public.current_is_app_admin()
    or exists (
      select 1
      from public.knowledge_content_item item
      where item.source_type = 'native_content'
        and item.source_id = knowledge_native_content.id::text
        and public.can_view_knowledge_content(item.id)
    )
  );
create policy knowledge_native_content_admin_write
  on public.knowledge_native_content for all to authenticated
  using (public.current_is_app_admin())
  with check (public.current_is_app_admin());

create policy knowledge_content_topic_select
  on public.knowledge_content_topic for select to authenticated
  using (public.can_view_knowledge_content(content_item_id));
create policy knowledge_content_topic_admin_write
  on public.knowledge_content_topic for all to authenticated
  using (public.current_is_app_admin())
  with check (public.current_is_app_admin());
create policy knowledge_content_role_select
  on public.knowledge_content_role for select to authenticated
  using (public.can_view_knowledge_content(content_item_id));
create policy knowledge_content_role_admin_write
  on public.knowledge_content_role for all to authenticated
  using (public.current_is_app_admin())
  with check (public.current_is_app_admin());
create policy knowledge_content_skill_select
  on public.knowledge_content_skill for select to authenticated
  using (public.can_view_knowledge_content(content_item_id));
create policy knowledge_content_skill_admin_write
  on public.knowledge_content_skill for all to authenticated
  using (public.current_is_app_admin())
  with check (public.current_is_app_admin());
create policy knowledge_content_business_area_select
  on public.knowledge_content_business_area for select to authenticated
  using (public.can_view_knowledge_content(content_item_id));
create policy knowledge_content_business_area_admin_write
  on public.knowledge_content_business_area for all to authenticated
  using (public.current_is_app_admin())
  with check (public.current_is_app_admin());
create policy knowledge_content_project_select
  on public.knowledge_content_project for select to authenticated
  using (public.can_view_knowledge_content(content_item_id));
create policy knowledge_content_project_admin_write
  on public.knowledge_content_project for all to authenticated
  using (public.current_is_app_admin())
  with check (public.current_is_app_admin());

create policy learning_program_select
  on public.learning_program for select to authenticated
  using (lifecycle_status = 'published' or public.current_is_app_admin());
create policy learning_program_admin_write
  on public.learning_program for all to authenticated
  using (public.current_is_app_admin())
  with check (public.current_is_app_admin());
create policy learning_course_select
  on public.learning_course for select to authenticated
  using (
    public.current_is_app_admin()
    or (
      lifecycle_status = 'published'
      and public.can_view_knowledge_content(content_item_id)
    )
  );
create policy learning_course_admin_write
  on public.learning_course for all to authenticated
  using (public.current_is_app_admin())
  with check (public.current_is_app_admin());
create policy learning_program_course_select
  on public.learning_program_course for select to authenticated
  using (
    public.current_is_app_admin()
    or exists (
      select 1 from public.learning_program program
      where program.id = learning_program_course.program_id
        and program.lifecycle_status = 'published'
    )
  );
create policy learning_program_course_admin_write
  on public.learning_program_course for all to authenticated
  using (public.current_is_app_admin())
  with check (public.current_is_app_admin());
create policy learning_course_section_select
  on public.learning_course_section for select to authenticated
  using (
    public.current_is_app_admin()
    or exists (
      select 1 from public.learning_course course
      where course.id = learning_course_section.course_id
        and course.lifecycle_status = 'published'
        and public.can_view_knowledge_content(course.content_item_id)
    )
  );
create policy learning_course_section_admin_write
  on public.learning_course_section for all to authenticated
  using (public.current_is_app_admin())
  with check (public.current_is_app_admin());
create policy learning_course_item_select
  on public.learning_course_item for select to authenticated
  using (
    public.current_is_app_admin()
    or exists (
      select 1
      from public.learning_course_section section
      join public.learning_course course on course.id = section.course_id
      where section.id = learning_course_item.section_id
        and course.lifecycle_status = 'published'
        and public.can_view_knowledge_content(course.content_item_id)
    )
  );
create policy learning_course_item_admin_write
  on public.learning_course_item for all to authenticated
  using (public.current_is_app_admin())
  with check (public.current_is_app_admin());

create policy learning_assignment_select
  on public.learning_assignment for select to authenticated
  using (public.learning_assignment_targets_current_user(id));
create policy learning_assignment_admin_write
  on public.learning_assignment for all to authenticated
  using (public.current_is_app_admin())
  with check (public.current_is_app_admin());
create policy learning_enrollment_select
  on public.learning_enrollment for select to authenticated
  using (learner_id = (select auth.uid()) or public.current_is_learning_admin());
create policy learning_enrollment_admin_write
  on public.learning_enrollment for all to authenticated
  using (public.current_is_app_admin())
  with check (public.current_is_app_admin());
create policy learning_item_progress_select
  on public.learning_item_progress for select to authenticated
  using (
    public.current_is_learning_admin()
    or exists (
      select 1
      from public.learning_enrollment enrollment
      where enrollment.id = learning_item_progress.enrollment_id
        and enrollment.learner_id = (select auth.uid())
    )
  );
create policy learning_item_progress_admin_write
  on public.learning_item_progress for all to authenticated
  using (public.current_is_app_admin())
  with check (public.current_is_app_admin());
create policy learning_event_select
  on public.learning_event for select to authenticated
  using (
    learner_id = (select auth.uid())
    or actor_user_id = (select auth.uid())
    or public.current_is_learning_admin()
  );

grant select, insert, update, delete
  on public.knowledge_native_content,
    public.knowledge_content_item,
    public.knowledge_content_topic,
    public.knowledge_content_role,
    public.knowledge_content_skill,
    public.knowledge_content_business_area,
    public.knowledge_content_project,
    public.learning_program,
    public.learning_course,
    public.learning_program_course,
    public.learning_course_section,
    public.learning_course_item,
    public.learning_assignment,
    public.learning_enrollment,
    public.learning_item_progress
  to authenticated;
grant select on public.learning_event to authenticated;
grant select on public.knowledge_content_catalog_view,
  public.training_library_view,
  public.learner_assignments_view,
  public.learner_course_progress_view,
  public.content_governance_exceptions_view
  to authenticated;

grant all on public.knowledge_native_content,
  public.knowledge_content_item,
  public.knowledge_content_topic,
  public.knowledge_content_role,
  public.knowledge_content_skill,
  public.knowledge_content_business_area,
  public.knowledge_content_project,
  public.learning_program,
  public.learning_course,
  public.learning_program_course,
  public.learning_course_section,
  public.learning_course_item,
  public.learning_assignment,
  public.learning_enrollment,
  public.learning_item_progress,
  public.learning_event
  to service_role;
grant usage, select on sequence public.learning_event_id_seq to service_role;
grant select on public.knowledge_content_catalog_view,
  public.training_library_view,
  public.learner_assignments_view,
  public.learner_course_progress_view,
  public.content_governance_exceptions_view
  to service_role;

revoke all on function public.current_is_learning_admin() from public, anon;
revoke all on function public.can_view_knowledge_content(uuid) from public, anon;
revoke all on function public.learning_assignment_targets_current_user(uuid) from public, anon;
revoke all on function public.create_learning_course(
  text,
  text,
  text,
  text,
  text,
  integer,
  public.knowledge_visibility,
  public.learning_completion_rule
) from public, anon;
revoke all on function public.learning_course_publication_blockers(uuid) from public, anon;
revoke all on function public.publish_learning_course(uuid) from public, anon;
revoke all on function public.start_learning_course(uuid, uuid) from public, anon;
revoke all on function public.complete_learning_item(uuid, uuid, numeric, jsonb) from public, anon;

grant execute on function public.current_is_learning_admin() to authenticated, service_role;
grant execute on function public.can_view_knowledge_content(uuid) to authenticated, service_role;
grant execute on function public.learning_assignment_targets_current_user(uuid)
  to authenticated, service_role;
grant execute on function public.create_learning_course(
  text,
  text,
  text,
  text,
  text,
  integer,
  public.knowledge_visibility,
  public.learning_completion_rule
) to authenticated, service_role;
grant execute on function public.learning_course_publication_blockers(uuid)
  to authenticated, service_role;
grant execute on function public.publish_learning_course(uuid)
  to authenticated, service_role;
grant execute on function public.start_learning_course(uuid, uuid)
  to authenticated, service_role;
grant execute on function public.complete_learning_item(uuid, uuid, numeric, jsonb)
  to authenticated, service_role;

comment on table public.knowledge_content_item is
  'Shared governed identity for reusable knowledge. Authoritative bodies remain in source-owned tables.';
comment on table public.knowledge_native_content is
  'Database-native internal content for handbooks, articles, and assessments that have no separate authoritative source.';
comment on table public.learning_course is
  'Alleato-owned outcome-based learning sequence. Externally hosted courses remain atomic catalog resources.';
comment on table public.learning_course_item is
  'Ordered reference to reusable catalog content. It never copies the authoritative source body.';
comment on table public.learning_assignment is
  'Required or recommended learning targeted to a user, canonical role, business area, or all active employees.';
comment on table public.learning_event is
  'Append-only learning audit stream written by trusted database functions and triggers.';

commit;
