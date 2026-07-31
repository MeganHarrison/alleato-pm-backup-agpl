-- Phase 2 Entity-Relationship Link Tables
-- Creates 8 Tier 1 typed join tables for the core construction PM entity pairs.
--
-- Design decisions:
--   - PK type per entity verified against database.types.ts (see PHASE-2-DESIGN.md)
--   - project_documents and project_photos use bigint PKs (not uuid)
--   - rfis, submittals, drawings, punch_items, observations, daily_logs, change_events use uuid PKs
--   - link_type uses a text CHECK constraint (not a Postgres enum) for extensibility
--   - Every table: RLS enabled, 3 policies (select/insert/delete), indexes on both FKs + project_id
--
-- Tables created:
--   1. documents_rfis_links
--   2. documents_submittals_links
--   3. change_events_documents_links
--   4. project_photos_punch_items_links
--   5. observations_project_photos_links
--   6. daily_logs_project_photos_links
--   7. drawings_rfis_links
--   8. rfis_submittals_links
--
-- Rollback: DROP TABLE with CASCADE removes all dependent indexes and policies.

set statement_timeout = 0;
set lock_timeout = '5min';

begin;

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. documents_rfis_links
--    project_documents (bigint) <-> rfis (uuid)
--    Use case: attach PDF specs/RFI responses to RFI records
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists public.documents_rfis_links (
  id                  uuid        primary key default gen_random_uuid(),
  project_document_id bigint      not null references public.project_documents(id) on delete cascade,
  rfi_id              uuid        not null references public.rfis(id) on delete cascade,
  project_id          integer     not null references public.projects(id) on delete cascade,
  link_type           text        not null default 'related'
                                  check (link_type in ('related','attachment','reference','supersedes','causes','blocks')),
  note                text,
  created_at          timestamptz not null default now(),
  created_by          uuid        references auth.users(id),
  constraint documents_rfis_links_unique unique (project_document_id, rfi_id, link_type)
);

comment on table public.documents_rfis_links is
  'Typed join table: project_documents <-> rfis. Use link_type=attachment for supporting docs, reference for spec sheets cited in the RFI.';

alter table public.documents_rfis_links enable row level security;

create policy "documents_rfis_links_select" on public.documents_rfis_links
  for select to authenticated
  using (project_id in (select id from public.projects));

create policy "documents_rfis_links_insert" on public.documents_rfis_links
  for insert to authenticated
  with check (
    project_id in (select id from public.projects)
    and created_by = (select auth.uid())
  );

create policy "documents_rfis_links_delete" on public.documents_rfis_links
  for delete to authenticated
  using (created_by = (select auth.uid()));

create index idx_documents_rfis_links_document  on public.documents_rfis_links(project_document_id);
create index idx_documents_rfis_links_rfi        on public.documents_rfis_links(rfi_id);
create index idx_documents_rfis_links_project    on public.documents_rfis_links(project_id);


-- ─────────────────────────────────────────────────────────────────────────────
-- 2. documents_submittals_links
--    project_documents (bigint) <-> submittals (uuid)
--    Use case: attach shop drawings, cut sheets to submittal records
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists public.documents_submittals_links (
  id                  uuid        primary key default gen_random_uuid(),
  project_document_id bigint      not null references public.project_documents(id) on delete cascade,
  submittal_id        uuid        not null references public.submittals(id) on delete cascade,
  project_id          integer     not null references public.projects(id) on delete cascade,
  link_type           text        not null default 'attachment'
                                  check (link_type in ('related','attachment','reference','supersedes','causes','blocks')),
  note                text,
  created_at          timestamptz not null default now(),
  created_by          uuid        references auth.users(id),
  constraint documents_submittals_links_unique unique (project_document_id, submittal_id, link_type)
);

comment on table public.documents_submittals_links is
  'Typed join table: project_documents <-> submittals. Default link_type=attachment because documents are almost always submitted as attachments.';

alter table public.documents_submittals_links enable row level security;

create policy "documents_submittals_links_select" on public.documents_submittals_links
  for select to authenticated
  using (project_id in (select id from public.projects));

create policy "documents_submittals_links_insert" on public.documents_submittals_links
  for insert to authenticated
  with check (
    project_id in (select id from public.projects)
    and created_by = (select auth.uid())
  );

create policy "documents_submittals_links_delete" on public.documents_submittals_links
  for delete to authenticated
  using (created_by = (select auth.uid()));

create index idx_documents_submittals_links_document  on public.documents_submittals_links(project_document_id);
create index idx_documents_submittals_links_submittal on public.documents_submittals_links(submittal_id);
create index idx_documents_submittals_links_project   on public.documents_submittals_links(project_id);


-- ─────────────────────────────────────────────────────────────────────────────
-- 3. change_events_documents_links
--    change_events (uuid) <-> project_documents (bigint)
--    Alphabetical: change_events < documents (project_documents is the documents table)
--    Use case: backup documentation / PCO support documents for change events
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists public.change_events_documents_links (
  id                  uuid        primary key default gen_random_uuid(),
  change_event_id     uuid        not null references public.change_events(id) on delete cascade,
  project_document_id bigint      not null references public.project_documents(id) on delete cascade,
  project_id          integer     not null references public.projects(id) on delete cascade,
  link_type           text        not null default 'related'
                                  check (link_type in ('related','attachment','reference','supersedes','causes','blocks')),
  note                text,
  created_at          timestamptz not null default now(),
  created_by          uuid        references auth.users(id),
  constraint change_events_documents_links_unique unique (change_event_id, project_document_id, link_type)
);

comment on table public.change_events_documents_links is
  'Typed join table: change_events <-> project_documents. Backup documentation and support files for change events.';

alter table public.change_events_documents_links enable row level security;

create policy "change_events_documents_links_select" on public.change_events_documents_links
  for select to authenticated
  using (project_id in (select id from public.projects));

create policy "change_events_documents_links_insert" on public.change_events_documents_links
  for insert to authenticated
  with check (
    project_id in (select id from public.projects)
    and created_by = (select auth.uid())
  );

create policy "change_events_documents_links_delete" on public.change_events_documents_links
  for delete to authenticated
  using (created_by = (select auth.uid()));

create index idx_change_events_documents_links_ce       on public.change_events_documents_links(change_event_id);
create index idx_change_events_documents_links_document on public.change_events_documents_links(project_document_id);
create index idx_change_events_documents_links_project  on public.change_events_documents_links(project_id);


-- ─────────────────────────────────────────────────────────────────────────────
-- 4. project_photos_punch_items_links
--    project_photos (bigint) <-> punch_items (uuid)
--    Alphabetical: project_photos < punch_items
--    Use case: photo evidence for punch list items
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists public.project_photos_punch_items_links (
  id               uuid        primary key default gen_random_uuid(),
  project_photo_id bigint      not null references public.project_photos(id) on delete cascade,
  punch_item_id    uuid        not null references public.punch_items(id) on delete cascade,
  project_id       integer     not null references public.projects(id) on delete cascade,
  link_type        text        not null default 'attachment'
                               check (link_type in ('related','attachment','reference','supersedes','causes','blocks')),
  note             text,
  created_at       timestamptz not null default now(),
  created_by       uuid        references auth.users(id),
  constraint project_photos_punch_items_links_unique unique (project_photo_id, punch_item_id, link_type)
);

comment on table public.project_photos_punch_items_links is
  'Typed join table: project_photos <-> punch_items. Photo evidence documenting punch list deficiencies.';

alter table public.project_photos_punch_items_links enable row level security;

create policy "project_photos_punch_items_links_select" on public.project_photos_punch_items_links
  for select to authenticated
  using (project_id in (select id from public.projects));

create policy "project_photos_punch_items_links_insert" on public.project_photos_punch_items_links
  for insert to authenticated
  with check (
    project_id in (select id from public.projects)
    and created_by = (select auth.uid())
  );

create policy "project_photos_punch_items_links_delete" on public.project_photos_punch_items_links
  for delete to authenticated
  using (created_by = (select auth.uid()));

create index idx_pp_pi_links_photo      on public.project_photos_punch_items_links(project_photo_id);
create index idx_pp_pi_links_punch_item on public.project_photos_punch_items_links(punch_item_id);
create index idx_pp_pi_links_project    on public.project_photos_punch_items_links(project_id);


-- ─────────────────────────────────────────────────────────────────────────────
-- 5. observations_project_photos_links
--    observations (uuid) <-> project_photos (bigint)
--    Alphabetical: observations < project_photos
--    Use case: photos documenting field observations (separate from observation_photos
--    which stores file metadata; this links to the structured project_photos store)
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists public.observations_project_photos_links (
  id               uuid        primary key default gen_random_uuid(),
  observation_id   uuid        not null references public.observations(id) on delete cascade,
  project_photo_id bigint      not null references public.project_photos(id) on delete cascade,
  project_id       integer     not null references public.projects(id) on delete cascade,
  link_type        text        not null default 'attachment'
                               check (link_type in ('related','attachment','reference','supersedes','causes','blocks')),
  note             text,
  created_at       timestamptz not null default now(),
  created_by       uuid        references auth.users(id),
  constraint observations_project_photos_links_unique unique (observation_id, project_photo_id, link_type)
);

comment on table public.observations_project_photos_links is
  'Typed join table: observations <-> project_photos. Field observation photographic evidence from the structured photo store.';

alter table public.observations_project_photos_links enable row level security;

create policy "observations_project_photos_links_select" on public.observations_project_photos_links
  for select to authenticated
  using (project_id in (select id from public.projects));

create policy "observations_project_photos_links_insert" on public.observations_project_photos_links
  for insert to authenticated
  with check (
    project_id in (select id from public.projects)
    and created_by = (select auth.uid())
  );

create policy "observations_project_photos_links_delete" on public.observations_project_photos_links
  for delete to authenticated
  using (created_by = (select auth.uid()));

create index idx_obs_pp_links_observation on public.observations_project_photos_links(observation_id);
create index idx_obs_pp_links_photo       on public.observations_project_photos_links(project_photo_id);
create index idx_obs_pp_links_project     on public.observations_project_photos_links(project_id);


-- ─────────────────────────────────────────────────────────────────────────────
-- 6. daily_logs_project_photos_links
--    daily_logs (uuid) <-> project_photos (bigint)
--    Alphabetical: daily_logs < project_photos
--    Use case: daily progress photos attached to daily log entries
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists public.daily_logs_project_photos_links (
  id               uuid        primary key default gen_random_uuid(),
  daily_log_id     uuid        not null references public.daily_logs(id) on delete cascade,
  project_photo_id bigint      not null references public.project_photos(id) on delete cascade,
  project_id       integer     not null references public.projects(id) on delete cascade,
  link_type        text        not null default 'attachment'
                               check (link_type in ('related','attachment','reference','supersedes','causes','blocks')),
  note             text,
  created_at       timestamptz not null default now(),
  created_by       uuid        references auth.users(id),
  constraint daily_logs_project_photos_links_unique unique (daily_log_id, project_photo_id, link_type)
);

comment on table public.daily_logs_project_photos_links is
  'Typed join table: daily_logs <-> project_photos. Daily progress and site condition photos attached to log entries.';

alter table public.daily_logs_project_photos_links enable row level security;

create policy "daily_logs_project_photos_links_select" on public.daily_logs_project_photos_links
  for select to authenticated
  using (project_id in (select id from public.projects));

create policy "daily_logs_project_photos_links_insert" on public.daily_logs_project_photos_links
  for insert to authenticated
  with check (
    project_id in (select id from public.projects)
    and created_by = (select auth.uid())
  );

create policy "daily_logs_project_photos_links_delete" on public.daily_logs_project_photos_links
  for delete to authenticated
  using (created_by = (select auth.uid()));

create index idx_dl_pp_links_daily_log on public.daily_logs_project_photos_links(daily_log_id);
create index idx_dl_pp_links_photo     on public.daily_logs_project_photos_links(project_photo_id);
create index idx_dl_pp_links_project   on public.daily_logs_project_photos_links(project_id);


-- ─────────────────────────────────────────────────────────────────────────────
-- 7. drawings_rfis_links
--    drawings (uuid) <-> rfis (uuid)
--    Alphabetical: drawings < rfis
--    Use case: RFIs that reference specific drawing sheets or details
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists public.drawings_rfis_links (
  id         uuid        primary key default gen_random_uuid(),
  drawing_id uuid        not null references public.drawings(id) on delete cascade,
  rfi_id     uuid        not null references public.rfis(id) on delete cascade,
  project_id integer     not null references public.projects(id) on delete cascade,
  link_type  text        not null default 'reference'
                         check (link_type in ('related','attachment','reference','supersedes','causes','blocks')),
  note       text,
  created_at timestamptz not null default now(),
  created_by uuid        references auth.users(id),
  constraint drawings_rfis_links_unique unique (drawing_id, rfi_id, link_type)
);

comment on table public.drawings_rfis_links is
  'Typed join table: drawings <-> rfis. Default link_type=reference because RFIs typically cite specific drawing sheets to clarify scope.';

alter table public.drawings_rfis_links enable row level security;

create policy "drawings_rfis_links_select" on public.drawings_rfis_links
  for select to authenticated
  using (project_id in (select id from public.projects));

create policy "drawings_rfis_links_insert" on public.drawings_rfis_links
  for insert to authenticated
  with check (
    project_id in (select id from public.projects)
    and created_by = (select auth.uid())
  );

create policy "drawings_rfis_links_delete" on public.drawings_rfis_links
  for delete to authenticated
  using (created_by = (select auth.uid()));

create index idx_drawings_rfis_links_drawing on public.drawings_rfis_links(drawing_id);
create index idx_drawings_rfis_links_rfi     on public.drawings_rfis_links(rfi_id);
create index idx_drawings_rfis_links_project on public.drawings_rfis_links(project_id);


-- ─────────────────────────────────────────────────────────────────────────────
-- 8. rfis_submittals_links
--    rfis (uuid) <-> submittals (uuid)
--    Alphabetical: rfis < submittals
--    Use case: RFIs that clarify submittal requirements or arise from submittal review
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists public.rfis_submittals_links (
  id           uuid        primary key default gen_random_uuid(),
  rfi_id       uuid        not null references public.rfis(id) on delete cascade,
  submittal_id uuid        not null references public.submittals(id) on delete cascade,
  project_id   integer     not null references public.projects(id) on delete cascade,
  link_type    text        not null default 'related'
                           check (link_type in ('related','attachment','reference','supersedes','causes','blocks')),
  note         text,
  created_at   timestamptz not null default now(),
  created_by   uuid        references auth.users(id),
  constraint rfis_submittals_links_unique unique (rfi_id, submittal_id, link_type)
);

comment on table public.rfis_submittals_links is
  'Typed join table: rfis <-> submittals. RFIs that arise from or clarify submittal review comments.';

alter table public.rfis_submittals_links enable row level security;

create policy "rfis_submittals_links_select" on public.rfis_submittals_links
  for select to authenticated
  using (project_id in (select id from public.projects));

create policy "rfis_submittals_links_insert" on public.rfis_submittals_links
  for insert to authenticated
  with check (
    project_id in (select id from public.projects)
    and created_by = (select auth.uid())
  );

create policy "rfis_submittals_links_delete" on public.rfis_submittals_links
  for delete to authenticated
  using (created_by = (select auth.uid()));

create index idx_rfis_submittals_links_rfi       on public.rfis_submittals_links(rfi_id);
create index idx_rfis_submittals_links_submittal on public.rfis_submittals_links(submittal_id);
create index idx_rfis_submittals_links_project   on public.rfis_submittals_links(project_id);


commit;
