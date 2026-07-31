#!/usr/bin/env node

/**
 * Generate the 🟢 "Reference" pages of the Alleato OS docs site from the codebase.
 *
 * These are the un-rottable pages: pulled straight from code, never hand-edited,
 * verified by a gate. Output goes into the docs site via the symlinked path
 * docs/alleato-os-docs/reference/ (which resolves to the alleato-os repo).
 *
 * Sources:
 *   - routes, ai-tools    → frontend/src/lib/app-surface/app-surface.generated.json
 *   - api-endpoints       → walk frontend/src/app/api for route.ts (+ HTTP methods)
 *   - database-tables     → frontend/src/components/dev-tools/db-inventory.generated.json
 *   - design-system       → frontend/src/components/ds/*.tsx
 *
 * Usage:
 *   npm run docs:reference              — regenerate the reference pages
 *   npm run docs:reference -- --check-only  — fail if stale (gate); no-op if the
 *                                             docs site isn't checked out locally
 *
 * Output is deterministic (no timestamps, no volatile row counts) so --check-only
 * tracks CODE changes, not incidental churn.
 */

import {
  readFileSync,
  writeFileSync,
  readdirSync,
  statSync,
  existsSync,
} from "node:fs";
import { join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(fileURLToPath(import.meta.url), "..", "..", "..");
const APP_DIR = join(ROOT, "frontend", "src", "app");
const DS_DIR = join(ROOT, "frontend", "src", "components", "ds");
const SURFACE = join(
  ROOT,
  "frontend",
  "src",
  "lib",
  "app-surface",
  "app-surface.generated.json",
);
const DB_INVENTORY = join(
  ROOT,
  "frontend",
  "src",
  "components",
  "dev-tools",
  "db-inventory.generated.json",
);
const REFERENCE_DIR = join(ROOT, "docs", "alleato-os-docs", "reference");

const CHECK_ONLY = process.argv.includes("--check-only");
const HTTP_METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"];

// ── helpers ──────────────────────────────────────────────────────
function walk(dir, predicate, acc = []) {
  if (!existsSync(dir)) return acc;
  for (const name of readdirSync(dir)) {
    if (name === "node_modules" || name === ".next") continue;
    const full = join(dir, name);
    if (statSync(full).isDirectory()) walk(full, predicate, acc);
    else if (predicate(full)) acc.push(full);
  }
  return acc;
}

const esc = (s) => (s ? String(s).replace(/\|/g, "\\|").replace(/\n/g, " ") : "—");

function frontmatter(title, description) {
  return `---
title: "${title}"
description: "${description}"
freshness: "generated"
---

<Info>**🟢 Generated** from the codebase by \`npm run docs:reference\`. Do not hand-edit — a gate regenerates this when the code changes. If it looks wrong, the code changed and this will catch up on the next regen.</Info>

`;
}

// ── page builders ────────────────────────────────────────────────
function buildRoutes() {
  const surface = JSON.parse(readFileSync(SURFACE, "utf8"));
  const rows = [...surface.pages].sort((a, b) => a.url.localeCompare(b.url));
  let md = frontmatter(
    "Routes & Pages",
    "Every UI route in the app and what it does.",
  );
  md += `_${rows.length} routes._\n\n`;
  md += "| URL | What it does |\n|-----|--------------|\n";
  for (const r of rows)
    md += `| \`${r.url}\` | ${esc(r.description || r.title)} |\n`;
  return md;
}

function buildApi() {
  const files = walk(APP_DIR, (f) => f.endsWith(`${sep}route.ts`)).filter((f) =>
    f.includes(`${sep}api${sep}`),
  );
  const rows = files
    .map((f) => {
      const src = readFileSync(f, "utf8");
      const methods = HTTP_METHODS.filter((m) =>
        new RegExp(`export\\s+(?:async\\s+function|const)\\s+${m}\\b`).test(src),
      );
      const rel = relative(APP_DIR, f).split(sep);
      rel.pop();
      const url =
        "/" + rel.filter((s) => !(s.startsWith("(") && s.endsWith(")"))).join("/");
      return { url: url === "/" ? "/api" : url, methods: methods.join(", ") || "—" };
    })
    .sort((a, b) => a.url.localeCompare(b.url));
  let md = frontmatter(
    "API Endpoints",
    "Every API route with its HTTP methods.",
  );
  md += `_${rows.length} endpoints._\n\n`;
  md += "| Endpoint | Methods |\n|----------|---------|\n";
  for (const r of rows) md += `| \`${r.url}\` | ${r.methods} |\n`;
  return md;
}

function buildTools() {
  const surface = JSON.parse(readFileSync(SURFACE, "utf8"));
  const rows = [...surface.tools].sort((a, b) => a.name.localeCompare(b.name));
  let md = frontmatter(
    "AI Tools",
    "Every tool the in-app AI assistant can call.",
  );
  md += `_${rows.length} tools._\n\n`;
  md += "| Tool | Description |\n|------|-------------|\n";
  for (const r of rows) md += `| \`${r.name}\` | ${esc(r.description)} |\n`;
  return md;
}

function buildTables() {
  const inv = JSON.parse(readFileSync(DB_INVENTORY, "utf8"));
  const tables = (inv.tables || []).slice().sort((a, b) => {
    if (a.db !== b.db) return (a.db || "").localeCompare(b.db || "");
    return (a.name || "").localeCompare(b.name || "");
  });
  let md = frontmatter(
    "Database Tables",
    "Every table across both Supabase projects, with status and purpose.",
  );
  md += `_${tables.length} tables. Live row counts omitted here (they change constantly) — see the in-app \`/database-inventory\` for live stats._\n\n`;
  md += "| Table | DB | Domain | Status | Purpose |\n|-------|----|--------|--------|---------|\n";
  for (const t of tables)
    md += `| \`${t.name}\` | ${esc(t.db)} | ${esc(t.domain)} | ${esc(t.status)} | ${esc(t.purpose)} |\n`;
  return md;
}

function buildDsComponents() {
  const files = existsSync(DS_DIR)
    ? readdirSync(DS_DIR)
        .filter(
          (f) =>
            f.endsWith(".tsx") &&
            !f.endsWith(".stories.tsx") &&
            !f.endsWith(".test.tsx"),
        )
        .sort()
    : [];
  let md = frontmatter(
    "Design System Components",
    "Reusable components in components/ds — check here before building UI.",
  );
  md += `_${files.length} components. Import from \`@/components/ds\`._\n\n`;
  md += "| Component | File |\n|-----------|------|\n";
  for (const f of files)
    md += `| \`${f.replace(/\.tsx$/, "")}\` | components/ds/${f} |\n`;
  return md;
}

// ── run ──────────────────────────────────────────────────────────
const PAGES = {
  "routes.mdx": buildRoutes,
  "api-endpoints.mdx": buildApi,
  "ai-tools.mdx": buildTools,
  "database-tables.mdx": buildTables,
  "design-system-components.mdx": buildDsComponents,
};

// The docs site is a symlink to the alleato-os repo; skip gracefully when it
// isn't checked out (CI, fresh clones) instead of failing.
if (!existsSync(REFERENCE_DIR)) {
  console.log(
    `↷ docs reference skipped — ${relative(ROOT, REFERENCE_DIR)} not present (alleato-os docs site not checked out).`,
  );
  process.exit(0);
}

let stale = 0;
for (const [file, build] of Object.entries(PAGES)) {
  const content = build();
  const target = join(REFERENCE_DIR, file);
  if (CHECK_ONLY) {
    const existing = existsSync(target) ? readFileSync(target, "utf8") : "";
    if (existing !== content) {
      stale++;
      console.error(`✗ stale: reference/${file}`);
    }
  } else {
    writeFileSync(target, content, "utf8");
    console.log(`✅ wrote reference/${file}`);
  }
}

if (CHECK_ONLY) {
  if (stale > 0) {
    console.error(
      `\n❌ DOCS REFERENCE GATE — ${stale} generated reference page(s) are stale.\n   Run: npm run docs:reference\n`,
    );
    process.exit(1);
  }
  console.log("✅ docs reference pages are current.");
}
