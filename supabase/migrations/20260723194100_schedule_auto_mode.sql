begin;

alter table public.schedule_tasks
  add column if not exists schedule_mode text not null default 'auto';

do $$
begin
  alter table public.schedule_tasks
    add constraint schedule_tasks_schedule_mode_check
    check (schedule_mode in ('auto', 'manual'));
exception when duplicate_object then null;
end;
$$;

comment on column public.schedule_tasks.schedule_mode is
  'Mirrors Microsoft Project''s Auto/Manually Scheduled toggle. ''auto'' tasks have their '
  'start_date/finish_date recomputed automatically from predecessor dependencies; ''manual'' '
  'tasks are never touched by the auto-scheduling cascade.';

commit;
