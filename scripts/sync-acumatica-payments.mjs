/**
 * Sync AR Payments from Acumatica → Supabase acumatica_payments
 * Usage: node scripts/sync-acumatica-payments.mjs
 */

import { createClient } from "../frontend/node_modules/@supabase/supabase-js/dist/index.mjs";
import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const envLines = readFileSync(join(__dirname, "../frontend/.env.local"), "utf8").split("\n");
const env = {};
for (const line of envLines) {
  const t = line.trim();
  if (!t || t.startsWith("#")) continue;
  const [k, ...v] = t.split("=");
  env[k.trim()] = v.join("=").trim().replace(/^["']|["']$/g, "");
}

const SUPABASE_URL = env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = env.SUPABASE_SERVICE_ROLE_KEY;
const ACCOUNTING_USER = env.ACCOUNTING_USER;
const ACCOUNTING_PASSWORD = env.ACCOUNTING_PASSWORD;
const BASE_URL = "https://alleatogroup.acumatica.com";
const ENTITY_BASE = `${BASE_URL}/entity/Default/24.200.001`;
const PAGE_SIZE = 100;

let sessionCookies = null;

async function login() {
  const res = await fetch(`${BASE_URL}/entity/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: ACCOUNTING_USER, password: ACCOUNTING_PASSWORD, company: "Alleato Group" }),
    redirect: "manual",
  });
  if (res.status !== 204) throw new Error(`Login failed (HTTP ${res.status})`);
  sessionCookies = res.headers.getSetCookie().map(h => h.split(";")[0]).join("; ");
  console.log("✓ Logged into Acumatica");
}

function unwrap(raw) {
  if (raw === null || raw === undefined) return raw;
  if (Array.isArray(raw)) return raw.map(unwrap);
  if (typeof raw === "object") {
    const keys = Object.keys(raw);
    if (keys.length === 0) return null; // Empty object {} → null
    if (keys.length === 1 && "value" in raw) return raw.value;
    const result = {};
    for (const [k, v] of Object.entries(raw)) result[k] = unwrap(v);
    return result;
  }
  return raw;
}

async function fetchPage(skip) {
  const url = new URL(`${ENTITY_BASE}/Payment`);
  url.searchParams.set("$top", String(PAGE_SIZE));
  url.searchParams.set("$skip", String(skip));
  const res = await fetch(url.toString(), {
    headers: { Cookie: sessionCookies, Accept: "application/json" },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Payment fetch failed (HTTP ${res.status}): ${text.slice(0, 200)}`);
  }
  return (await res.json()).map(unwrap);
}

async function fetchAllPayments() {
  const all = [];
  let skip = 0;
  process.stdout.write("  Fetching");
  while (true) {
    const page = await fetchPage(skip);
    all.push(...page);
    process.stdout.write(".");
    if (page.length < PAGE_SIZE) break;
    skip += PAGE_SIZE;
  }
  console.log(` ${all.length} payments`);
  return all;
}

function toDate(val) {
  if (!val) return null;
  return typeof val === "string" ? val.split("T")[0] : null;
}

function toNum(val) {
  if (val === null || val === undefined) return null;
  const n = typeof val === "number" ? val : parseFloat(val);
  return isNaN(n) ? null : n;
}

async function syncPayments() {
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
  const payments = await fetchAllPayments();
  const now = new Date().toISOString();

  // Build project mapping: acumatica_project_id → project.id
  const { data: projects } = await supabase
    .from("projects")
    .select("id, acumatica_project_id")
    .not("acumatica_project_id", "is", null);
  const projectMap = new Map(
    (projects ?? []).map(p => [p.acumatica_project_id, p.id])
  );

  // Load existing payments by external_key for upsert
  const { data: existing } = await supabase
    .from("acumatica_payments")
    .select("id, external_key");
  const existingMap = new Map(
    (existing ?? []).map(r => [r.external_key, r.id])
  );

  const result = { created: 0, updated: 0, skipped: 0, errors: [] };

  for (const pmt of payments) {
    const refNbr = pmt.ReferenceNbr;
    const docType = pmt.Type ?? "Payment";
    const externalKey = `${docType}|${refNbr}`;

    // Try to map project — Payment entity doesn't always have ProjectID directly,
    // but ApplicationHistory or description might reference it.
    // We'll match by Customer if available.
    const projectId = null; // Payments don't have a direct project field in Acumatica

    const row = {
      external_key:     externalKey,
      reference_nbr:    refNbr,
      document_type:    docType,
      customer_id:      pmt.CustomerID ?? null,
      status:           pmt.Status ?? null,
      description:      pmt.Description ?? null,
      payment_amount:   toNum(pmt.PaymentAmount),
      payment_method:   pmt.PaymentMethod ?? null,
      payment_ref:      pmt.PaymentRef ?? null,
      cash_account:     pmt.CashAccount ?? null,
      currency_id:      pmt.CurrencyID ?? null,
      application_date: toDate(pmt.ApplicationDate),
      available_balance: toNum(pmt.AppliedToDocuments),
      last_modified_at: pmt.LastModifiedDateTime ?? null,
      project_id:       projectId,
      acumatica_sync_at: now,
      updated_at:       now,
    };

    try {
      const existingId = existingMap.get(externalKey);

      if (existingId) {
        const { error } = await supabase
          .from("acumatica_payments")
          .update(row)
          .eq("id", existingId);
        if (error) { result.errors.push(`${externalKey}: ${error.message}`); continue; }
        result.updated++;
      } else {
        const { error } = await supabase
          .from("acumatica_payments")
          .insert(row);
        if (error) { result.errors.push(`${externalKey}: ${error.message}`); continue; }
        result.created++;
      }
    } catch (err) {
      result.errors.push(`${externalKey}: ${err.message}`);
    }
  }

  return result;
}

// =============================================================================
// Phase 2: Bridge acumatica_payments → prime_contract_payments
// =============================================================================

// Clean DB values that may be stringified empty objects from Acumatica unwrap
function cleanVal(v) {
  if (v === null || v === undefined) return null;
  if (typeof v === "string" && (v === "{}" || v === "")) return null;
  return v;
}

// Normalize Acumatica payment method to constraint-allowed values
function normalizeMethod(raw) {
  if (!raw) return "other";
  const s = raw.toLowerCase().trim();
  if (s === "check" || s.includes("check")) return "check";
  if (s === "wire" || s.includes("wire")) return "wire";
  if (s === "ach" || s.includes("ach")) return "ach";
  if (s === "credit card" || s === "credit_card" || s.includes("credit")) return "credit_card";
  if (s === "cash") return "cash";
  return "other";
}

async function bridgeToContractPayments(supabase) {
  console.log("\n--- Phase 2: Bridge to prime_contract_payments ---");
  const now = new Date().toISOString();

  // 1. Build project mapping: acumatica_project_id → projects.id
  const { data: projects } = await supabase
    .from("projects")
    .select("id, acumatica_project_id")
    .not("acumatica_project_id", "is", null);
  const acumaticaToProjectId = new Map(
    (projects ?? []).map(p => [p.acumatica_project_id, p.id])
  );

  // 2. Build customer → project mapping from acumatica_ar_invoices
  //    (Payments reference a customer but not always a project directly)
  const { data: rawInvoices } = await supabase
    .from("acumatica_ar_invoices")
    .select("customer, project");
  const customerToProject = new Map();
  for (const inv of rawInvoices ?? []) {
    if (inv.customer && inv.project && !customerToProject.has(inv.customer)) {
      customerToProject.set(inv.customer, inv.project);
    }
  }

  // 3. Build prime_contracts mapping: project_id → first prime_contract.id
  const { data: primeContracts } = await supabase
    .from("prime_contracts")
    .select("id, project_id");
  const projectToPrimeContract = new Map();
  for (const pc of primeContracts ?? []) {
    if (!projectToPrimeContract.has(pc.project_id)) {
      projectToPrimeContract.set(pc.project_id, pc.id);
    }
  }

  // 4. Load all acumatica_payments
  const { data: rawPayments } = await supabase
    .from("acumatica_payments")
    .select("*");

  // 5. Load existing prime_contract_payments keyed by acumatica_ref_nbr + acumatica_doc_type
  const { data: existingPcp } = await supabase
    .from("prime_contract_payments")
    .select("id, acumatica_ref_nbr, acumatica_doc_type");
  const pcpMap = new Map(
    (existingPcp ?? []).map(r => [`${r.acumatica_ref_nbr}|${r.acumatica_doc_type}`, r.id])
  );
  const pcpByRefNbr = new Map(
    (existingPcp ?? [])
      .filter(r => r.acumatica_ref_nbr)
      .map(r => [r.acumatica_ref_nbr, r.id])
  );

  const result = { created: 0, updated: 0, skipped: 0, errors: [] };

  for (const pmt of rawPayments ?? []) {
    const refNbr = pmt.reference_nbr;
    const docType = pmt.document_type ?? "Payment";
    const key = `${refNbr}|${docType}`;

    // Try to resolve project_id: first from payment's project_id, then from customer mapping
    let projectId = null;
    if (pmt.project_id) {
      projectId = pmt.project_id;
    } else if (pmt.customer_id) {
      const acumaticaProjectCode = customerToProject.get(pmt.customer_id);
      if (acumaticaProjectCode) {
        projectId = acumaticaToProjectId.get(acumaticaProjectCode);
      }
    }

    if (!projectId) { result.skipped++; continue; }

    const primeContractId = projectToPrimeContract.get(projectId);
    if (!primeContractId) { result.skipped++; continue; }

    const row = {
      acumatica_ref_nbr:  refNbr,
      acumatica_doc_type: docType,
      acumatica_sync_at:  now,
      amount:             pmt.payment_amount ?? 0,
      contract_id:        primeContractId,
      project_id:         projectId,
      method:             normalizeMethod(cleanVal(pmt.payment_method)),
      payment_date:       cleanVal(pmt.application_date) ?? now.split("T")[0],
      payment_number:     refNbr,
      reference_number:   cleanVal(pmt.payment_ref) ?? null,
      notes:              cleanVal(pmt.description) ?? null,
      updated_at:         now,
    };

    try {
      const existingId = pcpMap.get(key) ?? pcpByRefNbr.get(refNbr);

      if (existingId) {
        const { error } = await supabase
          .from("prime_contract_payments")
          .update(row)
          .eq("id", existingId);
        if (error) { result.errors.push(`pcp ${key}: ${error.message}`); continue; }
        result.updated++;
      } else {
        const { error } = await supabase
          .from("prime_contract_payments")
          .insert(row);
        if (error) { result.errors.push(`pcp ${key}: ${error.message}`); continue; }
        result.created++;
      }
    } catch (err) {
      result.errors.push(`pcp ${key}: ${err.message}`);
    }
  }

  console.log(`  Created : ${result.created}`);
  console.log(`  Updated : ${result.updated}`);
  console.log(`  Skipped : ${result.skipped} (no project/contract mapping)`);
  if (result.errors.length > 0) result.errors.forEach(e => console.log(`    ✗ ${e}`));
  return result;
}

(async () => {
  console.log("Starting Acumatica AR Payment sync...\n");
  await login();

  // Phase 1: Sync raw Acumatica data
  const result = await syncPayments();
  console.log("\n--- Phase 1 Results (raw sync) ---");
  console.log(`  Created : ${result.created}`);
  console.log(`  Updated : ${result.updated}`);
  console.log(`  Errors  : ${result.errors.length}`);
  if (result.errors.length > 0) result.errors.forEach(e => console.log(`    ✗ ${e}`));

  // Phase 2: Bridge to UI-facing tables
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
  await bridgeToContractPayments(supabase);

  // Logout to free the API session
  await fetch(`${BASE_URL}/entity/auth/logout`, {
    method: "POST",
    headers: { Cookie: sessionCookies },
  }).catch(() => {});
  console.log("✓ Logged out of Acumatica");

  console.log("\nDone.");
})().catch(async (err) => {
  // Try to logout even on error
  if (sessionCookies) {
    await fetch(`${BASE_URL}/entity/auth/logout`, {
      method: "POST", headers: { Cookie: sessionCookies },
    }).catch(() => {});
  }
  console.error("Fatal:", err.message);
  process.exit(1);
});
