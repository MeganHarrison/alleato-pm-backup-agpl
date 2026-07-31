#!/usr/bin/env node

/**
 * Runs the change-request reconcile (import-change-requests.mjs, DRY RUN) across every
 * JP↔app project pair in the commitment batch-plan, then aggregates ADOPT/CREATE/FLAG
 * and executed-CO twin coverage into one portfolio report. READ-ONLY — no writes.
 *
 * Usage: node scripts/jobplanner/sweep-change-requests.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const __filename = fileURLToPath(import.meta.url);
const repoRoot = path.resolve(path.dirname(__filename), "../..");
const evidenceDir = path.join(repoRoot, "docs/ops/evidence/2026-07-09-jobplanner-change-management-import");
const perProjectDir = path.join(evidenceDir, "per-project");
fs.mkdirSync(perProjectDir, { recursive: true });

const batch = JSON.parse(
  fs.readFileSync(path.join(repoRoot, "docs/ops/evidence/2026-07-07-jobplanner-commitment-batch-plan/batch-plan.json"), "utf8"),
);
const pairs = (batch.rows || [])
  .filter((r) => Number.isInteger(r.jp_project_id) && Number.isInteger(r.app_project_id))
  .map((r) => ({ jp: r.jp_project_id, app: r.app_project_id, number: r.project_number, name: r.name }));

const results = [];
for (const p of pairs) {
  const out = path.join(perProjectDir, `reconcile-${p.jp}-${p.app}.json`);
  const res = spawnSync(
    "node",
    [path.join(repoRoot, "scripts/jobplanner/import-change-requests.mjs"), `--jp=${p.jp}`, `--app=${p.app}`, `--out=${out}`],
    { encoding: "utf8" },
  );
  if (res.status !== 0) {
    console.log(`  ${p.number.padEnd(8)} ${p.name.padEnd(24)} ERROR ${(res.stderr || "").split("\n")[0]}`);
    results.push({ ...p, error: (res.stderr || "").split("\n")[0] });
    continue;
  }
  const rep = JSON.parse(fs.readFileSync(out, "utf8"));
  const c = rep.counts;
  results.push({ ...p, ...c });
  console.log(
    `  ${p.number.padEnd(8)} ${p.name.slice(0, 22).padEnd(22)} CR ${String(c.changeRequests).padStart(3)}  ` +
    `A ${String(c.adopt).padStart(3)} C ${String(c.create).padStart(3)} F ${String(c.flag).padStart(2)}  ` +
    `CCOtwin ${c.ccoWithExecutedTwin}/${c.jpCcos}  PCCOtwin ${c.pccoWithExecutedTwin}/${c.jpPccos}`,
  );
}

const sum = (k) => results.reduce((s, r) => s + (r[k] || 0), 0);
const totals = {
  projects: results.length, errored: results.filter((r) => r.error).length,
  changeRequests: sum("changeRequests"), adopt: sum("adopt"), create: sum("create"), flag: sum("flag"),
  existingChangeEvents: sum("existingChangeEvents"), appOnly: sum("appOnly"),
  jpCcos: sum("jpCcos"), ccoWithExecutedTwin: sum("ccoWithExecutedTwin"),
  jpPccos: sum("jpPccos"), pccoWithExecutedTwin: sum("pccoWithExecutedTwin"),
};

fs.writeFileSync(path.join(evidenceDir, "sweep-summary.json"), JSON.stringify({ generatedAt: new Date().toISOString(), totals, results }, null, 2));

const md = [];
md.push("# JP change-management reconcile — PORTFOLIO SWEEP (DRY RUN, no writes)\n");
md.push(`${results.length} projects · ${new Date().toISOString()}\n`);
md.push(`**Change requests:** ${totals.changeRequests}  →  ADOPT ${totals.adopt} · CREATE ${totals.create} · FLAG ${totals.flag}`);
md.push(`**Existing app change events:** ${totals.existingChangeEvents} (app-only: ${totals.appOnly})`);
md.push(`**Executed-CO twins:** commitment ${totals.ccoWithExecutedTwin}/${totals.jpCcos} · prime ${totals.pccoWithExecutedTwin}/${totals.jpPccos}`);
md.push(`**Errored projects:** ${totals.errored}\n`);
md.push(`| # | Project | CRs | Adopt | Create | Flag | Existing CE | CCO twin | PCCO twin |`);
md.push(`|---|---|--:|--:|--:|--:|--:|--:|--:|`);
for (const r of results.sort((a, b) => (b.flag || 0) - (a.flag || 0) || (b.create || 0) - (a.create || 0))) {
  if (r.error) { md.push(`| ${r.number} | ${r.name} | — | — | — | — | — | ERROR | ${r.error} |`); continue; }
  md.push(`| ${r.number} | ${r.name} | ${r.changeRequests} | ${r.adopt} | ${r.create} | ${r.flag} | ${r.existingChangeEvents} | ${r.ccoWithExecutedTwin}/${r.jpCcos} | ${r.pccoWithExecutedTwin}/${r.jpPccos} |`);
}
fs.writeFileSync(path.join(evidenceDir, "sweep-summary.md"), md.join("\n") + "\n");

console.log(`\nTOTAL  CR ${totals.changeRequests}  →  ADOPT ${totals.adopt} · CREATE ${totals.create} · FLAG ${totals.flag}`);
console.log(`Existing CE ${totals.existingChangeEvents} (app-only ${totals.appOnly}) · errored ${totals.errored}`);
console.log(`Executed-CO twins: commitment ${totals.ccoWithExecutedTwin}/${totals.jpCcos} · prime ${totals.pccoWithExecutedTwin}/${totals.jpPccos}`);
console.log(`\nReport: ${path.join(evidenceDir, "sweep-summary.md")}`);
