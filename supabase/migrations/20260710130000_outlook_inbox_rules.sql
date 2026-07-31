-- Inbox rules for the Outlook Draft Feedback surface — Gmail/Outlook-style
-- filters that train the assistant on how to treat mail matching a sender /
-- subject / body pattern (always important, never inbox, set priority/category).
-- Applied deterministically when the mailbox is served (api/emails).

set statement_timeout = 0;
set lock_timeout = '5min';

begin;

create table if not exists public.outlook_inbox_rules (
  id uuid primary key default gen_random_uuid(),
  mailbox_user_id text not null,
  name text null,
  match_field text not null check (
    match_field in ('sender', 'sender_domain', 'subject', 'body', 'any')
  ),
  match_operator text not null check (
    match_operator in ('contains', 'equals', 'starts_with', 'ends_with')
  ),
  match_value text not null check (length(btrim(match_value)) > 0),
  action text not null check (
    action in ('always_important', 'never_inbox', 'set_priority', 'set_category')
  ),
  action_value text null,
  -- set_priority requires a valid priority; set_category requires a value.
  constraint outlook_inbox_rules_action_value_check check (
    (action = 'set_priority' and action_value in ('urgent', 'high', 'normal', 'low'))
    or (action = 'set_category' and action_value is not null and length(btrim(action_value)) > 0)
    or (action in ('always_important', 'never_inbox'))
  ),
  enabled boolean not null default true,
  created_by uuid null references auth.users(id) on delete set null,
  created_by_email text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_outlook_inbox_rules_mailbox_enabled
  on public.outlook_inbox_rules(mailbox_user_id, enabled);

create index if not exists idx_outlook_inbox_rules_mailbox_created
  on public.outlook_inbox_rules(mailbox_user_id, created_at desc);

drop trigger if exists outlook_inbox_rules_set_updated_at
  on public.outlook_inbox_rules;
create trigger outlook_inbox_rules_set_updated_at
  before update on public.outlook_inbox_rules
  for each row execute function public.set_updated_at();

alter table public.outlook_inbox_rules enable row level security;

drop policy if exists outlook_inbox_rules_admin_only
  on public.outlook_inbox_rules;
create policy outlook_inbox_rules_admin_only
  on public.outlook_inbox_rules
  for all
  to authenticated
  using (public.current_is_app_admin())
  with check (public.current_is_app_admin());

drop policy if exists outlook_inbox_rules_service_role
  on public.outlook_inbox_rules;
create policy outlook_inbox_rules_service_role
  on public.outlook_inbox_rules
  for all
  to service_role
  using (true)
  with check (true);

grant select, insert, update, delete on public.outlook_inbox_rules
  to authenticated;
grant all on public.outlook_inbox_rules
  to service_role;

comment on table public.outlook_inbox_rules is
  'Gmail/Outlook-style inbox rules for the Outlook Draft Feedback surface. Each rule matches a sender/subject/body pattern and forces an assistant action (always important, never inbox, set priority/category). Applied on read in api/emails.';

commit;
