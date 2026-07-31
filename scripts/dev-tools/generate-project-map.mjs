#!/usr/bin/env node

/**
 * Project Map Generator
 *
 * Produces an agent-readable inventory of the app's surfaces — the thing every
 * fresh AI session is missing. Purely derived from the filesystem, so it is
 * always accurate when regenerated.
 *
 * Scans:
 *   1. frontend/src/app/**\/page.tsx   — every UI route (URL ← file)
 *   2. frontend/src/app/api/**\/route.ts — every API endpoint + HTTP methods
 *   3. frontend/src/lib/ai/tools/*.ts  — every AI tool name + description
 *
 * Output: docs/architecture/PROJECT-MAP.md
 *
 * Usage:
 *   npm run map:project              — regenerate the map
 *   npm run map:project -- --check-only  — fail if the committed map is stale (CI/pre-commit gate)
 */

import {
  readFileSync,
  writeFileSync,
  readdirSync,
  statSync,
  existsSync,
  mkdirSync,
} from "node:fs";
import { join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";

// Generated output must be identical across platforms: always emit
// forward-slash paths so a map regenerated on Windows matches CI.
const relPosix = (from, to) => relative(from, to).split(sep).join("/");

const ROOT = join(fileURLToPath(import.meta.url), "..", "..", "..");
const APP_DIR = join(ROOT, "frontend", "src", "app");
const TOOLS_DIR = join(ROOT, "frontend", "src", "lib", "ai", "tools");
const OUTPUT = join(ROOT, "docs", "architecture", "PROJECT-MAP.md");
// Machine-readable index — lives OUTSIDE lib/ai/ so regenerating it does not
// trip the RAG-docs pre-commit gate. Consumed by the in-app findAppPage tool.
const INDEX_DIR = join(ROOT, "frontend", "src", "lib", "app-surface");
const INDEX_JSON = join(INDEX_DIR, "app-surface.generated.json");
// Curated index-only descriptions for pages without a (visible) PageShell
// description. A page's own PageShell description always wins over this.
const SIDECAR = join(INDEX_DIR, "page-descriptions.json");
const NONPROD_ROUTE_MANIFEST = join(
  ROOT,
  "frontend",
  "scripts",
  "build",
  "nonprod-routes.json",
);

function loadSidecar() {
  if (!existsSync(SIDECAR)) return {};
  try {
    return JSON.parse(readFileSync(SIDECAR, "utf8")).descriptions ?? {};
  } catch {
    return {};
  }
}
const SIDECAR_DESCRIPTIONS = loadSidecar();

function loadNonprodRouteFiles() {
  if (!existsSync(NONPROD_ROUTE_MANIFEST)) return new Set();
  const manifest = JSON.parse(readFileSync(NONPROD_ROUTE_MANIFEST, "utf8"));
  return new Set(
    (manifest.files ?? []).map((file) => `frontend/${file}`),
  );
}
const NONPROD_ROUTE_FILES = loadNonprodRouteFiles();

const CHECK_ONLY = process.argv.includes("--check-only");

const HTTP_METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"];

// Extract a JSX/string attribute value: title="..." or title={`...`}.
// Returns null for dynamic values (template literals with ${...} interpolation),
// which can't be statically captured.
function extractAttr(src, attr) {
  // attr="double quoted"
  let m = src.match(new RegExp(`\\b${attr}=\\s*"((?:\\\\.|[^"\\\\])*)"`));
  if (m) return m[1].replace(/\\"/g, '"').replace(/\s+/g, " ").trim();
  // attr={`backtick`} — only when there is no interpolation
  m = src.match(new RegExp(`\\b${attr}=\\s*\\{\\s*\`([^\`$]*)\`\\s*\\}`));
  if (m) return m[1].replace(/\s+/g, " ").trim();
  return null;
}

// ── filesystem walk ──────────────────────────────────────────────
function walk(dir, predicate, acc = []) {
  if (!existsSync(dir)) return acc;
  for (const name of readdirSync(dir)) {
    if (name === "node_modules" || name === ".next") continue;
    const full = join(dir, name);
    const st = statSync(full);
    if (st.isDirectory()) walk(full, predicate, acc);
    else if (predicate(full)) acc.push(full);
  }
  return acc;
}

// ── URL derivation ───────────────────────────────────────────────
// Strip route groups "(x)", drop the trailing file, keep [params].
function fileToUrl(absPath, kind) {
  const rel = relative(APP_DIR, absPath).split(sep);
  rel.pop(); // remove page.tsx / route.ts
  const segments = rel.filter((s) => !(s.startsWith("(") && s.endsWith(")")));
  let url = "/" + segments.join("/");
  if (url === "/" && kind === "api") url = "/api";
  return url === "" ? "/" : url;
}

// ── API method extraction ────────────────────────────────────────
function extractMethods(absPath) {
  const src = readFileSync(absPath, "utf8");
  const found = new Set();
  for (const m of HTTP_METHODS) {
    const re = new RegExp(`export\\s+(?:async\\s+function|const)\\s+${m}\\b`);
    if (re.test(src)) found.add(m);
  }
  return [...found];
}

// ── AI tool extraction ───────────────────────────────────────────
// Tools are object keys defined as `name: tool({ description: "..." })`.
function extractTools(absPath) {
  const src = readFileSync(absPath, "utf8");
  const tools = [];
  const keyRe = /(^|\n)[ \t]*([a-zA-Z][a-zA-Z0-9_]*)\s*:\s*tool\(\{/g;
  let match;
  while ((match = keyRe.exec(src)) !== null) {
    const name = match[2];
    const after = src.slice(match.index, match.index + 4000);
    const description = extractDescription(after);
    tools.push({ name, description });
  }
  return tools;
}

// Capture the value of the first `description:` — handles "..", '..', `..`,
// and "a" + "b" concatenation across lines.
function extractDescription(chunk) {
  const idx = chunk.indexOf("description:");
  if (idx === -1) return "";
  let i = idx + "description:".length;
  const parts = [];
  while (i < chunk.length) {
    while (i < chunk.length && /\s/.test(chunk[i])) i++;
    const q = chunk[i];
    if (q !== '"' && q !== "'" && q !== "`") break;
    i++;
    let buf = "";
    while (i < chunk.length && chunk[i] !== q) {
      if (chunk[i] === "\\") {
        buf += chunk[i + 1] === "n" ? " " : chunk[i + 1] ?? "";
        i += 2;
      } else {
        buf += chunk[i];
        i++;
      }
    }
    i++; // closing quote
    parts.push(buf);
    while (i < chunk.length && /\s/.test(chunk[i])) i++;
    if (chunk[i] === "+") {
      i++;
      continue; // string concatenation, keep going
    }
    break;
  }
  return parts.join("").replace(/\s+/g, " ").trim();
}

// ── build sections ───────────────────────────────────────────────
// Returns structured page rows: { url, title, description, file }.
// title/description are read from the page's own JSX (PageShell title=/
// description=), which is where the human-readable "what is this page" lives.
function getPagesData() {
  const files = walk(APP_DIR, (f) => f.endsWith(`${sep}page.tsx`)).filter(
    (f) => !f.includes(`${sep}api${sep}`),
  );
  return files
    .map((f) => {
      const src = readFileSync(f, "utf8");
      const url = fileToUrl(f, "page");
      // PageShell description (visible) wins; fall back to curated sidecar (index-only).
      const description =
        extractAttr(src, "description") || SIDECAR_DESCRIPTIONS[url] || null;
      return {
        url,
        title: extractAttr(src, "title"),
        description,
        file: relPosix(ROOT, f),
      };
    })
    .sort((a, b) => a.url.localeCompare(b.url));
}

function buildPages(rows) {
  const described = rows.filter((r) => r.description).length;
  let md = `## UI Routes (${rows.length})\n\n`;
  md += `_${described}/${rows.length} have a description (from the page's \`PageShell\` or the curated \`frontend/src/lib/app-surface/page-descriptions.json\` sidecar). Pages without one are invisible to find-a-page search — add an entry to the sidecar (index-only) or a \`PageShell\` description (also renders in the UI)._\n\n`;
  md += "| URL | What it does | File |\n|-----|--------------|------|\n";
  for (const r of rows) {
    const what = (r.description || r.title || "—").replace(/\|/g, "\\|");
    md += `| \`${r.url}\` | ${what} | ${r.file} |\n`;
  }
  return md;
}

function buildApi() {
  const files = walk(APP_DIR, (f) => f.endsWith(`${sep}route.ts`)).filter((f) =>
    f.includes(`${sep}api${sep}`),
  );
  const rows = files
    .map((f) => ({
      url: fileToUrl(f, "api"),
      methods: extractMethods(f).join(", ") || "—",
      file: relPosix(ROOT, f),
    }))
    .sort((a, b) => a.url.localeCompare(b.url));
  let md = `## API Endpoints (${rows.length})\n\n`;
  md += "| Endpoint | Methods | File |\n|----------|---------|------|\n";
  for (const r of rows) md += `| \`${r.url}\` | ${r.methods} | ${r.file} |\n`;
  return md;
}

// Returns structured tool rows: { name, description, file }.
function getToolsData() {
  // Recurse the whole tools tree — tools now live in subfolders too (e.g.
  // tools/write/*.ts factories), not just top-level tools/*.ts. Reading only
  // the top level silently dropped every write-tool from the map.
  const files = walk(
    TOOLS_DIR,
    (f) =>
      f.endsWith(".ts") &&
      !f.endsWith(".test.ts") &&
      !f.includes(`${sep}__tests__${sep}`),
  ).sort();
  const all = [];
  for (const f of files) {
    const relFile = relative(TOOLS_DIR, f).split(sep).join("/");
    for (const t of extractTools(f)) {
      all.push({ name: t.name, description: t.description || "", file: relFile });
    }
  }
  return all;
}

function buildTools(tools) {
  const byFile = new Map();
  for (const t of tools) {
    if (!byFile.has(t.file)) byFile.set(t.file, []);
    byFile.get(t.file).push(t);
  }
  let md = `## AI Tools (${tools.length})\n\n`;
  md += "These are the tools the AI assistant can call. Each lives in `frontend/src/lib/ai/tools/`.\n\n";
  for (const f of [...byFile.keys()].sort()) {
    const rows = byFile.get(f).sort((a, b) => a.name.localeCompare(b.name));
    md += `### \`${f}\` (${rows.length})\n\n`;
    md += "| Tool | Description |\n|------|-------------|\n";
    for (const t of rows) {
      md += `| \`${t.name}\` | ${(t.description || "—").replace(/\|/g, "\\|")} |\n`;
    }
    md += "\n";
  }
  return md;
}

// ── assemble ─────────────────────────────────────────────────────
function buildMarkdown(pages, tools) {
  const header = `# Project Map

> **AUTO-GENERATED — do not edit by hand.** Regenerate with \`npm run map:project\`.
> A pre-commit gate fails if this file is stale relative to the code.
>
> This is the surface inventory every AI session should read first: what pages
> exist, what API endpoints exist, and what the AI assistant can do. Search it
> by *purpose* (e.g. grep "run workflows"), not by URL. For *how* the system
> fits together (data flow, architecture), see
> \`docs/architecture/AI-RAG-ARCHITECTURE.md\`. For the database, see
> \`docs/architecture/TABLE-LIST.md\`. The in-app assistant searches the same
> production subset via the \`findAppPage\` tool (\`frontend/src/lib/app-surface/\`).

`;
  return (
    header +
    buildPages(pages) +
    "\n" +
    buildApi() +
    "\n" +
    buildTools(tools) +
    "\n"
  );
}

// Deterministic JSON index (no timestamp — must be byte-stable for the gate).
function buildIndexJson(pages, tools) {
  const index = {
    note: "AUTO-GENERATED by npm run map:project. Do not edit. Searched by the findAppPage tool.",
    pages: pages.map((p) => ({
      url: p.url,
      title: p.title || null,
      description: p.description || null,
    })),
    tools: tools.map((t) => ({
      name: t.name,
      description: t.description || null,
    })),
  };
  return JSON.stringify(index, null, 2) + "\n";
}

const pages = getPagesData();
const tools = getToolsData();
const content = buildMarkdown(pages, tools);
const productionPages = pages.filter((page) => !NONPROD_ROUTE_FILES.has(page.file));
const indexJson = buildIndexJson(productionPages, tools);

if (CHECK_ONLY) {
  const mdCurrent =
    existsSync(OUTPUT) && readFileSync(OUTPUT, "utf8") === content;
  const jsonCurrent =
    existsSync(INDEX_JSON) && readFileSync(INDEX_JSON, "utf8") === indexJson;
  if (!mdCurrent || !jsonCurrent) {
    console.error(
      "❌ PROJECT MAP GATE — the project map is stale.\n" +
        "   The code (routes / API / AI tools) changed but the map was not regenerated.\n" +
        "   Run: npm run map:project\n" +
        "   Then stage: git add docs/architecture/PROJECT-MAP.md frontend/src/lib/app-surface/app-surface.generated.json",
    );
    process.exit(1);
  }
  console.log("✅ Project map is current.");
  process.exit(0);
}

if (!existsSync(INDEX_DIR)) mkdirSync(INDEX_DIR, { recursive: true });
writeFileSync(OUTPUT, content, "utf8");
writeFileSync(INDEX_JSON, indexJson, "utf8");
console.log(
  `✅ Wrote ${relative(ROOT, OUTPUT)} + ${relative(ROOT, INDEX_JSON)}`,
);
