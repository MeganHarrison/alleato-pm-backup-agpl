-- Audit Outlook messages that are intentionally skipped before import.
-- This keeps false-positive review possible without polluting project email,
-- document metadata, embeddings, tasks, or intelligence packets.

set statement_timeout = 0;
set lock_timeout = '5min';

begin;

create table if not exists public.outlook_email_skip_audit (
  id bigint generated always as identity primary key,
  graph_message_id text not null,
  mailbox_user_id text not null,
  internet_message_id text,
  conversation_id text,
  subject text not null,
  body_preview text,
  from_name text,
  from_email text,
  received_at timestamptz,
  web_link text,
  classification_action text not null default 'skip'
    check (classification_action in ('skip', 'quarantine', 'import')),
  classification_category text not null,
  classification_confidence numeric,
  classification_reason text not null,
  classification_signals jsonb not null default '[]'::jsonb,
  source_metadata jsonb not null default '{}'::jsonb,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists uq_outlook_email_skip_audit_graph_message
  on public.outlook_email_skip_audit(graph_message_id);

create index if not exists idx_outlook_email_skip_audit_mailbox_seen
  on public.outlook_email_skip_audit(mailbox_user_id, last_seen_at desc);

create index if not exists idx_outlook_email_skip_audit_category_seen
  on public.outlook_email_skip_audit(classification_category, last_seen_at desc);

create index if not exists idx_outlook_email_skip_audit_received
  on public.outlook_email_skip_audit(received_at desc);

drop trigger if exists outlook_email_skip_audit_set_updated_at
  on public.outlook_email_skip_audit;
create trigger outlook_email_skip_audit_set_updated_at
  before update on public.outlook_email_skip_audit
  for each row execute function public.set_updated_at();

alter table public.outlook_email_skip_audit enable row level security;

drop policy if exists outlook_email_skip_audit_admin_only
  on public.outlook_email_skip_audit;
create policy outlook_email_skip_audit_admin_only
  on public.outlook_email_skip_audit
  for all
  to authenticated
  using (public.current_is_app_admin())
  with check (public.current_is_app_admin());

drop policy if exists outlook_email_skip_audit_service_role
  on public.outlook_email_skip_audit;
create policy outlook_email_skip_audit_service_role
  on public.outlook_email_skip_audit
  for all
  to service_role
  using (true)
  with check (true);

grant select, insert, update, delete on public.outlook_email_skip_audit
  to authenticated;
grant all on public.outlook_email_skip_audit
  to service_role;
grant usage, select on sequence public.outlook_email_skip_audit_id_seq
  to service_role;

comment on table public.outlook_email_skip_audit is
  'Review ledger for Outlook messages skipped before project email/RAG/intelligence import.';

commit;
