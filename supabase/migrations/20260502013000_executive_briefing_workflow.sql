alter table public.daily_recaps
  add column if not exists recap_kind text not null default 'meeting_digest',
  add column if not exists workflow_status text not null default 'approved',
  add column if not exists approved_at timestamp with time zone,
  add column if not exists approved_by uuid,
  add column if not exists approval_notes text,
  add column if not exists briefing_packet jsonb;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'daily_recaps_recap_kind_check'
  ) then
    alter table public.daily_recaps
      add constraint daily_recaps_recap_kind_check
      check (recap_kind in ('meeting_digest', 'executive_briefing'));
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'daily_recaps_workflow_status_check'
  ) then
    alter table public.daily_recaps
      add constraint daily_recaps_workflow_status_check
      check (workflow_status in ('draft', 'approved'));
  end if;
end $$;

create unique index if not exists idx_daily_recaps_executive_briefing_date
  on public.daily_recaps (recap_date)
  where recap_kind = 'executive_briefing';

create table if not exists public.executive_briefing_follow_ups (
  id uuid primary key default gen_random_uuid(),
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  fingerprint text not null,
  section text not null,
  title text not null,
  summary text not null,
  recommended_action text,
  why_it_matters text,
  owner text,
  status text,
  tone text,
  state text not null default 'open',
  source_type text,
  source_detail text,
  source_id text,
  source_url text,
  project_label text,
  source_date text,
  first_seen_recap_id uuid references public.daily_recaps(id) on delete set null,
  last_seen_recap_id uuid references public.daily_recaps(id) on delete set null,
  first_seen_at timestamp with time zone not null default now(),
  last_seen_at timestamp with time zone not null default now(),
  resolved_at timestamp with time zone,
  resolved_by uuid,
  resolution_note text,
  payload jsonb not null default '{}'::jsonb
);

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'executive_briefing_follow_ups_state_check'
  ) then
    alter table public.executive_briefing_follow_ups
      add constraint executive_briefing_follow_ups_state_check
      check (state in ('open', 'resolved'));
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'executive_briefing_follow_ups_tone_check'
  ) then
    alter table public.executive_briefing_follow_ups
      add constraint executive_briefing_follow_ups_tone_check
      check (tone in ('neutral', 'good', 'watch', 'risk'));
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'executive_briefing_follow_ups_section_check'
  ) then
    alter table public.executive_briefing_follow_ups
      add constraint executive_briefing_follow_ups_section_check
      check (section in ('needsBrandon', 'waitingOnOthers', 'importantUpdates'));
  end if;
end $$;

create unique index if not exists idx_executive_briefing_follow_ups_fingerprint
  on public.executive_briefing_follow_ups (fingerprint);

create index if not exists idx_executive_briefing_follow_ups_state
  on public.executive_briefing_follow_ups (state, last_seen_at desc);

create index if not exists idx_executive_briefing_follow_ups_last_seen_recap
  on public.executive_briefing_follow_ups (last_seen_recap_id);

create or replace function public.set_executive_briefing_follow_up_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_executive_briefing_follow_up_updated_at
  on public.executive_briefing_follow_ups;

create trigger set_executive_briefing_follow_up_updated_at
before update on public.executive_briefing_follow_ups
for each row
execute function public.set_executive_briefing_follow_up_updated_at();

grant all on table public.executive_briefing_follow_ups to anon;
grant all on table public.executive_briefing_follow_ups to authenticated;
grant all on table public.executive_briefing_follow_ups to service_role;
