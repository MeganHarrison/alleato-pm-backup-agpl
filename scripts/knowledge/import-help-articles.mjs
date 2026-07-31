#!/usr/bin/env node
/**
 * Import published help-article MDX into the `training_docs` table so they
 * render in-app at /knowledge/app. Idempotent: upserts by slug.
 *
 * Source: the Alleato OS docs (symlinked at docs/alleato-os-docs).
 * Each article's frontmatter `module` maps to an app-knowledge tool category
 * (see frontend/src/features/knowledge/app-help-content.ts).
 *
 * Usage (from repo root):
 *   node scripts/knowledge/import-help-articles.mjs [--dry]
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "..", "..");

// Resolve @supabase/supabase-js from the frontend workspace (pnpm layout).
const requireFromFrontend = createRequire(
  path.join(REPO_ROOT, "frontend", "package.json"),
);
const { createClient } = requireFromFrontend("@supabase/supabase-js");
const DOCS_ROOT = path.join(REPO_ROOT, "docs", "alleato-os-docs");
const SOURCE_DIRS = ["project-management-tools", "ai-features", "integrations"];
const DRY = process.argv.includes("--dry");

// frontmatter module -> app-knowledge tool category title (must match a group
// title in app-help-content.ts; slug is derived the same way both sides).
const MODULE_TO_CATEGORY = {
  budget: "Budget",
  estimates: "Estimates",
  "prime-contracts": "Prime Contracts",
  commitments: "Commitments",
  "change-events": "Change Events",
  "change-orders": "Change Orders",
  "direct-costs": "Direct Costs",
  invoicing: "Invoicing",
  schedule: "Schedule",
  "daily-log": "Field Operations",
  photos: "Field Operations",
  "punch-list": "Field Operations",
  meetings: "Meetings",
  rfis: "RFIs and Submittals",
  submittals: "RFIs and Submittals",
  documents: "Documents and Drawings",
  drawings: "Documents and Drawings",
  specifications: "Documents and Drawings",
  transmittals: "Documents and Drawings",
  directory: "Directory and People",
  ai: "AI Assistant",
  "ai-assistant": "AI Assistant",
  intelligence: "AI Assistant",
  "progress-reports": "AI Assistant",
  "app-expert": "AI Assistant",
  "app-navigation": "Projects",
  navigation: "Projects",
  help: "Projects",
  "project-home": "Projects",
  integrations: "Integrations",
  settings: "Settings and Permissions",
  permissions: "Settings and Permissions",
  feedback: "Settings and Permissions",
  changelog: "Projects",
  "subcontractor-portal": "Subcontractors",
  "training-docs": "Training Docs",
};

const VALID_AUDIENCES = new Set(["internal", "client", "subcontractor", "admin"]);

function loadEnv() {
  const envFiles = [
    path.join(REPO_ROOT, "frontend", ".env.local"),
    path.join(REPO_ROOT, "frontend", ".env"),
  ];
  const env = {};
  for (const file of envFiles) {
    if (!fs.existsSync(file)) continue;
    for (const line of fs.readFileSync(file, "utf8").split("\n")) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (!m) continue;
      const key = m[1];
      let val = m[2].trim().replace(/^["']|["']$/g, "");
      if (!(key in env)) env[key] = val;
    }
  }
  return env;
}

function walk(dir) {
  const out = [];
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(p));
    else if (entry.name.endsWith(".mdx")) out.push(p);
  }
  return out;
}

function parseFrontmatter(raw) {
  const m = raw.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
  if (!m) return { fm: {}, body: raw };
  const fm = {};
  for (const line of m[1].split("\n")) {
    const mm = line.match(/^([A-Za-z0-9_]+):\s*(.*)$/);
    if (mm) fm[mm[1]] = mm[2].trim().replace(/^["']|["']$/g, "");
  }
  // first related_routes list item (lines like "  - /route")
  const routeMatch = m[1].match(/related_routes:\s*\n\s*-\s*(.+)/);
  if (routeMatch) fm.related_route = routeMatch[1].trim();
  return { fm, body: m[2] };
}

function cleanBody(body) {
  // Drop a single leading H1 (the title is rendered separately in the header).
  return body.replace(/^\s*#\s+.+\n+/, "").trim();
}

async function main() {
  const env = loadEnv();
  const url = env.NEXT_PUBLIC_SUPABASE_URL || env.SUPABASE_URL;
  const key = env.SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_SERVICE_KEY;
  if (!url || !key) throw new Error("Missing Supabase URL or service key in frontend env.");

  const files = SOURCE_DIRS.flatMap((d) => walk(path.join(DOCS_ROOT, d)));
  const rows = [];
  const skipped = [];
  const seenSlugs = new Set();

  for (const file of files) {
    const raw = fs.readFileSync(file, "utf8");
    const { fm, body } = parseFrontmatter(raw);
    const module = (fm.module || "").trim();
    const category = MODULE_TO_CATEGORY[module];
    if (!category) {
      skipped.push(`${path.relative(DOCS_ROOT, file)} (module="${module || "none"}")`);
      continue;
    }
    let slug = path.basename(file, ".mdx");
    if (seenSlugs.has(slug)) slug = `${module}-${slug}`;
    seenSlugs.add(slug);

    const title = (fm.title || slug).trim();
    const cleaned = cleanBody(body);
    if (!cleaned) {
      skipped.push(`${path.relative(DOCS_ROOT, file)} (empty body)`);
      continue;
    }
    const audience = VALID_AUDIENCES.has(fm.audience) ? fm.audience : "client";

    rows.push({
      slug,
      title,
      summary: (fm.description || "").trim() || null,
      body_markdown: cleaned,
      audience,
      status: "published",
      source_route: fm.related_route || null,
      target_collection: "app-knowledge",
      published_doc_path: `app-knowledge/${slug}.mdx`,
      last_published_at: new Date().toISOString(),
      tool_module: module || null,
      tool_category: category,
      metadata: { appToolCategory: category, importedFrom: path.relative(DOCS_ROOT, file) },
    });
  }

  console.log(`Found ${files.length} mdx files; importing ${rows.length}; skipping ${skipped.length}.`);
  const byCat = {};
  for (const r of rows) byCat[r.tool_category] = (byCat[r.tool_category] || 0) + 1;
  console.log("By category:", byCat);
  if (skipped.length) console.log("Skipped:\n  " + skipped.join("\n  "));

  if (DRY) {
    console.log("\n--dry: no writes.");
    return;
  }

  const supabase = createClient(url, key, { auth: { persistSession: false } });
  let ok = 0;
  for (const row of rows) {
    const { error } = await supabase
      .from("training_docs")
      .upsert(row, { onConflict: "slug" });
    if (error) {
      console.error(`FAIL ${row.slug}: ${error.message}`);
    } else {
      ok++;
    }
  }
  console.log(`\nUpserted ${ok}/${rows.length} training docs.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
