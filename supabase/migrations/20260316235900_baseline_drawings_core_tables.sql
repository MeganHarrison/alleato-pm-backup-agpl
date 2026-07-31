-- Baseline drawings core tables that existed in the linked database before
-- the checked-in drawing policy, pin, and relationship migrations.
--
-- This keeps a fresh migration replay from creating link tables that reference
-- drawings before the drawings schema exists.

create table if not exists public.drawing_sets (
  id uuid primary key default gen_random_uuid(),
  project_id integer not null references public.projects(id) on delete cascade,
  name varchar not null,
  issued_at timestamptz not null,
  status varchar not null default 'active'
    check (status in ('active', 'archived')),
  description text,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now()),
  constraint unique_set_name_per_project unique (project_id, name)
);

create table if not exists public.drawing_areas (
  id uuid primary key default gen_random_uuid(),
  project_id integer not null references public.projects(id) on delete cascade,
  parent_area_id uuid references public.drawing_areas(id) on delete set null,
  name varchar not null,
  description text,
  sort_order integer not null default 0,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now()),
  constraint unique_drawing_area_name_per_project unique (project_id, parent_area_id, name)
);

create table if not exists public.drawings (
  id uuid primary key default gen_random_uuid(),
  project_id integer not null references public.projects(id) on delete cascade,
  area_id uuid references public.drawing_areas(id) on delete set null,
  drawing_number varchar not null,
  title varchar not null,
  discipline varchar,
  drawing_type varchar,
  current_revision_id uuid,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now()),
  is_published boolean not null default true,
  is_obsolete boolean not null default false,
  deleted_at timestamptz,
  deleted_by uuid references auth.users(id),
  constraint unique_drawing_number_per_project unique (project_id, drawing_number)
);

create table if not exists public.drawing_revisions (
  id uuid primary key default gen_random_uuid(),
  drawing_id uuid not null references public.drawings(id) on delete cascade,
  revision_number varchar not null default 'A',
  drawing_set_id uuid references public.drawing_sets(id) on delete set null,
  drawing_date date,
  received_date date not null default current_date,
  status varchar not null default 'under_review'
    check (status in ('draft', 'under_review', 'approved', 'superseded', 'void')),
  file_url text not null,
  file_name varchar not null,
  file_size bigint not null constraint positive_file_size check (file_size > 0),
  file_type varchar not null,
  is_current_revision boolean not null default false,
  description text,
  uploaded_by uuid not null references auth.users(id),
  created_at timestamptz not null default timezone('utc'::text, now()),
  constraint unique_revision_per_drawing unique (drawing_id, revision_number)
);

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'fk_drawings_current_revision'
      and conrelid = 'public.drawings'::regclass
  ) then
    alter table public.drawings
      add constraint fk_drawings_current_revision
      foreign key (current_revision_id)
      references public.drawing_revisions(id)
      on delete set null;
  end if;
end $$;

create index if not exists idx_drawing_sets_project_id on public.drawing_sets(project_id);
create index if not exists idx_drawing_sets_status on public.drawing_sets(status);
create index if not exists idx_drawing_areas_project_id on public.drawing_areas(project_id);
create index if not exists idx_drawing_areas_parent_id on public.drawing_areas(parent_area_id);
create index if not exists idx_drawing_areas_sort_order on public.drawing_areas(sort_order);
create index if not exists idx_drawings_project_id on public.drawings(project_id);
create index if not exists idx_drawings_area_id on public.drawings(area_id);
create index if not exists idx_drawings_number on public.drawings(drawing_number);
create index if not exists idx_drawings_discipline on public.drawings(discipline);
create index if not exists idx_drawings_type on public.drawings(drawing_type);
create index if not exists idx_drawings_deleted_at on public.drawings(deleted_at) where deleted_at is null;
create index if not exists idx_drawings_is_published on public.drawings(is_published);
create index if not exists idx_drawings_is_obsolete on public.drawings(is_obsolete);
create index if not exists idx_drawing_revisions_drawing_id on public.drawing_revisions(drawing_id);
create index if not exists idx_drawing_revisions_status on public.drawing_revisions(status);
create index if not exists idx_drawing_revisions_received_date on public.drawing_revisions(received_date);
create index if not exists idx_drawing_revisions_current on public.drawing_revisions(is_current_revision);

alter table public.drawing_sets enable row level security;
alter table public.drawing_areas enable row level security;
alter table public.drawings enable row level security;
alter table public.drawing_revisions enable row level security;
