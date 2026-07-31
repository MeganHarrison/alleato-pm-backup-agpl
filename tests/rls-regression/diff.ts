/**
 * RLS Regression Test - Snapshot Diff
 *
 * Compares before/after snapshot directories and reports any differences.
 * PASS = byte-identical count values and ID lists per persona.
 * Any difference is a FAIL and must be investigated.
 *
 * Run: tsx tests/rls-regression/diff.ts <before-dir> <after-dir>
 *
 * Example:
 *   tsx tests/rls-regression/diff.ts snapshots/before snapshots/after
 */

import * as fs from "fs";
import * as path from "path";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type CountResult = { count: number } | { error: string } | { skipped: string };
type IdListResult = { ids: (string | number)[] } | { error: string } | { skipped: string };

interface ProbeSnapshot {
  persona: string;
  email: string;
  timestamp: string;
  supabase_project: string;
  counts: Record<string, CountResult>;
  sample_ids: Record<string, IdListResult>;
}

interface DiffEntry {
  persona: string;
  field: string;
  before: unknown;
  after: unknown;
  verdict: "PASS" | "FAIL" | "WARN";
  note?: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function countValue(r: CountResult): string {
  if ("count" in r) return String(r.count);
  if ("skipped" in r) return `SKIPPED`;
  return `ERROR: ${r.error}`;
}

function idValue(r: IdListResult): string {
  if ("ids" in r) return JSON.stringify(r.ids);
  if ("skipped" in r) return `SKIPPED`;
  return `ERROR: ${r.error}`;
}

function loadSnapshot(dir: string, persona: string): ProbeSnapshot | null {
  const filePath = path.join(dir, `${persona}.json`);
  if (!fs.existsSync(filePath)) return null;
  return JSON.parse(fs.readFileSync(filePath, "utf-8")) as ProbeSnapshot;
}

function diffSnapshots(
  before: ProbeSnapshot,
  after: ProbeSnapshot
): DiffEntry[] {
  const diffs: DiffEntry[] = [];
  const persona = before.persona;

  // Diff counts
  const allCountKeys = new Set([
    ...Object.keys(before.counts),
    ...Object.keys(after.counts),
  ]);

  for (const key of allCountKeys) {
    const bVal = before.counts[key];
    const aVal = after.counts[key];

    const bStr = bVal ? countValue(bVal) : "MISSING";
    const aStr = aVal ? countValue(aVal) : "MISSING";

    const pass = bStr === aStr;

    // Skipped/error on both sides is a WARN, not FAIL
    const bothSkipped =
      bVal && aVal && "skipped" in bVal && "skipped" in aVal;
    const bothError =
      bVal && aVal && "error" in bVal && "error" in aVal;

    diffs.push({
      persona,
      field: `counts.${key}`,
      before: bStr,
      after: aStr,
      verdict: pass ? "PASS" : bothSkipped || bothError ? "WARN" : "FAIL",
      note: bothSkipped ? "Table skipped on both sides — OK" : undefined,
    });
  }

  // Diff sample IDs
  const allIdKeys = new Set([
    ...Object.keys(before.sample_ids),
    ...Object.keys(after.sample_ids),
  ]);

  for (const key of allIdKeys) {
    const bVal = before.sample_ids[key];
    const aVal = after.sample_ids[key];

    const bStr = bVal ? idValue(bVal) : "MISSING";
    const aStr = aVal ? idValue(aVal) : "MISSING";

    const pass = bStr === aStr;

    diffs.push({
      persona,
      field: `sample_ids.${key}`,
      before: bStr,
      after: aStr,
      verdict: pass ? "PASS" : "FAIL",
    });
  }

  return diffs;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

const PERSONAS = ["admin", "member-67", "member-none", "external"];

async function main() {
  const beforeDir = process.argv[2];
  const afterDir = process.argv[3];

  if (!beforeDir || !afterDir) {
    console.error("Usage: tsx tests/rls-regression/diff.ts <before-dir> <after-dir>");
    process.exit(1);
  }

  const resolvedBefore = path.resolve(__dirname, beforeDir);
  const resolvedAfter = path.resolve(__dirname, afterDir);

  console.log(`Before: ${resolvedBefore}`);
  console.log(`After:  ${resolvedAfter}`);
  console.log("");

  const allDiffs: DiffEntry[] = [];
  const missingPersonas: string[] = [];

  for (const persona of PERSONAS) {
    const before = loadSnapshot(resolvedBefore, persona);
    const after = loadSnapshot(resolvedAfter, persona);

    if (!before || !after) {
      missingPersonas.push(
        `${persona}: before=${before ? "OK" : "MISSING"}, after=${after ? "OK" : "MISSING"}`
      );
      continue;
    }

    const diffs = diffSnapshots(before, after);
    allDiffs.push(...diffs);
  }

  // -------------------------------------------------------------------------
  // Build report
  // -------------------------------------------------------------------------
  const lines: string[] = [];
  const now = new Date().toISOString();

  lines.push("# RLS Regression Diff Report");
  lines.push("");
  lines.push(`Generated: ${now}`);
  lines.push(`Before: \`${beforeDir}\``);
  lines.push(`After:  \`${afterDir}\``);
  lines.push("");

  if (missingPersonas.length > 0) {
    lines.push("## Missing Snapshots");
    lines.push("");
    for (const m of missingPersonas) {
      lines.push(`- ${m}`);
    }
    lines.push("");
  }

  const failCount = allDiffs.filter((d) => d.verdict === "FAIL").length;
  const warnCount = allDiffs.filter((d) => d.verdict === "WARN").length;
  const passCount = allDiffs.filter((d) => d.verdict === "PASS").length;

  const overallVerdict = failCount > 0 ? "FAIL" : "PASS";

  lines.push(`## Overall Verdict: ${overallVerdict}`);
  lines.push("");
  lines.push(`| Result | Count |`);
  lines.push(`|--------|-------|`);
  lines.push(`| PASS   | ${passCount} |`);
  lines.push(`| WARN   | ${warnCount} |`);
  lines.push(`| FAIL   | ${failCount} |`);
  lines.push("");

  // Per-persona summary
  for (const persona of PERSONAS) {
    const personaDiffs = allDiffs.filter((d) => d.persona === persona);
    if (personaDiffs.length === 0) continue;

    const personaFails = personaDiffs.filter((d) => d.verdict === "FAIL");
    const personaVerdict = personaFails.length > 0 ? "FAIL" : "PASS";

    lines.push(`## Persona: ${persona} — ${personaVerdict}`);
    lines.push("");
    lines.push(`| Field | Before | After | Verdict |`);
    lines.push(`|-------|--------|-------|---------|`);

    for (const d of personaDiffs) {
      const note = d.note ? ` _(${d.note})_` : "";
      const beforeStr = String(d.before).replace(/\|/g, "\\|");
      const afterStr = String(d.after).replace(/\|/g, "\\|");
      lines.push(
        `| \`${d.field}\` | ${beforeStr} | ${afterStr} | **${d.verdict}**${note} |`
      );
    }
    lines.push("");
  }

  // Failure detail
  const fails = allDiffs.filter((d) => d.verdict === "FAIL");
  if (fails.length > 0) {
    lines.push("## Failures (Investigate These)");
    lines.push("");
    for (const d of fails) {
      lines.push(`### ${d.persona} / ${d.field}`);
      lines.push("");
      lines.push(`- **Before:** \`${d.before}\``);
      lines.push(`- **After:**  \`${d.after}\``);
      lines.push(
        `- **Interpretation:** The RLS policy change altered the visible row set for this persona on this table. This must be explained and approved before the migration can be considered safe.`
      );
      lines.push("");
    }
  }

  const reportContent = lines.join("\n") + "\n";

  // Write report
  const reportDir = path.join(__dirname, "snapshots");
  const reportPath = path.join(reportDir, "diff-report.md");
  fs.writeFileSync(reportPath, reportContent, "utf-8");

  // Print to stdout
  console.log(reportContent);
  console.log(`Report written to: ${reportPath}`);
  console.log(`Overall: ${overallVerdict} (${failCount} failures, ${warnCount} warnings, ${passCount} passing)`);

  if (failCount > 0) {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("Diff failed:", err);
  process.exit(1);
});
