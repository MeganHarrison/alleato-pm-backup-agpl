-- Durable scheduler ownership and retry state for the morning Project Intelligence run.
-- This is intentionally scoped to the scheduled workflow; interactive AI runs keep
-- their existing ai_work_runs lifecycle.

begin;

create unique index if not exists ai_work_runs_executive_schedule_business_date_uidx
  on public.ai_work_runs(workflow_id, business_date)
  where workflow_id = 'executive-intelligence-daily-schedule'
    and business_date is not null;

comment on index public.ai_work_runs_executive_schedule_business_date_uidx is
  'One durable scheduler run per Project Intelligence business date; retries update the same row.';

commit;
