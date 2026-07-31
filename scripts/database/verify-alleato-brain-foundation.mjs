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
    throw new Error(
      `Supabase readback failed for project ${projectRef} (HTTP ${response.status}). Check the provider query logs for details.`,
    );
  }
  return response.json();
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
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
      count(document.id)::int as legacy_count,
      count(document.id) filter (
        where document.business_area_id = mapping.business_area_id
      )::int as exact_branch_count,
      count(document.id) filter (
        where document.business_area_id is distinct from mapping.business_area_id
      )::int as mismatched_count
    from public.business_area_project_map as mapping
    join public.business_areas as area on area.id = mapping.business_area_id
    left join public.document_metadata as document
      on document.project_id = mapping.project_id
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
    where namespace.nspname = 'public'
      and procedure.proname = 'current_is_business_area_member'
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
    where version in ('20260723180000', '20260724043000')
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
      )::int as exact_document_count,
      count(distinct document.id) filter (
        where document.source_metadata->>'business_area_id'
          is distinct from mapping.business_area_id::text
      )::int as mismatched_document_count,
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
    left join public.document_chunks as chunk
      on chunk.document_id = document.id
    group by mapping.project_id, mapping.business_area_id, mapping.key
    order by mapping.project_id
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
const [ragFunctionSecurity] = await runQuery(
  ragProjectRef,
  `
    select
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
    where namespace.nspname = 'public'
      and procedure.proname = 'search_document_chunks'
  `,
);
const ragLedger = await runQuery(
  ragProjectRef,
  `
    select version
    from supabase_migrations.schema_migrations
    where version in ('20260724044500', '20260724045000')
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
      select count(*)::int as visible_finance_documents
      from public.document_metadata as document
      join public.business_areas as area
        on area.id = document.business_area_id
      where area.key = 'finance';
      commit;
    `,
  );
  return rows[0]?.visible_finance_documents;
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
  project60MemberNonAdmin: await visibleFinanceCount(`
    select profile.id::text
    from public.project_directory_memberships as membership
    join public.users_auth as auth_link
      on auth_link.person_id = membership.person_id
    join public.user_profiles as profile
      on profile.id = auth_link.auth_user_id
    where membership.project_id = 60
      and membership.status = 'active'
      and coalesce(profile.is_admin, false) = false
    limit 1
  `),
  appAdmin: await visibleFinanceCount(`
    select profile.id::text
    from public.user_profiles as profile
    where profile.is_admin = true
    limit 1
  `),
};

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
  appParity.every(
    (row) =>
      row.mismatched_count === 0 &&
      row.legacy_count === row.exact_branch_count,
  ),
  "PM APP contains a legacy-container document without its exact Business Area label.",
);
assert(
  documentCounts.branch_count === documentCounts.dual_scope_count,
  "PM APP contains a Business Area document outside the measured dual-label state.",
);
assert(
  documentCounts.finance_count === documentCounts.restricted_finance_count,
  "One or more Finance documents are not access_level='restricted'.",
);
assert(
  ragParity.every(
    (row) =>
      row.mismatched_document_count === 0 &&
      row.document_count === row.exact_document_count &&
      row.mismatched_chunk_count === 0 &&
      row.chunk_count === row.exact_chunk_count,
  ),
  "AI Database contains a mapped document or chunk without its exact Business Area label.",
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
    helperSecurity?.proconfig?.some((entry) =>
      entry.startsWith("search_path="),
    ) &&
    helperSecurity?.anon_execute === false &&
    helperSecurity?.authenticated_execute === true &&
    helperSecurity?.service_role_execute === true,
  "Business Area membership helper ownership/grants/search_path contract is invalid.",
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
  ragFunctionSecurity?.anon_execute === false &&
    ragFunctionSecurity?.authenticated_execute === false &&
    ragFunctionSecurity?.service_role_execute === true,
  "AI Database search_document_chunks execution grants are not service-role-only.",
);
assert(
  financeVisibility.regularNonAdmin === 0 &&
    financeVisibility.leadershipNonAdmin === 0 &&
    financeVisibility.project60MemberNonAdmin === 0 &&
    financeVisibility.appAdmin === documentCounts.finance_count,
  "Finance visibility matrix does not enforce deny-by-default RLS.",
);
assert(containers.length === expectedAreas.size, "One or more container projects are missing.");
assert(
  containers.every((project) => project.archived === false),
  "A container project was archived before the cutover gate.",
);
assert(
  appLedger.length === 2 && ragLedger.length === 2,
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
      ragExposure,
      ragFunctionSecurity,
      ragLedger: ragLedger.map((row) => row.version),
    },
    null,
    2,
  ),
);
