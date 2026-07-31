create table if not exists public.ai_retrieval_weights (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  promotion_id uuid not null references public.ai_learning_promotions(id) on delete cascade,
  project_id integer null references public.projects(id) on delete set null,
  tool_name text not null,
  source_document_id text null references public.document_metadata(id) on delete set null,
  source_chunk_id text null,
  query_signature text not null,
  action text not null check (action in ('boost', 'downrank_review')),
  weight_multiplier numeric not null default 1.0 check (weight_multiplier > 0 and weight_multiplier <= 3.0),
  confidence numeric not null default 0.5 check (confidence >= 0 and confidence <= 1),
  status text not null default 'active' check (status in ('active', 'paused', 'superseded')),
  metadata jsonb not null default '{}'::jsonb,
  unique (promotion_id)
);

create index if not exists ai_retrieval_weights_lookup_idx
  on public.ai_retrieval_weights(tool_name, project_id, query_signature, status);

create index if not exists ai_retrieval_weights_source_document_idx
  on public.ai_retrieval_weights(source_document_id, status)
  where source_document_id is not null;

create index if not exists ai_retrieval_weights_source_chunk_idx
  on public.ai_retrieval_weights(source_chunk_id, status)
  where source_chunk_id is not null;

drop trigger if exists ai_retrieval_weights_set_updated_at
  on public.ai_retrieval_weights;
create trigger ai_retrieval_weights_set_updated_at
  before update on public.ai_retrieval_weights
  for each row execute function public.set_updated_at();

alter table public.ai_retrieval_weights enable row level security;

drop policy if exists ai_retrieval_weights_select on public.ai_retrieval_weights;
create policy ai_retrieval_weights_select
  on public.ai_retrieval_weights
  for select
  to authenticated
  using (
    public.current_is_app_admin()
    or project_id is null
    or public.current_is_project_member(project_id)
  );

drop policy if exists ai_retrieval_weights_service_write on public.ai_retrieval_weights;
create policy ai_retrieval_weights_service_write
  on public.ai_retrieval_weights
  for all
  to service_role
  using (true)
  with check (true);

grant select on public.ai_retrieval_weights to authenticated;
grant all on public.ai_retrieval_weights to service_role;

comment on table public.ai_retrieval_weights is
  'Reviewed retrieval ranking hints created from approved ai_learning_promotions. These are not raw feedback events.';
comment on column public.ai_retrieval_weights.action is
  'boost means the source/chunk should be preferred for similar queries; downrank_review means retrieval should treat the source as suspicious until reviewed in ranking code.';
