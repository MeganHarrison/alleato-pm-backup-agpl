#!/usr/bin/env node

/**
 * Audit (and, when explicitly told, correct) cross-project mis-attribution on
 * Acumatica-originated cost rows — where a row's free-text DESCRIPTION names a
 * DIFFERENT project than its `project_id`.
 *
 * ── Why this exists ─────────────────────────────────────────────────────────
 * During the 2026-07-09 Noblesville subcontractor-invoice triage we found two
 * Renascent (waste hauler) bills posted to Goodwill Noblesville (project 25125)
 * whose descriptions read "… Westfield Collective …" — a DIFFERENT active project
 * (id 43, job 24-115). The bill was coded to the wrong Project in Acumatica; our
 * sync faithfully mirrors that mis-coding into `acumatica_ap_bills.project_id`
 * and the projected `direct_costs.project_id`.
 *
 * ── Detection (conservative on purpose) ─────────────────────────────────────
 * A description "mentions another project" ONLY when it contains that project's
 * FULL multi-token name (all significant tokens present) OR its project number
 * (NN-NNN). We deliberately DO NOT match single tokens: "Westfield" is also a
 * CITY, so "Crate Escapes - Westfield Dog Park & Bar" (project 53, Crate Escapes)
 * is CORRECTLY posted and must NOT be flagged. Requiring the full phrase
 * "westfield collective" avoids that entire false-positive class.
 *
 * A row is FLAGGED only when:
 *   - some OTHER project's full name-phrase or project number appears in the desc, AND
 *   - the row's OWN project name-phrase / number does NOT appear in the desc.
 * Confidence: HIGH when matched via the other project's number (NN-NNN),
 *             MEDIUM when matched via the full name phrase only.
 * "GW" is alias-expanded to "GOODWILL" before matching.
 *
 * A flag is a SUSPECT for human review — NOT proof. The report is the deliverable.
 *
 * ── Durability caveat (READ BEFORE --apply) ─────────────────────────────────
 * `acumatica_sync._sync_ap_bills` re-derives project_id from the Acumatica bill's
 * `Project` field and re-upserts BOTH `acumatica_ap_bills` (on external_key) and
 * `direct_costs` (on acumatica_document_key) EVERY sync. The sync is incremental
 * (`modified_after=cursor`), so a re-point on an old/closed bill persists in
 * practice — UNTIL that bill is modified in Acumatica again or a full backfill
 * runs, at which point it SILENTLY REVERTS. The authoritative fix is to correct
 * the bill's Project in Acumatica. The durable in-app guardrail is an override the
 * sync consults (see docs/ops/evidence/.../README.md → "Guardrail").
 *
 * ── Usage ───────────────────────────────────────────────────────────────────
 *   node scripts/acumatica/audit-cross-project-attribution.mjs                 # full dry-run audit → report
 *   node scripts/acumatica/audit-cross-project-attribution.mjs --vendor=RENASCENT
 *   node scripts/acumatica/audit-cross-project-attribution.mjs --apply --refs=002571,002592
 *     → re-points ONLY the listed reference_nbrs (reviewed allowlist) on BOTH
 *       acumatica_ap_bills.project_id AND direct_costs.project_id to the project
 *       named in the description. Never bulk-applies. Prints the revert caveat.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const __filename = fileURLToPath(import.meta.url);
const repoRoot = path.resolve(path.dirname(__filename), "../..");
const req = createRequire(path.join(repoRoot, "frontend", "package.json"));
const dotenv = req("dotenv");
const { createClient } = req("@supabase/supabase-js");
for (const p of [".env", ".env.local", "frontend/.env.local"]) {
  dotenv.config({ path: path.join(repoRoot, p), quiet: true });
}

const arg = (name) => {
  const p = process.argv.find((a) => a.startsWith(`--${name}=`));
  return p ? p.split("=")[1] : null;
};
const APPLY = process.argv.includes("--apply");
const APPLY_REFS = new Set((arg("refs") || "").split(",").map((s) => s.trim()).filter(Boolean));
const ONLY_VENDOR = (arg("vendor") || "").trim().toUpperCase() || null;
const OUT_DIR = path.join(repoRoot, "docs/ops/evidence/2026-07-09-cross-project-attribution-audit");

const SUPABASE_URL = process.env.SUPABASE_URL?.trim() || process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() || process.env.SUPABASE_SERVICE_KEY?.trim();
if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error("Missing Supabase service env (SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY)");
  process.exit(1);
}
if (APPLY && APPLY_REFS.size === 0) {
  console.error("--apply requires a reviewed allowlist: --refs=002571,002592 (never bulk-applies).");
  process.exit(1);
}

// Generic tokens that carry no project identity — dropping them prevents matching on filler.
const STOP = new Set(["THE", "OF", "AND", "A", "IN", "RD", "ROAD", "ST", "AVE", "LLC", "INC", "CO", "CORP"]);
const normalize = (s) =>
  String(s || "")
    .toUpperCase()
    .replace(/\bGW\b/g, "GOODWILL") // alias: "GW Noblesville" → "GOODWILL NOBLESVILLE"
    .replace(/[^A-Z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
const sigTokens = (name) => normalize(name).split(" ").filter((t) => t.length >= 3 && !STOP.has(t));
const numberVariants = (num) => {
  const digits = String(num || "").replace(/\D/g, "");
  const dashed = String(num || "").trim();
  return [dashed, digits].filter((v) => v && v.length >= 4);
};

async function main() {
  const sb = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

  // ── Build project signatures ──────────────────────────────────────────────
  const { data: projects, error: pErr } = await sb.from("projects").select("id, name, project_number");
  if (pErr) throw pErr;
  const projName = new Map(projects.map((p) => [p.id, p.name]));
  const sigs = projects
    .map((p) => ({
      id: p.id,
      name: p.name,
      number: p.project_number,
      tokens: sigTokens(p.name), // require ALL of these present to match by name
      numbers: numberVariants(p.project_number),
    }))
    .filter((s) => s.tokens.length >= 2 || s.numbers.length); // <2 distinctive name tokens → number-only

  // For a normalized description, return the set of project ids it names (with how).
  const projectsNamedIn = (descNorm) => {
    const hits = new Map(); // id -> "number" | "name"
    for (const s of sigs) {
      const numHit = s.numbers.some((n) => new RegExp(`\\b${n.replace(/[-]/g, "[- ]?")}\\b`).test(descNorm));
      const nameHit = s.tokens.length >= 2 && s.tokens.every((t) => new RegExp(`\\b${t}\\b`).test(descNorm));
      if (numHit) hits.set(s.id, "number");
      else if (nameHit && !hits.has(s.id)) hits.set(s.id, "name");
    }
    return hits;
  };

  // ── Pull candidate rows ───────────────────────────────────────────────────
  async function pageAll(table, columns, filter) {
    const rows = [];
    const PAGE = 1000;
    for (let from = 0; ; from += PAGE) {
      let q = sb.from(table).select(columns).range(from, from + PAGE - 1);
      if (filter) q = filter(q);
      const { data, error } = await q;
      if (error) throw error;
      rows.push(...(data ?? []));
      if (!data || data.length < PAGE) break;
    }
    return rows;
  }

  const apBills = await pageAll(
    "acumatica_ap_bills",
    "id, reference_nbr, description, project_id, project_code, amount, vendor_id, document_type",
    (q) => (ONLY_VENDOR ? q.eq("vendor_id", ONLY_VENDOR) : q),
  );
  const directCosts = await pageAll(
    "direct_costs",
    "id, acumatica_ref_nbr, acumatica_document_key, description, project_id, total_amount, vendor_id, is_deleted",
    (q) => q.not("acumatica_ref_nbr", "is", null),
  );

  // ── Evaluate ──────────────────────────────────────────────────────────────
  function evaluate(row, kind) {
    const desc = row.description || "";
    const descNorm = normalize(desc);
    if (!descNorm) return null;
    const named = projectsNamedIn(descNorm);
    if (named.size === 0) return null;
    const ownId = row.project_id;
    const ownNamed = ownId != null && named.has(ownId);
    // Other projects named (excluding own)
    const others = [...named.entries()].filter(([id]) => id !== ownId);
    if (others.length === 0) return null; // desc only names its own project → correct
    if (ownNamed) return null; // desc names BOTH own and another → ambiguous, don't flag
    // Pick the strongest single suggested project (prefer number match)
    others.sort((a, b) => (a[1] === "number" ? -1 : 1) - (b[1] === "number" ? -1 : 1));
    const [suggestedId, via] = others[0];
    const ambiguous = new Set(others.map(([id]) => id)).size > 1;
    return {
      kind,
      ref: kind === "ap_bill" ? row.reference_nbr : row.acumatica_ref_nbr,
      row_id: row.id,
      vendor_id: row.vendor_id,
      current_project_id: ownId,
      current_project_name: ownId != null ? projName.get(ownId) ?? null : null,
      suggested_project_id: suggestedId,
      suggested_project_name: projName.get(suggestedId) ?? null,
      matched_via: via,
      amount: kind === "ap_bill" ? row.amount : row.total_amount,
      is_deleted: kind === "direct_cost" ? row.is_deleted : undefined,
      confidence: via === "number" ? "HIGH" : "MEDIUM",
      ambiguous, // more than one other project named → needs careful review
      description: desc,
    };
  }

  const findings = [];
  for (const b of apBills) {
    const f = evaluate(b, "ap_bill");
    if (f) findings.push(f);
  }
  for (const d of directCosts) {
    const f = evaluate(d, "direct_cost");
    if (f) findings.push(f);
  }

  // Also surface unassigned (project_id null) rows whose desc names exactly one project — assignable.
  const unassigned = apBills
    .filter((b) => b.project_id == null && b.description)
    .map((b) => {
      const named = projectsNamedIn(normalize(b.description));
      if (named.size !== 1) return null;
      const [id] = [...named.keys()];
      return { ref: b.reference_nbr, row_id: b.id, vendor_id: b.vendor_id, amount: b.amount, suggested_project_id: id, suggested_project_name: projName.get(id) ?? null, description: b.description };
    })
    .filter(Boolean);

  findings.sort(
    (a, b) =>
      Number(b.confidence === "HIGH") - Number(a.confidence === "HIGH") ||
      String(a.suggested_project_name).localeCompare(String(b.suggested_project_name)) ||
      String(a.ref).localeCompare(String(b.ref)),
  );

  // ── Report ────────────────────────────────────────────────────────────────
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const stamp = new Date().toISOString();
  const summary = {
    generated_at: stamp,
    scope: ONLY_VENDOR ? `vendor=${ONLY_VENDOR}` : "all Acumatica-originated ap_bills + direct_costs",
    ap_bills_scanned: apBills.length,
    direct_costs_scanned: directCosts.length,
    findings: findings.length,
    unassigned_assignable: unassigned.length,
  };
  fs.writeFileSync(path.join(OUT_DIR, "findings.json"), JSON.stringify({ summary, findings, unassigned }, null, 2));

  const md = [];
  md.push(`# Cross-project mis-attribution audit — dry run`);
  md.push(`\nGenerated: ${stamp}`);
  md.push(`Scope: ${summary.scope}`);
  md.push(`Scanned: ${apBills.length} ap_bills, ${directCosts.length} direct_costs (acumatica-originated).`);
  md.push(`\n**${findings.length} suspected mis-attributions** (description names a different project than \`project_id\`).\n`);
  md.push(`| conf | kind | ref | vendor | current project | → named in description | amount | description |`);
  md.push(`|------|------|-----|--------|-----------------|------------------------|--------|-------------|`);
  for (const f of findings) {
    md.push(
      `| ${f.confidence}${f.ambiguous ? "⚠" : ""} | ${f.kind} | ${f.ref} | ${f.vendor_id ?? ""} | ${f.current_project_id} ${f.current_project_name ?? ""} | ${f.suggested_project_id} ${f.suggested_project_name} (${f.matched_via}) | $${f.amount ?? 0} | ${String(f.description).replace(/\|/g, "/").slice(0, 80)} |`,
    );
  }
  if (unassigned.length) {
    md.push(`\n## Unassigned (project_id NULL) — description names exactly one project (assignable)\n`);
    md.push(`| ref | vendor | → project | amount | description |`);
    md.push(`|-----|--------|-----------|--------|-------------|`);
    for (const u of unassigned) md.push(`| ${u.ref} | ${u.vendor_id ?? ""} | ${u.suggested_project_id} ${u.suggested_project_name} | $${u.amount ?? 0} | ${String(u.description).replace(/\|/g, "/").slice(0, 80)} |`);
  }
  fs.writeFileSync(path.join(OUT_DIR, "REPORT.md"), md.join("\n") + "\n");

  console.log(JSON.stringify(summary, null, 2));
  console.log(`\nReport → ${path.relative(repoRoot, path.join(OUT_DIR, "REPORT.md"))}`);
  console.log(`\n${findings.length} findings:`);
  for (const f of findings) {
    console.log(
      `  [${f.confidence}${f.ambiguous ? "⚠" : ""}] ${f.kind} ${f.ref} | proj ${f.current_project_id} (${f.current_project_name}) → ${f.suggested_project_id} (${f.suggested_project_name}) via ${f.matched_via} | $${f.amount} | ${f.description}`,
    );
  }

  // ── Apply (reviewed allowlist only) ───────────────────────────────────────
  if (!APPLY) {
    console.log(`\nDRY RUN. To correct reviewed rows: --apply --refs=<comma,separated,reference_nbrs>`);
    return;
  }

  console.log(`\n⚠ APPLY MODE — reviewed allowlist: ${[...APPLY_REFS].join(", ")}`);
  console.log(`⚠ REVERT RISK: acumatica sync re-derives project_id from the Acumatica bill's Project field.`);
  console.log(`  This correction persists only until the bill is modified in Acumatica or a full backfill runs.`);
  console.log(`  Authoritative fix = correct the bill's Project in Acumatica. See README → Guardrail.\n`);

  const applied = [];
  for (const ref of APPLY_REFS) {
    // A ref can produce >1 finding (its ap_bill row + one or more direct_cost rows).
    // Target each finding by its EXACT row id — acumatica_ref_nbr is NOT unique in
    // direct_costs (duplicates exist), so a ref-scoped UPDATE could move the wrong row.
    const refFindings = findings.filter((x) => String(x.ref) === ref);
    if (refFindings.length === 0) {
      console.log(`  SKIP ${ref} — not in current findings (not a detected suspect); refusing to move.`);
      continue;
    }
    if (refFindings.some((f) => f.ambiguous)) {
      console.log(`  SKIP ${ref} — ambiguous (names >1 other project); resolve manually.`);
      continue;
    }
    const suggestions = new Set(refFindings.map((f) => f.suggested_project_id));
    if (suggestions.size > 1) {
      console.log(`  SKIP ${ref} — findings disagree on target project (${[...suggestions].join(", ")}); resolve manually.`);
      continue;
    }
    const moved = { ref, ap_bills: [], direct_costs: [] };
    for (const f of refFindings) {
      const table = f.kind === "ap_bill" ? "acumatica_ap_bills" : "direct_costs";
      const { data: upd, error: uErr } = await sb
        .from(table)
        .update({ project_id: f.suggested_project_id })
        .eq("id", f.row_id)
        .eq("project_id", f.current_project_id) // optimistic guard: only if still on the mis-attributed project
        .select("id, project_id");
      if (uErr) throw uErr;
      (f.kind === "ap_bill" ? moved.ap_bills : moved.direct_costs).push(...(upd ?? []));
      console.log(`  MOVED ${f.kind} row ${f.row_id} → project ${f.suggested_project_id} (${f.suggested_project_name}): ${upd?.length ?? 0} row(s)`);
    }
    applied.push(moved);
  }
  fs.writeFileSync(path.join(OUT_DIR, `applied-${stamp.slice(0, 10)}.json`), JSON.stringify({ stamp, applied }, null, 2));
  console.log(`\nApplied ${applied.length} refs. Log → ${path.relative(repoRoot, path.join(OUT_DIR, `applied-${stamp.slice(0, 10)}.json`))}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
