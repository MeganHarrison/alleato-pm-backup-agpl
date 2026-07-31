alter table public.tasks
  add column if not exists extraction_source text,
  add column if not exists extraction_model text,
  add column if not exists extraction_prompt_version text,
  add column if not exists extraction_metadata jsonb not null default '{}'::jsonb;

comment on column public.tasks.extraction_source is
  'Code path or job that generated the task row, such as scheduled_task_extraction, teams_compiler, email_compiler, or brandon_backfill.';

comment on column public.tasks.extraction_model is
  'LLM model identifier used to generate the task row.';

comment on column public.tasks.extraction_prompt_version is
  'Stable prompt/version identifier for the extractor that generated the task row.';

comment on column public.tasks.extraction_metadata is
  'Additional extractor audit details such as provider, source document type, source document title, and whether the row came from a backfill.';

create index if not exists idx_tasks_extraction_source
  on public.tasks (extraction_source);

create index if not exists idx_tasks_extraction_model
  on public.tasks (extraction_model);
