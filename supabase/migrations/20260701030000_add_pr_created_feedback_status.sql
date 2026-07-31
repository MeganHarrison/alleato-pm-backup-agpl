-- Add 'pr_created' status so the feedback inbox can reflect that a PR was
-- opened for an item's linked GitHub issue, distinct from generic 'in_progress'.

ALTER TABLE public.admin_feedback_items
  DROP CONSTRAINT IF EXISTS admin_feedback_items_status_check;

ALTER TABLE public.admin_feedback_items
  ADD CONSTRAINT admin_feedback_items_status_check
  CHECK (
    status IN (
      'open',
      'submitted',
      'github_failed',
      'in_progress',
      'triaged',
      'diagnosing',
      'fixing',
      'verifying',
      'in_review',
      'pr_created',
      'deferred',
      'resolved',
      'closed',
      'archived'
    )
  );
