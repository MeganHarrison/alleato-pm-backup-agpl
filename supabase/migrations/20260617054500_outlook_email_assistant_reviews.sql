-- Persist human review outcomes for Brandon's Outlook email assistant.
-- This table is intentionally append-friendly: every human decision becomes
-- an auditable event the assistant can learn from later.

set statement_timeout = 0;
set lock_timeout = '5min';

begin;

create table if not exists public.outlook_email_assistant_reviews (
  id uuid primary key default gen_random_uuid(),
  intake_email_id bigint not null references public.outlook_email_intake(id) on delete cascade,
  graph_message_id text not null,
  mailbox_user_id text not null,
  reviewer_id uuid null references auth.users(id) on delete set null,
  reviewer_email text null,
  assistant_action text not null check (
    assistant_action in ('reply', 'delegate', 'watch', 'ignore')
  ),
  assistant_priority text not null check (
    assistant_priority in ('urgent', 'high', 'normal', 'low')
  ),
  assistant_score numeric null,
  review_outcome text not null check (
    review_outcome in (
      'draft_copied',
      'draft_edited',
      'skipped',
      'delegated',
      'watched',
      'marked_no_action'
    )
  ),
  draft_body text null,
  reviewer_note text null,
  assistant_reason text null,
  assistant_owner text null,
  assistant_risk text null,
  assistant_evidence text null,
  source_metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_outlook_email_assistant_reviews_intake
  on public.outlook_email_assistant_reviews(intake_email_id, created_at desc);

create index if not exists idx_outlook_email_assistant_reviews_mailbox_created
  on public.outlook_email_assistant_reviews(mailbox_user_id, created_at desc);

create index if not exists idx_outlook_email_assistant_reviews_reviewer_created
  on public.outlook_email_assistant_reviews(reviewer_id, created_at desc)
  where reviewer_id is not null;

create index if not exists idx_outlook_email_assistant_reviews_outcome_created
  on public.outlook_email_assistant_reviews(review_outcome, created_at desc);

drop trigger if exists outlook_email_assistant_reviews_set_updated_at
  on public.outlook_email_assistant_reviews;
create trigger outlook_email_assistant_reviews_set_updated_at
  before update on public.outlook_email_assistant_reviews
  for each row execute function public.set_updated_at();

alter table public.outlook_email_assistant_reviews enable row level security;

drop policy if exists outlook_email_assistant_reviews_admin_only
  on public.outlook_email_assistant_reviews;
create policy outlook_email_assistant_reviews_admin_only
  on public.outlook_email_assistant_reviews
  for all
  to authenticated
  using (public.current_is_app_admin())
  with check (public.current_is_app_admin());

drop policy if exists outlook_email_assistant_reviews_service_role
  on public.outlook_email_assistant_reviews;
create policy outlook_email_assistant_reviews_service_role
  on public.outlook_email_assistant_reviews
  for all
  to service_role
  using (true)
  with check (true);

grant select, insert, update, delete on public.outlook_email_assistant_reviews
  to authenticated;
grant all on public.outlook_email_assistant_reviews
  to service_role;

comment on table public.outlook_email_assistant_reviews is
  'Human review outcome ledger for Outlook email assistant decisions and Brandon draft feedback.';

commit;
