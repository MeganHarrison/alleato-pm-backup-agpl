#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

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

function sectionCount(title, source) {
  const match = source.match(new RegExp(`^## ${title} \\((\\d+)\\)$`, "m"));
  return match ? Number(match[1]) : 0;
}

function loadSources() {
  const projectMap = required(path.join(docsRoot, "PROJECT-MAP.md"));
  required(path.join(docsRoot, "TABLE-LIST.md"));
  const parsedTables = yaml.load(required(path.join(docsRoot, "tables.yaml")));
  const tables = Array.isArray(parsedTables?.tables) ? parsedTables.tables : [];
  return {
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
    purpose:
      "Navigation index for AI agents. Detailed inventories remain authoritative in their source files.",
    generatedBy: "npm run map:system",
    layers: [
      {
        id: "rules",
        owner: "AGENTS.md",
        role: "Repository rules, verification gates, and ownership boundaries.",
      },
      {
        id: "domain",
        owner: "CONTEXT.md",
        role: "Canonical domain vocabulary and invariants.",
      },
      {
        id: "runtime",
        owner: "docs/architecture/ALLEATO-SYSTEM-MAP.md",
        role: "Frontend, backend, Supabase, and AI runtime boundaries.",
      },
      {
        id: "surface",
        owner: "docs/architecture/PROJECT-MAP.md",
        role: "Generated pages, APIs, and AI tools.",
      },
      {
        id: "database",
        owner: "docs/architecture/tables.yaml",
        role: "Curated table meaning, ownership, gotchas, and relationships.",
      },
      {
        id: "database-generated",
        owner: "docs/architecture/TABLE-LIST.md",
        role: "Generated live database inventory and schema facts.",
      },
      {
        id: "guide",
        owner: "docs/architecture/AI-READABLE-CODEBASE.md",
        role: "How agents load context and how maintainers update it.",
      },
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
  const layers = manifest.layers
    .map((layer) => `- \`${layer.owner}\` — ${layer.role}`)
    .join("\n");
  const commands = manifest.commands
    .map((command) => `- \`${command}\``)
    .join("\n");
  return `# System Map

> **AUTO-GENERATED — do not edit by hand.** Regenerate with \`npm run map:system\`.
> This is the navigation index for fresh AI sessions; detailed facts remain in the linked source files.

## What an AI agent reads

1. \`AGENTS.md\` for rules, safety, ownership, and verification gates.
2. \`CONTEXT.md\` for domain vocabulary and invariants.
3. \`docs/architecture/AI-READABLE-CODEBASE.md\` for the loading strategy and maintenance commands.
4. This map to choose the relevant runtime and detailed inventory.
5. The smallest relevant route, service, module, migration, test, and evidence artifact.

## Current surface counts

| Surface | Count | Detailed owner |
| --- | ---: | --- |
| UI/API surface rows | ${c.routes} | \`docs/architecture/PROJECT-MAP.md\` |
| API endpoint sections | ${c.apiEndpoints} | \`docs/architecture/PROJECT-MAP.md\` |
| AI tool rows | ${c.aiTools} | \`docs/architecture/PROJECT-MAP.md\` |
| Database metadata entries | ${c.tables} | \`docs/architecture/tables.yaml\` |
| Main database entries | ${c.mainTables} | \`docs/architecture/tables.yaml\` |
| RAG database entries | ${c.ragTables} | \`docs/architecture/tables.yaml\` |

## Runtime ownership

| Work | Canonical owner |
| --- | --- |
| User-facing pages, forms, tables, and app API routes | \`frontend/src/app/**\`, \`frontend/src/components/**\`, \`frontend/src/features/**\` |
| Product AI reasoning and skill selection | \`agents/alleato-assistant/**\` |
| Product AI transport and authenticated tools | \`frontend/src/app/api/ai-assistant/eve/**\`, \`frontend/src/lib/ai/eve-runtime/**\` |
| Ingestion, Graph, Fireflies, OCR, embeddings, and scheduled processing | \`backend/src/services/**\` on Render |
| Schema, RLS, RPCs, and migrations | \`supabase/migrations/**\` plus generated DB types |

## Source index

${layers}

## Update contract

- Change a route, API route, or AI tool: run \`npm run map:project\`.
- Change table meaning, ownership, gotchas, or relationships: edit \`docs/architecture/tables.yaml\`, then run \`npm run db:inventory\`.
- Change a migration or database shape: run \`npm run db:types\`, inspect generated types, and run the migration ledger verification required by \`AGENTS.md\`.
- Change runtime ownership or domain meaning: update \`ALLEATO-SYSTEM-MAP.md\` or \`CONTEXT.md\` directly.
- After all changes: run \`npm run map:system\` and \`npm run map:system -- --check-only\`.

## Generated commands

${commands}
`;
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
      "SYSTEM MAP GATE — generated artifacts are stale.\n" +
        "Run: npm run map:system\n" +
        "Then: npm run map:system -- --check-only",
    );
    process.exit(1);
  }
  console.log("System map is current.");
  process.exit(0);
}

fs.mkdirSync(path.dirname(jsonOutput), { recursive: true });
fs.writeFileSync(output, markdown);
fs.writeFileSync(jsonOutput, json);
console.log(`Wrote ${rel(output)} + ${rel(jsonOutput)}`);
