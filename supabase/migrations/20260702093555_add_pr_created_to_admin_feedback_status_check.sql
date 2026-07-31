-- The admin feedback inbox (frontend DisplayStatus, status filters, and the
-- sync-feedback-pr-status cron) all use 'pr_created', but the CHECK constraint
-- from 20260329000001_expand_admin_feedback_statuses never included it. Every
-- attempt to set 'pr_created' (e.g. the PR-status auto-sync cron) violated the
-- constraint and rolled back — silently freezing feedback items at 'submitted'
-- even after their fix PR was opened/merged. Add the missing allowed value.
alter table public.admin_feedback_items
  drop constraint if exists admin_feedback_items_status_check;

alter table public.admin_feedback_items
  add constraint admin_feedback_items_status_check
  check (status = any (array[
    'open','submitted','github_failed','in_progress','triaged','diagnosing',
    'fixing','verifying','in_review','pr_created','deferred','resolved','closed','archived'
  ]::text[]));
