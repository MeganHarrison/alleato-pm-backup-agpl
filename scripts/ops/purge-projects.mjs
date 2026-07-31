#!/usr/bin/env node

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_MANIFEST = path.join(
  __dirname,
  "project-purge-targets-2026-07-23.json",
);
const PROJECT_REFERENCE_COLUMNS = new Set([
  "project_id",
  "candidate_project_id",
  "latest_project_id",
  "source_project_id",
  "target_project_id",
]);
const RAG_DOCUMENT_REFERENCE_COLUMNS = new Set([
  "document_id",
  "document_metadata_id",
  "metadata_id",
  "source_document_id",
  "trigger_source_document_id",
]);
const APP_RETAIN_WITH_PROJECT_ID = new Set([
  "ai_tool_write_audits",
  "projects_audit",
]);
const APP_RETAIN_AND_CLEAR_PROJECT_ID = new Set([
  "app_error_events",
  "app_error_groups",
]);
const RAG_RETAIN_AND_CLEAR_PROJECT_ID = new Set(["pipeline_model_usage"]);

export function parseArgs(argv) {
  const args = {
    manifest: DEFAULT_MANIFEST,
    mode: "dry-run",
    output: null,
    confirmation: "",
    applyReport: null,
  };
  for (const raw of argv) {
    if (raw.startsWith("--manifest=")) args.manifest = raw.slice(11);
    else if (raw.startsWith("--mode=")) args.mode = raw.slice(7);
    else if (raw.startsWith("--output=")) args.output = raw.slice(9);
    else if (raw.startsWith("--confirm=")) args.confirmation = raw.slice(10);
    else if (raw.startsWith("--apply-report=")) {
      args.applyReport = raw.slice("--apply-report=".length);
    } else throw new Error(`Unknown argument: ${raw}`);
  }
  if (!["dry-run", "apply", "verify"].includes(args.mode)) {
    throw new Error(
      `Unknown mode ${args.mode}; expected dry-run, apply, or verify.`,
    );
  }
  if (args.mode === "verify" && !args.applyReport) {
    throw new Error(
      "Verify mode requires --apply-report=<matching APPLY_PASS receipt>.",
    );
  }
  return args;
}

function normalized(value) {
  if (value === null || typeof value === "undefined") return null;
  const text = String(value).trim();
  return text === "" ? null : text;
}

export function canonicalManifest(manifest) {
  if (!manifest || typeof manifest !== "object" || !Array.isArray(manifest.targets)) {
    throw new Error("Manifest must contain a targets array.");
  }
  if (manifest.targets.length === 0) {
    throw new Error("Manifest must contain at least one target.");
  }
  const targets = manifest.targets.map((target, index) => {
    const name = normalized(target.name);
    if (!name) throw new Error(`Target ${index + 1} is missing name.`);
    const projectId =
      target.projectId === null || typeof target.projectId === "undefined"
        ? null
        : Number(target.projectId);
    if (projectId !== null && (!Number.isInteger(projectId) || projectId <= 0)) {
      throw new Error(`Target ${index + 1} has an invalid projectId.`);
    }
    return {
      name,
      projectId,
      jobNumber: normalized(target.jobNumber),
      acumaticaProjectId: normalized(target.acumaticaProjectId),
    };
  });
  const names = targets.map((target) => target.name);
  if (new Set(names).size !== names.length) {
    throw new Error("Manifest target names must be unique.");
  }
  return {
    taskId: normalized(manifest.taskId) ?? "UNSPECIFIED",
    targets,
  };
}

export function manifestDigest(manifest) {
  return crypto
    .createHash("sha256")
    .update(JSON.stringify(canonicalManifest(manifest)))
    .digest("hex");
}

export function expectedConfirmation(manifest) {
  return `PURGE_PROJECTS_${manifestDigest(manifest).slice(0, 16).toUpperCase()}`;
}

export function validateApplyReportReceipt(manifest, applyReport) {
  const canonical = canonicalManifest(manifest);
  if (
    applyReport?.status !== "APPLY_PASS" ||
    applyReport?.taskId !== canonical.taskId ||
    applyReport?.manifestDigest !== manifestDigest(manifest)
  ) {
    throw new Error(
      "Verify mode rejected an apply report that is not a matching APPLY_PASS receipt.",
    );
  }
  const targetDocumentIds = applyReport.ragDatabase?.targetDocumentIds;
  if (
    !Array.isArray(targetDocumentIds) ||
    targetDocumentIds.length !==
      Number(applyReport.ragDatabase?.targetDocumentCount ?? -1)
  ) {
    throw new Error(
      "Verify mode requires every deleted RAG document ID in the apply report.",
    );
  }
  return targetDocumentIds;
}

function rowJobNumbers(row) {
  return new Set(
    [row.job_number, row.project_number]
      .map(normalized)
      .filter(Boolean),
  );
}

export function validateTargetResolution(manifest, rows) {
  const canonical = canonicalManifest(manifest);
  const rowsByName = new Map();
  for (const row of rows) {
    const name = normalized(row.name);
    if (!rowsByName.has(name)) rowsByName.set(name, []);
    rowsByName.get(name).push(row);
  }

  const errors = [];
  const resolved = [];
  for (const target of canonical.targets) {
    const matches = rowsByName.get(target.name) ?? [];
    if (matches.length !== 1) {
      errors.push(
        `${target.name}: expected exactly one production row, found ${matches.length}.`,
      );
      continue;
    }
    const row = matches[0];
    if (target.projectId && Number(row.id) !== target.projectId) {
      errors.push(
        `${target.name}: expected project ID ${target.projectId}, found ${row.id}.`,
      );
      continue;
    }
    if (
      target.jobNumber &&
      !rowJobNumbers(row).has(target.jobNumber)
    ) {
      errors.push(
        `${target.name}: expected job number ${target.jobNumber}, found ${[
          ...rowJobNumbers(row),
        ].join(" / ") || "none"}.`,
      );
      continue;
    }
    if (
      target.acumaticaProjectId &&
      normalized(row.acumatica_project_id) !== target.acumaticaProjectId
    ) {
      errors.push(
        `${target.name}: expected Acumatica ID ${target.acumaticaProjectId}, found ${
          normalized(row.acumatica_project_id) ?? "none"
        }.`,
      );
      continue;
    }
    resolved.push({
      id: Number(row.id),
      name: row.name,
      jobNumber: normalized(row.job_number),
      projectNumber: normalized(row.project_number),
      acumaticaProjectId: normalized(row.acumatica_project_id),
      erpSystem: normalized(row.erp_system),
      archived: row.archived === true,
      createdAt: row.created_at,
    });
  }

  if (errors.length > 0) {
    throw new Error(`Target resolution failed:\n- ${errors.join("\n- ")}`);
  }
  if (resolved.length !== canonical.targets.length) {
    throw new Error(
      `Target resolution returned ${resolved.length} rows for ${canonical.targets.length} targets.`,
    );
  }
  return resolved;
}

function quoteIdentifier(value) {
  return `"${String(value).replaceAll('"', '""')}"`;
}

function qualifiedTable(schema, table) {
  return `${quoteIdentifier(schema)}.${quoteIdentifier(table)}`;
}

function safeConnectionConfig(connectionString, applicationName) {
  const url = new URL(connectionString);
  url.searchParams.delete("sslmode");
  return {
    connectionString: url.toString(),
    connectionTimeoutMillis: 10_000,
    statement_timeout: 60_000,
    application_name: applicationName,
    ssl: { rejectUnauthorized: false },
  };
}

async function connectRequired(envName, applicationName) {
  const connectionString = process.env[envName]?.trim();
  if (!connectionString) {
    throw new Error(
      `${envName} is required. Cross-store purge inventory cannot be partial.`,
    );
  }
  const { Client } = require("pg");
  const client = new Client(
    safeConnectionConfig(connectionString, applicationName),
  );
  await client.connect();
  return client;
}

async function resolveTargets(client, manifest) {
  const names = canonicalManifest(manifest).targets.map((target) => target.name);
  const result = await client.query(
    `select
       id,
       name,
       "job number"::text as job_number,
       project_number::text,
       acumatica_project_id::text,
       erp_system::text,
       archived,
       created_at
     from public.projects
     where btrim(name) = any($1::text[])
     order by name, id`,
    [names],
  );
  return validateTargetResolution(manifest, result.rows);
}

async function listProjectReferenceColumns(client, schemas) {
  const result = await client.query(
    `select
       column_info.table_schema,
       column_info.table_name,
       column_info.column_name,
       coalesce((
         select constraint_info.delete_rule
         from information_schema.referential_constraints constraint_info
         join information_schema.key_column_usage key_info
           on key_info.constraint_name = constraint_info.constraint_name
          and key_info.constraint_schema = constraint_info.constraint_schema
         join information_schema.constraint_column_usage target_info
           on target_info.constraint_name = constraint_info.constraint_name
          and target_info.constraint_schema = constraint_info.constraint_schema
         where key_info.table_schema = column_info.table_schema
           and key_info.table_name = column_info.table_name
           and key_info.column_name = column_info.column_name
           and target_info.table_schema = 'public'
           and target_info.table_name = 'projects'
           and target_info.column_name = 'id'
         limit 1
       ), 'NONE') as delete_rule,
       exists (
         select 1
         from information_schema.table_constraints constraint_info
         join information_schema.key_column_usage key_info
           on key_info.constraint_name = constraint_info.constraint_name
          and key_info.constraint_schema = constraint_info.constraint_schema
         join information_schema.constraint_column_usage target_info
           on target_info.constraint_name = constraint_info.constraint_name
          and target_info.constraint_schema = constraint_info.constraint_schema
         where constraint_info.constraint_type = 'FOREIGN KEY'
           and key_info.table_schema = column_info.table_schema
           and key_info.table_name = column_info.table_name
           and key_info.column_name = column_info.column_name
           and target_info.table_schema = 'public'
           and target_info.table_name = 'projects'
           and target_info.column_name = 'id'
       ) as references_projects
     from information_schema.columns column_info
     join information_schema.tables table_info
       on table_info.table_schema = column_info.table_schema
      and table_info.table_name = column_info.table_name
      and table_info.table_type = 'BASE TABLE'
     where column_info.table_schema = any($1::text[])
       and column_info.column_name = any($2::text[])
     order by column_info.table_schema, column_info.table_name, column_info.column_name`,
    [schemas, [...PROJECT_REFERENCE_COLUMNS]],
  );
  return result.rows;
}

async function countReferences(client, columns, projectIds) {
  const projectIdStrings = projectIds.map(String);
  const counts = [];
  for (const column of columns) {
    const tableName = qualifiedTable(column.table_schema, column.table_name);
    const columnName = quoteIdentifier(column.column_name);
    const result = await client.query(
      `select ${columnName}::text as project_reference, count(*)::bigint as row_count
       from ${tableName}
       where ${columnName}::text = any($1::text[])
       group by ${columnName}::text
       order by ${columnName}::text`,
      [projectIdStrings],
    );
    const rows = result.rows.map((row) => ({
      reference: row.project_reference,
      ...(/^\d+$/.test(row.project_reference)
        ? { projectId: Number(row.project_reference) }
        : {}),
      count: Number(row.row_count),
    }));
    if (rows.length > 0) {
      counts.push({
        schema: column.table_schema,
        table: column.table_name,
        column: column.column_name,
        referencesProjects: column.references_projects === true,
        deleteRule: column.delete_rule,
        rows,
        total: rows.reduce((sum, row) => sum + row.count, 0),
      });
    }
  }
  return counts;
}

async function findStorageCandidates(client, resolvedTargets) {
  const ids = resolvedTargets.map((target) => String(target.id));
  const expressions = [];
  const values = [];
  for (const id of ids) {
    values.push(`${id}/%`, `projects/${id}/%`, `project/${id}/%`);
    expressions.push(
      `(name like $${values.length - 2} or name like $${values.length - 1} or name like $${values.length})`,
    );
  }
  const result = await client.query(
    `select bucket_id, name, created_at, updated_at, metadata
     from storage.objects
     where ${expressions.join(" or ")}
     order by bucket_id, name
     limit 5000`,
    values,
  );
  return result.rows.map((row) => ({
    bucket: row.bucket_id,
    name: row.name,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    size: Number(row.metadata?.size ?? 0),
  }));
}

async function listNamedReferenceColumns(client, schemas, columnNames) {
  const result = await client.query(
    `select column_info.table_schema, column_info.table_name, column_info.column_name
     from information_schema.columns column_info
     join information_schema.tables table_info
       on table_info.table_schema = column_info.table_schema
      and table_info.table_name = column_info.table_name
      and table_info.table_type = 'BASE TABLE'
     where column_info.table_schema = any($1::text[])
       and column_info.column_name = any($2::text[])
     order by column_info.table_schema, column_info.table_name, column_info.column_name`,
    [schemas, [...columnNames]],
  );
  return result.rows;
}

async function resolveRagDocumentIds(client, projectIds) {
  const result = await client.query(
    `select id::text
     from public.rag_document_metadata
     where project_id::text = any($1::text[])
     order by id::text`,
    [projectIds.map(String)],
  );
  return result.rows.map((row) => row.id);
}

function groupColumnMatches(columns, values, excludedTables = new Set()) {
  const groups = new Map();
  for (const column of columns) {
    if (excludedTables.has(column.table_name)) continue;
    const key = `${column.table_schema}.${column.table_name}`;
    if (!groups.has(key)) {
      groups.set(key, {
        schema: column.table_schema,
        table: column.table_name,
        conditions: [],
      });
    }
    groups.get(key).conditions.push({
      column: column.column_name,
      values: values.map(String),
    });
  }
  return groups;
}

function mergeMatchGroups(...groupMaps) {
  const merged = new Map();
  for (const groupMap of groupMaps) {
    for (const [key, group] of groupMap) {
      if (!merged.has(key)) {
        merged.set(key, {
          schema: group.schema,
          table: group.table,
          conditions: [],
        });
      }
      merged.get(key).conditions.push(...group.conditions);
    }
  }
  return merged;
}

function deleteStatement(group) {
  const values = [];
  const clauses = group.conditions.map((condition) => {
    values.push(condition.values);
    return `${quoteIdentifier(condition.column)}::text = any($${values.length}::text[])`;
  });
  return {
    sql: `delete from ${qualifiedTable(group.schema, group.table)}
          where ${clauses.map((clause) => `(${clause})`).join(" or ")}`,
    values,
  };
}

async function deleteGroupsWithRetry(client, groupMap, label) {
  const pending = [...groupMap.values()];
  const deleted = [];
  const blockedReasons = new Map();
  let pass = 0;
  while (pending.length > 0) {
    pass += 1;
    let progress = 0;
    for (let index = pending.length - 1; index >= 0; index -= 1) {
      const group = pending[index];
      const savepoint = `project_purge_${pass}_${index}`;
      await client.query(`savepoint ${savepoint}`);
      try {
        const statement = deleteStatement(group);
        const result = await client.query(statement.sql, statement.values);
        await client.query(`release savepoint ${savepoint}`);
        deleted.push({
          schema: group.schema,
          table: group.table,
          rows: result.rowCount,
        });
        pending.splice(index, 1);
        progress += 1;
      } catch (error) {
        await client.query(`rollback to savepoint ${savepoint}`);
        await client.query(`release savepoint ${savepoint}`);
        if (!["23502", "23503", "23514"].includes(error.code)) {
          throw new Error(
            `${label} purge failed at ${group.schema}.${group.table}: ${error.message}`,
            { cause: error },
          );
        }
        blockedReasons.set(
          `${group.schema}.${group.table}`,
          [error.message, error.detail, error.constraint].filter(Boolean).join(" | "),
        );
      }
    }
    if (progress === 0) {
      throw new Error(
        `${label} purge is blocked by dependencies:\n${pending
          .map((group) => {
            const key = `${group.schema}.${group.table}`;
            return `- ${key}: ${blockedReasons.get(key) ?? "unknown dependency"}`;
          })
          .join("\n")}`,
      );
    }
  }
  return deleted.sort((left, right) =>
    `${left.schema}.${left.table}`.localeCompare(`${right.schema}.${right.table}`),
  );
}

async function countGroupMatches(client, groupMap) {
  let total = 0;
  const matches = [];
  for (const group of groupMap.values()) {
    const statement = deleteStatement(group);
    const countSql = statement.sql.replace(
      /^delete from /,
      "select count(*)::bigint as row_count from ",
    );
    const result = await client.query(countSql, statement.values);
    const rows = Number(result.rows[0].row_count);
    if (rows > 0) {
      matches.push({ schema: group.schema, table: group.table, rows });
      total += rows;
    }
  }
  return { total, matches };
}

async function deleteIndirectAppRows(client, projectIds) {
  const ids = projectIds.map(String);
  const statements = [
    {
      table: "pco_line_items",
      sql: `delete from public.pco_line_items row_to_delete
            where row_to_delete.change_event_id in (
              select id from public.change_events
              where project_id::text = any($1::text[])
            )
               or row_to_delete.change_event_line_item_id in (
                 select line_item.id
                 from public.change_event_line_items line_item
                 join public.change_events event on event.id = line_item.change_event_id
                 where event.project_id::text = any($1::text[])
               )`,
    },
    {
      table: "pco_change_events",
      sql: `delete from public.pco_change_events row_to_delete
            where row_to_delete.change_event_id in (
              select id from public.change_events
              where project_id::text = any($1::text[])
            )`,
    },
    {
      table: "change_event_line_items",
      sql: `delete from public.change_event_line_items row_to_delete
            where row_to_delete.change_event_id in (
              select id from public.change_events
              where project_id::text = any($1::text[])
            )`,
    },
    {
      table: "budget_changes",
      sql: `delete from public.budget_changes row_to_delete
            where row_to_delete.change_event_id in (
              select id from public.change_events
              where project_id::text = any($1::text[])
            )`,
    },
    {
      table: "purchase_order_sov_items",
      sql: `delete from public.purchase_order_sov_items row_to_delete
            where row_to_delete.project_budget_code_id in (
              select id from public.project_budget_codes
              where project_id::text = any($1::text[])
            )`,
    },
    {
      table: "subcontract_sov_items",
      sql: `delete from public.subcontract_sov_items row_to_delete
            where row_to_delete.project_budget_code_id in (
              select id from public.project_budget_codes
              where project_id::text = any($1::text[])
            )`,
    },
    {
      table: "direct_cost_line_items",
      sql: `delete from public.direct_cost_line_items row_to_delete
            where row_to_delete.budget_code_id in (
              select id from public.project_budget_codes
              where project_id::text = any($1::text[])
            )
               or row_to_delete.direct_cost_id in (
                 select id from public.direct_costs
                 where project_id::text = any($1::text[])
               )`,
    },
    {
      table: "owner_invoices",
      sql: `delete from public.owner_invoices row_to_delete
            where row_to_delete.prime_contract_id in (
              select id from public.prime_contracts
              where project_id::text = any($1::text[])
            )`,
    },
    {
      table: "payment_transactions",
      sql: `delete from public.payment_transactions row_to_delete
            where row_to_delete.contract_id in (
              select id from public.prime_contracts
              where project_id::text = any($1::text[])
            )`,
    },
  ];
  const deleted = [];
  for (const statement of statements) {
    const result = await client.query(statement.sql, [ids]);
    if (result.rowCount > 0) {
      deleted.push({ table: statement.table, rows: result.rowCount });
    }
  }
  return deleted;
}

async function performAppPurge(client, columns, projectIds) {
  const excluded = new Set([
    ...APP_RETAIN_WITH_PROJECT_ID,
    ...APP_RETAIN_AND_CLEAR_PROJECT_ID,
  ]);
  const groups = groupColumnMatches(
    columns.filter((column) => column.table_schema === "public"),
    projectIds,
    excluded,
  );
  await client.query(
    `select set_config('app.project_current_state_projection_boundary', 'true', true),
            set_config('app.executive_domain_write_boundary', 'true', true)`,
  );
  const deletedIndirectTables = await deleteIndirectAppRows(client, projectIds);
  const deletedTables = await deleteGroupsWithRetry(client, groups, "App");
  const deletedProjects = await client.query(
    `delete from public.projects where id::text = any($1::text[])`,
    [projectIds.map(String)],
  );
  if (deletedProjects.rowCount !== projectIds.length) {
    throw new Error(
      `App purge expected ${projectIds.length} project rows, deleted ${deletedProjects.rowCount}.`,
    );
  }
  const remaining = await countGroupMatches(client, groups);
  if (remaining.total !== 0) {
    throw new Error(`App purge left ${remaining.total} scoped rows.`);
  }
  return {
    deletedProjects: deletedProjects.rowCount,
    deletedIndirectTables,
    deletedTables,
  };
}

async function simulateAppPurge(client, columns, projectIds) {
  await client.query("begin");
  try {
    return await performAppPurge(client, columns, projectIds);
  } finally {
    await client.query("rollback");
  }
}

async function performRagPurge(
  client,
  projectColumns,
  documentColumns,
  projectIds,
  documentIds,
) {
  const projectGroups = groupColumnMatches(
    projectColumns,
    projectIds,
    RAG_RETAIN_AND_CLEAR_PROJECT_ID,
  );
  const documentGroups = groupColumnMatches(documentColumns, documentIds);
  const groups = mergeMatchGroups(projectGroups, documentGroups);
  const clearedUsage = await client.query(
    `update public.pipeline_model_usage
     set project_id = null
     where project_id::text = any($1::text[])`,
    [projectIds.map(String)],
  );
  const deletedTables = await deleteGroupsWithRetry(client, groups, "RAG");
  const remaining = await countGroupMatches(client, groups);
  if (remaining.total !== 0) {
    throw new Error(`RAG purge left ${remaining.total} scoped rows.`);
  }
  return {
    clearedPipelineUsageRows: clearedUsage.rowCount,
    deletedTables,
  };
}

async function simulateRagPurge(
  client,
  projectColumns,
  documentColumns,
  projectIds,
  documentIds,
) {
  await client.query("begin");
  try {
    return await performRagPurge(
      client,
      projectColumns,
      documentColumns,
      projectIds,
      documentIds,
    );
  } finally {
    await client.query("rollback");
  }
}

async function buildDryRun(appDb, ragDb, manifest) {
  const targets = await resolveTargets(appDb, manifest);
  const ids = targets.map((target) => target.id);
  const appColumns = await listProjectReferenceColumns(appDb, [
    "public",
    "storage",
  ]);
  const ragColumns = await listProjectReferenceColumns(ragDb, ["public"]);
  const ragDocumentColumns = await listNamedReferenceColumns(
    ragDb,
    ["public"],
    RAG_DOCUMENT_REFERENCE_COLUMNS,
  );
  const ragDocumentIds = await resolveRagDocumentIds(ragDb, ids);
  const appReferences = await countReferences(appDb, appColumns, ids);
  const storageCandidates = await findStorageCandidates(appDb, targets);
  const ragReferences = await countReferences(ragDb, ragColumns, ids);
  const ragDocumentReferences = await countReferences(
    ragDb,
    ragDocumentColumns,
    ragDocumentIds,
  );
  const [appSimulation, ragSimulation] = await Promise.all([
    simulateAppPurge(appDb, appColumns, ids),
    simulateRagPurge(
      ragDb,
      ragColumns,
      ragDocumentColumns,
      ids,
      ragDocumentIds,
    ),
  ]);

  return {
    status: "DRY_RUN_PASS",
    generatedAt: new Date().toISOString(),
    taskId: canonicalManifest(manifest).taskId,
    manifestDigest: manifestDigest(manifest),
    requiredConfirmation: expectedConfirmation(manifest),
    targets,
    appDatabase: {
      referencedTables: appReferences,
      totalScopedRows: appReferences.reduce(
        (sum, relation) => sum + relation.total,
        0,
      ),
      transactionRollbackSimulation: appSimulation,
    },
    ragDatabase: {
      referencedTables: ragReferences,
      documentReferenceTables: ragDocumentReferences,
      directProjectRows: ragReferences.reduce(
        (sum, relation) => sum + relation.total,
        0,
      ),
      documentReferenceRows: ragDocumentReferences.reduce(
        (sum, relation) => sum + relation.total,
        0,
      ),
      targetDocumentCount: ragDocumentIds.length,
      totalScopedRows:
        ragReferences.reduce((sum, relation) => sum + relation.total, 0) +
        ragDocumentReferences.reduce((sum, relation) => sum + relation.total, 0),
      transactionRollbackSimulation: ragSimulation,
    },
    storage: {
      candidates: storageCandidates,
      candidateCount: storageCandidates.length,
      candidateBytes: storageCandidates.reduce(
        (sum, object) => sum + object.size,
        0,
      ),
      note:
        "Candidates are name-pattern matches only and are not approved for deletion until reviewed.",
    },
    applyEnabled: true,
    applyNote:
      "Apply requires the manifest-bound confirmation and reruns this exact resolution before opening either deletion transaction.",
  };
}

async function buildApply(appDb, ragDb, manifest) {
  const targets = await resolveTargets(appDb, manifest);
  const ids = targets.map((target) => target.id);
  const appColumns = await listProjectReferenceColumns(appDb, [
    "public",
    "storage",
  ]);
  const ragColumns = await listProjectReferenceColumns(ragDb, ["public"]);
  const ragDocumentColumns = await listNamedReferenceColumns(
    ragDb,
    ["public"],
    RAG_DOCUMENT_REFERENCE_COLUMNS,
  );
  const ragDocumentIds = await resolveRagDocumentIds(ragDb, ids);
  const storageCandidates = await findStorageCandidates(appDb, targets);
  if (storageCandidates.length > 0) {
    throw new Error(
      `Apply blocked: found ${storageCandidates.length} exact project-folder storage objects. ` +
        "Storage deletion is not enabled until those exact paths are reviewed.",
    );
  }

  const appAuditBefore = await countReferences(
    appDb,
    appColumns.filter((column) =>
      APP_RETAIN_WITH_PROJECT_ID.has(column.table_name),
    ),
    ids,
  );

  await appDb.query("begin");
  await ragDb.query("begin");
  let ragCommitted = false;
  let appCommitted = false;
  let appResult;
  let ragResult;
  try {
    ragResult = await performRagPurge(
      ragDb,
      ragColumns,
      ragDocumentColumns,
      ids,
      ragDocumentIds,
    );
    appResult = await performAppPurge(appDb, appColumns, ids);

    await ragDb.query("commit");
    ragCommitted = true;
    await appDb.query("commit");
    appCommitted = true;
  } catch (error) {
    if (!ragCommitted) await ragDb.query("rollback").catch(() => {});
    if (!appCommitted) await appDb.query("rollback").catch(() => {});
    if (ragCommitted && !appCommitted) {
      throw new Error(
        `Partial purge: RAG committed but app transaction rolled back. Rerun is safe. Cause: ${error.message}`,
        { cause: error },
      );
    }
    throw error;
  }

  const projectRowsAfter = await appDb.query(
    `select id, name from public.projects where id::text = any($1::text[])`,
    [ids.map(String)],
  );
  const appAfter = await countReferences(appDb, appColumns, ids);
  const ragAfter = await countReferences(ragDb, ragColumns, ids);
  const ragDocumentAfter = await countReferences(
    ragDb,
    ragDocumentColumns,
    ragDocumentIds,
  );
  const unexpectedAppRows = appAfter.filter(
    (entry) => !APP_RETAIN_WITH_PROJECT_ID.has(entry.table),
  );
  if (
    projectRowsAfter.rowCount !== 0 ||
    unexpectedAppRows.length > 0 ||
    ragAfter.length > 0 ||
    ragDocumentAfter.length > 0
  ) {
    throw new Error(
      `Post-purge verification failed: projects=${projectRowsAfter.rowCount}, ` +
        `appReferences=${unexpectedAppRows.length}, ragProjectReferences=${ragAfter.length}, ` +
        `ragDocumentReferences=${ragDocumentAfter.length}.`,
    );
  }

  return {
    status: "APPLY_PASS",
    generatedAt: new Date().toISOString(),
    taskId: canonicalManifest(manifest).taskId,
    manifestDigest: manifestDigest(manifest),
    targets,
    appDatabase: {
      ...appResult,
      retainedAuditRows: appAfter.filter((entry) =>
        APP_RETAIN_WITH_PROJECT_ID.has(entry.table),
      ),
      retainedAuditRowsBefore: appAuditBefore,
      remainingNonAuditProjectReferences: unexpectedAppRows,
    },
    ragDatabase: {
      ...ragResult,
      targetDocumentCount: ragDocumentIds.length,
      targetDocumentIds: ragDocumentIds,
      remainingProjectReferences: ragAfter,
      remainingDocumentReferences: ragDocumentAfter,
    },
    storage: {
      deletedObjects: 0,
      note: "No exact project-folder storage objects existed for these targets.",
    },
    verification: {
      remainingProjectRows: projectRowsAfter.rows,
      appNonAuditReferences: unexpectedAppRows.length,
      ragProjectReferences: ragAfter.length,
      ragDocumentReferences: ragDocumentAfter.length,
    },
  };
}

async function buildDeletedVerification(appDb, ragDb, manifest, applyReportPath) {
  const canonical = canonicalManifest(manifest);
  const ids = canonical.targets.map((target) => target.projectId);
  if (ids.some((id) => id === null)) {
    throw new Error("Verify mode requires projectId on every manifest target.");
  }
  const names = canonical.targets.map((target) => target.name);
  const appColumns = await listProjectReferenceColumns(appDb, [
    "public",
    "storage",
  ]);
  const ragColumns = await listProjectReferenceColumns(ragDb, ["public"]);
  const ragDocumentColumns = await listNamedReferenceColumns(
    ragDb,
    ["public"],
    RAG_DOCUMENT_REFERENCE_COLUMNS,
  );
  const projectRows = await appDb.query(
    `select id, name
     from public.projects
     where id::text = any($1::text[]) or name = any($2::text[])
     order by id`,
    [ids.map(String), names],
  );
  const appReferences = await countReferences(appDb, appColumns, ids);
  const storageCandidates = await findStorageCandidates(
    appDb,
    canonical.targets.map((target) => ({ id: target.projectId })),
  );
  const ragReferences = await countReferences(ragDb, ragColumns, ids);
  const applyReport = JSON.parse(
    fs.readFileSync(path.resolve(applyReportPath), "utf8"),
  );
  const targetDocumentIds = validateApplyReportReceipt(manifest, applyReport);
  const ragDocumentReferences = await countReferences(
    ragDb,
    ragDocumentColumns,
    targetDocumentIds,
  );
  const unexpectedAppRows = appReferences.filter(
    (entry) => !APP_RETAIN_WITH_PROJECT_ID.has(entry.table),
  );
  if (
    projectRows.rowCount > 0 ||
    unexpectedAppRows.length > 0 ||
    ragReferences.length > 0 ||
    ragDocumentReferences.length > 0 ||
    storageCandidates.length > 0
  ) {
    throw new Error(
      `Deleted-state verification failed: projects=${projectRows.rowCount}, ` +
        `appReferences=${unexpectedAppRows.length}, ragReferences=${ragReferences.length}, ` +
        `ragDocumentReferences=${ragDocumentReferences.length}, storageObjects=${storageCandidates.length}.`,
    );
  }
  return {
    status: "VERIFY_PASS",
    generatedAt: new Date().toISOString(),
    taskId: canonical.taskId,
    manifestDigest: manifestDigest(manifest),
    targets: canonical.targets,
    verification: {
      remainingProjectRows: projectRows.rows,
      remainingAppNonAuditReferences: unexpectedAppRows,
      remainingRagProjectReferences: ragReferences,
      checkedRagDocumentIds: targetDocumentIds.length,
      remainingRagDocumentReferences: ragDocumentReferences,
      remainingStorageObjects: storageCandidates,
      retainedAppAuditReferences: appReferences.filter((entry) =>
        APP_RETAIN_WITH_PROJECT_ID.has(entry.table),
      ),
    },
    note:
      "The verifier independently replayed the manifest-bound apply receipt's exact RAG document IDs.",
  };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const manifest = canonicalManifest(
    JSON.parse(fs.readFileSync(path.resolve(args.manifest), "utf8")),
  );

  const appDb = await connectRequired(
    "DATABASE_URL",
    "alleato-project-purge-dry-run",
  );
  const ragDb = await connectRequired(
    "RAG_DATABASE_URL",
    "alleato-project-purge-rag-dry-run",
  );
  try {
    if (args.mode === "apply") {
      const expected = expectedConfirmation(manifest);
      if (args.confirmation !== expected) {
        throw new Error(
          `Apply confirmation mismatch. Run dry-run and use its requiredConfirmation value.`,
        );
      }
    }
    const report =
      args.mode === "apply"
        ? await buildApply(appDb, ragDb, manifest)
        : args.mode === "verify"
          ? await buildDeletedVerification(
              appDb,
              ragDb,
              manifest,
              args.applyReport,
            )
          : await buildDryRun(appDb, ragDb, manifest);
    const serialized = `${JSON.stringify(report, null, 2)}\n`;
    if (args.output) {
      fs.writeFileSync(path.resolve(args.output), serialized, {
        encoding: "utf8",
        mode: 0o600,
      });
    }
    process.stdout.write(serialized);
  } finally {
    await Promise.allSettled([appDb.end(), ragDb.end()]);
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(`Project purge failed: ${error.message}`);
    process.exit(1);
  });
}
