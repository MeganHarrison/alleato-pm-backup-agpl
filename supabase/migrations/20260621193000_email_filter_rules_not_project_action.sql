-- Allow review decisions to teach Outlook that matching mail should be
-- imported but explicitly categorized as non-project.

set statement_timeout = 0;
set lock_timeout = '5min';

begin;

alter table public.email_filter_rules
  drop constraint if exists email_filter_rules_action_check;

alter table public.email_filter_rules
  add constraint email_filter_rules_action_check
  check (action in ('skip', 'review', 'allow', 'not_project'));

comment on column public.email_filter_rules.action is
  'skip = drop with no DB writes. review = write to skip_audit only. allow = '
  'explicit allowlist that overrides higher gates. not_project = import and '
  'mark Outlook intake project_assignment.status as not_project.';

commit;
