-- Migration: Drawings Pattern C hybrid — document_metadata link + revision history
-- Purpose: Add document_metadata_id to drawings (current revision pointer) and
--          create drawing_revisions table for historical revision tracking.
-- Affects: ALTER TABLE drawings, CREATE TABLE drawing_revisions
-- Note: drawings.current_revision_id (uuid) points at existing drawing_revisions system.
--       document_metadata_id is additive — legacy file paths remain intact.
-- Note: drawings.project_id is integer; current_is_project_member takes integer.

-- Add document_metadata_id to drawings (nullable — backfill in Phase 9)
alter table public.drawings
  add column if not exists document_metadata_id text
    references public.document_metadata(id) on delete restrict;

comment on column public.drawings.document_metadata_id is
  'Pattern C: points at the document_metadata record for the CURRENT revision. '
  'Historical revisions tracked in drawing_revisions. Nullable until Phase 9 backfill.';

-- ─── drawing_revisions ────────────────────────────────────────────────────────

create table if not exists public.drawing_revisions (
  id                   bigint      generated always as identity primary key,
  drawing_id           uuid        not null references public.drawings(id) on delete cascade,
  document_metadata_id text        not null references public.document_metadata(id) on delete cascade,
  revision_number      text        not null,
  revision_date        date,
  notes                text,
  created_at           timestamptz not null default now(),
  created_by           uuid        references auth.users(id),
  unique (drawing_id, revision_number)
);

create index if not exists idx_drawing_revisions_drawing_date
  on public.drawing_revisions (drawing_id, revision_date desc);

create index if not exists idx_drawing_revisions_doc
  on public.drawing_revisions (document_metadata_id);

comment on table public.drawing_revisions is
  'Tracks all historical revisions of a drawing, each linked to a document_metadata record. '
  'drawings.document_metadata_id always points at the CURRENT revision doc. '
  'drawings.current_revision_id (uuid) is the legacy revision pointer — kept for backward compat.';

alter table public.drawing_revisions enable row level security;

create policy "drawing_revisions_select" on public.drawing_revisions
  for select to authenticated
  using (public.user_can_access_entity('drawing', drawing_id::text));

create policy "drawing_revisions_insert" on public.drawing_revisions
  for insert to authenticated
  with check (public.user_can_access_entity('drawing', drawing_id::text));

create policy "drawing_revisions_update" on public.drawing_revisions
  for update to authenticated
  using  (public.user_can_access_entity('drawing', drawing_id::text))
  with check (public.user_can_access_entity('drawing', drawing_id::text));

create policy "drawing_revisions_delete" on public.drawing_revisions
  for delete to authenticated
  using (public.user_can_access_entity('drawing', drawing_id::text));
