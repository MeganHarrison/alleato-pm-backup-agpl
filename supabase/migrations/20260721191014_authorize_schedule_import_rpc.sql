-- Recreate the atomic import with an explicit project authorization guard.
-- Schedule tables currently rely on application ownership checks rather than
-- RLS, so the function must not trust a caller-provided project ID.
-- Replaces or appends a complete schedule import as one transaction.
-- Every reference is checked before any existing task is deleted so a malformed
-- source can never leave a project with a partial schedule.
CREATE OR REPLACE FUNCTION public.replace_schedule_import_atomic(
  p_project_id integer,
  p_tasks jsonb,
  p_dependencies jsonb,
  p_replace_existing boolean DEFAULT false
)
RETURNS TABLE(imported integer, deleted_existing integer, dependencies_imported integer)
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_deleted_existing integer := 0;
  v_sort_offset integer := 0;
  v_task jsonb;
  v_dependency jsonb;
  v_external_id text;
  v_parent_external_id text;
  v_predecessor_external_id text;
  v_task_external_id text;
  v_dependency_type text;
  v_task_id uuid;
  v_parent_task_id uuid;
  v_predecessor_task_id uuid;
  v_task_ids jsonb := '{}'::jsonb;
BEGIN
  IF current_user <> 'service_role'
    AND NOT (public.current_is_app_admin() OR public.current_is_project_member(p_project_id::bigint)) THEN
    RAISE EXCEPTION 'You do not have permission to import this project schedule' USING ERRCODE = '42501';
  END IF;

  IF jsonb_typeof(p_tasks) <> 'array' OR jsonb_array_length(p_tasks) = 0 THEN
    RAISE EXCEPTION 'tasks must be a non-empty array' USING ERRCODE = '22023';
  END IF;
  IF jsonb_typeof(p_dependencies) <> 'array' THEN
    RAISE EXCEPTION 'dependencies must be an array' USING ERRCODE = '22023';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM jsonb_array_elements(p_tasks) task
    WHERE nullif(btrim(task ->> 'external_id'), '') IS NULL
       OR nullif(btrim(task ->> 'name'), '') IS NULL
  ) THEN
    RAISE EXCEPTION 'Every imported task needs a name and external ID' USING ERRCODE = '22023';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM jsonb_array_elements(p_tasks) task
    GROUP BY btrim(task ->> 'external_id')
    HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION 'Imported task external IDs must be unique' USING ERRCODE = '22023';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM jsonb_array_elements(p_tasks) task
    WHERE nullif(btrim(task ->> 'parent_external_id'), '') IS NOT NULL
      AND NOT EXISTS (
        SELECT 1 FROM jsonb_array_elements(p_tasks) parent_task
        WHERE btrim(parent_task ->> 'external_id') = btrim(task ->> 'parent_external_id')
      )
  ) THEN
    RAISE EXCEPTION 'An imported task references a missing parent' USING ERRCODE = '22023';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM jsonb_array_elements(p_dependencies) dependency
    WHERE nullif(btrim(dependency ->> 'task_external_id'), '') IS NULL
       OR nullif(btrim(dependency ->> 'predecessor_external_id'), '') IS NULL
       OR coalesce(dependency ->> 'dependency_type', 'finish_to_start') NOT IN (
         'finish_to_start', 'start_to_start', 'finish_to_finish', 'start_to_finish'
       )
       OR NOT EXISTS (
         SELECT 1 FROM jsonb_array_elements(p_tasks) task
         WHERE btrim(task ->> 'external_id') = btrim(dependency ->> 'task_external_id')
       )
       OR NOT EXISTS (
         SELECT 1 FROM jsonb_array_elements(p_tasks) predecessor_task
         WHERE btrim(predecessor_task ->> 'external_id') = btrim(dependency ->> 'predecessor_external_id')
       )
       OR btrim(dependency ->> 'task_external_id') = btrim(dependency ->> 'predecessor_external_id')
  ) THEN
    RAISE EXCEPTION 'Imported dependencies contain an invalid task reference or relationship type' USING ERRCODE = '22023';
  END IF;

  SELECT coalesce(max(sort_order), 0)
  INTO v_sort_offset
  FROM public.schedule_tasks
  WHERE project_id = p_project_id;

  IF p_replace_existing THEN
    SELECT count(*) INTO v_deleted_existing
    FROM public.schedule_tasks
    WHERE project_id = p_project_id;

    -- FK cascades remove dependencies and deadlines together with the tasks.
    DELETE FROM public.schedule_tasks WHERE project_id = p_project_id;
    v_sort_offset := 0;
  END IF;

  -- Insert first, then resolve parent IDs. This permits source rows in any order.
  FOR v_task IN SELECT value FROM jsonb_array_elements(p_tasks)
  LOOP
    v_external_id := btrim(v_task ->> 'external_id');
    INSERT INTO public.schedule_tasks (
      project_id, name, wbs_code, start_date, finish_date, duration_days,
      percent_complete, status, is_milestone, sort_order
    ) VALUES (
      p_project_id,
      btrim(v_task ->> 'name'),
      nullif(v_task ->> 'wbs_code', ''),
      nullif(v_task ->> 'start_date', '')::date,
      nullif(v_task ->> 'finish_date', '')::date,
      nullif(v_task ->> 'duration_days', '')::integer,
      coalesce(nullif(v_task ->> 'percent_complete', '')::integer, 0),
      coalesce(nullif(v_task ->> 'status', ''), 'not_started'),
      coalesce(nullif(v_task ->> 'is_milestone', '')::boolean, false),
      v_sort_offset + coalesce(nullif(v_task ->> 'sort_order', '')::integer, 0)
    ) RETURNING id INTO v_task_id;
    v_task_ids := v_task_ids || jsonb_build_object(v_external_id, v_task_id);
  END LOOP;

  FOR v_task IN SELECT value FROM jsonb_array_elements(p_tasks)
  LOOP
    v_parent_external_id := nullif(btrim(v_task ->> 'parent_external_id'), '');
    IF v_parent_external_id IS NOT NULL THEN
      v_task_id := (v_task_ids ->> btrim(v_task ->> 'external_id'))::uuid;
      v_parent_task_id := (v_task_ids ->> v_parent_external_id)::uuid;
      UPDATE public.schedule_tasks SET parent_task_id = v_parent_task_id WHERE id = v_task_id;
    END IF;
  END LOOP;

  FOR v_dependency IN SELECT value FROM jsonb_array_elements(p_dependencies)
  LOOP
    v_task_external_id := btrim(v_dependency ->> 'task_external_id');
    v_predecessor_external_id := btrim(v_dependency ->> 'predecessor_external_id');
    v_dependency_type := coalesce(nullif(v_dependency ->> 'dependency_type', ''), 'finish_to_start');
    INSERT INTO public.schedule_dependencies (task_id, predecessor_task_id, dependency_type, lag_days)
    VALUES (
      (v_task_ids ->> v_task_external_id)::uuid,
      (v_task_ids ->> v_predecessor_external_id)::uuid,
      v_dependency_type,
      coalesce(nullif(v_dependency ->> 'lag_days', '')::integer, 0)
    );
  END LOOP;

  RETURN QUERY SELECT jsonb_array_length(p_tasks), v_deleted_existing, jsonb_array_length(p_dependencies);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.replace_schedule_import_atomic(integer, jsonb, jsonb, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.replace_schedule_import_atomic(integer, jsonb, jsonb, boolean) TO authenticated;
