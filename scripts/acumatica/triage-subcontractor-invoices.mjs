#!/usr/bin/env node

/**
 * Triage subcontractor invoices that have NO commitment link (no contract company).
 *
 * The AP-bill import created a `subcontractor_invoices` row for EVERY Acumatica AP bill,
 * including non-subcontract costs (architect fees, permits, rentals, staffing, suppliers).
 * Those have no subcontract => no contract company. This tool classifies each orphan:
 *
 *   LINK          — bill description names a subcontract that EXISTS in the app -> set subcontract_id.
 *   DIRECT_COST   — not a subcontract bill (no SC ref, not a pay-app). Recategorize to Direct Costs.
 *                   `dup` = the same Acumatica ref already exists in direct_costs (safe delete),
 *                   otherwise a direct_costs row must be created before removing the invoice.
 *   FLAG_SUB      — looks like a subcontractor pay-app (has "Pay App") but no matching app
 *                   subcontract -> needs a subcontract created/mapped. Never auto-touched.
 *   FLAG_PROJECT  — description names a DIFFERENT project (probable mis-attribution) -> review.
 *
 * DRY RUN by default (writes a report, no DB changes). --apply performs only the SAFE actions
 * (LINK, and DIRECT_COST where dup=true -> soft delete). Non-dup direct costs and all FLAGs are
 * left untouched pending review.
 *
 * Usage:
 *   node scripts/acumatica/triage-subcontractor-invoices.mjs --project=25125
 *   node scripts/acumatica/triage-subcontractor-invoices.mjs --project=25125 --apply
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

const APPLY = process.argv.includes("--apply");
const argValue = (name, fb) => { const h = process.argv.find((a) => a.startsWith(`--${name}=`)); return h ? h.slice(name.length + 3) : fb; };
const PROJECT_ID = Number(argValue("project", NaN));
if (!Number.isInteger(PROJECT_ID)) { console.error("Required: --project=<appProjectId>"); process.exit(1); }
const OUT = argValue("out", path.join(repoRoot, `docs/ops/evidence/2026-07-09-subcontractor-invoice-triage/triage-${PROJECT_ID}.json`));

const SUPABASE_URL = process.env.SUPABASE_URL?.trim() || process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() || process.env.SUPABASE_SERVICE_KEY?.trim();
if (!SUPABASE_URL || !SERVICE_KEY) { console.error("Missing Supabase service env"); process.exit(1); }

const money = (n) => `$${(Number(n) || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const SC_RX = /\bSC-?(\d{3,4})-?(\d{3,4})\b/i;
const PAYAPP_RX = /pay\s?app/i;

async function main() {
  const sb = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

  const { data: subs } = await sb.from("subcontracts").select("id, contract_number").eq("project_id", PROJECT_ID).is("deleted_at", null);
  const scIdByNum = new Map((subs ?? []).map((s) => [String(s.contract_number).toUpperCase(), s.id]));

  const { data: inv, error: invErr } = await sb
    .from("subcontractor_invoices")
    .select("id, subcontract_id, purchase_order_id, acumatica_ap_bill_id, acumatica_ref_nbr, status")
    .eq("project_id", PROJECT_ID);
  if (invErr) throw new Error(`subcontractor_invoices read: ${invErr.message}`);
  const orphans = (inv ?? []).filter((i) => !i.subcontract_id && !i.purchase_order_id && i.acumatica_ap_bill_id);

  const { data: bills } = await sb.from("acumatica_ap_bills").select("id, vendor_id, description, amount").in("id", orphans.map((o) => o.acumatica_ap_bill_id));
  const billById = new Map((bills ?? []).map((b) => [b.id, b]));

  // direct_costs refs already present for this project (dup detection)
  const { data: dcs } = await sb.from("direct_costs").select("acumatica_ref_nbr").eq("project_id", PROJECT_ID);
  const directCostRefs = new Set((dcs ?? []).map((d) => d.acumatica_ref_nbr).filter(Boolean).map(String));

  // other project names (mis-attribution hint)
  const { data: projs } = await sb.from("projects").select("id, name");
  const thisName = (projs ?? []).find((p) => p.id === PROJECT_ID)?.name ?? "";
  const otherNames = (projs ?? [])
    .filter((p) => p.id !== PROJECT_ID && p.name && p.name.length >= 5)
    .map((p) => p.name);

  const decisions = orphans.map((o) => {
    const b = billById.get(o.acumatica_ap_bill_id) ?? {};
    const desc = String(b.description ?? "");
    const m = desc.match(SC_RX);
    const scTok = m ? `SC-${m[1]}-${m[2]}`.toUpperCase() : null;
    const linkTarget = scTok && scIdByNum.has(scTok) ? scTok : null;
    const wrongProj = otherNames.find((n) => desc.toLowerCase().includes(n.toLowerCase()));

    let action, note, dup = false;
    if (linkTarget) { action = "LINK"; note = `desc names ${linkTarget}`; }
    else if (wrongProj) { action = "FLAG_PROJECT"; note = `desc names another project: "${wrongProj}"`; }
    else if (PAYAPP_RX.test(desc)) { action = "FLAG_SUB"; note = "looks like a subcontractor pay-app but no matching app subcontract"; }
    else { dup = directCostRefs.has(String(o.acumatica_ref_nbr)); action = "DIRECT_COST"; note = dup ? "already a Direct Cost (dup) — safe to remove from this tab" : "no matching Direct Cost — would create one, then remove"; }

    return {
      invoiceId: o.id, ref: o.acumatica_ref_nbr, vendor: b.vendor_id ?? null,
      amount: Number(b.amount) || 0, desc: desc.slice(0, 60),
      action, note, linkTarget, dup,
    };
  });

  const by = (a) => decisions.filter((d) => d.action === a);
  const link = by("LINK"), directDup = by("DIRECT_COST").filter((d) => d.dup), directNew = by("DIRECT_COST").filter((d) => !d.dup), flagSub = by("FLAG_SUB"), flagProj = by("FLAG_PROJECT");

  // ---- apply SAFE actions only ----
  // LINK is safe + additive. Removal of DIRECT_COST rows is deferred to a separate
  // reviewed step (--remove-dups): subcontractor_invoices has no soft-delete column,
  // so removing a row means cleaning child line items + a hard delete — done only after
  // the classification below is approved.
  const REMOVE = process.argv.includes("--remove-dups");
  const writes = { linked: 0, removedDup: 0 };
  if (APPLY) {
    for (const d of link) {
      const scId = scIdByNum.get(d.linkTarget);
      const { error } = await sb.from("subcontractor_invoices").update({ subcontract_id: scId }).eq("id", d.invoiceId);
      if (error) throw new Error(`link ${d.ref}: ${error.message}`);
      writes.linked++;
    }
    if (REMOVE) {
      for (const d of directDup) {
        // child cleanup first (no ON DELETE CASCADE assumed), then the invoice row
        await sb.from("subcontractor_invoice_line_items").delete().eq("invoice_id", d.invoiceId);
        const { error } = await sb.from("subcontractor_invoices").delete().eq("id", d.invoiceId);
        if (error) throw new Error(`remove dup ${d.ref}: ${error.message}`);
        writes.removedDup++;
      }
    }
  }

  const report = {
    generatedAt: new Date().toISOString(), projectId: PROJECT_ID, projectName: thisName,
    mode: APPLY ? "APPLIED (safe actions only)" : "DRY-RUN — no writes",
    totals: { orphans: orphans.length, link: link.length, directDup: directDup.length, directNew: directNew.length, flagSub: flagSub.length, flagProject: flagProj.length },
    writes: APPLY ? writes : undefined, decisions,
  };
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, JSON.stringify(report, null, 2));

  const md = [];
  md.push(`# Subcontractor-invoice triage — ${thisName} (${PROJECT_ID}) — ${report.mode}\n`);
  md.push(`Orphans (no commitment / no company): **${orphans.length}**\n`);
  md.push(`- **A. LINK to existing subcontract:** ${link.length}`);
  md.push(`- **B. DIRECT_COST — already a dup (safe remove):** ${directDup.length}`);
  md.push(`- **B'. DIRECT_COST — would create then remove:** ${directNew.length}`);
  md.push(`- **FLAG — probable subcontract, unmapped:** ${flagSub.length}`);
  md.push(`- **FLAG — probable wrong project:** ${flagProj.length}\n`);
  const tbl = (title, rows, extra) => {
    md.push(`## ${title}\n`);
    md.push(`| Acu ref | Vendor | Amount | ${extra} | Description |`);
    md.push(`|---|---|--:|---|---|`);
    for (const d of rows) md.push(`| ${d.ref} | ${d.vendor ?? "—"} | ${money(d.amount)} | ${d.linkTarget ?? (d.dup ? "dup" : d.action === "DIRECT_COST" ? "new" : "")} | ${d.desc} |`);
    md.push("");
  };
  if (link.length) tbl("A. LINK to existing subcontract", link, "→ subcontract");
  if (directDup.length) tbl("B. Direct cost — already exists (safe to remove from this tab)", directDup, "dup?");
  if (directNew.length) tbl("B'. Direct cost — not yet in Direct Costs (create then remove)", directNew, "action");
  if (flagSub.length) tbl("FLAG — probable subcontractor pay-app, no matching subcontract", flagSub, "");
  if (flagProj.length) tbl("FLAG — probable wrong project", flagProj, "");
  fs.writeFileSync(OUT.replace(/\.json$/, ".md"), md.join("\n") + "\n");

  console.log(`\nTriage ${thisName} (${PROJECT_ID}) — ${report.mode}`);
  console.log(`Orphans ${orphans.length}: LINK ${link.length} · DIRECT(dup) ${directDup.length} · DIRECT(new) ${directNew.length} · FLAG_sub ${flagSub.length} · FLAG_proj ${flagProj.length}`);
  if (APPLY) console.log(`Applied: linked ${writes.linked}, removed dup ${writes.removedDup}`);
  console.log(`Report: ${OUT.replace(/\.json$/, ".md")}`);
}

main().catch((e) => { console.error(e.stack || e.message); process.exit(1); });
