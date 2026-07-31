#!/usr/bin/env node

/**
 * Import a Job Planner project directory (companies + contacts) into the PM app.
 *
 * Source:  GET https://api.jobplanner.com/projects/{jpProjectId}/contacts
 *          Each contact carries: contactName, email, phone, cell, companyName,
 *          userTypeId, isPrimary, contactCompanyId.
 *
 * What lands where (PM APP DB, service client):
 *   1. companies                     — matched by normalized name (legal-suffix-stripped);
 *                                       created ONLY when no existing company matches.
 *                                       (Companies are normally Acumatica-managed; the app UI
 *                                        blocks creation with 403 "erp_managed". A backfill
 *                                        importer may create them directly — name + is_vendor.)
 *   2. project_companies             — links the company to the project directory
 *                                       ({ project_id, company_id, company_type, status }).
 *   3. people                        — the person, deduped by email (case-insensitive).
 *                                       Linked to its company via people.company_id.
 *   4. project_directory_memberships — the person↔project junction that the Directory UI
 *                                       actually reads (permission_template = "Subcontractor").
 *
 * Idempotent: re-runs adopt existing companies/people/memberships instead of duplicating.
 * Mirrors DirectoryService.createPerson / addPersonToProject invariants.
 *
 * Usage:
 *   node scripts/jobplanner/import-directory.mjs --jp=8344 --app=876            # DRY RUN
 *   node scripts/jobplanner/import-directory.mjs --jp=8344 --app=876 --apply
 */

import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const frontendRequire = createRequire(path.join(repoRoot, "frontend", "package.json"));
const dotenv = frontendRequire("dotenv");
const { createClient } = frontendRequire("@supabase/supabase-js");
dotenv.config({ path: path.join(repoRoot, ".env"), quiet: true });
dotenv.config({ path: path.join(repoRoot, ".env.local"), quiet: true });
dotenv.config({ path: path.join(repoRoot, "frontend/.env.local"), quiet: true });

const APPLY = process.argv.includes("--apply");
const arg = (n) => {
  const h = process.argv.find((a) => a.startsWith(`--${n}=`));
  return h ? h.slice(n.length + 3) : undefined;
};
const JP = Number(arg("jp"));
const APP = Number(arg("app"));
if (!Number.isInteger(JP) || !Number.isInteger(APP)) {
  console.error("Usage: node scripts/jobplanner/import-directory.mjs --jp=<id> --app=<id> [--apply]");
  process.exit(1);
}

const JP_KEY = process.env.JOBPLANNER_API_KEY?.trim()?.replace(/^["']|["']$/g, "");
const SUPABASE_URL = process.env.SUPABASE_URL?.trim() || process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() || process.env.SUPABASE_SERVICE_KEY?.trim();
if (!JP_KEY) { console.error("Missing JOBPLANNER_API_KEY."); process.exit(1); }
if (!SUPABASE_URL || !SERVICE_KEY) { console.error("Missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY."); process.exit(1); }

const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36";
const SUBCONTRACTOR_TEMPLATE_ID = "6d6132ab-12b1-4764-a1db-5e125266fbd4"; // permission_templates."Subcontractor"

const sb = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

async function jpGet(pathname) {
  const r = await fetch(`https://api.jobplanner.com${pathname}`, {
    headers: { ApiKey: JP_KEY, "User-Agent": UA, Accept: "application/json" },
  });
  if (!r.ok) throw new Error(`JP ${pathname} -> ${r.status}`);
  return r.json();
}

const LEGAL_SUFFIX = /\b(inc|incorporated|llc|ltd|co|corp|corporation|company|lp|llp|pllc|plc)\b/g;
const normCompany = (s) =>
  String(s ?? "").toLowerCase().replace(LEGAL_SUFFIX, "").replace(/[^a-z0-9]+/g, " ").trim();
const normEmail = (s) => String(s ?? "").trim().toLowerCase();

function splitName(fullName, fallbackCompany) {
  const clean = String(fullName ?? "").trim();
  if (!clean) return { first_name: fallbackCompany || "Contact", last_name: "" };
  const parts = clean.split(/\s+/);
  return { first_name: parts[0], last_name: parts.slice(1).join(" ") };
}

async function main() {
  console.log(`Directory import: JP ${JP} -> app ${APP}${APPLY ? "" : "  (DRY RUN)"}`);

  const [contacts, project] = await Promise.all([
    jpGet(`/projects/${JP}/contacts`),
    sb.from("projects").select("id, name").eq("id", APP).single(),
  ]);
  if (project.error || !project.data) throw new Error(`app project ${APP} not found: ${project.error?.message}`);
  if (!Array.isArray(contacts)) throw new Error("contacts endpoint did not return an array");

  const live = contacts.filter((c) => !c.isDeleted);
  console.log(`JP returned ${contacts.length} contacts (${live.length} not deleted) for "${project.data.name}".`);

  const [companies, people, memberships, projectCompanies] = await Promise.all([
    sb.from("companies").select("id, name, company_id:id").then((r) => r.data ?? []),
    sb.from("people").select("id, email, company_id").then((r) => r.data ?? []),
    sb.from("project_directory_memberships").select("id, person_id, status").eq("project_id", APP).then((r) => r.data ?? []),
    sb.from("project_companies").select("company_id").eq("project_id", APP).then((r) => r.data ?? []),
  ]);

  const companyByNorm = new Map();
  for (const c of companies) {
    const k = normCompany(c.name);
    if (k && !companyByNorm.has(k)) companyByNorm.set(k, c.id);
  }
  const personByEmail = new Map();
  for (const p of people) if (p.email) personByEmail.set(normEmail(p.email), p);
  const membershipByPerson = new Map(memberships.map((m) => [m.person_id, m]));
  const projectCompanySet = new Set(projectCompanies.map((r) => r.company_id));

  const plan = {
    companiesCreated: [], companiesMatched: 0,
    projectCompanyLinks: 0,
    peopleCreated: [], peopleMatched: 0,
    membershipsCreated: 0, membershipsReactivated: 0, membershipsExisting: 0,
    skippedNoCompany: 0,
  };

  // Resolve/create a company id for a JP company name (dedupe by normalized name).
  const createdCompanyCache = new Map();
  async function resolveCompanyId(companyName) {
    const key = normCompany(companyName);
    if (!key) return null;
    if (companyByNorm.has(key)) { plan.companiesMatched++; return companyByNorm.get(key); }
    if (createdCompanyCache.has(key)) return createdCompanyCache.get(key);
    // create
    let newId = null;
    if (APPLY) {
      const { data, error } = await sb.from("companies")
        .insert({ name: String(companyName).trim(), is_vendor: true })
        .select("id").single();
      if (error) throw new Error(`company insert "${companyName}": ${error.message}`);
      newId = data.id;
    }
    plan.companiesCreated.push(String(companyName).trim());
    createdCompanyCache.set(key, newId);
    companyByNorm.set(key, newId);
    return newId;
  }

  async function ensureProjectCompany(companyId) {
    if (!companyId || projectCompanySet.has(companyId)) return;
    plan.projectCompanyLinks++;
    projectCompanySet.add(companyId);
    if (APPLY) {
      const { error } = await sb.from("project_companies")
        .insert({ project_id: APP, company_id: companyId, company_type: "SUBCONTRACTOR", status: "ACTIVE" });
      // ignore duplicate-race (23505); surface anything else
      if (error && !String(error.message).includes("duplicate")) {
        throw new Error(`project_companies link ${companyId}: ${error.message}`);
      }
    }
  }

  for (const c of live) {
    const companyId = await resolveCompanyId(c.companyName);
    await ensureProjectCompany(companyId);

    // Resolve/create person (dedupe by email).
    const emailKey = normEmail(c.email);
    let person = emailKey ? personByEmail.get(emailKey) : null;
    if (person) {
      plan.peopleMatched++;
      // Backfill company_id if the existing person has none and we resolved one.
      if (!person.company_id && companyId && APPLY) {
        await sb.from("people").update({ company_id: companyId }).eq("id", person.id);
      }
    } else {
      const { first_name, last_name } = splitName(c.contactName, c.companyName);
      plan.peopleCreated.push(`${first_name} ${last_name}`.trim() + (c.email ? ` <${c.email}>` : ""));
      if (APPLY) {
        const { data, error } = await sb.from("people").insert({
          first_name, last_name,
          email: c.email || null,
          phone_mobile: c.cell || null,
          phone_business: c.phone || null,
          company: c.companyName || null,
          company_id: companyId,
          person_type: "contact",
          status: "active",
        }).select("id, email, company_id").single();
        if (error) throw new Error(`people insert "${c.contactName}": ${error.message}`);
        person = data;
        if (person.email) personByEmail.set(normEmail(person.email), person);
      } else {
        person = { id: `dry:${emailKey}`, email: c.email, company_id: companyId };
      }
    }

    // Ensure directory membership.
    const existingMembership = membershipByPerson.get(person.id);
    if (existingMembership) {
      if (existingMembership.status !== "active") {
        plan.membershipsReactivated++;
        if (APPLY) await sb.from("project_directory_memberships").update({ status: "active" }).eq("id", existingMembership.id);
      } else {
        plan.membershipsExisting++;
      }
    } else {
      plan.membershipsCreated++;
      if (APPLY) {
        const { data, error } = await sb.from("project_directory_memberships").insert({
          project_id: APP,
          person_id: person.id,
          permission_template_id: SUBCONTRACTOR_TEMPLATE_ID,
          role: "Subcontractor",
          user_type: "subcontractor",
          invite_status: "accepted",
          status: "active",
        }).select("id").single();
        if (error) throw new Error(`membership insert for ${person.email || person.id}: ${error.message}`);
        membershipByPerson.set(person.id, { id: data.id, person_id: person.id, status: "active" });
      }
    }
  }

  console.log(JSON.stringify({
    dryRun: !APPLY,
    companies: { matched: plan.companiesMatched, created: plan.companiesCreated },
    projectCompanyLinksAdded: plan.projectCompanyLinks,
    people: { matched: plan.peopleMatched, created: plan.peopleCreated.length, createdSample: plan.peopleCreated.slice(0, 40) },
    memberships: { created: plan.membershipsCreated, reactivated: plan.membershipsReactivated, alreadyPresent: plan.membershipsExisting },
  }, null, 2));

  if (APPLY) {
    const { count } = await sb.from("project_directory_memberships").select("*", { count: "exact", head: true }).eq("project_id", APP);
    console.log(`\nAPPLIED. project_directory_memberships for ${APP} now: ${count}`);
  }
}

main().catch((e) => { console.error("Import failed:", e.message); process.exit(1); });
