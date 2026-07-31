begin;

alter table public.crm_deals
  add column if not exists forecast_category text not null default 'pipeline'
    check (forecast_category in ('pipeline', 'best_case', 'commit', 'omitted')),
  add column if not exists pursuit_type text
    check (pursuit_type is null or pursuit_type in ('negotiated', 'invited_bid', 'public_bid', 'service', 'other')),
  add column if not exists bid_due_date timestamptz,
  add column if not exists qualification_score integer
    check (qualification_score is null or qualification_score between 0 and 100),
  add column if not exists win_loss_notes text;

create table if not exists public.crm_microsoft_connections (
  person_id uuid primary key references public.people(id) on delete cascade,
  connection_status text not null default 'disconnected'
    check (connection_status in ('disconnected', 'consent_required', 'connected', 'degraded', 'error')),
  mail_connected boolean not null default false,
  calendar_connected boolean not null default false,
  granted_scopes text[] not null default '{}',
  privacy_mode text not null default 'business_only'
    check (privacy_mode in ('business_only', 'selected_folders', 'disabled')),
  automatic_matching_enabled boolean not null default false,
  last_successful_sync_at timestamptz,
  last_error text,
  updated_at timestamptz not null default now(),
  constraint crm_microsoft_connection_truth check (
    connection_status <> 'connected'
    or mail_connected
    or calendar_connected
  )
);

create table if not exists public.crm_forecast_snapshots (
  id uuid primary key default gen_random_uuid(),
  snapshot_week date not null,
  owner_person_id uuid not null references public.people(id) on delete restrict,
  category text not null check (category in ('pipeline', 'best_case', 'commit', 'omitted')),
  deal_count integer not null check (deal_count >= 0),
  total_value numeric(14,2) not null check (total_value >= 0),
  weighted_value numeric(14,2) not null check (weighted_value >= 0),
  captured_by_person_id uuid not null references public.people(id) on delete restrict,
  captured_at timestamptz not null default now(),
  unique (snapshot_week, owner_person_id, category)
);

create table if not exists public.crm_stage_requirements (
  id uuid primary key default gen_random_uuid(),
  stage_id uuid not null references public.crm_stages(id) on delete cascade,
  label text not null check (length(btrim(label)) between 1 and 200),
  requirement_key text not null check (length(btrim(requirement_key)) between 1 and 80),
  is_required boolean not null default true,
  guidance text,
  sort_order integer not null default 0 check (sort_order >= 0),
  created_by_person_id uuid not null references public.people(id) on delete restrict,
  updated_by_person_id uuid not null references public.people(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (stage_id, requirement_key)
);

create table if not exists public.crm_sales_assets (
  id uuid primary key default gen_random_uuid(),
  asset_type text not null
    check (asset_type in ('cadence', 'playbook', 'email_template', 'meeting_template')),
  name text not null check (length(btrim(name)) between 1 and 200),
  description text,
  steps jsonb not null default '[]'::jsonb check (jsonb_typeof(steps) = 'array'),
  approval_status text not null default 'draft'
    check (approval_status in ('draft', 'pending_review', 'approved', 'retired')),
  created_by_person_id uuid not null references public.people(id) on delete restrict,
  approved_by_person_id uuid references public.people(id) on delete restrict,
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint crm_sales_assets_approval_truth check (
    (approval_status = 'approved' and approved_by_person_id is not null and approved_at is not null)
    or approval_status <> 'approved'
  )
);

create table if not exists public.crm_relationship_intelligence (
  id uuid primary key default gen_random_uuid(),
  company_id uuid references public.companies(id) on delete cascade,
  lead_id uuid references public.crm_leads(id) on delete cascade,
  intelligence_type text not null check (
    intelligence_type in (
      'account_plan',
      'stakeholder',
      'company_hierarchy',
      'duplicate_candidate',
      'subcontractor_qualification',
      'partner_performance',
      'buildingconnected_import',
      'pursuit_outcome'
    )
  ),
  title text not null check (length(btrim(title)) between 1 and 240),
  status text not null default 'active'
    check (status in ('draft', 'active', 'needs_review', 'approved', 'rejected', 'archived')),
  details jsonb not null default '{}'::jsonb check (jsonb_typeof(details) = 'object'),
  source_system text not null default 'manual'
    check (source_system in ('manual', 'buildingconnected_csv', 'alleato_pm', 'crm')),
  source_reference text,
  created_by_person_id uuid not null references public.people(id) on delete restrict,
  reviewed_by_person_id uuid references public.people(id) on delete restrict,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint crm_relationship_intelligence_target check (
    num_nonnulls(company_id, lead_id) = 1
  )
);

create table if not exists public.crm_ai_artifacts (
  id uuid primary key default gen_random_uuid(),
  artifact_type text not null check (
    artifact_type in (
      'deal_summary',
      'account_summary',
      'meeting_prep',
      'task_extraction',
      'follow_up_draft',
      'next_best_action',
      'natural_language_answer'
    )
  ),
  company_id uuid references public.companies(id) on delete cascade,
  lead_id uuid references public.crm_leads(id) on delete cascade,
  deal_id uuid references public.crm_deals(id) on delete cascade,
  title text not null check (length(btrim(title)) between 1 and 240),
  content text not null check (length(btrim(content)) > 0),
  citations jsonb not null default '[]'::jsonb check (jsonb_typeof(citations) = 'array'),
  explanation text not null,
  review_status text not null default 'draft'
    check (review_status in ('draft', 'approved', 'rejected', 'applied')),
  created_by_person_id uuid not null references public.people(id) on delete restrict,
  reviewed_by_person_id uuid references public.people(id) on delete restrict,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint crm_ai_artifacts_target check (
    num_nonnulls(company_id, lead_id, deal_id) between 1 and 2
  ),
  constraint crm_ai_artifacts_review_truth check (
    (review_status in ('approved', 'rejected', 'applied') and reviewed_by_person_id is not null and reviewed_at is not null)
    or review_status = 'draft'
  )
);

create index if not exists crm_forecast_snapshots_week_idx
  on public.crm_forecast_snapshots(snapshot_week desc, category);
create index if not exists crm_relationship_intelligence_company_idx
  on public.crm_relationship_intelligence(company_id, intelligence_type)
  where company_id is not null and status <> 'archived';
create index if not exists crm_relationship_intelligence_lead_idx
  on public.crm_relationship_intelligence(lead_id, intelligence_type)
  where lead_id is not null and status <> 'archived';
create index if not exists crm_ai_artifacts_deal_idx
  on public.crm_ai_artifacts(deal_id, artifact_type, created_at desc)
  where deal_id is not null;

drop trigger if exists crm_stage_requirements_touch on public.crm_stage_requirements;
create trigger crm_stage_requirements_touch
before update on public.crm_stage_requirements
for each row execute function public.set_updated_at();

drop trigger if exists crm_sales_assets_touch on public.crm_sales_assets;
create trigger crm_sales_assets_touch
before update on public.crm_sales_assets
for each row execute function public.set_updated_at();

drop trigger if exists crm_relationship_intelligence_touch on public.crm_relationship_intelligence;
create trigger crm_relationship_intelligence_touch
before update on public.crm_relationship_intelligence
for each row execute function public.set_updated_at();

drop trigger if exists crm_ai_artifacts_touch on public.crm_ai_artifacts;
create trigger crm_ai_artifacts_touch
before update on public.crm_ai_artifacts
for each row execute function public.set_updated_at();

alter table public.crm_microsoft_connections enable row level security;
alter table public.crm_forecast_snapshots enable row level security;
alter table public.crm_stage_requirements enable row level security;
alter table public.crm_sales_assets enable row level security;
alter table public.crm_relationship_intelligence enable row level security;
alter table public.crm_ai_artifacts enable row level security;

create policy crm_microsoft_connections_owner_read
on public.crm_microsoft_connections for select to authenticated
using (
  person_id = public.current_person_id()
  and public.current_has_company_module_permission('crm', 'read')
);
create policy crm_microsoft_connections_owner_preferences
on public.crm_microsoft_connections for insert to authenticated
with check (
  person_id = public.current_person_id()
  and connection_status in ('disconnected', 'consent_required')
  and not mail_connected
  and not calendar_connected
  and cardinality(granted_scopes) = 0
  and public.current_has_company_module_permission('crm', 'write')
);
create policy crm_microsoft_connections_owner_update_preferences
on public.crm_microsoft_connections for update to authenticated
using (
  person_id = public.current_person_id()
  and public.current_has_company_module_permission('crm', 'write')
)
with check (
  person_id = public.current_person_id()
  and public.current_has_company_module_permission('crm', 'write')
);
create policy crm_microsoft_connections_service
on public.crm_microsoft_connections for all to service_role
using (true) with check (true);

create policy crm_forecast_snapshots_read
on public.crm_forecast_snapshots for select to authenticated
using (public.current_has_company_module_permission('crm', 'read'));
create policy crm_forecast_snapshots_admin
on public.crm_forecast_snapshots for all to authenticated
using (public.current_has_company_module_permission('crm', 'admin'))
with check (public.current_has_company_module_permission('crm', 'admin'));

create policy crm_stage_requirements_read
on public.crm_stage_requirements for select to authenticated
using (public.current_has_company_module_permission('crm', 'read'));
create policy crm_stage_requirements_admin
on public.crm_stage_requirements for all to authenticated
using (public.current_has_company_module_permission('crm', 'admin'))
with check (public.current_has_company_module_permission('crm', 'admin'));

create policy crm_sales_assets_read
on public.crm_sales_assets for select to authenticated
using (public.current_has_company_module_permission('crm', 'read'));
create policy crm_sales_assets_write
on public.crm_sales_assets for insert to authenticated
with check (
  public.current_has_company_module_permission('crm', 'write')
  and created_by_person_id = public.current_person_id()
  and approval_status <> 'approved'
);
create policy crm_sales_assets_owner_update
on public.crm_sales_assets for update to authenticated
using (
  public.current_has_company_module_permission('crm', 'admin')
  or (
    public.current_has_company_module_permission('crm', 'write')
    and created_by_person_id = public.current_person_id()
  )
)
with check (
  public.current_has_company_module_permission('crm', 'admin')
  or (
    created_by_person_id = public.current_person_id()
    and approval_status <> 'approved'
  )
);

create policy crm_relationship_intelligence_read
on public.crm_relationship_intelligence for select to authenticated
using (public.current_has_company_module_permission('crm', 'read'));
create policy crm_relationship_intelligence_write
on public.crm_relationship_intelligence for insert to authenticated
with check (
  public.current_has_company_module_permission('crm', 'write')
  and created_by_person_id = public.current_person_id()
);
create policy crm_relationship_intelligence_owner_update
on public.crm_relationship_intelligence for update to authenticated
using (
  public.current_has_company_module_permission('crm', 'admin')
  or (
    public.current_has_company_module_permission('crm', 'write')
    and created_by_person_id = public.current_person_id()
  )
)
with check (
  public.current_has_company_module_permission('crm', 'admin')
  or created_by_person_id = public.current_person_id()
);

create policy crm_ai_artifacts_read
on public.crm_ai_artifacts for select to authenticated
using (public.current_has_company_module_permission('crm', 'read'));
create policy crm_ai_artifacts_write
on public.crm_ai_artifacts for insert to authenticated
with check (
  public.current_has_company_module_permission('crm', 'write')
  and created_by_person_id = public.current_person_id()
  and review_status = 'draft'
);
create policy crm_ai_artifacts_owner_update
on public.crm_ai_artifacts for update to authenticated
using (
  public.current_has_company_module_permission('crm', 'admin')
  or (
    public.current_has_company_module_permission('crm', 'write')
    and created_by_person_id = public.current_person_id()
  )
)
with check (
  public.current_has_company_module_permission('crm', 'admin')
  or created_by_person_id = public.current_person_id()
);

grant select on
  public.crm_microsoft_connections,
  public.crm_forecast_snapshots,
  public.crm_stage_requirements,
  public.crm_sales_assets,
  public.crm_relationship_intelligence,
  public.crm_ai_artifacts
to authenticated;
grant insert, update on
  public.crm_microsoft_connections,
  public.crm_sales_assets,
  public.crm_relationship_intelligence,
  public.crm_ai_artifacts
to authenticated;
grant insert, update, delete on
  public.crm_forecast_snapshots,
  public.crm_stage_requirements
to authenticated;
grant all on public.crm_microsoft_connections to service_role;

insert into public.crm_stage_requirements (
  stage_id,
  label,
  requirement_key,
  is_required,
  guidance,
  sort_order,
  created_by_person_id,
  updated_by_person_id
)
select
  stage.id,
  requirement.label,
  requirement.requirement_key,
  true,
  requirement.guidance,
  requirement.sort_order,
  owner.id,
  owner.id
from public.crm_stages stage
cross join lateral (
  values
    ('Qualified', 'Next action scheduled', 'next_action', 'Next action scheduled in Tasks', 10),
    ('Proposal / Bid', 'Expected close date confirmed', 'expected_close_date', 'Expected close date confirmed', 10),
    ('Proposal / Bid', 'Bid due date recorded', 'bid_due_date', 'Bid or proposal due date recorded', 20),
    ('Negotiation', 'Decision stakeholder identified', 'stakeholder', 'Decision maker or champion identified', 10),
    ('Won', 'Pursuit outcome reviewed', 'outcome_review', 'Pursuit outcome and project handoff reviewed', 10),
    ('Lost', 'Loss reason recorded', 'loss_reason', 'Structured loss reason recorded', 10)
) as requirement(stage_name, label, requirement_key, guidance, sort_order)
cross join lateral (
  select people.id
  from public.people
  where people.status = 'active' and people.auth_user_id is not null
  order by people.created_at
  limit 1
) owner
where stage.name = requirement.stage_name
on conflict (stage_id, requirement_key) do nothing;

insert into public.crm_sales_assets (
  asset_type,
  name,
  description,
  steps,
  approval_status,
  created_by_person_id,
  approved_by_person_id,
  approved_at
)
select
  seed.asset_type,
  seed.name,
  seed.description,
  seed.steps,
  'approved',
  owner.id,
  owner.id,
  now()
from (
  values
    (
      'cadence',
      'New lead follow-up',
      'A five-business-day first response cadence using the existing Tasks system.',
      '[{"day":0,"type":"call","title":"Call new lead"},{"day":1,"type":"email","title":"Send introduction"},{"day":3,"type":"call","title":"Second call"},{"day":5,"type":"task","title":"Qualify or nurture"}]'::jsonb
    ),
    (
      'playbook',
      'Construction pursuit',
      'Qualification, stakeholders, bid readiness, and project handoff.',
      '[{"day":0,"type":"task","title":"Confirm stakeholders and decision process"},{"day":3,"type":"task","title":"Complete pursuit qualification review"},{"day":7,"type":"task","title":"Confirm bid strategy and due date"},{"day":14,"type":"task","title":"Review outcome and lessons learned"}]'::jsonb
    ),
    (
      'email_template',
      'Post-meeting follow-up',
      'Human-approved recap with commitments and next actions.',
      '[{"section":"summary"},{"section":"decisions"},{"section":"next_actions"}]'::jsonb
    )
) as seed(asset_type, name, description, steps)
cross join lateral (
  select people.id
  from public.people
  where people.status = 'active' and people.auth_user_id is not null
  order by people.created_at
  limit 1
) owner
where not exists (
  select 1 from public.crm_sales_assets asset
  where asset.asset_type = seed.asset_type and lower(asset.name) = lower(seed.name)
);

comment on table public.crm_microsoft_connections is
'Per-user CRM Microsoft readiness and privacy state. OAuth tokens remain in the integration service, never this table.';
comment on table public.crm_ai_artifacts is
'Human-review boundary for evidence-backed CRM AI output. Drafts cannot send email or mutate CRM records autonomously.';
comment on table public.crm_relationship_intelligence is
'CRM-native account, stakeholder, hierarchy, subcontractor, partner, and import review records; Acumatica is not required.';

commit;
