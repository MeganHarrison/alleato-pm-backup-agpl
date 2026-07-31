alter table public.drawing_revisions
  add column if not exists rotation_degrees integer not null default 0;

alter table public.drawing_revisions
  drop constraint if exists drawing_revisions_rotation_degrees_check;

alter table public.drawing_revisions
  add constraint drawing_revisions_rotation_degrees_check
  check (rotation_degrees in (0, 90, 180, 270));

comment on column public.drawing_revisions.rotation_degrees is
  'Reviewed clockwise rotation in degrees selected during drawing upload. Allowed values: 0, 90, 180, 270.';
