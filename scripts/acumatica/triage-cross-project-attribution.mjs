#!/usr/bin/env node
/**
 * Triage the cross-project-attribution findings: for EACH flagged row, decide
 * whether it is (a) a DUPLICATE of a row already correctly posted on the
 * suggested project, or (b) a genuine MIS-ATTRIBUTION with no counterpart on the
 * suggested project (→ re-point).
 *
 * Read-only. Produces docs/ops/evidence/.../TRIAGE.md + triage.json.
 *
 * Duplicate evidence, strongest → weakest:
 *   D1  direct_costs.acumatica_document_key already present on suggested project
 *   D2  same (vendor_id, round(total_amount,2), date) present on suggested project
 *   D3  same acumatica_ref_nbr present on suggested project (weaker: ref not unique)
 *   ap_bills: A1 same external_key on suggested project (should never happen — unique)
 *            A2 same (vendor_id, amount, date, reference_nbr) present on suggested project
 * Also flags WITHIN-project exact duplicates (two identical rows both on current project).
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
for (const p of [".env", ".env.local", "frontend/.env.local"]) dotenv.config({ path: path.join(repoRoot, p), quiet: true });

const SUPABASE_URL = process.env.SUPABASE_URL?.trim() || process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() || process.env.SUPABASE_SERVICE_KEY?.trim();
const sb = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

const OUT_DIR = path.join(repoRoot, "docs/ops/evidence/2026-07-09-cross-project-attribution-audit");
const { findings } = JSON.parse(fs.readFileSync(path.join(OUT_DIR, "findings.json"), "utf8"));

const norm = (s) => String(s || "").toUpperCase().replace(/[^A-Z0-9]+/g, " ").replace(/\s+/g, " ").trim();
const money = (n) => Math.round(Number(n || 0) * 100) / 100;

async function full(kind, rowId) {
  const table = kind === "ap_bill" ? "acumatica_ap_bills" : "direct_costs";
  const cols =
    kind === "ap_bill"
      ? "id, reference_nbr, external_key, description, project_id, project_code, amount, vendor_id, date, document_type, status"
      : "id, acumatica_ref_nbr, acumatica_document_key, acumatica_doc_type, invoice_number, description, project_id, total_amount, vendor_id, date, is_deleted, status";
  const { data, error } = await sb.from(table).select(cols).eq("id", rowId).single();
  if (error) throw error;
  return data;
}

async function findDupOnTarget(kind, row, targetProject) {
  if (kind === "direct_cost") {
    // D1: same document key on target
    if (row.acumatica_document_key) {
      const { data } = await sb.from("direct_costs").select("id, project_id, total_amount, description, is_deleted, acumatica_document_key")
        .eq("acumatica_document_key", row.acumatica_document_key).eq("project_id", targetProject);
      if (data && data.length) return { level: "D1", key: "acumatica_document_key", matches: data };
    }
    // D2: vendor + amount + date on target
    let q = sb.from("direct_costs").select("id, project_id, total_amount, description, date, vendor_id, is_deleted")
      .eq("project_id", targetProject).eq("total_amount", row.total_amount);
    if (row.vendor_id) q = q.eq("vendor_id", row.vendor_id);
    if (row.date) q = q.eq("date", row.date);
    const { data: d2 } = await q;
    if (d2 && d2.length) return { level: "D2", key: "vendor+amount+date", matches: d2 };
    // D3: same ref on target
    if (row.acumatica_ref_nbr) {
      const { data: d3 } = await sb.from("direct_costs").select("id, project_id, total_amount, description, is_deleted")
        .eq("acumatica_ref_nbr", row.acumatica_ref_nbr).eq("project_id", targetProject);
      if (d3 && d3.length) return { level: "D3", key: "acumatica_ref_nbr", matches: d3 };
    }
  } else {
    // ap_bill A2: vendor+amount+ref on target (external_key is unique so A1 ~never)
    let q = sb.from("acumatica_ap_bills").select("id, project_id, amount, description, reference_nbr, vendor_id, date")
      .eq("project_id", targetProject).eq("reference_nbr", row.reference_nbr);
    const { data } = await q;
    if (data && data.length) return { level: "A2", key: "reference_nbr(on target)", matches: data };
  }
  return null;
}

async function findWithinDup(kind, row) {
  // exact sibling row on SAME project (the doubled rows) — distinct id, same key fields
  if (kind === "direct_cost") {
    let q = sb.from("direct_costs").select("id, total_amount, description, date, vendor_id, acumatica_document_key, is_deleted")
      .eq("project_id", row.project_id).eq("total_amount", row.total_amount).neq("id", row.id);
    if (row.vendor_id) q = q.eq("vendor_id", row.vendor_id);
    if (row.description) q = q.eq("description", row.description);
    const { data } = await q;
    return (data || []).filter((m) => norm(m.description) === norm(row.description));
  }
  return [];
}

const out = [];
for (const f of findings) {
  const row = await full(f.kind, f.row_id);
  const isDeleted = f.kind === "direct_cost" ? row.is_deleted === true : null;
  const dup = f.current_project_id == null ? null : await findDupOnTarget(f.kind, row, f.suggested_project_id);
  const within = await findWithinDup(f.kind, row);
  let disposition;
  if (f.current_project_id == null) disposition = "ASSIGN"; // unassigned → assign to named project
  else if (dup) disposition = "DUPLICATE→SOFT-DELETE"; // counterpart already on target
  else disposition = "REPOINT"; // no counterpart → genuine mis-attribution
  out.push({
    ...f,
    is_deleted: isDeleted,
    doc_key: row.acumatica_document_key ?? null,
    date: row.date ?? null,
    disposition,
    dup_evidence: dup ? { level: dup.level, key: dup.key, target_row_ids: dup.matches.map((m) => m.id), target_deleted: dup.matches.map((m) => m.is_deleted ?? null) } : null,
    within_project_dup_ids: within.map((m) => m.id),
  });
}

// Report
const byDisp = out.reduce((a, x) => ((a[x.disposition] = (a[x.disposition] || 0) + 1), a), {});
const md = [];
md.push(`# Cross-project attribution — TRIAGE (duplicate vs re-point)`);
md.push(`\nGenerated: ${new Date().toISOString()}`);
md.push(`Read-only classification of the ${out.length} findings. NOT applied.\n`);
md.push(`Disposition counts: ${JSON.stringify(byDisp)}\n`);
md.push(`- **DUPLICATE→SOFT-DELETE** — a matching row already exists on the suggested project; the flagged row on the current project is a redundant copy.`);
md.push(`- **REPOINT** — no counterpart on the suggested project; genuine mis-attribution to correct.`);
md.push(`- **ASSIGN** — row currently has NULL project_id; description names exactly one project.\n`);
md.push(`| disp | conf | kind | ref | current → suggested | amount | del? | dup evidence (level: target row ids) | within-dup ids | description |`);
md.push(`|------|------|------|-----|---------------------|--------|------|--------------------------------------|----------------|-------------|`);
for (const x of out) {
  const ev = x.dup_evidence ? `${x.dup_evidence.level}: ${x.dup_evidence.target_row_ids.join(",")}${x.dup_evidence.target_deleted.some(Boolean) ? " (some deleted)" : ""}` : "";
  md.push(`| ${x.disposition} | ${x.confidence}${x.ambiguous ? "⚠" : ""} | ${x.kind} | ${x.ref} | ${x.current_project_id ?? "null"} → ${x.suggested_project_id} ${x.suggested_project_name} | $${x.amount ?? 0} | ${x.is_deleted ? "Y" : ""} | ${ev} | ${x.within_project_dup_ids.join(",")} | ${String(x.description).replace(/\|/g, "/").slice(0, 70)} |`);
}
fs.writeFileSync(path.join(OUT_DIR, "TRIAGE.md"), md.join("\n") + "\n");
fs.writeFileSync(path.join(OUT_DIR, "triage.json"), JSON.stringify(out, null, 2));
console.log(JSON.stringify(byDisp, null, 2));
console.log("\nWrote TRIAGE.md + triage.json");
