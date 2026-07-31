-- User-trained email filter rules.
--
-- Layered on top of the hand-coded noise filter in
-- backend/src/services/integrations/microsoft_graph/outlook.py (_is_noise_email).
-- Rules live here so the app team and end-users can teach the sync what counts
-- as junk (software receipts, monthly SaaS invoices, etc.) without a code
-- deploy. The sync loop pulls active rules at run start and applies them as a
-- second gate before any DB write.
--
-- Source of pattern: docs/architecture/COMMUNICATIONS-DATA-PIPELINE.md
--   Gate 1: _is_noise_email() (static patterns)
--   Gate 1.5: email_filter_rules (this table) — user-trained
--   Gate 2: classify_graph_email_for_intake() (heuristic classifier)

set statement_timeout = 0;
set lock_timeout = '5min';

begin;

create table if not exists public.email_filter_rules (
  id uuid primary key default gen_random_uuid(),

  -- Match criteria. NULL means "don't match on this field". At least one of
  -- (sender_pattern, sender_domain, subject_pattern, body_pattern) must be set.
  sender_pattern text,        -- exact, case-insensitive (e.g. 'receipts@stripe.com')
  sender_domain text,         -- exact domain, case-insensitive (e.g. 'stripe.com')
  subject_pattern text,       -- ILIKE pattern (e.g. '%receipt%', '%invoice%')
  body_pattern text,          -- ILIKE pattern, optional

  -- What to do when this rule matches. 'skip' = drop before any write.
  -- 'review' = write to skip_audit only so the user can sanity-check.
  -- 'allow' = explicit allowlist that overrides higher gates (e.g. a billing
  --   contact whose domain would otherwise be filtered).
  action text not null default 'skip'
    check (action in ('skip', 'review', 'allow')),

  -- Human-readable label for the rule list UI.
  label text,
  description text,

  -- Provenance.
  created_by uuid references auth.users(id) on delete set null,
  source_message_id text,     -- graph_message_id that prompted the rule
  source_subject text,        -- snapshot for the rule list UI

  -- Lifecycle.
  enabled boolean not null default true,
  match_count integer not null default 0,
  last_matched_at timestamptz,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  -- A rule with no match criteria is meaningless and dangerous.
  constraint email_filter_rules_at_least_one_match check (
    sender_pattern is not null
    or sender_domain is not null
    or subject_pattern is not null
    or body_pattern is not null
  )
);

create index if not exists idx_email_filter_rules_enabled
  on public.email_filter_rules(enabled) where enabled = true;

create index if not exists idx_email_filter_rules_sender_pattern
  on public.email_filter_rules(lower(sender_pattern)) where sender_pattern is not null;

create index if not exists idx_email_filter_rules_sender_domain
  on public.email_filter_rules(lower(sender_domain)) where sender_domain is not null;

create index if not exists idx_email_filter_rules_last_matched
  on public.email_filter_rules(last_matched_at desc nulls last);

drop trigger if exists email_filter_rules_set_updated_at on public.email_filter_rules;
create trigger email_filter_rules_set_updated_at
  before update on public.email_filter_rules
  for each row execute function public.set_updated_at();

alter table public.email_filter_rules enable row level security;

drop policy if exists email_filter_rules_admin_all on public.email_filter_rules;
create policy email_filter_rules_admin_all
  on public.email_filter_rules
  for all
  to authenticated
  using (public.current_is_app_admin())
  with check (public.current_is_app_admin());

drop policy if exists email_filter_rules_service_role on public.email_filter_rules;
create policy email_filter_rules_service_role
  on public.email_filter_rules
  for all
  to service_role
  using (true)
  with check (true);

grant select, insert, update, delete on public.email_filter_rules to authenticated;
grant all on public.email_filter_rules to service_role;

-- Helper RPC the sync loop calls when a rule matches an inbound email.
-- Bumps match_count and last_matched_at without forcing the sync to do an
-- UPDATE round-trip for every match.
create or replace function public.record_email_filter_rule_match(p_rule_id uuid)
returns void
language sql
security definer
set search_path = public
as $$
  update public.email_filter_rules
     set match_count = match_count + 1,
         last_matched_at = now()
   where id = p_rule_id;
$$;

grant execute on function public.record_email_filter_rule_match(uuid) to service_role;

comment on table public.email_filter_rules is
  'User-trained junk-mail rules. Applied by the Outlook sync as a second gate '
  'after the hand-coded noise filter. See docs/architecture/COMMUNICATIONS-DATA-PIPELINE.md.';

comment on column public.email_filter_rules.action is
  'skip = drop with no DB writes. review = write to skip_audit only. allow = '
  'explicit allowlist that overrides higher gates.';

comment on column public.email_filter_rules.source_message_id is
  'The graph_message_id of the email the user clicked "Mark as junk" on. '
  'Kept for provenance so we can show "Rule created from this email".';

commit;
