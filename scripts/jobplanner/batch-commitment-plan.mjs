#!/usr/bin/env node

/**
 * READ-ONLY batch reconciliation planner for Job Planner commitment SOV across all
 * active app projects. Produces a review CSV + JSON — writes NOTHING to the database.
 *
 * For every active app project (phase = "Current", not archived) that maps to a Job
 * Planner project by number, it computes what import-commitments.mjs would do:
 *   - JP commitments to (re)build SOV for, and their JP line counts
 *   - integrity failures (JP SOV lines don't sum to header)
 *   - unresolved cost codes / cost types (would land unmapped)
 *   - Acumatica-sourced duplicates that could be retired
 *   - Acumatica-only commitments that need human review (never auto-deleted)
 *
 * Project match: app `project_number` (e.g. "26-113") == leading number token of JP
 * `projectName` (e.g. "26-113 GW Allisonville Rd IN"), both normalized to "NN-NNN".
 *
 * Usage:
 *   node scripts/jobplanner/batch-commitment-plan.mjs                 # active projects only
 *   node scripts/jobplanner/batch-commitment-plan.mjs --all           # every matched project
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const __filename = fileURLToPath(import.meta.url);
const repoRoot = path.resolve(path.dirname(__filename), "../..");
const frontendRequire = createRequire(path.join(repoRoot, "frontend", "package.json"));
const dotenv = frontendRequire("dotenv");
const { createClient } = frontendRequire("@supabase/supabase-js");
dotenv.config({ path: path.join(repoRoot, ".env"), quiet: true });
dotenv.config({ path: path.join(repoRoot, ".env.local"), quiet: true });
dotenv.config({ path: path.join(repoRoot, "frontend/.env.local"), quiet: true });

const ALL = process.argv.includes("--all");
const OUT_DIR = path.join(repoRoot, "docs/ops/evidence/2026-07-07-jobplanner-commitment-batch-plan");

const API_V1 = "https://api.jobplanner.com";
const API_V2 = "https://api-v2.jobplanner.com";
const USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36";
const JP_KEY = process.env.JOBPLANNER_API_KEY?.trim();
const SUPABASE_URL = process.env.SUPABASE_URL?.trim() || process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() || process.env.SUPABASE_SERVICE_KEY?.trim();
if (!JP_KEY || !SUPABASE_URL || !SERVICE_KEY) { console.error("Missing JOBPLANNER_API_KEY / Supabase env"); process.exit(1); }

const centsToDollars = (c) => Math.round(Number(c) || 0) / 100;
const dashCostCode = (code) => { const s = String(code ?? "").trim(); return /^\d{6}$/.test(s) ? `${s.slice(0, 2)}-${s.slice(2)}` : null; };
const normNum = (s) => { const m = String(s ?? "").match(/(\d{2})\s*-\s*(\d{2,3})/); return m ? `${m[1]}-${m[2]}` : null; };
const csv = (v) => { const s = v == null ? "" : String(v); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };

async function jpGet(url) {
  const res = await fetch(url, { headers: { ApiKey: JP_KEY, "User-Agent": USER_AGENT, Accept: "application/json" } });
  if (!res.ok) throw new Error(`JP ${res.status} ${url.replace(API_V2, "")}`);
  return res.json();
}
function kind(jp) { const n = String(jp.number || ""); if (n.startsWith("SC")) return "subcontract"; if (n.startsWith("PO")) return "purchase_order"; return jp.commitmentType === 2 ? "subcontract" : "purchase_order"; }

async function main() {
  const sb = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

  // App projects + active filter
  const { data: appProjects } = await sb.from("projects").select("id, project_number, name, phase, archived");
  const activeApp = appProjects.filter((p) => !p.archived && (ALL || p.phase === "Current"));
  const appByNum = new Map();
  for (const p of appProjects) { const n = normNum(p.project_number); if (n && !appByNum.has(n)) appByNum.set(n, p); }

  // JP projects
  const jpProjects = await jpGet(`${API_V1}/projects`);
  const jpByNum = new Map();
  for (const j of jpProjects) { const n = normNum(j.projectName); if (n) jpByNum.set(n, j); }

  // App reference maps (shared)
  const { data: ccRows } = await sb.from("cost_codes").select("id, title");
  const costCodeTitleById = new Map((ccRows ?? []).map((r) => [r.id, r.title]));
  const { data: ctRows } = await sb.from("cost_code_types").select("id, code");
  const costTypeIdByCode = new Map((ctRows ?? []).map((r) => [r.code, r.id]));

  const rows = [];        // per-project summary
  const detail = [];      // full plan detail
  const unmatched = [];   // active app projects with no JP match

  for (const app of activeApp) {
    const n = normNum(app.project_number);
    const jp = n ? jpByNum.get(n) : null;
    if (!jp) { unmatched.push({ app_project_id: app.id, project_number: app.project_number, name: app.name, phase: app.phase }); continue; }

    try {
      const [commitments, costCodes, costTypes] = await Promise.all([
        jpGet(`${API_V2}/projects/${jp.projectId}/commitments`),
        jpGet(`${API_V2}/projects/${jp.projectId}/costcodes`),
        jpGet(`${API_V2}/projects/${jp.projectId}/costtypes`),
      ]);
      const jpCodeById = new Map(costCodes.map((c) => [c.id, c]));
      const jpTypeCodeById = new Map(costTypes.map((t) => [t.id, t.code]));

      // active app commitments (both tables) with SOV totals
      const loadApp = async (table, sovTable, fk) => {
        const { data } = await sb.from(table).select("id, contract_number").eq("project_id", app.id).is("deleted_at", null);
        const out = [];
        for (const c of data ?? []) {
          const { data: items } = await sb.from(sovTable).select("amount, project_budget_code_id").eq(fk, c.id);
          out.push({ ...c, table, sovSum: (items ?? []).reduce((a, x) => a + (Number(x.amount) || 0), 0), sovCount: (items ?? []).length, unmapped: (items ?? []).filter((x) => !x.project_budget_code_id).length });
        }
        return out;
      };
      const appCommits = [...await loadApp("subcontracts", "subcontract_sov_items", "subcontract_id"), ...await loadApp("purchase_orders", "purchase_order_sov_items", "purchase_order_id")];
      const jpNumbers = new Set(commitments.map((c) => String(c.number)));
      const byNumber = new Map(appCommits.map((c) => [String(c.contract_number), c]));

      // per JP commitment: lineitems (parallel), resolve, integrity
      const lineArrays = await Promise.all(commitments.map((c) => jpGet(`${API_V2}/commitments/${c.id}/lineitems`).catch(() => null)));
      let toRebuild = 0, toCreate = 0, totalJpLines = 0, unresolvedCodes = 0, unresolvedTypes = 0, integrityFails = [], curUnmappedInApp = 0;
      commitments.forEach((c, i) => {
        const lines = lineArrays[i] || [];
        const headerCents = Number(c.totalAmount ?? c.amount ?? 0);
        const sovCents = lines.reduce((a, x) => a + (Number(x.amount) || 0), 0);
        if (sovCents !== headerCents) integrityFails.push(String(c.number));
        totalJpLines += lines.length;
        for (const x of lines) {
          const jpCode = jpCodeById.get(x.costCodeId)?.code ?? null;
          const dashed = dashCostCode(jpCode);
          if (jpCode && !(dashed && costCodeTitleById.has(dashed))) unresolvedCodes++;
          const tc = jpTypeCodeById.get(x.costTypeId) ?? null;
          if (tc && !costTypeIdByCode.get(tc)) unresolvedTypes++;
        }
        const existing = byNumber.get(String(c.number));
        if (existing) { toRebuild++; curUnmappedInApp += existing.unmapped; } else toCreate++;
      });

      // dup detection vs JP totals
      const jpTotals = commitments.map((c) => centsToDollars(c.totalAmount ?? c.amount));
      let dupes = 0, acuOnly = 0;
      for (const c of appCommits) {
        if (jpNumbers.has(String(c.contract_number))) continue;
        if (jpTotals.some((t) => Math.abs(t - c.sovSum) < 0.5 && c.sovSum > 0)) dupes++; else acuOnly++;
      }

      rows.push({
        project_number: app.project_number, name: app.name, phase: app.phase,
        jp_project_id: jp.projectId, app_project_id: app.id,
        jp_commitments: commitments.length, jp_sov_lines: totalJpLines,
        app_active_commitments: appCommits.length, to_rebuild: toRebuild, to_create: toCreate,
        current_unmapped_in_app: curUnmappedInApp,
        integrity_failures: integrityFails.length, unresolved_code_lines: unresolvedCodes, unresolved_type_lines: unresolvedTypes,
        acumatica_dupes: dupes, acumatica_only_review: acuOnly,
      });
      detail.push({ project: app.project_number, name: app.name, jpProjectId: jp.projectId, appProjectId: app.id, integrityFailures: integrityFails });
      console.error(`✓ ${app.project_number} ${app.name}: ${commitments.length} JP commitments, ${integrityFails.length} integrity fails, ${dupes} dupes, ${acuOnly} acu-only`);
    } catch (e) {
      rows.push({ project_number: app.project_number, name: app.name, phase: app.phase, jp_project_id: jp.projectId, app_project_id: app.id, error: e.message });
      console.error(`✗ ${app.project_number} ${app.name}: ${e.message}`);
    }
  }

  // write CSV
  const cols = ["project_number", "name", "phase", "jp_project_id", "app_project_id", "jp_commitments", "jp_sov_lines", "app_active_commitments", "to_rebuild", "to_create", "current_unmapped_in_app", "integrity_failures", "unresolved_code_lines", "unresolved_type_lines", "acumatica_dupes", "acumatica_only_review", "error"];
  const csvOut = [cols.join(",")].concat(rows.map((r) => cols.map((c) => csv(r[c])).join(","))).join("\n") + "\n";
  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.writeFileSync(path.join(OUT_DIR, "batch-plan.csv"), csvOut);
  fs.writeFileSync(path.join(OUT_DIR, "batch-plan.json"), JSON.stringify({ generatedAt: new Date().toISOString(), mode: ALL ? "all-matched" : "active-only", matched: rows.length, unmatched, rows, detail }, null, 2) + "\n");

  const totals = rows.reduce((a, r) => ({
    projects: a.projects + 1,
    commitments: a.commitments + (r.jp_commitments || 0),
    unmappedNow: a.unmappedNow + (r.current_unmapped_in_app || 0),
    integrity: a.integrity + (r.integrity_failures || 0),
    unresolved: a.unresolved + (r.unresolved_code_lines || 0),
    dupes: a.dupes + (r.acumatica_dupes || 0),
    acuOnly: a.acuOnly + (r.acumatica_only_review || 0),
    errors: a.errors + (r.error ? 1 : 0),
  }), { projects: 0, commitments: 0, unmappedNow: 0, integrity: 0, unresolved: 0, dupes: 0, acuOnly: 0, errors: 0 });

  console.log(JSON.stringify({ mode: ALL ? "all-matched" : "active-only", matchedProjects: rows.length, unmatchedActive: unmatched.length, totals, outDir: OUT_DIR }, null, 2));
}

main().catch((e) => { console.error("FAILED:", e.message); process.exit(1); });
