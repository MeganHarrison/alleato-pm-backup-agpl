#!/usr/bin/env node
/**
 * UI Consistency Audit — whole-repo sweep for design-system divergence.
 *
 * WHY: The app has a rich `design-system` ESLint plugin (raw <button>, hardcoded
 * colors, hand-rolled grids, non-editable status columns, raw detail fields, …),
 * but every rule is `warn` globally and only ERRORs on *changed* files via
 * lint-staged. So the pre-existing debt — the same pattern hand-rolled in dozens
 * of places instead of one shared component — is never surfaced. Fix it in one
 * spot and it's still broken everywhere else, because nobody can see "everywhere
 * else".
 *
 * This runs every design-system rule across ALL of `src`, aggregates the
 * violations by pattern (most-broken first) and by file (worst offenders), maps
 * each pattern to the canonical component it should use, and writes ONE ranked
 * markdown report. Deterministic and re-runnable — no browser, no auth.
 *
 * USAGE:
 *   node scripts/audit/ui-consistency-audit.mjs            # audit all of src
 *   node scripts/audit/ui-consistency-audit.mjs src/app    # scope to a subtree
 *   node scripts/audit/ui-consistency-audit.mjs --json     # also print JSON summary
 *
 * Report: docs/reports/ui-consistency-<YYYY-MM-DD>.md (relative to repo root).
 */

import { execSync } from "node:child_process";
import { writeFileSync, mkdirSync } from "node:fs";
import { resolve, relative } from "node:path";

const FRONTEND_DIR = resolve(import.meta.dirname, "..", "..");
const REPO_ROOT = resolve(FRONTEND_DIR, "..");

const args = process.argv.slice(2);
const wantJson = args.includes("--json");
const targetArg = args.find((a) => !a.startsWith("--")) || "src";

/**
 * Pattern catalogue: design-system rule → what it means and the ONE shared thing
 * to use instead. Ordered loosely by architectural severity; the report re-sorts
 * by real violation count. Keep in sync with eslint.config.mjs + the *-GATE.md files.
 */
const RULE_INFO = {
  "design-system/no-raw-button": {
    title: "Raw <button> instead of <Button>",
    use: "<Button> from @/components/ui/button",
    weight: 3,
  },
  "design-system/no-raw-heading": {
    title: "Raw <h1>/<h2> heading",
    use: "PageShell title / SectionRuleHeading from @/components/layout",
    weight: 3,
  },
  "design-system/no-raw-table-primitives": {
    title: "Raw <table>/<TableRow> primitives",
    use: "UnifiedTablePage (pages) or InlineTable (@/components/ds)",
    weight: 4,
  },
  "design-system/no-raw-detail-field": {
    title: "Raw <dl>/<dt>/<dd> detail field",
    use: "<DetailField> / <DetailFieldGrid> from @/components/ds",
    weight: 3,
  },
  "design-system/no-raw-detail-grid": {
    title: "Hand-rolled detail two-column grid",
    use: "<DetailLayout sidebar={…}> from @/components/layout",
    weight: 3,
  },
  "design-system/no-raw-page-grid": {
    title: "Hand-rolled multi-column page grid",
    use: "<PageScaffold layout=…> from @/components/layout",
    weight: 3,
  },
  "design-system/require-page-shell": {
    title: "Page missing PageShell/PageScaffold",
    use: "<PageShell variant=…> or <PageScaffold layout=…>",
    weight: 4,
  },
  "design-system/require-editable-status-column": {
    title: "Status/dropdown column with no editable decision",
    use: "Wire inline editing, or set editable:false explicitly",
    weight: 4,
  },
  "design-system/no-editable-title-column": {
    title: "Editable title/name column (hijacks row click)",
    use: "Link the title cell to the detail page",
    weight: 4,
  },
  "design-system/no-hand-rolled-dropdown-menu": {
    title: "Bespoke popover menu instead of DropdownMenu",
    use: "DropdownMenu primitive from @/components/ui/dropdown-menu",
    weight: 3,
  },
  "design-system/no-raw-search-input": {
    title: 'Raw <Input placeholder="Search…">',
    use: "<ExpandingSearch> from @/components/ds",
    weight: 2,
  },
  "design-system/no-raw-date-input": {
    title: "Raw <Input type=\"date\">",
    use: "<RHFDateField> from @/components/forms/fields",
    weight: 2,
  },
  "design-system/no-raw-form-controls": {
    title: "Raw form control",
    use: "Approved form field components (@/components/forms)",
    weight: 3,
  },
  "design-system/require-approved-form-components": {
    title: "Non-approved form component",
    use: "RHF field components from @/components/forms/fields",
    weight: 3,
  },
  "design-system/require-money-field": {
    title: "Money input not using MoneyField",
    use: "<MoneyField> from @/components/forms/MoneyField",
    weight: 2,
  },
  "design-system/require-empty-state": {
    title: "Hand-rolled empty state",
    use: "<EmptyState> from @/components/ds",
    weight: 2,
  },
  "design-system/require-error-state": {
    title: "Hand-rolled error state",
    use: "<ErrorState> from @/components/ds",
    weight: 2,
  },
  "design-system/require-info-alert": {
    title: "Hand-rolled info/alert box",
    use: "<InfoAlert> from @/components/ds",
    weight: 2,
  },
  "design-system/require-api-client": {
    title: 'Raw fetch("/api/…") in a component',
    use: "apiFetch from @/lib/api-client",
    weight: 3,
  },
  "design-system/no-external-fetch-in-api-routes": {
    title: "Raw fetch(https://…) in an API route",
    use: "fetchWithGuardrails from @/lib/fetch-with-guardrails",
    weight: 3,
  },
  "design-system/no-raw-error-message-toast": {
    title: "Raw error message leaked into a toast",
    use: "Map to a user-safe message before toast.error",
    weight: 2,
  },
  "design-system/no-inline-currency": {
    title: "Inline currency formatting",
    use: "formatCurrency from @/lib/format",
    weight: 1,
  },
  "design-system/no-hardcoded-colors": {
    title: "Hardcoded color (hex / gray-* / blue-* / white)",
    use: "Semantic tokens (bg-background, text-foreground, …)",
    weight: 2,
  },
  "design-system/require-semantic-colors": {
    title: "Non-semantic color usage",
    use: "Semantic color tokens",
    weight: 1,
  },
  "design-system/no-arbitrary-spacing": {
    title: "Arbitrary spacing value (p-[10px])",
    use: "The spacing scale (p-4, gap-2, …)",
    weight: 1,
  },
  "design-system/no-design-violations": {
    title: "General design-system violation",
    use: "See message / DESIGN.md",
    weight: 1,
  },
};

function fallbackInfo(ruleId) {
  return { title: ruleId, use: "See rule message", weight: 1 };
}

console.error(`[ui-consistency-audit] linting ${targetArg} … (this can take a minute)`);

let raw = "";
try {
  raw = execSync(
    `node_modules/.bin/eslint ${JSON.stringify(targetArg)} --format json --no-error-on-unmatched-pattern`,
    { cwd: FRONTEND_DIR, maxBuffer: 512 * 1024 * 1024, encoding: "utf8" },
  );
} catch (err) {
  // ESLint exits non-zero when it finds errors — the JSON is still on stdout.
  raw = err.stdout?.toString() || "";
  if (!raw) {
    console.error("[ui-consistency-audit] eslint produced no output:", err.message);
    process.exit(1);
  }
}

/** @type {Array<{filePath:string, messages:Array<{ruleId:string|null, line:number, column:number, message:string, severity:number}>}>} */
const results = JSON.parse(raw);

// Aggregate design-system violations only.
const byRule = new Map(); // ruleId -> { count, files: Map<file, [{line,message}]> }
const byFile = new Map(); // file -> count

for (const file of results) {
  const rel = relative(REPO_ROOT, file.filePath);
  for (const m of file.messages) {
    if (!m.ruleId || !m.ruleId.startsWith("design-system/")) continue;
    if (!byRule.has(m.ruleId)) byRule.set(m.ruleId, { count: 0, files: new Map() });
    const entry = byRule.get(m.ruleId);
    entry.count += 1;
    if (!entry.files.has(rel)) entry.files.set(rel, []);
    entry.files.get(rel).push({ line: m.line, message: m.message });
    byFile.set(rel, (byFile.get(rel) || 0) + 1);
  }
}

const totalViolations = [...byRule.values()].reduce((s, e) => s + e.count, 0);
const totalFiles = byFile.size;

// Rank rules: by violation count desc, then architectural weight desc.
const rankedRules = [...byRule.entries()].sort((a, b) => {
  if (b[1].count !== a[1].count) return b[1].count - a[1].count;
  const wa = (RULE_INFO[a[0]] || fallbackInfo(a[0])).weight;
  const wb = (RULE_INFO[b[0]] || fallbackInfo(b[0])).weight;
  return wb - wa;
});

const worstFiles = [...byFile.entries()].sort((a, b) => b[1] - a[1]).slice(0, 25);

// Build the report.
const today = new Date().toISOString().slice(0, 10);
const lines = [];
lines.push(`# UI Consistency Audit — ${today}`);
lines.push("");
lines.push(
  `Whole-repo sweep of the \`design-system\` ESLint rules over \`${targetArg}\`. ` +
    `Each row is a pattern that is **hand-rolled instead of using the one shared component** — ` +
    `so fixing it in a single place does not propagate. Ranked by how many times the pattern ` +
    `diverges across the site.`,
);
lines.push("");
lines.push(
  `**${totalViolations.toLocaleString()} violations** across **${totalFiles.toLocaleString()} files**, ` +
    `spanning **${rankedRules.length} patterns**.`,
);
lines.push("");
lines.push("## Most-diverged patterns (fix the component once → fixes all listed files)");
lines.push("");
lines.push("| # | Occurrences | Files | Pattern | Use instead |");
lines.push("|---|-------------|-------|---------|-------------|");
rankedRules.forEach(([ruleId, entry], i) => {
  const info = RULE_INFO[ruleId] || fallbackInfo(ruleId);
  lines.push(
    `| ${i + 1} | ${entry.count} | ${entry.files.size} | ${info.title} (\`${ruleId.replace("design-system/", "")}\`) | ${info.use} |`,
  );
});
lines.push("");
lines.push("## Worst-offender files (most violations — best refactor candidates)");
lines.push("");
lines.push("| Violations | File |");
lines.push("|-----------|------|");
for (const [file, count] of worstFiles) lines.push(`| ${count} | \`${file}\` |`);
lines.push("");
lines.push("## Per-pattern detail (top files + first line of each)");
lines.push("");
for (const [ruleId, entry] of rankedRules) {
  const info = RULE_INFO[ruleId] || fallbackInfo(ruleId);
  lines.push(`### ${info.title} — ${entry.count} occurrences in ${entry.files.size} files`);
  lines.push(`Rule: \`${ruleId}\` → **Use:** ${info.use}`);
  lines.push("");
  const topFiles = [...entry.files.entries()]
    .sort((a, b) => b[1].length - a[1].length)
    .slice(0, 15);
  for (const [file, hits] of topFiles) {
    const firstLines = hits
      .slice(0, 3)
      .map((h) => h.line)
      .join(", ");
    lines.push(`- \`${file}\` ×${hits.length} (lines ${firstLines}${hits.length > 3 ? ", …" : ""})`);
  }
  if (entry.files.size > 15) lines.push(`- …and ${entry.files.size - 15} more files`);
  lines.push("");
}
lines.push("---");
lines.push("");
lines.push(
  `_Regenerate: \`npm run audit:consistency\`. Structural drift is enforced on changed files by ` +
    `lint-staged; this report surfaces the whole-repo backlog those ratchets never sweep. ` +
    `For the visual/judgment pass (cramped layouts, "looks like crap"), use the \`/ui-audit\` skill._`,
);

const outDir = resolve(REPO_ROOT, "docs", "reports");
mkdirSync(outDir, { recursive: true });
const outPath = resolve(outDir, `ui-consistency-${today}.md`);
writeFileSync(outPath, lines.join("\n"), "utf8");

console.error("");
console.error(`[ui-consistency-audit] ${totalViolations} violations in ${totalFiles} files`);
console.error("[ui-consistency-audit] Top patterns:");
for (const [ruleId, entry] of rankedRules.slice(0, 8)) {
  const info = RULE_INFO[ruleId] || fallbackInfo(ruleId);
  console.error(`  ${String(entry.count).padStart(5)}  ${info.title}`);
}
console.error("");
console.error(`[ui-consistency-audit] Report: ${relative(REPO_ROOT, outPath)}`);

if (wantJson) {
  const summary = rankedRules.map(([ruleId, entry]) => ({
    rule: ruleId,
    count: entry.count,
    files: entry.files.size,
  }));
  console.log(JSON.stringify({ totalViolations, totalFiles, patterns: summary }, null, 2));
}
