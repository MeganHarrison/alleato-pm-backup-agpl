-- Extend the training_docs system for the documentation/training map:
--   1. First-class tool grouping + QA status on training_docs (promoted from metadata).
--   2. A 'planned' status so we can map "training needed" that isn't written yet.
--   3. A training_doc_relations table to link related training (related / prerequisite / next).
-- Purely ADDITIVE — no columns dropped or renamed; the existing admin UI, API, and
-- publish pipeline (which read metadata.appToolCategory + known columns) keep working.

-- 1. First-class tool grouping + QA tracking ---------------------------------
alter table public.training_docs
  add column if not exists tool_category text,
  add column if not exists tool_module   text,
  add column if not exists task_key       text,
  add column if not exists qa_status      text not null default 'not_tested',
  add column if not exists qa_last_run_at timestamptz,
  add column if not exists qa_notes       text;

-- qa_status allowed values
alter table public.training_docs drop constraint if exists training_docs_qa_status_check;
alter table public.training_docs
  add constraint training_docs_qa_status_check
  check (qa_status in ('not_tested', 'passing', 'failing', 'needs_update'));

-- expand status to add 'planned' (identified as needed, not yet drafted)
alter table public.training_docs drop constraint if exists training_docs_status_check;
alter table public.training_docs
  add constraint training_docs_status_check
  check (status in ('planned', 'draft', 'in_review', 'approved', 'published', 'archived'));

-- backfill the new first-class columns from existing metadata (non-destructive)
update public.training_docs
  set tool_category = coalesce(tool_category, nullif(metadata->>'appToolCategory', '')),
      tool_module   = coalesce(tool_module,   nullif(metadata->>'tutorialModule', '')),
      task_key      = coalesce(task_key,      nullif(metadata->>'tutorialId', ''))
  where metadata ? 'appToolCategory' or metadata ? 'tutorialModule' or metadata ? 'tutorialId';

create index if not exists idx_training_docs_tool_category on public.training_docs (tool_category);
create index if not exists idx_training_docs_qa_status     on public.training_docs (qa_status);
create unique index if not exists uq_training_docs_task_key
  on public.training_docs (task_key) where task_key is not null;

-- 2. Related-training links ---------------------------------------------------
create table if not exists public.training_doc_relations (
  id            uuid primary key default gen_random_uuid(),
  created_at    timestamptz not null default now(),
  created_by    uuid references public.user_profiles(id),
  source_doc_id uuid not null references public.training_docs(id) on delete cascade,
  target_doc_id uuid not null references public.training_docs(id) on delete cascade,
  relation_type text not null default 'related'
    check (relation_type in ('related', 'prerequisite', 'next')),
  sort_order    integer not null default 0,
  constraint training_doc_relations_no_self check (source_doc_id <> target_doc_id),
  constraint training_doc_relations_unique unique (source_doc_id, target_doc_id, relation_type)
);

create index if not exists idx_tdr_source on public.training_doc_relations (source_doc_id);
create index if not exists idx_tdr_target on public.training_doc_relations (target_doc_id);

-- RLS: mirror the training_docs policy set (admin-only via current_is_app_admin(), service_role full)
alter table public.training_doc_relations enable row level security;

drop policy if exists training_doc_relations_service_write on public.training_doc_relations;
create policy training_doc_relations_service_write on public.training_doc_relations
  for all to service_role using (true) with check (true);

drop policy if exists training_doc_relations_select_admin on public.training_doc_relations;
create policy training_doc_relations_select_admin on public.training_doc_relations
  for select to authenticated using (current_is_app_admin());

drop policy if exists training_doc_relations_insert_admin on public.training_doc_relations;
create policy training_doc_relations_insert_admin on public.training_doc_relations
  for insert to authenticated
  with check (current_is_app_admin() and (created_by is null or created_by = auth.uid()));

drop policy if exists training_doc_relations_update_admin on public.training_doc_relations;
create policy training_doc_relations_update_admin on public.training_doc_relations
  for update to authenticated using (current_is_app_admin()) with check (current_is_app_admin());

drop policy if exists training_doc_relations_delete_admin on public.training_doc_relations;
create policy training_doc_relations_delete_admin on public.training_doc_relations
  for delete to authenticated using (current_is_app_admin());

comment on table public.training_doc_relations is
  'Links between training_docs for related/prerequisite/next relationships (training map).';
comment on column public.training_docs.tool_category is
  'First-class tool grouping (e.g. Commitments, Budget). Promoted from metadata.appToolCategory.';
comment on column public.training_docs.qa_status is
  'QA state of the documented flow: not_tested | passing | failing | needs_update.';
comment on column public.training_docs.task_key is
  'Stable per-task key, e.g. commitments.create-subcontract. Promoted from metadata.tutorialId.';
