/**
 * One-shot script: populate subcontractor_invoices and commitment_payments
 * from the Acumatica AP bills / checks mirror tables.
 *
 * Run from the repo root:
 *   node scripts/run-ap-sync.mjs
 *
 * Reads env from frontend/.env.local
 */

import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

// ── Load env ────────────────────────────────────────────────────────────────

const __dirname = dirname(fileURLToPath(import.meta.url));
const envPath = join(__dirname, "../frontend/.env.local");
const envLines = readFileSync(envPath, "utf8").split("\n");
const env = {};
for (const line of envLines) {
  const m = line.match(/^([A-Z_][A-Z0-9_]*)=["']?(.+?)["']?$/);
  if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, "");
}

const SUPABASE_URL = env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in frontend/.env.local");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { persistSession: false },
});

// ── Status mapping ───────────────────────────────────────────────────────────

function mapApBillStatus(acuStatus) {
  switch (acuStatus) {
    case "Open":     return "pending";
    case "Closed":   return "paid";
    case "On Hold":  return "draft";
    case "Balanced": return "pending";
    default:         return "draft";
  }
}

// ── AP Bills → subcontractor_invoices ────────────────────────────────────────

async function syncAPBills() {
  console.log("Loading AP bills with project_id...");
  const { data: bills, error: billsError } = await supabase
    .from("acumatica_ap_bills")
    .select("id, reference_nbr, document_type, vendor_id, project_id, date, due_date, status, amount, description, vendor_ref")
    .not("project_id", "is", null);

  if (billsError) throw new Error(`Failed to load AP bills: ${billsError.message}`);
  console.log(`  Found ${bills.length} AP bills with a project_id`);

  // Vendor lookup: acumatica_vendor_id → company.id
  const { data: vendors } = await supabase
    .from("companies")
    .select("id, acumatica_vendor_id")
    .eq("is_vendor", true)
    .not("acumatica_vendor_id", "is", null);

  const companyByVendorId = new Map();
  for (const v of vendors ?? []) {
    if (v.acumatica_vendor_id) companyByVendorId.set(v.acumatica_vendor_id, v.id);
  }

  // Subcontract lookup: "projectId:companyId" → [sub uuid, ...]
  const { data: subcontracts } = await supabase
    .from("subcontracts")
    .select("id, project_id, contract_company_id")
    .not("contract_company_id", "is", null);

  const subsByKey = new Map();
  for (const s of subcontracts ?? []) {
    const key = `${s.project_id}:${s.contract_company_id}`;
    const arr = subsByKey.get(key) ?? [];
    arr.push(s.id);
    subsByKey.set(key, arr);
  }

  // PO lookup: "projectId:companyId" → [po uuid, ...]
  const { data: pos } = await supabase
    .from("purchase_orders")
    .select("id, project_id, contract_company_id")
    .not("contract_company_id", "is", null);

  const posByKey = new Map();
  for (const po of pos ?? []) {
    const key = `${po.project_id}:${po.contract_company_id}`;
    const arr = posByKey.get(key) ?? [];
    arr.push(po.id);
    posByKey.set(key, arr);
  }

  // Existing invoices for dedup
  const { data: existing } = await supabase
    .from("subcontractor_invoices")
    .select("id, acumatica_ap_bill_id")
    .not("acumatica_ap_bill_id", "is", null);

  const existingByBillId = new Map();
  for (const row of existing ?? []) {
    if (row.acumatica_ap_bill_id != null) existingByBillId.set(row.acumatica_ap_bill_id, row.id);
  }

  let created = 0, updated = 0;
  const errors = [];

  for (const bill of bills) {
    try {
      const companyId = bill.vendor_id ? companyByVendorId.get(bill.vendor_id) ?? null : null;

      // Try to link to subcontract or PO (only if unambiguous)
      let subcontractId = null;
      let purchaseOrderId = null;
      if (companyId && bill.project_id) {
        const key = `${bill.project_id}:${companyId}`;
        const subs = subsByKey.get(key) ?? [];
        const pOrder = posByKey.get(key) ?? [];
        if (subs.length === 1 && pOrder.length === 0) {
          subcontractId = subs[0];
        } else if (pOrder.length === 1 && subs.length === 0) {
          purchaseOrderId = pOrder[0];
        }
      }

      const row = {
        acumatica_ap_bill_id: bill.id,
        project_id: bill.project_id,
        vendor_id: companyId,
        subcontract_id: subcontractId,
        purchase_order_id: purchaseOrderId,
        invoice_number: bill.reference_nbr ?? null,
        invoice_date: bill.date ? bill.date.split("T")[0] : null,
        due_date: bill.due_date ? bill.due_date.split("T")[0] : null,
        status: mapApBillStatus(bill.status ?? ""),
        amount: bill.amount != null ? Number(bill.amount) : 0,
        description: bill.description ?? null,
        vendor_ref: bill.vendor_ref ?? null,
      };

      const existingId = existingByBillId.get(bill.id);
      if (existingId) {
        const { error: updateError } = await supabase
          .from("subcontractor_invoices")
          .update(row)
          .eq("id", existingId);
        if (updateError) throw new Error(updateError.message);
        updated++;
      } else {
        const { error: insertError } = await supabase
          .from("subcontractor_invoices")
          .insert(row);
        if (insertError) {
          if (insertError.message.includes("duplicate key")) {
            updated++; // already exists from concurrent run
          } else {
            throw new Error(insertError.message);
          }
        } else {
          created++;
        }
      }
    } catch (err) {
      errors.push(`AP bill ${bill.reference_nbr ?? bill.id}: ${err.message}`);
    }
  }

  return { created, updated, errors };
}

// ── AP Checks → commitment_payments ──────────────────────────────────────────

async function syncAPChecks() {
  console.log("Loading AP checks from mirror...");
  const { data: checks, error: checksError } = await supabase
    .from("acumatica_checks")
    .select("id, reference_nbr, vendor_id, date, amount, status, description, payment_ref");

  if (checksError) throw new Error(`Failed to load AP checks: ${checksError.message}`);
  console.log(`  Found ${checks.length} AP checks`);

  // Vendor lookup
  const { data: vendors } = await supabase
    .from("companies")
    .select("id, acumatica_vendor_id")
    .eq("is_vendor", true)
    .not("acumatica_vendor_id", "is", null);

  const companyByVendorId = new Map();
  for (const v of vendors ?? []) {
    if (v.acumatica_vendor_id) companyByVendorId.set(v.acumatica_vendor_id, v.id);
  }

  // Existing commitment_payments for dedup
  const { data: existing } = await supabase
    .from("commitment_payments")
    .select("id, external_key")
    .like("external_key", "Check|%");

  const existingByKey = new Map();
  for (const row of existing ?? []) {
    if (row.external_key) existingByKey.set(row.external_key, row.id);
  }

  // Build vendor → project inference: vendorId → Set of project_ids from subcontractor_invoices
  const { data: invoices } = await supabase
    .from("subcontractor_invoices")
    .select("vendor_id, project_id, subcontract_id")
    .not("project_id", "is", null)
    .not("vendor_id", "is", null);

  const projectsByCompany = new Map();
  const subsByCompanyProject = new Map();
  for (const inv of invoices ?? []) {
    if (!inv.vendor_id || !inv.project_id) continue;
    const pSet = projectsByCompany.get(inv.vendor_id) ?? new Set();
    pSet.add(inv.project_id);
    projectsByCompany.set(inv.vendor_id, pSet);
    if (inv.subcontract_id) {
      const sk = `${inv.vendor_id}:${inv.project_id}`;
      const sSet = subsByCompanyProject.get(sk) ?? new Set();
      sSet.add(inv.subcontract_id);
      subsByCompanyProject.set(sk, sSet);
    }
  }

  let created = 0, updated = 0;
  const errors = [];

  for (const check of checks) {
    try {
      const externalKey = `Check|${check.reference_nbr}`;
      const companyId = check.vendor_id ? companyByVendorId.get(check.vendor_id) ?? null : null;

      // Infer project and subcontract if unambiguous
      let projectId = null;
      let subcontractId = null;
      if (companyId) {
        const projects = projectsByCompany.get(companyId);
        if (projects?.size === 1) {
          projectId = [...projects][0];
          const subs = subsByCompanyProject.get(`${companyId}:${projectId}`);
          if (subs?.size === 1) subcontractId = [...subs][0];
        }
      }

      const row = {
        external_key: externalKey,
        vendor_id: companyId,
        project_id: projectId,
        subcontract_id: subcontractId,
        payment_date: check.date ? check.date.split("T")[0] : null,
        amount: check.amount != null ? Number(check.amount) : 0,
        description: check.description ?? null,
        reference_number: check.reference_nbr ?? null,
        payment_method: "check",
      };

      const existingId = existingByKey.get(externalKey);
      if (existingId) {
        const { error: updateError } = await supabase
          .from("commitment_payments")
          .update(row)
          .eq("id", existingId);
        if (updateError) throw new Error(updateError.message);
        updated++;
      } else {
        const { error: insertError } = await supabase
          .from("commitment_payments")
          .insert(row);
        if (insertError) {
          if (insertError.message.includes("duplicate key")) {
            updated++;
          } else {
            throw new Error(insertError.message);
          }
        } else {
          created++;
        }
      }
    } catch (err) {
      errors.push(`Check ${check.reference_nbr ?? check.id}: ${err.message}`);
    }
  }

  return { created, updated, errors };
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log("=== AP Bills → subcontractor_invoices ===");
  const billsResult = await syncAPBills();
  console.log(`  Created: ${billsResult.created}, Updated: ${billsResult.updated}, Errors: ${billsResult.errors.length}`);
  if (billsResult.errors.length > 0) {
    console.log("  First 5 errors:");
    billsResult.errors.slice(0, 5).forEach(e => console.log("   -", e));
  }

  console.log("\n=== AP Checks → commitment_payments ===");
  const checksResult = await syncAPChecks();
  console.log(`  Created: ${checksResult.created}, Updated: ${checksResult.updated}, Errors: ${checksResult.errors.length}`);
  if (checksResult.errors.length > 0) {
    console.log("  First 5 errors:");
    checksResult.errors.slice(0, 5).forEach(e => console.log("   -", e));
  }

  console.log("\nDone.");
}

main().catch(err => {
  console.error("Fatal:", err);
  process.exit(1);
});
