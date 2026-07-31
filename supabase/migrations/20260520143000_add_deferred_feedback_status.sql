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
      'deferred',
      'resolved',
      'closed',
      'archived'
    )
  );
