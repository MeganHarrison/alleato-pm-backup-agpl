create table if not exists public.manpower_plans (
  id uuid primary key default gen_random_uuid(),
  source_label text not null,
  imported_at timestamptz not null default now(),
  imported_by_person_id uuid null references public.people(id) on update cascade on delete set null,
  warning_count integer not null default 0 check (warning_count >= 0),
  is_active boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists manpower_plans_single_active_idx
  on public.manpower_plans (is_active)
  where is_active = true;

create table if not exists public.manpower_projects (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references public.manpower_plans(id) on delete cascade,
  project_id integer null references public.projects(id) on update cascade on delete set null,
  external_code text null,
  project_name text not null,
  stage text not null check (stage in ('active', 'upcoming', 'completed', 'undated')),
  start_date date null,
  finish_date date null,
  start_label text null,
  finish_label text null,
  duration_days integer null,
  duration_label text null,
  notes text null,
  task_mode text null,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists manpower_projects_plan_id_idx
  on public.manpower_projects(plan_id, sort_order);

create index if not exists manpower_projects_project_id_idx
  on public.manpower_projects(project_id);

create table if not exists public.manpower_assignments (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references public.manpower_plans(id) on delete cascade,
  manpower_project_id uuid not null references public.manpower_projects(id) on delete cascade,
  assignee_person_id uuid null references public.people(id) on update cascade on delete set null,
  assignee_name text null,
  role text not null,
  status text not null check (status in ('filled', 'open', 'tbd')),
  start_date date null,
  finish_date date null,
  start_label text null,
  finish_label text null,
  duration_days integer null,
  duration_label text null,
  predecessors text null,
  notes text null,
  task_mode text null,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists manpower_assignments_plan_id_idx
  on public.manpower_assignments(plan_id, sort_order);

create index if not exists manpower_assignments_project_id_idx
  on public.manpower_assignments(manpower_project_id);

create index if not exists manpower_assignments_assignee_person_id_idx
  on public.manpower_assignments(assignee_person_id);

create trigger update_manpower_plans_updated_at
  before update on public.manpower_plans
  for each row
  execute function public.update_updated_at_column();

create trigger update_manpower_projects_updated_at
  before update on public.manpower_projects
  for each row
  execute function public.update_updated_at_column();

create trigger update_manpower_assignments_updated_at
  before update on public.manpower_assignments
  for each row
  execute function public.update_updated_at_column();

alter table public.manpower_plans enable row level security;
alter table public.manpower_projects enable row level security;
alter table public.manpower_assignments enable row level security;

create policy authenticated_read_manpower_plans
  on public.manpower_plans
  for select
  to authenticated
  using (true);

create policy authenticated_insert_manpower_plans
  on public.manpower_plans
  for insert
  to authenticated
  with check (true);

create policy authenticated_update_manpower_plans
  on public.manpower_plans
  for update
  to authenticated
  using (true)
  with check (true);

create policy authenticated_delete_manpower_plans
  on public.manpower_plans
  for delete
  to authenticated
  using (true);

create policy authenticated_read_manpower_projects
  on public.manpower_projects
  for select
  to authenticated
  using (true);

create policy authenticated_insert_manpower_projects
  on public.manpower_projects
  for insert
  to authenticated
  with check (true);

create policy authenticated_update_manpower_projects
  on public.manpower_projects
  for update
  to authenticated
  using (true)
  with check (true);

create policy authenticated_delete_manpower_projects
  on public.manpower_projects
  for delete
  to authenticated
  using (true);

create policy authenticated_read_manpower_assignments
  on public.manpower_assignments
  for select
  to authenticated
  using (true);

create policy authenticated_insert_manpower_assignments
  on public.manpower_assignments
  for insert
  to authenticated
  with check (true);

create policy authenticated_update_manpower_assignments
  on public.manpower_assignments
  for update
  to authenticated
  using (true)
  with check (true);

create policy authenticated_delete_manpower_assignments
  on public.manpower_assignments
  for delete
  to authenticated
  using (true);
