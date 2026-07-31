begin;

-- Engagement analytics intentionally separates stable learning identity and
-- learner state from the learner catalog (`training_resource`) and training
-- authoring (`training_docs`). A training resource can be revised or removed
-- without erasing the historical learning record it previously represented.
create table public.learning_contents (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  slug text not null unique,
  title text not null,
  source text not null,
  canonical_url text not null unique,
  playback_url text not null,
  provider text not null,
  training_resource_id uuid unique null
    references public.training_resource(id) on delete set null,
  is_published boolean not null default true,
  metadata jsonb not null default '{}'::jsonb,
  constraint learning_contents_slug_format_check
    check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  constraint learning_contents_title_not_blank_check
    check (btrim(title) <> ''),
  constraint learning_contents_source_check
    check (source in ('training_resource', 'docs')),
  constraint learning_contents_provider_check
    check (provider in ('html5', 'youtube', 'vimeo', 'loom')),
  constraint learning_contents_canonical_url_http_check
    check (canonical_url ~* '^https?://'),
  constraint learning_contents_playback_url_http_check
    check (playback_url ~* '^https?://'),
  constraint learning_contents_metadata_object_check
    check (jsonb_typeof(metadata) = 'object')
);

create index learning_contents_published_source_idx
  on public.learning_contents (is_published, source, created_at desc);

-- One row is the current authoritative learner state for one person/content
-- pair. The event table below retains the attributable milestones that led to
-- it without turning the training catalog into a progress table.
create table public.learning_progress (
  content_id uuid not null
    references public.learning_contents(id) on delete cascade,
  user_id uuid not null
    references public.user_profiles(id) on delete cascade,
  started_at timestamptz not null default now(),
  last_viewed_at timestamptz not null default now(),
  highest_checkpoint smallint not null default 0,
  completed_at timestamptz null,
  watch_seconds integer not null default 0,
  last_position_seconds integer not null default 0,
  primary key (content_id, user_id),
  constraint learning_progress_checkpoint_check
    check (highest_checkpoint in (0, 25, 50, 75, 90)),
  constraint learning_progress_watch_seconds_nonnegative_check
    check (watch_seconds >= 0),
  constraint learning_progress_position_nonnegative_check
    check (last_position_seconds >= 0),
  constraint learning_progress_completion_checkpoint_check
    check (completed_at is null or highest_checkpoint = 90)
);

create index learning_progress_user_last_viewed_idx
  on public.learning_progress (user_id, last_viewed_at desc);
create index learning_progress_content_last_viewed_idx
  on public.learning_progress (content_id, last_viewed_at desc);

-- The append-only milestone receipt is deliberately small: no player payload,
-- raw URL, search query, IP address, or user agent is retained. The API
-- provides an idempotency key per browser session and milestone so retries do
-- not inflate completion counts.
create table public.learning_progress_events (
  id uuid primary key default gen_random_uuid(),
  occurred_at timestamptz not null default now(),
  content_id uuid not null
    references public.learning_contents(id) on delete cascade,
  user_id uuid not null
    references public.user_profiles(id) on delete cascade,
  app_session_id uuid null,
  event_type text not null,
  checkpoint smallint null,
  position_seconds integer not null default 0,
  watch_seconds integer not null default 0,
  idempotency_key text not null unique,
  constraint learning_progress_events_type_check
    check (event_type in ('started', 'checkpoint', 'completed')),
  constraint learning_progress_events_checkpoint_check
    check (
      (event_type = 'started' and checkpoint is null)
      or (event_type = 'checkpoint' and checkpoint in (25, 50, 75))
      or (event_type = 'completed' and checkpoint = 90)
    ),
  constraint learning_progress_events_position_nonnegative_check
    check (position_seconds >= 0),
  constraint learning_progress_events_watch_seconds_nonnegative_check
    check (watch_seconds >= 0),
  constraint learning_progress_events_idempotency_not_blank_check
    check (btrim(idempotency_key) <> '')
);

create index learning_progress_events_user_occurred_idx
  on public.learning_progress_events (user_id, occurred_at desc);
create index learning_progress_events_content_occurred_idx
  on public.learning_progress_events (content_id, occurred_at desc);

-- A session has no page-level event stream. It proves an authenticated person
-- entered and remained active in the product while retaining only a normalized
-- route family for debugging and reporting.
create table public.app_usage_sessions (
  id uuid primary key,
  user_id uuid not null
    references public.user_profiles(id) on delete cascade,
  started_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  entry_surface text not null,
  constraint app_usage_sessions_entry_surface_check
    check (entry_surface in ('admin', 'main', 'training', 'other')),
  constraint app_usage_sessions_last_seen_after_start_check
    check (last_seen_at >= started_at)
);

create index app_usage_sessions_user_last_seen_idx
  on public.app_usage_sessions (user_id, last_seen_at desc);
create index app_usage_sessions_last_seen_idx
  on public.app_usage_sessions (last_seen_at desc);

create or replace function public.set_learning_contents_updated_at()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_learning_contents_updated_at on public.learning_contents;
create trigger set_learning_contents_updated_at
  before update on public.learning_contents
  for each row execute function public.set_learning_contents_updated_at();

alter table public.learning_contents enable row level security;
alter table public.learning_progress enable row level security;
alter table public.learning_progress_events enable row level security;
alter table public.app_usage_sessions enable row level security;

revoke all on table public.learning_contents,
  public.learning_progress,
  public.learning_progress_events,
  public.app_usage_sessions
  from anon, authenticated;

grant select on table public.learning_contents,
  public.learning_progress,
  public.learning_progress_events,
  public.app_usage_sessions
  to authenticated;

grant select, insert, update, delete on table public.learning_contents,
  public.learning_progress,
  public.learning_progress_events,
  public.app_usage_sessions
  to service_role;

create policy learning_contents_select_authenticated
  on public.learning_contents
  for select to authenticated
  using (is_published or public.current_is_app_admin());

create policy learning_progress_select_owner_or_admin
  on public.learning_progress
  for select to authenticated
  using (user_id = auth.uid() or public.current_is_app_admin());

create policy learning_progress_events_select_owner_or_admin
  on public.learning_progress_events
  for select to authenticated
  using (user_id = auth.uid() or public.current_is_app_admin());

create policy app_usage_sessions_select_owner_or_admin
  on public.app_usage_sessions
  for select to authenticated
  using (user_id = auth.uid() or public.current_is_app_admin());

-- The two currently published Mintlify walkthrough videos remain hosted and
-- maintained by the docs site. These records only provide a stable, authenticated
-- Alleato lesson identity and playback source for attributable learner progress.
insert into public.learning_contents (
  slug,
  title,
  source,
  canonical_url,
  playback_url,
  provider,
  metadata
)
values
  (
    'create-prime-contract-walkthrough',
    'Create a prime contract walkthrough',
    'docs',
    'https://docs.alleatogroup.com/prime-contracts/create-a-prime-contract',
    'https://docs.alleatogroup.com/images/help/training-docs/create-a-prime-contract/create-a-prime-contract.mp4',
    'html5',
    jsonb_build_object('docs_path', '/prime-contracts/create-a-prime-contract')
  ),
  (
    'create-owner-invoice-walkthrough',
    'Create an owner invoice walkthrough',
    'docs',
    'https://docs.alleatogroup.com/invoicing/create-an-owner-invoice',
    'https://docs.alleatogroup.com/images/help/training-docs/create-an-owner-invoice/session.webm',
    'html5',
    jsonb_build_object('docs_path', '/invoicing/create-an-owner-invoice')
  )
on conflict (slug) do update
set
  title = excluded.title,
  source = excluded.source,
  canonical_url = excluded.canonical_url,
  playback_url = excluded.playback_url,
  provider = excluded.provider,
  metadata = excluded.metadata,
  is_published = true;

comment on table public.learning_contents is
  'Stable identity registry for learner content. Catalog and training authoring remain separately owned.';
comment on table public.learning_progress is
  'Current per-user learning state, updated only by the guarded application API.';
comment on table public.learning_progress_events is
  'Privacy-limited attributable training milestones, idempotent per session and event.';
comment on table public.app_usage_sessions is
  'Privacy-limited authenticated product-session receipts, not a page-view stream.';

notify pgrst, 'reload schema';

commit;
