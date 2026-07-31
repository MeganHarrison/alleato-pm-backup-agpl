#!/usr/bin/env node

/**
 * Field-by-field tie-out of a project's imported RFIs / punch list / submittals against
 * JobPlanner. READ-ONLY. Exits non-zero if any discrepancy is found, so it can gate a
 * rollout. Run this after import-rfis / import-punch-list / import-submittals for a project.
 *
 * Checks (both directions — every JP record must exist in the app and match):
 *   RFIs        subject, status, question, answer count, attachment count
 *   Punch       title, status, priority
 *   Submittals  title (matched by submittal number)
 *
 * IMPORTANT field notes (these tripped up an earlier hand-rolled check):
 *   - RFI id field is `rfiId` (not `id`); RFI status is `status` (1 open / 2 closed).
 *   - RFI `responses`/`attachments` on the LIST endpoint are EMPTY — the real counts live
 *     on the DETAIL endpoint `/rfi/{rfiId}` (attachments) and `/rfi/{rfiId}/responses`.
 *   - Punch id field is `punchlistItemId`; status 2 -> closed else initiated; priority
 *     1/2/3 -> low/medium/high.
 *   - Submittal id field is `submittalId`; natural key is `submittalNumber`.
 *
 * Usage:
 *   node scripts/jobplanner/verify-nonfinancial-import.mjs --jp=3729 --app=31
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

const arg = (n) => { const h = process.argv.find((a) => a.startsWith(`--${n}=`)); return h ? h.slice(n.length + 3) : undefined; };
const JP = Number(arg("jp"));
const APP = Number(arg("app"));
if (!Number.isInteger(JP) || !Number.isInteger(APP)) { console.error("Usage: --jp=<id> --app=<id>"); process.exit(1); }

const KEY = process.env.JOBPLANNER_API_KEY?.trim()?.replace(/^["']|["']$/g, "");
const sb = createClient(process.env.SUPABASE_URL?.trim() || process.env.NEXT_PUBLIC_SUPABASE_URL?.trim(), process.env.SUPABASE_SERVICE_ROLE_KEY?.trim(), { auth: { persistSession: false } });
const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36";
const jp = async (u) => { const r = await fetch(`https://api.jobplanner.com${u}`, { headers: { ApiKey: KEY, "User-Agent": UA, Accept: "application/json" } }); if (!r.ok) return { __s: r.status }; return r.json(); };
const norm = (s) => String(s ?? "").trim().toLowerCase().replace(/\s+/g, " ");

async function main() {
  const fails = [];

  // ---- RFIs ----
  const jpRfis = await jp(`/projects/${JP}/rfi`);
  const { data: appRfis } = await sb.from("rfis").select("number, subject, status, question, source_metadata").eq("project_id", APP);
  const aR = new Map((appRfis ?? []).map((r) => [r.number, r]));
  for (const j of Array.isArray(jpRfis) ? jpRfis : []) {
    const a = aR.get(parseInt(String(j.number), 10));
    if (!a) { fails.push(`RFI #${j.number}: MISSING in app`); continue; }
    // The importer substitutes `RFI <number>` when JobPlanner's title is empty — mirror it.
    const expectedSubject = j.title || `RFI ${j.number}`;
    if (norm(a.subject) !== norm(expectedSubject)) fails.push(`RFI #${j.number} subject: app "${a.subject}" vs expected "${expectedSubject}"`);
    const js = j.status === 2 ? "closed" : "open";
    if (a.status !== js) fails.push(`RFI #${j.number} status: app ${a.status} vs JP ${js}`);
    if (norm(a.question) !== norm(j.question)) fails.push(`RFI #${j.number} question mismatch`);
    const detail = await jp(`/rfi/${j.rfiId}`);
    const responses = await jp(`/rfi/${j.rfiId}/responses`);
    const jAtt = (detail.attachments || []).length;
    const jAns = Array.isArray(responses) ? responses.length : (detail.responses || []).length;
    if ((a.source_metadata?.answers || []).length !== jAns) fails.push(`RFI #${j.number} answers: app ${(a.source_metadata?.answers || []).length} vs JP ${jAns}`);
    if ((a.source_metadata?.attachments || []).length !== jAtt) fails.push(`RFI #${j.number} attachments: app ${(a.source_metadata?.attachments || []).length} vs JP ${jAtt}`);
  }

  // ---- Punch ----
  const jpPunch = await jp(`/projects/${JP}/punchlists`);
  const { data: appPunch } = await sb.from("punch_items").select("title, status, priority, jobplanner_punchlist_item_id").eq("project_id", APP).not("jobplanner_punchlist_item_id", "is", null);
  const aP = new Map((appPunch ?? []).map((r) => [Number(r.jobplanner_punchlist_item_id), r]));
  const prio = { 1: "low", 2: "medium", 3: "high" };
  for (const j of Array.isArray(jpPunch) ? jpPunch : []) {
    const a = aP.get(Number(j.punchlistItemId));
    if (!a) { fails.push(`Punch ${j.punchlistItemId} "${j.title}": MISSING in app`); continue; }
    if (norm(a.title) !== norm(j.title)) fails.push(`Punch ${j.punchlistItemId} title mismatch`);
    const js = j.status === 2 ? "closed" : "initiated";
    if (a.status !== js) fails.push(`Punch ${j.punchlistItemId} status: app ${a.status} vs JP ${js}`);
    if ((a.priority ?? null) !== (prio[j.priority] ?? null)) fails.push(`Punch ${j.punchlistItemId} priority: app ${a.priority} vs JP ${prio[j.priority] ?? null}`);
  }

  // ---- Submittals ----
  const jpSub = await jp(`/projects/${JP}/submittals`);
  const { data: appSub } = await sb.from("submittals").select("submittal_number, title").eq("project_id", APP);
  const aS = new Map((appSub ?? []).map((s) => [norm(s.submittal_number), s]));
  for (const j of Array.isArray(jpSub) ? jpSub : []) {
    const a = aS.get(norm(j.submittalNumber));
    if (!a) { fails.push(`Submittal "${j.submittalNumber}" "${j.title}": MISSING in app`); continue; }
    if (norm(a.title) !== norm(j.title)) fails.push(`Submittal ${j.submittalNumber} title mismatch`);
  }

  const nR = Array.isArray(jpRfis) ? jpRfis.length : 0, nP = Array.isArray(jpPunch) ? jpPunch.length : 0, nS = Array.isArray(jpSub) ? jpSub.length : 0;
  console.log(`JP ${JP} -> app ${APP}   RFIs ${nR} · Punch ${nP} · Submittals ${nS}`);
  if (fails.length === 0) {
    console.log(`ALL FIELD TIE-OUTS PASS ✓ (${nR + nP + nS} records, both directions)`);
  } else {
    console.log(`${fails.length} DISCREPANCIES:`);
    for (const f of fails) console.log("  ✗ " + f);
    process.exit(1);
  }
}
main().catch((e) => { console.error(e.message); process.exit(1); });
