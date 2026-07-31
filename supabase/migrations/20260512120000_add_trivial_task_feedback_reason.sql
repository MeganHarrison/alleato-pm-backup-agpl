-- Add 'trivial' to the ai_task_feedback.reason_category check constraint.
-- 'trivial' captures tasks that are not worth tracking (meeting logistics,
-- in-conversation micro-actions, calendar forwarding). Used as a strong
-- negative signal for the Teams/Email extraction prompts.

alter table public.ai_task_feedback
  drop constraint if exists ai_task_feedback_reason_category_check;

alter table public.ai_task_feedback
  add constraint ai_task_feedback_reason_category_check
  check (
    reason_category is null
    or reason_category in (
      'trivial',
      'too_vague',
      'wrong_assignee',
      'wrong_due_date',
      'wrong_priority',
      'duplicate',
      'not_actionable',
      'missing_context',
      'other'
    )
  );
