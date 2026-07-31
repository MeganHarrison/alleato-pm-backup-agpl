#!/usr/bin/env node

/**
 * Backfill NULL commitment vendors from Job Planner.
 *
 * The commitment SOV importer (import-commitments.mjs) resolves the vendor
 * (JP `contractedContact.companyName` -> `companies.id`) only on the CREATE
 * path. Commitments that already existed as app rows and were merely REBUILT
 * keep whatever vendor they had — which for the 2026-06-14 JP-sync headers was
 * NULL. This script fills those NULLs (and ONLY those NULLs) using the exact
 * same normalization the importer uses. It never overwrites a vendor that is
 * already set, and never auto-creates a company (to avoid directory dupes) —
 * names not found in `companies` are flagged for review.
 *
 * Idempotent: re-running only touches rows still NULL that now resolve.
 *
 * Secrets: reads JOBPLANNER_API_KEY + SUPABASE_SERVICE_ROLE_KEY from env.
 *
 * Usage:
 *   node scripts/jobplanner/backfill-commitment-vendors.mjs --jp=9299 --app=1067            # DRY RUN
 *   node scripts/jobplanner/backfill-commitment-vendors.mjs --jp=9299 --app=1067 --apply    # execute
 */

import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const __filename = fileURLToPath(import.meta.url);
const repoRoot = path.resolve(path.dirname(__filename), "../..");
const frontendRequire = createRequire(path.join(repoRoot, "frontend", "package.json"));
const dotenv = frontendRequire("dotenv");
const { createClient } = frontendRequire("@supabase/supabase-js");
dotenv.config({ path: path.join(repoRoot, ".env"), quiet: true });
dotenv.config({ path: path.join(repoRoot, "frontend/.env.local"), quiet: true });

const APPLY = process.argv.includes("--apply");
// --create-missing: create a `companies` row for each flagged vendor that JP names but
// the directory lacks, then link it. Never creates for names in --skip (comma-separated,
// case-insensitive) — use it to exclude JP placeholders like "Local Roofing Contractor".
const CREATE_MISSING = process.argv.includes("--create-missing");
const argValue = (name) => {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : undefined;
};
const SKIP_NAMES = new Set(
  (argValue("skip") || "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean),
);
const JP_PROJECT_ID = Number(argValue("jp"));
const APP_PROJECT_ID = Number(argValue("app"));
if (!Number.isInteger(JP_PROJECT_ID) || !Number.isInteger(APP_PROJECT_ID)) {
  console.error("Usage: node scripts/jobplanner/backfill-commitment-vendors.mjs --jp=<id> --app=<id> [--apply]");
  process.exit(1);
}

const JP_KEY = process.env.JOBPLANNER_API_KEY?.trim();
const SUPABASE_URL = process.env.SUPABASE_URL?.trim() || process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
if (!JP_KEY || !SUPABASE_URL || !SERVICE_KEY) {
  console.error("Missing JOBPLANNER_API_KEY / SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY.");
  process.exit(1);
}

const USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36";
const API_V2 = "https://api-v2.jobplanner.com";
async function jpGet(pathname) {
  const res = await fetch(`${API_V2}${pathname}`, {
    headers: { ApiKey: JP_KEY, "User-Agent": USER_AGENT, Accept: "application/json" },
  });
  if (!res.ok) throw new Error(`JP GET ${pathname} -> ${res.status}`);
  return res.json();
}

const sb = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

// --- Vendor normalization: byte-for-byte identical to import-commitments.mjs ---
const SUFFIX = /\b(inc|incorporated|llc|ltd|co|corp|corporation|company|lp|llp|pllc|plc)\b/g;
const normName = (s) =>
  String(s || "").toLowerCase().replace(/^the\s+/, "").replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim();
const normStrip = (s) => normName(s).replace(SUFFIX, "").replace(/\s+/g, " ").trim();

async function main() {
  const { data: coRows, error: coErr } = await sb.from("companies").select("id, name");
  if (coErr) throw new Error(`companies load: ${coErr.message}`);
  const coByExact = new Map();
  const coByStrip = new Map();
  for (const co of coRows ?? []) {
    coByExact.set(normName(co.name), co.id);
    const k = normStrip(co.name);
    if (k && !coByStrip.has(k)) coByStrip.set(k, co.id);
  }
  const resolveVendor = (name) =>
    name ? coByExact.get(normName(name)) ?? coByStrip.get(normStrip(name)) ?? null : null;

  // JP commitment number -> vendor name
  const jpCommitments = await jpGet(`/projects/${JP_PROJECT_ID}/commitments`);
  const jpVendorByNumber = new Map();
  for (const c of jpCommitments) {
    jpVendorByNumber.set(c.number, c.contractedContact?.companyName || c.contractedContact?.name || null);
  }

  const resolved = [];
  const toCreate = []; // { table, id, number, vendorName } — flagged real vendors we will create + link
  const flagged = [];
  for (const [table] of [["subcontracts"], ["purchase_orders"]]) {
    const { data: rows, error } = await sb
      .from(table)
      .select("id, contract_number, contract_company_id, deleted_at")
      .eq("project_id", APP_PROJECT_ID);
    if (error) throw new Error(`${table} load: ${error.message}`);
    for (const row of rows ?? []) {
      if (row.deleted_at) continue;
      if (row.contract_company_id) continue; // never overwrite an existing vendor
      const vendorName = jpVendorByNumber.get(row.contract_number)?.trim() || null;
      const companyId = resolveVendor(vendorName);
      if (companyId) {
        resolved.push({ table, id: row.id, number: row.contract_number, vendorName, companyId });
      } else if (vendorName && CREATE_MISSING && !SKIP_NAMES.has(vendorName.toLowerCase())) {
        toCreate.push({ table, id: row.id, number: row.contract_number, vendorName });
      } else if (vendorName) {
        flagged.push({
          table,
          number: row.contract_number,
          vendorName,
          reason: SKIP_NAMES.has(vendorName.toLowerCase()) ? "skipped (placeholder)" : "not in companies directory",
        });
      } else {
        flagged.push({ table, number: row.contract_number, vendorName: null, reason: "JP has no vendor" });
      }
    }
  }

  const created = [];
  if (APPLY) {
    // Create-and-link flagged real vendors (dedupe by normalized name across this run).
    const createdIdByNorm = new Map();
    for (const r of toCreate) {
      const norm = normName(r.vendorName);
      let companyId = createdIdByNorm.get(norm);
      if (!companyId) {
        const { data, error } = await sb.from("companies").insert({ name: r.vendorName }).select("id").single();
        if (error) throw new Error(`create company "${r.vendorName}": ${error.message}`);
        companyId = data.id;
        createdIdByNorm.set(norm, companyId);
        created.push({ name: r.vendorName, id: companyId });
      }
      const { error: uErr } = await sb.from(r.table).update({ contract_company_id: companyId }).eq("id", r.id);
      if (uErr) throw new Error(`link ${r.number}: ${uErr.message}`);
    }
    // Link vendors that already existed in the directory.
    for (const r of resolved) {
      const { error } = await sb.from(r.table).update({ contract_company_id: r.companyId }).eq("id", r.id);
      if (error) throw new Error(`update ${r.number}: ${error.message}`);
    }
  }

  console.log(
    JSON.stringify(
      {
        mode: APPLY ? "APPLY" : "DRY RUN",
        jpProjectId: JP_PROJECT_ID,
        appProjectId: APP_PROJECT_ID,
        linkedExistingCount: resolved.length,
        linkedExisting: resolved.map((r) => ({ number: r.number, vendor: r.vendorName })),
        createMissing: CREATE_MISSING,
        wouldCreateOrCreated: toCreate.map((r) => ({ number: r.number, vendor: r.vendorName })),
        createdCompanies: created,
        flaggedCount: flagged.length,
        flagged,
      },
      null,
      2,
    ),
  );
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
