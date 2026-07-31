#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { Client } from "pg";

const AUTO_RESOLVED_TABLES = new Set(["project_roles", "intelligence_targets"]);
const PRECHECKS = [
  {
    table: "project_attribution_rules",
    description: "duplicate project attribution rules on target",
    sql: `
      select s.id as source_id, t.id as target_id, s.rule_type, s.pattern_normalized
      from public.project_attribution_rules s
      join public.project_attribution_rules t
        on t.project_id = $2
       and s.project_id = $1
       and t.rule_type = s.rule_type
       and t.pattern_normalized = s.pattern_normalized
    `,
  },
  {
    table: "project_documents",
    description: "duplicate live project documents on target by source item",
    sql: `
      select s.id as source_id, t.id as target_id, s.source_system, s.source_item_id
      from public.project_documents s
      join public.project_documents t
        on t.project_id = $2
       and s.project_id = $1
       and t.deleted_at is null
       and s.deleted_at is null
       and t.source_system = s.source_system
       and coalesce(t.source_drive_id, '') = coalesce(s.source_drive_id, '')
       and coalesce(t.source_item_id, '') = coalesce(s.source_item_id, '')
      where s.source_item_id is not null
    `,
  },
];

function parseArgs(argv) {
  const args = {
    execute: false,
    archiveSource: true,
    addAlias: true,
  };
  for (let i = 2; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--execute") {
      args.execute = true;
      continue;
    }
    if (arg === "--no-archive-source") {
      args.archiveSource = false;
      continue;
    }
    if (arg === "--no-add-alias") {
      args.addAlias = false;
      continue;
    }
    if (arg === "--source") {
      args.sourceId = Number(argv[++i]);
      continue;
    }
    if (arg === "--target") {
      args.targetId = Number(argv[++i]);
      continue;
    }
    if (arg === "--help" || arg === "-h") {
      printHelp();
      process.exit(0);
    }
    throw new Error(`Unknown argument: ${arg}`);
  }
  if (!Number.isInteger(args.sourceId) || !Number.isInteger(args.targetId)) {
    throw new Error("Both --source <projectId> and --target <projectId> are required.");
  }
  if (args.sourceId === args.targetId) {
    throw new Error("--source and --target must be different project IDs.");
  }
  return args;
}

function printHelp() {
  console.log(`Usage:
  node scripts/ops/merge-project-duplicates.mjs --source <id> --target <id> [--execute]

Defaults:
  dry-run mode unless --execute is provided
  archive source project after merge
  append source project name to target aliases
`);
}

function loadDatabaseUrl() {
  const envPaths = [
    path.resolve("frontend/.env.local"),
    path.resolve(".env.local"),
    path.resolve(".env"),
  ];
  for (const envPath of envPaths) {
    if (!fs.existsSync(envPath)) continue;
    const content = fs.readFileSync(envPath, "utf8");
    const match = content.match(/^DATABASE_URL=(.*)$/m);
    if (match?.[1]) {
      return match[1].replace(/^"|"$/g, "").replace(/sslmode=require/g, "sslmode=no-verify");
    }
  }
  throw new Error("DATABASE_URL not found in frontend/.env.local, .env.local, or .env.");
}

async function getProjects(client, sourceId, targetId) {
  const result = await client.query(
    `
      select
        id,
        name,
        archived,
        aliases,
        project_number,
        acumatica_project_id,
        company_id::text as company_id,
        state,
        category,
        phase,
        stage,
        work_scope,
        onedrive::text as onedrive
      from public.projects
      where id in ($1, $2)
      order by id
    `,
    [sourceId, targetId],
  );
  const rowsById = new Map(result.rows.map((row) => [Number(row.id), { ...row, id: Number(row.id) }]));
  const source = rowsById.get(sourceId);
  const target = rowsById.get(targetId);
  if (!source || !target) {
    throw new Error(`Missing project row(s). source=${Boolean(source)} target=${Boolean(target)}`);
  }
  return { source, target };
}

async function getFkReferences(client) {
  const result = await client.query(`
    select c.conrelid::regclass::text as table_name, a.attname as column_name
    from pg_constraint c
    join pg_attribute a on a.attrelid = c.conrelid and a.attnum = any(c.conkey)
    where c.contype = 'f'
      and c.confrelid = 'public.projects'::regclass
    order by 1, 2
  `);
  return result.rows;
}

function quoteIdent(value) {
  return `"${String(value).replace(/"/g, "\"\"")}"`;
}

function quoteQualified(name) {
  return name.split(".").map(quoteIdent).join(".");
}

async function getReferenceCounts(client, refs, sourceId, targetId) {
  const counts = [];
  for (const ref of refs) {
    const tableRef = quoteQualified(ref.table_name);
    const colRef = quoteIdent(ref.column_name);
    const sql = `
      select
        count(*) filter (where ${colRef} = $1)::bigint as source_count,
        count(*) filter (where ${colRef} = $2)::bigint as target_count
      from ${tableRef}
      where ${colRef} in ($1, $2)
    `;
    const result = await client.query(sql, [sourceId, targetId]);
    const sourceCount = Number(result.rows[0].source_count);
    const targetCount = Number(result.rows[0].target_count);
    if (sourceCount > 0 || targetCount > 0) {
      counts.push({
        tableName: ref.table_name,
        columnName: ref.column_name,
        sourceCount,
        targetCount,
      });
    }
  }
  counts.sort(
    (a, b) =>
      Math.max(b.sourceCount, b.targetCount) - Math.max(a.sourceCount, a.targetCount) ||
      a.tableName.localeCompare(b.tableName),
  );
  return counts;
}

async function runPrechecks(client, sourceId, targetId) {
  const findings = [];
  for (const check of PRECHECKS) {
    const result = await client.query(check.sql, [sourceId, targetId]);
    if (result.rowCount > 0) {
      findings.push({
        table: check.table,
        description: check.description,
        rows: result.rows,
      });
    }
  }
  return findings;
}

async function getTargetReferenceCounts(client, tableName, columnName, targetId) {
  const tableRef = quoteQualified(`public.${tableName}`);
  const colRef = quoteIdent(columnName);
  const result = await client.query(
    `select count(*)::bigint as count from ${tableRef} where ${colRef} = $1`,
    [targetId],
  );
  return Number(result.rows[0].count);
}

async function mergeProjectRoles(client, sourceId, targetId) {
  const deleted = await client.query(
    `
      delete from public.project_roles s
      using public.project_roles t
      where s.project_id = $1
        and t.project_id = $2
        and t.role_name = s.role_name
      returning s.id, s.role_name
    `,
    [sourceId, targetId],
  );
  const updated = await client.query(
    `
      update public.project_roles
      set project_id = $2, updated_at = now()
      where project_id = $1
      returning id, role_name
    `,
    [sourceId, targetId],
  );
  return {
    tableName: "project_roles",
    columnName: "project_id",
    deletedDuplicates: deleted.rows.length,
    updatedRows: updated.rows.length,
  };
}

async function mergeIntelligenceTargets(client, sourceId, targetId) {
  const sourceTargetRes = await client.query(
    `select id, target_type, slug from public.intelligence_targets where project_id = $1`,
    [sourceId],
  );
  if (sourceTargetRes.rowCount === 0) {
    return {
      tableName: "intelligence_targets",
      columnName: "project_id",
      deletedDuplicates: 0,
      updatedRows: 0,
    };
  }
  const sourceTarget = sourceTargetRes.rows[0];
  const targetTargetRes = await client.query(
    `select id, target_type, slug from public.intelligence_targets where project_id = $1`,
    [targetId],
  );
  const targetTarget = targetTargetRes.rows[0] ?? null;

  if (targetTarget) {
    const targetRefs = await client.query(`
      select c.conrelid::regclass::text as table_name, a.attname as column_name
      from pg_constraint c
      join pg_attribute a on a.attrelid = c.conrelid and a.attnum = any(c.conkey)
      where c.contype = 'f'
        and c.confrelid = 'public.intelligence_targets'::regclass
      order by 1, 2
    `);

    for (const ref of targetRefs.rows) {
      if (ref.table_name === "intelligence_packets") {
        await client.query(
          `
            update public.intelligence_packets
            set target_id = $2,
                packet_type = case
                  when packet_type = 'current' then 'snapshot'
                  else packet_type
                end
            where target_id = $1
          `,
          [sourceTarget.id, targetTarget.id],
        );
        continue;
      }
      const tableRef = quoteQualified(ref.table_name);
      const colRef = quoteIdent(ref.column_name);
      await client.query(
        `update ${tableRef} set ${colRef} = $2 where ${colRef} = $1`,
        [sourceTarget.id, targetTarget.id],
      );
    }

    await client.query(`delete from public.intelligence_targets where id = $1`, [sourceTarget.id]);
    return {
      tableName: "intelligence_targets",
      columnName: "project_id",
      deletedDuplicates: 1,
      updatedRows: 0,
      mergedIntoTargetId: targetTarget.id,
    };
  }

  const updated = await client.query(
    `
      update public.intelligence_targets
      set project_id = $2, updated_at = now()
      where project_id = $1
      returning id
    `,
    [sourceId, targetId],
  );
  return {
    tableName: "intelligence_targets",
    columnName: "project_id",
    deletedDuplicates: 0,
    updatedRows: updated.rows.length,
  };
}

async function mergeGenericProjectRefs(client, refs, sourceId, targetId) {
  const handled = new Set(["project_roles.project_id", "intelligence_targets.project_id"]);
  const results = [];
  for (const ref of refs) {
    const key = `${ref.table_name}.${ref.column_name}`;
    if (handled.has(key)) continue;
    const tableRef = quoteQualified(ref.table_name);
    const colRef = quoteIdent(ref.column_name);
    const result = await client.query(
      `update ${tableRef} set ${colRef} = $2 where ${colRef} = $1 returning 1`,
      [sourceId, targetId],
    );
    results.push({
      tableName: ref.table_name,
      columnName: ref.column_name,
      updatedRows: result.rowCount,
    });
  }
  return results.filter((row) => row.updatedRows > 0);
}

async function updateProjectRows(client, source, target, options) {
  const aliasSet = new Set((target.aliases ?? []).filter(Boolean));
  if (options.addAlias && source.name) aliasSet.add(source.name);
  const aliases = Array.from(aliasSet);
  await client.query(`update public.projects set aliases = $2 where id = $1`, [target.id, aliases]);
  if (options.archiveSource) {
    await client.query(
      `
        update public.projects
        set archived = true,
            archived_at = now(),
            aliases = case
              when aliases is null then array[$2::text]
              when not ($2 = any(aliases)) then array_append(aliases, $2::text)
              else aliases
            end
        where id = $1
      `,
      [source.id, target.name ?? `Merged into ${target.id}`],
    );
  }
}

async function runMerge(client, refs, source, target, options) {
  const operations = [];
  await client.query("begin");
  try {
    await client.query(`select id from public.projects where id in ($1, $2) for update`, [source.id, target.id]);

    const roleResult = await mergeProjectRoles(client, source.id, target.id);
    operations.push(roleResult);

    const targetResult = await mergeIntelligenceTargets(client, source.id, target.id);
    operations.push(targetResult);

    const genericResults = await mergeGenericProjectRefs(client, refs, source.id, target.id);
    operations.push(...genericResults);

    await updateProjectRows(client, source, target, options);

    if (options.execute) {
      await client.query("commit");
    } else {
      await client.query("rollback");
    }
  } catch (error) {
    await client.query("rollback");
    throw error;
  }
  return operations;
}

function printProject(label, row) {
  console.log(
    JSON.stringify(
      {
        label,
        id: row.id,
        name: row.name,
        archived: row.archived,
        aliases: row.aliases ?? [],
        projectNumber: row.project_number,
        acumaticaProjectId: row.acumatica_project_id,
        companyId: row.company_id,
        state: row.state,
        category: row.category,
        phase: row.phase,
        stage: row.stage,
        workScope: row.work_scope,
        onedrive: row.onedrive,
      },
      null,
      2,
    ),
  );
}

function printCounts(counts, sourceId, targetId) {
  console.log(`\nProject reference counts (source=${sourceId}, target=${targetId})`);
  for (const row of counts) {
    const note = AUTO_RESOLVED_TABLES.has(row.tableName) ? " auto-resolved" : "";
    console.log(
      `${row.tableName}.${row.columnName}\tsource=${row.sourceCount}\ttarget=${row.targetCount}${note}`,
    );
  }
}

function printPrechecks(findings) {
  if (findings.length === 0) {
    console.log("\nPrechecks: no blocking uniqueness collisions detected.");
    return;
  }
  console.log("\nPrechecks: blocking collisions detected.");
  for (const finding of findings) {
    console.log(`- ${finding.table}: ${finding.description}`);
    for (const row of finding.rows) {
      console.log(`  ${JSON.stringify(row)}`);
    }
  }
}

function printOperations(operations) {
  console.log("\nMerge operations");
  for (const op of operations) {
    const detail = {
      table: op.tableName,
      column: op.columnName,
      updatedRows: op.updatedRows ?? 0,
      deletedDuplicates: op.deletedDuplicates ?? 0,
      mergedIntoTargetId: op.mergedIntoTargetId ?? null,
    };
    console.log(JSON.stringify(detail));
  }
}

async function main() {
  const args = parseArgs(process.argv);
  const client = new Client({ connectionString: loadDatabaseUrl() });
  await client.connect();
  try {
    const { source, target } = await getProjects(client, args.sourceId, args.targetId);
    const refs = await getFkReferences(client);
    const counts = await getReferenceCounts(client, refs, source.id, target.id);
    const prechecks = await runPrechecks(client, source.id, target.id);

    console.log(args.execute ? "MODE: execute" : "MODE: dry-run");
    printProject("source", source);
    printProject("target", target);
    printCounts(counts, source.id, target.id);
    printPrechecks(prechecks);

    if (prechecks.length > 0) {
      throw new Error("Blocking uniqueness collisions found. Resolve them before executing the merge.");
    }

    const operations = await runMerge(client, refs, source, target, args);
    printOperations(operations);

    if (args.execute) {
      const postCounts = await getReferenceCounts(client, refs, source.id, target.id);
      console.log("\nPost-merge reference counts");
      for (const row of postCounts.filter((row) => row.sourceCount > 0)) {
        console.log(`${row.tableName}.${row.columnName}\tsource=${row.sourceCount}\ttarget=${row.targetCount}`);
      }
      if (!postCounts.some((row) => row.sourceCount > 0)) {
        console.log(`source project ${source.id} has zero remaining foreign-key references to public.projects.`);
      }
      const finalSourceCount = await getTargetReferenceCounts(client, "projects", "id", source.id);
      void finalSourceCount;
    } else {
      console.log("\nDry run complete. No database rows were committed.");
    }
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error(`MERGE FAILED: ${error.message}`);
  process.exit(1);
});
