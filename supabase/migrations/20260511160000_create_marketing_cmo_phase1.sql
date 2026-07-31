create table if not exists public.marketing_intelligence_items (
  id uuid primary key default gen_random_uuid(),
  company_id uuid null references public.companies(id) on delete set null,
  project_id integer null references public.projects(id) on delete set null,
  source_table text null,
  source_id text null,
  source_url text null,
  source_title text null,
  source_date date null,
  item_type text not null check (
    item_type in (
      'project_win',
      'owner_update',
      'leadership_thought',
      'market_trend',
      'competitor_signal',
      'testimonial',
      'case_study_candidate',
      'event_opportunity',
      'campaign_idea'
    )
  ),
  title text not null,
  summary text not null,
  strategic_rationale text null,
  recommended_use jsonb not null default '[]'::jsonb,
  confidence text not null default 'medium' check (confidence in ('low', 'medium', 'high')),
  status text not null default 'new' check (status in ('new', 'reviewed', 'approved', 'dismissed', 'used')),
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.marketing_content_calendar_items (
  id uuid primary key default gen_random_uuid(),
  company_id uuid null references public.companies(id) on delete set null,
  project_id integer null references public.projects(id) on delete set null,
  campaign_id uuid null,
  planned_date date not null,
  channel text not null check (
    channel in ('linkedin', 'blog', 'email', 'website', 'case_study', 'video', 'presentation', 'internal')
  ),
  funnel_stage text not null default 'awareness' check (
    funnel_stage in ('awareness', 'consideration', 'conversion', 'retention', 'reputation')
  ),
  title text not null,
  angle text not null,
  target_audience text null,
  source_item_ids uuid[] not null default '{}'::uuid[],
  rationale text not null,
  status text not null default 'draft' check (
    status in ('draft', 'needs_review', 'approved', 'scheduled', 'published', 'archived')
  ),
  owner_user_id uuid null,
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.marketing_content_assets (
  id uuid primary key default gen_random_uuid(),
  calendar_item_id uuid not null references public.marketing_content_calendar_items(id) on delete cascade,
  asset_type text not null check (
    asset_type in ('linkedin_post', 'blog_outline', 'blog_draft', 'email_draft', 'case_study_outline', 'video_script', 'image_prompt', 'sales_blurb')
  ),
  title text not null,
  body text not null,
  source_citations jsonb not null default '[]'::jsonb,
  review_notes text null,
  status text not null default 'draft' check (
    status in ('draft', 'needs_review', 'approved', 'revision_requested', 'published', 'archived')
  ),
  created_by uuid null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.marketing_performance_snapshots (
  id uuid primary key default gen_random_uuid(),
  asset_id uuid null references public.marketing_content_assets(id) on delete set null,
  calendar_item_id uuid null references public.marketing_content_calendar_items(id) on delete set null,
  channel text not null,
  measured_at timestamptz not null default now(),
  impressions integer null,
  engagements integer null,
  clicks integer null,
  leads integer null,
  notes text null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_marketing_intelligence_company_id
  on public.marketing_intelligence_items(company_id);
create index if not exists idx_marketing_intelligence_project_id
  on public.marketing_intelligence_items(project_id);
create index if not exists idx_marketing_intelligence_source
  on public.marketing_intelligence_items(source_table, source_id);
create index if not exists idx_marketing_intelligence_status
  on public.marketing_intelligence_items(status);
create index if not exists idx_marketing_intelligence_source_date
  on public.marketing_intelligence_items(source_date desc);

create index if not exists idx_marketing_calendar_company_id
  on public.marketing_content_calendar_items(company_id);
create index if not exists idx_marketing_calendar_project_id
  on public.marketing_content_calendar_items(project_id);
create index if not exists idx_marketing_calendar_planned_date
  on public.marketing_content_calendar_items(planned_date);
create index if not exists idx_marketing_calendar_status
  on public.marketing_content_calendar_items(status);
create index if not exists idx_marketing_calendar_source_item_ids
  on public.marketing_content_calendar_items using gin(source_item_ids);

create index if not exists idx_marketing_assets_calendar_item_id
  on public.marketing_content_assets(calendar_item_id);
create index if not exists idx_marketing_assets_status
  on public.marketing_content_assets(status);

create index if not exists idx_marketing_performance_asset_id
  on public.marketing_performance_snapshots(asset_id);
create index if not exists idx_marketing_performance_calendar_item_id
  on public.marketing_performance_snapshots(calendar_item_id);
create index if not exists idx_marketing_performance_measured_at
  on public.marketing_performance_snapshots(measured_at desc);

create or replace function public.set_marketing_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists marketing_intelligence_items_set_updated_at
  on public.marketing_intelligence_items;
create trigger marketing_intelligence_items_set_updated_at
  before update on public.marketing_intelligence_items
  for each row execute function public.set_marketing_updated_at();

drop trigger if exists marketing_content_calendar_items_set_updated_at
  on public.marketing_content_calendar_items;
create trigger marketing_content_calendar_items_set_updated_at
  before update on public.marketing_content_calendar_items
  for each row execute function public.set_marketing_updated_at();

drop trigger if exists marketing_content_assets_set_updated_at
  on public.marketing_content_assets;
create trigger marketing_content_assets_set_updated_at
  before update on public.marketing_content_assets
  for each row execute function public.set_marketing_updated_at();

alter table public.marketing_intelligence_items enable row level security;
alter table public.marketing_content_calendar_items enable row level security;
alter table public.marketing_content_assets enable row level security;
alter table public.marketing_performance_snapshots enable row level security;

drop policy if exists marketing_intelligence_items_select on public.marketing_intelligence_items;
create policy marketing_intelligence_items_select
  on public.marketing_intelligence_items
  for select
  to authenticated
  using (
    public.current_is_app_admin()
    or project_id is null
    or public.current_is_project_member(project_id::bigint)
  );

drop policy if exists marketing_intelligence_items_service_write on public.marketing_intelligence_items;
create policy marketing_intelligence_items_service_write
  on public.marketing_intelligence_items
  for all
  to service_role
  using (true)
  with check (true);

drop policy if exists marketing_content_calendar_items_select on public.marketing_content_calendar_items;
create policy marketing_content_calendar_items_select
  on public.marketing_content_calendar_items
  for select
  to authenticated
  using (
    public.current_is_app_admin()
    or project_id is null
    or public.current_is_project_member(project_id::bigint)
  );

drop policy if exists marketing_content_calendar_items_service_write on public.marketing_content_calendar_items;
create policy marketing_content_calendar_items_service_write
  on public.marketing_content_calendar_items
  for all
  to service_role
  using (true)
  with check (true);

drop policy if exists marketing_content_assets_select on public.marketing_content_assets;
create policy marketing_content_assets_select
  on public.marketing_content_assets
  for select
  to authenticated
  using (
    public.current_is_app_admin()
    or exists (
      select 1
      from public.marketing_content_calendar_items item
      where item.id = marketing_content_assets.calendar_item_id
        and (item.project_id is null or public.current_is_project_member(item.project_id::bigint))
    )
  );

drop policy if exists marketing_content_assets_service_write on public.marketing_content_assets;
create policy marketing_content_assets_service_write
  on public.marketing_content_assets
  for all
  to service_role
  using (true)
  with check (true);

drop policy if exists marketing_performance_snapshots_select on public.marketing_performance_snapshots;
create policy marketing_performance_snapshots_select
  on public.marketing_performance_snapshots
  for select
  to authenticated
  using (
    public.current_is_app_admin()
    or exists (
      select 1
      from public.marketing_content_calendar_items item
      where item.id = marketing_performance_snapshots.calendar_item_id
        and (item.project_id is null or public.current_is_project_member(item.project_id::bigint))
    )
    or exists (
      select 1
      from public.marketing_content_assets asset
      join public.marketing_content_calendar_items item
        on item.id = asset.calendar_item_id
      where asset.id = marketing_performance_snapshots.asset_id
        and (item.project_id is null or public.current_is_project_member(item.project_id::bigint))
    )
  );

drop policy if exists marketing_performance_snapshots_service_write on public.marketing_performance_snapshots;
create policy marketing_performance_snapshots_service_write
  on public.marketing_performance_snapshots
  for all
  to service_role
  using (true)
  with check (true);

grant all on public.marketing_intelligence_items to service_role;
grant all on public.marketing_content_calendar_items to service_role;
grant all on public.marketing_content_assets to service_role;
grant all on public.marketing_performance_snapshots to service_role;

comment on table public.marketing_intelligence_items is
  'Source-backed marketing opportunities, project wins, owner updates, leadership ideas, and market signals used by the CMO agent.';
comment on table public.marketing_content_calendar_items is
  'Reviewable CMO content calendar plans with source rationale, channel, funnel stage, and approval state.';
comment on table public.marketing_content_assets is
  'Draft marketing assets tied to calendar items; drafts are not approved for publishing until reviewed.';
comment on table public.marketing_performance_snapshots is
  'Manual or synced performance measurements for marketing assets and calendar items.';
