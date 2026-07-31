alter table public.tasks
  add column if not exists schedule_task_id uuid null;

create index if not exists idx_tasks_schedule_task_id
  on public.tasks (schedule_task_id)
  where schedule_task_id is not null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'tasks_schedule_task_id_fkey'
      and conrelid = 'public.tasks'::regclass
  ) then
    alter table public.tasks
      add constraint tasks_schedule_task_id_fkey
      foreign key (schedule_task_id)
      references public.schedule_tasks(id)
      on delete set null;
  end if;
end $$;

comment on column public.tasks.schedule_task_id is
  'Optional link from an operational action item to the schedule/Gantt task it supports. Keeps action-item and schedule lifecycles separate while allowing cross-reference.';

drop function if exists public.create_ai_generated_task(
  text,
  text,
  text,
  text,
  date,
  text,
  integer,
  text,
  text,
  uuid,
  uuid,
  text
);

create or replace function public.create_ai_generated_task(
  p_metadata_id text,
  p_title text,
  p_description text,
  p_status text,
  p_due_date date default null,
  p_priority text default 'medium',
  p_project_id integer default null,
  p_assignee_name text default null,
  p_assignee_email text default null,
  p_assignee_person_id uuid default null,
  p_user_id uuid default null,
  p_idempotency_key text default null,
  p_schedule_task_id uuid default null
)
returns public.tasks
language plpgsql
security definer
set search_path = public
as $$
declare
  v_now timestamptz := now();
  v_task public.tasks;
begin
  if nullif(trim(p_metadata_id), '') is null then
    raise exception 'metadata id is required'
      using errcode = '22023';
  end if;

  if nullif(trim(p_title), '') is null then
    raise exception 'task title is required'
      using errcode = '22023';
  end if;

  if nullif(trim(p_description), '') is null then
    raise exception 'task description is required'
      using errcode = '22023';
  end if;

  if p_status not in ('open', 'in_progress', 'blocked', 'done', 'cancelled') then
    raise exception 'invalid generated task status: %', p_status
      using errcode = '22023';
  end if;

  if p_priority not in ('low', 'medium', 'high', 'urgent') then
    raise exception 'invalid generated task priority: %', p_priority
      using errcode = '22023';
  end if;

  insert into public.document_metadata (
    id,
    title,
    type,
    source_system,
    date,
    captured_at,
    project_id,
    content,
    summary,
    source_metadata
  )
  values (
    p_metadata_id,
    'AI assistant task: ' || trim(p_title),
    'ai_assistant_task',
    'ai_assistant',
    v_now,
    v_now,
    p_project_id,
    trim(p_description),
    trim(p_description),
    jsonb_build_object(
      'source', 'ai_assistant',
      'tool', 'createGeneratedTask',
      'user_id', p_user_id,
      'idempotency_key', p_idempotency_key,
      'schedule_task_id', p_schedule_task_id
    )
  );

  insert into public.tasks (
    metadata_id,
    title,
    description,
    status,
    due_date,
    priority,
    project_id,
    project_ids,
    schedule_task_id,
    assignee_name,
    assignee_email,
    assignee_person_id,
    source_system,
    extraction_source,
    extraction_metadata,
    updated_at
  )
  values (
    p_metadata_id,
    trim(p_title),
    trim(p_description),
    p_status,
    p_due_date,
    p_priority,
    p_project_id,
    case when p_project_id is null then '{}'::integer[] else array[p_project_id] end,
    p_schedule_task_id,
    nullif(trim(p_assignee_name), ''),
    nullif(trim(p_assignee_email), ''),
    p_assignee_person_id,
    'ai_assistant',
    'ai_assistant_chat',
    jsonb_build_object(
      'source', 'ai_assistant',
      'tool', 'createGeneratedTask',
      'user_id', p_user_id,
      'idempotency_key', p_idempotency_key,
      'schedule_task_id', p_schedule_task_id
    ),
    v_now
  )
  returning * into v_task;

  return v_task;
end;
$$;

comment on function public.create_ai_generated_task(
  text,
  text,
  text,
  text,
  date,
  text,
  integer,
  text,
  text,
  uuid,
  uuid,
  text,
  uuid
) is
  'Atomically creates an AI assistant action item source document and matching public.tasks row, optionally linked to a schedule/Gantt task.';

grant execute on function public.create_ai_generated_task(
  text,
  text,
  text,
  text,
  date,
  text,
  integer,
  text,
  text,
  uuid,
  uuid,
  text,
  uuid
) to service_role;
