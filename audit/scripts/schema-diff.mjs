#!/usr/bin/env node
/**
 * schema-diff.mjs — Compare two schema snapshots and report destructive drift.
 *
 * This is the tripwire's alarm. Given an OLD and a NEW snapshot (from
 * schema-snapshot.mjs), it reports, in plain English:
 *   - tables that DISAPPEARED           (severity: critical)
 *   - columns that were REMOVED         (severity: critical)
 *   - row counts that CRATERED          (severity: high — default: dropped >25% or >500 rows)
 *   - tables that appeared / columns added / rows grew (severity: info)
 *
 * Exit code is 1 when any critical/high finding exists — so a scheduled runner
 * can gate/alert on the exit code alone.
 *
 * Usage:
 *   node scripts/audit/schema-diff.mjs --old <old.json> --new <new.json> [--drop-pct 25] [--drop-abs 500] [--json]
 */

import { readFile } from "node:fs/promises";

function parseArgs(argv) {
  const args = { dropPct: 25, dropAbs: 500, json: false };
  for (let i = 2; i < argv.length; i += 1) {
    const k = argv[i];
    if (k === "--old") args.old = argv[++i];
    else if (k === "--new") args.new = argv[++i];
    else if (k === "--drop-pct") args.dropPct = Number(argv[++i]);
    else if (k === "--drop-abs") args.dropAbs = Number(argv[++i]);
    else if (k === "--json") args.json = true;
  }
  return args;
}

const load = async (p) => JSON.parse(await readFile(p, "utf8"));

function diff(oldSnap, newSnap, opts) {
  const findings = [];
  const oldTables = oldSnap.tables ?? {};
  const newTables = newSnap.tables ?? {};

  // Dropped tables
  for (const t of Object.keys(oldTables)) {
    if (!(t in newTables)) {
      findings.push({
        severity: "critical",
        kind: "table_dropped",
        table: t,
        detail: `Table "${t}" existed in the old snapshot (${oldTables[t].row_count} rows) and is GONE.`,
      });
    }
  }

  // New tables
  for (const t of Object.keys(newTables)) {
    if (!(t in oldTables)) {
      findings.push({
        severity: "info",
        kind: "table_added",
        table: t,
        detail: `Table "${t}" is new (${newTables[t].row_count} rows).`,
      });
    }
  }

  // Column + row-count changes on surviving tables
  for (const t of Object.keys(newTables)) {
    if (!(t in oldTables)) continue;
    const oldCols = new Map((oldTables[t].columns ?? []).map((c) => [c.column, c]));
    const newCols = new Map((newTables[t].columns ?? []).map((c) => [c.column, c]));

    for (const c of oldCols.keys()) {
      if (!newCols.has(c)) {
        findings.push({
          severity: "critical",
          kind: "column_removed",
          table: t,
          column: c,
          detail: `Column "${t}.${c}" was REMOVED.`,
        });
      }
    }
    for (const c of newCols.keys()) {
      if (!oldCols.has(c)) {
        findings.push({
          severity: "info",
          kind: "column_added",
          table: t,
          column: c,
          detail: `Column "${t}.${c}" was added.`,
        });
      }
    }
    for (const [c, oc] of oldCols) {
      const nc = newCols.get(c);
      if (nc && (nc.type !== oc.type || nc.nullable !== oc.nullable)) {
        findings.push({
          severity: "high",
          kind: "column_type_changed",
          table: t,
          column: c,
          detail: `Column "${t}.${c}" changed: ${oc.type}${oc.nullable ? " null" : ""} → ${nc.type}${nc.nullable ? " null" : ""}.`,
        });
      }
    }

    const oldN = oldTables[t].row_count;
    const newN = newTables[t].row_count;
    if (typeof oldN === "number" && typeof newN === "number" && newN < oldN) {
      const lost = oldN - newN;
      const pct = oldN === 0 ? 0 : (lost / oldN) * 100;
      if (lost >= opts.dropAbs || pct >= opts.dropPct) {
        findings.push({
          severity: "high",
          kind: "rows_dropped",
          table: t,
          detail: `Table "${t}" lost ${lost.toLocaleString()} rows (${pct.toFixed(1)}%): ${oldN.toLocaleString()} → ${newN.toLocaleString()}.`,
        });
      }
    }
  }

  return findings;
}

function severityRank(s) {
  return { critical: 0, high: 1, info: 2 }[s] ?? 3;
}

async function main() {
  const args = parseArgs(process.argv);
  if (!args.old || !args.new) {
    console.error("ERROR: pass --old <snapshot.json> --new <snapshot.json>");
    process.exit(2);
  }
  const [oldSnap, newSnap] = await Promise.all([load(args.old), load(args.new)]);
  const findings = diff(oldSnap, newSnap, args).sort(
    (a, b) => severityRank(a.severity) - severityRank(b.severity),
  );

  const critical = findings.filter((f) => f.severity === "critical");
  const high = findings.filter((f) => f.severity === "high");
  const info = findings.filter((f) => f.severity === "info");

  if (args.json) {
    console.log(JSON.stringify({ oldSnap: oldSnap.captured_at, newSnap: newSnap.captured_at, findings }, null, 2));
  } else {
    const label = newSnap.label ?? "db";
    console.log(`\nDRIFT REPORT — ${label}`);
    console.log(`  ${oldSnap.captured_at}  →  ${newSnap.captured_at}`);
    console.log(`  ${critical.length} critical · ${high.length} high · ${info.length} info\n`);
    if (critical.length) {
      console.log("🔴 CRITICAL — destructive structural change:");
      for (const f of critical) console.log(`   • ${f.detail}`);
      console.log("");
    }
    if (high.length) {
      console.log("🟠 HIGH — data loss / type change:");
      for (const f of high) console.log(`   • ${f.detail}`);
      console.log("");
    }
    if (info.length) {
      console.log("⚪ INFO — additive changes:");
      for (const f of info) console.log(`   • ${f.detail}`);
      console.log("");
    }
    if (!findings.length) console.log("✅ No structural changes.\n");
  }

  process.exit(critical.length + high.length > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error("[diff] FAILED:", err.message);
  process.exit(2);
});
