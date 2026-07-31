#!/usr/bin/env node
// Draft a changelog release block from git conventional commits.
//
// Usage (from frontend/ or repo root):
//   node ../scripts/changelog/draft-release.mjs <version> <since>
//   npm run changelog:draft -- <version> <since>
//
//   <version>  semantic version for the new release, e.g. 1.12.0
//   <since>    a git revision or date the previous release was cut, e.g.
//              2026-06-27  or  v1.11.0  or  a commit SHA.
//
// It prints a ready-to-paste `Release` object grouping feat/fix/perf commits by
// conventional-commit scope (mapped to a changelog `area`) and type. The output is a
// DRAFT: curate the wording into user-facing language and prune noise before pasting it
// at the top of frontend/src/data/changelog.ts. Nothing is written automatically — the
// human stays in the loop so the public changelog never fills with raw commit messages.

import { execSync } from "node:child_process";

const [, , version, since] = process.argv;

if (!version || !since) {
  console.error(
    "Usage: node scripts/changelog/draft-release.mjs <version> <since>\n" +
      "  e.g. node scripts/changelog/draft-release.mjs 1.12.0 2026-06-27"
  );
  process.exit(1);
}

// Map a conventional-commit scope to a changelog area. Unknown scopes fall back to a
// keyword scan of the subject, then to "operations".
const SCOPE_TO_AREA = {
  ai: "ai",
  "ai-assistant": "ai",
  "ai-search": "ai",
  "ai-tools": "ai",
  "ai-vision": "ai",
  intelligence: "ai",
  "executive-brief": "ai",
  "owner-briefing": "ai",
  rag: "ai",
  pipeline: "ai",
  ocr: "ai",
  "task-extraction": "ai",
  "task-training": "ai",
  budget: "financial",
  invoicing: "financial",
  invoice: "financial",
  commitments: "financial",
  "change-events": "financial",
  "change-orders": "financial",
  "prime-contract": "financial",
  "prime-contracts": "financial",
  retainage: "financial",
  accounting: "financial",
  estimates: "financial",
  financial: "financial",
  submittals: "operations",
  rfis: "operations",
  rfi: "operations",
  "rfi-email": "operations",
  drawings: "operations",
  "daily-log": "operations",
  meetings: "operations",
  directory: "operations",
  contacts: "operations",
  documents: "operations",
  files: "operations",
  schedule: "operations",
  timeline: "operations",
  "product-board": "operations",
  "progress-reports": "operations",
  knowledge: "operations",
  ui: "ui",
  ux: "ui",
  layout: "ui",
  nav: "ui",
  tables: "ui",
  table: "ui",
  sheet: "ui",
  forms: "ui",
  "design-system": "ui",
  storybook: "ui",
  "mobile-nav": "ui",
  insights: "ui",
  infra: "infrastructure",
  build: "infrastructure",
  db: "infrastructure",
  "db-inventory": "infrastructure",
  health: "infrastructure",
  guardrails: "infrastructure",
  tracing: "infrastructure",
  api: "infrastructure",
  testing: "infrastructure",
  teams: "integrations",
  "teams-bot": "integrations",
  microsoft: "integrations",
  graph: "integrations",
  "graph-sync": "integrations",
  "graph-subscriptions": "integrations",
  acumatica: "integrations",
  jobplanner: "integrations",
  emails: "integrations",
  email: "integrations",
  "email-inbox": "integrations",
  sync: "integrations",
  notifications: "integrations",
  auth: "security",
  access: "security",
  permissions: "security",
  security: "security",
};

const TYPE_KEYWORD_AREA = [
  [/\b(auth|login|password|session|rls|permission)\b/i, "security"],
  [/\b(ai|llm|rag|embedding|assistant|agent|brief)\b/i, "ai"],
  [/\b(budget|invoice|commitment|contract|retainage|cost|financial)\b/i, "financial"],
  [/\b(teams|outlook|microsoft|acumatica|graph|sync|email)\b/i, "integrations"],
  [/\b(table|layout|design|nav|ui|ux|storybook)\b/i, "ui"],
  [/\b(build|cron|pipeline|guardrail|deploy|type|infra)\b/i, "infrastructure"],
];

const TYPE_MAP = { feat: "new", fix: "fixed", perf: "improved" };

function areaFor(scope, subject) {
  if (scope && SCOPE_TO_AREA[scope]) return SCOPE_TO_AREA[scope];
  for (const [re, area] of TYPE_KEYWORD_AREA) if (re.test(subject)) return area;
  return "operations";
}

// A plain YYYY-MM-DD is a date (use --since); anything else is a git revision (use range).
const isDate = /^\d{4}-\d{2}-\d{2}$/.test(since);
const range = isDate ? `--since="${since}"` : `${since}..HEAD`;

let raw;
try {
  raw = execSync(
    `git log ${range} --no-merges --pretty=format:%s --date=short`,
    { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 }
  ).trim();
} catch (err) {
  console.error(
    `git log failed for "${since}". Pass a date (YYYY-MM-DD), a tag, or a commit SHA.\n` +
      (err.stderr || err.message || "")
  );
  process.exit(1);
}

const lines = raw ? raw.split("\n") : [];

// Parse "type(scope): subject" / "type: subject". Ignore [skip-rag-docs] tokens.
const CC = /^(feat|fix|perf)(?:\(([^)]+)\))?:\s*(.+)$/i;

const seen = new Set();
const byAreaType = new Map(); // area -> type -> [subjects]

for (const line of lines) {
  const m = line.match(CC);
  if (!m) continue;
  const ccType = m[1].toLowerCase();
  const scope = (m[2] || "").toLowerCase();
  const subject = m[3].replace(/\s*\[skip-rag-docs\]\s*$/i, "").trim();
  const changelogType = TYPE_MAP[ccType];
  const area = areaFor(scope, subject);
  const key = `${area}|${changelogType}|${subject.toLowerCase()}`;
  if (seen.has(key)) continue;
  seen.add(key);
  if (!byAreaType.has(area)) byAreaType.set(area, new Map());
  const tMap = byAreaType.get(area);
  if (!tMap.has(changelogType)) tMap.set(changelogType, []);
  tMap.get(changelogType).push(subject);
}

if (lines.length === 0 || byAreaType.size === 0) {
  console.error(`No feat/fix/perf commits found in ${since}..HEAD.`);
  process.exit(1);
}

const today = new Date();
const dateLabel = today.toLocaleDateString("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
});

const esc = (s) => s.replace(/\\/g, "\\\\").replace(/"/g, '\\"');

const AREA_ORDER = [
  "ai",
  "financial",
  "operations",
  "integrations",
  "ui",
  "infrastructure",
  "security",
];
const TYPE_ORDER = ["new", "improved", "fixed"];

const out = [];
out.push("  {");
out.push(`    version: "${version}",`);
out.push(`    date: "${dateLabel}",`);
out.push(`    label: "Latest",`);
out.push("    entries: [");

const orderedAreas = [
  ...AREA_ORDER.filter((a) => byAreaType.has(a)),
  ...[...byAreaType.keys()].filter((a) => !AREA_ORDER.includes(a)),
];

let total = 0;
for (const area of orderedAreas) {
  const tMap = byAreaType.get(area);
  const types = [
    ...TYPE_ORDER.filter((t) => tMap.has(t)),
    ...[...tMap.keys()].filter((t) => !TYPE_ORDER.includes(t)),
  ];
  for (const type of types) {
    for (const subject of tMap.get(type)) {
      total++;
      out.push("      {");
      out.push(`        type: "${type}",`);
      out.push(`        area: "${area}",`);
      out.push(`        title: "TODO", // ${esc(subject)}`);
      out.push(`        description:`);
      out.push(`          "${esc(subject)}",`);
      out.push("      },");
    }
  }
}

out.push("    ],");
out.push("  },");

console.error(
  `\n// DRAFT release ${version} — ${total} entries from ${lines.length} commits in ${since}..HEAD.` +
    `\n// Curate titles/descriptions into user-facing language, prune noise, then paste at` +
    `\n// the TOP of RELEASES in frontend/src/data/changelog.ts and clear the previous` +
    `\n// release's "label". Then delete each "// TODO" marker.\n`
);
console.log(out.join("\n"));
