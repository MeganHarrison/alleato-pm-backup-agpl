#!/usr/bin/env node

/**
 * Re-attribute mis-linked Acumatica invoices off a "catch-all shell" commitment
 * back to their CORRECT commitment on the same project (dry-run by default).
 *
 * BACKGROUND (SC-000316, Goodwill Bloomington 24-109): an Acumatica AP sync dumped a
 * whole project's AP bills onto one $6,500 shell commitment (1 SOV line, cost code
 * 31-5000, no vendor). 142 invoices / $1.13M spanning 33 cost codes ended up linked to
 * `subcontract_id = <shell>`. This tool re-points each `subcontractor_invoices` row to the
 * commitment its AP bill actually belongs to, using two INDEPENDENT identifiers per bill:
 *
 *   1. VENDOR  — `acumatica_ap_bills.vendor_id` (short text, e.g. "C&S HEATIN") mapped to the
 *      commitment vendor. (The bill's `company_id` is the project OWNER, not the sub — unusable.)
 *   2. COST CODE — the dominant REAL cost code on `acumatica_ap_bill_lines` (ignoring the "{}"
 *      garbage retainage code) mapped to the commitment whose SOV carries that code.
 *
 * The free-text description (which leads with a JobPlanner PayApp number like "SC-2603-0006 …")
 * is used only as a weak corroborator — it does NOT string-match the app's Acumatica commitment
 * numbers (SC-000xxx) and a single JP number can span multiple vendors, so it is never the key.
 *
 * CONFIDENCE TIERS (only AUTO + STRONG are re-pointed; FLAG is left on the shell):
 *   AUTO   — description has a JP SC/PO token AND (vendor & cost code agree on ONE commitment,
 *            or a unique specific cost code with no vendor conflict, or vendor known + only the
 *            "{}" code available with no conflicting real code).
 *   STRONG — no usable token, but vendor AND cost code INDEPENDENTLY resolve to the SAME single
 *            commitment (two agreeing identifiers = not a guess).
 *   FLAG   — no commitment, cost-code collision unresolved, signals disagree, or a shared/GC
 *            cost code (01-xxxx general conditions, 50-/52-xxxx professional fees, etc.). These
 *            are genuine direct costs or truly ambiguous — left on the shell for manual review.
 *
 * After --apply, re-run scripts/jobplanner/import-commitment-billed.mjs so billed_to_date lands
 * on the real commitments (its >2x guardrail now passes because amounts match their contracts).
 *
 * Usage:
 *   node scripts/jobplanner/reattribute-shell-invoices.mjs \
 *     --shell=225fbd2d-9a42-4895-8183-2331d49ad8d4 --project=24109        # dry run (report only)
 *   node scripts/jobplanner/reattribute-shell-invoices.mjs --shell=... --project=... --apply
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

const arg = (name) => { const p = process.argv.find((a) => a.startsWith(`--${name}=`)); return p ? p.split("=")[1] : null; };
const APPLY = process.argv.includes("--apply");
const SHELL_ID = arg("shell") || "225fbd2d-9a42-4895-8183-2331d49ad8d4";
const PROJECT_ID = Number(arg("project") || 24109);
const OUT_DIR = path.join(repoRoot, `docs/ops/evidence/2026-07-09-shell-reattribution/${SHELL_ID.slice(0, 8)}-p${PROJECT_ID}`);

const SUPABASE_URL = process.env.SUPABASE_URL?.trim() || process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() || process.env.SUPABASE_SERVICE_KEY?.trim();
if (!SUPABASE_URL || !SERVICE_KEY) { console.error("Missing Supabase service env"); process.exit(1); }

const dash = (c) => { const s = String(c || "").trim(); return /^\d{6}$/.test(s) ? `${s.slice(0, 2)}-${s.slice(2)}` : s; };
const codePart = (b) => String(b || "").split(".")[0].trim();
const round2 = (n) => Math.round(n * 100) / 100;
const isRealCode = (c) => /^\d{2}-\d{4}$/.test(String(c || ""));
// General-conditions / professional-fee cost codes that are NOT subcontract scopes — never a commitment key on their own.
const isGcCode = (c) => /^01-/.test(String(c || "")) || /^5[02]-/.test(String(c || ""));
function leadToken(desc) {
  const m = String(desc || "").trim().match(/^((?:SC|PO)-?\s?[0-9]{3,5}-[0-9]{3,5})/i);
  return m ? m[1].toUpperCase().replace(/\s/g, "").replace(/^SC(?=\d)/, "SC-").replace(/^PO(?=\d)/, "PO-") : null;
}
const norm = (s) => String(s || "").toUpperCase().replace(/[^A-Z0-9 ]/g, " ").replace(/\b(INC|LLC|LTD|CO|CORP|CORPORATION|COMPANY|THE|AND)\b/g, " ").replace(/\s+/g, " ").trim();

async function main() {
  const sb = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

  // --- commitments on the project (subcontracts + purchase_orders), excl. the shell ---
  const tables = [
    { table: "subcontracts", sov: "subcontract_sov_items", fk: "subcontract_id", kind: "sub" },
    { table: "purchase_orders", sov: "purchase_order_sov_items", fk: "purchase_order_id", kind: "po" },
  ];
  const commits = []; // {id, contract_number, kind, fk, sovTable, vendorId, vendorName, codes:Set, total}
  for (const t of tables) {
    const { data: rows } = await sb.from(t.table).select("id, contract_number, title, contract_company_id, deleted_at").eq("project_id", PROJECT_ID);
    const active = (rows ?? []).filter((r) => !r.deleted_at && r.id !== SHELL_ID);
    if (!active.length) continue;
    const { data: sov } = await sb.from(t.sov).select(`${t.fk}, budget_code, amount`).in(t.fk, active.map((r) => r.id));
    const byCommit = new Map();
    for (const s of sov ?? []) {
      const id = s[t.fk];
      if (!byCommit.has(id)) byCommit.set(id, { codes: new Set(), total: 0, codeAmt: new Map() });
      const code = codePart(s.budget_code);
      byCommit.get(id).codes.add(code);
      byCommit.get(id).total += Number(s.amount || 0);
      if (isRealCode(code)) byCommit.get(id).codeAmt.set(code, (byCommit.get(id).codeAmt.get(code) || 0) + Number(s.amount || 0));
    }
    for (const r of active) {
      const agg = byCommit.get(r.id) || { codes: new Set(), total: 0, codeAmt: new Map() };
      const primaryCode = [...agg.codeAmt.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] || null;
      commits.push({ id: r.id, contract_number: r.contract_number, title: r.title, kind: t.kind, fk: t.fk, sovTable: t.sov, table: t.table, vendorId: r.contract_company_id, codes: agg.codes, primaryCode, total: agg.total });
    }
  }
  const companyIds = [...new Set(commits.map((c) => c.vendorId).filter(Boolean))];
  const { data: comps } = await sb.from("companies").select("id, name").in("id", companyIds.length ? companyIds : ["00000000-0000-0000-0000-000000000000"]);
  const compName = new Map((comps ?? []).map((c) => [c.id, c.name]));
  for (const c of commits) c.vendorName = compName.get(c.vendorId) || null;
  const commitById = new Map(commits.map((c) => [c.id, c]));

  // Each commitment's PRIMARY code = its single largest-amount real SOV code. Keying on the
  // primary code (not every code) removes false collisions: e.g. 26-1000 is SC-000217's primary
  // but only SC-000302's tiny secondary, so 26-1000 → SC-000217 alone. A code shared as the
  // PRIMARY of two commitments (Rock Solid 04-2200 on SC-000159 & SC-000152) stays a real
  // collision and is left for manual review.
  const commitByNumber = new Map(commits.map((c) => [String(c.contract_number).toUpperCase(), c]));
  const codeToCommit = new Map(); // primary code -> [commitments]
  for (const c of commits) {
    if (c.primaryCode && isRealCode(c.primaryCode)) {
      if (!codeToCommit.has(c.primaryCode)) codeToCommit.set(c.primaryCode, []);
      codeToCommit.get(c.primaryCode).push(c);
    }
  }

  // --- invoices on the shell (linked via EITHER FK, since the shell may be a sub or a PO) ---
  const { data: shellInvs } = await sb.from("subcontractor_invoices")
    .select("id, invoice_number, notes, acumatica_ap_bill_id, subcontract_id, purchase_order_id")
    .or(`subcontract_id.eq.${SHELL_ID},purchase_order_id.eq.${SHELL_ID}`);
  const billIds = [...new Set((shellInvs ?? []).map((i) => i.acumatica_ap_bill_id).filter(Boolean))];
  const { data: bills } = await sb.from("acumatica_ap_bills").select("id, description, vendor_id, vendor_ref, amount").in("id", billIds.length ? billIds : [-1]);
  const billById = new Map((bills ?? []).map((b) => [b.id, b]));
  const { data: blines } = await sb.from("acumatica_ap_bill_lines").select("bill_id, cost_code, amount, extended_cost").in("bill_id", billIds.length ? billIds : [-1]);
  const linesByBill = new Map();
  for (const l of blines ?? []) { if (!linesByBill.has(l.bill_id)) linesByBill.set(l.bill_id, []); linesByBill.get(l.bill_id).push(l); }

  // Resolve a vendor_id (short Acumatica text like "C&S HEATIN") to a commitment. A vendor is
  // AUTHORITATIVE when it maps to EXACTLY ONE commitment on the project — then any AP bill from
  // that vendor deterministically belongs to that commitment (subcontract PayApps + retainage).
  // Evidence order: (1) bills' primary-code hits, (2) unique vendor-name match. Vendors that map
  // to two commitments (Rock Solid → SC-000159 & SC-000152) or none (direct-cost vendors like
  // K&S / UNIREN / KIMHOR) are NOT authoritative and fall through to FLAG.
  const vendorEvidence = new Map(); // vendor_id -> Map(commitId -> weight) from primary-code hits
  for (const b of bills ?? []) {
    const lines = linesByBill.get(b.id) || [];
    const codeW = new Map();
    for (const l of lines) { const c = dash(l.cost_code); if (isRealCode(c)) codeW.set(c, (codeW.get(c) || 0) + Number(l.amount ?? l.extended_cost ?? 0)); }
    for (const [code, w] of codeW) {
      const cand = codeToCommit.get(code);
      if (cand && cand.length === 1) {
        if (!vendorEvidence.has(b.vendor_id)) vendorEvidence.set(b.vendor_id, new Map());
        const m = vendorEvidence.get(b.vendor_id);
        m.set(cand[0].id, (m.get(cand[0].id) || 0) + w);
      }
    }
  }
  const nameFuzzy = (vendorId) => { // returns the unique name-matched commitment, or null if 0/>1
    const v = norm(vendorId).replace(/ /g, "");
    if (v.length < 3) return null;
    const hits = [];
    for (const c of commits) {
      if (!c.vendorName) continue;
      const words = norm(c.vendorName).split(" ").filter((w) => w.length > 3);
      const compact = norm(c.vendorName).replace(/ /g, "");
      let score = words.filter((w) => v.includes(w) || w.includes(v.slice(0, Math.max(4, w.length)))).length;
      if (compact.startsWith(v.slice(0, 5)) || v.startsWith(compact.slice(0, 5))) score += 1;
      if (score >= 1) hits.push({ c, score });
    }
    hits.sort((a, b) => b.score - a.score);
    if (hits.length && (hits.length === 1 || hits[0].score > hits[1].score)) return hits[0].c;
    return null; // ambiguous name (e.g. two commitments same vendor) -> not authoritative
  };
  const vendorToCommit = new Map(); // vendor_id -> authoritative commitment (exactly one)
  const allBillVendors = new Set((bills ?? []).map((b) => b.vendor_id));
  for (const vid of allBillVendors) {
    const ev = vendorEvidence.get(vid);
    if (ev && ev.size === 1) { vendorToCommit.set(vid, commitById.get([...ev.keys()][0])); continue; }
    if (ev && ev.size > 1) continue; // vendor's bills hit >1 commitment primary code -> ambiguous
    const nf = nameFuzzy(vid); // no code evidence -> unique name match only
    if (nf) vendorToCommit.set(vid, nf);
  }

  // --- per-bill resolution ---
  const plan = [];
  for (const inv of shellInvs ?? []) {
    const b = billById.get(inv.acumatica_ap_bill_id);
    const desc = b?.description ?? inv.notes ?? "";
    const token = leadToken(desc) || leadToken(inv.notes);
    const lines = linesByBill.get(inv.acumatica_ap_bill_id) || [];
    const codeW = new Map();
    for (const l of lines) { const c = dash(l.cost_code); if (isRealCode(c)) codeW.set(c, (codeW.get(c) || 0) + Number(l.amount ?? l.extended_cost ?? 0)); }
    const realCodes = [...codeW.entries()].sort((a, b) => b[1] - a[1]);
    const domCode = realCodes[0]?.[0] || null; // dominant REAL cost code (ignores "{}" retainage)

    const codeCand = domCode ? (codeToCommit.get(domCode) || []) : [];   // by PRIMARY-code map
    const codeCommit = codeCand.length === 1 ? codeCand[0] : null;
    const vendorCommit = vendorToCommit.get(b?.vendor_id) || null;        // authoritative vendor→commitment
    // Does the bill's real code contradict the vendor's commitment? Only a true conflict when the
    // code is NOT one of that commitment's own SOV codes AND it is unmistakably another
    // commitment's primary code. A bill on the vendor-commitment's own secondary code (e.g. Quality
    // Roofing's 52-3000, Central Security's 28-4600) is NOT a conflict.
    const codeElsewhere = domCode ? (codeToCommit.get(domCode) || []).filter((c) => c.id !== vendorCommit?.id) : [];
    const codeConflicts = !!(vendorCommit && domCode && !vendorCommit.codes.has(domCode) && codeElsewhere.length > 0);

    // Strongest signal: the description token IS an active commitment number on this project
    // (e.g. Westfield's "SC-2403-0009" mis-linked onto PO-2403-0009). Trust it unless the
    // authoritative vendor points elsewhere.
    const tokenCommit = token ? commitByNumber.get(token) : null;

    let tier = "FLAG", target = null, reason = "";
    const agree = vendorCommit && codeCommit && vendorCommit.id === codeCommit.id;
    const disagree = vendorCommit && codeCommit && vendorCommit.id !== codeCommit.id;

    if (tokenCommit && (!vendorCommit || vendorCommit.id === tokenCommit.id)) { tier = "AUTO"; target = tokenCommit; reason = `token ${token} == commitment ${tokenCommit.contract_number}${vendorCommit ? " (vendor agrees)" : ""}`; }
    else if (tokenCommit && vendorCommit && vendorCommit.id !== tokenCommit.id) { reason = `token ${token}→${tokenCommit.contract_number} but vendor ${b?.vendor_id}→${vendorCommit.contract_number} disagree`; }
    else if (agree) { tier = token ? "AUTO" : "STRONG"; target = codeCommit; reason = `vendor(${b.vendor_id})+code(${domCode}) agree`; }
    else if (disagree) { reason = `DISAGREE vendor→${vendorCommit.contract_number} vs code ${domCode}→${codeCommit.contract_number}`; }
    else if (token && vendorCommit && !codeConflicts) { tier = "AUTO"; target = vendorCommit; reason = `token + vendor ${b.vendor_id}→${vendorCommit.contract_number}${domCode ? ` (code ${domCode})` : " ({} retainage)"}`; }
    else if (token && codeCommit && !vendorCommit) { tier = "AUTO"; target = codeCommit; reason = `token + unique primary code ${domCode}→${codeCommit.contract_number}`; }
    else if (!token && vendorCommit && !codeConflicts) { tier = "STRONG"; target = vendorCommit; reason = `vendor ${b.vendor_id}→${vendorCommit.contract_number} (sole commitment for vendor)${domCode ? ` code ${domCode}` : " {} retainage"}`; }
    else if (codeConflicts) { reason = `code ${domCode} conflicts with vendor ${b.vendor_id}→${vendorCommit.contract_number} (primary ${vendorCommit.primaryCode})`; }
    else if (domCode && codeCand.length > 1) { reason = `cost-code collision ${domCode} → ${codeCand.map((c) => c.contract_number).join("/")}`; }
    else if (!token && codeCommit && !vendorCommit) { reason = `code-only ${domCode}→${codeCommit.contract_number}, no token, vendor ${b?.vendor_id} not tied to a commitment`; }
    else { const nf = nameFuzzy(b?.vendor_id); reason = `no commitment (vendor ${b?.vendor_id}, code ${domCode || "{} only"})${nf ? `; name suggests ${nf.contract_number}` : " — likely direct cost"}`; }

    plan.push({
      invoice_id: inv.id, invoice_number: inv.invoice_number, amount: Number(b?.amount || 0),
      vendor_id: b?.vendor_id, desc, token, domCode,
      tier, target_id: target?.id || null, target_number: target?.contract_number || null, target_fk: target?.fk || null, target_table: target?.table || null,
      reason,
    });
  }

  // --- tallies ---
  const byTier = { AUTO: [], STRONG: [], FLAG: [] };
  for (const p of plan) byTier[p.tier].push(p);
  const perTarget = new Map();
  for (const p of [...byTier.AUTO, ...byTier.STRONG]) {
    if (!perTarget.has(p.target_number)) perTarget.set(p.target_number, { count: 0, amount: 0, target_id: p.target_id, contract: commitById.get(p.target_id)?.total || 0 });
    const t = perTarget.get(p.target_number); t.count++; t.amount += p.amount;
  }

  console.log(`\n=== RE-ATTRIBUTION PLAN — shell ${SHELL_ID} (project ${PROJECT_ID}) ===`);
  console.log(`Mode: ${APPLY ? "APPLY" : "DRY RUN"}`);
  console.log(`Invoices on shell: ${plan.length}  |  AUTO: ${byTier.AUTO.length}  STRONG: ${byTier.STRONG.length}  FLAG: ${byTier.FLAG.length}`);
  const sum = (arr) => round2(arr.reduce((a, p) => a + p.amount, 0));
  console.log(`$ AUTO: ${sum(byTier.AUTO).toLocaleString()}  STRONG: ${sum(byTier.STRONG).toLocaleString()}  FLAG: ${sum(byTier.FLAG).toLocaleString()}  TOTAL: ${sum(plan).toLocaleString()}`);

  console.log(`\n--- Re-point targets (AUTO+STRONG) ---`);
  for (const [num, t] of [...perTarget.entries()].sort((a, b) => b[1].amount - a[1].amount)) {
    const over = t.contract > 0 && t.amount > t.contract * 1.05 ? `  ⚠ billed>${(t.amount / t.contract).toFixed(1)}x contract $${round2(t.contract).toLocaleString()}` : "";
    console.log(`  ${String(num).padEnd(12)} invoices=${String(t.count).padStart(2)} $${round2(t.amount).toLocaleString().padStart(13)}  (contract $${round2(t.contract).toLocaleString()})${over}`);
  }

  console.log(`\n--- FLAGGED for manual review (${byTier.FLAG.length}, $${sum(byTier.FLAG).toLocaleString()}) ---`);
  for (const p of byTier.FLAG.sort((a, b) => b.amount - a.amount)) {
    console.log(`  inv${p.invoice_id} #${p.invoice_number} $${String(round2(p.amount)).padStart(9)} vend=${String(p.vendor_id).padEnd(11)} ${p.reason} | "${String(p.desc).slice(0, 50)}"`);
  }

  // --- write evidence ---
  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.writeFileSync(path.join(OUT_DIR, "plan.json"), JSON.stringify({ shell: SHELL_ID, project: PROJECT_ID, mode: APPLY ? "APPLY" : "DRY_RUN", counts: { auto: byTier.AUTO.length, strong: byTier.STRONG.length, flag: byTier.FLAG.length }, perTarget: [...perTarget.entries()].map(([num, t]) => ({ target: num, count: t.count, amount: round2(t.amount), contract: round2(t.contract) })), plan }, null, 2) + "\n");
  const csv = ["invoice_id,invoice_number,amount,vendor_id,tier,target_number,dom_code,reason,description",
    ...plan.map((p) => [p.invoice_id, p.invoice_number, round2(p.amount), p.vendor_id, p.tier, p.target_number || "", p.domCode || "", `"${String(p.reason).replace(/"/g, "'")}"`, `"${String(p.desc).replace(/"/g, "'").slice(0, 80)}"`].join(","))];
  fs.writeFileSync(path.join(OUT_DIR, "reattribution.csv"), csv.join("\n") + "\n");
  console.log(`\nEvidence written to ${path.relative(repoRoot, OUT_DIR)}/ (plan.json, reattribution.csv)`);

  // --- apply ---
  if (APPLY) {
    let moved = 0;
    for (const p of [...byTier.AUTO, ...byTier.STRONG]) {
      if (!p.target_id) continue;
      const update = p.target_fk === "purchase_order_id"
        ? { purchase_order_id: p.target_id, subcontract_id: null }
        : { subcontract_id: p.target_id, purchase_order_id: null };
      const { error } = await sb.from("subcontractor_invoices").update(update).eq("id", p.invoice_id);
      if (error) throw new Error(`update inv ${p.invoice_id} -> ${p.target_number}: ${error.message}`);
      moved++;
    }
    console.log(`\nAPPLIED: re-pointed ${moved} invoices. ${byTier.FLAG.length} left on the shell for manual review.`);
  } else {
    console.log(`\n(Dry run — no writes. Re-run with --apply to move AUTO+STRONG invoices.)`);
  }
}

main().catch((e) => { console.error("FAILED:", e.message); process.exit(1); });
