#!/usr/bin/env node
/**
 * Pre-commit guardrail: block staged Markdown that asserts a database TABLE
 * which does not exist in the generated Database["public"]["Tables"] union.
 *
 * Why this exists: the FK-validation docs (CLAUDE.md, .claude/rules/, and
 * docs/patterns/form-id-mismatch-prevention.md) drifted into naming tables
 * that do not exist (`vendors`, `project_cost_codes`). Those stale claims are
 * self-propagating — every agent session reads them and re-states the false
 * "mismatch" as fact. A doc that lies is a worse guardrail than no doc. This
 * makes a phantom table name in docs fail CI, exactly like `.from("phantom")`
 * fails in code.
 *
 * Scope (deliberately high-precision, low false-positive):
 *   Only flags a backticked identifier when the line gives a strong "this is a
 *   table" signal — either the token is dotted (`table.column`), or the line
 *   contains a table-context keyword (the word "table", "FK", "references",
 *   ".from(") — AND the token is not a column (`*_id`), not negated on the line
 *   ("no `vendors` table", "does not exist"), and not a known RAG/system table.
 *
 * Scans only ADDED lines in staged Markdown, so the existing doc corpus is not
 * retroactively flagged — only new or changed claims.
 *
 * Run: `node scripts/audits/check-no-phantom-doc-tables.mjs --staged`
 *      `node scripts/audits/check-no-phantom-doc-tables.mjs --base origin/main`
 */

import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const REPO_ROOT = join(import.meta.dirname, "..", "..");
const TYPES_PATH = join(REPO_ROOT, "frontend/src/types/database.types.ts");
const MD_EXT = /\.mdx?$/;
// This guard polices live Alleato DB-fact docs (e.g. docs/ops/patterns/*). It
// must NOT scan archived docs or BMAD planning/research artifacts, which legitimately
// reference external-repo source filenames (`grammar.ts`, `payload.ts`) and
// generic code words (`fetch`, `agent`) — none of which are Alleato table
// assertions. Scanning them produces only false positives.
// PROJECT-MAP.md is auto-generated from the filesystem (npm run map:project).
// It references AI-tool source filenames (`financial.ts`, `marketing.ts`) that
// look like table names but are not — and being generated, it cannot carry a
// human-authored phantom-table claim anyway.
// docs/migrate/ holds migrated overview/reference docs (same category as
// docs/archive/) and docs/ops/tasks/ + docs/ops/evidence/ are process/run logs,
// not authoritative DB-fact docs — they legitimately quote shell commands,
// usernames, FK constraint names, and lifecycle values that trip false positives.
// docs/patterns/ is the retrospective error-pattern archive (restored 2026-07-02
// after the docs purge): its files quote example snippets (`.from("table")`,
// `.from("xxx")`), trigger-word lists, and commit hashes that are never live
// table assertions — same false-positive category as docs/archive/.
// docs/design/entity-relationships/ is a Phase-2 schema PROPOSAL folder — it
// discusses link tables that do not exist yet by design (that's the point of
// the proposal). docs/architecture/_audit/ holds one-time investigation output
// (same category as a report, not a maintained DB-fact doc). docs/architecture/memory/
// holds unrelated personal/voice-profile content that has nothing to do with
// the database schema.
const IGNORE_PATH_RE =
  /(^|\/)_bmad-output\/|(^|\/)docs\/archive\/|(^|\/)docs\/migrate\/|(^|\/)docs\/patterns\/|(^|\/)docs\/ops\/(tasks|evidence)\/|(^|\/)docs\/architecture\/PROJECT-MAP\.md$|(^|\/)docs\/design\/entity-relationships\/|(^|\/)docs\/architecture\/_audit\/|(^|\/)docs\/architecture\/memory\//;

const args = new Set(process.argv.slice(2));
const baseFlagIdx = process.argv.indexOf("--base");
const baseRef =
  baseFlagIdx >= 0
    ? process.argv[baseFlagIdx + 1]
    : process.env.GUARDRAIL_BASE_REF || "origin/main";
const mode = args.has("--staged") ? "staged" : "changed";

// Tables that legitimately exist but are NOT in the PM-app database.types.ts:
//   - RAG tables live in the AI Database project (see CLAUDE.md "Two Supabase Projects")
//   - system / cross-schema tables
const KNOWN_EXTERNAL_TABLES = new Set([
  "document_chunk_retrieval_stats",
  "document_chunk_retrieval_telemetry",
  "document_chunks",
  "graph_subscriptions",
  "graph_sync_state",
  "packet_refresh_jobs",
  "pipeline_model_usage",
  "rag_document_metadata",
  "rag_pipeline_state",
  "source_intelligence_jobs",
  "source_processing_jobs",
  "source_signal_candidates",
  "outlook_email_intake",
  "source_syntheses",
  "project_daily_deltas",
  "supabase_migrations",
  // AI Database (RAG DB) tables — not in app database.types.ts
  "company_knowledge",
  "source_sync_health_snapshots",
  // App-DB tables referenced in docs but missing from types (may be views or AI-DB)
  "ai_insights",
  "insights",
  "source_documents",
]);
const EXTERNAL_PREFIXES = ["information_schema", "pg_", "auth_", "storage_"];

// Words that look like snake_case identifiers but are never table names.
const NON_TABLE_WORDS = new Set([
  "lifecycle_stage",
  "public",
  "auth",
  "storage",
  "graphql_public",
  "rag",
  "id",
  "supabase",
  "client",
  "db",
  "ctx",
  "data",
  "fqcvmfqldlewvbsuxdvz",
  "projection_status",
  "projection_payload",
  "projection_error",
  "projection_attempt_count",
  "projected_at",
  "hybrid_score",
  "last_recalled_at",
  "match_count",
  "match_threshold",
  "query_embedding",
  "query_text",
  "ranking_mode",
  "ranking_mode_used",
  "recall_score",
  "recency_score",
  "score_components",
  "search_document_chunks",
  "telemetry_enabled",
  "text_score",
  "trace_id",
  "vector_score",
  "captured",
  "project_assigned",
  "project_assignment_review",
  "text_extracted",
  "indexed_for_rag",
  "signals_extracted",
  "project_intelligence_updated",
  "actions_routed",
  "complete",
  "failed_retryable",
  "failed_permanent",
  "skipped_unchanged",
  "attribution",
  "attribution_rule",
  "confidence_notes",
  "executive_summary",
  "source_coverage",
  "project_daily_delta",
  "find",
  "rg",
  "du",
  // Python module/class/function names referenced in AI-RAG-ARCHITECTURE.md
  "teams_compiler",
  "email_compiler",
  "retry_ai_call",
  // PostgreSQL index types and schema names
  "ivfflat",
  "private",
  // Source-type string values (not table names)
  "email",
  "onedrive_document",
  "microsoft_graph_live",
  // RPC function names (not tables)
  "search_all_knowledge",
  "search_knowledge_base",
  // AI agent tool names (not tables) — referenced in agent prompt markdown
  "query_db",
  "describe_schema",
  // Status/metadata value strings
  "warning",
  "unfetchable_pending",
  "error",
  "metadata",
  "chunks",
  "next_action",
  // Vercel AI SDK option names
  "experimental_telemetry",
  // Column names (JSON fields), not table names
  "risks",
  "decisions",
  "source",
  "source_type",
  "project_name",
  "is_admin",
  "external_key",
  "document_type",
  "applies_to",
  // TanStack column-config field referenced in docs/design/table-system.md
  "meta",
  // event-handler variable in code snippets (`e.target.value`), never a table
  "e",
  // Supabase project ref (PM APP) — id, not a table (RAG ref already listed above)
  "lgveqfnpkxvzbnnwuled",
  // AI assistant tool/RPC/widget names, not tables (docs/architecture/AI-ASSISTANT-*.md)
  "app_help",
  "lookup_app_route",
  "task_summary",
  "source_evidence",
  // Video artifact filename in docs/architecture/DOCS-OPERATING-MODEL.md
  "session",
  // UI row-height token name in docs/design/tokens.md ("Default for all [UI] tables")
  "standard",
]);

function run(cmd) {
  try {
    return execSync(cmd, { stdio: ["ignore", "pipe", "pipe"] })
      .toString()
      .trimEnd();
  } catch {
    return "";
  }
}

// Reuse the same parsing contract as check-no-new-phantom-tables.mjs: anchor to
// the `public:` schema, collect Tables keys + Views keys.
function loadTableUnion() {
  const src = readFileSync(TYPES_PATH, "utf8");
  const publicSchemaMatch = src.match(/\bpublic\s*:\s*\{([\s\S]*?)^\s{2}\}/m);
  const publicSrc = publicSchemaMatch ? publicSchemaMatch[1] : src;
  const tablesMatch = publicSrc.match(/Tables:\s*\{([\s\S]*?)\n\s*Views:/);
  if (!tablesMatch) {
    console.error("Could not parse Tables union from database.types.ts");
    process.exit(2);
  }
  const tableNames = new Set();
  const keyRe = /^      ([a-zA-Z_][a-zA-Z0-9_]*):\s*\{/gm;
  let m;
  while ((m = keyRe.exec(tablesMatch[1]))) tableNames.add(m[1]);
  const viewsMatch = src.match(/Views:\s*\{([\s\S]*?)\n\s*Functions:/);
  if (viewsMatch) {
    let v;
    while ((v = keyRe.exec(viewsMatch[1]))) tableNames.add(v[1]);
  }
  return tableNames;
}

function getFiles() {
  const out =
    mode === "staged"
      ? run("git diff --cached --name-only --diff-filter=ACMR")
      : run(`git diff --name-only ${baseRef}...HEAD --diff-filter=ACMR`);
  if (!out) return [];
  return out
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean)
    .filter((p) => MD_EXT.test(p))
    .filter((p) => !IGNORE_PATH_RE.test(p));
}

function getAddedLines(path) {
  const cmd =
    mode === "staged"
      ? `git diff --cached --unified=0 -- "${path}"`
      : `git diff --unified=0 ${baseRef}...HEAD -- "${path}"`;
  const diff = run(cmd);
  if (!diff) return [];
  const added = [];
  let lineNum = 0;
  for (const raw of diff.split("\n")) {
    const hunk = raw.match(/^@@ -\d+(?:,\d+)? \+(\d+)(?:,\d+)? @@/);
    if (hunk) {
      lineNum = parseInt(hunk[1], 10);
      continue;
    }
    if (raw.startsWith("+++")) continue;
    if (raw.startsWith("+")) {
      added.push({ line: lineNum, content: raw.slice(1) });
      lineNum += 1;
    } else if (!raw.startsWith("-")) {
      lineNum += 1;
    }
  }
  return added;
}

// A line is "negated" when it talks about a table NOT existing — those lines
// legitimately name phantom tables (e.g. "there is no `vendors` table").
const NEGATION_RE =
  /\b(no|not|never|none|phantom|nonexistent|non-existent|removed|dropped|deleted|legacy|no longer)\b|does ?n[o']?t exist|do(es)? not exist/i;

const TABLE_CONTEXT_RE = /\btables?\b|\bFK\b|\breferences?\b|dropdown|\bsource\b|\bstored?\b|\bquer(y|ies)\b|\.from\(/i;
const BACKTICK_RE = /`([^`]+)`/g;
const FROM_RE = /\.from\(\s*['"]([a-zA-Z_][a-zA-Z0-9_]*)['"]\s*\)/g;
const IDENT_RE = /^[a-z][a-z0-9_]*$/;

// On FK-doc lines, table names are often written bare after an arrow
// ("FK→budget_lines, dropdown→project_cost_codes"). Catch those targets too,
// but ONLY on lines clearly about FK/dropdown wiring to keep false positives
// near zero (other docs use → for flow diagrams).
// Tight arrow only (no spaces) — this is the FK-shorthand convention
// ("FK→budget_lines", "dropdown→project_cost_codes") that hid phantom names.
// Spaced arrows ("dropdown → returns ...") are prose and are left alone.
const ARROW_LINE_RE = /\bFK\b|dropdown/i;
const ARROW_TARGET_RE = /(?:→|->)`?([a-z][a-z0-9_]+)`?/g;

function isExternal(name) {
  if (KNOWN_EXTERNAL_TABLES.has(name)) return true;
  return EXTERNAL_PREFIXES.some((p) => name.startsWith(p));
}

// File extensions — dotted tokens whose last segment is one of these are
// filenames (e.g. `outlook.py`, `render.yaml`), not table.column references.
const FILE_EXTENSIONS = new Set([
  "py", "js", "ts", "tsx", "jsx", "mjs", "cjs",
  "yaml", "yml", "json", "toml", "md", "mdx",
  "sh", "bash", "zsh", "fish",
  "html", "css", "scss", "sql", "txt", "env",
]);

// Decide whether `raw` (the content inside backticks) is a table-existence
// claim, and if so return the candidate table name; otherwise null.
const CLEAN_DOTTED_RE = /^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]+)+$/;

function tableCandidate(raw, lineHasContext) {
  const token = raw.trim();
  const dotted = token.includes(".");
  // For dotted tokens, only accept a clean `table.column` (or `a.b.c`) path —
  // not a method chain like `supabase.from("rfis").update(...)`, where the
  // prefix is a client variable, not a table. The .from() scan handles those.
  if (dotted && !CLEAN_DOTTED_RE.test(token)) return null;
  // Reject filenames: `outlook.py`, `render.yaml`, `tools.py`, etc.
  if (dotted) {
    const lastSegment = token.split(".").pop();
    if (FILE_EXTENSIONS.has(lastSegment)) return null;
  }
  // Take the part before the first dot as the table (e.g. `companies.id`).
  const tablePart = dotted ? token.split(".")[0] : token;
  if (!IDENT_RE.test(tablePart)) return null; // not a bare snake_case identifier
  if (tablePart.endsWith("_id")) return null; // it's a column, not a table
  if (NON_TABLE_WORDS.has(tablePart)) return null;
  // Strong signal: dotted form is table.column. Otherwise require line context.
  if (!dotted && !lineHasContext) return null;
  return tablePart;
}

function main() {
  const files = getFiles();
  if (files.length === 0) {
    console.log(`No ${mode} Markdown files to scan for phantom tables.`);
    process.exit(0);
  }

  const tables = loadTableUnion();
  if (tables.size === 0) {
    console.error("Parsed 0 tables from database.types.ts — refusing to run guard.");
    process.exit(2);
  }

  const violations = [];
  for (const file of files) {
    for (const { line, content } of getAddedLines(file)) {
      if (NEGATION_RE.test(content)) continue; // "no X table" / "X does not exist"
      const lineHasContext = TABLE_CONTEXT_RE.test(content);
      const seen = new Set();

      // 1. .from("X") code examples inside docs — always a table claim.
      let f;
      FROM_RE.lastIndex = 0;
      while ((f = FROM_RE.exec(content))) {
        const name = f[1];
        if (tables.has(name) || isExternal(name) || seen.has(name)) continue;
        seen.add(name);
        violations.push({ file, line, name, content: content.trim() });
      }

      // 2. Backticked identifiers with a table-existence signal.
      let b;
      BACKTICK_RE.lastIndex = 0;
      while ((b = BACKTICK_RE.exec(content))) {
        const name = tableCandidate(b[1], lineHasContext);
        if (!name) continue;
        if (tables.has(name) || isExternal(name) || seen.has(name)) continue;
        seen.add(name);
        violations.push({ file, line, name, content: content.trim() });
      }

      // 3. Bare arrow targets on FK/dropdown wiring lines.
      if (ARROW_LINE_RE.test(content)) {
        let a;
        ARROW_TARGET_RE.lastIndex = 0;
        while ((a = ARROW_TARGET_RE.exec(content))) {
          const name = a[1];
          if (name.endsWith("_id") || NON_TABLE_WORDS.has(name)) continue;
          if (tables.has(name) || isExternal(name) || seen.has(name)) continue;
          seen.add(name);
          violations.push({ file, line, name, content: content.trim() });
        }
      }
    }
  }

  if (violations.length === 0) {
    console.log(`No new phantom-table claims in ${mode} Markdown.`);
    process.exit(0);
  }

  console.error("");
  console.error("ERROR: Markdown asserts tables that are not in database.types.ts:");
  console.error("");
  for (const v of violations) {
    console.error(`  ${v.file}:${v.line}  →  "${v.name}"`);
    console.error(`    + ${v.content}`);
  }
  console.error("");
  console.error("Fix options:");
  console.error("  1. Use the correct table name (check frontend/src/types/database.types.ts)");
  console.error("  2. If the table genuinely exists, run `npm run db:types` to refresh types");
  console.error("  3. If you are documenting that a table does NOT exist, phrase it as such");
  console.error('     (e.g. "there is no `foo` table") — negated lines are allowed');
  console.error("  4. RAG/AI-DB tables: add to KNOWN_EXTERNAL_TABLES in this script");
  console.error("");
  process.exit(1);
}

main();
