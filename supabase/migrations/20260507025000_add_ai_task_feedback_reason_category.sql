alter table public.ai_task_feedback
  add column if not exists reason_category text;

alter table public.ai_task_feedback
  drop constraint if exists ai_task_feedback_reason_category_check;

alter table public.ai_task_feedback
  add constraint ai_task_feedback_reason_category_check
  check (
    reason_category is null
    or reason_category in (
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

comment on column public.ai_task_feedback.reason_category is
  'Structured negative-feedback reason used to improve AI task generation.';

create index if not exists ai_task_feedback_reason_category_idx
  on public.ai_task_feedback (reason_category, created_at desc)
  where signal = 'bad' and reason_category is not null;
