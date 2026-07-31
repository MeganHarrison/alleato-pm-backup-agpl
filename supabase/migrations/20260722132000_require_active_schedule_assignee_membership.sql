-- A published trade activity can only be delivered to an active project member.
-- Keep schedule assignment person-scoped; do not infer a vendor/company contact.

create or replace function public.enforce_schedule_assignee_project_membership()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.assignee_person_id is null then
    return new;
  end if;

  if not exists (
    select 1
    from public.project_directory_memberships pdm
    where pdm.project_id = new.project_id
      and pdm.person_id = new.assignee_person_id
      and pdm.status = 'active'
  ) then
    raise exception using
      errcode = '23514',
      message = 'SCHEDULE_ASSIGNEE_NOT_ACTIVE_PROJECT_MEMBER',
      detail = format(
        'Schedule task assignee %s must have an active directory membership for project %s.',
        new.assignee_person_id,
        new.project_id
      ),
      hint = 'Add the person to the project directory with active status before assigning the schedule activity.';
  end if;

  return new;
end;
$$;

drop trigger if exists schedule_tasks_require_active_assignee_membership on public.schedule_tasks;

create trigger schedule_tasks_require_active_assignee_membership
before insert or update of project_id, assignee_person_id on public.schedule_tasks
for each row
execute function public.enforce_schedule_assignee_project_membership();

comment on function public.enforce_schedule_assignee_project_membership() is
  'Rejects schedule-task assignees who are not active directory members of the task project.';
