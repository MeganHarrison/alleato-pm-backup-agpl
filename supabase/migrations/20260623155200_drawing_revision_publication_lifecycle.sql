-- Move Drawings publication state to revisions while keeping the legacy
-- drawing-level flag as the current-view visibility indicator.

alter table public.drawing_revisions
  add column if not exists is_published boolean not null default false,
  add column if not exists published_at timestamptz,
  add column if not exists published_by uuid references auth.users(id);

alter table public.drawings
  add column if not exists review_revision_id uuid;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'fk_drawings_review_revision'
      and conrelid = 'public.drawings'::regclass
  ) then
    alter table public.drawings
      add constraint fk_drawings_review_revision
      foreign key (review_revision_id)
      references public.drawing_revisions(id)
      on delete set null;
  end if;
end $$;

create index if not exists idx_drawing_revisions_published
  on public.drawing_revisions(drawing_id, is_published, created_at desc);

create index if not exists idx_drawings_review_revision
  on public.drawings(review_revision_id);

update public.drawings
set review_revision_id = current_revision_id
where review_revision_id is null
  and current_revision_id is not null;

update public.drawing_revisions dr
set
  is_published = true,
  published_at = coalesce(dr.published_at, dr.created_at),
  status = case
    when dr.status in ('under_review', 'draft') then 'approved'
    else dr.status
  end
from public.drawings d
where d.current_revision_id = dr.id
  and d.is_published = true
  and dr.is_published = false;

drop view if exists public.drawing_log_review;
drop view if exists public.drawing_log;

create view public.drawing_log as
select
  d.id,
  d.project_id,
  d.area_id,
  d.drawing_number,
  d.title,
  d.discipline,
  d.drawing_type,
  d.is_published,
  d.is_obsolete,
  d.created_at as drawing_created_at,
  d.updated_at as drawing_updated_at,
  d.deleted_at,
  d.deleted_by,
  d.review_revision_id,
  r.id as revision_id,
  r.revision_number,
  r.drawing_date,
  r.received_date,
  r.status,
  r.is_published as revision_is_published,
  r.published_at,
  r.published_by,
  r.file_url,
  r.file_name,
  r.file_size,
  r.file_type,
  r.description as revision_description,
  r.uploaded_by,
  r.created_at as revision_created_at,
  da.name as area_name,
  ds.name as set_name,
  u.email as uploaded_by_email
from public.drawings d
left join public.drawing_revisions r on r.id = d.current_revision_id
left join public.drawing_areas da on da.id = d.area_id
left join public.drawing_sets ds on ds.id = r.drawing_set_id
left join auth.users u on u.id = r.uploaded_by;

create view public.drawing_log_review as
select
  d.id,
  d.project_id,
  d.area_id,
  d.drawing_number,
  d.title,
  d.discipline,
  d.drawing_type,
  d.is_published,
  d.is_obsolete,
  d.created_at as drawing_created_at,
  d.updated_at as drawing_updated_at,
  d.deleted_at,
  d.deleted_by,
  d.review_revision_id,
  r.id as revision_id,
  r.revision_number,
  r.drawing_date,
  r.received_date,
  r.status,
  r.is_published as revision_is_published,
  r.published_at,
  r.published_by,
  r.file_url,
  r.file_name,
  r.file_size,
  r.file_type,
  r.description as revision_description,
  r.uploaded_by,
  r.created_at as revision_created_at,
  da.name as area_name,
  ds.name as set_name,
  u.email as uploaded_by_email
from public.drawings d
left join public.drawing_revisions r
  on r.id = coalesce(d.review_revision_id, d.current_revision_id)
left join public.drawing_areas da on da.id = d.area_id
left join public.drawing_sets ds on ds.id = r.drawing_set_id
left join auth.users u on u.id = r.uploaded_by;
