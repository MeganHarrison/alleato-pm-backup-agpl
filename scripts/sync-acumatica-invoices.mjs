/**
 * Sync all AR invoices from Acumatica → Supabase acumatica_ar_invoices + acumatica_ar_invoice_lines
 * Usage: node scripts/sync-acumatica-invoices.mjs
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
  const url = new URL(`${ENTITY_BASE}/Invoice`);
  url.searchParams.set("$top", String(PAGE_SIZE));
  url.searchParams.set("$skip", String(skip));
  url.searchParams.set("$expand", "Details");
  const res = await fetch(url.toString(), {
    headers: { Cookie: sessionCookies, Accept: "application/json" },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Invoice fetch failed (HTTP ${res.status}): ${text.slice(0, 200)}`);
  }
  return (await res.json()).map(unwrap);
}

async function fetchAllInvoices() {
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
  console.log(` ${all.length} invoices`);
  return all;
}

function toDate(val) {
  if (!val) return null;
  return val.split("T")[0];
}

function toNum(val) {
  if (val === null || val === undefined) return null;
  const n = typeof val === "number" ? val : parseFloat(val);
  return isNaN(n) ? null : n;
}

async function syncInvoices() {
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
  const invoices = await fetchAllInvoices();
  const now = new Date().toISOString();

  // Load existing reference_nbr+type combos to know what to upsert vs insert
  const { data: existing } = await supabase
    .from("acumatica_ar_invoices")
    .select("id, reference_nbr, type");

  const existingMap = new Map(
    (existing ?? []).map(r => [`${r.reference_nbr}|${r.type}`, r.id])
  );

  const result = { created: 0, updated: 0, lines: 0, errors: [] };

  for (const inv of invoices) {
    const key = `${inv.ReferenceNbr}|${inv.Type}`;
    if (!inv.ReferenceNbr) {
      result.errors.push("Invoice missing ReferenceNbr; skipped");
      continue;
    }

    const header = {
      external_key:     key,
      reference_nbr:   inv.ReferenceNbr,
      type:            inv.Type ?? null,
      status:          inv.Status ?? null,
      date:            toDate(inv.Date),
      post_period:     inv.PostPeriod ?? null,
      customer:        inv.Customer ?? null,
      project:         inv.Project ?? null,
      description:     inv.Description ?? null,
      amount:          toNum(inv.Amount),
      balance:         toNum(inv.Balance),
      tax_total:       toNum(inv.TaxTotal),
      hold:            inv.Hold ?? null,
      link_ar_account: inv.LinkARAccount ?? null,
      acumatica_sync_at: now,
      updated_at:      now,
    };

    try {
      let invoiceId = existingMap.get(key);

      if (invoiceId) {
        // Update header
        const { error } = await supabase
          .from("acumatica_ar_invoices")
          .update(header)
          .eq("id", invoiceId);
        if (error) { result.errors.push(`${key}: ${error.message}`); continue; }
        result.updated++;
      } else {
        // Insert header
        const { data, error } = await supabase
          .from("acumatica_ar_invoices")
          .insert(header)
          .select("id")
          .single();
        if (error) { result.errors.push(`${key}: ${error.message}`); continue; }
        invoiceId = data.id;
        result.created++;
      }

      // Sync line items — delete old, insert fresh
      const lines = Array.isArray(inv.Details) ? inv.Details : [];
      if (lines.length > 0) {
        await supabase.from("acumatica_ar_invoice_lines").delete().eq("invoice_id", invoiceId);

        const lineRows = lines.map(l => ({
          invoice_id:              invoiceId,
          line_nbr:                l.LineNbr ?? null,
          transaction_description: l.TransactionDescription ?? null,
          qty:                     toNum(l.Qty),
          unit_price:              toNum(l.UnitPrice),
          extended_price:          toNum(l.ExtendedPrice),
          amount:                  toNum(l.Amount),
          discount_amount:         toNum(l.DiscountAmount),
          account:                 l.Account ?? null,
          cost_code:               l.CostCode ?? null,
          project_task:            l.ProjectTask ?? null,
          tax_category:            l.TaxCategory ?? null,
          uom:                     l.UOM ?? null,
        }));

        const { error: lineErr } = await supabase
          .from("acumatica_ar_invoice_lines")
          .insert(lineRows);
        if (lineErr) result.errors.push(`lines for ${key}: ${lineErr.message}`);
        else result.lines += lineRows.length;
      }
    } catch (err) {
      result.errors.push(`${key}: ${err.message}`);
    }
  }

  return result;
}

// =============================================================================
// Phase 2: Bridge acumatica_ar_invoices → owner_invoices + line items
// =============================================================================

function mapAcumaticaStatus(status) {
  if (!status) return "draft";
  const s = status.toLowerCase();
  if (s === "open" || s === "balanced") return "submitted";
  if (s === "closed") return "paid";
  if (s === "voided") return "void";
  if (s === "released") return "approved";
  return "draft";
}

async function bridgeToOwnerInvoices(supabase) {
  console.log("\n--- Phase 2: Bridge to owner_invoices ---");
  const now = new Date().toISOString();

  // 1. Build project mapping: acumatica_project_id → projects.id
  const { data: projects } = await supabase
    .from("projects")
    .select("id, acumatica_project_id")
    .not("acumatica_project_id", "is", null);
  const acumaticaToProjectId = new Map(
    (projects ?? []).map(p => [p.acumatica_project_id, p.id])
  );
  console.log(`  ${acumaticaToProjectId.size} projects with acumatica_project_id`);

  // 2. Build prime_contracts mapping: project_id → first prime_contract.id
  const { data: primeContracts } = await supabase
    .from("prime_contracts")
    .select("id, project_id, contract_number");
  const projectToPrimeContract = new Map();
  for (const pc of primeContracts ?? []) {
    // Use first prime contract per project (most projects have one)
    if (!projectToPrimeContract.has(pc.project_id)) {
      projectToPrimeContract.set(pc.project_id, pc.id);
    }
  }
  console.log(`  ${projectToPrimeContract.size} projects with prime contracts`);

  // 3. Load all acumatica_ar_invoices with their lines
  const { data: rawInvoices } = await supabase
    .from("acumatica_ar_invoices")
    .select("*, acumatica_ar_invoice_lines(*)");

  // 4. Load existing owner_invoices keyed by acumatica_ref_nbr + acumatica_doc_type
  const { data: existingOwner } = await supabase
    .from("owner_invoices")
    .select("id, acumatica_ref_nbr, acumatica_doc_type");
  const ownerMap = new Map(
    (existingOwner ?? []).map(r => [`${r.acumatica_ref_nbr}|${r.acumatica_doc_type}`, r.id])
  );

  const result = { created: 0, updated: 0, lineItems: 0, skipped: 0, errors: [] };

  for (const inv of rawInvoices ?? []) {
    const refNbr = inv.reference_nbr;
    const docType = inv.type ?? "Invoice";
    const key = `${refNbr}|${docType}`;

    // Resolve project_id from the Acumatica project field
    const projectId = acumaticaToProjectId.get(inv.project);
    if (!projectId) {
      result.skipped++;
      continue; // Can't map to a project — skip
    }

    // Resolve prime_contract_id for this project
    const primeContractId = projectToPrimeContract.get(projectId);
    if (!primeContractId) {
      result.skipped++;
      continue; // No prime contract for this project — skip
    }

    const ownerRow = {
      acumatica_ref_nbr:  refNbr,
      acumatica_doc_type: docType,
      acumatica_sync_at:  now,
      invoice_number:     refNbr,
      status:             mapAcumaticaStatus(inv.status),
      prime_contract_id:  primeContractId,
      period_start:       toDate(inv.date),
      period_end:         null,
      updated_at:         now,
    };

    try {
      let ownerInvoiceId = ownerMap.get(key);

      if (ownerInvoiceId) {
        const { error } = await supabase
          .from("owner_invoices")
          .update(ownerRow)
          .eq("id", ownerInvoiceId);
        if (error) { result.errors.push(`owner ${key}: ${error.message}`); continue; }
        result.updated++;
      } else {
        const { data, error } = await supabase
          .from("owner_invoices")
          .insert(ownerRow)
          .select("id")
          .single();
        if (error) { result.errors.push(`owner ${key}: ${error.message}`); continue; }
        ownerInvoiceId = data.id;
        result.created++;
      }

      // Sync line items: acumatica_ar_invoice_lines → owner_invoice_line_items
      const rawLines = inv.acumatica_ar_invoice_lines ?? [];
      if (rawLines.length > 0) {
        // Delete existing line items for this owner invoice, then re-insert
        await supabase.from("owner_invoice_line_items").delete().eq("invoice_id", ownerInvoiceId);

        const lineRows = rawLines.map(l => {
          const approvedAmount = l.amount ?? l.extended_price ?? 0;
          return {
            invoice_id:        ownerInvoiceId,
            acumatica_line_nbr: l.line_nbr,
            description:       l.transaction_description ?? l.account ?? null,
            approved_amount:   approvedAmount,
            category:          l.account ?? null,
            scheduled_value: approvedAmount,
            work_completed_previous: 0,
            work_completed_period: approvedAmount,
            materials_stored: 0,
            total_completed_stored: approvedAmount,
            work_completed_pct: approvedAmount > 0 ? 100 : 0,
            retainage_amount: 0,
            retainage_released: 0,
            net_amount_this_period: approvedAmount,
            balance_to_finish: 0,
          };
        });

        const { error: lineErr } = await supabase
          .from("owner_invoice_line_items")
          .insert(lineRows);
        if (lineErr) result.errors.push(`owner lines ${key}: ${lineErr.message}`);
        else result.lineItems += lineRows.length;
      }
    } catch (err) {
      result.errors.push(`owner ${key}: ${err.message}`);
    }
  }

  console.log(`  Created    : ${result.created}`);
  console.log(`  Updated    : ${result.updated}`);
  console.log(`  Line items : ${result.lineItems}`);
  console.log(`  Skipped    : ${result.skipped} (no project/contract mapping)`);
  if (result.errors.length > 0) result.errors.forEach(e => console.log(`    ✗ ${e}`));
  return result;
}

(async () => {
  console.log("Starting Acumatica AR invoice sync...\n");
  await login();

  // Phase 1: Sync raw Acumatica data
  const result = await syncInvoices();
  console.log("\n--- Phase 1 Results (raw sync) ---");
  console.log(`  Created : ${result.created}`);
  console.log(`  Updated : ${result.updated}`);
  console.log(`  Lines   : ${result.lines}`);
  console.log(`  Errors  : ${result.errors.length}`);
  if (result.errors.length > 0) result.errors.forEach(e => console.log(`    ✗ ${e}`));

  // Phase 2: Bridge to UI-facing tables
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
  await bridgeToOwnerInvoices(supabase);

  // Logout to free the API session
  await fetch(`${BASE_URL}/entity/auth/logout`, {
    method: "POST",
    headers: { Cookie: sessionCookies },
  }).catch(() => {});
  console.log("✓ Logged out of Acumatica");

  console.log("\nDone.");
})().catch(async (err) => {
  if (sessionCookies) {
    await fetch(`${BASE_URL}/entity/auth/logout`, {
      method: "POST", headers: { Cookie: sessionCookies },
    }).catch(() => {});
  }
  console.error("Fatal:", err.message);
  process.exit(1);
});
