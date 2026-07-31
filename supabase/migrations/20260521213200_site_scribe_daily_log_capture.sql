-- Site Scribe realtime daily-log capture metadata.
-- Keeps AI audit fields additive so existing daily-log entry flows continue unchanged.

alter table public.daily_logs
  add column if not exists site_scribe_session_id uuid,
  add column if not exists ai_audio_storage_path text,
  add column if not exists ai_transcript_storage_path text,
  add column if not exists ai_extraction jsonb not null default '{}'::jsonb,
  add column if not exists ai_field_confidence jsonb not null default '{}'::jsonb;

alter table public.daily_log_manpower
  add column if not exists source_audio_start_ms integer,
  add column if not exists source_audio_end_ms integer,
  add column if not exists ai_confidence jsonb not null default '{}'::jsonb;

alter table public.daily_log_notes
  add column if not exists topic_tag text,
  add column if not exists source_audio_start_ms integer,
  add column if not exists source_audio_end_ms integer,
  add column if not exists ai_confidence jsonb not null default '{}'::jsonb;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'daily_log_notes_topic_tag_check'
  ) then
    alter table public.daily_log_notes
      add constraint daily_log_notes_topic_tag_check
      check (
        topic_tag is null
        or topic_tag in (
          'Delivery',
          'Inspection',
          'Safety',
          'Visitor',
          'Issue',
          'Progress',
          'Equipment',
          'Other'
        )
      );
  end if;
end $$;

create table if not exists public.daily_log_photos (
  id uuid primary key default gen_random_uuid(),
  daily_log_id uuid not null references public.daily_logs(id) on delete cascade,
  project_id integer references public.projects(id) on delete cascade,
  storage_bucket text not null default 'project-files',
  storage_path text not null,
  public_url text,
  file_name text,
  content_type text,
  file_size integer,
  captured_at timestamptz not null,
  audio_timestamp_ms integer not null,
  paired_note_id uuid references public.daily_log_notes(id) on delete set null,
  pairing_confidence numeric not null default 0,
  caption text,
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists daily_log_photos_daily_log_id_idx
  on public.daily_log_photos(daily_log_id);

create index if not exists daily_log_photos_project_id_captured_at_idx
  on public.daily_log_photos(project_id, captured_at desc);

alter table public.daily_log_photos enable row level security;

drop policy if exists "daily_log_photos_select" on public.daily_log_photos;
create policy "daily_log_photos_select"
  on public.daily_log_photos
  for select
  using (auth.role() = 'authenticated');

drop policy if exists "daily_log_photos_insert" on public.daily_log_photos;
create policy "daily_log_photos_insert"
  on public.daily_log_photos
  for insert
  with check (auth.role() = 'authenticated');

drop policy if exists "daily_log_photos_update" on public.daily_log_photos;
create policy "daily_log_photos_update"
  on public.daily_log_photos
  for update
  using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');
