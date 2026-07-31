create table if not exists public.training_doc_steps (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  training_doc_id uuid not null references public.training_docs(id) on delete cascade,
  screenshot_asset_id uuid null references public.training_doc_assets(id) on delete set null,
  created_by uuid null references public.user_profiles(id) on delete set null,
  step_order integer not null default 0,
  title text not null,
  instruction_markdown text not null default '',
  expected_result text null,
  source_url text null,
  action_metadata jsonb not null default '{}'::jsonb
);

create index if not exists idx_training_doc_steps_doc_order
  on public.training_doc_steps(training_doc_id, step_order asc, created_at asc);

create index if not exists idx_training_doc_steps_asset
  on public.training_doc_steps(screenshot_asset_id);

drop trigger if exists set_training_doc_steps_updated_at on public.training_doc_steps;
create trigger set_training_doc_steps_updated_at
  before update on public.training_doc_steps
  for each row
  execute function public.update_updated_at_column();

alter table public.training_doc_steps enable row level security;

drop policy if exists training_doc_steps_select_admin on public.training_doc_steps;
create policy training_doc_steps_select_admin
  on public.training_doc_steps
  for select
  to authenticated
  using (public.current_is_app_admin());

drop policy if exists training_doc_steps_insert_admin on public.training_doc_steps;
create policy training_doc_steps_insert_admin
  on public.training_doc_steps
  for insert
  to authenticated
  with check (
    public.current_is_app_admin()
    and (created_by is null or created_by = auth.uid())
  );

drop policy if exists training_doc_steps_update_admin on public.training_doc_steps;
create policy training_doc_steps_update_admin
  on public.training_doc_steps
  for update
  to authenticated
  using (public.current_is_app_admin())
  with check (public.current_is_app_admin());

drop policy if exists training_doc_steps_delete_admin on public.training_doc_steps;
create policy training_doc_steps_delete_admin
  on public.training_doc_steps
  for delete
  to authenticated
  using (public.current_is_app_admin());

drop policy if exists training_doc_steps_service_write on public.training_doc_steps;
create policy training_doc_steps_service_write
  on public.training_doc_steps
  for all
  to service_role
  using (true)
  with check (true);

comment on table public.training_doc_steps is
  'Ordered step-by-step instructions generated for a training doc, optionally linked to a screenshot asset captured by browser automation.';
