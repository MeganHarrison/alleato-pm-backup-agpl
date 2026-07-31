/**
 * @file generate-procore-module-spec.js
 * @description Spec artifact generator for any Procore module.
 *
 * Pulls system actions from Supabase's app_system_actions table for a given
 * module, classifies them into commands (button/menu actions), table columns,
 * and navigation tabs, then generates five spec files:
 *   - COMMANDS.md   — UI action catalog with derived command keys
 *   - FORMS.md      — Form definitions derived from create/edit actions
 *   - MUTATIONS.md  — Write operations grouped by CRUD category
 *   - schema.sql    — Draft SQL table with columns inferred from UI labels,
 *                     RLS policies, indexes, and updated_at trigger
 *   - README.md     — Overview with stats and next steps
 *
 * Environment variables:
 *   SUPABASE_URL              - Supabase project URL
 *   SUPABASE_SERVICE_ROLE_KEY - Supabase service role key
 *   PROCORE_MODULE            - Module name (e.g. "drawings", "scheduling")
 *   CRAWL_ROOT_DIR            - Root directory for crawl data (default: ./procore-crawls)
 *   CRAWL_DIR                 - Absolute path override for module directory
 *
 * Output:
 *   <MODULE_DIR>/spec/{COMMANDS.md, FORMS.md, MUTATIONS.md, schema.sql, README.md}
 *
 * Usage:
 *   PROCORE_MODULE=drawings node scripts/generate-procore-module-spec.js
 *   CRAWL_DIR=/abs/path PROCORE_MODULE=drawings node scripts/generate-procore-module-spec.js
 */
import fs from "fs-extra";
import path from "path";
import dotenv from "dotenv";
import { createClient } from "@supabase/supabase-js";

dotenv.config();

const {
  SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY,
  PROCORE_MODULE,
  CRAWL_ROOT_DIR = "./procore-crawls"
} = process.env;

if (!PROCORE_MODULE) {
  throw new Error("Missing PROCORE_MODULE env var (e.g. drawings, scheduling)");
}

const supabase = createClient(
  SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY
);

/**
 * Paths
 * CRAWL_DIR: absolute path override (new PRPs folder structure)
 * Falls back to CRAWL_ROOT_DIR + PROCORE_MODULE for backwards compatibility
 */
const MODULE_DIR = process.env.CRAWL_DIR || path.join(CRAWL_ROOT_DIR, PROCORE_MODULE);
const SPEC_DIR = path.join(MODULE_DIR, "spec");

await fs.ensureDir(SPEC_DIR);

// ─────────────────────────────────────────────
// Data Loading
// ─────────────────────────────────────────────

/**
 * Fetch system actions for this module from Supabase
 */
async function loadSystemActions() {
  const { data, error } = await supabase
    .from("app_system_actions")
    .select("*")
    .eq("affects_resource", PROCORE_MODULE)
    .order("label");

  if (error) throw error;
  return data || [];
}

/**
 * Fetch promoted domain commands (if any exist)
 */
async function loadCommands() {
  const { data, error } = await supabase
    .from("app_commands")
    .select("*")
    .eq("module", PROCORE_MODULE)
    .order("command_key");

  if (error) {
    console.warn("⚠️  Could not load app_commands (table may not exist):", error.message);
    return [];
  }
  return data || [];
}

// ─────────────────────────────────────────────
// Analysis Helpers
// ─────────────────────────────────────────────

/** Labels that are noise / not real UI actions */
const NOISE_PATTERNS = [
  /^:root\s/,
  /^\s*to\s*\n/,
  /^FiltersDiscipline/,
  /--viewport-width/,
  /--rowActions-width/,
  /^\d+See All/,
  /^Page\s/,
  /^of$/,
  /^Drag here/,
];

function isNoise(label) {
  if (!label || label.trim().length < 3) return true;
  if (label.length > 100) return true; // likely DOM dump, not a clean label
  return NOISE_PATTERNS.some(p => p.test(label.trim()));
}

/**
 * Classify actions into semantic groups:
 * - commands: button/menu actions that trigger behaviors (Upload, Export, Delete, etc.)
 * - columns: tab-detail labels that represent table columns (Drawing No., Status, etc.)
 * - tabs: navigation tabs
 */
function classifyActions(actions) {
  const commands = [];
  const columns = [];
  const tabs = [];

  const seen = new Set();

  for (const action of actions) {
    const label = action.label?.trim();
    if (!label || isNoise(label)) continue;
    if (seen.has(label)) continue;
    seen.add(label);

    if (action.source === "tab-detail" && action.trigger_type === "tab") {
      // Short labels from tab-detail are likely column headers
      if (label.length < 50 && !label.includes("\n")) {
        columns.push({ label, source: action.source });
      }
    } else if (action.source === "tab" && action.trigger_type === "tab") {
      tabs.push({ label, source: action.source });
    } else {
      commands.push({
        label,
        triggerType: action.trigger_type,
        source: action.source
      });
    }
  }

  return { commands, columns, tabs };
}

/**
 * Derive a command_key from a label (e.g. "Add Drawing Area" → "add_drawing_area")
 */
function toCommandKey(label) {
  return label
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, "")
    .replace(/\s+/g, "_")
    .substring(0, 50);
}

/**
 * Derive a SQL column name from a label (e.g. "Drawing No." → "drawing_no")
 */
function toColumnName(label) {
  return label
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, "")
    .trim()
    .replace(/\s+/g, "_")
    .substring(0, 50);
}

/**
 * Map column labels to likely SQL types
 */
function inferColumnType(label) {
  const lower = label.toLowerCase();
  if (lower.includes("date")) return "date";
  if (lower.includes("status")) return "text";
  if (lower.includes("revision") || lower.includes("rev")) return "text";
  if (lower.includes("no") || lower.includes("number") || lower.includes("#")) return "text";
  if (lower.includes("title") || lower.includes("name") || lower.includes("description")) return "text";
  if (lower.includes("set")) return "text";
  if (lower.includes("discipline") || lower.includes("category") || lower.includes("type")) return "text";
  if (lower.includes("percent") || lower.includes("progress")) return "int";
  if (lower.includes("amount") || lower.includes("cost") || lower.includes("total")) return "numeric(12,2)";
  if (lower.includes("count") || lower.includes("quantity") || lower.includes("qty")) return "int";
  return "text";
}

// ─────────────────────────────────────────────
// Generators
// ─────────────────────────────────────────────

const MODULE_UPPER = PROCORE_MODULE.toUpperCase();
const TABLE_NAME = `app_${PROCORE_MODULE.replace(/-/g, "_")}`;

/**
 * COMMANDS.md — All UI actions derived from crawl
 */
function generateCommandsMd(classified, promotedCommands) {
  let md = `# ${MODULE_UPPER} — Domain Commands\n\n`;
  md += `This file lists all UI actions derived from Procore crawl data for the **${PROCORE_MODULE}** module.\n\n`;

  // Section 1: Promoted commands (if any exist in app_commands)
  if (promotedCommands.length > 0) {
    md += `## Promoted Commands\n\n`;
    md += `These have been reviewed and promoted to canonical domain commands.\n\n`;
    md += `| Command Key | Label | Description | Action Count |\n`;
    md += `|------------|-------|-------------|--------------|\n`;
    for (const c of promotedCommands) {
      md += `| ${c.command_key} | ${c.label} | ${c.description || ""} | ${c.action_count || 0} |\n`;
    }
    md += `\n`;
  }

  // Section 2: Discovered actions from crawl
  md += `## Discovered Actions\n\n`;
  md += `Raw UI actions extracted from the Procore crawl. Review and promote to commands above.\n\n`;
  md += `| Action | Type | Source | Command Key |\n`;
  md += `|--------|------|--------|-------------|\n`;

  for (const cmd of classified.commands) {
    md += `| ${cmd.label} | ${cmd.triggerType} | ${cmd.source} | \`${toCommandKey(cmd.label)}\` |\n`;
  }

  md += `\n`;

  // Section 3: Tabs
  if (classified.tabs.length > 0) {
    md += `## Navigation Tabs\n\n`;
    md += `| Tab | Source |\n`;
    md += `|-----|--------|\n`;
    for (const tab of classified.tabs) {
      md += `| ${tab.label} | ${tab.source} |\n`;
    }
    md += `\n`;
  }

  // Section 4: Table Columns
  if (classified.columns.length > 0) {
    md += `## Table Columns (from UI)\n\n`;
    md += `Column headers discovered in the Procore data table:\n\n`;
    md += `| Column Label | SQL Name | Inferred Type |\n`;
    md += `|-------------|----------|---------------|\n`;
    for (const col of classified.columns) {
      md += `| ${col.label} | ${toColumnName(col.label)} | ${inferColumnType(col.label)} |\n`;
    }
    md += `\n`;
  }

  return md;
}

/**
 * FORMS.md — UI forms derived from action patterns
 */
function generateFormsMd(classified) {
  let md = `# ${MODULE_UPPER} — UI Forms\n\n`;
  md += `This document defines UI forms required to implement the ${PROCORE_MODULE} module.\n`;
  md += `Forms are derived from create/edit actions discovered in the Procore crawl.\n\n`;

  // Group commands into CRUD-like categories
  const createActions = classified.commands.filter(c =>
    /^(add|create|new|upload)/i.test(c.label)
  );
  const editActions = classified.commands.filter(c =>
    /^(edit|update|modify|rename)/i.test(c.label)
  );
  const otherActions = classified.commands.filter(c =>
    !(/^(add|create|new|upload|edit|update|modify|rename|delete|remove|export|filter|clear|hide|see|search|close)/i.test(c.label))
  );

  if (createActions.length > 0) {
    md += `## Create Forms\n\n`;
    for (const action of createActions) {
      md += `### ${action.label}\n\n`;
      md += `**Command:** \`${toCommandKey(action.label)}\`\n`;
      md += `**Trigger:** ${action.triggerType} (${action.source})\n\n`;
      md += `| Field | Label | Type | Required | Source Table | Notes |\n`;
      md += `|------|-------|------|----------|--------------|-------|\n`;
      // Pre-fill with discovered columns
      for (const col of classified.columns) {
        md += `| ${toColumnName(col.label)} | ${col.label} | ${inferColumnType(col.label)} | | ${TABLE_NAME} | |\n`;
      }
      md += `\n`;
    }
  }

  if (editActions.length > 0) {
    md += `## Edit Forms\n\n`;
    for (const action of editActions) {
      md += `### ${action.label}\n\n`;
      md += `**Command:** \`${toCommandKey(action.label)}\`\n`;
      md += `**Trigger:** ${action.triggerType} (${action.source})\n\n`;
      md += `| Field | Label | Type | Required | Source Table | Notes |\n`;
      md += `|------|-------|------|----------|--------------|-------|\n`;
      for (const col of classified.columns) {
        md += `| ${toColumnName(col.label)} | ${col.label} | ${inferColumnType(col.label)} | | ${TABLE_NAME} | |\n`;
      }
      md += `\n`;
    }
  }

  if (otherActions.length > 0) {
    md += `## Other Action Forms\n\n`;
    for (const action of otherActions) {
      md += `### ${action.label}\n\n`;
      md += `**Command:** \`${toCommandKey(action.label)}\`\n`;
      md += `**Trigger:** ${action.triggerType} (${action.source})\n\n`;
      md += `| Field | Label | Type | Required | Source Table | Notes |\n`;
      md += `|------|-------|------|----------|--------------|-------|\n`;
      md += `| | | | | | |\n\n`;
    }
  }

  return md;
}

/**
 * MUTATIONS.md — Write operations derived from action patterns
 */
function generateMutationsMd(classified) {
  let md = `# ${MODULE_UPPER} — Mutations\n\n`;
  md += `Write operations for the ${PROCORE_MODULE} module, derived from Procore UI actions.\n\n`;

  const mutations = [];

  for (const cmd of classified.commands) {
    const label = cmd.label.toLowerCase();

    let operation = "unknown";
    if (/^(add|create|new|upload|import)/.test(label)) operation = "CREATE";
    else if (/^(edit|update|modify|rename|save)/.test(label)) operation = "UPDATE";
    else if (/^(delete|remove|archive|recycle)/.test(label)) operation = "DELETE";
    else if (/^(export|download|print|pdf|csv)/.test(label)) operation = "READ (export)";
    else if (/^(filter|search|clear|hide|show|see|close)/.test(label)) operation = "UI (no mutation)";
    else if (/^(markup|sketches|measurements)/.test(label)) operation = "UPDATE (annotation)";
    else if (/^(reports)/.test(label)) operation = "READ (report)";
    else operation = "UNKNOWN — needs review";

    mutations.push({
      label: cmd.label,
      operation,
      commandKey: toCommandKey(cmd.label),
      triggerType: cmd.triggerType,
      source: cmd.source
    });
  }

  // Group by operation
  const grouped = {};
  for (const m of mutations) {
    if (!grouped[m.operation]) grouped[m.operation] = [];
    grouped[m.operation].push(m);
  }

  for (const [operation, items] of Object.entries(grouped)) {
    md += `## ${operation}\n\n`;
    md += `| Action | Command Key | Trigger | Source |\n`;
    md += `|--------|-------------|---------|--------|\n`;
    for (const item of items) {
      md += `| ${item.label} | \`${item.commandKey}\` | ${item.triggerType} | ${item.source} |\n`;
    }
    md += `\n`;
  }

  return md;
}

/**
 * schema.sql — Generated from discovered columns
 * Uses INTEGER for project_id (matches projects.id type)
 */
function generateSchemaSql(classified) {
  const cols = classified.columns
    .map(c => ({
      name: toColumnName(c.label),
      type: inferColumnType(c.label),
      label: c.label
    }))
    .filter(c => c.name.length > 0);

  // Deduplicate column names
  const seenCols = new Set();
  const uniqueCols = [];
  for (const col of cols) {
    if (!seenCols.has(col.name)) {
      seenCols.add(col.name);
      uniqueCols.push(col);
    }
  }

  let sql = `-- ${MODULE_UPPER} DOMAIN SCHEMA\n`;
  sql += `-- Auto-generated from Procore crawl data for module: ${PROCORE_MODULE}\n`;
  sql += `-- Review and adjust types/constraints before applying as a migration\n\n`;

  sql += `CREATE TABLE ${TABLE_NAME} (\n`;
  sql += `  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),\n`;
  sql += `  project_id integer NOT NULL REFERENCES projects(id),\n`;

  for (const col of uniqueCols) {
    // Skip columns that duplicate standard fields
    if (["id", "project_id", "created_at", "updated_at"].includes(col.name)) continue;
    sql += `  ${col.name} ${col.type}, -- ${col.label}\n`;
  }

  sql += `  created_by uuid REFERENCES auth.users(id),\n`;
  sql += `  updated_by uuid REFERENCES auth.users(id),\n`;
  sql += `  created_at timestamptz DEFAULT now(),\n`;
  sql += `  updated_at timestamptz DEFAULT now()\n`;
  sql += `);\n\n`;

  sql += `-- Index on project_id for RLS and queries\n`;
  sql += `CREATE INDEX idx_${TABLE_NAME}_project ON ${TABLE_NAME}(project_id);\n\n`;

  sql += `-- Enable RLS\n`;
  sql += `ALTER TABLE ${TABLE_NAME} ENABLE ROW LEVEL SECURITY;\n\n`;

  sql += `-- RLS policy: users can access rows for projects they belong to\n`;
  sql += `CREATE POLICY "${TABLE_NAME}_project_access" ON ${TABLE_NAME}\n`;
  sql += `  FOR ALL\n`;
  sql += `  USING (\n`;
  sql += `    project_id IN (\n`;
  sql += `      SELECT project_id FROM project_members WHERE user_id = auth.uid()\n`;
  sql += `    )\n`;
  sql += `  );\n\n`;

  sql += `-- updated_at trigger\n`;
  sql += `CREATE TRIGGER set_${TABLE_NAME}_updated_at\n`;
  sql += `  BEFORE UPDATE ON ${TABLE_NAME}\n`;
  sql += `  FOR EACH ROW\n`;
  sql += `  EXECUTE FUNCTION update_updated_at_column();\n`;

  return sql;
}

/**
 * README.md
 */
function generateReadme(classified, promotedCommands) {
  return `# ${MODULE_UPPER} Spec

This folder contains all generated specification artifacts for the
**${PROCORE_MODULE}** Procore module.

## Files

- \`COMMANDS.md\` — Domain command reference (${classified.commands.length} actions, ${promotedCommands.length} promoted)
- \`FORMS.md\` — UI form requirements
- \`MUTATIONS.md\` — Write operation catalog
- \`schema.sql\` — Database schema template (${classified.columns.length} columns derived from UI)

All files are auto-generated from \`app_system_actions\` data and safe to regenerate.

## Stats

- **UI Actions discovered:** ${classified.commands.length}
- **Table columns identified:** ${classified.columns.length}
- **Navigation tabs:** ${classified.tabs.length}
- **Promoted commands:** ${promotedCommands.length}

## Next Steps

1. Review COMMANDS.md — promote actions to canonical domain commands
2. Review schema.sql — adjust types, add constraints, add missing columns
3. Fill in FORMS.md — define field requirements for each form
4. Use MUTATIONS.md — plan API routes from write operations

For the comprehensive implementation plan, run \`/prp-create ${PROCORE_MODULE}\`
which generates a full PRP with HTML output at \`PRPs/${PROCORE_MODULE}/\`.
`;
}

// ─────────────────────────────────────────────
// Main
// ─────────────────────────────────────────────

(async function run() {
  console.log(`📘 Generating spec for module: ${PROCORE_MODULE}`);
  console.log(`   Output dir: ${SPEC_DIR}`);

  // Load data from Supabase
  const [systemActions, promotedCommands] = await Promise.all([
    loadSystemActions(),
    loadCommands()
  ]);

  console.log(`   System actions found: ${systemActions.length}`);
  console.log(`   Promoted commands: ${promotedCommands.length}`);

  if (systemActions.length === 0 && promotedCommands.length === 0) {
    console.error("❌ No data found. Run the ETL first:");
    console.error(`   PROCORE_MODULE=${PROCORE_MODULE} node etl_ingest_procore_crawl.js`);
    process.exit(1);
  }

  // Classify actions
  const classified = classifyActions(systemActions);
  console.log(`   Commands: ${classified.commands.length}`);
  console.log(`   Columns: ${classified.columns.length}`);
  console.log(`   Tabs: ${classified.tabs.length}`);

  // Generate all artifacts
  await Promise.all([
    fs.writeFile(
      path.join(SPEC_DIR, "COMMANDS.md"),
      generateCommandsMd(classified, promotedCommands)
    ),
    fs.writeFile(
      path.join(SPEC_DIR, "FORMS.md"),
      generateFormsMd(classified)
    ),
    fs.writeFile(
      path.join(SPEC_DIR, "MUTATIONS.md"),
      generateMutationsMd(classified)
    ),
    fs.writeFile(
      path.join(SPEC_DIR, "schema.sql"),
      generateSchemaSql(classified)
    ),
    fs.writeFile(
      path.join(SPEC_DIR, "README.md"),
      generateReadme(classified, promotedCommands)
    )
  ]);

  console.log("\n✅ Spec artifacts generated:");
  console.log(`   ${SPEC_DIR}/COMMANDS.md`);
  console.log(`   ${SPEC_DIR}/FORMS.md`);
  console.log(`   ${SPEC_DIR}/MUTATIONS.md`);
  console.log(`   ${SPEC_DIR}/schema.sql`);
  console.log(`   ${SPEC_DIR}/README.md`);
})();
