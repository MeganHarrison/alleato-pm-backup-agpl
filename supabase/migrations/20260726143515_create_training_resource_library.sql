-- Learner-facing training resource library.
--
-- This is intentionally separate from public.training_docs, which remains the
-- internal workflow-manual authoring and QA control plane.

begin;

create type public.training_resource_type as enum (
  'video',
  'course',
  'doc'
);

create type public.training_resource_level as enum (
  'intro',
  'deep-dive'
);

create type public.training_resource_status as enum (
  'review',
  'published',
  'archived'
);

-- Track vocabulary is supplied by the source library and may grow without a
-- schema migration. A domain still enforces one normalized contract at every
-- write boundary.
create domain public.training_resource_track as text
  check (value ~ '^[a-z0-9]+([_-][a-z0-9]+)*$');

create table public.training_role (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  slug text not null,
  name text not null,
  description text null,
  aliases text[] not null default '{}'::text[],
  sort_order integer not null default 0,
  active boolean not null default true,
  constraint training_role_slug_unique unique (slug),
  constraint training_role_name_unique unique (name),
  constraint training_role_slug_format_check
    check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  constraint training_role_name_not_blank_check
    check (btrim(name) <> ''),
  constraint training_role_aliases_no_blank_check
    check (
      cardinality(aliases) = 0
      or (
        array_position(aliases, null) is null
        and array_to_string(aliases, E'\n')
          !~ '(^|\n)[[:space:]]*($|\n)'
      )
    )
);

create table public.training_topic (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  slug text not null,
  name text not null,
  description text null,
  sort_order integer not null default 0,
  active boolean not null default true,
  constraint training_topic_slug_unique unique (slug),
  constraint training_topic_name_unique unique (name),
  constraint training_topic_slug_format_check
    check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  constraint training_topic_name_not_blank_check
    check (btrim(name) <> '')
);

create table public.training_resource (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid null references public.user_profiles(id) on delete set null,
  updated_by uuid null references public.user_profiles(id) on delete set null,
  reviewed_by uuid null references public.user_profiles(id) on delete set null,
  published_by uuid null references public.user_profiles(id) on delete set null,
  topic_id uuid not null references public.training_topic(id) on delete restrict,
  title text not null,
  description text null,
  url text not null,
  embed_url text null,
  thumbnail_url text null,
  provider text null,
  resource_type public.training_resource_type not null,
  level public.training_resource_level not null,
  track public.training_resource_track not null,
  status public.training_resource_status not null default 'review',
  cost text not null default 'free',
  duration_minutes integer null,
  source_attribution text null,
  reviewed_at timestamptz null,
  published_at timestamptz null,
  metadata jsonb not null default '{}'::jsonb,
  search_vector tsvector generated always as (
    to_tsvector(
      'english',
      coalesce(title, '') || ' ' ||
      coalesce(description, '') || ' ' ||
      coalesce(provider, '') || ' ' ||
      coalesce(source_attribution, '')
    )
  ) stored,
  constraint training_resource_url_unique unique (url),
  constraint training_resource_title_not_blank_check
    check (btrim(title) <> ''),
  constraint training_resource_url_http_check
    check (url ~* '^https?://'),
  constraint training_resource_embed_url_http_check
    check (embed_url is null or embed_url ~* '^https?://'),
  constraint training_resource_thumbnail_url_http_check
    check (thumbnail_url is null or thumbnail_url ~* '^https?://'),
  constraint training_resource_cost_free_only_check
    check (cost = 'free'),
  constraint training_resource_duration_positive_check
    check (duration_minutes is null or duration_minutes > 0),
  constraint training_resource_metadata_object_check
    check (jsonb_typeof(metadata) = 'object'),
  constraint training_resource_publish_audit_check
    check (
      status <> 'published'
      or published_at is not null
    ),
  constraint training_resource_review_audit_check
    check (
      reviewed_by is null
      or reviewed_at is not null
    )
);

create table public.training_resource_role (
  resource_id uuid not null
    references public.training_resource(id) on delete cascade,
  role_id uuid not null
    references public.training_role(id) on delete cascade,
  created_at timestamptz not null default now(),
  created_by uuid null references public.user_profiles(id) on delete set null,
  primary key (resource_id, role_id)
);

create index idx_training_role_active_sort
  on public.training_role (active, sort_order, name);

create index idx_training_topic_active_sort
  on public.training_topic (active, sort_order, name);

create index idx_training_resource_library
  on public.training_resource (
    status,
    track,
    resource_type,
    level,
    topic_id,
    created_at desc
  );

create index idx_training_resource_topic
  on public.training_resource (topic_id, status, created_at desc);

create index idx_training_resource_search
  on public.training_resource using gin (search_vector);

create index idx_training_resource_role_role
  on public.training_resource_role (role_id, resource_id);

-- The automation boundary is a single atomic RPC. It deliberately exposes no
-- status, cost, existing resource id, or standalone role-link write, so a
-- service-role job can create only a new free review candidate and tags that
-- belong to that candidate.
create function public.create_training_review_candidate(
  p_topic_id uuid,
  p_title text,
  p_url text,
  p_resource_type public.training_resource_type,
  p_level public.training_resource_level,
  p_track public.training_resource_track,
  p_role_ids uuid[] default '{}'::uuid[],
  p_description text default null,
  p_embed_url text default null,
  p_thumbnail_url text default null,
  p_provider text default null,
  p_duration_minutes integer default null,
  p_source_attribution text default null,
  p_metadata jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  candidate_id uuid;
begin
  if not exists (
    select 1
    from public.training_topic topic
    where topic.id = p_topic_id
      and topic.active
  ) then
    raise exception
      using
        errcode = '23503',
        message = 'Training review candidate requires an active topic.';
  end if;

  if exists (
    select 1
    from unnest(coalesce(p_role_ids, '{}'::uuid[])) requested_role_id
    left join public.training_role role
      on role.id = requested_role_id
      and role.active
    where role.id is null
  ) then
    raise exception
      using
        errcode = '23503',
        message = 'Training review candidate contains an unknown or inactive role.';
  end if;

  insert into public.training_resource (
    topic_id,
    title,
    description,
    url,
    embed_url,
    thumbnail_url,
    provider,
    resource_type,
    level,
    track,
    status,
    cost,
    duration_minutes,
    source_attribution,
    metadata
  )
  values (
    p_topic_id,
    p_title,
    p_description,
    p_url,
    p_embed_url,
    p_thumbnail_url,
    p_provider,
    p_resource_type,
    p_level,
    p_track,
    'review',
    'free',
    p_duration_minutes,
    p_source_attribution,
    coalesce(p_metadata, '{}'::jsonb)
  )
  returning id into candidate_id;

  insert into public.training_resource_role (resource_id, role_id)
  select candidate_id, requested_role_id
  from (
    select distinct unnest(coalesce(p_role_ids, '{}'::uuid[]))
      as requested_role_id
  ) requested_roles;

  return candidate_id;
end;
$$;

drop trigger if exists set_training_role_updated_at
  on public.training_role;
create trigger set_training_role_updated_at
  before update on public.training_role
  for each row
  execute function public.update_updated_at_column();

drop trigger if exists set_training_topic_updated_at
  on public.training_topic;
create trigger set_training_topic_updated_at
  before update on public.training_topic
  for each row
  execute function public.update_updated_at_column();

drop trigger if exists set_training_resource_updated_at
  on public.training_resource;
create trigger set_training_resource_updated_at
  before update on public.training_resource
  for each row
  execute function public.update_updated_at_column();

alter table public.training_role enable row level security;
alter table public.training_topic enable row level security;
alter table public.training_resource enable row level security;
alter table public.training_resource_role enable row level security;

revoke all on table public.training_role from anon, service_role;
revoke all on table public.training_topic from anon, service_role;
revoke all on table public.training_resource from anon, service_role;
revoke all on table public.training_resource_role from anon, service_role;

grant select, insert, update, delete
  on table public.training_role,
    public.training_topic,
    public.training_resource,
    public.training_resource_role
  to authenticated;

grant usage
  on type public.training_resource_type,
    public.training_resource_level,
    public.training_resource_status,
    public.training_resource_track
  to authenticated, service_role;

grant select
  on table public.training_role,
    public.training_topic,
    public.training_resource,
    public.training_resource_role
  to service_role;

revoke all
  on function public.create_training_review_candidate(
    uuid,
    text,
    text,
    public.training_resource_type,
    public.training_resource_level,
    public.training_resource_track,
    uuid[],
    text,
    text,
    text,
    text,
    integer,
    text,
    jsonb
  )
  from public, anon, authenticated;

grant execute
  on function public.create_training_review_candidate(
    uuid,
    text,
    text,
    public.training_resource_type,
    public.training_resource_level,
    public.training_resource_track,
    uuid[],
    text,
    text,
    text,
    text,
    integer,
    text,
    jsonb
  )
  to service_role;

drop policy if exists training_role_select_authenticated
  on public.training_role;
create policy training_role_select_authenticated
  on public.training_role
  for select
  to authenticated
  using (active or public.current_is_app_admin());

drop policy if exists training_role_admin_write
  on public.training_role;
create policy training_role_admin_write
  on public.training_role
  for all
  to authenticated
  using (public.current_is_app_admin())
  with check (public.current_is_app_admin());

drop policy if exists training_topic_select_authenticated
  on public.training_topic;
create policy training_topic_select_authenticated
  on public.training_topic
  for select
  to authenticated
  using (active or public.current_is_app_admin());

drop policy if exists training_topic_admin_write
  on public.training_topic;
create policy training_topic_admin_write
  on public.training_topic
  for all
  to authenticated
  using (public.current_is_app_admin())
  with check (public.current_is_app_admin());

drop policy if exists training_resource_select_authenticated
  on public.training_resource;
create policy training_resource_select_authenticated
  on public.training_resource
  for select
  to authenticated
  using (
    status = 'published'
    or public.current_is_app_admin()
  );

drop policy if exists training_resource_admin_write
  on public.training_resource;
create policy training_resource_admin_write
  on public.training_resource
  for all
  to authenticated
  using (public.current_is_app_admin())
  with check (public.current_is_app_admin());

drop policy if exists training_resource_role_select_authenticated
  on public.training_resource_role;
create policy training_resource_role_select_authenticated
  on public.training_resource_role
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.training_resource resource
      where resource.id = training_resource_role.resource_id
        and (
          resource.status = 'published'
          or public.current_is_app_admin()
        )
    )
  );

drop policy if exists training_resource_role_admin_write
  on public.training_resource_role;
create policy training_resource_role_admin_write
  on public.training_resource_role
  for all
  to authenticated
  using (public.current_is_app_admin())
  with check (public.current_is_app_admin());

comment on type public.training_resource_type is
  'Supported learner-facing resource formats.';

comment on type public.training_resource_level is
  'Training level used by the learner-facing depth filter.';

comment on type public.training_resource_status is
  'Review lifecycle. Only published rows are visible to ordinary authenticated users.';

comment on domain public.training_resource_track is
  'Normalized source-owned track slug. Open vocabulary avoids a schema migration for every new vetted track.';

comment on table public.training_role is
  'Role taxonomy for learner training recommendations and manual filtering.';

comment on table public.training_topic is
  'Topic taxonomy for the learner-facing training resource library.';

comment on table public.training_resource is
  'Free-only vetted external training resources. Automated discovery inserts review rows; admins publish.';

comment on table public.training_resource_role is
  'Many-to-many role targeting for training resources.';

comment on function public.create_training_review_candidate(
  uuid,
  text,
  text,
  public.training_resource_type,
  public.training_resource_level,
  public.training_resource_track,
  uuid[],
  text,
  text,
  text,
  text,
  integer,
  text,
  jsonb
) is
  'Atomic service-role boundary for inserting one free review candidate and only its own role tags.';

notify pgrst, 'reload schema';

commit;
