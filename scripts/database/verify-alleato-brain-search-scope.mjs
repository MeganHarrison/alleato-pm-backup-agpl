#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const AI_PROJECT_REF = "fqcvmfqldlewvbsuxdvz";
const MIGRATION_VERSION = "20260724065000";
const EXPECTED_SIGNATURE =
  "search_document_chunks(halfvec,text[],bigint,integer,double precision,text,text,boolean,text,text,bigint)";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, "../..");

function loadEnv(file) {
  if (!fs.existsSync(file)) return;
  for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
    const match = line.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
    if (!match || process.env[match[1]]) continue;
    let value = match[2].trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    process.env[match[1]] = value;
  }
}

if (process.env.ALLEATO_ENV_FILE) {
  loadEnv(path.resolve(process.env.ALLEATO_ENV_FILE));
}
loadEnv(path.join(repoRoot, ".env"));

function assertContract(contract) {
  const failures = [];
  const signatures = Array.isArray(contract.signatures)
    ? contract.signatures
    : [];

  if (
    signatures.length !== 1 ||
    signatures[0]?.signature !== EXPECTED_SIGNATURE
  ) {
    failures.push(
      `expected only ${EXPECTED_SIGNATURE}; got ${JSON.stringify(signatures)}`,
    );
  }
  if (!contract.definition?.includes("filter_business_area_id bigint")) {
    failures.push("function definition is missing filter_business_area_id");
  }
  if (
    !contract.definition?.includes(
      "filter_project_id IS NOT NULL\n     AND filter_business_area_id IS NOT NULL",
    )
  ) {
    failures.push("function definition is missing the typed-scope XOR guard");
  }
  if (
    !contract.definition?.includes(
      "nullif(dc.metadata ->> 'business_area_id', '')::bigint",
    )
  ) {
    failures.push("candidate query is missing the Business Area metadata filter");
  }
  if (!contract.definition?.includes("'filterBusinessAreaId'")) {
    failures.push("telemetry is missing filterBusinessAreaId");
  }
  if (!contract.service_role_execute) {
    failures.push("service_role EXECUTE is missing");
  }
  for (const role of ["public", "anon", "authenticated"]) {
    if (contract[`${role}_execute`]) {
      failures.push(`${role} unexpectedly retains EXECUTE`);
    }
  }
  if (Number(contract.invalid_business_area_labels) !== 0) {
    failures.push(
      `found ${contract.invalid_business_area_labels} invalid Business Area chunk labels`,
    );
  }
  if (Number(contract.labeled_chunks) <= 0) {
    failures.push("no Business Area-labeled chunks exist for live filter proof");
  }
  if (contract.migration_version !== MIGRATION_VERSION) {
    failures.push(
      `migration ledger missing ${MIGRATION_VERSION}; got ${String(contract.migration_version)}`,
    );
  }

  if (failures.length) {
    throw new Error(
      `ALLEATO_BRAIN_SEARCH_SCOPE_CONTRACT_FAILED:\n- ${failures.join("\n- ")}`,
    );
  }
}

async function providerQuery(query) {
  const token = process.env.SUPABASE_ACCESS_TOKEN;
  if (!token) {
    throw new Error(
      "ALLEATO_BRAIN_SEARCH_SCOPE_CONFIG_MISSING: SUPABASE_ACCESS_TOKEN",
    );
  }

  const url = `https://api.supabase.com/v1/projects/${AI_PROJECT_REF}/database/query`;
  let lastFailure = "";
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ query }),
    });
    const body = await response.text();
    if (response.ok) {
      return JSON.parse(body);
    }
    lastFailure = `http=${response.status} detail=${body.slice(0, 1200)}`;
    if (response.status < 500 || attempt === 3) break;
    await new Promise((resolve) => setTimeout(resolve, attempt * 250));
  }

  throw new Error(
    `ALLEATO_BRAIN_SEARCH_SCOPE_QUERY_FAILED: project=${AI_PROJECT_REF} ${lastFailure}`,
  );
}

const validFixture = {
  signatures: [{ signature: EXPECTED_SIGNATURE }],
  definition: `filter_business_area_id bigint
filter_project_id IS NOT NULL
     AND filter_business_area_id IS NOT NULL
nullif(dc.metadata ->> 'business_area_id', '')::bigint
'filterBusinessAreaId'`,
  public_execute: false,
  anon_execute: false,
  authenticated_execute: false,
  service_role_execute: true,
  invalid_business_area_labels: 0,
  labeled_chunks: 1,
  migration_version: MIGRATION_VERSION,
};

if (process.argv.includes("--self-test")) {
  assertContract(validFixture);
  for (const mutate of [
    (fixture) => fixture.signatures.push({ signature: "legacy()" }),
    (fixture) => {
      fixture.definition = fixture.definition.replace(
        "filter_business_area_id bigint",
        "",
      );
    },
    (fixture) => {
      fixture.anon_execute = true;
    },
    (fixture) => {
      fixture.invalid_business_area_labels = 1;
    },
    (fixture) => {
      fixture.migration_version = null;
    },
  ]) {
    const fixture = structuredClone(validFixture);
    mutate(fixture);
    let rejected = false;
    try {
      assertContract(fixture);
    } catch {
      rejected = true;
    }
    if (!rejected) {
      throw new Error(
        "ALLEATO_BRAIN_SEARCH_SCOPE_SELF_TEST_FAILED: invalid fixture passed",
      );
    }
  }
  console.log("Alleato Brain search-scope self-test passed.");
  process.exit(0);
}

if (process.argv.includes("--negative-path")) {
  const result = await providerQuery(String.raw`
DO $$
DECLARE
  observed_message text;
BEGIN
  BEGIN
    PERFORM *
    FROM public.search_document_chunks(
      NULL::halfvec,
      NULL,
      60,
      1,
      -1,
      'vector',
      NULL,
      false,
      NULL,
      NULL,
      1
    );
    RAISE EXCEPTION 'MIXED_SCOPE_WAS_ACCEPTED';
  EXCEPTION
    WHEN SQLSTATE '22023' THEN
      GET STACKED DIAGNOSTICS observed_message = MESSAGE_TEXT;
      IF observed_message <>
         'search_document_chunks accepts project scope XOR Business Area scope'
      THEN
        RAISE EXCEPTION 'UNEXPECTED_MIXED_SCOPE_ERROR: %', observed_message;
      END IF;
  END;

  BEGIN
    PERFORM *
    FROM public.search_document_chunks(
      NULL::halfvec,
      NULL,
      NULL,
      1,
      -1,
      'vector',
      NULL,
      false,
      NULL,
      NULL,
      0
    );
    RAISE EXCEPTION 'NONPOSITIVE_BUSINESS_AREA_WAS_ACCEPTED';
  EXCEPTION
    WHEN SQLSTATE '22023' THEN
      GET STACKED DIAGNOSTICS observed_message = MESSAGE_TEXT;
      IF observed_message <> 'filter_business_area_id must be positive' THEN
        RAISE EXCEPTION
          'UNEXPECTED_NONPOSITIVE_SCOPE_ERROR: %',
          observed_message;
      END IF;
  END;
END
$$;

WITH target AS (
  SELECT
    embedding,
    nullif(metadata ->> 'business_area_id', '')::bigint AS business_area_id
  FROM public.document_chunks
  WHERE embedding IS NOT NULL
    AND metadata ? 'business_area_id'
  ORDER BY created_at DESC
  LIMIT 1
),
filtered AS (
  SELECT result.*
  FROM target
  CROSS JOIN LATERAL public.search_document_chunks(
    target.embedding,
    NULL,
    NULL,
    5,
    -1,
    'vector',
    NULL,
    false,
    NULL,
    NULL,
    target.business_area_id
  ) AS result
)
SELECT jsonb_build_object(
  'targetBusinessAreaId', (SELECT business_area_id FROM target),
  'resultCount', count(*),
  'allResultsExact', coalesce(
    bool_and(
      doc_business_area_id = (SELECT business_area_id FROM target)
    ),
    false
  )
) AS proof
FROM filtered;
`);
  const proof = result?.[0]?.proof;
  if (
    !proof ||
    Number(proof.resultCount) <= 0 ||
    proof.allResultsExact !== true
  ) {
    throw new Error(
      `ALLEATO_BRAIN_SEARCH_SCOPE_NEGATIVE_PATH_FAILED: ${JSON.stringify(proof)}`,
    );
  }
  console.log(JSON.stringify({ status: "PASS", proof }, null, 2));
  process.exit(0);
}

const rows = await providerQuery(String.raw`
WITH functions AS (
  SELECT
    p.oid,
    p.proacl,
    p.proowner,
    p.oid::regprocedure::text AS signature,
    pg_get_functiondef(p.oid) AS definition
  FROM pg_proc AS p
  JOIN pg_namespace AS n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public'
    AND p.proname = 'search_document_chunks'
),
canonical AS (
  SELECT *
  FROM functions
  WHERE signature =
    '${EXPECTED_SIGNATURE}'
),
labels AS (
  SELECT
    count(*) FILTER (
      WHERE metadata ? 'business_area_id'
    )::integer AS labeled_chunks,
    count(*) FILTER (
      WHERE metadata ? 'business_area_id'
        AND CASE
          WHEN coalesce(metadata ->> 'business_area_id', '')
            ~ '^[1-9][0-9]*$'
          THEN (metadata ->> 'business_area_id')::numeric
            > 9007199254740991
          ELSE true
        END
    )::integer AS invalid_business_area_labels
  FROM public.document_chunks
)
SELECT jsonb_build_object(
  'signatures', (
    SELECT coalesce(
      jsonb_agg(jsonb_build_object('signature', signature) ORDER BY signature),
      '[]'::jsonb
    )
    FROM functions
  ),
  'definition', (SELECT definition FROM canonical),
  'public_execute', coalesce((
    SELECT bool_or(
      privilege.grantee = 0
      AND privilege.privilege_type = 'EXECUTE'
    )
    FROM canonical
    CROSS JOIN LATERAL aclexplode(
      coalesce(
        canonical.proacl,
        acldefault('f', canonical.proowner)
      )
    ) AS privilege
  ),
    false
  ),
  'anon_execute', coalesce(
    has_function_privilege(
      'anon',
      '${EXPECTED_SIGNATURE}',
      'EXECUTE'
    ),
    false
  ),
  'authenticated_execute', coalesce(
    has_function_privilege(
      'authenticated',
      '${EXPECTED_SIGNATURE}',
      'EXECUTE'
    ),
    false
  ),
  'service_role_execute', coalesce(
    has_function_privilege(
      'service_role',
      '${EXPECTED_SIGNATURE}',
      'EXECUTE'
    ),
    false
  ),
  'labeled_chunks', labels.labeled_chunks,
  'invalid_business_area_labels', labels.invalid_business_area_labels,
  'migration_version', (
    SELECT version
    FROM supabase_migrations.schema_migrations
    WHERE version = '${MIGRATION_VERSION}'
  ),
  'checked_at', now()
) AS contract
FROM labels;
`);

const contract = rows?.[0]?.contract;
assertContract(contract ?? {});
console.log(JSON.stringify({ status: "PASS", contract }, null, 2));
