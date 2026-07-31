-- ALL-28: persisted, per-user Skill Wheel self-evaluations.
-- The training library remains the canonical role catalog; this migration adds
-- role skill definitions plus dated user-owned snapshots.

create table if not exists public.training_role_skill (
  id uuid primary key default gen_random_uuid(),
  role_id uuid references public.training_role(id) on delete cascade,
  is_core boolean not null default false,
  slug text not null,
  name text not null,
  description text not null,
  importance smallint not null default 3,
  sort_order integer not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint training_role_skill_scope_check check (
    (is_core and role_id is null)
    or (not is_core and role_id is not null)
  ),
  constraint training_role_skill_slug_check check (
    slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'
  ),
  constraint training_role_skill_name_check check (
    char_length(btrim(name)) between 1 and 120
  ),
  constraint training_role_skill_description_check check (
    char_length(btrim(description)) between 1 and 500
  ),
  constraint training_role_skill_importance_check check (
    importance between 1 and 5
  ),
  constraint training_role_skill_sort_order_check check (sort_order >= 0)
);

create unique index if not exists training_role_skill_core_slug_key
  on public.training_role_skill(slug)
  where is_core;

create unique index if not exists training_role_skill_role_slug_key
  on public.training_role_skill(role_id, slug)
  where not is_core;

create index if not exists training_role_skill_active_role_sort_idx
  on public.training_role_skill(active, role_id, sort_order, name);

create table if not exists public.training_skill_checkin (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid()
    references auth.users(id) on delete cascade,
  role_id uuid references public.training_role(id) on delete restrict,
  role_name text not null,
  role_context_key text generated always as (
    coalesce(role_id::text, 'alleato-core')
  ) stored,
  checkin_date date not null,
  scores jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint training_skill_checkin_role_name_check check (
    char_length(btrim(role_name)) between 1 and 120
  ),
  constraint training_skill_checkin_core_role_check check (
    role_id is not null or role_name = 'Alleato Core'
  ),
  constraint training_skill_checkin_scores_array_check check (
    jsonb_typeof(scores) = 'array'
    and jsonb_array_length(scores) between 1 and 20
  ),
  constraint training_skill_checkin_user_role_date_key unique (
    user_id,
    role_context_key,
    checkin_date
  )
);

create index if not exists training_skill_checkin_user_date_idx
  on public.training_skill_checkin(user_id, checkin_date desc, created_at desc);

drop trigger if exists set_training_role_skill_updated_at
  on public.training_role_skill;
create trigger set_training_role_skill_updated_at
before update on public.training_role_skill
for each row execute function public.set_updated_at();

drop trigger if exists set_training_skill_checkin_updated_at
  on public.training_skill_checkin;
create trigger set_training_skill_checkin_updated_at
before update on public.training_skill_checkin
for each row execute function public.set_updated_at();

alter table public.training_role_skill enable row level security;
alter table public.training_skill_checkin enable row level security;

drop policy if exists training_role_skill_authenticated_select
  on public.training_role_skill;
create policy training_role_skill_authenticated_select
on public.training_role_skill
for select
to authenticated
using (active or public.current_is_app_admin());

drop policy if exists training_role_skill_admin_insert
  on public.training_role_skill;
create policy training_role_skill_admin_insert
on public.training_role_skill
for insert
to authenticated
with check (public.current_is_app_admin());

drop policy if exists training_role_skill_admin_update
  on public.training_role_skill;
create policy training_role_skill_admin_update
on public.training_role_skill
for update
to authenticated
using (public.current_is_app_admin())
with check (public.current_is_app_admin());

drop policy if exists training_role_skill_admin_delete
  on public.training_role_skill;
create policy training_role_skill_admin_delete
on public.training_role_skill
for delete
to authenticated
using (public.current_is_app_admin());

drop policy if exists training_skill_checkin_own_select
  on public.training_skill_checkin;
create policy training_skill_checkin_own_select
on public.training_skill_checkin
for select
to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists training_skill_checkin_own_insert
  on public.training_skill_checkin;
create policy training_skill_checkin_own_insert
on public.training_skill_checkin
for insert
to authenticated
with check ((select auth.uid()) = user_id);

drop policy if exists training_skill_checkin_own_update
  on public.training_skill_checkin;
create policy training_skill_checkin_own_update
on public.training_skill_checkin
for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

drop policy if exists training_skill_checkin_own_delete
  on public.training_skill_checkin;
create policy training_skill_checkin_own_delete
on public.training_skill_checkin
for delete
to authenticated
using ((select auth.uid()) = user_id);

revoke all on public.training_role_skill from anon;
revoke all on public.training_skill_checkin from anon;
grant select on public.training_role_skill to authenticated;
grant insert, select, update, delete
  on public.training_skill_checkin to authenticated;
grant all on public.training_role_skill to service_role;
grant all on public.training_skill_checkin to service_role;

comment on table public.training_role_skill is
  'Canonical role and Alleato Core skills used by the Training Skill Wheel.';
comment on column public.training_role_skill.importance is
  'Governed 1-5 impact multiplier used with the learner target gap.';
comment on table public.training_skill_checkin is
  'Dated, user-owned snapshots of Skill Wheel current and target scores.';
comment on column public.training_skill_checkin.scores is
  'Canonical skill snapshots shaped as [{skillId,name,score,target,importance,isCore}].';

insert into public.training_role_skill (
  role_id,
  is_core,
  slug,
  name,
  description,
  importance,
  sort_order
)
values
  (
    null,
    true,
    'ownership-reliability',
    'Ownership & Reliability',
    'Own your work and your growth. Do what you said you would do, on time, without being chased.',
    3,
    10
  ),
  (
    null,
    true,
    'communication-documentation',
    'Communication & Documentation',
    'Clear and timely, written and verbal. Leave a clean record others can follow.',
    3,
    20
  ),
  (
    null,
    true,
    'self-teaching-ai',
    'Self-Teaching & AI',
    'Learn first: try it, look it up, use Claude, then bring a sharper question.',
    3,
    30
  ),
  (
    null,
    true,
    'problem-solving-1-3-1',
    'Problem-Solving (1-3-1)',
    'Bring one problem, three possible solutions, and your one recommendation.',
    3,
    40
  ),
  (
    null,
    true,
    'alleato-way-sops',
    'The Alleato Way (SOPs)',
    'Know and follow our standard process, and help make it better.',
    3,
    50
  )
on conflict do nothing;

with skill_seed (
  role_slug,
  slug,
  name,
  description,
  sort_order
) as (
  values
    (
      'project-engineer',
      'reading-drawings',
      'Reading Drawings',
      'Civil, architectural, structural and MEP sets: reading them together and catching conflicts.',
      10
    ),
    (
      'project-engineer',
      'rfis-submittals',
      'RFIs & Submittals',
      'Writing clear RFIs and logging and tracking submittals against the specs.',
      20
    ),
    (
      'project-engineer',
      'communication-documentation',
      'Communication & Documentation',
      'Daily reports, meeting minutes, photo documentation, and clean written follow-up.',
      30
    ),
    (
      'project-engineer',
      'scheduling-logic',
      'Scheduling Logic',
      'Look-aheads and MS Project: sequence, float, start-to-start, and lag.',
      40
    ),
    (
      'project-engineer',
      'subcontractor-coordination',
      'Subcontractor Coordination',
      'Coordinating trades in the field, holding scope, and running short-interval work.',
      50
    ),
    (
      'project-engineer',
      'sop-process-adherence',
      'SOP & Process Adherence',
      'Doing it the Alleato way by following the standard process every time.',
      60
    ),
    (
      'project-engineer',
      'budget-cost-awareness',
      'Budget & Cost Awareness',
      'Cost codes, change orders, and understanding how field decisions affect the budget.',
      70
    ),
    (
      'project-engineer',
      'construction-software-ai',
      'Construction Software & AI',
      'Alleato PM, Bluebeam, MS Project, and using Claude to teach yourself faster.',
      80
    ),
    (
      'assistant-superintendent',
      'field-safety-osha',
      'Field Safety & OSHA',
      'Owning a safe site through pre-task planning, hazard spotting, and holding the safety standard every day.',
      10
    ),
    (
      'assistant-superintendent',
      'subcontractor-coordination',
      'Subcontractor Coordination',
      'Running the trades in the field, holding scope and sequence, and keeping crews productive.',
      20
    ),
    (
      'assistant-superintendent',
      'reading-drawings',
      'Reading Drawings',
      'Working the plans in the field and catching conflicts before they get built.',
      30
    ),
    (
      'assistant-superintendent',
      'scheduling-look-aheads',
      'Scheduling & Look-Aheads',
      'Building and running the three-week look-ahead and keeping the field ahead of the schedule.',
      40
    ),
    (
      'assistant-superintendent',
      'quality-control-inspections',
      'Quality Control & Inspections',
      'Inspecting work against specs, catching rework early, and preparing for AHJ inspections.',
      50
    ),
    (
      'assistant-superintendent',
      'daily-reports-documentation',
      'Daily Reports & Documentation',
      'Daily logs, photo documentation, and a clean written record of what happened on site.',
      60
    ),
    (
      'assistant-superintendent',
      'site-logistics-materials',
      'Site Logistics & Materials',
      'Staging, deliveries, laydown, and keeping the site organized and flowing.',
      70
    ),
    (
      'assistant-superintendent',
      'construction-software-ai',
      'Construction Software & AI',
      'Alleato PM, Bluebeam, MS Project, and using Claude to teach yourself faster.',
      80
    ),
    (
      'superintendent',
      'schedule-ownership',
      'Schedule Ownership',
      'Owning the CPM and look-aheads through sequencing, recovery, and driving the job to finish on time.',
      10
    ),
    (
      'superintendent',
      'subcontractor-management',
      'Subcontractor Management',
      'Holding subcontractors accountable to scope, schedule, and quality while running productive coordination.',
      20
    ),
    (
      'superintendent',
      'field-safety-leadership',
      'Field Safety Leadership',
      'Setting the safety culture for the whole site, not just following the rules.',
      30
    ),
    (
      'superintendent',
      'quality-control-inspections',
      'Quality Control & Inspections',
      'Owning the quality-control program, punch, and inspection readiness across all trades.',
      40
    ),
    (
      'superintendent',
      'spec-drawing-coordination',
      'Spec & Drawing Coordination',
      'Reconciling drawings, specs, and submittals in the field and resolving conflicts.',
      50
    ),
    (
      'superintendent',
      'owner-architect-communication',
      'Owner & Architect Communication',
      'Representing Alleato in the field through clear, professional updates and issue resolution.',
      60
    ),
    (
      'superintendent',
      'cost-change-awareness',
      'Cost & Change Awareness',
      'Understanding how field decisions affect budget and documenting changes and impacts.',
      70
    ),
    (
      'superintendent',
      'developing-people',
      'Developing People',
      'Coaching assistant superintendents and foremen and teaching the Alleato way.',
      80
    ),
    (
      'assistant-project-manager',
      'rfis-submittals',
      'RFIs & Submittals',
      'Managing the RFI and submittal logs end to end and tracking against specs and schedule.',
      10
    ),
    (
      'assistant-project-manager',
      'budget-cost-tracking',
      'Budget & Cost Tracking',
      'Cost codes, commitments, invoices, and keeping the project cost report accurate.',
      20
    ),
    (
      'assistant-project-manager',
      'communication-documentation',
      'Communication & Documentation',
      'Meeting minutes, correspondence, and a clean, defensible project record.',
      30
    ),
    (
      'assistant-project-manager',
      'contracts-subcontracts',
      'Contracts & Subcontracts',
      'Administering subcontracts and purchase orders: scope, exhibits, insurance, and compliance.',
      40
    ),
    (
      'assistant-project-manager',
      'change-order-management',
      'Change Order Management',
      'Pricing, documenting, and tracking changes from field to owner.',
      50
    ),
    (
      'assistant-project-manager',
      'scheduling-support',
      'Scheduling Support',
      'Helping build and update the schedule and understanding sequence, float, and lag.',
      60
    ),
    (
      'assistant-project-manager',
      'procurement-buyout',
      'Procurement & Buyout',
      'Supporting buyout by leveling bids, writing scopes, and tracking long-lead items.',
      70
    ),
    (
      'assistant-project-manager',
      'construction-software-ai',
      'Construction Software & AI',
      'Alleato PM, Bluebeam, MS Project, and using Claude to teach yourself faster.',
      80
    ),
    (
      'project-manager',
      'budget-financial-management',
      'Budget & Financial Management',
      'Owning cost control, forecasting, billings, and protecting project margin.',
      10
    ),
    (
      'project-manager',
      'schedule-management',
      'Schedule Management',
      'Owning the master schedule, driving recovery, and managing float and milestones.',
      20
    ),
    (
      'project-manager',
      'client-owner-relationships',
      'Client & Owner Relationships',
      'Being the face of Alleato through trust, expectation management, and clear communication.',
      30
    ),
    (
      'project-manager',
      'contracts-risk-management',
      'Contracts & Risk Management',
      'Managing the prime contract, subcontracts, insurance, and project risk proactively.',
      40
    ),
    (
      'project-manager',
      'change-orders-claims',
      'Change Orders & Claims',
      'Negotiating and documenting changes and protecting the company on claims.',
      50
    ),
    (
      'project-manager',
      'buyout-subcontractor-management',
      'Buyout & Subcontractor Management',
      'Writing scopes, leveling bids, and holding subcontractors accountable through closeout.',
      60
    ),
    (
      'project-manager',
      'developing-people',
      'Developing People',
      'Coaching assistant project managers and engineers and building the next layer of the team.',
      70
    ),
    (
      'project-manager',
      'communication-documentation',
      'Communication & Documentation',
      'Clear correspondence, meeting leadership, and a defensible project record.',
      80
    ),
    (
      'estimator',
      'quantity-takeoffs',
      'Quantity Takeoffs',
      'Accurate, complete takeoffs from drawings: the foundation of a good number.',
      10
    ),
    (
      'estimator',
      'pricing-cost-data',
      'Pricing & Cost Data',
      'Building pricing from historical cost, unit rates, and current market conditions.',
      20
    ),
    (
      'estimator',
      'reading-drawings-specs',
      'Reading Drawings & Specs',
      'Fully understanding the design intent, specs, and what is actually being asked for.',
      30
    ),
    (
      'estimator',
      'scope-review-gap-analysis',
      'Scope Review & Gap Analysis',
      'Finding scope gaps and overlaps before they become buyout or field problems.',
      40
    ),
    (
      'estimator',
      'bid-management-sub-coverage',
      'Bid Management & Sub Coverage',
      'Soliciting subcontractors, driving coverage, and managing the bid-day process.',
      50
    ),
    (
      'estimator',
      'value-engineering-constructability',
      'Value Engineering & Constructability',
      'Offering smarter, less expensive, more buildable alternatives without losing intent.',
      60
    ),
    (
      'estimator',
      'subcontractor-vendor-relationships',
      'Subcontractor & Vendor Relationships',
      'Building the subcontractor and vendor network that produces strong, reliable pricing.',
      70
    ),
    (
      'estimator',
      'estimating-software-ai',
      'Estimating Software & AI',
      'Takeoff software, Bluebeam, Alleato tools, and using Claude to work faster.',
      80
    )
)
insert into public.training_role_skill (
  role_id,
  is_core,
  slug,
  name,
  description,
  importance,
  sort_order
)
select
  role.id,
  false,
  skill_seed.slug,
  skill_seed.name,
  skill_seed.description,
  3,
  skill_seed.sort_order
from skill_seed
join public.training_role as role
  on role.slug = skill_seed.role_slug
on conflict do nothing;

do $$
declare
  seeded_role_count integer;
  seeded_skill_count integer;
begin
  select count(*)
  into seeded_role_count
  from public.training_role
  where slug in (
    'project-engineer',
    'assistant-project-manager',
    'project-manager',
    'estimator',
    'assistant-superintendent',
    'superintendent'
  );

  if seeded_role_count <> 6 then
    raise exception
      'Training Skill Wheel seed expected 6 canonical roles but found %.',
      seeded_role_count;
  end if;

  select count(*)
  into seeded_skill_count
  from public.training_role_skill as skill
  join public.training_role as role on role.id = skill.role_id
  where role.slug in (
    'project-engineer',
    'assistant-project-manager',
    'project-manager',
    'estimator',
    'assistant-superintendent',
    'superintendent'
  )
    and skill.active;

  if seeded_skill_count <> 48 then
    raise exception
      'Training Skill Wheel seed expected 48 active role skills but found %.',
      seeded_skill_count;
  end if;
end
$$;
