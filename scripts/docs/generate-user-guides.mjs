#!/usr/bin/env node
/**
 * User-guide scaffolder.
 *
 * Generates a hub page + per-task article stubs for every tool in
 * scripts/docs/user-guide-registry.json, using the REAL routes and curated
 * one-line descriptions from docs/architecture/PROJECT-MAP.md as the spine.
 *
 * It fills in everything that is derivable (frontmatter, routes, task index,
 * the tool's curated description, cross-links) and leaves explicit `<!-- TODO -->`
 * markers for the field table, numbered steps, and statuses — the parts that
 * MUST be verified against the live app and never invented.
 *
 * Idempotent: never overwrites an existing file unless --force is passed.
 *
 *   node scripts/docs/generate-user-guides.mjs
 *   node scripts/docs/generate-user-guides.mjs --tool commitments
 *   node scripts/docs/generate-user-guides.mjs --force
 *   node scripts/docs/generate-user-guides.mjs --dry-run
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..", "..");
const PROJECT_MAP = join(ROOT, "docs", "architecture", "PROJECT-MAP.md");
const REGISTRY = join(__dirname, "user-guide-registry.json");
const TEMPLATES_DIR = join(ROOT, "docs", "user-guide", "_templates");
const GUIDES_DIR = join(ROOT, "docs", "user-guide", "guides");

const argv = process.argv.slice(2);
const FORCE = argv.includes("--force");
const DRY_RUN = argv.includes("--dry-run");
const ONLY_TOOL = (() => {
  const i = argv.indexOf("--tool");
  return i !== -1 ? argv[i + 1] : null;
})();

/** Parse PROJECT-MAP.md UI-route rows into { url, desc } grouped by tool slug. */
function parseProjectMap() {
  const md = readFileSync(PROJECT_MAP, "utf8");
  const rows = [...md.matchAll(/^\| `([^`]+)` \| (.*?) \| (.*?) \|$/gm)];
  const byTool = {};
  for (const [, url, descRaw] of rows) {
    const m = url.match(/^\/\[projectId\]\/([^/]+)/);
    if (!m) continue;
    const slug = m[1];
    if (slug.startsWith("[")) continue;
    const desc = descRaw.trim();
    (byTool[slug] ??= []).push({ url, desc });
  }
  return byTool;
}

const TASK_TEMPLATE = readFileSync(join(TEMPLATES_DIR, "task-create.md"), "utf8");
const ACTION_TEMPLATE = readFileSync(join(TEMPLATES_DIR, "task-action.md"), "utf8");
const HUB_TEMPLATE = readFileSync(join(TEMPLATES_DIR, "tool-hub.md"), "utf8");

function fill(template, vars) {
  return template.replace(/\{\{(\w+)\}\}/g, (_, k) => (k in vars ? vars[k] : `{{${k}}}`));
}

/** Pick the best curated description for a tool from its routes. */
function toolDescription(routes) {
  // Prefer the list route (exact base), else the shortest route's description.
  const sorted = [...routes].sort((a, b) => a.url.length - b.url.length);
  const list = sorted.find((r) => /^\/\[projectId\]\/[^/]+$/.test(r.url));
  const desc = (list || sorted[0])?.desc || "";
  return desc && desc !== "Loading..." && !/^Provide a valid/.test(desc)
    ? desc
    : "";
}

/** Derive the task set for a tool from its routes + registry overrides. */
function deriveTasks(tool, routes) {
  const base = `/[projectId]/${tool.slug}`;
  const has = (re) => routes.some((r) => re.test(r.url));
  const singular = tool.singular || tool.title.toLowerCase().replace(/s$/, "");
  const tasks = [];

  // Create — the workhorse, only if there's a /new route.
  const hasCreate = has(new RegExp(`^${esc(base)}/new$`)) || has(new RegExp(`/new$`));
  if (hasCreate && !tool.extraTasks?.some((t) => /^create/.test(t.slug))) {
    tasks.push({
      slug: "create",
      title: `Create ${article(singular)} ${singular}`,
      description: `Create a new ${singular}, step by step.`,
      kind: "create",
    });
  }

  // Registry extra tasks (create-subcontract, distribute, respond, etc.)
  for (const t of tool.extraTasks || []) {
    tasks.push({ ...t, kind: /^create|^set-up|^schedule-of/.test(t.slug) ? "create" : "action" });
  }

  // Edit
  if (has(/\/edit$/) || has(new RegExp(`^${esc(base)}/\\[[^/]+\\]$`))) {
    tasks.push({
      slug: "edit",
      title: `Edit ${article(singular)} ${singular}`,
      description: `Update an existing ${singular}.`,
      kind: "action",
    });
  }

  // Email
  if (tool.email) {
    tasks.push({
      slug: "email",
      title: `Email ${article(singular)} ${singular}`,
      description: `Send the ${singular} to recipients by email.`,
      kind: "action",
    });
  }

  // Delete & restore
  if (has(/\/recycle-bin/) || has(new RegExp(`^${esc(base)}/\\[[^/]+\\]$`))) {
    tasks.push({
      slug: "delete-and-restore",
      title: `Delete & restore ${article(singular)} ${singular}`,
      description: `Soft-delete ${article(singular)} ${singular} and restore it from the recycle bin.`,
      kind: "action",
    });
  }

  // De-dupe by slug (registry wins, declared first).
  const seen = new Set();
  return tasks.filter((t) => (seen.has(t.slug) ? false : seen.add(t.slug)));
}

function esc(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** "a" vs "an" — vowel-initial or spoken-acronym (RFI, SOV, PCO) take "an". */
function article(word) {
  return /^[aeiou]/i.test(word) || /^[AEFHILMNORSX]{2,}/.test(word.split(" ")[0]) ? "an" : "a";
}

function routesYaml(routes) {
  return routes.map((r) => `  - ${r.url}`).join("\n");
}

function relatedLinks(related, registryBySlug) {
  // Only link to tools that actually have a guide folder — never emit a dead link.
  const known = (related || []).filter((slug) => registryBySlug[slug]);
  if (!known.length) return "<!-- TODO: cross-links to connected tools. -->";
  return known
    .map((slug) => `- [${registryBySlug[slug].title}](../${slug}/index.md)`)
    .join("\n");
}

function write(path, content, report) {
  if (existsSync(path) && !FORCE) {
    report.skipped.push(path);
    return;
  }
  if (DRY_RUN) {
    report.wouldWrite.push(path);
    return;
  }
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, content);
  report.written.push(path);
}

function main() {
  const registry = JSON.parse(readFileSync(REGISTRY, "utf8"));
  const defaults = registry.defaults || {};
  const byTool = parseProjectMap();
  const registryBySlug = Object.fromEntries(registry.tools.map((t) => [t.slug, t]));

  const report = { written: [], skipped: [], wouldWrite: [], missingRoutes: [] };

  for (const tool of registry.tools) {
    if (ONLY_TOOL && tool.slug !== ONLY_TOOL) continue;
    const routes = byTool[tool.slug];
    if (!routes?.length) {
      report.missingRoutes.push(tool.slug);
      continue;
    }

    const audience = (tool.audience || defaults.audience || ["pm"]).join(", ");
    const lastVerified = tool.lastVerified || defaults.lastVerified || "TBD";
    const description = toolDescription(routes) || `${tool.title} in Alleato.`;
    const primaryRoute = `/[projectId]/${tool.slug}`;
    const tasks = deriveTasks(tool, routes);
    const dir = join(GUIDES_DIR, tool.slug);

    // --- Hub page ---
    const taskIndex = tasks.length
      ? tasks.map((t) => `- [${t.title}](${t.slug}.md) — ${t.description}`).join("\n")
      : "<!-- TODO: list the tasks for this tool. -->";

    const hub = fill(HUB_TEMPLATE, {
      TITLE: tool.title,
      SIDEBAR_LABEL: tool.sidebarLabel || tool.title,
      DESCRIPTION: description,
      AUDIENCE: audience,
      APP_ROUTES: routesYaml(routes),
      RELATED: (tool.related || []).join(", "),
      LAST_VERIFIED: lastVerified,
      PRIMARY_ROUTE: primaryRoute,
      TASK_INDEX: taskIndex,
      RELATED_LINKS: relatedLinks(tool.related, registryBySlug),
    });
    write(join(dir, "index.md"), hub, report);

    // --- Task articles ---
    for (const task of tasks) {
      const tpl = task.kind === "create" ? TASK_TEMPLATE : ACTION_TEMPLATE;
      const taskRoutes = task.kind === "create"
        ? routes.filter((r) => /\/new$/.test(r.url))
        : [];
      const content = fill(tpl, {
        TITLE: task.title,
        SIDEBAR_LABEL: task.title,
        DESCRIPTION: task.description,
        AUDIENCE: audience,
        APP_ROUTES: taskRoutes.length ? routesYaml(taskRoutes) : `  - ${primaryRoute}`,
        PARENT: "index.md",
        PARENT_TITLE: tool.title,
        LAST_VERIFIED: lastVerified,
        SLUG: `${tool.slug}-${task.slug}`,
        RELATED_LINKS: relatedLinks(tool.related, registryBySlug),
      });
      write(join(dir, `${task.slug}.md`), content, report);
    }
  }

  // --- Report ---
  const tag = DRY_RUN ? "[dry-run] would write" : "wrote";
  const writeList = DRY_RUN ? report.wouldWrite : report.written;
  console.log(`\nUser-guide scaffolder ${DRY_RUN ? "(dry run)" : ""}`);
  console.log(`  ${tag}:        ${writeList.length} files`);
  console.log(`  skipped (exists): ${report.skipped.length} files`);
  if (report.missingRoutes.length) {
    console.log(`  ⚠ no routes in PROJECT-MAP for: ${report.missingRoutes.join(", ")}`);
  }
  if (writeList.length) {
    const rel = (p) => p.replace(ROOT + "/", "");
    console.log("\n  files:");
    for (const p of writeList) console.log(`    + ${rel(p)}`);
  }
  if (report.skipped.length && !FORCE) {
    console.log(`\n  (${report.skipped.length} existing files left untouched — pass --force to overwrite)`);
  }
  console.log("");
}

main();
