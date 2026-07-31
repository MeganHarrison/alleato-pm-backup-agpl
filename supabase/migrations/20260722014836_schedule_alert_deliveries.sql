begin;

create table if not exists public.schedule_alert_deliveries (
  id uuid primary key default gen_random_uuid(),
  event_key text not null unique,
  project_id integer not null references public.projects(id) on delete cascade,
  revision_id uuid not null references public.schedule_revisions(id) on delete cascade,
  source_task_id uuid not null,
  recipient_user_id uuid not null,
  change_kind text not null check (change_kind in ('date_changed', 'dependency_changed', 'submittal_changed')),
  notification_id uuid not null references public.collaboration_notifications(id) on delete cascade,
  created_at timestamptz not null default now()
);

create index if not exists schedule_alert_deliveries_recipient_idx
  on public.schedule_alert_deliveries (recipient_user_id, created_at desc);
create index if not exists schedule_alert_deliveries_revision_idx
  on public.schedule_alert_deliveries (revision_id, source_task_id);

alter table public.schedule_alert_deliveries enable row level security;
revoke all on public.schedule_alert_deliveries from anon, authenticated;

commit;
