alter table public.daily_recaps
  add column if not exists ai_work_run_id uuid
  references public.ai_work_runs(id) on delete set null;

create unique index if not exists daily_recaps_ai_work_run_id_unique_idx
  on public.daily_recaps(ai_work_run_id)
  where ai_work_run_id is not null;

create index if not exists daily_recaps_ai_work_run_id_idx
  on public.daily_recaps(ai_work_run_id)
  where ai_work_run_id is not null;
