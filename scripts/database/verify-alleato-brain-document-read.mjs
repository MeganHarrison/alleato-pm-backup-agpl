#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../..",
);
const migrationVersion = "20260724100000";
const migrationPath = path.join(
  repoRoot,
  `supabase/migrations/${migrationVersion}_harden_business_area_document_reads.sql`,
);

function loadEnv(filePath) {
  if (!fs.existsSync(filePath)) return;
  for (const line of fs.readFileSync(filePath, "utf8").split(/\r?\n/u)) {
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
  const match = new URL(source).hostname.match(/^([^.]+)\.supabase\.co$/u);
  if (!match?.[1]) {
    throw new Error(
      "ALLEATO_BRAIN_DOCUMENT_CONFIG_MISSING: a valid Supabase URL is required",
    );
  }
  return match[1];
}

async function query(sql, readOnly) {
  const token = process.env.SUPABASE_ACCESS_TOKEN;
  if (!token) {
    throw new Error(
      "ALLEATO_BRAIN_DOCUMENT_CONFIG_MISSING: SUPABASE_ACCESS_TOKEN is required",
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
      `ALLEATO_BRAIN_DOCUMENT_QUERY_FAILED: http=${response.status} detail=${body || "empty response"}`,
    );
  }
  return body ? JSON.parse(body) : [];
}

if (process.env.ALLEATO_ENV_FILE) {
  loadEnv(path.resolve(process.env.ALLEATO_ENV_FILE));
}
loadEnv(path.join(repoRoot, ".env"));

if (process.argv.includes("--apply")) {
  if (process.env.ALLEATO_BRAIN_APPLY !== migrationVersion) {
    throw new Error(
      `ALLEATO_BRAIN_DOCUMENT_APPLY_CONFIRMATION_REQUIRED: set ALLEATO_BRAIN_APPLY=${migrationVersion}`,
    );
  }
  await query(fs.readFileSync(migrationPath, "utf8"), false);
  console.log(
    `Alleato Brain document-read migration ${migrationVersion} applied to the linked database.`,
  );
  process.exit(0);
}

if (process.argv.includes("--compile")) {
  const migration = fs.readFileSync(migrationPath, "utf8");
  const rollbackMigration = migration.replace(/\bCOMMIT;\s*$/u, "ROLLBACK;");
  if (rollbackMigration === migration) {
    throw new Error(
      "ALLEATO_BRAIN_DOCUMENT_COMPILE_INVALID: terminal COMMIT was not found",
    );
  }
  await query(rollbackMigration, false);
  console.log(
    "Alleato Brain document-read migration compiled in a live transaction and rolled back.",
  );
  process.exit(0);
}

const policies = await query(
  String.raw`
SELECT
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename = 'document_metadata'
  AND policyname IN (
    'document_metadata_business_area_internal_guard',
    'document_metadata_restricted_business_area_guard'
  )
ORDER BY policyname;
`,
  true,
);

if (policies.length !== 2) {
  throw new Error(
    `ALLEATO_BRAIN_DOCUMENT_POLICY_MISSING: expected=2 observed=${policies.length}`,
  );
}

const policyByName = new Map(
  policies.map((candidate) => [candidate.policyname, candidate]),
);
const internalPolicy = policyByName.get(
  "document_metadata_business_area_internal_guard",
);
const restrictedPolicy = policyByName.get(
  "document_metadata_restricted_business_area_guard",
);
if (
  internalPolicy?.permissive !== "RESTRICTIVE" ||
  internalPolicy?.cmd !== "ALL" ||
  !internalPolicy?.roles?.includes("authenticated") ||
  !internalPolicy?.qual?.includes("business_area_id IS NULL") ||
  !internalPolicy?.qual?.includes("current_is_active_internal_employee") ||
  !internalPolicy?.with_check?.includes("business_area_id IS NULL") ||
  !internalPolicy?.with_check?.includes("current_is_active_internal_employee")
) {
  throw new Error(
    `ALLEATO_BRAIN_DOCUMENT_INTERNAL_POLICY_INVALID: ${JSON.stringify(internalPolicy)}`,
  );
}
if (
  restrictedPolicy?.permissive !== "RESTRICTIVE" ||
  restrictedPolicy?.cmd !== "ALL" ||
  !restrictedPolicy?.roles?.includes("authenticated") ||
  !restrictedPolicy?.qual?.includes("business_area_id IS NULL") ||
  !restrictedPolicy?.qual?.includes("current_is_app_admin") ||
  !restrictedPolicy?.qual?.includes("current_is_business_area_member") ||
  !restrictedPolicy?.with_check?.includes("business_area_id IS NULL") ||
  !restrictedPolicy?.with_check?.includes("current_is_app_admin") ||
  !restrictedPolicy?.with_check?.includes("current_is_business_area_member")
) {
  throw new Error(
    `ALLEATO_BRAIN_DOCUMENT_RESTRICTED_POLICY_INVALID: ${JSON.stringify(restrictedPolicy)}`,
  );
}

await query(
  String.raw`
BEGIN;

SELECT set_config(
  'braindoc.open_area_id',
  (
    SELECT area.id::text
    FROM public.business_areas AS area
    WHERE area.is_restricted = false
    ORDER BY area.id
    LIMIT 1
  ),
  true
);
SELECT set_config(
  'braindoc.finance_area_id',
  (
    SELECT area.id::text
    FROM public.business_areas AS area
    WHERE area.key = 'finance'
    LIMIT 1
  ),
  true
);
SELECT set_config(
  'braindoc.auth_id',
  (
    SELECT users_auth.auth_user_id::text
    FROM public.users_auth
    JOIN public.people AS person
      ON person.id = users_auth.person_id
    JOIN public.user_profiles AS profile
      ON profile.id = users_auth.auth_user_id
    WHERE profile.is_admin = false
      AND person.status = 'active'
      AND person.person_type IN ('employee', 'user')
      AND NOT EXISTS (
        SELECT 1
        FROM public.business_area_memberships AS membership
        WHERE membership.person_id = users_auth.person_id
          AND membership.business_area_id =
            current_setting('braindoc.finance_area_id')::bigint
          AND membership.status = 'active'
      )
    ORDER BY users_auth.auth_user_id
    LIMIT 1
  ),
  true
);
SELECT set_config(
  'braindoc.person_id',
  (
    SELECT users_auth.person_id::text
    FROM public.users_auth
    WHERE users_auth.auth_user_id =
      current_setting('braindoc.auth_id')::uuid
    LIMIT 1
  ),
  true
);
SELECT set_config('braindoc.open_document', gen_random_uuid()::text, true);
SELECT set_config('braindoc.finance_document', gen_random_uuid()::text, true);
SELECT set_config('braindoc.unscoped_document', gen_random_uuid()::text, true);
SELECT set_config('braindoc.internal_insert', gen_random_uuid()::text, true);
SELECT set_config('braindoc.finance_insert', gen_random_uuid()::text, true);
SELECT set_config('braindoc.finance_member_insert', gen_random_uuid()::text, true);
SELECT set_config('braindoc.finance_admin_insert', gen_random_uuid()::text, true);
SELECT set_config('braindoc.external_insert', gen_random_uuid()::text, true);
SELECT set_config('braindoc.external_unscoped_insert', gen_random_uuid()::text, true);

DO $$
BEGIN
  IF current_setting('braindoc.open_area_id', true) IS NULL
    OR current_setting('braindoc.finance_area_id', true) IS NULL
    OR current_setting('braindoc.auth_id', true) IS NULL
    OR current_setting('braindoc.person_id', true) IS NULL
  THEN
    RAISE EXCEPTION 'ALLEATO_BRAIN_DOCUMENT_FIXTURE_PREREQUISITE_MISSING';
  END IF;
END
$$;

INSERT INTO public.document_metadata (
  id,
  title,
  category,
  access_level,
  business_area_id
)
VALUES
  (
    current_setting('braindoc.open_document'),
    'rolled-back open Business Area document',
    'knowledge',
    'team',
    current_setting('braindoc.open_area_id')::bigint
  ),
  (
    current_setting('braindoc.finance_document'),
    'rolled-back Finance Business Area document',
    'knowledge',
    'restricted',
    current_setting('braindoc.finance_area_id')::bigint
  ),
  (
    current_setting('braindoc.unscoped_document'),
    'rolled-back unscoped legacy document',
    'knowledge',
    'team',
    NULL
  );

SET LOCAL ROLE authenticated;
SELECT set_config(
  'request.jwt.claims',
  jsonb_build_object(
    'sub',
    current_setting('braindoc.auth_id'),
    'role',
    'authenticated'
  )::text,
  true
);
SELECT set_config(
  'request.jwt.claim.sub',
  current_setting('braindoc.auth_id'),
  true
);

DO $$
DECLARE
  open_documents integer;
  finance_documents integer;
  unscoped_documents integer;
  affected integer;
  finance_insert_denied boolean := false;
  finance_rescope_denied boolean := false;
BEGIN
  IF NOT public.current_is_active_internal_employee()
    OR public.current_is_app_admin()
    OR public.current_is_business_area_member(
      current_setting('braindoc.finance_area_id')::bigint
    )
  THEN
    RAISE EXCEPTION
      'ALLEATO_BRAIN_DOCUMENT_INTERNAL_PRINCIPAL_INVALID: internal=% admin=% finance_member=%',
      public.current_is_active_internal_employee(),
      public.current_is_app_admin(),
      public.current_is_business_area_member(
        current_setting('braindoc.finance_area_id')::bigint
      );
  END IF;

  SELECT count(*)::integer INTO open_documents
  FROM public.document_metadata
  WHERE id = current_setting('braindoc.open_document');

  SELECT count(*)::integer INTO finance_documents
  FROM public.document_metadata
  WHERE id = current_setting('braindoc.finance_document');

  SELECT count(*)::integer INTO unscoped_documents
  FROM public.document_metadata
  WHERE id = current_setting('braindoc.unscoped_document');

  IF open_documents <> 1
    OR finance_documents <> 0
    OR unscoped_documents <> 1
  THEN
    RAISE EXCEPTION
      'ALLEATO_BRAIN_DOCUMENT_INTERNAL_VISIBILITY_INVALID: open=% finance=% unscoped=%',
      open_documents,
      finance_documents,
      unscoped_documents;
  END IF;

  INSERT INTO public.document_metadata (
    id,
    title,
    category,
    access_level,
    business_area_id
  )
  VALUES (
    current_setting('braindoc.internal_insert'),
    'rolled-back internal open insert',
    'knowledge',
    'team',
    current_setting('braindoc.open_area_id')::bigint
  );

  UPDATE public.document_metadata
  SET title = 'rolled-back internal open update'
  WHERE id = current_setting('braindoc.internal_insert');
  GET DIAGNOSTICS affected = ROW_COUNT;
  IF affected <> 1 THEN
    RAISE EXCEPTION
      'ALLEATO_BRAIN_DOCUMENT_INTERNAL_OPEN_UPDATE_INVALID: affected=%',
      affected;
  END IF;

  DELETE FROM public.document_metadata
  WHERE id = current_setting('braindoc.internal_insert');
  GET DIAGNOSTICS affected = ROW_COUNT;
  IF affected <> 1 THEN
    RAISE EXCEPTION
      'ALLEATO_BRAIN_DOCUMENT_INTERNAL_OPEN_DELETE_INVALID: affected=%',
      affected;
  END IF;

  BEGIN
    INSERT INTO public.document_metadata (
      id,
      title,
      category,
      access_level,
      business_area_id
    )
    VALUES (
      current_setting('braindoc.finance_insert'),
      'must reject Finance insert by nonmember',
      'knowledge',
      'restricted',
      current_setting('braindoc.finance_area_id')::bigint
    );
  EXCEPTION
    WHEN insufficient_privilege THEN
      finance_insert_denied := true;
  END;
  IF NOT finance_insert_denied THEN
    RAISE EXCEPTION
      'ALLEATO_BRAIN_DOCUMENT_FINANCE_INSERT_ACCEPTED_FOR_NONMEMBER';
  END IF;

  BEGIN
    UPDATE public.document_metadata
    SET
      business_area_id =
        current_setting('braindoc.finance_area_id')::bigint,
      access_level = 'restricted'
    WHERE id = current_setting('braindoc.open_document');
  EXCEPTION
    WHEN insufficient_privilege THEN
      finance_rescope_denied := true;
  END;
  IF NOT finance_rescope_denied THEN
    RAISE EXCEPTION
      'ALLEATO_BRAIN_DOCUMENT_FINANCE_RESCOPE_ACCEPTED_FOR_NONMEMBER';
  END IF;

  DELETE FROM public.document_metadata
  WHERE id = current_setting('braindoc.finance_document');
  GET DIAGNOSTICS affected = ROW_COUNT;
  IF affected <> 0 THEN
    RAISE EXCEPTION
      'ALLEATO_BRAIN_DOCUMENT_FINANCE_DELETE_ACCEPTED_FOR_NONMEMBER: affected=%',
      affected;
  END IF;
END
$$;

RESET ROLE;

INSERT INTO public.business_area_memberships (
  business_area_id,
  person_id,
  role,
  status
)
VALUES (
  current_setting('braindoc.finance_area_id')::bigint,
  current_setting('braindoc.person_id')::uuid,
  'member',
  'inactive'
);

SET LOCAL ROLE authenticated;
SELECT set_config(
  'request.jwt.claims',
  jsonb_build_object(
    'sub',
    current_setting('braindoc.auth_id'),
    'role',
    'authenticated'
  )::text,
  true
);
SELECT set_config(
  'request.jwt.claim.sub',
  current_setting('braindoc.auth_id'),
  true
);

DO $$
DECLARE
  finance_documents integer;
BEGIN
  IF public.current_is_business_area_member(
    current_setting('braindoc.finance_area_id')::bigint
  ) THEN
    RAISE EXCEPTION
      'ALLEATO_BRAIN_DOCUMENT_INACTIVE_FINANCE_MEMBERSHIP_ACCEPTED';
  END IF;

  SELECT count(*)::integer INTO finance_documents
  FROM public.document_metadata
  WHERE id = current_setting('braindoc.finance_document');
  IF finance_documents <> 0 THEN
    RAISE EXCEPTION
      'ALLEATO_BRAIN_DOCUMENT_INACTIVE_FINANCE_MEMBER_READ_ACCEPTED: observed=%',
      finance_documents;
  END IF;
END
$$;

RESET ROLE;

UPDATE public.business_area_memberships
SET status = 'active'
WHERE business_area_id =
    current_setting('braindoc.finance_area_id')::bigint
  AND person_id = current_setting('braindoc.person_id')::uuid;

SET LOCAL ROLE authenticated;
SELECT set_config(
  'request.jwt.claims',
  jsonb_build_object(
    'sub',
    current_setting('braindoc.auth_id'),
    'role',
    'authenticated'
  )::text,
  true
);
SELECT set_config(
  'request.jwt.claim.sub',
  current_setting('braindoc.auth_id'),
  true
);

DO $$
DECLARE
  finance_documents integer;
  affected integer;
BEGIN
  IF NOT public.current_is_business_area_member(
    current_setting('braindoc.finance_area_id')::bigint
  ) THEN
    RAISE EXCEPTION 'ALLEATO_BRAIN_DOCUMENT_FINANCE_MEMBERSHIP_FIXTURE_INVALID';
  END IF;

  SELECT count(*)::integer INTO finance_documents
  FROM public.document_metadata
  WHERE id = current_setting('braindoc.finance_document');
  IF finance_documents <> 1 THEN
    RAISE EXCEPTION
      'ALLEATO_BRAIN_DOCUMENT_FINANCE_MEMBER_READ_INVALID: observed=%',
      finance_documents;
  END IF;

  INSERT INTO public.document_metadata (
    id,
    title,
    category,
    access_level,
    business_area_id
  )
  VALUES (
    current_setting('braindoc.finance_member_insert'),
    'rolled-back Finance member insert',
    'knowledge',
    'restricted',
    current_setting('braindoc.finance_area_id')::bigint
  );

  UPDATE public.document_metadata
  SET title = 'rolled-back Finance member update'
  WHERE id = current_setting('braindoc.finance_member_insert');
  GET DIAGNOSTICS affected = ROW_COUNT;
  IF affected <> 1 THEN
    RAISE EXCEPTION
      'ALLEATO_BRAIN_DOCUMENT_FINANCE_MEMBER_UPDATE_INVALID: affected=%',
      affected;
  END IF;

  DELETE FROM public.document_metadata
  WHERE id = current_setting('braindoc.finance_member_insert');
  GET DIAGNOSTICS affected = ROW_COUNT;
  IF affected <> 1 THEN
    RAISE EXCEPTION
      'ALLEATO_BRAIN_DOCUMENT_FINANCE_MEMBER_DELETE_INVALID: affected=%',
      affected;
  END IF;
END
$$;

RESET ROLE;

UPDATE public.business_area_memberships
SET status = 'inactive'
WHERE business_area_id =
    current_setting('braindoc.finance_area_id')::bigint
  AND person_id = current_setting('braindoc.person_id')::uuid;

UPDATE public.user_profiles
SET is_admin = true
WHERE id = current_setting('braindoc.auth_id')::uuid;

SET LOCAL ROLE authenticated;
SELECT set_config(
  'request.jwt.claims',
  jsonb_build_object(
    'sub',
    current_setting('braindoc.auth_id'),
    'role',
    'authenticated'
  )::text,
  true
);
SELECT set_config(
  'request.jwt.claim.sub',
  current_setting('braindoc.auth_id'),
  true
);

DO $$
DECLARE
  finance_documents integer;
  affected integer;
BEGIN
  IF NOT public.current_is_app_admin() THEN
    RAISE EXCEPTION 'ALLEATO_BRAIN_DOCUMENT_ADMIN_FIXTURE_INVALID';
  END IF;
  IF public.current_is_business_area_member(
    current_setting('braindoc.finance_area_id')::bigint
  ) THEN
    RAISE EXCEPTION
      'ALLEATO_BRAIN_DOCUMENT_ADMIN_FIXTURE_HAS_ACTIVE_MEMBERSHIP';
  END IF;

  SELECT count(*)::integer INTO finance_documents
  FROM public.document_metadata
  WHERE id = current_setting('braindoc.finance_document');
  IF finance_documents <> 1 THEN
    RAISE EXCEPTION
      'ALLEATO_BRAIN_DOCUMENT_ADMIN_FINANCE_READ_INVALID: observed=%',
      finance_documents;
  END IF;

  INSERT INTO public.document_metadata (
    id,
    title,
    category,
    access_level,
    business_area_id
  )
  VALUES (
    current_setting('braindoc.finance_admin_insert'),
    'rolled-back Finance admin insert',
    'knowledge',
    'restricted',
    current_setting('braindoc.finance_area_id')::bigint
  );

  UPDATE public.document_metadata
  SET title = 'rolled-back Finance admin update'
  WHERE id = current_setting('braindoc.finance_admin_insert');
  GET DIAGNOSTICS affected = ROW_COUNT;
  IF affected <> 1 THEN
    RAISE EXCEPTION
      'ALLEATO_BRAIN_DOCUMENT_ADMIN_FINANCE_UPDATE_INVALID: affected=%',
      affected;
  END IF;

  DELETE FROM public.document_metadata
  WHERE id = current_setting('braindoc.finance_admin_insert');
  GET DIAGNOSTICS affected = ROW_COUNT;
  IF affected <> 1 THEN
    RAISE EXCEPTION
      'ALLEATO_BRAIN_DOCUMENT_ADMIN_FINANCE_DELETE_INVALID: affected=%',
      affected;
  END IF;
END
$$;

RESET ROLE;

UPDATE public.user_profiles
SET is_admin = false
WHERE id = current_setting('braindoc.auth_id')::uuid;

UPDATE public.people
SET person_type = 'contact'
WHERE id = current_setting('braindoc.person_id')::uuid;

SET LOCAL ROLE authenticated;
SELECT set_config(
  'request.jwt.claims',
  jsonb_build_object(
    'sub',
    current_setting('braindoc.auth_id'),
    'role',
    'authenticated'
  )::text,
  true
);
SELECT set_config(
  'request.jwt.claim.sub',
  current_setting('braindoc.auth_id'),
  true
);

DO $$
DECLARE
  open_documents integer;
  finance_documents integer;
  unscoped_documents integer;
  affected integer;
  external_insert_denied boolean := false;
BEGIN
  IF public.current_is_active_internal_employee() THEN
    RAISE EXCEPTION 'ALLEATO_BRAIN_DOCUMENT_EXTERNAL_PRINCIPAL_ACCEPTED';
  END IF;

  SELECT count(*)::integer INTO open_documents
  FROM public.document_metadata
  WHERE id = current_setting('braindoc.open_document');

  SELECT count(*)::integer INTO finance_documents
  FROM public.document_metadata
  WHERE id = current_setting('braindoc.finance_document');

  SELECT count(*)::integer INTO unscoped_documents
  FROM public.document_metadata
  WHERE id = current_setting('braindoc.unscoped_document');

  IF open_documents <> 0
    OR finance_documents <> 0
    OR unscoped_documents <> 1
  THEN
    RAISE EXCEPTION
      'ALLEATO_BRAIN_DOCUMENT_EXTERNAL_VISIBILITY_INVALID: open=% finance=% unscoped=%',
      open_documents,
      finance_documents,
      unscoped_documents;
  END IF;

  BEGIN
    INSERT INTO public.document_metadata (
      id,
      title,
      category,
      access_level,
      business_area_id
    )
    VALUES (
      current_setting('braindoc.external_insert'),
      'must reject external Business Area insert',
      'knowledge',
      'team',
      current_setting('braindoc.open_area_id')::bigint
    );
  EXCEPTION
    WHEN insufficient_privilege THEN
      external_insert_denied := true;
  END;
  IF NOT external_insert_denied THEN
    RAISE EXCEPTION
      'ALLEATO_BRAIN_DOCUMENT_EXTERNAL_INSERT_ACCEPTED';
  END IF;

  UPDATE public.document_metadata
  SET title = 'must not update external Business Area document'
  WHERE id = current_setting('braindoc.open_document');
  GET DIAGNOSTICS affected = ROW_COUNT;
  IF affected <> 0 THEN
    RAISE EXCEPTION
      'ALLEATO_BRAIN_DOCUMENT_EXTERNAL_UPDATE_ACCEPTED: affected=%',
      affected;
  END IF;

  DELETE FROM public.document_metadata
  WHERE id = current_setting('braindoc.open_document');
  GET DIAGNOSTICS affected = ROW_COUNT;
  IF affected <> 0 THEN
    RAISE EXCEPTION
      'ALLEATO_BRAIN_DOCUMENT_EXTERNAL_DELETE_ACCEPTED: affected=%',
      affected;
  END IF;

  INSERT INTO public.document_metadata (
    id,
    title,
    category,
    access_level,
    business_area_id
  )
  VALUES (
    current_setting('braindoc.external_unscoped_insert'),
    'rolled-back external unscoped insert',
    'knowledge',
    'team',
    NULL
  );

  UPDATE public.document_metadata
  SET title = 'rolled-back external unscoped update'
  WHERE id = current_setting('braindoc.unscoped_document');
  GET DIAGNOSTICS affected = ROW_COUNT;
  IF affected <> 1 THEN
    RAISE EXCEPTION
      'ALLEATO_BRAIN_DOCUMENT_UNSCOPED_UPDATE_REGRESSION: affected=%',
      affected;
  END IF;

  DELETE FROM public.document_metadata
  WHERE id = current_setting('braindoc.external_unscoped_insert');
  GET DIAGNOSTICS affected = ROW_COUNT;
  IF affected <> 1 THEN
    RAISE EXCEPTION
      'ALLEATO_BRAIN_DOCUMENT_UNSCOPED_DELETE_REGRESSION: affected=%',
      affected;
  END IF;
END
$$;

RESET ROLE;
ROLLBACK;
`,
  false,
);

console.log(
  "Alleato Brain document authorization passed: internal open-branch CRUD succeeded; Finance nonmember and inactive-member access were denied; active-member and app-admin Finance CRUD succeeded independently; the same externalized identity was denied Business Area CRUD while unscoped legacy CRUD remained available; all fixture mutations rolled back.",
);
