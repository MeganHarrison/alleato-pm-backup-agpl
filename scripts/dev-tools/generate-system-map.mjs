#!/usr/bin/env node

/**
 * Generate the cross-layer architecture index used by fresh AI sessions.
 *
 * This deliberately composes existing inventories instead of reimplementing
 * route or database discovery. PROJECT-MAP.md and TABLE-LIST.md remain the
 * detailed owners; this file is the navigation layer between them.
 *
 * Usage:
 *   npm run map:system
 *   npm run map:system -- --check-only
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const yaml = require("js-yaml");
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const docsRoot = path.join(root, "docs", "architecture");
const output = path.join(docsRoot, "SYSTEM-MAP.md");
const jsonOutput = path.join(docsRoot, "generated", "system-map.json");
const checkOnly = process.argv.includes("--check-only");

const read = (file) => fs.readFileSync(file, "utf8");
const exists = (file) => fs.existsSync(file);
const rel = (file) => path.relative(root, file).replaceAll(path.sep, "/");

function required(file) {
  if (!exists(file)) throw new Error(`Required source is missing: ${rel(file)}`);
  return read(file);
}

function count(pattern, source) {
  return source.match(pattern)?.length ?? 0;
}

function sectionCount(title, source) {
  const match = source.match(new RegExp(`^## ${title} \\((\\d+)\\)$`, "m"));
  return match ? Number(match[1]) : 0;
}

function loadSources() {
  const projectMap = required(path.join(docsRoot, "PROJECT-MAP.md"));
  const tableList = required(path.join(docsRoot, "TABLE-LIST.md"));
  const tableYaml = required(path.join(docsRoot, "tables.yaml"));
  const parsedTables = yaml.load(tableYaml);
  const tables = Array.isArray(parsedTables?.tables) ? parsedTables.tables : [];
  return {
    projectMap,
    tableList,
    tables,
    counts: {
      routes: sectionCount("UI Routes", projectMap),
      apiEndpoints: sectionCount("API Endpoints", projectMap),
      aiTools: sectionCount("AI Tools", projectMap),
      tables: tables.length,
      mainTables: tables.filter((table) => table.db === "MAIN").length,
      ragTables: tables.filter((table) => table.db === "RAG").length,
    },
  };
}

function buildManifest(sources) {
  return {
    version: 1,
    purpose: "Navigation index for AI agents. Detailed inventories remain authoritative in their source files.",
    generatedBy: "npm run map:system",
    layers: [
      { id: "rules", owner: "AGENTS.md", role: "Repository rules, verification gates, and ownership boundaries." },
      { id: "domain", owner: "CONTEXT.md", role: "Canonical domain vocabulary and invariants." },
      { id: "runtime", owner: "docs/architecture/ALLEATO-SYSTEM-MAP.md", role: "Frontend, backend, Supabase, and AI runtime boundaries." },
      { id: "surface", owner: "docs/architecture/PROJECT-MAP.md", role: "Generated pages, APIs, and AI tools." },
      { id: "database", owner: "docs/architecture/tables.yaml", role: "Curated table meaning, ownership, gotchas, and relationships." },
      { id: "database-generated", owner: "docs/architecture/TABLE-LIST.md", role: "Generated live database inventory and schema facts." },
      { id: "guide", owner: "docs/architecture/AI-READABLE-CODEBASE.md", role: "How agents load context and how maintainers update it." },
    ],
    counts: sources.counts,
    commands: [
      "npm run map:project",
      "npm run db:inventory",
      "npm run map:system",
      "npm run map:system -- --check-only",
      "npm run db:types",
      "npm run db:types:check",
      "npm run check:routes",
    ],
  };
}

function buildMarkdown(manifest) {
  const c = manifest.counts;
  return `# System Map\n\n> **AUTO-GENERATED — do not edit by hand.** Regenerate with \`npm run map:system\`.\n> This is the navigation index for fresh AI sessions; detailed facts remain in the linked source files.\n\n## What an AI agent reads\n\n1. \`AGENTS.md\` for rules, safety, ownership, and verification gates.\n2. \`CONTEXT.md\` for domain vocabulary and invariants.\n3. \`docs/architecture/AI-READABLE-CODEBASE.md\` for the loading strategy and maintenance commands.\n4. This map to choose the relevant runtime and detailed inventory.\n5. The smallest relevant route, service, module, migration, test, and evidence artifact.\n\n## Current surface counts\n\n| Surface | Count | Detailed owner |\n| --- | ---: | --- |\n| UI/API surface rows | ${c.routes} | \`docs/architecture/PROJECT-MAP.md\` |\n| API endpoint sections | ${c.apiEndpoints} | \`docs/architecture/PROJECT-MAP.md\` |\n| AI tool rows | ${c.aiTools} | \`docs/architecture/PROJECT-MAP.md\` |\n| Database metadata entries | ${c.tables} | \`docs/architecture/tables.yaml\` |\n| Main database entries | ${c.mainTables} | \`docs/architecture/tables.yaml\` |\n| RAG database entries | ${c.ragTables} | \`docs/architecture/tables.yaml\` |\n\n## Runtime ownership\n\n| Work | Canonical owner |\n| --- | --- |\n| User-facing pages, forms, tables, and app API routes | \`frontend/src/app/**\`, \`frontend/src/components/**\`, \`frontend/src/features/**\` |\n| Product AI chat, streaming, tools, retrieval, and confirmation | \`frontend/src/app/api/ai-assistant/chat/**\`, \`frontend/src/lib/ai/**\` |\n| Ingestion, Graph, Fireflies, OCR, embeddings, and scheduled processing | \`backend/src/services/**\` on Render |\n| Schema, RLS, RPCs, and migrations | \`supabase/migrations/**\` plus generated DB types |\n| Standalone agents | \`agents/**\` |\n\n## Source index\n\n${manifest.layers.map((layer) => `- \`${layer.owner}\` — ${layer.role}`).join("\n")}\n\n## Update contract\n\n- Change a route, API route, or AI tool: run \`npm run map:project\`.\n- Change table meaning, ownership, gotchas, or relationships: edit \`docs/architecture/tables.yaml\`, then run \`npm run db:inventory\`.\n- Change a migration or database shape: run \`npm run db:types\`, inspect generated types, and run the migration ledger verification required by \`AGENTS.md\`.\n- Change runtime ownership or domain meaning: update \`ALLEATO-SYSTEM-MAP.md\` or \`CONTEXT.md\` directly.\n- After all changes: run \`npm run map:system\` and \`npm run map:system -- --check-only\`.\n\n## Generated commands\n\n${manifest.commands.map((command) => `- \`${command}\``).join("\n")}\n`;
}

const sources = loadSources();
const manifest = buildManifest(sources);
const markdown = buildMarkdown(manifest);
const json = `${JSON.stringify(manifest, null, 2)}\n`;

if (checkOnly) {
  const markdownCurrent = exists(output) && read(output) === markdown;
  const jsonCurrent = exists(jsonOutput) && read(jsonOutput) === json;
  if (!markdownCurrent || !jsonCurrent) {
    console.error(
      "❌ SYSTEM MAP GATE — generated artifacts are stale.\n" +
        "   Run: npm run map:system\n" +
        "   Then: npm run map:system -- --check-only",
    );
    process.exit(1);
  }
  console.log("✅ System map is current.");
  process.exit(0);
}

fs.mkdirSync(path.dirname(jsonOutput), { recursive: true });
fs.writeFileSync(output, markdown);
fs.writeFileSync(jsonOutput, json);
console.log(`✅ Wrote ${rel(output)} + ${rel(jsonOutput)}`);
