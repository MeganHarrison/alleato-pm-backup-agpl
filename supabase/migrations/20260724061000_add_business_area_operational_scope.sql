-- Alleato Brain — Phase 1B operational scope and migration ledger.
--
-- This migration is additive. Operational records may carry both their legacy
-- project and Business Area during the measured parallel run. The final XOR
-- constraints belong to the cutover migration after legacy project scope is
-- cleared.

BEGIN;

-- 1) Add Business Area scope to operational records and routing rules.

ALTER TABLE public.meetings
  ADD COLUMN IF NOT EXISTS business_area_id bigint;
ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS business_area_id bigint;
ALTER TABLE public.files
  ADD COLUMN IF NOT EXISTS business_area_id bigint;
ALTER TABLE public.project_attribution_rules
  ADD COLUMN IF NOT EXISTS business_area_id bigint;

DO $$
DECLARE
  target_table text;
  constraint_name text;
BEGIN
  FOREACH target_table IN ARRAY ARRAY[
    'meetings',
    'tasks',
    'files',
    'project_attribution_rules'
  ]
  LOOP
    constraint_name := target_table || '_business_area_id_fkey';
    IF NOT EXISTS (
      SELECT 1
      FROM pg_constraint
      WHERE conname = constraint_name
        AND conrelid = format('public.%I', target_table)::regclass
    ) THEN
      EXECUTE format(
        'ALTER TABLE public.%I ADD CONSTRAINT %I FOREIGN KEY (business_area_id) REFERENCES public.business_areas(id) ON DELETE RESTRICT NOT VALID',
        target_table,
        constraint_name
      );
    END IF;
  END LOOP;
END
$$;

ALTER TABLE public.meetings
  VALIDATE CONSTRAINT meetings_business_area_id_fkey;
ALTER TABLE public.tasks
  VALIDATE CONSTRAINT tasks_business_area_id_fkey;
ALTER TABLE public.files
  VALIDATE CONSTRAINT files_business_area_id_fkey;
ALTER TABLE public.project_attribution_rules
  VALIDATE CONSTRAINT project_attribution_rules_business_area_id_fkey;

DO $$
DECLARE
  target_table text;
  constraint_name text;
  constraint_row record;
BEGIN
  FOREACH target_table IN ARRAY ARRAY[
    'meetings',
    'tasks',
    'files',
    'project_attribution_rules'
  ]
  LOOP
    constraint_name := target_table || '_business_area_id_fkey';
    SELECT
      con.contype,
      con.convalidated,
      con.confdeltype,
      con.confrelid
    INTO constraint_row
    FROM pg_constraint AS con
    WHERE con.conname = constraint_name
      AND con.conrelid = format('public.%I', target_table)::regclass;

    IF NOT FOUND
      OR constraint_row.contype <> 'f'
      OR constraint_row.convalidated = false
      OR constraint_row.confdeltype <> 'r'
      OR constraint_row.confrelid <> 'public.business_areas'::regclass
    THEN
      RAISE EXCEPTION
        'ALLEATO_BRAIN_OPERATIONAL_FK_INVALID: table=% constraint=%',
        target_table,
        constraint_name;
    END IF;
  END LOOP;
END
$$;

CREATE INDEX IF NOT EXISTS idx_meetings_business_area_id
  ON public.meetings (business_area_id)
  WHERE business_area_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_tasks_business_area_id
  ON public.tasks (business_area_id)
  WHERE business_area_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_files_business_area_id
  ON public.files (business_area_id)
  WHERE business_area_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_project_attribution_rules_business_area_id
  ON public.project_attribution_rules (business_area_id)
  WHERE business_area_id IS NOT NULL;

ALTER TABLE public.meetings
  ALTER COLUMN project_id DROP NOT NULL;
ALTER TABLE public.project_attribution_rules
  ALTER COLUMN project_id DROP NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_project_attribution_rules_business_area_target
  ON public.project_attribution_rules (
    business_area_id,
    rule_type,
    pattern_normalized
  )
  WHERE business_area_id IS NOT NULL;

DO $$
DECLARE
  expected_index record;
  actual_index record;
BEGIN
  FOR expected_index IN
    SELECT *
    FROM (VALUES
      ('idx_meetings_business_area_id', 'meetings', false),
      ('idx_tasks_business_area_id', 'tasks', false),
      ('idx_files_business_area_id', 'files', false),
      ('idx_project_attribution_rules_business_area_id', 'project_attribution_rules', false),
      ('uq_project_attribution_rules_business_area_target', 'project_attribution_rules', true)
    ) AS expected(index_name, table_name, is_unique)
  LOOP
    SELECT
      table_class.relname AS table_name,
      index_catalog.indisunique AS is_unique,
      index_catalog.indisvalid AS is_valid,
      pg_get_expr(index_catalog.indpred, index_catalog.indrelid) AS predicate,
      pg_get_indexdef(index_class.oid) AS definition
    INTO actual_index
    FROM pg_class AS index_class
    JOIN pg_index AS index_catalog ON index_catalog.indexrelid = index_class.oid
    JOIN pg_class AS table_class ON table_class.oid = index_catalog.indrelid
    JOIN pg_namespace AS table_namespace ON table_namespace.oid = table_class.relnamespace
    WHERE table_namespace.nspname = 'public'
      AND index_class.relname = expected_index.index_name;

    IF NOT FOUND
      OR actual_index.table_name <> expected_index.table_name
      OR actual_index.is_unique <> expected_index.is_unique
      OR actual_index.is_valid = false
      OR actual_index.predicate IS DISTINCT FROM '(business_area_id IS NOT NULL)'
      OR actual_index.definition NOT LIKE '%(business_area_id%'
    THEN
      RAISE EXCEPTION
        'ALLEATO_BRAIN_OPERATIONAL_INDEX_INVALID: index=% table=%',
        expected_index.index_name,
        expected_index.table_name;
    END IF;
  END LOOP;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'project_attribution_rules_active_typed_target'
      AND conrelid = 'public.project_attribution_rules'::regclass
  ) THEN
    ALTER TABLE public.project_attribution_rules
      ADD CONSTRAINT project_attribution_rules_active_typed_target
      CHECK (
        status <> 'active'
        OR num_nonnulls(project_id, business_area_id) = 1
      )
      NOT VALID;
  END IF;
END
$$;

ALTER TABLE public.project_attribution_rules
  VALIDATE CONSTRAINT project_attribution_rules_active_typed_target;

DO $$
DECLARE
  target_constraint record;
BEGIN
  SELECT
    con.conrelid,
    con.convalidated,
    pg_get_constraintdef(con.oid) AS definition
  INTO target_constraint
  FROM pg_constraint AS con
  WHERE con.conname = 'project_attribution_rules_active_typed_target'
    AND con.conrelid = 'public.project_attribution_rules'::regclass;

  IF NOT FOUND
    OR target_constraint.convalidated = false
    OR target_constraint.definition NOT LIKE '%num_nonnulls(project_id, business_area_id) = 1%'
  THEN
    RAISE EXCEPTION
      'ALLEATO_BRAIN_OPERATIONAL_TYPED_TARGET_CONSTRAINT_INVALID';
  END IF;
END
$$;

COMMENT ON COLUMN public.meetings.business_area_id IS
  'Alleato Brain branch. Migrated records may retain project_id during comparison mode.';
COMMENT ON COLUMN public.tasks.business_area_id IS
  'Alleato Brain branch. Migrated records may retain project_id during comparison mode.';
COMMENT ON COLUMN public.files.business_area_id IS
  'Alleato Brain branch. Migrated records may retain project_id during comparison mode.';
COMMENT ON COLUMN public.project_attribution_rules.business_area_id IS
  'Typed Business Area routing target. Active rules have exactly one project or Business Area target.';

-- 2) Durable, per-run migration ledger.

CREATE TABLE IF NOT EXISTS public.business_area_migration_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_key text NOT NULL UNIQUE,
  phase text NOT NULL,
  status text NOT NULL DEFAULT 'running',
  initiated_by uuid REFERENCES public.people(id) ON DELETE SET NULL,
  source_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  result_summary jsonb NOT NULL DEFAULT '{}'::jsonb,
  rollback_status text NOT NULL DEFAULT 'available',
  started_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT business_area_migration_runs_phase_nonempty
    CHECK (length(btrim(phase)) > 0),
  CONSTRAINT business_area_migration_runs_status_check
    CHECK (status IN ('running', 'completed', 'failed', 'rolled_back')),
  CONSTRAINT business_area_migration_runs_rollback_status_check
    CHECK (rollback_status IN ('available', 'in_progress', 'completed', 'failed', 'not_required'))
);

CREATE TABLE IF NOT EXISTS public.business_area_migration_items (
  run_id uuid NOT NULL
    REFERENCES public.business_area_migration_runs(id) ON DELETE RESTRICT,
  source_database text NOT NULL,
  record_type text NOT NULL,
  record_id text NOT NULL,
  old_project_id bigint,
  old_business_area_id bigint
    REFERENCES public.business_areas(id) ON DELETE RESTRICT,
  new_business_area_id bigint NOT NULL
    REFERENCES public.business_areas(id) ON DELETE RESTRICT,
  result text NOT NULL DEFAULT 'pending',
  rollback_state text NOT NULL DEFAULT 'available',
  error_detail text,
  record_snapshot jsonb NOT NULL,
  applied_at timestamptz,
  rolled_back_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (run_id, source_database, record_type, record_id),
  CONSTRAINT business_area_migration_items_source_database_check
    CHECK (source_database IN ('pm_app', 'ai_database')),
  CONSTRAINT business_area_migration_items_record_type_check
    CHECK (
      record_type IN (
        'document',
        'rag_document',
        'rag_chunk',
        'meeting',
        'task',
        'file',
        'attribution_rule'
      )
    ),
  CONSTRAINT business_area_migration_items_result_check
    CHECK (result IN ('pending', 'applied', 'skipped', 'failed', 'rolled_back')),
  CONSTRAINT business_area_migration_items_rollback_state_check
    CHECK (rollback_state IN ('available', 'in_progress', 'completed', 'failed', 'not_required')),
  CONSTRAINT business_area_migration_items_source_record_check
    CHECK (
      (
        source_database = 'pm_app'
        AND record_type IN ('document', 'meeting', 'task', 'file', 'attribution_rule')
      )
      OR (
        source_database = 'ai_database'
        AND record_type IN ('rag_document', 'rag_chunk')
      )
    )
);

CREATE INDEX IF NOT EXISTS idx_business_area_migration_items_record
  ON public.business_area_migration_items (record_type, record_id);
CREATE INDEX IF NOT EXISTS idx_business_area_migration_items_target
  ON public.business_area_migration_items (new_business_area_id, record_type);

DO $$
DECLARE
  expected_index record;
  actual_index record;
BEGIN
  FOR expected_index IN
    SELECT *
    FROM (VALUES
      (
        'idx_business_area_migration_items_record',
        ARRAY['record_type', 'record_id']::text[]
      ),
      (
        'idx_business_area_migration_items_target',
        ARRAY['new_business_area_id', 'record_type']::text[]
      )
    ) AS expected(index_name, columns)
  LOOP
    SELECT
      table_class.relname AS table_name,
      index_catalog.indisunique AS is_unique,
      index_catalog.indisvalid AS is_valid,
      pg_get_expr(index_catalog.indpred, index_catalog.indrelid) AS predicate,
      (
        SELECT array_agg(attribute.attname::text ORDER BY key_position.ordinality)
        FROM unnest(index_catalog.indkey)
          WITH ORDINALITY AS key_position(attnum, ordinality)
        JOIN pg_attribute AS attribute
          ON attribute.attrelid = table_class.oid
         AND attribute.attnum = key_position.attnum
      ) AS columns
    INTO actual_index
    FROM pg_index AS index_catalog
    JOIN pg_class AS index_class ON index_class.oid = index_catalog.indexrelid
    JOIN pg_class AS table_class ON table_class.oid = index_catalog.indrelid
    JOIN pg_namespace AS table_namespace
      ON table_namespace.oid = table_class.relnamespace
    WHERE table_namespace.nspname = 'public'
      AND index_class.relname = expected_index.index_name;

    IF NOT FOUND
      OR actual_index.table_name <> 'business_area_migration_items'
      OR actual_index.is_unique = true
      OR actual_index.is_valid = false
      OR actual_index.predicate IS NOT NULL
      OR actual_index.columns <> expected_index.columns
    THEN
      RAISE EXCEPTION
        'ALLEATO_BRAIN_MIGRATION_LEDGER_INDEX_INVALID: %',
        expected_index.index_name;
    END IF;
  END LOOP;
END
$$;

DO $$
DECLARE
  expected_constraint record;
  actual_constraint record;
BEGIN
  FOR expected_constraint IN
    SELECT *
    FROM (VALUES
      ('business_area_migration_runs_pkey', 'business_area_migration_runs', 'p', 'PRIMARY KEY (id)'),
      ('business_area_migration_runs_run_key_key', 'business_area_migration_runs', 'u', 'UNIQUE (run_key)'),
      ('business_area_migration_runs_initiated_by_fkey', 'business_area_migration_runs', 'f', 'FOREIGN KEY (initiated_by) REFERENCES people(id) ON DELETE SET NULL'),
      ('business_area_migration_runs_phase_nonempty', 'business_area_migration_runs', 'c', 'CHECK ((length(btrim(phase)) > 0))'),
      ('business_area_migration_runs_status_check', 'business_area_migration_runs', 'c', 'CHECK ((status = ANY (ARRAY[''running''::text, ''completed''::text, ''failed''::text, ''rolled_back''::text])))'),
      ('business_area_migration_runs_rollback_status_check', 'business_area_migration_runs', 'c', 'CHECK ((rollback_status = ANY (ARRAY[''available''::text, ''in_progress''::text, ''completed''::text, ''failed''::text, ''not_required''::text])))'),
      ('business_area_migration_items_pkey', 'business_area_migration_items', 'p', 'PRIMARY KEY (run_id, source_database, record_type, record_id)'),
      ('business_area_migration_items_run_id_fkey', 'business_area_migration_items', 'f', 'FOREIGN KEY (run_id) REFERENCES business_area_migration_runs(id) ON DELETE RESTRICT'),
      ('business_area_migration_items_old_business_area_id_fkey', 'business_area_migration_items', 'f', 'FOREIGN KEY (old_business_area_id) REFERENCES business_areas(id) ON DELETE RESTRICT'),
      ('business_area_migration_items_new_business_area_id_fkey', 'business_area_migration_items', 'f', 'FOREIGN KEY (new_business_area_id) REFERENCES business_areas(id) ON DELETE RESTRICT'),
      ('business_area_migration_items_source_database_check', 'business_area_migration_items', 'c', 'CHECK ((source_database = ANY (ARRAY[''pm_app''::text, ''ai_database''::text])))'),
      ('business_area_migration_items_record_type_check', 'business_area_migration_items', 'c', 'CHECK ((record_type = ANY (ARRAY[''document''::text, ''rag_document''::text, ''rag_chunk''::text, ''meeting''::text, ''task''::text, ''file''::text, ''attribution_rule''::text])))'),
      ('business_area_migration_items_result_check', 'business_area_migration_items', 'c', 'CHECK ((result = ANY (ARRAY[''pending''::text, ''applied''::text, ''skipped''::text, ''failed''::text, ''rolled_back''::text])))'),
      ('business_area_migration_items_rollback_state_check', 'business_area_migration_items', 'c', 'CHECK ((rollback_state = ANY (ARRAY[''available''::text, ''in_progress''::text, ''completed''::text, ''failed''::text, ''not_required''::text])))'),
      ('business_area_migration_items_source_record_check', 'business_area_migration_items', 'c', 'CHECK ((((source_database = ''pm_app''::text) AND (record_type = ANY (ARRAY[''document''::text, ''meeting''::text, ''task''::text, ''file''::text, ''attribution_rule''::text]))) OR ((source_database = ''ai_database''::text) AND (record_type = ANY (ARRAY[''rag_document''::text, ''rag_chunk''::text])))))')
    ) AS expected(constraint_name, table_name, constraint_type, definition)
  LOOP
    SELECT
      table_class.relname AS table_name,
      con.contype::text AS constraint_type,
      con.convalidated AS is_validated,
      pg_get_constraintdef(con.oid) AS definition
    INTO actual_constraint
    FROM pg_constraint AS con
    JOIN pg_class AS table_class ON table_class.oid = con.conrelid
    JOIN pg_namespace AS table_namespace
      ON table_namespace.oid = table_class.relnamespace
    WHERE table_namespace.nspname = 'public'
      AND con.conname = expected_constraint.constraint_name;

    IF NOT FOUND
      OR actual_constraint.table_name <> expected_constraint.table_name
      OR actual_constraint.constraint_type <> expected_constraint.constraint_type
      OR actual_constraint.is_validated = false
      OR actual_constraint.definition <> expected_constraint.definition
    THEN
      RAISE EXCEPTION
        'ALLEATO_BRAIN_MIGRATION_LEDGER_CONSTRAINT_INVALID: constraint=% table=%',
        expected_constraint.constraint_name,
        expected_constraint.table_name;
    END IF;

  END LOOP;
END
$$;

DO $$
DECLARE
  expected_column record;
  actual_column record;
BEGIN
  FOR expected_column IN
    SELECT *
    FROM (VALUES
      ('business_area_migration_runs', 'id', 'uuid', true),
      ('business_area_migration_runs', 'run_key', 'text', true),
      ('business_area_migration_runs', 'phase', 'text', true),
      ('business_area_migration_runs', 'status', 'text', true),
      ('business_area_migration_runs', 'source_snapshot', 'jsonb', true),
      ('business_area_migration_runs', 'result_summary', 'jsonb', true),
      ('business_area_migration_runs', 'rollback_status', 'text', true),
      ('business_area_migration_runs', 'initiated_by', 'uuid', false),
      ('business_area_migration_runs', 'started_at', 'timestamp with time zone', true),
      ('business_area_migration_runs', 'completed_at', 'timestamp with time zone', false),
      ('business_area_migration_runs', 'created_at', 'timestamp with time zone', true),
      ('business_area_migration_runs', 'updated_at', 'timestamp with time zone', true),
      ('business_area_migration_items', 'run_id', 'uuid', true),
      ('business_area_migration_items', 'source_database', 'text', true),
      ('business_area_migration_items', 'record_type', 'text', true),
      ('business_area_migration_items', 'record_id', 'text', true),
      ('business_area_migration_items', 'old_project_id', 'bigint', false),
      ('business_area_migration_items', 'old_business_area_id', 'bigint', false),
      ('business_area_migration_items', 'new_business_area_id', 'bigint', true),
      ('business_area_migration_items', 'record_snapshot', 'jsonb', true),
      ('business_area_migration_items', 'result', 'text', true),
      ('business_area_migration_items', 'rollback_state', 'text', true),
      ('business_area_migration_items', 'error_detail', 'text', false),
      ('business_area_migration_items', 'applied_at', 'timestamp with time zone', false),
      ('business_area_migration_items', 'rolled_back_at', 'timestamp with time zone', false),
      ('business_area_migration_items', 'created_at', 'timestamp with time zone', true),
      ('business_area_migration_items', 'updated_at', 'timestamp with time zone', true)
    ) AS expected(table_name, column_name, data_type, is_not_null)
  LOOP
    SELECT
      format_type(attribute.atttypid, attribute.atttypmod) AS data_type,
      attribute.attnotnull AS is_not_null
    INTO actual_column
    FROM pg_attribute AS attribute
    WHERE attribute.attrelid =
        format('public.%I', expected_column.table_name)::regclass
      AND attribute.attname = expected_column.column_name
      AND attribute.attnum > 0
      AND attribute.attisdropped = false;

    IF NOT FOUND
      OR actual_column.data_type <> expected_column.data_type
      OR actual_column.is_not_null <> expected_column.is_not_null
    THEN
      RAISE EXCEPTION
        'ALLEATO_BRAIN_MIGRATION_LEDGER_COLUMN_INVALID: %.%',
        expected_column.table_name,
        expected_column.column_name;
    END IF;
  END LOOP;
END
$$;

COMMENT ON TABLE public.business_area_migration_runs IS
  'Auditable Alleato Brain migration executions, including source counts, result counts, and rollback status.';
COMMENT ON TABLE public.business_area_migration_items IS
  'Exact records touched by an Alleato Brain migration run, with prior scope and rollback state.';

-- 3) Scope-aware access controls.
--
-- Non-restricted branches retain company-wide authenticated read visibility.
-- Restricted branches (Finance) require explicit membership or app-admin
-- access. Restrictive policies protect against legacy permissive policies.

ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_attribution_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.business_area_migration_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.business_area_migration_items ENABLE ROW LEVEL SECURITY;

-- Replace the anonymous compatibility read with an authenticated equivalent.
-- Authenticated visibility is unchanged, while anonymous callers lose access
-- to every file instead of relying on row-policy composition for Finance.
DROP POLICY IF EXISTS "Allow public read" ON public.files;
DROP POLICY IF EXISTS files_authenticated_read ON public.files;
CREATE POLICY files_authenticated_read
  ON public.files
  FOR SELECT
  TO authenticated
  USING (true);

REVOKE SELECT ON TABLE public.files FROM PUBLIC, anon;
GRANT SELECT ON TABLE public.files TO authenticated, service_role;

-- The original meetings policy was created for PUBLIC. Preserve the project
-- membership expression while limiting table access to authenticated users.
DROP POLICY IF EXISTS meetings_member ON public.meetings;
CREATE POLICY meetings_member
  ON public.meetings
  FOR ALL
  TO authenticated
  USING (
    public.current_is_app_admin()
    OR public.current_is_project_member(project_id::bigint)
  )
  WITH CHECK (
    public.current_is_app_admin()
    OR public.current_is_project_member(project_id::bigint)
  );

REVOKE SELECT ON TABLE public.meetings, public.tasks FROM PUBLIC, anon;
GRANT SELECT ON TABLE public.meetings, public.tasks
  TO authenticated, service_role;

DROP POLICY IF EXISTS meetings_business_area_select ON public.meetings;
CREATE POLICY meetings_business_area_select
  ON public.meetings
  FOR SELECT
  TO authenticated
  USING (
    business_area_id IS NOT NULL
    AND (
      public.current_is_app_admin()
      OR public.current_is_business_area_member(business_area_id)
      OR EXISTS (
        SELECT 1
        FROM public.business_areas AS area
        WHERE area.id = business_area_id
          AND area.is_restricted = false
      )
    )
  );

DROP POLICY IF EXISTS meetings_business_area_write ON public.meetings;
CREATE POLICY meetings_business_area_write
  ON public.meetings
  FOR ALL
  TO authenticated
  USING (
    business_area_id IS NOT NULL
    AND (
      public.current_is_app_admin()
      OR public.current_is_business_area_member(business_area_id)
    )
  )
  WITH CHECK (
    business_area_id IS NOT NULL
    AND (
      public.current_is_app_admin()
      OR public.current_is_business_area_member(business_area_id)
    )
  );

DROP POLICY IF EXISTS meetings_restricted_business_area_guard ON public.meetings;
CREATE POLICY meetings_restricted_business_area_guard
  ON public.meetings
  AS RESTRICTIVE
  FOR ALL
  TO authenticated
  USING (
    business_area_id IS NULL
    OR NOT EXISTS (
      SELECT 1
      FROM public.business_areas AS area
      WHERE area.id = business_area_id
        AND area.is_restricted = true
    )
    OR public.current_is_app_admin()
    OR public.current_is_business_area_member(business_area_id)
  )
  WITH CHECK (
    business_area_id IS NULL
    OR NOT EXISTS (
      SELECT 1
      FROM public.business_areas AS area
      WHERE area.id = business_area_id
        AND area.is_restricted = true
    )
    OR public.current_is_app_admin()
    OR public.current_is_business_area_member(business_area_id)
  );

DROP POLICY IF EXISTS tasks_scope_select ON public.tasks;
CREATE POLICY tasks_scope_select
  ON public.tasks
  FOR SELECT
  TO authenticated
  USING (
    public.current_is_app_admin()
    OR (
      project_id IS NOT NULL
      AND public.current_is_project_member(project_id)
    )
    OR (
      business_area_id IS NOT NULL
      AND (
        public.current_is_business_area_member(business_area_id)
        OR EXISTS (
          SELECT 1
          FROM public.business_areas AS area
          WHERE area.id = business_area_id
            AND area.is_restricted = false
        )
      )
    )
    OR (
      project_id IS NULL
      AND business_area_id IS NULL
      AND assignee_person_id = public.current_person_id()
    )
  );

DROP POLICY IF EXISTS tasks_scope_write ON public.tasks;
CREATE POLICY tasks_scope_write
  ON public.tasks
  FOR ALL
  TO authenticated
  USING (
    public.current_is_app_admin()
    OR (
      project_id IS NOT NULL
      AND public.current_is_project_member(project_id)
    )
    OR (
      business_area_id IS NOT NULL
      AND public.current_is_business_area_member(business_area_id)
    )
    OR (
      project_id IS NULL
      AND business_area_id IS NULL
      AND assignee_person_id = public.current_person_id()
    )
  )
  WITH CHECK (
    public.current_is_app_admin()
    OR (
      project_id IS NOT NULL
      AND public.current_is_project_member(project_id)
    )
    OR (
      business_area_id IS NOT NULL
      AND public.current_is_business_area_member(business_area_id)
    )
    OR (
      project_id IS NULL
      AND business_area_id IS NULL
      AND assignee_person_id = public.current_person_id()
    )
  );

DROP POLICY IF EXISTS tasks_restricted_business_area_guard ON public.tasks;
CREATE POLICY tasks_restricted_business_area_guard
  ON public.tasks
  AS RESTRICTIVE
  FOR ALL
  TO authenticated
  USING (
    business_area_id IS NULL
    OR NOT EXISTS (
      SELECT 1
      FROM public.business_areas AS area
      WHERE area.id = business_area_id
        AND area.is_restricted = true
    )
    OR public.current_is_app_admin()
    OR public.current_is_business_area_member(business_area_id)
  )
  WITH CHECK (
    business_area_id IS NULL
    OR NOT EXISTS (
      SELECT 1
      FROM public.business_areas AS area
      WHERE area.id = business_area_id
        AND area.is_restricted = true
    )
    OR public.current_is_app_admin()
    OR public.current_is_business_area_member(business_area_id)
  );

DROP POLICY IF EXISTS files_business_area_select ON public.files;
CREATE POLICY files_business_area_select
  ON public.files
  FOR SELECT
  TO authenticated
  USING (
    business_area_id IS NOT NULL
    AND (
      public.current_is_app_admin()
      OR public.current_is_business_area_member(business_area_id)
      OR EXISTS (
        SELECT 1
        FROM public.business_areas AS area
        WHERE area.id = business_area_id
          AND area.is_restricted = false
      )
    )
  );

DROP POLICY IF EXISTS files_restricted_business_area_guard ON public.files;
CREATE POLICY files_restricted_business_area_guard
  ON public.files
  AS RESTRICTIVE
  FOR ALL
  TO authenticated
  USING (
    business_area_id IS NULL
    OR NOT EXISTS (
      SELECT 1
      FROM public.business_areas AS area
      WHERE area.id = business_area_id
        AND area.is_restricted = true
    )
    OR public.current_is_app_admin()
    OR public.current_is_business_area_member(business_area_id)
  )
  WITH CHECK (
    business_area_id IS NULL
    OR NOT EXISTS (
      SELECT 1
      FROM public.business_areas AS area
      WHERE area.id = business_area_id
        AND area.is_restricted = true
    )
    OR public.current_is_app_admin()
    OR public.current_is_business_area_member(business_area_id)
  );

DROP POLICY IF EXISTS project_attribution_rules_admin_all
  ON public.project_attribution_rules;
CREATE POLICY project_attribution_rules_admin_all
  ON public.project_attribution_rules
  FOR ALL
  TO authenticated
  USING (public.current_is_app_admin())
  WITH CHECK (public.current_is_app_admin());

DROP POLICY IF EXISTS business_area_migration_runs_admin_all
  ON public.business_area_migration_runs;
CREATE POLICY business_area_migration_runs_admin_all
  ON public.business_area_migration_runs
  FOR ALL
  TO authenticated
  USING (public.current_is_app_admin())
  WITH CHECK (public.current_is_app_admin());

DROP POLICY IF EXISTS business_area_migration_items_admin_all
  ON public.business_area_migration_items;
CREATE POLICY business_area_migration_items_admin_all
  ON public.business_area_migration_items
  FOR ALL
  TO authenticated
  USING (public.current_is_app_admin())
  WITH CHECK (public.current_is_app_admin());

REVOKE ALL
  ON TABLE public.business_area_migration_runs,
           public.business_area_migration_items
  FROM PUBLIC, anon;
GRANT SELECT, INSERT, UPDATE, DELETE
  ON TABLE public.business_area_migration_runs,
           public.business_area_migration_items
  TO authenticated, service_role;

COMMIT;
