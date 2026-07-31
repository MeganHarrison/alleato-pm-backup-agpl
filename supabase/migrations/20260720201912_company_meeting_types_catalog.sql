-- Governed company catalog for values selectable as meeting categories.
-- Imported document_metadata.meeting_type remains separate source metadata.
create table public.company_meeting_types (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(btrim(name)) between 1 and 100),
  normalized_name text generated always as (lower(btrim(name))) stored,
  sort_order integer not null default 0 check (sort_order >= 0),
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null
);

create unique index company_meeting_types_normalized_name_key
  on public.company_meeting_types (normalized_name);

create index company_meeting_types_active_order_idx
  on public.company_meeting_types (sort_order, name)
  where archived_at is null;

alter table public.company_meeting_types enable row level security;

grant select, insert, update, delete on table public.company_meeting_types to authenticated;

create policy "App admins can manage company meeting types"
  on public.company_meeting_types
  for all
  to authenticated
  using ((select public.current_is_app_admin()))
  with check ((select public.current_is_app_admin()));

create trigger company_meeting_types_set_updated_at
  before update on public.company_meeting_types
  for each row execute function public.set_updated_at();
