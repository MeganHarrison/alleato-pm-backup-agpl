#!/usr/bin/env node

/**
 * Surgically align a single commitment's SOV line AMOUNTS to JobPlanner.
 *
 * Use when a commitment's app SOV total drifted from the JobPlanner header but the line
 * STRUCTURE still matches (same count, same descriptions, same order) — i.e. only amounts
 * are wrong. This updates each app SOV item's `amount` to its JobPlanner line amount and
 * nothing else (budget codes, descriptions, line numbers untouched). It refuses to write
 * if the app and JP line sets don't line up 1:1, so it can never scramble a commitment.
 *
 * READ-ONLY unless --apply. Verifies the new app sum equals the JP header to the cent.
 *
 * Usage:
 *   node scripts/jobplanner/fix-commitment-sov-amounts.mjs --jp=8262 --app=877 --number=SC-8262-0003
 *   node scripts/jobplanner/fix-commitment-sov-amounts.mjs --jp=8262 --app=877 --number=SC-8262-0003 --apply
 */

import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const frontendRequire = createRequire(path.join(repoRoot, "frontend", "package.json"));
const dotenv = frontendRequire("dotenv");
const { createClient } = frontendRequire("@supabase/supabase-js");
dotenv.config({ path: path.join(repoRoot, ".env"), quiet: true });
dotenv.config({ path: path.join(repoRoot, "frontend/.env.local"), quiet: true });

const APPLY = process.argv.includes("--apply");
const arg = (n) => { const h = process.argv.find((a) => a.startsWith(`--${n}=`)); return h ? h.slice(n.length + 3) : undefined; };
const JP_PROJECT_ID = Number(arg("jp"));
const APP_PROJECT_ID = Number(arg("app"));
const NUMBER = arg("number");
if (!Number.isInteger(JP_PROJECT_ID) || !Number.isInteger(APP_PROJECT_ID) || !NUMBER) {
  console.error("Usage: --jp=<id> --app=<id> --number=SC-XXXX-XXXX [--apply]");
  process.exit(1);
}

const JP_KEY = process.env.JOBPLANNER_API_KEY?.trim()?.replace(/^["']|["']$/g, "");
const SUPABASE_URL = process.env.SUPABASE_URL?.trim() || process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36";
const jpGet = async (u) => {
  const r = await fetch(`https://api-v2.jobplanner.com${u}`, { headers: { ApiKey: JP_KEY, "User-Agent": UA, Accept: "application/json" } });
  if (!r.ok) throw new Error(`JP ${u} -> ${r.status}`);
  return r.json();
};
const sb = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });
const norm = (s) => String(s || "").trim().toLowerCase().replace(/\s+/g, " ");
const round2 = (n) => Number(Number(n).toFixed(2));

async function main() {
  const isPo = NUMBER.startsWith("PO");
  const table = isPo ? "purchase_orders" : "subcontracts";
  const itemTable = isPo ? "purchase_order_sov_items" : "subcontract_sov_items";
  const fk = isPo ? "purchase_order_id" : "subcontract_id";

  const { data: header } = await sb.from(table).select("id").eq("project_id", APP_PROJECT_ID).eq("contract_number", NUMBER).is("deleted_at", null).maybeSingle();
  if (!header) throw new Error(`app commitment ${NUMBER} not found in project ${APP_PROJECT_ID}`);
  const { data: items } = await sb.from(itemTable).select("id, line_number, amount, description").eq(fk, header.id).order("line_number");

  const jpc = (await jpGet(`/projects/${JP_PROJECT_ID}/commitments`)).find((c) => c.number === NUMBER);
  if (!jpc) throw new Error(`JP commitment ${NUMBER} not found in project ${JP_PROJECT_ID}`);
  const jpLines = await jpGet(`/commitments/${jpc.id}/lineitems`);
  const jpHeader = round2(jpc.amount / 100);

  const appSum = round2((items ?? []).reduce((a, i) => a + Number(i.amount || 0), 0));
  const jpSum = round2(jpLines.reduce((a, l) => a + (l.amount || 0), 0) / 100);
  console.log(`${NUMBER}: app ${items.length} lines $${appSum}  |  JP ${jpLines.length} lines $${jpSum} (header $${jpHeader})`);

  // Guard: JP must be internally consistent, and the line sets must line up 1:1.
  if (jpSum !== jpHeader) throw new Error(`JP inconsistent: lines $${jpSum} != header $${jpHeader} — refusing to write`);
  if (items.length !== jpLines.length) throw new Error(`line count differs (app ${items.length} vs JP ${jpLines.length}) — structure differs, use the full importer, not this tool`);

  // Match each app line to a JP line by position, asserting the descriptions agree.
  const updates = [];
  const mismatches = [];
  for (let i = 0; i < items.length; i++) {
    const a = items[i];
    const j = jpLines[i];
    if (norm(a.description) !== norm(j.description)) { mismatches.push({ pos: i + 1, app: a.description, jp: j.description }); continue; }
    const jpAmt = round2((j.amount || 0) / 100);
    if (round2(a.amount) !== jpAmt) updates.push({ id: a.id, line: a.line_number, desc: a.description, from: round2(a.amount), to: jpAmt });
  }
  if (mismatches.length) {
    console.error(`\nABORT: ${mismatches.length} line(s) don't align by description — will not touch this commitment.`);
    console.table(mismatches);
    process.exit(2);
  }

  console.log(`\n${updates.length} line(s) to correct:`);
  for (const u of updates) console.log(`  L${u.line} "${(u.desc || "").slice(0, 40)}"  $${u.from} -> $${u.to}`);
  const newSum = round2(appSum + updates.reduce((a, u) => a + (u.to - u.from), 0));
  console.log(`\nresulting app total: $${newSum}  (JP header $${jpHeader})  ${newSum === jpHeader ? "✓ ties" : "✗ WOULD NOT TIE"}`);
  if (newSum !== jpHeader) throw new Error("post-fix total would not tie to JP — aborting");

  if (!APPLY) { console.log("\nDRY RUN — re-run with --apply to write."); return; }
  for (const u of updates) {
    const { error } = await sb.from(itemTable).update({ amount: u.to }).eq("id", u.id);
    if (error) throw new Error(`update L${u.line}: ${error.message}`);
  }
  console.log(`\nAPPLIED: ${updates.length} lines corrected. ${NUMBER} now $${newSum} = JP.`);
}

main().catch((e) => { console.error(e.message); process.exit(1); });
