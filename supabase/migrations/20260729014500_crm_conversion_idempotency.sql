begin;

alter table public.projects
  add column if not exists crm_conversion_attempt_id uuid
  references public.crm_conversion_attempts(id) on delete restrict;

create unique index if not exists projects_crm_conversion_attempt_unique
on public.projects(crm_conversion_attempt_id)
where crm_conversion_attempt_id is not null;

commit;
