#!/usr/bin/env node

/**
 * Job Planner <-> Acumatica cross-system reconciliation (Phase 1: JP-side sync health).
 *
 * Every Job Planner financial record carries an `externalObject` block describing
 * its linkage to the external accounting system (Acumatica):
 *   - externalObject == null  -> the record was NEVER linked to Acumatica
 *   - status === 4            -> linked/synced (healthy)
 *   - lastSync                -> when JP last pushed this record's snapshot
 *   - data                    -> the amount snapshot Acumatica currently holds
 *
 * The accounting team's monthly manual audit ("are the two systems talking?") is
 * exactly this comparison. This script computes it across every project and emits
 * a findings report. No Acumatica call is required for Phase 1 — JP's own sync
 * metadata reveals unlinked records, post-sync drift, and value divergence.
 *
 * Confidence tiers:
 *   HIGH  - unlinked records, drift (modifiedOn > lastSync): structural facts from JP.
 *   MED   - live-actuals vs Acumatica-snapshot value mismatch: snapshot may be partial,
 *           verify against Acumatica in Phase 2 before treating as a true discrepancy.
 *   INFO  - budget-health flags (underwater cost basis, thin margin, overbilled).
 *
 * Secrets: reads JOBPLANNER_API_KEY from env. Never prints the key or raw records.
 *
 * Usage:
 *   node scripts/jobplanner/reconcile.mjs            # all projects -> report
 *   node scripts/jobplanner/reconcile.mjs --json     # also write JSON
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import dotenv from "dotenv";

const __filename = fileURLToPath(import.meta.url);
const repoRoot = path.resolve(path.dirname(__filename), "../..");

dotenv.config({ path: path.join(repoRoot, ".env"), quiet: true });
dotenv.config({ path: path.join(repoRoot, ".env.local"), quiet: true });
dotenv.config({ path: path.join(repoRoot, "frontend/.env.local"), quiet: true });

const API_KEY = process.env.JOBPLANNER_API_KEY?.trim();
if (!API_KEY) {
  console.error("Missing JOBPLANNER_API_KEY. Add it to frontend/.env.local.");
  process.exit(1);
}

const API_V1 = "https://api.jobplanner.com";
const API_V2 = "https://api-v2.jobplanner.com";
// Job Planner sits behind Cloudflare, which blocks default script user-agents (err 1010).
const USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36";

const THIN_MARGIN_PCT = 3; // budgetProfit / contract below this = thin-margin flag
const CONCURRENCY = 5;
const SKIP_PROJECT_NAMES = new Set(["JobPlanner test", "Training Library"]);

const dollars = (cents) => (Number(cents || 0) / 100);
const fmt = (cents) =>
  dollars(cents).toLocaleString("en-US", { style: "currency", currency: "USD" });

function parseDate(value) {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

async function fetchJson(url) {
  const res = await fetch(url, {
    headers: { ApiKey: API_KEY, "User-Agent": USER_AGENT, Accept: "application/json" },
  });
  if (!res.ok) {
    throw new Error(`${res.status} ${url.replace(API_V1, "").replace(API_V2, "")}`);
  }
  return res.json();
}

async function mapWithConcurrency(items, limit, worker) {
  const results = new Array(items.length);
  let cursor = 0;
  async function run() {
    while (cursor < items.length) {
      const index = cursor++;
      results[index] = await worker(items[index], index);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, run));
  return results;
}

/** Live actual cost on a budget line = sum of its directCostValues amounts. */
function liveActuals(lineItem) {
  const values = lineItem.directCostValues || {};
  return Object.values(values).reduce((sum, v) => sum + Number(v?.amount || 0), 0);
}

function analyzeProject(project, budget, ccos, pccos) {
  const findings = [];
  const add = (severity, tier, kind, detail, amountCents) =>
    findings.push({ severity, tier, kind, detail, amountCents: amountCents ?? null });

  const lineItems = budget?.lineItems || [];

  // --- Budget line reconciliation ---
  for (const li of lineItems) {
    const label = li.description || `costCode ${li.costCodeId}`;
    const eo = li.externalObject;
    if (!eo) {
      add("warn", "HIGH", "unlinked-budget-line",
        `Budget line "${label}" has no Acumatica linkage (never pushed).`);
      continue;
    }
    const lastSync = parseDate(eo.lastSync);
    const modified = parseDate(li.modifiedOn);
    if (lastSync && modified && modified > lastSync) {
      add("warn", "HIGH", "drift-budget-line",
        `Budget line "${label}" edited in JP after last Acumatica sync (modified ${modified.toISOString().slice(0, 10)} > synced ${lastSync.toISOString().slice(0, 10)}).`);
    }
    const live = liveActuals(li);
    const pushed = Number(eo.data?.act_amt || 0);
    if (live !== pushed) {
      add("info", "MED", "value-mismatch-actuals",
        `Budget line "${label}" actuals: JP ${fmt(live)} vs Acumatica snapshot ${fmt(pushed)} (Δ ${fmt(live - pushed)}).`,
        live - pushed);
    }
  }

  // --- Change-order linkage ---
  const coScan = (rows, kind) => {
    for (const c of rows || []) {
      if (!c.externalObject) {
        add("warn", "HIGH", `unlinked-${kind}`,
          `${kind === "cco" ? "Commitment" : "Prime-contract"} change order #${c.number} (${fmt(c.totalAmount)}) has no Acumatica linkage.`,
          c.totalAmount);
      }
    }
  };
  coScan(ccos, "cco");
  coScan(pccos, "pcco");

  // --- Budget-health flags (single source: budget summary) ---
  if (budget) {
    const { revisedBudget, budgetedCost, contractAmount, budgetProfit, billedToDate } = budget;
    if (Number(budgetedCost) > Number(revisedBudget)) {
      add("warn", "INFO", "underwater-budget",
        `Budgeted cost ${fmt(budgetedCost)} exceeds revised budget ${fmt(revisedBudget)} (cost basis over budget by ${fmt(budgetedCost - revisedBudget)}).`,
        budgetedCost - revisedBudget);
    }
    if (Number(contractAmount) > 0) {
      const marginPct = (Number(budgetProfit) / Number(contractAmount)) * 100;
      if (marginPct < THIN_MARGIN_PCT) {
        add("info", "INFO", "thin-margin",
          `Budget profit ${fmt(budgetProfit)} is ${marginPct.toFixed(1)}% of contract ${fmt(contractAmount)} (below ${THIN_MARGIN_PCT}%).`);
      }
    }
    if (Number(billedToDate) > Number(contractAmount) && Number(contractAmount) > 0) {
      add("info", "INFO", "billed-over-contract",
        `Billed to date ${fmt(billedToDate)} exceeds contract ${fmt(contractAmount)} (over by ${fmt(billedToDate - contractAmount)}).`,
        billedToDate - contractAmount);
    }
  }

  return {
    projectId: project.projectId,
    projectName: project.projectName,
    state: project.state,
    lineCount: lineItems.length,
    ccoCount: (ccos || []).length,
    pccoCount: (pccos || []).length,
    findings,
  };
}

function summarize(reports) {
  const byKind = {};
  let high = 0;
  for (const r of reports) {
    for (const f of r.findings) {
      byKind[f.kind] = (byKind[f.kind] || 0) + 1;
      if (f.tier === "HIGH") high += 1;
    }
  }
  return { byKind, high };
}

function renderMarkdown(reports, summary, generatedAt) {
  const lines = [];
  lines.push("# Job Planner ↔ Acumatica Reconciliation Report");
  lines.push("");
  lines.push(`_Generated ${generatedAt} • ${reports.length} projects • Phase 1 (Job Planner sync metadata)_`);
  lines.push("");
  lines.push("## Summary");
  lines.push("");
  lines.push(`- **${summary.high}** high-confidence cross-system findings (unlinked records + post-sync drift)`);
  lines.push("");
  lines.push("| Finding type | Count | Confidence |");
  lines.push("|---|---:|---|");
  const tierForKind = {
    "unlinked-budget-line": "HIGH", "drift-budget-line": "HIGH",
    "unlinked-cco": "HIGH", "unlinked-pcco": "HIGH",
    "value-mismatch-actuals": "MED",
    "underwater-budget": "INFO", "thin-margin": "INFO", "billed-over-contract": "INFO",
  };
  for (const [kind, count] of Object.entries(summary.byKind).sort((a, b) => b[1] - a[1])) {
    lines.push(`| ${kind} | ${count} | ${tierForKind[kind] || "—"} |`);
  }
  lines.push("");
  lines.push("## Findings by project");
  lines.push("");
  const ranked = [...reports]
    .map((r) => ({ r, score: r.findings.filter((f) => f.tier === "HIGH").length, total: r.findings.length }))
    .filter((x) => x.total > 0)
    .sort((a, b) => b.score - a.score || b.total - a.total);

  for (const { r } of ranked) {
    lines.push(`### ${r.projectName}  \`#${r.projectId}\` ${r.state || ""}`);
    lines.push(`_${r.lineCount} budget lines · ${r.ccoCount} commitment COs · ${r.pccoCount} prime COs_`);
    lines.push("");
    const order = { HIGH: 0, MED: 1, INFO: 2 };
    for (const f of [...r.findings].sort((a, b) => order[a.tier] - order[b.tier])) {
      lines.push(`- **[${f.tier}]** ${f.detail}`);
    }
    lines.push("");
  }
  return lines.join("\n");
}

async function main() {
  const writeJson = process.argv.includes("--json");
  const generatedAt = new Date().toISOString();
  process.stderr.write("Fetching project list…\n");
  const projects = (await fetchJson(`${API_V1}/projects`)).filter(
    (p) => !SKIP_PROJECT_NAMES.has(p.projectName),
  );
  process.stderr.write(`Reconciling ${projects.length} projects (concurrency ${CONCURRENCY})…\n`);

  const reports = await mapWithConcurrency(projects, CONCURRENCY, async (project) => {
    const pid = project.projectId;
    try {
      const [budget, ccos, pccos] = await Promise.all([
        fetchJson(`${API_V2}/projects/${pid}/budgets`).catch(() => null),
        fetchJson(`${API_V2}/projects/${pid}/commitmentchangeorders`).catch(() => []),
        fetchJson(`${API_V2}/projects/${pid}/primecontractchangeorders`).catch(() => []),
      ]);
      return analyzeProject(project, budget, ccos, pccos);
    } catch (err) {
      process.stderr.write(`  ! ${project.projectName} (#${pid}): ${err.message}\n`);
      return { projectId: pid, projectName: project.projectName, lineCount: 0, ccoCount: 0, pccoCount: 0, findings: [] };
    }
  });

  const summary = summarize(reports);
  const markdown = renderMarkdown(reports, summary, generatedAt);

  const outDir = path.join(repoRoot, "docs/reports");
  fs.mkdirSync(outDir, { recursive: true });
  const mdPath = path.join(outDir, "jobplanner-acumatica-reconciliation.md");
  fs.writeFileSync(mdPath, markdown);
  process.stderr.write(`\nReport: ${path.relative(repoRoot, mdPath)}\n`);

  if (writeJson) {
    const jsonPath = path.join(outDir, "jobplanner-acumatica-reconciliation.json");
    fs.writeFileSync(jsonPath, JSON.stringify({ generatedAt, summary, reports }, null, 2));
    process.stderr.write(`JSON:   ${path.relative(repoRoot, jsonPath)}\n`);
  }

  process.stderr.write(`\nHigh-confidence findings: ${summary.high}\n`);
  for (const [kind, count] of Object.entries(summary.byKind).sort((a, b) => b[1] - a[1])) {
    process.stderr.write(`  ${String(count).padStart(4)}  ${kind}\n`);
  }
}

main().catch((err) => {
  console.error("Reconciliation failed:", err.message);
  process.exit(1);
});
