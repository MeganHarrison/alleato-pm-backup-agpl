/**
 * Sync active vendors from Acumatica → Supabase companies table
 * Usage: node scripts/sync-acumatica-vendors.mjs
 */

import { createClient } from "../frontend/node_modules/@supabase/supabase-js/dist/index.mjs";
import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const envPath = join(__dirname, "../frontend/.env.local");
const envLines = readFileSync(envPath, "utf8").split("\n");
const env = {};
for (const line of envLines) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith("#")) continue;
  const [key, ...rest] = trimmed.split("=");
  env[key.trim()] = rest.join("=").trim();
}

const SUPABASE_URL = env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = env.SUPABASE_SERVICE_ROLE_KEY;
const ACCOUNTING_USER = env.ACCOUNTING_USER;
const ACCOUNTING_PASSWORD = env.ACCOUNTING_PASSWORD;
const ALLEATO_COMPANY_ID = "bef9dcfc-531e-47c9-90a5-4cadd99447fb";

const BASE_URL = "https://alleatogroup.acumatica.com";
const ENTITY_BASE = `${BASE_URL}/entity/Default/24.200.001`;

let sessionCookies = null;

async function login() {
  const res = await fetch(`${BASE_URL}/entity/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: ACCOUNTING_USER, password: ACCOUNTING_PASSWORD, company: "Alleato Group" }),
    redirect: "manual",
  });
  if (res.status !== 204) throw new Error(`Login failed (HTTP ${res.status})`);
  sessionCookies = res.headers.getSetCookie().map((h) => h.split(";")[0]).join("; ");
  if (!sessionCookies) throw new Error("No cookies returned");
  console.log("✓ Logged into Acumatica");
}

function unwrap(raw) {
  if (raw === null || raw === undefined) return raw;
  if (Array.isArray(raw)) return raw.map(unwrap);
  if (typeof raw === "object" && "value" in raw && Object.keys(raw).length === 1) return raw.value;
  if (typeof raw === "object") {
    const result = {};
    for (const [k, v] of Object.entries(raw)) result[k] = unwrap(v);
    return result;
  }
  return raw;
}

async function getVendors() {
  const url = new URL(`${ENTITY_BASE}/Vendor`);
  url.searchParams.set("$top", "500");
  url.searchParams.set("$expand", "MainContact");
  const res = await fetch(url.toString(), {
    headers: { Cookie: sessionCookies, Accept: "application/json" },
  });
  if (!res.ok) throw new Error(`Vendor fetch failed (HTTP ${res.status})`);
  return (await res.json()).map(unwrap);
}

function toVendorRecord(v) {
  return {
    name: v.VendorName,
    legal_name: v.LegalName ?? null,
    contact_email: v.MainContact?.Email ?? null,
    contact_phone: v.MainContact?.Phone1 ?? null,
    vendor_class: v.VendorClass ?? null,
    terms: v.Terms ?? null,
    payment_method: v.PaymentMethod ?? null,
    ap_account: v.APAccount ?? null,
    cash_account: v.CashAccount ?? null,
    is_1099_vendor: v.F1099Vendor ?? null,
    is_foreign_entity: v.ForeignEntity ?? null,
    is_labor_union: v.VendorIsLaborUnion ?? null,
    is_tax_agency: v.VendorIsTaxAgency ?? null,
    acumatica_sync_at: new Date().toISOString(),
  };
}

async function syncVendors() {
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  const allVendors = await getVendors();
  const activeVendors = allVendors.filter((v) => v.Status === "Active");
  console.log(`  ${allVendors.length} total, ${activeVendors.length} active\n`);

  const { data: existing, error: fetchError } = await supabase
    .from("companies")
    .select("id, name, acumatica_vendor_id")
    .eq("is_vendor", true);
  if (fetchError) throw new Error(`Failed to load vendors: ${fetchError.message}`);

  const byAcuId = new Map();
  const byName = new Map();
  for (const v of existing) {
    if (v.acumatica_vendor_id) byAcuId.set(v.acumatica_vendor_id, v);
    byName.set(v.name.toLowerCase().trim(), v);
  }

  const result = { created: 0, updated: 0, errors: [] };

  for (const v of activeVendors) {
    const acuId = v.VendorID;
    const fields = toVendorRecord(v);

    try {
      const linkedById = byAcuId.get(acuId);
      if (linkedById) {
        const { error } = await supabase.from("companies").update(fields).eq("id", linkedById.id);
        if (error) result.errors.push(`${acuId}: ${error.message}`);
        else result.updated++;
        continue;
      }

      const linkedByName = byName.get(v.VendorName.toLowerCase().trim());
      if (linkedByName) {
        const { error } = await supabase.from("companies")
          .update({ ...fields, acumatica_vendor_id: acuId })
          .eq("id", linkedByName.id);
        if (error) result.errors.push(`${acuId}: ${error.message}`);
        else { byAcuId.set(acuId, linkedByName); result.updated++; }
        continue;
      }

      const { error } = await supabase.from("companies").insert({
        acumatica_vendor_id: acuId,
        is_vendor: true,
        status: "active",
        ...fields,
      });
      if (error) result.errors.push(`${acuId} (${v.VendorName}): ${error.message}`);
      else { result.created++; console.log(`  + Created: ${v.VendorName} [${acuId}]`); }
    } catch (err) {
      result.errors.push(`${acuId}: ${err.message}`);
    }
  }

  return result;
}

(async () => {
  console.log("Starting Acumatica vendor sync...\n");
  await login();
  const result = await syncVendors();

  console.log("\n--- Results ---");
  console.log(`  Created : ${result.created}`);
  console.log(`  Updated : ${result.updated}`);
  console.log(`  Errors  : ${result.errors.length}`);
  if (result.errors.length > 0) result.errors.forEach((e) => console.log(`    ✗ ${e}`));
  console.log("\nDone.");
})().catch((err) => { console.error("Fatal:", err.message); process.exit(1); });
