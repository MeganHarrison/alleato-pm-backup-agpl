-- One authoritative write boundary for schedule task/dependency mutations and
-- every auto-schedule/order update derived from them.
--
-- The browser never calls this function directly. An authenticated API route
-- verifies the user, then invokes this service-role-only RPC with the user's id.
-- The RPC restores that user id in the local JWT claims before applying the
-- existing current_can_manage_schedule authorization rule.

begin;

-- schedule_version is the optimistic-concurrency token for the entire task
-- row, including hierarchy and sibling ordering. The older trigger only
-- covered date/progress fields, which left moves and reorders invisible to CAS.
create or replace function private.bump_schedule_task_version()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if (
    to_jsonb(new) - 'schedule_version' - 'updated_at'
  ) is distinct from (
    to_jsonb(old) - 'schedule_version' - 'updated_at'
  ) and new.schedule_version = old.schedule_version then
    new.schedule_version := old.schedule_version + 1;
  end if;
  return new;
end;
$$;

create or replace function public.apply_authoritative_schedule_cascade_mutation(
  p_actor_user_id uuid,
  p_project_id integer,
  p_mutation jsonb,
  p_expected_task_versions jsonb default '{}'::jsonb,
  p_expected_dependencies jsonb default '[]'::jsonb,
  p_cascade_updates jsonb default '[]'::jsonb,
  p_cascade_outcome text default 'no_change',
  p_ordering_snapshot jsonb default '[]'::jsonb,
  p_ordering_updates jsonb default '[]'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_request_role text := coalesce(
    nullif(current_setting('request.jwt.claim.role', true), ''),
    nullif(current_setting('role', true), '')
  );
  v_kind text;
  v_task_id uuid;
  v_dependency_id uuid;
  v_existing_dependency public.schedule_dependencies;
  v_changes jsonb;
  v_item jsonb;
  v_current_dependencies jsonb;
  v_submitted_dependencies jsonb;
  v_current_ordering jsonb;
  v_submitted_ordering jsonb;
  v_parent_key text;
  v_result jsonb;
  v_created_dependency public.schedule_dependencies;
begin
  if v_request_role <> 'service_role' then
    raise exception using
      errcode = '42501',
      message = 'apply_authoritative_schedule_cascade_mutation is service-role only';
  end if;

  if p_actor_user_id is null then
    raise exception using errcode = '22023', message = 'actor_user_id is required';
  end if;
  if p_project_id is null or p_project_id <= 0 then
    raise exception using errcode = '22023', message = 'project_id must be a positive integer';
  end if;
  if jsonb_typeof(p_mutation) <> 'object' then
    raise exception using errcode = '22023', message = 'mutation must be an object';
  end if;
  if jsonb_typeof(p_expected_task_versions) <> 'object'
     or jsonb_typeof(p_expected_dependencies) <> 'array'
     or jsonb_typeof(p_cascade_updates) <> 'array'
     or jsonb_typeof(p_ordering_snapshot) <> 'array'
     or jsonb_typeof(p_ordering_updates) <> 'array' then
    raise exception using errcode = '22023', message = 'invalid compare-and-swap payload';
  end if;
  if p_cascade_outcome not in (
    'applied',
    'no_change',
    'skipped_constraint',
    'skipped_unavailable'
  ) then
    raise exception using errcode = '22023', message = 'invalid cascade outcome';
  end if;
  if p_cascade_outcome <> 'applied' and jsonb_array_length(p_cascade_updates) <> 0 then
    raise exception using errcode = '22023', message = 'cascade updates require an applied outcome';
  end if;
  v_kind := p_mutation ->> 'kind';
  if v_kind is null or v_kind not in (
    'task_create',
    'task_update',
    'task_delete',
    'dependency_create',
    'dependency_update',
    'dependency_delete'
  ) then
    raise exception using errcode = '22023', message = 'unsupported schedule mutation kind';
  end if;

  -- Every schedule writer shares the same project-keyed transaction lock.
  perform pg_catalog.pg_advisory_xact_lock(17419, p_project_id);

  -- Rehydrate the authenticated actor only after proving this is a service-role
  -- call. current_can_manage_schedule remains the canonical authorization rule.
  perform set_config(
    'request.jwt.claims',
    jsonb_build_object('sub', p_actor_user_id, 'role', 'authenticated')::text,
    true
  );
  perform set_config('request.jwt.claim.sub', p_actor_user_id::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);

  if public.current_can_manage_schedule(p_project_id::bigint) is distinct from true then
    raise exception using errcode = '42501', message = 'schedule management permission required';
  end if;

  if not exists (select 1 from public.projects where id = p_project_id) then
    raise exception using errcode = 'P0002', message = 'project not found';
  end if;

  -- Lock every project task deterministically. This closes the read/write gap
  -- for version checks, hierarchy checks, full dependency snapshots, and
  -- sibling ordering snapshots.
  perform 1
  from public.schedule_tasks
  where project_id = p_project_id
  order by id
  for update;

  -- Exact task-version CAS for every row the caller says it read.
  if exists (
    select 1
    from jsonb_each_text(p_expected_task_versions) expected(task_id, version)
    left join public.schedule_tasks task
      on task.id = expected.task_id::uuid
     and task.project_id = p_project_id
    where task.id is null
       or task.schedule_version is distinct from expected.version::bigint
  ) then
    raise exception using
      errcode = '40001',
      message = 'schedule task version conflict';
  end if;

  -- The dependency snapshot is the complete graph, not only the row being
  -- changed. This makes graph edits a true compare-and-swap operation.
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', dependency.id,
        'task_id', dependency.task_id,
        'predecessor_task_id', dependency.predecessor_task_id,
        'dependency_type', dependency.dependency_type,
        'lag_days', dependency.lag_days
      )
      order by dependency.id
    ),
    '[]'::jsonb
  )
  into v_current_dependencies
  from public.schedule_dependencies dependency
  join public.schedule_tasks task on task.id = dependency.task_id
  where task.project_id = p_project_id;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', item.id,
        'task_id', item.task_id,
        'predecessor_task_id', item.predecessor_task_id,
        'dependency_type', item.dependency_type,
        'lag_days', item.lag_days
      )
      order by item.id
    ),
    '[]'::jsonb
  )
  into v_submitted_dependencies
  from jsonb_to_recordset(p_expected_dependencies) as item(
    id uuid,
    task_id uuid,
    predecessor_task_id uuid,
    dependency_type text,
    lag_days integer
  );

  if v_kind in (
    'task_delete',
    'dependency_create',
    'dependency_update',
    'dependency_delete'
  )
     and v_current_dependencies is distinct from v_submitted_dependencies then
    raise exception using
      errcode = '40001',
      message = 'schedule dependency graph conflict';
  end if;

  -- An ordering snapshot must contain every existing sibling in each affected
  -- parent group. Extra, missing, stale, or duplicate rows all fail the CAS.
  if jsonb_array_length(p_ordering_updates) > 0 then
    if jsonb_array_length(p_ordering_snapshot) = 0
       and not (
         v_kind = 'task_create'
         and jsonb_array_length(p_ordering_updates) = 1
         and p_ordering_updates -> 0 ->> 'id' = p_mutation ->> 'task_id'
       ) then
      raise exception using errcode = '22023', message = 'ordering updates require a full sibling snapshot';
    end if;
    if (
      select count(*) <> count(distinct item.id)
      from jsonb_to_recordset(p_ordering_snapshot) as item(
        id uuid,
        parent_task_id uuid,
        sort_order integer,
        schedule_version bigint
      )
    ) then
      raise exception using errcode = '22023', message = 'ordering snapshot contains duplicate tasks';
    end if;
    if (
      select count(*) <> count(distinct item.id)
      from jsonb_to_recordset(p_ordering_updates) as item(
        id uuid,
        parent_task_id uuid,
        sort_order integer
      )
    ) then
      raise exception using errcode = '22023', message = 'ordering updates contain duplicate tasks';
    end if;
    if exists (
      select 1
      from jsonb_to_recordset(p_ordering_updates) as ordering(id uuid)
      where not exists (
        select 1
        from jsonb_to_recordset(p_ordering_snapshot) as snapshot(id uuid)
        where snapshot.id = ordering.id
      )
      and not (
        p_mutation ->> 'kind' = 'task_create'
        and ordering.id = nullif(p_mutation ->> 'task_id', '')::uuid
      )
    ) then
      raise exception using
        errcode = '22023',
        message = 'ordering updates contain a task outside the affected sibling snapshot';
    end if;
    if exists (
      select 1
      from jsonb_to_recordset(p_ordering_snapshot) as snapshot(id uuid)
      where not (p_expected_task_versions ? snapshot.id::text)
    ) or exists (
      select 1
      from jsonb_to_recordset(p_ordering_updates) as ordering(id uuid)
      where not (p_expected_task_versions ? ordering.id::text)
        and not (
          v_kind = 'task_create'
          and ordering.id = nullif(p_mutation ->> 'task_id', '')::uuid
        )
    ) then
      raise exception using
        errcode = '22023',
        message = 'ordering tasks are missing expected task versions';
    end if;

    for v_parent_key in
      select distinct parent_key
      from (
        select coalesce(item.parent_task_id::text, '__root__') as parent_key
        from jsonb_to_recordset(p_ordering_snapshot) as item(
          id uuid,
          parent_task_id uuid,
          sort_order integer,
          schedule_version bigint
        )
        union all
        select coalesce(item.parent_task_id::text, '__root__') as parent_key
        from jsonb_to_recordset(p_ordering_updates) as item(
          id uuid,
          parent_task_id uuid,
          sort_order integer
        )
      ) affected_parents
      order by 1
    loop
      select coalesce(
        jsonb_agg(
          jsonb_build_object(
            'id', task.id,
            'parent_task_id', task.parent_task_id,
            'sort_order', task.sort_order,
            'schedule_version', task.schedule_version
          )
          order by task.id
        ),
        '[]'::jsonb
      )
      into v_current_ordering
      from public.schedule_tasks task
      where task.project_id = p_project_id
        and (
          (v_parent_key = '__root__' and task.parent_task_id is null)
          or task.parent_task_id::text = v_parent_key
        );

      select coalesce(
        jsonb_agg(
          jsonb_build_object(
            'id', item.id,
            'parent_task_id', item.parent_task_id,
            'sort_order', item.sort_order,
            'schedule_version', item.schedule_version
          )
          order by item.id
        ),
        '[]'::jsonb
      )
      into v_submitted_ordering
      from jsonb_to_recordset(p_ordering_snapshot) as item(
        id uuid,
        parent_task_id uuid,
        sort_order integer,
        schedule_version bigint
      )
      where coalesce(item.parent_task_id::text, '__root__') = v_parent_key;

      if v_current_ordering is distinct from v_submitted_ordering then
        raise exception using errcode = '40001', message = 'schedule sibling ordering conflict';
      end if;
    end loop;
  end if;

  if v_kind = 'task_update' then
    v_task_id := nullif(p_mutation ->> 'task_id', '')::uuid;
    v_changes := coalesce(p_mutation -> 'changes', '{}'::jsonb);
    if v_task_id is null or jsonb_typeof(v_changes) <> 'object' then
      raise exception using errcode = '22023', message = 'invalid task update mutation';
    end if;
    if not (p_expected_task_versions ? v_task_id::text) then
      raise exception using errcode = '22023', message = 'task update requires the expected task version';
    end if;
    if v_changes ?| array['id', 'project_id', 'schedule_version', 'created_at', 'updated_at'] then
      raise exception using errcode = '22023', message = 'task update contains protected fields';
    end if;
    if exists (
      select 1
      from jsonb_object_keys(v_changes) as changed(field_name)
      where changed.field_name not in (
        'name',
        'parent_task_id',
        'start_date',
        'finish_date',
        'duration_days',
        'percent_complete',
        'status',
        'is_milestone',
        'constraint_type',
        'constraint_date',
        'wbs_code',
        'sort_order',
        'assignee',
        'assignee_person_id',
        'priority',
        'schedule_mode',
        'work_minutes',
        'allow_leveling_split',
        'leveling_priority'
      )
    ) then
      raise exception using errcode = '22023', message = 'task update contains unsupported fields';
    end if;

    update public.schedule_tasks task
    set
      name = case when v_changes ? 'name' then v_changes ->> 'name' else task.name end,
      parent_task_id = case when v_changes ? 'parent_task_id' then (v_changes ->> 'parent_task_id')::uuid else task.parent_task_id end,
      start_date = case when v_changes ? 'start_date' then (v_changes ->> 'start_date')::date else task.start_date end,
      finish_date = case when v_changes ? 'finish_date' then (v_changes ->> 'finish_date')::date else task.finish_date end,
      duration_days = case when v_changes ? 'duration_days' then (v_changes ->> 'duration_days')::integer else task.duration_days end,
      percent_complete = case when v_changes ? 'percent_complete' then (v_changes ->> 'percent_complete')::integer else task.percent_complete end,
      status = case when v_changes ? 'status' then v_changes ->> 'status' else task.status end,
      is_milestone = case when v_changes ? 'is_milestone' then (v_changes ->> 'is_milestone')::boolean else task.is_milestone end,
      constraint_type = case when v_changes ? 'constraint_type' then v_changes ->> 'constraint_type' else task.constraint_type end,
      constraint_date = case when v_changes ? 'constraint_date' then (v_changes ->> 'constraint_date')::date else task.constraint_date end,
      wbs_code = case when v_changes ? 'wbs_code' then v_changes ->> 'wbs_code' else task.wbs_code end,
      sort_order = case when v_changes ? 'sort_order' then (v_changes ->> 'sort_order')::integer else task.sort_order end,
      assignee = case when v_changes ? 'assignee' then v_changes ->> 'assignee' else task.assignee end,
      assignee_person_id = case when v_changes ? 'assignee_person_id' then (v_changes ->> 'assignee_person_id')::uuid else task.assignee_person_id end,
      priority = case when v_changes ? 'priority' then v_changes ->> 'priority' else task.priority end,
      schedule_mode = case when v_changes ? 'schedule_mode' then v_changes ->> 'schedule_mode' else task.schedule_mode end,
      work_minutes = case when v_changes ? 'work_minutes' then (v_changes ->> 'work_minutes')::integer else task.work_minutes end,
      allow_leveling_split = case when v_changes ? 'allow_leveling_split' then (v_changes ->> 'allow_leveling_split')::boolean else task.allow_leveling_split end,
      leveling_priority = case when v_changes ? 'leveling_priority' then (v_changes ->> 'leveling_priority')::integer else task.leveling_priority end
    where task.id = v_task_id and task.project_id = p_project_id;

    if not found then
      raise exception using errcode = 'P0002', message = 'schedule task not found';
    end if;

  elsif v_kind = 'task_create' then
    v_task_id := nullif(p_mutation ->> 'task_id', '')::uuid;
    v_changes := coalesce(p_mutation -> 'values', '{}'::jsonb);
    if v_task_id is null or nullif(btrim(v_changes ->> 'name'), '') is null then
      raise exception using errcode = '22023', message = 'task create requires task_id and name';
    end if;
    insert into public.schedule_tasks (
      id,
      project_id,
      parent_task_id,
      name,
      start_date,
      finish_date,
      duration_days,
      percent_complete,
      status,
      is_milestone,
      constraint_type,
      constraint_date,
      wbs_code,
      sort_order,
      assignee,
      assignee_person_id,
      priority,
      schedule_mode,
      work_minutes,
      allow_leveling_split,
      leveling_priority
    )
    values (
      v_task_id,
      p_project_id,
      (v_changes ->> 'parent_task_id')::uuid,
      btrim(v_changes ->> 'name'),
      (v_changes ->> 'start_date')::date,
      (v_changes ->> 'finish_date')::date,
      (v_changes ->> 'duration_days')::integer,
      coalesce((v_changes ->> 'percent_complete')::integer, 0),
      coalesce(v_changes ->> 'status', 'not_started'),
      coalesce((v_changes ->> 'is_milestone')::boolean, false),
      v_changes ->> 'constraint_type',
      (v_changes ->> 'constraint_date')::date,
      v_changes ->> 'wbs_code',
      case
        when jsonb_array_length(p_ordering_updates) > 0 then -2147483647
        else coalesce(
          (v_changes ->> 'sort_order')::integer,
          (
            select coalesce(max(task.sort_order), 0) + 1
            from public.schedule_tasks task
            where task.project_id = p_project_id
              and task.parent_task_id is not distinct from (v_changes ->> 'parent_task_id')::uuid
          )
        )
      end,
      v_changes ->> 'assignee',
      (v_changes ->> 'assignee_person_id')::uuid,
      coalesce(v_changes ->> 'priority', 'normal'),
      coalesce(v_changes ->> 'schedule_mode', 'auto'),
      (v_changes ->> 'work_minutes')::integer,
      coalesce((v_changes ->> 'allow_leveling_split')::boolean, false),
      coalesce((v_changes ->> 'leveling_priority')::integer, 500)
    );

  elsif v_kind = 'task_delete' then
    v_task_id := nullif(p_mutation ->> 'task_id', '')::uuid;
    if v_task_id is null or not (p_expected_task_versions ? v_task_id::text) then
      raise exception using errcode = '22023', message = 'task delete requires the expected task version';
    end if;
    delete from public.schedule_tasks
    where id = v_task_id and project_id = p_project_id;
    if not found then
      raise exception using errcode = 'P0002', message = 'schedule task not found';
    end if;

  elsif v_kind = 'dependency_create' then
    if p_cascade_outcome in ('skipped_constraint', 'skipped_unavailable') then
      raise exception using errcode = '22023', message = 'dependency creation requires an available cascade';
    end if;
    insert into public.schedule_dependencies (
      task_id,
      predecessor_task_id,
      dependency_type,
      lag_days
    )
    values (
      (p_mutation ->> 'task_id')::uuid,
      (p_mutation ->> 'predecessor_task_id')::uuid,
      coalesce(p_mutation ->> 'dependency_type', 'finish_to_start'),
      coalesce((p_mutation ->> 'lag_days')::integer, 0)
    )
    returning * into v_created_dependency;
    v_dependency_id := v_created_dependency.id;

  elsif v_kind = 'dependency_update' then
    if p_cascade_outcome in ('skipped_constraint', 'skipped_unavailable') then
      raise exception using errcode = '22023', message = 'dependency update requires an available cascade';
    end if;
    v_dependency_id := nullif(p_mutation ->> 'dependency_id', '')::uuid;
    select dependency.*
    into v_existing_dependency
    from public.schedule_dependencies dependency
    join public.schedule_tasks task on task.id = dependency.task_id
    where dependency.id = v_dependency_id
      and dependency.task_id = (p_mutation ->> 'task_id')::uuid
      and task.project_id = p_project_id
    for update of dependency;
    if not found then
      raise exception using errcode = 'P0002', message = 'schedule dependency not found';
    end if;
    v_changes := coalesce(p_mutation -> 'changes', '{}'::jsonb);
    update public.schedule_dependencies dependency
    set
      predecessor_task_id = case when v_changes ? 'predecessor_task_id' then (v_changes ->> 'predecessor_task_id')::uuid else dependency.predecessor_task_id end,
      dependency_type = case when v_changes ? 'dependency_type' then v_changes ->> 'dependency_type' else dependency.dependency_type end,
      lag_days = case when v_changes ? 'lag_days' then (v_changes ->> 'lag_days')::integer else dependency.lag_days end
    where dependency.id = v_dependency_id;

  elsif v_kind = 'dependency_delete' then
    v_dependency_id := nullif(p_mutation ->> 'dependency_id', '')::uuid;
    delete from public.schedule_dependencies dependency
    using public.schedule_tasks task
    where dependency.id = v_dependency_id
      and dependency.task_id = (p_mutation ->> 'task_id')::uuid
      and task.id = dependency.task_id
      and task.project_id = p_project_id;
    if not found then
      raise exception using errcode = 'P0002', message = 'schedule dependency not found';
    end if;
  else
    raise exception using errcode = '22023', message = 'unsupported schedule mutation kind';
  end if;

  if exists (
    select 1
    from public.schedule_tasks task
    left join public.schedule_tasks parent on parent.id = task.parent_task_id
    where task.project_id = p_project_id
      and task.parent_task_id is not null
      and (parent.id is null or parent.project_id <> p_project_id)
  ) then
    raise exception using errcode = '23514', message = 'schedule parent must belong to the same project';
  end if;

  if v_kind in ('dependency_create', 'dependency_update') and exists (
    select 1
    from public.schedule_dependencies dependency
    left join public.schedule_tasks task on task.id = dependency.task_id
    left join public.schedule_tasks predecessor on predecessor.id = dependency.predecessor_task_id
    where dependency.id = v_dependency_id
      and (
        task.project_id is distinct from p_project_id
        or predecessor.project_id is distinct from p_project_id
      )
  ) then
    raise exception using errcode = '23514', message = 'schedule dependency endpoints must belong to the same project';
  end if;

  -- A parent reassignment may not make the task its own ancestor. The project
  -- lock makes this validation stable until commit.
  if exists (
    with recursive ancestry as (
      select task.id, task.parent_task_id, array[task.id] as path
      from public.schedule_tasks task
      where task.project_id = p_project_id
      union all
      select ancestry.id, parent.parent_task_id, ancestry.path || parent.id
      from ancestry
      join public.schedule_tasks parent on parent.id = ancestry.parent_task_id
      where parent.project_id = p_project_id
        and not parent.id = any(ancestry.path)
    )
    select 1
    from ancestry
    where parent_task_id = any(path)
  ) then
    raise exception using errcode = '23514', message = 'schedule hierarchy cannot contain a cycle';
  end if;

  -- Apply all calculated dates in this same transaction. Every target must be
  -- represented in the version vector, including unchanged anchors.
  if p_cascade_outcome = 'applied' then
    if (
      select count(*) <> count(distinct item.task_id)
      from jsonb_to_recordset(p_cascade_updates) as item(task_id uuid)
    ) then
      raise exception using errcode = '22023', message = 'cascade updates contain duplicate tasks';
    end if;
    for v_item in select value from jsonb_array_elements(p_cascade_updates)
    loop
      v_task_id := nullif(v_item ->> 'task_id', '')::uuid;
      if v_task_id is null or not (p_expected_task_versions ? v_task_id::text) then
        raise exception using errcode = '22023', message = 'cascade target is missing its expected task version';
      end if;
      update public.schedule_tasks task
      set
        start_date = (v_item ->> 'start_date')::date,
        finish_date = (v_item ->> 'finish_date')::date
      where task.id = v_task_id and task.project_id = p_project_id;
      if not found then
        raise exception using errcode = 'P0002', message = 'cascade target not found';
      end if;
    end loop;
  end if;

  if jsonb_array_length(p_ordering_updates) > 0 then
    -- Temporary negative values prevent collisions with either old or final
    -- positions if a uniqueness constraint is added later.
    with ordered as (
      select item.id, row_number() over (order by item.id) as ordinal
      from jsonb_to_recordset(p_ordering_updates) as item(
        id uuid,
        parent_task_id uuid,
        sort_order integer
      )
    )
    update public.schedule_tasks task
    set sort_order = -ordered.ordinal::integer
    from ordered
    where task.id = ordered.id and task.project_id = p_project_id;

    for v_item in select value from jsonb_array_elements(p_ordering_updates)
    loop
      v_task_id := nullif(v_item ->> 'id', '')::uuid;
      if not exists (
        select 1 from public.schedule_tasks
        where id = v_task_id and project_id = p_project_id
      ) then
        raise exception using errcode = 'P0002', message = 'ordering target not found';
      end if;
      update public.schedule_tasks
      set
        parent_task_id = (v_item ->> 'parent_task_id')::uuid,
        sort_order = (v_item ->> 'sort_order')::integer
      where id = v_task_id and project_id = p_project_id;
    end loop;

    if exists (
      select 1
      from public.schedule_tasks task
      left join public.schedule_tasks parent on parent.id = task.parent_task_id
      where task.project_id = p_project_id
        and task.parent_task_id is not null
        and (parent.id is null or parent.project_id <> p_project_id)
    ) then
      raise exception using errcode = '23514', message = 'schedule parent must belong to the same project';
    end if;

    if exists (
      select 1
      from (
        select
          parent_task_id,
          sort_order,
          row_number() over (
            partition by parent_task_id
            order by sort_order, id
          ) as expected_order
        from public.schedule_tasks
        where project_id = p_project_id
          and coalesce(parent_task_id::text, '__root__') in (
            select distinct coalesce(item.parent_task_id::text, '__root__')
            from jsonb_to_recordset(p_ordering_updates) as item(
              id uuid,
              parent_task_id uuid,
              sort_order integer
            )
          )
      ) ordered
      where ordered.sort_order is distinct from ordered.expected_order
    ) then
      raise exception using errcode = '23514', message = 'sibling order must be contiguous and one-based';
    end if;
  end if;

  select jsonb_build_object(
    'mutation_kind', v_kind,
    'cascade_outcome', p_cascade_outcome,
    'task', case
      when v_kind like 'task_%' and v_kind <> 'task_delete' then (
        select to_jsonb(task)
        from public.schedule_tasks task
        where task.id = nullif(p_mutation ->> 'task_id', '')::uuid
          and task.project_id = p_project_id
      )
      else null
    end,
    'dependency', case
      when v_kind in ('dependency_create', 'dependency_update') then (
        select to_jsonb(dependency)
        from public.schedule_dependencies dependency
        where dependency.id = v_dependency_id
      )
      else null
    end,
    'task_versions', coalesce((
      select jsonb_object_agg(task.id, task.schedule_version)
      from public.schedule_tasks task
      where task.project_id = p_project_id
        and (
          p_expected_task_versions ? task.id::text
          or exists (
            select 1
            from jsonb_array_elements(p_ordering_updates) ordering
            where ordering ->> 'id' = task.id::text
          )
        )
    ), '{}'::jsonb)
  )
  into v_result;

  return v_result;
end;
$$;

revoke all on function public.apply_authoritative_schedule_cascade_mutation(
  uuid,
  integer,
  jsonb,
  jsonb,
  jsonb,
  jsonb,
  text,
  jsonb,
  jsonb
) from public, anon, authenticated;

grant execute on function public.apply_authoritative_schedule_cascade_mutation(
  uuid,
  integer,
  jsonb,
  jsonb,
  jsonb,
  jsonb,
  text,
  jsonb,
  jsonb
) to service_role;

comment on function public.apply_authoritative_schedule_cascade_mutation(
  uuid,
  integer,
  jsonb,
  jsonb,
  jsonb,
  jsonb,
  text,
  jsonb,
  jsonb
) is
  'Service-role-only, actor-authorized, project-locked CAS boundary for atomic schedule task/dependency, cascade, and sibling-order writes.';

-- Published schedule alerts are addressed to the assigned trade company, not
-- just the one person selected on the activity. Eligibility is intentionally
-- exact: an active directory membership on this project, a person in the
-- assignee's company, and a linked application user.
create or replace function private.schedule_alert_company_recipients(
  p_project_id integer,
  p_revision_id uuid,
  p_source_task_id uuid
)
returns table(user_id uuid)
language sql
stable
security definer
set search_path = ''
as $$
  with assigned_company as (
    select person.company_id
    from public.schedule_revision_task_snapshots snapshot
    join public.people person on person.id = snapshot.assignee_person_id
    where snapshot.revision_id = p_revision_id
      and snapshot.source_task_id = p_source_task_id
      and person.company_id is not null
  )
  select distinct recipient.auth_user_id
  from assigned_company
  join public.people recipient
    on recipient.company_id = assigned_company.company_id
   and recipient.auth_user_id is not null
  join public.project_directory_memberships membership
    on membership.project_id = p_project_id
   and membership.person_id = recipient.id
   and membership.status = 'active'
  order by recipient.auth_user_id;
$$;

revoke all on function private.schedule_alert_company_recipients(integer, uuid, uuid)
  from public, anon, authenticated, service_role;

create or replace function public.emit_schedule_trade_alert(
  p_project_id integer,
  p_revision_id uuid,
  p_source_task_id uuid,
  p_change_kind text,
  p_title text,
  p_body text default null
)
returns public.collaboration_notifications
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_recipient record;
  v_recipient_count integer := 0;
  v_event_key text;
  v_notification public.collaboration_notifications;
begin
  if auth.uid() is null
     or public.current_can_manage_schedule(p_project_id::bigint) is distinct from true then
    raise exception 'Only a project schedule manager can emit this schedule alert.'
      using errcode = '42501';
  end if;
  if p_change_kind not in ('date_changed', 'dependency_changed', 'submittal_changed') then
    raise exception 'Unsupported schedule alert kind.' using errcode = '22023';
  end if;
  if not exists (
    select 1
    from public.schedule_revisions revision
    where revision.id = p_revision_id
      and revision.project_id = p_project_id
      and revision.status = 'published'
  ) then
    raise exception 'Only a published schedule revision can emit alerts.'
      using errcode = '22023';
  end if;
  if not exists (
    select 1
    from public.schedule_revision_task_snapshots snapshot
    where snapshot.revision_id = p_revision_id
      and snapshot.source_task_id = p_source_task_id
  ) then
    raise exception 'The published activity was not found in this revision.'
      using errcode = 'P0002';
  end if;

  for v_recipient in
    select recipient.user_id
    from private.schedule_alert_company_recipients(
      p_project_id,
      p_revision_id,
      p_source_task_id
    ) recipient
  loop
    v_recipient_count := v_recipient_count + 1;
    v_event_key := format(
      'schedule-alert:%s:%s:%s:%s',
      p_revision_id,
      p_source_task_id,
      v_recipient.user_id,
      p_change_kind
    );
    perform pg_advisory_xact_lock(hashtextextended(v_event_key, 0));
    if exists (
      select 1
      from public.schedule_alert_deliveries delivery
      where delivery.event_key = v_event_key
    ) then
      continue;
    end if;

    insert into public.collaboration_notifications(
      user_id,
      project_id,
      entity_type,
      entity_id,
      actor_id,
      kind,
      title,
      body,
      metadata
    )
    values (
      v_recipient.user_id,
      p_project_id,
      'schedule_task',
      p_source_task_id::text,
      auth.uid(),
      'schedule_change',
      p_title,
      p_body,
      jsonb_build_object(
        'event_key', v_event_key,
        'revision_id', p_revision_id,
        'source_task_id', p_source_task_id,
        'change_kind', p_change_kind
      )
    )
    returning * into v_notification;

    insert into public.schedule_alert_deliveries(
      event_key,
      project_id,
      revision_id,
      source_task_id,
      recipient_user_id,
      change_kind,
      notification_id
    )
    values (
      v_event_key,
      p_project_id,
      p_revision_id,
      p_source_task_id,
      v_recipient.user_id,
      p_change_kind,
      v_notification.id
    );
  end loop;

  if v_recipient_count = 0 then
    raise exception 'The assigned trade company has no active project users.'
      using errcode = 'P0002';
  end if;
  return v_notification;
end;
$$;

revoke all on function public.emit_schedule_trade_alert(integer, uuid, uuid, text, text, text)
  from public, anon;
grant execute on function public.emit_schedule_trade_alert(integer, uuid, uuid, text, text, text)
  to authenticated;

create or replace function public.emit_published_schedule_change_alerts(
  p_project_id integer,
  p_revision_id uuid,
  p_previous_revision_id uuid,
  p_actor_id uuid
)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_change record;
  v_notification_id uuid;
  v_event_key text;
begin
  if p_previous_revision_id is null then
    return;
  end if;

  for v_change in
    with changed_activities as (
      select
        current_snapshot.source_task_id,
        'date_changed'::text as change_kind,
        current_snapshot.name || ' dates changed' as title,
        'Published schedule dates changed.'::text as body
      from public.schedule_revision_task_snapshots current_snapshot
      join public.schedule_revision_task_snapshots prior_snapshot
        on prior_snapshot.revision_id = p_previous_revision_id
       and prior_snapshot.source_task_id = current_snapshot.source_task_id
      where current_snapshot.revision_id = p_revision_id
        and (
          current_snapshot.start_date,
          current_snapshot.finish_date,
          current_snapshot.forecast_start_date,
          current_snapshot.forecast_finish_date
        ) is distinct from (
          prior_snapshot.start_date,
          prior_snapshot.finish_date,
          prior_snapshot.forecast_start_date,
          prior_snapshot.forecast_finish_date
        )

      union all

      select
        current_snapshot.source_task_id,
        'dependency_changed',
        current_snapshot.name || ' predecessor changed',
        'A predecessor relationship changed in the published schedule.'
      from public.schedule_revision_task_snapshots current_snapshot
      where current_snapshot.revision_id = p_revision_id
        and (
          exists (
            select 1
            from public.schedule_revision_dependency_snapshots current_dependency
            where current_dependency.revision_id = p_revision_id
              and current_dependency.task_source_id = current_snapshot.source_task_id
              and not exists (
                select 1
                from public.schedule_revision_dependency_snapshots prior_dependency
                where prior_dependency.revision_id = p_previous_revision_id
                  and prior_dependency.task_source_id = current_dependency.task_source_id
                  and prior_dependency.predecessor_source_id = current_dependency.predecessor_source_id
                  and prior_dependency.dependency_type = current_dependency.dependency_type
                  and prior_dependency.lag_days = current_dependency.lag_days
              )
          )
          or exists (
            select 1
            from public.schedule_revision_dependency_snapshots prior_dependency
            where prior_dependency.revision_id = p_previous_revision_id
              and prior_dependency.task_source_id = current_snapshot.source_task_id
              and not exists (
                select 1
                from public.schedule_revision_dependency_snapshots current_dependency
                where current_dependency.revision_id = p_revision_id
                  and current_dependency.task_source_id = prior_dependency.task_source_id
                  and current_dependency.predecessor_source_id = prior_dependency.predecessor_source_id
                  and current_dependency.dependency_type = prior_dependency.dependency_type
                  and current_dependency.lag_days = prior_dependency.lag_days
              )
          )
        )

      union all

      select
        current_snapshot.source_task_id,
        'submittal_changed',
        current_snapshot.name || ' linked submittal changed',
        'A linked submittal changed in the published schedule.'
      from public.schedule_revision_task_snapshots current_snapshot
      where current_snapshot.revision_id = p_revision_id
        and (
          exists (
            select 1
            from public.schedule_revision_submittal_snapshots current_submittal
            where current_submittal.revision_id = p_revision_id
              and current_submittal.source_task_id = current_snapshot.source_task_id
              and not exists (
                select 1
                from public.schedule_revision_submittal_snapshots prior_submittal
                where prior_submittal.revision_id = p_previous_revision_id
                  and prior_submittal.source_task_id = current_submittal.source_task_id
                  and prior_submittal.submittal_id = current_submittal.submittal_id
                  and prior_submittal.submittal_status = current_submittal.submittal_status
                  and prior_submittal.required_approval_date
                    is not distinct from current_submittal.required_approval_date
              )
          )
          or exists (
            select 1
            from public.schedule_revision_submittal_snapshots prior_submittal
            where prior_submittal.revision_id = p_previous_revision_id
              and prior_submittal.source_task_id = current_snapshot.source_task_id
              and not exists (
                select 1
                from public.schedule_revision_submittal_snapshots current_submittal
                where current_submittal.revision_id = p_revision_id
                  and current_submittal.source_task_id = prior_submittal.source_task_id
                  and current_submittal.submittal_id = prior_submittal.submittal_id
                  and current_submittal.submittal_status = prior_submittal.submittal_status
                  and current_submittal.required_approval_date
                    is not distinct from prior_submittal.required_approval_date
              )
          )
        )
    )
    select distinct
      change.source_task_id,
      recipient.user_id as recipient_user_id,
      change.change_kind,
      change.title,
      change.body
    from changed_activities change
    cross join lateral private.schedule_alert_company_recipients(
      p_project_id,
      p_revision_id,
      change.source_task_id
    ) recipient
    order by change.source_task_id, change.change_kind, recipient.user_id
  loop
    v_event_key := format(
      'schedule-alert:%s:%s:%s:%s',
      p_revision_id,
      v_change.source_task_id,
      v_change.recipient_user_id,
      v_change.change_kind
    );
    perform pg_advisory_xact_lock(hashtextextended(v_event_key, 0));
    if exists (
      select 1
      from public.schedule_alert_deliveries delivery
      where delivery.event_key = v_event_key
    ) then
      continue;
    end if;

    insert into public.collaboration_notifications(
      user_id,
      project_id,
      entity_type,
      entity_id,
      actor_id,
      kind,
      title,
      body,
      metadata
    )
    values (
      v_change.recipient_user_id,
      p_project_id,
      'schedule_task',
      v_change.source_task_id::text,
      p_actor_id,
      'schedule_change',
      v_change.title,
      v_change.body,
      jsonb_build_object(
        'event_key', v_event_key,
        'revision_id', p_revision_id,
        'source_task_id', v_change.source_task_id,
        'change_kind', v_change.change_kind
      )
    )
    returning id into v_notification_id;

    insert into public.schedule_alert_deliveries(
      event_key,
      project_id,
      revision_id,
      source_task_id,
      recipient_user_id,
      change_kind,
      notification_id
    )
    values (
      v_event_key,
      p_project_id,
      p_revision_id,
      v_change.source_task_id,
      v_change.recipient_user_id,
      v_change.change_kind,
      v_notification_id
    );
  end loop;
end;
$$;

alter function public.emit_published_schedule_change_alerts(integer, uuid, uuid, uuid)
  set search_path = pg_catalog, pg_temp;
revoke all on function public.emit_published_schedule_change_alerts(integer, uuid, uuid, uuid)
  from public, anon, authenticated, service_role;

commit;
