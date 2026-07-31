#!/usr/bin/env node
/**
 * run-tripwire.mjs — one scheduled cycle of the schema tripwire.
 *
 * For each watched database it:
 *   1. captures a fresh snapshot (read-only against production)
 *   2. finds the most recent PRIOR snapshot in snapshots/<label>/
 *   3. diffs prior → fresh
 *   4. writes the fresh snapshot + a drift report
 *   5. records any critical/high findings
 *
 * Exit code 1 if ANY database shows critical/high drift, so the GitHub Actions
 * job goes red (emails the repo owner) and opens an issue. The committed
 * snapshot files are themselves the append-only, tamper-evident trail.
 *
 * Databases are configured by env var; a missing URL for a label is skipped
 * with a warning (never a silent no-op).
 *
 *   PM_DATABASE_URL   → snapshots/pm-app
 *   RAG_DATABASE_URL  → snapshots/rag
 */

import { readdir, mkdir, writeFile } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const SNAP = (label) => join(REPO_ROOT, "snapshots", label);
const REPORTS = join(REPO_ROOT, "reports");

const WATCHED = [
  { label: "pm-app", url: process.env.PM_DATABASE_URL },
  { label: "rag", url: process.env.RAG_DATABASE_URL },
];

function node(script, args) {
  return execFileSync("node", [join(REPO_ROOT, "scripts", script), ...args], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "inherit"],
  });
}

async function latestPriorSnapshot(label) {
  let files;
  try {
    files = (await readdir(SNAP(label))).filter((f) => f.endsWith(".json")).sort();
  } catch {
    return null;
  }
  return files.length ? join(SNAP(label), files[files.length - 1]) : null;
}

async function main() {
  const stamp = new Date().toISOString();
  await mkdir(REPORTS, { recursive: true });
  let drift = false;
  const summary = [];

  for (const { label, url } of WATCHED) {
    if (!url) {
      console.warn(`[tripwire] SKIP ${label}: no database URL in env (set ${label === "rag" ? "RAG_DATABASE_URL" : "PM_DATABASE_URL"}).`);
      summary.push(`- ⚠️ ${label}: skipped (no URL configured)`);
      continue;
    }

    const prior = await latestPriorSnapshot(label);
    // capture fresh — schema-snapshot prints the path on its last stdout line
    const out = node("schema-snapshot.mjs", ["--url", url, "--label", label, "--out", SNAP(label), "--stamp", stamp]);
    const freshPath = out.trim().split("\n").pop().trim();

    if (!prior) {
      console.log(`[tripwire] ${label}: first snapshot, nothing to diff against.`);
      summary.push(`- 🟢 ${label}: baseline established (no prior snapshot)`);
      continue;
    }

    const reportPath = join(REPORTS, `${label}__${stamp.replace(/[:.]/g, "-")}.json`);
    let findings = [];
    try {
      const json = node("schema-diff.mjs", ["--old", prior, "--new", freshPath, "--json"]);
      findings = JSON.parse(json).findings ?? [];
    } catch (err) {
      // schema-diff exits 1 on drift; its stdout (the JSON) still came through execFileSync's throw
      const stdout = err.stdout?.toString?.() ?? "";
      try {
        findings = JSON.parse(stdout).findings ?? [];
      } catch {
        console.error(`[tripwire] ${label}: diff failed to parse.`);
        summary.push(`- ❓ ${label}: diff error`);
        continue;
      }
    }

    await writeFile(reportPath, JSON.stringify({ label, at: stamp, prior, fresh: freshPath, findings }, null, 2));
    const crit = findings.filter((f) => f.severity === "critical");
    const high = findings.filter((f) => f.severity === "high");
    if (crit.length || high.length) {
      drift = true;
      summary.push(`- 🔴 ${label}: ${crit.length} critical, ${high.length} high`);
      for (const f of [...crit, ...high]) console.log(`   ${f.severity.toUpperCase()}: ${f.detail}`);
    } else {
      summary.push(`- ✅ ${label}: no destructive drift (${findings.length} additive change(s))`);
    }
  }

  console.log("\n=== TRIPWIRE SUMMARY ===");
  console.log(summary.join("\n"));
  if (process.env.GITHUB_STEP_SUMMARY) {
    await writeFile(process.env.GITHUB_STEP_SUMMARY, `## Schema tripwire — ${stamp}\n\n${summary.join("\n")}\n`, { flag: "a" });
  }
  process.exit(drift ? 1 : 0);
}

main().catch((err) => {
  console.error("[tripwire] FAILED:", err.message);
  process.exit(2);
});
