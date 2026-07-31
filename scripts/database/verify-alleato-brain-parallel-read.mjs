#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../..",
);

function loadEnv(filePath) {
  if (!fs.existsSync(filePath)) return;
  for (const line of fs.readFileSync(filePath, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) {
      continue;
    }
    const separator = trimmed.indexOf("=");
    const key = trimmed.slice(0, separator).trim();
    let value = trimmed.slice(separator + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = value;
  }
}

function projectRef() {
  const source =
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL ?? "";
  const match = new URL(source).hostname.match(/^([^.]+)\.supabase\.co$/);
  if (!match?.[1]) {
    throw new Error(
      "ALLEATO_BRAIN_PARALLEL_CONFIG_MISSING: a valid Supabase URL is required",
    );
  }
  return match[1];
}

async function query(sql, readOnly) {
  const token = process.env.SUPABASE_ACCESS_TOKEN;
  if (!token) {
    throw new Error(
      "ALLEATO_BRAIN_PARALLEL_CONFIG_MISSING: SUPABASE_ACCESS_TOKEN is required",
    );
  }
  const response = await fetch(
    `https://api.supabase.com/v1/projects/${projectRef()}/database/query`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ query: sql, read_only: readOnly }),
    },
  );
  const body = await response.text();
  if (!response.ok) {
    throw new Error(
      `ALLEATO_BRAIN_PARALLEL_QUERY_FAILED: http=${response.status} detail=${body || "empty response"}`,
    );
  }
  return body ? JSON.parse(body) : [];
}

if (process.env.ALLEATO_ENV_FILE) {
  loadEnv(path.resolve(process.env.ALLEATO_ENV_FILE));
}
loadEnv(path.join(repoRoot, ".env"));

const migrationVersion = "20260724090000";
const migrationPath = path.join(
  repoRoot,
  `supabase/migrations/${migrationVersion}_harden_business_area_parallel_reads.sql`,
);

if (process.argv.includes("--apply")) {
  if (process.env.ALLEATO_BRAIN_APPLY !== migrationVersion) {
    throw new Error(
      `ALLEATO_BRAIN_PARALLEL_APPLY_CONFIRMATION_REQUIRED: set ALLEATO_BRAIN_APPLY=${migrationVersion}`,
    );
  }
  await query(fs.readFileSync(migrationPath, "utf8"), false);
  console.log(
    `Alleato Brain parallel-read migration ${migrationVersion} applied to the linked database.`,
  );
  process.exit(0);
}

if (process.argv.includes("--compile")) {
  const migration = fs.readFileSync(migrationPath, "utf8");
  const rollbackMigration = migration.replace(/\bCOMMIT;\s*$/u, "ROLLBACK;");

  if (rollbackMigration === migration) {
    throw new Error(
      "ALLEATO_BRAIN_PARALLEL_COMPILE_INVALID: terminal COMMIT was not found",
    );
  }

  await query(rollbackMigration, false);
  console.log(
    "Alleato Brain parallel-read migration compiled in a live transaction and rolled back.",
  );
  process.exit(0);
}

const policyAudit = await query(
  String.raw`
SELECT
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE schemaname = 'public'
  AND policyname IN (
    'meetings_business_area_parallel_select',
    'meetings_restricted_business_area_guard',
    'tasks_business_area_parallel_select',
    'tasks_restricted_business_area_guard'
  )
ORDER BY tablename, policyname;
`,
  true,
);

if (policyAudit.length !== 4) {
  throw new Error(
    `ALLEATO_BRAIN_PARALLEL_POLICY_MISSING: expected=4 observed=${policyAudit.length}`,
  );
}
for (const policy of policyAudit) {
  if (
    policy.cmd === "SELECT" &&
    (policy.permissive !== "PERMISSIVE" ||
      !policy.qual?.includes("resolve_business_area_scope") ||
      !policy.qual?.includes("current_is_active_internal_employee"))
  ) {
    throw new Error(
      `ALLEATO_BRAIN_PARALLEL_SELECT_INVALID: ${policy.policyname}`,
    );
  }
  if (
    policy.cmd === "ALL" &&
    (policy.permissive !== "RESTRICTIVE" ||
      !policy.qual?.includes("business_area_scope_is_consistent") ||
      !policy.qual?.includes("current_can_access_business_area_scopes") ||
      !policy.with_check?.includes("business_area_scope_is_consistent") ||
      !policy.with_check?.includes("current_can_access_business_area_scopes"))
  ) {
    throw new Error(
      `ALLEATO_BRAIN_PARALLEL_GUARD_INVALID: ${policy.policyname}`,
    );
  }
}

const helperAudit = await query(
  String.raw`
SELECT
  p.proname,
  p.prosecdef,
  p.provolatile,
  p.proconfig,
  has_function_privilege('anon', p.oid, 'EXECUTE') AS anon_execute,
  has_function_privilege('authenticated', p.oid, 'EXECUTE') AS authenticated_execute
FROM pg_proc AS p
JOIN pg_namespace AS n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.oid IN (
    'public.resolve_business_area_scope(bigint,bigint)'::regprocedure,
    'public.business_area_scope_is_consistent(bigint,bigint)'::regprocedure,
    'public.current_is_active_internal_employee()'::regprocedure,
    'public.current_can_access_business_area_scopes(bigint,bigint)'::regprocedure
  )
ORDER BY p.proname;
`,
  true,
);

if (helperAudit.length !== 4) {
  throw new Error(
    `ALLEATO_BRAIN_PARALLEL_HELPER_MISSING: expected=4 observed=${helperAudit.length}`,
  );
}
for (const helper of helperAudit) {
  if (
    helper.prosecdef !== true ||
    helper.provolatile !== "s" ||
    helper.anon_execute !== false ||
    helper.authenticated_execute !== true ||
    !helper.proconfig?.includes('search_path=""')
  ) {
    throw new Error(
      `ALLEATO_BRAIN_PARALLEL_HELPER_INVALID: ${helper.proname}`,
    );
  }
}

await query(
  String.raw`
BEGIN;

SELECT set_config(
  'brainread.open_project_id',
  (
    SELECT mapping.project_id::text
    FROM public.business_area_project_map AS mapping
    JOIN public.business_areas AS area
      ON area.id = mapping.business_area_id
    WHERE area.is_restricted = false
    ORDER BY mapping.project_id
    LIMIT 1
  ),
  true
);
SELECT set_config(
  'brainread.open_area_id',
  (
    SELECT mapping.business_area_id::text
    FROM public.business_area_project_map AS mapping
    JOIN public.business_areas AS area
      ON area.id = mapping.business_area_id
    WHERE area.is_restricted = false
    ORDER BY mapping.project_id
    LIMIT 1
  ),
  true
);
SELECT set_config(
  'brainread.finance_project_id',
  (
    SELECT mapping.project_id::text
    FROM public.business_area_project_map AS mapping
    JOIN public.business_areas AS area
      ON area.id = mapping.business_area_id
    WHERE area.key = 'finance'
    LIMIT 1
  ),
  true
);
SELECT set_config(
  'brainread.finance_area_id',
  (
    SELECT area.id::text
    FROM public.business_areas AS area
    WHERE area.key = 'finance'
    LIMIT 1
  ),
  true
);
SELECT set_config(
  'brainread.auth_id',
  (
    SELECT users_auth.auth_user_id::text
    FROM public.users_auth
    JOIN public.people AS person
      ON person.id = users_auth.person_id
    LEFT JOIN public.user_profiles AS profile
      ON profile.id = users_auth.auth_user_id
    WHERE COALESCE(profile.is_admin, false) = false
      AND person.status = 'active'
      AND person.person_type IN ('employee', 'user')
      AND NOT EXISTS (
        SELECT 1
        FROM public.business_area_memberships AS membership
        JOIN public.business_areas AS area
          ON area.id = membership.business_area_id
        WHERE membership.person_id = users_auth.person_id
          AND membership.status = 'active'
          AND area.key = 'finance'
      )
      AND NOT EXISTS (
        SELECT 1
        FROM public.project_directory_memberships AS membership
        WHERE membership.person_id = users_auth.person_id
          AND membership.project_id =
            current_setting('brainread.finance_project_id')::integer
      )
    ORDER BY users_auth.auth_user_id
    LIMIT 1
  ),
  true
);
SELECT set_config(
  'brainread.person_id',
  (
    SELECT person_id::text
    FROM public.users_auth
    WHERE auth_user_id =
      current_setting('brainread.auth_id')::uuid
    LIMIT 1
  ),
  true
);

DO $$
BEGIN
  IF current_setting('brainread.open_project_id', true) IS NULL
    OR current_setting('brainread.open_area_id', true) IS NULL
    OR current_setting('brainread.finance_project_id', true) IS NULL
    OR current_setting('brainread.finance_area_id', true) IS NULL
    OR current_setting('brainread.auth_id', true) IS NULL
    OR current_setting('brainread.person_id', true) IS NULL
  THEN
    RAISE EXCEPTION 'ALLEATO_BRAIN_PARALLEL_FIXTURE_PREREQUISITE_MISSING';
  END IF;
END
$$;

INSERT INTO public.project_directory_memberships (
  project_id,
  person_id,
  status,
  user_type
)
VALUES (
  current_setting('brainread.finance_project_id')::integer,
  current_setting('brainread.person_id')::uuid,
  'active',
  'employee'
);

SELECT set_config('brainread.open_series', gen_random_uuid()::text, true);
SELECT set_config('brainread.finance_series', gen_random_uuid()::text, true);
SELECT set_config('brainread.open_meeting', gen_random_uuid()::text, true);
SELECT set_config('brainread.finance_meeting', gen_random_uuid()::text, true);
SELECT set_config('brainread.open_task', gen_random_uuid()::text, true);
SELECT set_config('brainread.finance_task', gen_random_uuid()::text, true);
SELECT set_config('brainread.mixed_meeting', gen_random_uuid()::text, true);
SELECT set_config('brainread.mixed_task', gen_random_uuid()::text, true);

INSERT INTO public.meeting_series (id, project_id, name)
VALUES
  (
    current_setting('brainread.open_series')::uuid,
    current_setting('brainread.open_project_id')::integer,
    'brain-parallel-open-' || txid_current()::text
  ),
  (
    current_setting('brainread.finance_series')::uuid,
    current_setting('brainread.finance_project_id')::integer,
    'brain-parallel-finance-' || txid_current()::text
  );

INSERT INTO public.meetings (
  id,
  project_id,
  business_area_id,
  series_id,
  number,
  name
)
VALUES
  (
    current_setting('brainread.open_meeting')::uuid,
    current_setting('brainread.open_project_id')::integer,
    NULL,
    current_setting('brainread.open_series')::uuid,
    1,
    'rolled-back open legacy meeting'
  ),
  (
    current_setting('brainread.finance_meeting')::uuid,
    current_setting('brainread.finance_project_id')::integer,
    NULL,
    current_setting('brainread.finance_series')::uuid,
    1,
    'rolled-back Finance legacy meeting'
  ),
  (
    current_setting('brainread.mixed_meeting')::uuid,
    current_setting('brainread.finance_project_id')::integer,
    current_setting('brainread.open_area_id')::bigint,
    current_setting('brainread.finance_series')::uuid,
    2,
    'rolled-back mismatched Finance meeting'
  );

INSERT INTO public.tasks (
  id,
  project_id,
  business_area_id,
  title,
  description,
  source_system
)
VALUES
  (
    current_setting('brainread.open_task')::uuid,
    current_setting('brainread.open_project_id')::integer,
    NULL,
    'Verify open branch parallel read',
    'rolled-back unrestricted legacy task',
    'brain-parallel-negative-test'
  ),
  (
    current_setting('brainread.finance_task')::uuid,
    current_setting('brainread.finance_project_id')::integer,
    NULL,
    'Verify Finance branch denial',
    'rolled-back restricted legacy task',
    'brain-parallel-negative-test'
  ),
  (
    current_setting('brainread.mixed_task')::uuid,
    current_setting('brainread.finance_project_id')::integer,
    current_setting('brainread.open_area_id')::bigint,
    'Reject a mismatched Finance task',
    'rolled-back mismatched branch task',
    'brain-parallel-negative-test'
  );

SET LOCAL ROLE authenticated;
SELECT set_config(
  'request.jwt.claims',
  jsonb_build_object(
    'sub',
    current_setting('brainread.auth_id'),
    'role',
    'authenticated'
  )::text,
  true
);
SELECT set_config(
  'request.jwt.claim.sub',
  current_setting('brainread.auth_id'),
  true
);

DO $$
DECLARE
  open_meetings integer;
  finance_meetings integer;
  mixed_meetings integer;
  open_tasks integer;
  finance_tasks integer;
  mixed_tasks integer;
BEGIN
  IF public.current_person_id() IS DISTINCT FROM
    current_setting('brainread.person_id')::uuid
    OR NOT public.current_is_active_internal_employee()
    OR public.current_is_app_admin()
    OR public.current_is_business_area_member(
      current_setting('brainread.finance_area_id')::bigint
    )
    OR NOT public.current_is_project_member(
      current_setting('brainread.finance_project_id')::bigint
    )
  THEN
    RAISE EXCEPTION
      'ALLEATO_BRAIN_PARALLEL_PRINCIPAL_INVALID: person=% internal=% admin=% finance_member=% project_member=%',
      public.current_person_id(),
      public.current_is_active_internal_employee(),
      public.current_is_app_admin(),
      public.current_is_business_area_member(
        current_setting('brainread.finance_area_id')::bigint
      ),
      public.current_is_project_member(
        current_setting('brainread.finance_project_id')::bigint
      );
  END IF;

  SELECT count(*)::integer INTO open_meetings
  FROM public.meetings
  WHERE id = current_setting('brainread.open_meeting')::uuid;

  SELECT count(*)::integer INTO finance_meetings
  FROM public.meetings
    WHERE id = current_setting('brainread.finance_meeting')::uuid;

  SELECT count(*)::integer INTO mixed_meetings
  FROM public.meetings
  WHERE id = current_setting('brainread.mixed_meeting')::uuid;

  SELECT count(*)::integer INTO open_tasks
  FROM public.tasks
  WHERE id = current_setting('brainread.open_task')::uuid;

  SELECT count(*)::integer INTO finance_tasks
  FROM public.tasks
    WHERE id = current_setting('brainread.finance_task')::uuid;

  SELECT count(*)::integer INTO mixed_tasks
  FROM public.tasks
  WHERE id = current_setting('brainread.mixed_task')::uuid;

  IF open_meetings <> 1 OR open_tasks <> 1 THEN
    RAISE EXCEPTION
      'ALLEATO_BRAIN_PARALLEL_OPEN_HIDDEN: meetings=% tasks=%',
      open_meetings,
      open_tasks;
  END IF;
  IF finance_meetings <> 0
    OR finance_tasks <> 0
    OR mixed_meetings <> 0
    OR mixed_tasks <> 0
  THEN
    RAISE EXCEPTION
      'ALLEATO_BRAIN_PARALLEL_FINANCE_VISIBLE: meetings=% tasks=% mixed_meetings=% mixed_tasks=%',
      finance_meetings,
      finance_tasks,
      mixed_meetings,
      mixed_tasks;
  END IF;
END
$$;

RESET ROLE;

UPDATE public.people
SET person_type = 'contact'
WHERE id = current_setting('brainread.person_id')::uuid;

SET LOCAL ROLE authenticated;
SELECT set_config(
  'request.jwt.claims',
  jsonb_build_object(
    'sub',
    current_setting('brainread.auth_id'),
    'role',
    'authenticated'
  )::text,
  true
);
SELECT set_config(
  'request.jwt.claim.sub',
  current_setting('brainread.auth_id'),
  true
);

DO $$
DECLARE
  open_meetings integer;
  open_tasks integer;
BEGIN
  IF public.current_is_active_internal_employee() THEN
    RAISE EXCEPTION 'ALLEATO_BRAIN_PARALLEL_EXTERNAL_PRINCIPAL_ACCEPTED';
  END IF;

  SELECT count(*)::integer INTO open_meetings
  FROM public.meetings
  WHERE id = current_setting('brainread.open_meeting')::uuid;

  SELECT count(*)::integer INTO open_tasks
  FROM public.tasks
  WHERE id = current_setting('brainread.open_task')::uuid;

  IF open_meetings <> 0 OR open_tasks <> 0 THEN
    RAISE EXCEPTION
      'ALLEATO_BRAIN_PARALLEL_EXTERNAL_OPEN_VISIBLE: meetings=% tasks=%',
      open_meetings,
      open_tasks;
  END IF;
END
$$;

RESET ROLE;
ROLLBACK;
`,
  false,
);

console.log(
  "Alleato Brain parallel-read verifier passed: policy/helper contracts match; a rolled-back active internal Finance project member could read unrestricted legacy rows, could not read Finance or mismatched rows, and lost company-wide access when changed to an external contact.",
);
