#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "../..");
const requiredOperationalTables = [
  "files",
  "meetings",
  "project_attribution_rules",
  "tasks",
];
const requiredPolicies = new Map([
  ["files", [
    "files_authenticated_read",
    "files_business_area_select",
    "files_restricted_business_area_guard",
  ]],
  ["meetings", [
    "meetings_member",
    "meetings_business_area_select",
    "meetings_business_area_write",
    "meetings_restricted_business_area_guard",
  ]],
  ["project_attribution_rules", ["project_attribution_rules_admin_all"]],
  ["tasks", [
    "tasks_scope_select",
    "tasks_scope_write",
    "tasks_restricted_business_area_guard",
  ]],
  ["business_area_migration_runs", ["business_area_migration_runs_admin_all"]],
  ["business_area_migration_items", ["business_area_migration_items_admin_all"]],
]);
const policyContracts = [
  ["files", "files_authenticated_read", "SELECT", true, ["authenticated"], false],
  ["files", "files_business_area_select", "SELECT", true, ["authenticated"], false],
  ["files", "files_restricted_business_area_guard", "ALL", false, ["authenticated"], true],
  ["meetings", "meetings_business_area_select", "SELECT", true, ["authenticated"], false],
  ["meetings", "meetings_member", "ALL", true, ["authenticated"], true],
  ["meetings", "meetings_business_area_write", "ALL", true, ["authenticated"], true],
  ["meetings", "meetings_restricted_business_area_guard", "ALL", false, ["authenticated"], true],
  ["tasks", "tasks_scope_select", "SELECT", true, ["authenticated"], false],
  ["tasks", "tasks_scope_write", "ALL", true, ["authenticated"], true],
  ["tasks", "tasks_restricted_business_area_guard", "ALL", false, ["authenticated"], true],
  ["project_attribution_rules", "project_attribution_rules_admin_all", "ALL", true, ["authenticated"], true],
  ["business_area_migration_runs", "business_area_migration_runs_admin_all", "ALL", true, ["authenticated"], true],
  ["business_area_migration_items", "business_area_migration_items_admin_all", "ALL", true, ["authenticated"], true],
];
const requiredIndexes = [
  ["idx_meetings_business_area_id", "meetings", false, ["business_area_id"], "(business_area_id IS NOT NULL)"],
  ["idx_tasks_business_area_id", "tasks", false, ["business_area_id"], "(business_area_id IS NOT NULL)"],
  ["idx_files_business_area_id", "files", false, ["business_area_id"], "(business_area_id IS NOT NULL)"],
  [
    "idx_project_attribution_rules_business_area_id",
    "project_attribution_rules",
    false,
    ["business_area_id"],
    "(business_area_id IS NOT NULL)",
  ],
  [
    "uq_project_attribution_rules_business_area_target",
    "project_attribution_rules",
    true,
    ["business_area_id", "rule_type", "pattern_normalized"],
    "(business_area_id IS NOT NULL)",
  ],
  ["idx_business_area_migration_items_record", "business_area_migration_items", false, ["record_type", "record_id"], null],
  ["idx_business_area_migration_items_target", "business_area_migration_items", false, ["new_business_area_id", "record_type"], null],
];
const requiredLedgerConstraintContracts = [
  ["business_area_migration_runs_pkey", "business_area_migration_runs", "p", "PRIMARY KEY (id)"],
  ["business_area_migration_runs_run_key_key", "business_area_migration_runs", "u", "UNIQUE (run_key)"],
  ["business_area_migration_runs_initiated_by_fkey", "business_area_migration_runs", "f", "FOREIGN KEY (initiated_by) REFERENCES people(id) ON DELETE SET NULL"],
  ["business_area_migration_runs_phase_nonempty", "business_area_migration_runs", "c", "CHECK ((length(btrim(phase)) > 0))"],
  ["business_area_migration_runs_status_check", "business_area_migration_runs", "c", "CHECK ((status = ANY (ARRAY['running'::text, 'completed'::text, 'failed'::text, 'rolled_back'::text])))"],
  ["business_area_migration_runs_rollback_status_check", "business_area_migration_runs", "c", "CHECK ((rollback_status = ANY (ARRAY['available'::text, 'in_progress'::text, 'completed'::text, 'failed'::text, 'not_required'::text])))"],
  ["business_area_migration_items_pkey", "business_area_migration_items", "p", "PRIMARY KEY (run_id, source_database, record_type, record_id)"],
  ["business_area_migration_items_run_id_fkey", "business_area_migration_items", "f", "FOREIGN KEY (run_id) REFERENCES business_area_migration_runs(id) ON DELETE RESTRICT"],
  ["business_area_migration_items_old_business_area_id_fkey", "business_area_migration_items", "f", "FOREIGN KEY (old_business_area_id) REFERENCES business_areas(id) ON DELETE RESTRICT"],
  ["business_area_migration_items_new_business_area_id_fkey", "business_area_migration_items", "f", "FOREIGN KEY (new_business_area_id) REFERENCES business_areas(id) ON DELETE RESTRICT"],
  ["business_area_migration_items_source_database_check", "business_area_migration_items", "c", "CHECK ((source_database = ANY (ARRAY['pm_app'::text, 'ai_database'::text])))"],
  ["business_area_migration_items_record_type_check", "business_area_migration_items", "c", "CHECK ((record_type = ANY (ARRAY['document'::text, 'rag_document'::text, 'rag_chunk'::text, 'meeting'::text, 'task'::text, 'file'::text, 'attribution_rule'::text])))"],
  ["business_area_migration_items_result_check", "business_area_migration_items", "c", "CHECK ((result = ANY (ARRAY['pending'::text, 'applied'::text, 'skipped'::text, 'failed'::text, 'rolled_back'::text])))"],
  ["business_area_migration_items_rollback_state_check", "business_area_migration_items", "c", "CHECK ((rollback_state = ANY (ARRAY['available'::text, 'in_progress'::text, 'completed'::text, 'failed'::text, 'not_required'::text])))"],
  ["business_area_migration_items_source_record_check", "business_area_migration_items", "c", "CHECK ((((source_database = 'pm_app'::text) AND (record_type = ANY (ARRAY['document'::text, 'meeting'::text, 'task'::text, 'file'::text, 'attribution_rule'::text]))) OR ((source_database = 'ai_database'::text) AND (record_type = ANY (ARRAY['rag_document'::text, 'rag_chunk'::text])))))"],
];
const requiredLedgerColumns = [
  ["business_area_migration_runs", "id", "uuid", false],
  ["business_area_migration_runs", "run_key", "text", false],
  ["business_area_migration_runs", "phase", "text", false],
  ["business_area_migration_runs", "status", "text", false],
  ["business_area_migration_runs", "source_snapshot", "jsonb", false],
  ["business_area_migration_runs", "result_summary", "jsonb", false],
  ["business_area_migration_runs", "rollback_status", "text", false],
  ["business_area_migration_runs", "initiated_by", "uuid", true],
  ["business_area_migration_runs", "started_at", "timestamptz", false],
  ["business_area_migration_runs", "completed_at", "timestamptz", true],
  ["business_area_migration_runs", "created_at", "timestamptz", false],
  ["business_area_migration_runs", "updated_at", "timestamptz", false],
  ["business_area_migration_items", "run_id", "uuid", false],
  ["business_area_migration_items", "source_database", "text", false],
  ["business_area_migration_items", "record_type", "text", false],
  ["business_area_migration_items", "record_id", "text", false],
  ["business_area_migration_items", "old_project_id", "bigint", true],
  ["business_area_migration_items", "old_business_area_id", "bigint", true],
  ["business_area_migration_items", "new_business_area_id", "bigint", false],
  ["business_area_migration_items", "record_snapshot", "jsonb", false],
  ["business_area_migration_items", "result", "text", false],
  ["business_area_migration_items", "rollback_state", "text", false],
  ["business_area_migration_items", "error_detail", "text", true],
  ["business_area_migration_items", "applied_at", "timestamptz", true],
  ["business_area_migration_items", "rolled_back_at", "timestamptz", true],
  ["business_area_migration_items", "created_at", "timestamptz", false],
  ["business_area_migration_items", "updated_at", "timestamptz", false],
];

function loadEnv(filePath) {
  if (!fs.existsSync(filePath)) return;
  for (const line of fs.readFileSync(filePath, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) continue;
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

function projectRefFromEnv() {
  for (const candidate of [
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_URL,
  ]) {
    if (!candidate) continue;
    try {
      const match = new URL(candidate).hostname.match(/^([^.]+)\.supabase\.co$/);
      if (match?.[1]) return match[1];
    } catch {
      // The explicit error below owns malformed or absent configuration.
    }
  }
  throw new Error(
    "ALLEATO_BRAIN_OPERATIONAL_CONFIG_MISSING: NEXT_PUBLIC_SUPABASE_URL or SUPABASE_URL is required",
  );
}

async function providerQuery(query, { readOnly = true } = {}) {
  const accessToken = process.env.SUPABASE_ACCESS_TOKEN;
  if (!accessToken) {
    throw new Error(
      "ALLEATO_BRAIN_OPERATIONAL_CONFIG_MISSING: SUPABASE_ACCESS_TOKEN is required",
    );
  }
  const projectRef = projectRefFromEnv();
  const response = await fetch(
    `https://api.supabase.com/v1/projects/${projectRef}/database/query`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ query, read_only: readOnly }),
    },
  );
  const body = await response.text();
  if (!response.ok) {
    throw new Error(
      `ALLEATO_BRAIN_OPERATIONAL_QUERY_FAILED: project=${projectRef} http=${response.status} detail=${body || "empty provider response"}`,
    );
  }
  return body ? JSON.parse(body) : [];
}

function assertOperationalContract(audit) {
  const failures = [];
  const tableByName = new Map(audit.tables.map((row) => [row.table_name, row]));
  for (const tableName of [
    ...requiredOperationalTables,
    "business_area_migration_runs",
    "business_area_migration_items",
  ]) {
    const table = tableByName.get(tableName);
    if (!table) failures.push(`missing table public.${tableName}`);
    else if (!table.rls_enabled) failures.push(`RLS disabled on public.${tableName}`);
  }

  const columnByKey = new Map(
    audit.columns.map((row) => [`${row.table_name}.${row.column_name}`, row]),
  );
  for (const tableName of requiredOperationalTables) {
    const column = columnByKey.get(`${tableName}.business_area_id`);
    if (!column) failures.push(`missing ${tableName}.business_area_id`);
    else if (column.data_type !== "bigint") {
      failures.push(
        `${tableName}.business_area_id type=${column.data_type}, expected bigint`,
      );
    }
  }
  for (const tableName of ["meetings", "project_attribution_rules"]) {
    const column = columnByKey.get(`${tableName}.project_id`);
    if (!column) failures.push(`missing ${tableName}.project_id`);
    else if (!column.is_nullable) {
      failures.push(`${tableName}.project_id is still NOT NULL`);
    }
  }
  for (const [tableName, columnName, dataType, isNullable] of requiredLedgerColumns) {
    const column = columnByKey.get(`${tableName}.${columnName}`);
    if (!column) {
      failures.push(`missing ${tableName}.${columnName}`);
    } else if (
      column.data_type !== dataType ||
      column.is_nullable !== isNullable
    ) {
      failures.push(
        `${tableName}.${columnName} must have type=${dataType} nullable=${isNullable}`,
      );
    }
  }

  const constraintByName = new Map(
    audit.constraints.map((row) => [row.constraint_name, row]),
  );
  for (const tableName of requiredOperationalTables) {
    const name = `${tableName}_business_area_id_fkey`;
    const constraint = constraintByName.get(name);
    if (!constraint) failures.push(`missing constraint ${name}`);
    else {
      if (!constraint.is_validated) {
        failures.push(`constraint ${name} is not validated`);
      }
      if (constraint.table_name !== tableName) {
        failures.push(
          `constraint ${name} belongs to ${constraint.table_name}, expected ${tableName}`,
        );
      }
      if (
        !constraint.definition.includes(
          "FOREIGN KEY (business_area_id) REFERENCES business_areas(id) ON DELETE RESTRICT",
        )
      ) {
        failures.push(`constraint ${name} has an unexpected definition`);
      }
    }
  }
  const typedTarget = constraintByName.get(
    "project_attribution_rules_active_typed_target",
  );
  if (!typedTarget) {
    failures.push("missing active-rule typed-target constraint");
  } else if (!typedTarget.is_validated) {
    failures.push("active-rule typed-target constraint is not validated");
  } else if (
    typedTarget.table_name !== "project_attribution_rules" ||
    !typedTarget.definition.includes(
      "num_nonnulls(project_id, business_area_id) = 1",
    )
  ) {
    failures.push("active-rule typed-target constraint has an unexpected definition");
  }

  for (const [
    constraintName,
    tableName,
    constraintType,
    definitionFragment,
  ] of requiredLedgerConstraintContracts) {
    const constraint = constraintByName.get(constraintName);
    if (!constraint) {
      failures.push(`missing ledger constraint ${constraintName}`);
    } else if (
      !constraint.is_validated ||
      constraint.table_name !== tableName ||
      constraint.constraint_type !== constraintType ||
      constraint.definition !== definitionFragment
    ) {
      failures.push(`ledger constraint ${constraintName} has an unexpected definition`);
    }
  }

  const indexByName = new Map(
    audit.indexes.map((row) => [row.index_name, row]),
  );
  for (const [
    indexName,
    tableName,
    isUnique,
    columns,
    predicate,
  ] of requiredIndexes) {
    const index = indexByName.get(indexName);
    if (!index) {
      failures.push(`missing index ${indexName}`);
      continue;
    }
    if (
      index.table_name !== tableName ||
      index.is_unique !== isUnique ||
      index.is_valid !== true ||
      index.predicate !== predicate ||
      JSON.stringify(index.columns) !== JSON.stringify(columns)
    ) {
      failures.push(`index ${indexName} has an unexpected definition`);
    }
  }

  const policiesByTable = new Map();
  for (const policy of audit.policies) {
    if (!policiesByTable.has(policy.table_name)) {
      policiesByTable.set(policy.table_name, new Set());
    }
    policiesByTable.get(policy.table_name).add(policy.policy_name);
  }
  for (const [tableName, policyNames] of requiredPolicies) {
    for (const policyName of policyNames) {
      if (!policiesByTable.get(tableName)?.has(policyName)) {
        failures.push(`missing policy ${tableName}.${policyName}`);
      }
    }
  }

  for (const [
    tableName,
    policyName,
    command,
    isPermissive,
    roles,
    requiresWithCheck,
  ] of policyContracts) {
    const policy = audit.policies.find(
      (row) => row.table_name === tableName && row.policy_name === policyName,
    );
    if (!policy) continue;
    if (
      policy.command !== command ||
      policy.is_permissive !== isPermissive ||
      JSON.stringify([...policy.roles].sort()) !== JSON.stringify([...roles].sort())
    ) {
      failures.push(`${tableName}.${policyName} has an unexpected command/role/mode`);
    }
    if (requiresWithCheck && !policy.with_check_expression) {
      failures.push(`${tableName}.${policyName} is missing WITH CHECK`);
    }
  }

  for (const tableName of ["files", "meetings", "tasks"]) {
    const guard = audit.policies.find(
      (row) =>
        row.table_name === tableName &&
        row.policy_name === `${tableName}_restricted_business_area_guard`,
    );
    if (!guard) continue;
    if (guard.is_permissive) {
      failures.push(`${tableName} Finance guard is permissive, expected restrictive`);
    }
    if (!guard.using_expression.includes("current_is_business_area_member")) {
      failures.push(`${tableName} Finance guard omits membership authorization`);
    }
  }

  const unexpectedOperationalPublicRead = audit.policies.filter(
    (policy) =>
      ["files", "meetings", "tasks"].includes(policy.table_name) &&
      policy.is_permissive &&
      ["ALL", "SELECT"].includes(policy.command) &&
      policy.roles.some((role) => ["anon", "public"].includes(role)),
  );
  if (unexpectedOperationalPublicRead.length > 0) {
    failures.push(
      `operational tables retain public/anon permissive read policies=${unexpectedOperationalPublicRead
        .map((policy) => `${policy.table_name}.${policy.policy_name}`)
        .join(",")}`,
    );
  }
  for (const tableName of ["files", "meetings", "tasks"]) {
    if (audit.acl[`${tableName}_anon_select`]) {
      failures.push(`anon retains SELECT privilege on public.${tableName}`);
    }
    if (!audit.acl[`${tableName}_authenticated_select`]) {
      failures.push(`authenticated lacks SELECT privilege on public.${tableName}`);
    }
  }
  for (const tableName of [
    "business_area_migration_runs",
    "business_area_migration_items",
  ]) {
    if (audit.acl[`${tableName}_anon_select`]) {
      failures.push(`anon retains SELECT privilege on public.${tableName}`);
    }
    if (!audit.acl[`${tableName}_authenticated_select`]) {
      failures.push(`authenticated lacks SELECT privilege on public.${tableName}`);
    }
  }

  if (audit.invalid_active_rule_targets !== 0) {
    failures.push(
      `active attribution rules with invalid typed targets=${audit.invalid_active_rule_targets}`,
    );
  }
  if (audit.orphan_business_area_scopes !== 0) {
    failures.push(
      `operational rows with orphan Business Area scope=${audit.orphan_business_area_scopes}`,
    );
  }
  if (audit.mismatched_mapped_scopes !== 0) {
    failures.push(
      `dual-labeled operational rows with wrong mapped scope=${audit.mismatched_mapped_scopes}`,
    );
  }

  if (failures.length > 0) {
    throw new Error(
      `ALLEATO_BRAIN_OPERATIONAL_CONTRACT_FAILED:\n- ${failures.join("\n- ")}`,
    );
  }
  return true;
}

const validFixture = {
  tables: [
    ...requiredOperationalTables,
    "business_area_migration_runs",
    "business_area_migration_items",
  ].map((table_name) => ({ table_name, rls_enabled: true })),
  columns: [
    ...requiredOperationalTables.map((table_name) => ({
      table_name,
      column_name: "business_area_id",
      data_type: "bigint",
      is_nullable: true,
    })),
    {
      table_name: "meetings",
      column_name: "project_id",
      data_type: "integer",
      is_nullable: true,
    },
    {
      table_name: "project_attribution_rules",
      column_name: "project_id",
      data_type: "integer",
      is_nullable: true,
    },
    ...requiredLedgerColumns.map(
      ([table_name, column_name, data_type, is_nullable]) => ({
        table_name,
        column_name,
        data_type,
        is_nullable,
      }),
    ),
  ],
  constraints: [
    ...requiredOperationalTables.map((tableName) => ({
      constraint_name: `${tableName}_business_area_id_fkey`,
      table_name: tableName,
      is_validated: true,
      definition:
        "FOREIGN KEY (business_area_id) REFERENCES business_areas(id) ON DELETE RESTRICT",
    })),
    {
      constraint_name: "project_attribution_rules_active_typed_target",
      table_name: "project_attribution_rules",
      is_validated: true,
      definition:
        "CHECK (((status <> 'active'::text) OR (num_nonnulls(project_id, business_area_id) = 1)))",
    },
    ...requiredLedgerConstraintContracts.map(
      ([constraint_name, table_name, constraint_type, definition]) => ({
      constraint_name,
      table_name,
      constraint_type,
      is_validated: true,
      definition,
    }),
    ),
  ],
  indexes: requiredIndexes.map(
    ([index_name, table_name, is_unique, columns, predicate]) => ({
      index_name,
      table_name,
      is_unique,
      is_valid: true,
      predicate,
      columns,
    }),
  ),
  policies: policyContracts.map(
    ([table_name, policy_name, command, is_permissive, roles, requiresWithCheck]) => ({
      table_name,
      policy_name,
      command,
      is_permissive,
      roles,
      using_expression: policy_name.endsWith("_guard")
        ? "current_is_business_area_member(business_area_id)"
        : "true",
      with_check_expression: requiresWithCheck ? "true" : "",
    }),
  ),
  acl: {
    files_anon_select: false,
    files_authenticated_select: true,
    meetings_anon_select: false,
    meetings_authenticated_select: true,
    tasks_anon_select: false,
    tasks_authenticated_select: true,
    business_area_migration_runs_anon_select: false,
    business_area_migration_runs_authenticated_select: true,
    business_area_migration_items_anon_select: false,
    business_area_migration_items_authenticated_select: true,
  },
  invalid_active_rule_targets: 0,
  orphan_business_area_scopes: 0,
  mismatched_mapped_scopes: 0,
};

if (process.argv.includes("--self-test")) {
  assertOperationalContract(validFixture);
  for (const mutate of [
    (fixture) => {
      fixture.columns = fixture.columns.filter(
        (row) => row.table_name !== "tasks" || row.column_name !== "business_area_id",
      );
    },
    (fixture) => {
      fixture.constraints.find(
        (row) => row.constraint_name === "project_attribution_rules_active_typed_target",
      ).is_validated = false;
    },
    (fixture) => {
      fixture.policies.find(
        (row) => row.policy_name === "files_restricted_business_area_guard",
      ).is_permissive = true;
    },
    (fixture) => {
      fixture.policies.find(
        (row) => row.policy_name === "files_authenticated_read",
      ).roles = ["public"];
    },
    (fixture) => {
      fixture.policies.find(
        (row) => row.policy_name === "tasks_scope_write",
      ).with_check_expression = "";
    },
    (fixture) => {
      fixture.indexes.find(
        (row) => row.index_name === "idx_tasks_business_area_id",
      ).predicate = null;
    },
    (fixture) => {
      fixture.acl.files_anon_select = true;
    },
    (fixture) => {
      fixture.invalid_active_rule_targets = 1;
    },
  ]) {
    const invalidFixture = structuredClone(validFixture);
    mutate(invalidFixture);
    let rejected = false;
    try {
      assertOperationalContract(invalidFixture);
    } catch {
      rejected = true;
    }
    if (!rejected) {
      throw new Error(
        "ALLEATO_BRAIN_OPERATIONAL_SELF_TEST_FAILED: invalid fixture passed",
      );
    }
  }
  console.log("Alleato Brain operational scope self-test passed.");
  process.exit(0);
}

if (process.env.ALLEATO_ENV_FILE) {
  loadEnv(path.resolve(process.env.ALLEATO_ENV_FILE));
}
loadEnv(path.join(repoRoot, ".env"));

if (process.argv.includes("--negative-path")) {
  await providerQuery(
    String.raw`
BEGIN;
DO $$
DECLARE
  test_project_id integer;
  test_business_area_id bigint;
  allowed_rule_id uuid := gen_random_uuid();
  violated_constraint text;
BEGIN
  SELECT project_id, business_area_id
  INTO test_project_id, test_business_area_id
  FROM public.business_area_project_map
  ORDER BY project_id
  LIMIT 1;

  BEGIN
    INSERT INTO public.project_attribution_rules (
      id, project_id, business_area_id, rule_type, pattern,
      pattern_normalized, source, status
    ) VALUES (
      gen_random_uuid(), test_project_id, test_business_area_id, 'phrase',
      'phase1b-invalid-both-' || gen_random_uuid()::text,
      'phase1b-invalid-both-' || gen_random_uuid()::text,
      'phase1b-negative-test', 'active'
    );
    RAISE EXCEPTION 'ACTIVE_RULE_BOTH_TARGETS_WAS_ACCEPTED';
  EXCEPTION
    WHEN check_violation THEN
      GET STACKED DIAGNOSTICS violated_constraint = CONSTRAINT_NAME;
      IF violated_constraint <> 'project_attribution_rules_active_typed_target' THEN
        RAISE EXCEPTION
          'UNEXPECTED_BOTH_TARGET_CONSTRAINT: %',
          violated_constraint;
      END IF;
  END;

  BEGIN
    INSERT INTO public.project_attribution_rules (
      id, project_id, business_area_id, rule_type, pattern,
      pattern_normalized, source, status
    ) VALUES (
      gen_random_uuid(), NULL, NULL, 'phrase',
      'phase1b-invalid-neither-' || gen_random_uuid()::text,
      'phase1b-invalid-neither-' || gen_random_uuid()::text,
      'phase1b-negative-test', 'active'
    );
    RAISE EXCEPTION 'ACTIVE_RULE_WITHOUT_TARGET_WAS_ACCEPTED';
  EXCEPTION
    WHEN check_violation THEN
      GET STACKED DIAGNOSTICS violated_constraint = CONSTRAINT_NAME;
      IF violated_constraint <> 'project_attribution_rules_active_typed_target' THEN
        RAISE EXCEPTION
          'UNEXPECTED_NEITHER_TARGET_CONSTRAINT: %',
          violated_constraint;
      END IF;
  END;

  INSERT INTO public.project_attribution_rules (
    id, project_id, business_area_id, rule_type, pattern,
    pattern_normalized, source, status
  ) VALUES (
    allowed_rule_id, NULL, test_business_area_id, 'phrase',
    'phase1b-valid-branch-' || allowed_rule_id::text,
    'phase1b-valid-branch-' || allowed_rule_id::text,
    'phase1b-negative-test', 'active'
  );

  IF NOT EXISTS (
    SELECT 1
    FROM public.project_attribution_rules
    WHERE id = allowed_rule_id
      AND project_id IS NULL
      AND business_area_id = test_business_area_id
  ) THEN
    RAISE EXCEPTION 'ACTIVE_BRANCH_RULE_WAS_NOT_PERSISTED_IN_TEST_TRANSACTION';
  END IF;
END
$$;

SELECT set_config(
  'phase1b.finance_area_id',
  (SELECT id::text FROM public.business_areas WHERE key = 'finance'),
  true
);
SELECT set_config(
  'phase1b.open_area_id',
  (SELECT id::text FROM public.business_areas WHERE is_restricted = false ORDER BY id LIMIT 1),
  true
);
SELECT set_config(
  'phase1b.finance_file_id',
  'phase1b-rls-finance-' || txid_current()::text,
  true
);
SELECT set_config(
  'phase1b.open_file_id',
  'phase1b-rls-open-' || txid_current()::text,
  true
);
SELECT set_config(
  'phase1b.ledger_run_key',
  'phase1b-rls-ledger-' || txid_current()::text,
  true
);
SELECT set_config('phase1b.series_id', gen_random_uuid()::text, true);
SELECT set_config('phase1b.finance_meeting_id', gen_random_uuid()::text, true);
SELECT set_config('phase1b.open_meeting_id', gen_random_uuid()::text, true);
SELECT set_config('phase1b.finance_task_id', gen_random_uuid()::text, true);
SELECT set_config('phase1b.open_task_id', gen_random_uuid()::text, true);

INSERT INTO public.files (id, content, business_area_id)
VALUES
  (
    current_setting('phase1b.finance_file_id'),
    'rolled-back Finance authorization fixture',
    current_setting('phase1b.finance_area_id')::bigint
  ),
  (
    current_setting('phase1b.open_file_id'),
    'rolled-back unrestricted authorization fixture',
    current_setting('phase1b.open_area_id')::bigint
  );

INSERT INTO public.business_area_migration_runs (run_key, phase)
VALUES (current_setting('phase1b.ledger_run_key'), 'phase1b-negative-path');

INSERT INTO public.meeting_series (id, project_id, name)
VALUES (
  current_setting('phase1b.series_id')::uuid,
  (SELECT min(project_id)::integer FROM public.business_area_project_map),
  'phase1b-rls-series-' || txid_current()::text
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
    current_setting('phase1b.finance_meeting_id')::uuid,
    NULL,
    current_setting('phase1b.finance_area_id')::bigint,
    current_setting('phase1b.series_id')::uuid,
    1,
    'rolled-back Finance meeting fixture'
  ),
  (
    current_setting('phase1b.open_meeting_id')::uuid,
    NULL,
    current_setting('phase1b.open_area_id')::bigint,
    current_setting('phase1b.series_id')::uuid,
    2,
    'rolled-back unrestricted meeting fixture'
  );

INSERT INTO public.tasks (
  id,
  title,
  description,
  source_system,
  business_area_id
)
VALUES
  (
    current_setting('phase1b.finance_task_id')::uuid,
    'Verify Finance scope denial',
    'rolled-back Finance task fixture',
    'phase1b-negative-test',
    current_setting('phase1b.finance_area_id')::bigint
  ),
  (
    current_setting('phase1b.open_task_id')::uuid,
    'Verify open scope access',
    'rolled-back unrestricted task fixture',
    'phase1b-negative-test',
    current_setting('phase1b.open_area_id')::bigint
  );

SET LOCAL ROLE authenticated;
SELECT set_config(
  'request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-000000000001","role":"authenticated"}',
  true
);
SELECT set_config(
  'request.jwt.claim.sub',
  '00000000-0000-0000-0000-000000000001',
  true
);
DO $$
DECLARE
  visible_finance integer;
  visible_open integer;
  visible_ledger integer;
  visible_finance_meeting integer;
  visible_open_meeting integer;
  visible_finance_task integer;
  visible_open_task integer;
BEGIN
  SELECT count(*)::integer
  INTO visible_finance
  FROM public.files
  WHERE id = current_setting('phase1b.finance_file_id');

  SELECT count(*)::integer
  INTO visible_open
  FROM public.files
  WHERE id = current_setting('phase1b.open_file_id');

  SELECT count(*)::integer
  INTO visible_ledger
  FROM public.business_area_migration_runs
  WHERE run_key = current_setting('phase1b.ledger_run_key');

  SELECT count(*)::integer
  INTO visible_finance_meeting
  FROM public.meetings
  WHERE id = current_setting('phase1b.finance_meeting_id')::uuid;

  SELECT count(*)::integer
  INTO visible_open_meeting
  FROM public.meetings
  WHERE id = current_setting('phase1b.open_meeting_id')::uuid;

  SELECT count(*)::integer
  INTO visible_finance_task
  FROM public.tasks
  WHERE id = current_setting('phase1b.finance_task_id')::uuid;

  SELECT count(*)::integer
  INTO visible_open_task
  FROM public.tasks
  WHERE id = current_setting('phase1b.open_task_id')::uuid;

  IF visible_finance <> 0 THEN
    RAISE EXCEPTION 'FINANCE_FILE_VISIBLE_TO_SYNTHETIC_NONMEMBER';
  END IF;
  IF visible_open <> 1 THEN
    RAISE EXCEPTION 'UNRESTRICTED_FILE_HIDDEN_FROM_AUTHENTICATED_USER';
  END IF;
  IF visible_ledger <> 0 THEN
    RAISE EXCEPTION 'MIGRATION_LEDGER_VISIBLE_TO_SYNTHETIC_NONADMIN';
  END IF;
  IF visible_finance_meeting <> 0 OR visible_finance_task <> 0 THEN
    RAISE EXCEPTION 'FINANCE_OPERATIONAL_RECORD_VISIBLE_TO_SYNTHETIC_NONMEMBER';
  END IF;
  IF visible_open_meeting <> 1 OR visible_open_task <> 1 THEN
    RAISE EXCEPTION 'UNRESTRICTED_OPERATIONAL_RECORD_HIDDEN_FROM_AUTHENTICATED_USER';
  END IF;
END
$$;
RESET ROLE;

SET LOCAL ROLE anon;
DO $$
BEGIN
  BEGIN
    PERFORM count(*) FROM public.files;
    RAISE EXCEPTION 'ANON_FILE_SELECT_WAS_ACCEPTED';
  EXCEPTION
    WHEN insufficient_privilege THEN NULL;
  END;
  BEGIN
    PERFORM count(*) FROM public.meetings;
    RAISE EXCEPTION 'ANON_MEETING_SELECT_WAS_ACCEPTED';
  EXCEPTION
    WHEN insufficient_privilege THEN NULL;
  END;
  BEGIN
    PERFORM count(*) FROM public.tasks;
    RAISE EXCEPTION 'ANON_TASK_SELECT_WAS_ACCEPTED';
  EXCEPTION
    WHEN insufficient_privilege THEN NULL;
  END;
END
$$;
RESET ROLE;
ROLLBACK;
`,
    { readOnly: false },
  );
  console.log(
    "Alleato Brain operational negative-path test passed: exact typed-target constraint rejected invalid rules; Finance files/meetings/tasks and ledgers denied; unrestricted authenticated reads preserved; anon operational reads rejected; transaction rolled back.",
  );
  process.exit(0);
}

const [row] = await providerQuery(String.raw`
SELECT jsonb_build_object(
  'checked_at', now(),
  'tables', (
    SELECT jsonb_agg(jsonb_build_object(
      'table_name', c.relname,
      'rls_enabled', c.relrowsecurity
    ) ORDER BY c.relname)
    FROM pg_class AS c
    JOIN pg_namespace AS n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relname IN (
        'files',
        'meetings',
        'project_attribution_rules',
        'tasks',
        'business_area_migration_runs',
        'business_area_migration_items'
      )
  ),
  'columns', (
    SELECT jsonb_agg(jsonb_build_object(
      'table_name', table_name,
      'column_name', column_name,
      'data_type', CASE WHEN data_type = 'bigint' THEN data_type ELSE udt_name END,
      'is_nullable', is_nullable = 'YES'
    ) ORDER BY table_name, ordinal_position)
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND (
        (table_name IN ('files', 'meetings', 'project_attribution_rules', 'tasks')
          AND column_name = 'business_area_id')
        OR
        (table_name IN ('meetings', 'project_attribution_rules')
          AND column_name = 'project_id')
        OR
        (
          table_name = 'business_area_migration_runs'
          AND column_name IN (
            'id',
            'run_key',
            'phase',
            'status',
            'source_snapshot',
            'result_summary',
            'rollback_status',
            'initiated_by',
            'started_at',
            'completed_at',
            'created_at',
            'updated_at'
          )
        )
        OR
        (
          table_name = 'business_area_migration_items'
          AND column_name IN (
            'run_id',
            'source_database',
            'record_type',
            'record_id',
            'old_project_id',
            'old_business_area_id',
            'new_business_area_id',
            'record_snapshot',
            'result',
            'rollback_state',
            'error_detail',
            'applied_at',
            'rolled_back_at',
            'created_at',
            'updated_at'
          )
        )
      )
  ),
  'constraints', (
    SELECT jsonb_agg(jsonb_build_object(
      'constraint_name', constraint_name,
      'table_name', table_name,
      'constraint_type', constraint_type,
      'is_validated', is_validated,
      'definition', definition
    ) ORDER BY constraint_name)
    FROM (
      SELECT
        con.conname AS constraint_name,
        table_class.relname AS table_name,
        con.contype::text AS constraint_type,
        con.convalidated AS is_validated,
        pg_get_constraintdef(con.oid) AS definition
      FROM pg_constraint AS con
      JOIN pg_class AS table_class ON table_class.oid = con.conrelid
      JOIN pg_namespace AS table_namespace
        ON table_namespace.oid = table_class.relnamespace
      WHERE table_namespace.nspname = 'public'
        AND (
          con.conname IN (
            'files_business_area_id_fkey',
            'meetings_business_area_id_fkey',
            'project_attribution_rules_business_area_id_fkey',
            'tasks_business_area_id_fkey',
            'project_attribution_rules_active_typed_target'
          )
          OR table_class.relname IN (
            'business_area_migration_runs',
            'business_area_migration_items'
          )
        )
    ) AS required_constraints
  ),
  'indexes', (
    SELECT jsonb_agg(jsonb_build_object(
      'index_name', index_name,
      'table_name', table_name,
      'is_unique', is_unique,
      'is_valid', is_valid,
      'predicate', predicate,
      'columns', columns
    ) ORDER BY index_name)
    FROM (
      SELECT
        index_class.relname AS index_name,
        table_class.relname AS table_name,
        index_catalog.indisunique AS is_unique,
        index_catalog.indisvalid AS is_valid,
        pg_get_expr(index_catalog.indpred, index_catalog.indrelid) AS predicate,
        (
          SELECT jsonb_agg(attribute.attname ORDER BY key_position.ordinality)
          FROM unnest(index_catalog.indkey) WITH ORDINALITY AS key_position(attnum, ordinality)
          JOIN pg_attribute AS attribute
            ON attribute.attrelid = table_class.oid
           AND attribute.attnum = key_position.attnum
        ) AS columns
      FROM pg_index AS index_catalog
      JOIN pg_class AS index_class ON index_class.oid = index_catalog.indexrelid
      JOIN pg_class AS table_class ON table_class.oid = index_catalog.indrelid
      JOIN pg_namespace AS table_namespace ON table_namespace.oid = table_class.relnamespace
      WHERE table_namespace.nspname = 'public'
        AND index_class.relname IN (
          'idx_meetings_business_area_id',
          'idx_tasks_business_area_id',
          'idx_files_business_area_id',
          'idx_project_attribution_rules_business_area_id',
          'uq_project_attribution_rules_business_area_target',
          'idx_business_area_migration_items_record',
          'idx_business_area_migration_items_target'
        )
    ) AS required_indexes
  ),
  'policies', (
    SELECT jsonb_agg(jsonb_build_object(
      'table_name', tablename,
      'policy_name', policyname,
      'is_permissive', permissive = 'PERMISSIVE',
      'command', cmd,
      'roles', to_jsonb(roles),
      'using_expression', coalesce(qual, ''),
      'with_check_expression', coalesce(with_check, '')
    ) ORDER BY tablename, policyname)
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename IN (
        'files',
        'meetings',
        'tasks',
        'project_attribution_rules',
        'business_area_migration_runs',
        'business_area_migration_items'
      )
  ),
  'acl', jsonb_build_object(
    'files_anon_select',
      has_table_privilege('anon', 'public.files', 'SELECT'),
    'files_authenticated_select',
      has_table_privilege('authenticated', 'public.files', 'SELECT'),
    'meetings_anon_select',
      has_table_privilege('anon', 'public.meetings', 'SELECT'),
    'meetings_authenticated_select',
      has_table_privilege('authenticated', 'public.meetings', 'SELECT'),
    'tasks_anon_select',
      has_table_privilege('anon', 'public.tasks', 'SELECT'),
    'tasks_authenticated_select',
      has_table_privilege('authenticated', 'public.tasks', 'SELECT'),
    'business_area_migration_runs_anon_select',
      has_table_privilege('anon', 'public.business_area_migration_runs', 'SELECT'),
    'business_area_migration_runs_authenticated_select',
      has_table_privilege('authenticated', 'public.business_area_migration_runs', 'SELECT'),
    'business_area_migration_items_anon_select',
      has_table_privilege('anon', 'public.business_area_migration_items', 'SELECT'),
    'business_area_migration_items_authenticated_select',
      has_table_privilege('authenticated', 'public.business_area_migration_items', 'SELECT')
  ),
  'invalid_active_rule_targets', (
    SELECT count(*)::integer
    FROM public.project_attribution_rules
    WHERE status = 'active'
      AND num_nonnulls(project_id, business_area_id) <> 1
  ),
  'orphan_business_area_scopes', (
    SELECT sum(orphan_count)::integer
    FROM (
      SELECT count(*) AS orphan_count
      FROM public.meetings AS record
      LEFT JOIN public.business_areas AS area ON area.id = record.business_area_id
      WHERE record.business_area_id IS NOT NULL AND area.id IS NULL
      UNION ALL
      SELECT count(*)
      FROM public.tasks AS record
      LEFT JOIN public.business_areas AS area ON area.id = record.business_area_id
      WHERE record.business_area_id IS NOT NULL AND area.id IS NULL
      UNION ALL
      SELECT count(*)
      FROM public.files AS record
      LEFT JOIN public.business_areas AS area ON area.id = record.business_area_id
      WHERE record.business_area_id IS NOT NULL AND area.id IS NULL
      UNION ALL
      SELECT count(*)
      FROM public.project_attribution_rules AS record
      LEFT JOIN public.business_areas AS area ON area.id = record.business_area_id
      WHERE record.business_area_id IS NOT NULL AND area.id IS NULL
    ) AS orphan_counts
  ),
  'mismatched_mapped_scopes', (
    SELECT sum(mismatch_count)::integer
    FROM (
      SELECT count(*) AS mismatch_count
      FROM public.meetings AS record
      JOIN public.business_area_project_map AS mapping
        ON mapping.project_id = record.project_id
      WHERE record.business_area_id IS NOT NULL
        AND record.business_area_id <> mapping.business_area_id
      UNION ALL
      SELECT count(*)
      FROM public.tasks AS record
      JOIN public.business_area_project_map AS mapping
        ON mapping.project_id = record.project_id
      WHERE record.business_area_id IS NOT NULL
        AND record.business_area_id <> mapping.business_area_id
      UNION ALL
      SELECT count(*)
      FROM public.files AS record
      JOIN public.business_area_project_map AS mapping
        ON mapping.project_id = record.project_id
      WHERE record.business_area_id IS NOT NULL
        AND record.business_area_id <> mapping.business_area_id
      UNION ALL
      SELECT count(*)
      FROM public.project_attribution_rules AS record
      JOIN public.business_area_project_map AS mapping
        ON mapping.project_id = record.project_id
      WHERE record.business_area_id IS NOT NULL
        AND record.business_area_id <> mapping.business_area_id
    ) AS mismatch_counts
  ),
  'mapped_record_counts', (
    SELECT jsonb_agg(row_to_json(counts) ORDER BY record_type, project_id)
    FROM (
      SELECT 'meeting'::text AS record_type, project_id, count(*)::integer AS record_count
      FROM public.meetings
      WHERE project_id IN (60, 89, 90, 756, 767)
      GROUP BY project_id
      UNION ALL
      SELECT 'task', project_id, count(*)::integer
      FROM public.tasks
      WHERE project_id IN (60, 89, 90, 756, 767)
      GROUP BY project_id
      UNION ALL
      SELECT 'file', project_id, count(*)::integer
      FROM public.files
      WHERE project_id IN (60, 89, 90, 756, 767)
      GROUP BY project_id
      UNION ALL
      SELECT 'attribution_rule', project_id, count(*)::integer
      FROM public.project_attribution_rules
      WHERE project_id IN (60, 89, 90, 756, 767)
      GROUP BY project_id
    ) AS counts
  ),
  'ledger_counts', jsonb_build_object(
    'runs', (SELECT count(*)::integer FROM public.business_area_migration_runs),
    'items', (SELECT count(*)::integer FROM public.business_area_migration_items)
  )
) AS audit;
`);

assertOperationalContract(row.audit);
console.log(JSON.stringify(row.audit, null, 2));
