#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

import {
  buildAppDatabaseConnectionString,
  getAppDatabaseUrl,
} from "./verify/app-db-connection.mjs";

const repoRoot = resolve(import.meta.dirname, "..");

const files = {
  estimateService: "frontend/src/lib/services/estimate-service.ts",
  gcItemsRoute:
    "frontend/src/app/api/projects/[projectId]/estimates/[estimateId]/gc-items/route.ts",
  detailItemsRoute:
    "frontend/src/app/api/projects/[projectId]/estimates/[estimateId]/detail-items/route.ts",
  estimateEditor:
    "frontend/src/app/(main)/[projectId]/estimates/[estimateId]/estimate-detail-client-v2.tsx",
  template: "frontend/src/lib/estimates/template.ts",
};

function loadEnv() {
  for (const name of [".env", ".env.local", "frontend/.env.local"]) {
    const path = resolve(repoRoot, name);
    if (!existsSync(path)) continue;
    const content = readFileSync(path, "utf8");
    for (const line of content.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const match = trimmed.match(/^([^=]+?)=(.*)$/);
      if (!match) continue;
      const key = match[1].trim();
      if (process.env[key]) continue;
      let value = match[2].trim();
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }
      process.env[key] = value;
    }
  }
}

function read(relativePath) {
  return readFileSync(resolve(repoRoot, relativePath), "utf8");
}

function runPsql(databaseUrl, sql) {
  return execFileSync(
    "psql",
    [
      databaseUrl,
      "-qAt",
      "-v",
      "ON_ERROR_STOP=1",
      "-c",
      `set statement_timeout='30s';\n${sql}`,
    ],
    {
      cwd: repoRoot,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    }
  ).trim();
}

const failures = [];
const warnings = [];

function requireStatic(description, file, predicate) {
  const content = read(file);
  if (!predicate(content)) {
    failures.push(`${description} (${file})`);
  }
}

loadEnv();

requireStatic("Estimate create seeds GC starter rows", files.estimateService, (content) =>
  content.includes("buildEstimateV2GcStarterRows") &&
  content.includes(".from(\"estimate_gc_items\")") &&
  content.includes("Failed to seed estimate GC starter rows")
);

requireStatic("Estimate create seeds detail starter rows", files.estimateService, (content) =>
  content.includes("buildEstimateV2DetailStarterRows") &&
  content.includes(".from(\"estimate_detail_items\")") &&
  content.includes("Failed to seed estimate detail starter rows")
);

requireStatic("Estimate create persists duration months", files.estimateService, (content) =>
  content.includes("project_duration_months: data.project_duration_months ?? null")
);

requireStatic("GC route accepts bulk template inserts", files.gcItemsRoute, (content) =>
  content.includes("Array.isArray(body.items)") &&
  content.includes("estimate_gc_items") &&
  content.includes("rows.length === 0")
);

requireStatic("Detail route accepts bulk template inserts", files.detailItemsRoute, (content) =>
  content.includes("Array.isArray(body.items)") &&
  content.includes("estimate_detail_items") &&
  content.includes("rows.length === 0")
);

requireStatic("Estimate editor does not auto-load GC templates on page load", files.estimateEditor, (content) =>
  !content.includes("loadGcTemplate") &&
  !content.includes("templateLoaded")
);

requireStatic("Estimate editor does not auto-load detail templates on page load", files.estimateEditor, (content) =>
  !content.includes("loadDetailTemplate") &&
  !content.includes("detailTemplateLoaded")
);

requireStatic("Estimate V2 starter builders are centralized", files.template, (content) =>
  content.includes("buildEstimateV2GcStarterRows") &&
  content.includes("buildEstimateV2DetailStarterRows")
);

const rawDatabaseUrl = getAppDatabaseUrl(process.env);

if (!rawDatabaseUrl) {
  failures.push("DATABASE_URL, SUPABASE_DB_URL, or APP_METADATA_DATABASE_URL is required.");
} else {
  try {
    const databaseUrl = await buildAppDatabaseConnectionString(rawDatabaseUrl, {
      warnings,
    });
    const rows = runPsql(
      databaseUrl,
      `
with expected(table_name, column_name, data_type, is_nullable) as (
  values
    ('estimates', 'project_duration_weeks', 'numeric', null),
    ('estimates', 'project_duration_months', 'numeric', null),
    ('estimate_gc_items', 'estimate_id', 'integer', 'NO'),
    ('estimate_gc_items', 'cost_code', 'text', null),
    ('estimate_gc_items', 'qty_basis', 'text', null),
    ('estimate_gc_items', 'rate', 'numeric', null),
    ('estimate_gc_items', 'allocation', 'numeric', null),
    ('estimate_gc_items', 'sort_order', 'integer', null),
    ('estimate_detail_items', 'estimate_id', 'integer', 'NO'),
    ('estimate_detail_items', 'division_code', 'text', null),
    ('estimate_detail_items', 'cost_code', 'text', null),
    ('estimate_detail_items', 'estimated_amount', 'numeric', null),
    ('estimate_detail_items', 'sort_order', 'integer', null)
)
select e.table_name || '.' || e.column_name || ' expected ' || e.data_type ||
  coalesce(' nullable=' || e.is_nullable, '') || ', got ' ||
  coalesce(c.data_type, '<missing>') || coalesce(' nullable=' || c.is_nullable, '')
from expected e
left join information_schema.columns c
  on c.table_schema = 'public'
 and c.table_name = e.table_name
 and c.column_name = e.column_name
where c.column_name is null
   or c.data_type <> e.data_type
   or (e.is_nullable is not null and c.is_nullable <> e.is_nullable);
`
    );

    if (rows) {
      failures.push(
        `Estimate duration/template DB contract mismatch:\n${rows}`
      );
    }
  } catch (error) {
    failures.push(
      `Failed to verify estimate template DB contract: ${
        error instanceof Error ? error.message : String(error)
      }`
    );
  }
}

for (const warning of warnings) {
  console.warn(`[warn] ${warning}`);
}

if (failures.length > 0) {
  console.error("Estimate template contract check failed:");
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

console.log("Estimate template contract check passed.");
