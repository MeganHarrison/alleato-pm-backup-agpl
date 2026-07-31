-- Baseline observations core tables that existed in the linked database before
-- the relationship-link migration began referencing observations.
--
-- This keeps the migration history replayable and lets the migration validator
-- prove observations_project_photos_links has a real parent table.

create table if not exists public.observation_types (
  id uuid primary key default gen_random_uuid(),
  project_id integer references public.projects(id) on delete cascade,
  name text not null,
  category text not null default 'Safety',
  icon text,
  is_default boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.observations (
  id uuid primary key default gen_random_uuid(),
  project_id integer not null references public.projects(id) on delete cascade,
  number text not null,
  title text not null,
  type_id uuid references public.observation_types(id),
  type_name text not null default 'Safety Hazard',
  description text,
  location text,
  status text not null default 'Open'
    check (status in ('Open', 'In Progress', 'Ready for Review', 'Closed')),
  priority text not null default 'Medium'
    check (priority in ('Low', 'Medium', 'High', 'Critical')),
  assignee_company_id uuid,
  assignee_name text,
  due_date date,
  trade text,
  cost_code text,
  root_cause_category text,
  root_cause_description text,
  corrective_action text,
  preventive_action text,
  change_event_id uuid,
  created_by uuid,
  updated_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index if not exists idx_observation_types_project on public.observation_types(project_id);
create index if not exists idx_observations_project on public.observations(project_id);
create index if not exists idx_observations_type on public.observations(type_id);
create index if not exists idx_observations_status on public.observations(status);
create index if not exists idx_observations_priority on public.observations(priority);
create index if not exists idx_observations_deleted on public.observations(deleted_at);

alter table public.observation_types enable row level security;
alter table public.observations enable row level security;
