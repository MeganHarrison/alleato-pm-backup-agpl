#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "../..");

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

if (process.env.ALLEATO_ENV_FILE) {
  loadEnv(path.resolve(process.env.ALLEATO_ENV_FILE));
}
loadEnv(path.join(repoRoot, ".env"));

function appTransitionIsValid(rows) {
  return rows.every(
    (row) =>
      row.mismatched_legacy_count === 0 &&
      row.legacy_count === row.exact_legacy_count &&
      row.scoped_document_count ===
        row.legacy_count + row.business_area_only_count,
  );
}

function documentTransitionIsValid(counts) {
  return (
    counts.branch_count ===
      counts.dual_scope_count + counts.business_area_only_count &&
    counts.invalid_dual_scope_count === 0
  );
}

function ragTransitionIsValid(rows) {
  return rows.every(
    (row) =>
      row.mismatched_document_count === 0 &&
      row.document_count === row.exact_document_count &&
      row.mismatched_chunk_count === 0 &&
      row.chunk_count === row.exact_chunk_count,
  );
}

function providerQueryFailureMessage(projectRef, status, body) {
  return `Supabase query failed for project ${projectRef} (HTTP ${status}): ${
    body || "provider returned an empty error body"
  }`;
}

function buildCrossDatabaseParity(appRows, ragRows) {
  const mappedProjects = new Set([60, 89, 90, 756, 767]);
  const businessAreaIds = new Set([1, 2, 3, 4, 5]);
  const appIsBrainScoped = (row) =>
    mappedProjects.has(row.project_id) ||
    businessAreaIds.has(row.business_area_id);
  const ragBusinessAreaId = (row) =>
    row.business_area_id_text &&
    /^\d+$/.test(row.business_area_id_text)
      ? Number(row.business_area_id_text)
      : null;
  const ragIsBrainScoped = (row) =>
    mappedProjects.has(row.project_id) ||
    businessAreaIds.has(ragBusinessAreaId(row));
  const appById = new Map(appRows.map((row) => [row.id, row]));
  const ragById = new Map(ragRows.map((row) => [row.id, row]));
  const scopedIds = new Set([
    ...appRows.filter(appIsBrainScoped).map((row) => row.id),
    ...ragRows.filter(ragIsBrainScoped).map((row) => row.id),
  ]);
  const sharedMismatches = [];
  const sharedMismatchGroups = new Map();
  const appBusinessAreaOnlyMissingRag = [];
  const ragBusinessAreaOnlyMissingApp = [];
  let sharedCount = 0;
  let legacyAppMissingRagCount = 0;
  let legacyRagMissingAppCount = 0;

  /*
   * Operate on the union of scoped identifiers and look up counterparts in
   * the complete datasets. An existing but de-scoped row is therefore a
   * mismatch, never a missing replica.
   */
  for (const id of scopedIds) {
    const appRow = appById.get(id);
    const ragRow = ragById.get(id);
    if (!appRow) {
      if (
        ragRow.project_id === null &&
        businessAreaIds.has(ragBusinessAreaId(ragRow))
      ) {
        ragBusinessAreaOnlyMissingApp.push(id);
      } else {
        legacyRagMissingAppCount += 1;
      }
      continue;
    }
    if (!ragRow) {
      if (
        appRow.project_id === null &&
        businessAreaIds.has(appRow.business_area_id)
      ) {
        appBusinessAreaOnlyMissingRag.push(id);
      } else {
        legacyAppMissingRagCount += 1;
      }
      continue;
    }

    sharedCount += 1;
    const resolvedRagBusinessAreaId = ragBusinessAreaId(ragRow);
    if (
      appRow.project_id !== ragRow.project_id ||
      appRow.business_area_id !== resolvedRagBusinessAreaId
    ) {
      const groupKey = JSON.stringify({
        appSource: appRow.source,
        ragSource: ragRow.source,
        appProjectId: appRow.project_id,
        ragProjectId: ragRow.project_id,
        appBusinessAreaId: appRow.business_area_id,
        ragBusinessAreaId: resolvedRagBusinessAreaId,
      });
      sharedMismatchGroups.set(
        groupKey,
        (sharedMismatchGroups.get(groupKey) || 0) + 1,
      );
      sharedMismatches.push({
        id,
        appSource: appRow.source,
        ragSource: ragRow.source,
        appProjectId: appRow.project_id,
        appBusinessAreaId: appRow.business_area_id,
        ragProjectId: ragRow.project_id,
        ragBusinessAreaId: resolvedRagBusinessAreaId,
      });
    }
  }

  const parity = {
    appScopedCount: appRows.filter(appIsBrainScoped).length,
    ragScopedCount: ragRows.filter(ragIsBrainScoped).length,
    sharedCount,
    sharedMismatchCount: sharedMismatches.length,
    sharedMismatchSamples: sharedMismatches.slice(0, 10),
    sharedMismatchGroups: [...sharedMismatchGroups.entries()]
      .map(([group, count]) => ({ ...JSON.parse(group), count }))
      .sort((left, right) => right.count - left.count),
    appBusinessAreaOnlyMissingRagCount:
      appBusinessAreaOnlyMissingRag.length,
    appBusinessAreaOnlyMissingRagSamples:
      appBusinessAreaOnlyMissingRag.slice(0, 10),
    ragBusinessAreaOnlyMissingAppCount:
      ragBusinessAreaOnlyMissingApp.length,
    ragBusinessAreaOnlyMissingAppSamples:
      ragBusinessAreaOnlyMissingApp.slice(0, 10),
    legacyAppMissingRagCount,
    legacyRagMissingAppCount,
  };
  Object.defineProperty(parity, "repairCandidates", {
    value: sharedMismatches,
    enumerable: false,
  });
  return parity;
}

if (process.argv.includes("--self-test")) {
  const validApp = [{
    scoped_document_count: 3,
    legacy_count: 2,
    exact_legacy_count: 2,
    mismatched_legacy_count: 0,
    business_area_only_count: 1,
  }];
  const validCounts = {
    branch_count: 3,
    dual_scope_count: 2,
    business_area_only_count: 1,
    invalid_dual_scope_count: 0,
  };
  const validRag = [{
    document_count: 3,
    exact_document_count: 3,
    mismatched_document_count: 0,
    chunk_count: 7,
    exact_chunk_count: 7,
    mismatched_chunk_count: 0,
  }];
  const invalidApp = [{
    ...validApp[0],
    exact_legacy_count: 1,
    mismatched_legacy_count: 1,
  }];
  const invalidCounts = {
    ...validCounts,
    invalid_dual_scope_count: 1,
  };
  const invalidRag = [{
    ...validRag[0],
    exact_document_count: 2,
    mismatched_document_count: 1,
  }];
  const validCrossDatabase = buildCrossDatabaseParity(
    [
      {
        id: "legacy",
        project_id: 60,
        business_area_id: 3,
      },
      {
        id: "business-area-only",
        project_id: null,
        business_area_id: 3,
      },
    ],
    [
      {
        id: "legacy",
        project_id: 60,
        business_area_id_text: "3",
      },
      {
        id: "business-area-only",
        project_id: null,
        business_area_id_text: "3",
      },
    ],
  );
  const invalidCrossDatabase = buildCrossDatabaseParity(
    [
      {
        id: "business-area-only",
        project_id: null,
        business_area_id: 3,
      },
    ],
    [
      {
        id: "business-area-only",
        project_id: null,
        business_area_id_text: "5",
      },
      {
        id: "missing-app-replica",
        project_id: null,
        business_area_id_text: "3",
      },
    ],
  );
  const deScopedCounterparts = buildCrossDatabaseParity(
    [
      {
        id: "app-scoped",
        project_id: null,
        business_area_id: 3,
      },
      {
        id: "rag-scoped",
        project_id: null,
        business_area_id: null,
      },
    ],
    [
      {
        id: "app-scoped",
        project_id: null,
        business_area_id_text: null,
      },
      {
        id: "rag-scoped",
        project_id: null,
        business_area_id_text: "3",
      },
    ],
  );
  if (
    !appTransitionIsValid(validApp) ||
    !documentTransitionIsValid(validCounts) ||
    !ragTransitionIsValid(validRag) ||
    appTransitionIsValid(invalidApp) ||
    documentTransitionIsValid(invalidCounts) ||
    ragTransitionIsValid(invalidRag) ||
    validCrossDatabase.sharedMismatchCount !== 0 ||
    validCrossDatabase.appBusinessAreaOnlyMissingRagCount !== 0 ||
    validCrossDatabase.ragBusinessAreaOnlyMissingAppCount !== 0 ||
    invalidCrossDatabase.sharedMismatchCount !== 1 ||
    invalidCrossDatabase.ragBusinessAreaOnlyMissingAppCount !== 1 ||
    deScopedCounterparts.sharedMismatchCount !== 2 ||
    deScopedCounterparts.legacyAppMissingRagCount !== 0 ||
    deScopedCounterparts.legacyRagMissingAppCount !== 0
  ) {
    throw new Error(
      "Alleato Brain transition verifier self-test did not distinguish valid and invalid scope states.",
    );
  }
  console.log(
    JSON.stringify({
      status: "PASS",
      check: "Alleato Brain transition-state fixtures",
    }),
  );
  process.exit(0);
}

if (process.argv.includes("--generate-rag-scope-rollback")) {
  const snapshotPath = path.join(
    repoRoot,
    "docs/ops/evidence/2026-07-24-alleato-brain-verifier-v2",
    "rag-scope-pre-repair-snapshot.json",
  );
  const snapshot = JSON.parse(fs.readFileSync(snapshotPath, "utf8"));
  const candidates = new Map(
    snapshot.candidates.map((candidate) => [candidate.id, candidate]),
  );
  const documents = snapshot.rows
    .filter((row) => row.record_type === "document")
    .map((row) => {
      const candidate = candidates.get(row.record_id);
      if (!candidate) {
        throw new Error(
          `Rollback snapshot is missing candidate ${row.record_id}.`,
        );
      }
      return {
        id: row.record_id,
        expected_project_id: candidate.desired_project_id,
        expected_business_area_id: candidate.desired_business_area_id,
        old_project_id: row.project_id,
        had_old_business_area_id: row.had_business_area_id_key,
        old_business_area_id: row.business_area_id_value,
      };
    });
  const chunks = snapshot.rows
    .filter((row) => row.record_type === "chunk")
    .map((row) => {
      const candidate = candidates.get(row.document_id);
      if (!candidate) {
        throw new Error(
          `Rollback snapshot is missing candidate ${row.document_id}.`,
        );
      }
      return {
        id: row.record_id,
        document_id: row.document_id,
        expected_project_id: candidate.desired_project_id,
        expected_business_area_id: candidate.desired_business_area_id,
        had_old_project_id: row.had_project_id_key,
        old_project_id: row.project_id_value,
        had_old_business_area_id: row.had_business_area_id_key,
        old_business_area_id: row.business_area_id_value,
      };
    });
  const documentJson = JSON.stringify(documents);
  const chunkJson = JSON.stringify(chunks);
  if (
    documentJson.includes("$documents$") ||
    chunkJson.includes("$chunks$")
  ) {
    throw new Error("Rollback payload contains a reserved SQL delimiter.");
  }

  await new Promise((resolve, reject) => {
    process.stdout.write(`
begin;
with restore_documents as (
  select *
  from jsonb_to_recordset($documents$${documentJson}$documents$::jsonb)
    as restore(
      id text,
      expected_project_id integer,
      expected_business_area_id bigint,
      old_project_id integer,
      had_old_business_area_id boolean,
      old_business_area_id jsonb
    )
),
updated_documents as (
  update public.rag_document_metadata as document
  set
    project_id = restore.old_project_id,
    source_metadata =
      (coalesce(document.source_metadata, '{}'::jsonb)
        - 'business_area_id')
      || case
        when restore.had_old_business_area_id
          then jsonb_build_object(
            'business_area_id',
            restore.old_business_area_id
          )
        else '{}'::jsonb
      end
  from restore_documents as restore
  where document.id = restore.id
    and document.project_id
      is not distinct from restore.expected_project_id
    and document.source_metadata->>'business_area_id'
      is not distinct from restore.expected_business_area_id::text
  returning document.id
),
restore_chunks as (
  select *
  from jsonb_to_recordset($chunks$${chunkJson}$chunks$::jsonb)
    as restore(
      id text,
      document_id text,
      expected_project_id integer,
      expected_business_area_id bigint,
      had_old_project_id boolean,
      old_project_id jsonb,
      had_old_business_area_id boolean,
      old_business_area_id jsonb
    )
),
updated_chunks as (
  update public.document_chunks as chunk
  set metadata =
    (coalesce(chunk.metadata, '{}'::jsonb)
      - 'project_id'
      - 'business_area_id')
    || case
      when restore.had_old_project_id
        then jsonb_build_object('project_id', restore.old_project_id)
      else '{}'::jsonb
    end
    || case
      when restore.had_old_business_area_id
        then jsonb_build_object(
          'business_area_id',
          restore.old_business_area_id
        )
      else '{}'::jsonb
    end
  from restore_chunks as restore
  where chunk.chunk_id = restore.id
    and chunk.document_id = restore.document_id
    and chunk.metadata->>'project_id'
      is not distinct from restore.expected_project_id::text
    and chunk.metadata->>'business_area_id'
      is not distinct from restore.expected_business_area_id::text
  returning chunk.chunk_id
),
restore_counts as (
  select
    (select count(*)::int from restore_documents) as expected_documents,
    (select count(*)::int from updated_documents) as updated_documents,
    (select count(*)::int from restore_chunks) as expected_chunks,
    (select count(*)::int from updated_chunks) as updated_chunks
),
restore_guard as (
  select case
    when expected_documents = ${documents.length}
      and updated_documents = ${documents.length}
      and expected_chunks = ${chunks.length}
      and updated_chunks = ${chunks.length}
    then 1
    else format(
      'RAG_SCOPE_ROLLBACK_COUNT_MISMATCH expected_documents=%s updated_documents=%s expected_chunks=%s updated_chunks=%s',
      expected_documents,
      updated_documents,
      expected_chunks,
      updated_chunks
    )::integer
  end as all_snapshot_rows_restored
  from restore_counts
)
select restore_counts.*, restore_guard.all_snapshot_rows_restored
from restore_counts
cross join restore_guard;
commit;
`.trimStart(), (error) => {
      if (error) reject(error);
      else resolve();
    });
  });
  process.exit(0);
}

const managementToken =
  process.env.SUPABASE_ACCESS_TOKEN ||
  process.env.SUPABASE_MANAGEMENT_API_TOKEN;
const appProjectRef =
  process.env.SUPABASE_PROJECT_ID || "lgveqfnpkxvzbnnwuled";
const ragProjectRef =
  process.env.RAG_SUPABASE_PROJECT_ID || "fqcvmfqldlewvbsuxdvz";

if (!managementToken) {
  throw new Error(
    "SUPABASE_ACCESS_TOKEN or SUPABASE_MANAGEMENT_API_TOKEN is required.",
  );
}

async function runQuery(projectRef, query) {
  const response = await fetch(
    `https://api.supabase.com/v1/projects/${projectRef}/database/query`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${managementToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ query }),
    },
  );
  if (!response.ok) {
    const providerError = (await response.text()).slice(0, 2000);
    throw new Error(
      providerQueryFailureMessage(
        projectRef,
        response.status,
        providerError,
      ),
    );
  }
  return response.json();
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

if (process.argv.includes("--self-test-repair-guard")) {
  const [fixture] = await runQuery(
    ragProjectRef,
    `
      select id, updated_at
      from public.rag_document_metadata
      order by id
      limit 1
    `,
  );
  assert(fixture?.id, "RAG repair-guard self-test requires one fixture row.");
  const fixturePayload = JSON.stringify([{
    id: fixture.id,
    expected_updated_at: fixture.updated_at,
  }]);
  assert(
    !fixturePayload.includes("$guard_fixture$"),
    "RAG repair-guard fixture contains the reserved SQL delimiter.",
  );

  let guardFailure;
  try {
    await runQuery(
      ragProjectRef,
      `
        begin;
        with fixture as (
          select *
          from jsonb_to_recordset(
            $guard_fixture$${fixturePayload}$guard_fixture$::jsonb
          ) as row(id text, expected_updated_at timestamptz)
        ),
        touched as (
          update public.rag_document_metadata as document
          set updated_at = clock_timestamp()
          from fixture
          where document.id = fixture.id
            and document.updated_at
              is not distinct from fixture.expected_updated_at
          returning document.id
        ),
        counts as (
          select count(*)::int as documents from touched
        ),
        guard as (
          select case
            when documents = 2 then 1
            else format(
              'RAG_SCOPE_REPAIR_COUNT_MISMATCH expected=2 candidates=1 documents=%s',
              documents
            )::integer
          end as all_candidates_updated
          from counts
        )
        select counts.documents, guard.all_candidates_updated
        from counts
        cross join guard;
        commit;
      `,
    );
  } catch (error) {
    guardFailure = error;
  }
  assert(
    guardFailure?.message.includes(
      "RAG_SCOPE_REPAIR_COUNT_MISMATCH expected=2 candidates=1 documents=1",
    ),
    `Repair guard did not surface its named count failure: ${guardFailure?.message || "no error"}`,
  );
  const [after] = await runQuery(
    ragProjectRef,
    `
      select id, updated_at
      from public.rag_document_metadata
      where id = (
        select id
        from jsonb_to_recordset(
          $guard_fixture$${fixturePayload}$guard_fixture$::jsonb
        ) as row(id text, expected_updated_at timestamptz)
      )
    `,
  );
  assert(
    after?.updated_at === fixture.updated_at,
    `Repair guard failed to roll back fixture ${fixture.id}: before=${fixture.updated_at} after=${after?.updated_at}`,
  );
  console.log(JSON.stringify({
    status: "PASS",
    check: "RAG scope repair count guard",
    error:
      "RAG_SCOPE_REPAIR_COUNT_MISMATCH expected=2 candidates=1 documents=1",
    rollbackVerified: true,
  }));
  process.exit(0);
}

const expectedAreas = new Map([
  ["leads", { projectId: 756, restricted: false }],
  ["ai", { projectId: 767, restricted: false }],
  ["finance", { projectId: 60, restricted: true }],
  ["internal-operations", { projectId: 90, restricted: false }],
  ["marketing", { projectId: 89, restricted: false }],
]);

const areas = await runQuery(
  appProjectRef,
  `
    select id::int, key, name, is_restricted
    from public.business_areas
    order by id
  `,
);
const mappings = await runQuery(
  appProjectRef,
  `
    select
      mapping.project_id::int,
      mapping.business_area_id::int,
      area.key
    from public.business_area_project_map as mapping
    join public.business_areas as area on area.id = mapping.business_area_id
    order by mapping.project_id
  `,
);
const appParity = await runQuery(
  appProjectRef,
  `
    select
      mapping.project_id::int,
      mapping.business_area_id::int,
      area.key,
      count(document.id)::int as scoped_document_count,
      count(document.id) filter (
        where document.project_id = mapping.project_id
      )::int as legacy_count,
      count(document.id) filter (
        where document.project_id = mapping.project_id
          and document.business_area_id = mapping.business_area_id
      )::int as exact_legacy_count,
      count(document.id) filter (
        where document.project_id = mapping.project_id
          and document.business_area_id is distinct from mapping.business_area_id
      )::int as mismatched_legacy_count,
      count(document.id) filter (
        where document.project_id is null
          and document.business_area_id = mapping.business_area_id
      )::int as business_area_only_count
    from public.business_area_project_map as mapping
    join public.business_areas as area on area.id = mapping.business_area_id
    left join public.document_metadata as document
      on document.project_id = mapping.project_id
      or (
        document.project_id is null
        and document.business_area_id = mapping.business_area_id
      )
    group by mapping.project_id, mapping.business_area_id, area.key
    order by mapping.project_id
  `,
);
const [documentCounts] = await runQuery(
  appProjectRef,
  `
    select
      count(*) filter (where business_area_id is not null)::int as branch_count,
      count(*) filter (
        where business_area_id is not null and project_id is not null
      )::int as dual_scope_count,
      count(*) filter (
        where business_area_id is not null and project_id is null
      )::int as business_area_only_count,
      count(*) filter (
        where business_area_id is not null
          and project_id is not null
          and not exists (
            select 1
            from public.business_area_project_map as mapping
            where mapping.project_id = document_metadata.project_id
              and mapping.business_area_id = document_metadata.business_area_id
          )
      )::int as invalid_dual_scope_count,
      count(*) filter (
        where business_area_id = (
          select id from public.business_areas where key = 'finance'
        )
      )::int as finance_count,
      count(*) filter (
        where business_area_id = (
          select id from public.business_areas where key = 'finance'
        ) and access_level = 'restricted'
      )::int as restricted_finance_count
    from public.document_metadata
  `,
);
const [membershipCounts] = await runQuery(
  appProjectRef,
  `
    select
      count(*)::int as total,
      count(*) filter (
        where business_area_id = (
          select id from public.business_areas where key = 'finance'
        ) and status = 'active'
      )::int as active_finance
    from public.business_area_memberships
  `,
);
const appSecurity = await runQuery(
  appProjectRef,
  `
    select
      class.relname as table_name,
      class.relrowsecurity as rls_enabled,
      policy.policyname,
      policy.permissive,
      policy.roles,
      policy.cmd,
      policy.qual
    from pg_class as class
    join pg_namespace as namespace on namespace.oid = class.relnamespace
    left join pg_policies as policy
      on policy.schemaname = namespace.nspname
      and policy.tablename = class.relname
    where namespace.nspname = 'public'
      and class.relname in (
        'business_areas',
        'business_area_memberships',
        'business_area_project_map',
        'document_metadata'
      )
    order by class.relname, policy.policyname
  `,
);
const appDocuments = await runQuery(
  appProjectRef,
  `
    select id, source, project_id::int, business_area_id::int
    from public.document_metadata
    order by id
  `,
);
const integrityConstraints = await runQuery(
  appProjectRef,
  `
    select conname, convalidated
    from pg_constraint
    where conrelid in (
      'public.business_areas'::regclass,
      'public.business_area_memberships'::regclass
    )
      and conname in (
        'business_areas_owner_person_id_fkey',
        'business_area_memberships_person_id_fkey',
        'business_area_memberships_role_nonempty',
        'business_area_memberships_status_check'
      )
    order by conname
  `,
);
const [helperSecurity] = await runQuery(
  appProjectRef,
  `
    select
      owner_role.rolname as owner,
      procedure.prosecdef as security_definer,
      procedure.proconfig,
      array(
        select coalesce(grantee_role.rolname, 'PUBLIC')
        from aclexplode(
          coalesce(
            procedure.proacl,
            acldefault('f', procedure.proowner)
          )
        ) as acl
        left join pg_roles as grantee_role
          on grantee_role.oid = acl.grantee
        where acl.privilege_type = 'EXECUTE'
        order by coalesce(grantee_role.rolname, 'PUBLIC')
      ) as execute_grantees,
      has_function_privilege(
        'anon',
        procedure.oid,
        'EXECUTE'
      ) as anon_execute,
      has_function_privilege(
        'authenticated',
        procedure.oid,
        'EXECUTE'
      ) as authenticated_execute,
      has_function_privilege(
        'service_role',
        procedure.oid,
        'EXECUTE'
      ) as service_role_execute
    from pg_proc as procedure
    join pg_namespace as namespace on namespace.oid = procedure.pronamespace
    join pg_roles as owner_role on owner_role.oid = procedure.proowner
    where procedure.oid =
      'public.current_is_business_area_member(bigint)'::regprocedure
  `,
);
const excessiveAppGrants = await runQuery(
  appProjectRef,
  `
    select grantee, table_name, privilege_type
    from information_schema.role_table_grants
    where table_schema = 'public'
      and table_name in (
        'business_areas',
        'business_area_memberships',
        'business_area_project_map'
      )
      and grantee in ('anon', 'authenticated')
      and privilege_type in ('TRUNCATE', 'REFERENCES', 'TRIGGER')
    order by table_name, grantee, privilege_type
  `,
);
const containers = await runQuery(
  appProjectRef,
  `
    select id::int, name, archived
    from public.projects
    where id in (60, 89, 90, 756, 767)
    order by id
  `,
);
const appLedger = await runQuery(
  appProjectRef,
  `
    select version
    from supabase_migrations.schema_migrations
    where version in (
      '20260723180000',
      '20260724043000',
      '20260724052000'
    )
    order by version
  `,
);
const ragParity = await runQuery(
  ragProjectRef,
  `
    with mapping(project_id, business_area_id, key) as (
      values
        (756::bigint, 1::bigint, 'leads'::text),
        (767::bigint, 2::bigint, 'ai'::text),
        (60::bigint, 3::bigint, 'finance'::text),
        (90::bigint, 4::bigint, 'internal-operations'::text),
        (89::bigint, 5::bigint, 'marketing'::text)
    )
    select
      mapping.project_id::int,
      mapping.business_area_id::int,
      mapping.key,
      count(distinct document.id)::int as document_count,
      count(distinct document.id) filter (
        where document.source_metadata->>'business_area_id'
          = mapping.business_area_id::text
          and (
            document.project_id is null
            or document.project_id = mapping.project_id
          )
      )::int as exact_document_count,
      count(distinct document.id) filter (
        where document.source_metadata->>'business_area_id'
          is distinct from mapping.business_area_id::text
          or (
            document.project_id is not null
            and document.project_id is distinct from mapping.project_id
          )
      )::int as mismatched_document_count,
      count(distinct document.id) filter (
        where document.project_id is null
          and document.source_metadata->>'business_area_id'
            = mapping.business_area_id::text
      )::int as business_area_only_document_count,
      count(chunk.chunk_id)::int as chunk_count,
      count(chunk.chunk_id) filter (
        where chunk.metadata->>'business_area_id'
          = mapping.business_area_id::text
      )::int as exact_chunk_count,
      count(chunk.chunk_id) filter (
        where chunk.metadata->>'business_area_id'
          is distinct from mapping.business_area_id::text
      )::int as mismatched_chunk_count
    from mapping
    left join public.rag_document_metadata as document
      on document.project_id = mapping.project_id
      or document.source_metadata->>'business_area_id'
        = mapping.business_area_id::text
    left join public.document_chunks as chunk
      on chunk.document_id = document.id
    group by mapping.project_id, mapping.business_area_id, mapping.key
    order by mapping.project_id
  `,
);
const ragDocuments = await runQuery(
  ragProjectRef,
  `
    select
      id,
      project_id::int,
      source_metadata->>'business_area_id' as business_area_id_text,
      source
    from public.rag_document_metadata
    order by id
  `,
);
const [ragScopeIntegrity] = await runQuery(
  ragProjectRef,
  `
    with mapping(project_id, business_area_id) as (
      values
        (756::bigint, 1::bigint),
        (767::bigint, 2::bigint),
        (60::bigint, 3::bigint),
        (90::bigint, 4::bigint),
        (89::bigint, 5::bigint)
    )
    select
      count(*) filter (
        where document.project_id in (60, 89, 90, 756, 767)
          and not exists (
            select 1
            from mapping
            where mapping.project_id = document.project_id
              and mapping.business_area_id::text
                = document.source_metadata->>'business_area_id'
          )
      )::int as mapped_document_mismatch_count,
      count(*) filter (
        where document.source_metadata ? 'business_area_id'
          and not exists (
            select 1
            from mapping
            where mapping.business_area_id::text
              = document.source_metadata->>'business_area_id'
          )
      )::int as unknown_business_area_count,
      count(*) filter (
        where document.source_metadata ? 'business_area_id'
          and document.project_id is not null
          and not exists (
            select 1
            from mapping
            where mapping.project_id = document.project_id
              and mapping.business_area_id::text
                = document.source_metadata->>'business_area_id'
          )
      )::int as invalid_dual_scope_count,
      count(*) filter (
        where document.project_id is null
          and not (document.source_metadata ? 'business_area_id')
      )::int as unscoped_non_brain_document_count
    from public.rag_document_metadata as document
  `,
);
const [ragChunkIntegrity] = await runQuery(
  ragProjectRef,
  `
    with mapping(project_id, business_area_id) as (
      values
        (756::bigint, 1::bigint),
        (767::bigint, 2::bigint),
        (60::bigint, 3::bigint),
        (90::bigint, 4::bigint),
        (89::bigint, 5::bigint)
    )
    select
      count(*) filter (
        where chunk.metadata ? 'business_area_id'
          and chunk.metadata->>'business_area_id' is not null
          and not exists (
            select 1
            from mapping
            where mapping.business_area_id::text
              = chunk.metadata->>'business_area_id'
          )
      )::int as unknown_business_area_count,
      count(*) filter (
        where document.id is not null
          and (
            document.project_id in (60, 89, 90, 756, 767)
            or document.source_metadata ? 'business_area_id'
          )
          and chunk.metadata->>'business_area_id'
            is distinct from document.source_metadata->>'business_area_id'
      )::int as document_scope_mismatch_count,
      count(*) filter (
        where document.id is null
          and coalesce(chunk.source_type, '') not in (
            'ai_memory',
            'agent_learning',
            'workspace_artifact'
          )
          and (
            chunk.metadata->>'business_area_id' is not null
            or nullif(chunk.metadata->>'project_id', '')::bigint
              in (60, 89, 90, 756, 767)
          )
      )::int as invalid_document_orphan_count,
      count(*) filter (
        where document.id is null
          and chunk.source_type in (
            'ai_memory',
            'agent_learning',
            'workspace_artifact'
          )
          and chunk.metadata->>'business_area_id' is not null
      )::int as standalone_scoped_count,
      count(*) filter (
        where document.id is null
          and chunk.source_type in (
            'ai_memory',
            'agent_learning',
            'workspace_artifact'
          )
          and chunk.metadata->>'business_area_id' is not null
          and chunk.metadata->>'project_id' is not null
          and not exists (
            select 1
            from mapping
            where mapping.project_id::text
              = chunk.metadata->>'project_id'
              and mapping.business_area_id::text
                = chunk.metadata->>'business_area_id'
          )
      )::int as invalid_standalone_dual_scope_count,
      count(*) filter (
        where document.id is null
          and chunk.source_type in (
            'ai_memory',
            'agent_learning',
            'workspace_artifact'
          )
          and nullif(chunk.metadata->>'project_id', '')::bigint
            in (60, 89, 90, 756, 767)
          and not exists (
            select 1
            from mapping
            where mapping.project_id::text
              = chunk.metadata->>'project_id'
              and mapping.business_area_id::text
                = chunk.metadata->>'business_area_id'
          )
      )::int as standalone_mapped_scope_mismatch_count
    from public.document_chunks as chunk
    left join public.rag_document_metadata as document
      on document.id = chunk.document_id
  `,
);
const ragExposure = await runQuery(
  ragProjectRef,
  `
    select grantee, table_name, privilege_type
    from information_schema.role_table_grants
    where table_schema = 'public'
      and table_name in ('document_chunks', 'rag_document_metadata')
      and grantee in ('anon', 'authenticated')
    order by table_name, grantee, privilege_type
  `,
);
const ragEffectiveExposure = await runQuery(
  ragProjectRef,
  `
    select role_name, table_name, privilege
    from (
      select
        role_name,
        table_name,
        privilege,
        has_table_privilege(
          role_name,
          format('public.%I', table_name),
          privilege
        ) as is_granted
      from unnest(array['anon', 'authenticated']) as role_name
      cross join unnest(
        array['document_chunks', 'rag_document_metadata']
      ) as table_name
      cross join unnest(
        array[
          'SELECT',
          'INSERT',
          'UPDATE',
          'DELETE',
          'TRUNCATE',
          'REFERENCES',
          'TRIGGER'
        ]
      ) as privilege
    ) as effective_privileges
    where is_granted
    order by role_name, table_name, privilege
  `,
);
const [ragFunctionSecurity] = await runQuery(
  ragProjectRef,
  `
    select
      procedure.oid::regprocedure::text as signature,
      array(
        select coalesce(grantee_role.rolname, 'PUBLIC')
        from aclexplode(
          coalesce(
            procedure.proacl,
            acldefault('f', procedure.proowner)
          )
        ) as acl
        left join pg_roles as grantee_role
          on grantee_role.oid = acl.grantee
        where acl.privilege_type = 'EXECUTE'
        order by coalesce(grantee_role.rolname, 'PUBLIC')
      ) as execute_grantees,
      has_function_privilege(
        'anon',
        procedure.oid,
        'EXECUTE'
      ) as anon_execute,
      has_function_privilege(
        'authenticated',
        procedure.oid,
        'EXECUTE'
      ) as authenticated_execute,
      has_function_privilege(
        'service_role',
        procedure.oid,
        'EXECUTE'
      ) as service_role_execute
    from pg_proc as procedure
    where procedure.oid =
      'public.search_document_chunks(halfvec,text[],bigint,integer,double precision,text,text,boolean,text,text)'::regprocedure
  `,
);
const ragLedger = await runQuery(
  ragProjectRef,
  `
    select version
    from supabase_migrations.schema_migrations
    where version in (
      '20260724044500',
      '20260724045000',
      '20260724052500'
    )
    order by version
  `,
);

async function visibleFinanceCount(principalSelector) {
  const rows = await runQuery(
    appProjectRef,
    `
      begin;
      select set_config(
        'request.jwt.claim.sub',
        (${principalSelector}),
        true
      );
      set local role authenticated;
      select
        nullif(current_setting('request.jwt.claim.sub', true), '')
          as principal_id,
        count(*)::int as visible_finance_documents
      from public.document_metadata as document
      join public.business_areas as area
        on area.id = document.business_area_id
      where area.key = 'finance';
      commit;
    `,
  );
  return {
    principalId: rows[0]?.principal_id || null,
    visibleFinanceDocuments: rows[0]?.visible_finance_documents,
  };
}

async function visibleFinanceAsSyntheticProject60Member() {
  const rows = await runQuery(
    appProjectRef,
    `
      begin;
      with principal as (
        select
          profile.id as auth_user_id,
          auth_link.person_id
        from public.user_profiles as profile
        join public.users_auth as auth_link
          on auth_link.auth_user_id = profile.id
        where coalesce(profile.is_admin, false) = false
          and coalesce(profile.is_leadership, false) = false
          and not exists (
            select 1
            from public.project_directory_memberships as membership
            where membership.project_id = 60
              and membership.person_id = auth_link.person_id
          )
        limit 1
      )
      insert into public.project_directory_memberships (
        project_id,
        person_id,
        role,
        status,
        metadata
      )
      select
        60,
        principal.person_id,
        'verifier_project_member',
        'active',
        '{"temporary_verifier_fixture":true}'::jsonb
      from principal;
      select set_config(
        'request.jwt.claim.sub',
        (
          select profile.id::text
          from public.user_profiles as profile
          join public.users_auth as auth_link
            on auth_link.auth_user_id = profile.id
          join public.project_directory_memberships as membership
            on membership.person_id = auth_link.person_id
          where membership.project_id = 60
            and membership.metadata->>'temporary_verifier_fixture' = 'true'
          limit 1
        ),
        true
      );
      set local role authenticated;
      select
        nullif(current_setting('request.jwt.claim.sub', true), '')
          as principal_id,
        count(*)::int as visible_finance_documents,
        'transactional_rollback_fixture'::text as membership_mode
      from public.document_metadata as document
      join public.business_areas as area
        on area.id = document.business_area_id
      where area.key = 'finance';
      rollback;
    `,
  );
  return {
    principalId: rows[0]?.principal_id || null,
    visibleFinanceDocuments: rows[0]?.visible_finance_documents,
    membershipMode: rows[0]?.membership_mode || null,
  };
}

const financeVisibility = {
  regularNonAdmin: await visibleFinanceCount(`
    select profile.id::text
    from public.user_profiles as profile
    where coalesce(profile.is_admin, false) = false
      and coalesce(profile.is_leadership, false) = false
    limit 1
  `),
  leadershipNonAdmin: await visibleFinanceCount(`
    select profile.id::text
    from public.user_profiles as profile
    where coalesce(profile.is_admin, false) = false
      and coalesce(profile.is_leadership, false) = true
    limit 1
  `),
  project60MemberNonAdmin:
    await visibleFinanceAsSyntheticProject60Member(),
  appAdmin: await visibleFinanceCount(`
    select profile.id::text
    from public.user_profiles as profile
    where profile.is_admin = true
    limit 1
  `),
};
const crossDatabaseParity = buildCrossDatabaseParity(
  appDocuments,
  ragDocuments,
);

if (process.argv.includes("--repair-rag-scope")) {
  assert(
    process.argv.includes("--confirm-app-authoritative"),
    "RAG scope repair requires --confirm-app-authoritative.",
  );
  const candidates = crossDatabaseParity.repairCandidates.map((mismatch) => ({
    id: mismatch.id,
    desired_project_id: mismatch.appProjectId,
    desired_business_area_id: mismatch.appBusinessAreaId,
    expected_project_id: mismatch.ragProjectId,
    expected_business_area_id: mismatch.ragBusinessAreaId,
  }));
  if (candidates.length === 0) {
    console.log(JSON.stringify({ status: "PASS", repaired: 0 }));
    process.exit(0);
  }

  const serializedCandidates = JSON.stringify(candidates);
  assert(
    !serializedCandidates.includes("$scope$"),
    "RAG scope repair payload contains the reserved SQL delimiter.",
  );
  const desiredScope = `$scope$${serializedCandidates}$scope$::jsonb`;
  const snapshot = await runQuery(
    ragProjectRef,
    `
      with desired as (
        select *
        from jsonb_to_recordset(${desiredScope}) as scope(
          id text,
          desired_project_id integer,
          desired_business_area_id bigint,
          expected_project_id integer,
          expected_business_area_id bigint
        )
      )
      select
        'document'::text as record_type,
        document.id::text as record_id,
        null::text as document_id,
        document.project_id,
        null::boolean as had_project_id_key,
        null::jsonb as project_id_value,
        document.source_metadata ? 'business_area_id'
          as had_business_area_id_key,
        document.source_metadata->'business_area_id'
          as business_area_id_value
      from public.rag_document_metadata as document
      join desired on desired.id = document.id
      union all
      select
        'chunk'::text,
        chunk.chunk_id::text,
        chunk.document_id::text,
        null::integer,
        chunk.metadata ? 'project_id',
        chunk.metadata->'project_id',
        chunk.metadata ? 'business_area_id',
        chunk.metadata->'business_area_id'
      from public.document_chunks as chunk
      join desired on desired.id = chunk.document_id
      order by record_type, record_id
    `,
  );
  const evidenceDirectory = path.join(
    repoRoot,
    "docs/ops/evidence/2026-07-24-alleato-brain-verifier-v2",
  );
  fs.mkdirSync(evidenceDirectory, { recursive: true });
  fs.writeFileSync(
    path.join(evidenceDirectory, "rag-scope-pre-repair-snapshot.json"),
    `${JSON.stringify({
      capturedAt: new Date().toISOString(),
      authoritativeSource: "PM APP public.document_metadata",
      candidates,
      rows: snapshot,
    }, null, 2)}\n`,
  );

  const [repairResult] = await runQuery(
    ragProjectRef,
    `
      begin;
      with desired as (
        select *
        from jsonb_to_recordset(${desiredScope}) as scope(
          id text,
          desired_project_id integer,
          desired_business_area_id bigint,
          expected_project_id integer,
          expected_business_area_id bigint
        )
      ),
      updated_documents as (
        update public.rag_document_metadata as document
        set
          project_id = desired.desired_project_id,
          source_metadata =
            (coalesce(document.source_metadata, '{}'::jsonb)
              - 'business_area_id')
            || jsonb_strip_nulls(jsonb_build_object(
              'business_area_id',
              desired.desired_business_area_id
            )),
          updated_at = now()
        from desired
        where document.id = desired.id
          and document.project_id
            is not distinct from desired.expected_project_id
          and document.source_metadata->>'business_area_id'
            is not distinct from desired.expected_business_area_id::text
        returning document.id
      ),
      updated_chunks as (
        update public.document_chunks as chunk
        set metadata =
          (coalesce(chunk.metadata, '{}'::jsonb)
            - 'project_id'
            - 'business_area_id')
          || jsonb_strip_nulls(jsonb_build_object(
            'project_id',
            desired.desired_project_id,
            'business_area_id',
            desired.desired_business_area_id
          ))
        from desired
        join updated_documents on updated_documents.id = desired.id
        where chunk.document_id = desired.id
        returning chunk.chunk_id
      ),
      repair_counts as (
        select
          (select count(*)::int from desired) as candidates,
          (select count(*)::int from updated_documents) as documents,
          (select count(*)::int from updated_chunks) as chunks
      ),
      repair_guard as (
        select case
          when candidates = ${candidates.length}
            and documents = ${candidates.length}
          then 1
          else format(
            'RAG_SCOPE_REPAIR_COUNT_MISMATCH expected=%s candidates=%s documents=%s',
            ${candidates.length},
            candidates,
            documents
          )::integer
        end as all_candidates_updated
        from repair_counts
      )
      select
        repair_counts.candidates,
        repair_counts.documents,
        repair_counts.chunks,
        (select all_candidates_updated from repair_guard)
          as all_candidates_updated
      from repair_counts;
      commit;
    `,
  );
  assert(
    repairResult.documents === candidates.length,
    `RAG scope repair stopped because only ${repairResult.documents}/${candidates.length} documents matched their captured pre-state.`,
  );
  console.log(JSON.stringify({
    status: "PASS",
    action: "reconciled RAG scope from PM APP",
    ...repairResult,
    snapshot:
      "docs/ops/evidence/2026-07-24-alleato-brain-verifier-v2/rag-scope-pre-repair-snapshot.json",
  }));
  process.exit(0);
}

assert(areas.length === expectedAreas.size, "Expected exactly five Business Areas.");
for (const area of areas) {
  const expected = expectedAreas.get(area.key);
  assert(expected, `Unexpected Business Area '${area.key}'.`);
  assert(
    area.is_restricted === expected.restricted,
    `Business Area '${area.key}' has the wrong restriction setting.`,
  );
}
assert(mappings.length === expectedAreas.size, "Expected exactly five project mappings.");
for (const mapping of mappings) {
  const expected = expectedAreas.get(mapping.key);
  assert(
    expected?.projectId === mapping.project_id,
    `Business Area '${mapping.key}' maps to unexpected project ${mapping.project_id}.`,
  );
}
assert(
  appTransitionIsValid(appParity),
  "PM APP contains a legacy-container document without its exact Business Area label.",
);
assert(
  documentTransitionIsValid(documentCounts),
  "PM APP contains a Business Area document with an invalid legacy project pairing.",
);
assert(
  documentCounts.finance_count === documentCounts.restricted_finance_count,
  "One or more Finance documents are not access_level='restricted'.",
);
assert(
  ragTransitionIsValid(ragParity),
  "AI Database contains a mapped document or chunk without its exact Business Area label.",
);
assert(
  crossDatabaseParity.sharedMismatchCount === 0 &&
    crossDatabaseParity.appBusinessAreaOnlyMissingRagCount === 0 &&
    crossDatabaseParity.ragBusinessAreaOnlyMissingAppCount === 0,
  `PM APP and AI Database disagree on a shared or Business-Area-only document scope: ${JSON.stringify(crossDatabaseParity)}`,
);
assert(
  ragScopeIntegrity.mapped_document_mismatch_count === 0 &&
    ragScopeIntegrity.unknown_business_area_count === 0 &&
    ragScopeIntegrity.invalid_dual_scope_count === 0 &&
    ragChunkIntegrity.unknown_business_area_count === 0 &&
    ragChunkIntegrity.document_scope_mismatch_count === 0 &&
    ragChunkIntegrity.invalid_document_orphan_count === 0 &&
    ragChunkIntegrity.invalid_standalone_dual_scope_count === 0 &&
    ragChunkIntegrity.standalone_mapped_scope_mismatch_count === 0,
  `AI Database contains a malformed, mismatched, or orphaned Alleato Brain scope: ${JSON.stringify({
    ragScopeIntegrity,
    ragChunkIntegrity,
  })}`,
);

const restrictivePolicy = appSecurity.find(
  (row) =>
    row.table_name === "document_metadata" &&
    row.policyname === "document_metadata_restricted_business_area_guard",
);
assert(
  appSecurity
    .filter((row) =>
      [
        "business_areas",
        "business_area_memberships",
        "business_area_project_map",
        "document_metadata",
      ].includes(row.table_name),
    )
    .every((row) => row.rls_enabled === true),
  "RLS is not enabled on every Business Area authorization table.",
);
assert(restrictivePolicy, "Restricted Business Area RLS guard is missing.");
assert(
  restrictivePolicy.permissive === "RESTRICTIVE" &&
    restrictivePolicy.cmd === "SELECT" &&
    restrictivePolicy.roles?.includes("authenticated") &&
    restrictivePolicy.qual?.includes("current_is_app_admin") &&
    restrictivePolicy.qual?.includes("current_is_business_area_member") &&
    restrictivePolicy.qual?.includes("is_restricted"),
  "Restricted Business Area RLS guard has an unexpected mode, role, command, or expression.",
);
assert(
  integrityConstraints.length === 4 &&
    integrityConstraints.every((constraint) => constraint.convalidated === true),
  "Business Area identity/status integrity constraints are missing or unvalidated.",
);
assert(
  helperSecurity?.security_definer === true &&
    helperSecurity?.owner === "postgres" &&
    helperSecurity?.proconfig?.includes("search_path=public, pg_temp") &&
    helperSecurity?.execute_grantees ===
      "{authenticated,postgres,service_role}" &&
    helperSecurity?.anon_execute === false &&
    helperSecurity?.authenticated_execute === true &&
    helperSecurity?.service_role_execute === true,
  `Business Area membership helper ownership/grants/search_path contract is invalid: ${JSON.stringify(helperSecurity)}`,
);
assert(
  excessiveAppGrants.length === 0,
  "Business Area tables expose TRUNCATE, REFERENCES, or TRIGGER to anon/authenticated.",
);
assert(
  ragExposure.length === 0,
  "AI Database knowledge tables expose direct privileges to anon/authenticated.",
);
assert(
  ragEffectiveExposure.length === 0,
  "AI Database knowledge tables expose effective privileges to anon/authenticated.",
);
assert(
  ragFunctionSecurity?.signature ===
    "search_document_chunks(halfvec,text[],bigint,integer,double precision,text,text,boolean,text,text)" &&
    ragFunctionSecurity?.execute_grantees === "{postgres,service_role}" &&
  ragFunctionSecurity?.anon_execute === false &&
    ragFunctionSecurity?.authenticated_execute === false &&
    ragFunctionSecurity?.service_role_execute === true,
  "AI Database search_document_chunks execution grants are not service-role-only.",
);
assert(
  Object.values(financeVisibility).every((persona) => persona.principalId) &&
    financeVisibility.regularNonAdmin.visibleFinanceDocuments === 0 &&
    financeVisibility.leadershipNonAdmin.visibleFinanceDocuments === 0 &&
    financeVisibility.project60MemberNonAdmin.visibleFinanceDocuments === 0 &&
    financeVisibility.appAdmin.visibleFinanceDocuments ===
      documentCounts.finance_count,
  `Finance visibility matrix does not enforce deny-by-default RLS: ${JSON.stringify(financeVisibility)}`,
);
assert(containers.length === expectedAreas.size, "One or more container projects are missing.");
assert(
  containers.every((project) => project.archived === false),
  "A container project was archived before the cutover gate.",
);
assert(
  appLedger.length === 3 && ragLedger.length === 3,
  "One or more Business Area hardening migrations are absent from a remote ledger.",
);

console.log(
  JSON.stringify(
    {
      status: "PASS",
      checkedAt: new Date().toISOString(),
      appProjectRef,
      ragProjectRef,
      businessAreas: areas,
      mappings,
      appParity,
      crossDatabaseParity,
      documentCounts,
      membershipCounts,
      financeBehavior:
        membershipCounts.active_finance === 0
          ? "deny-by-default: app admins only until Finance membership is approved"
          : "deny-by-default: app admins and active Finance members",
      financeVisibility,
      restrictivePolicy: {
        name: restrictivePolicy.policyname,
        mode: restrictivePolicy.permissive,
        roles: restrictivePolicy.roles,
        command: restrictivePolicy.cmd,
      },
      integrityConstraints,
      helperSecurity,
      excessiveAppGrants,
      containers,
      appLedger: appLedger.map((row) => row.version),
      ragParity,
      ragScopeIntegrity,
      ragChunkIntegrity,
      ragExposure,
      ragEffectiveExposure,
      ragFunctionSecurity,
      ragLedger: ragLedger.map((row) => row.version),
    },
    null,
    2,
  ),
);
