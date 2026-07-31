create table if not exists public.training_docs (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid null references public.user_profiles(id) on delete set null,
  updated_by uuid null references public.user_profiles(id) on delete set null,
  title text not null,
  slug text not null unique,
  summary text null,
  body_markdown text not null default '',
  audience text not null default 'internal' check (
    audience in ('internal', 'client', 'subcontractor', 'admin')
  ),
  status text not null default 'draft' check (
    status in ('draft', 'in_review', 'approved', 'published', 'archived')
  ),
  source_route text null,
  review_notes text null,
  target_collection text not null default 'project-management-tools/training-docs',
  published_doc_path text null,
  last_published_at timestamptz null,
  last_publish_error text null,
  metadata jsonb not null default '{}'::jsonb
);

create table if not exists public.training_doc_assets (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  training_doc_id uuid not null references public.training_docs(id) on delete cascade,
  created_by uuid null references public.user_profiles(id) on delete set null,
  storage_bucket text not null default 'documents',
  storage_path text not null,
  file_name text not null,
  mime_type text not null,
  asset_type text not null default 'screenshot' check (
    asset_type in ('screenshot', 'image')
  ),
  caption text null,
  alt_text text null,
  step_order integer not null default 0,
  metadata jsonb not null default '{}'::jsonb
);

create unique index if not exists idx_training_doc_assets_storage_path
  on public.training_doc_assets(storage_bucket, storage_path);

create index if not exists idx_training_docs_status_updated
  on public.training_docs(status, updated_at desc);

create index if not exists idx_training_docs_slug
  on public.training_docs(slug);

create index if not exists idx_training_doc_assets_doc_order
  on public.training_doc_assets(training_doc_id, step_order asc, created_at asc);

drop trigger if exists set_training_docs_updated_at on public.training_docs;
create trigger set_training_docs_updated_at
  before update on public.training_docs
  for each row
  execute function public.update_updated_at_column();

drop trigger if exists set_training_doc_assets_updated_at on public.training_doc_assets;
create trigger set_training_doc_assets_updated_at
  before update on public.training_doc_assets
  for each row
  execute function public.update_updated_at_column();

alter table public.training_docs enable row level security;
alter table public.training_doc_assets enable row level security;

drop policy if exists training_docs_select_admin on public.training_docs;
create policy training_docs_select_admin
  on public.training_docs
  for select
  to authenticated
  using (public.current_is_app_admin());

drop policy if exists training_docs_insert_admin on public.training_docs;
create policy training_docs_insert_admin
  on public.training_docs
  for insert
  to authenticated
  with check (
    public.current_is_app_admin()
    and (created_by is null or created_by = auth.uid())
  );

drop policy if exists training_docs_update_admin on public.training_docs;
create policy training_docs_update_admin
  on public.training_docs
  for update
  to authenticated
  using (public.current_is_app_admin())
  with check (public.current_is_app_admin());

drop policy if exists training_docs_delete_admin on public.training_docs;
create policy training_docs_delete_admin
  on public.training_docs
  for delete
  to authenticated
  using (public.current_is_app_admin());

drop policy if exists training_docs_service_write on public.training_docs;
create policy training_docs_service_write
  on public.training_docs
  for all
  to service_role
  using (true)
  with check (true);

drop policy if exists training_doc_assets_select_admin on public.training_doc_assets;
create policy training_doc_assets_select_admin
  on public.training_doc_assets
  for select
  to authenticated
  using (public.current_is_app_admin());

drop policy if exists training_doc_assets_insert_admin on public.training_doc_assets;
create policy training_doc_assets_insert_admin
  on public.training_doc_assets
  for insert
  to authenticated
  with check (
    public.current_is_app_admin()
    and (created_by is null or created_by = auth.uid())
  );

drop policy if exists training_doc_assets_update_admin on public.training_doc_assets;
create policy training_doc_assets_update_admin
  on public.training_doc_assets
  for update
  to authenticated
  using (public.current_is_app_admin())
  with check (public.current_is_app_admin());

drop policy if exists training_doc_assets_delete_admin on public.training_doc_assets;
create policy training_doc_assets_delete_admin
  on public.training_doc_assets
  for delete
  to authenticated
  using (public.current_is_app_admin());

drop policy if exists training_doc_assets_service_write on public.training_doc_assets;
create policy training_doc_assets_service_write
  on public.training_doc_assets
  for all
  to service_role
  using (true)
  with check (true);

comment on table public.training_docs is
  'Draft/review/publish records for AI-assisted training documentation before the content is published into the Alleato OS docs repo.';

comment on table public.training_doc_assets is
  'Ordered screenshot and image assets attached to a training doc for review and publish output.';
