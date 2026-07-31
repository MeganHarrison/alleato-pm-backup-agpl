alter table public.estimates
  alter column project_duration_weeks type numeric
  using project_duration_weeks::numeric;
