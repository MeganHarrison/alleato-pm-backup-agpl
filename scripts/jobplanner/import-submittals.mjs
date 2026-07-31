#!/usr/bin/env node

import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

import {
  buildSubmittalMetadata,
  formatPartyDisplay,
  mapSubmittalStatus,
  mapSubmittalTypeName,
  normalizeDate,
} from "./import-submittals-lib.mjs";

const __filename = fileURLToPath(import.meta.url);
const repoRoot = path.resolve(path.dirname(__filename), "../..");

const frontendRequire = createRequire(path.join(repoRoot, "frontend", "package.json"));
const dotenv = frontendRequire("dotenv");
const { createClient } = frontendRequire("@supabase/supabase-js");

dotenv.config({ path: path.join(repoRoot, ".env"), quiet: true });
dotenv.config({ path: path.join(repoRoot, ".env.local"), quiet: true });
dotenv.config({ path: path.join(repoRoot, "frontend/.env.local"), quiet: true });

const API_V1 = "https://api.jobplanner.com";
const USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36";

const argValue = (name, fallback = null) => {
  const hit = process.argv.find((arg) => arg.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : fallback;
};

const DRY_RUN = process.argv.includes("--dry-run");
const JP_PROJECT_ID = Number(argValue("jp"));
const APP_PROJECT_ID = Number(argValue("app"));
const SUBMITTER_EMAIL = String(argValue("submitter-email", "bclymer@alleatogroup.com")).trim().toLowerCase();

if (!Number.isInteger(JP_PROJECT_ID) || !Number.isInteger(APP_PROJECT_ID)) {
  console.error("Usage: node scripts/jobplanner/import-submittals.mjs --jp=<jobplannerProjectId> --app=<alleatoProjectId> [--dry-run] [--submitter-email=email]");
  process.exit(1);
}

const JP_KEY = process.env.JOBPLANNER_API_KEY?.trim();
const SUPABASE_URL =
  process.env.SUPABASE_URL?.trim() || process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
const SERVICE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() || process.env.SUPABASE_SERVICE_KEY?.trim();

if (!JP_KEY) {
  console.error("Missing JOBPLANNER_API_KEY.");
  process.exit(1);
}
if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error("Missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY.");
  process.exit(1);
}

async function jpGet(url) {
  const response = await fetch(url, {
    headers: {
      ApiKey: JP_KEY,
      Accept: "application/json",
      "User-Agent": USER_AGENT,
    },
  });

  if (!response.ok) {
    throw new Error(`Job Planner ${response.status} on ${url.replace(API_V1, "")}`);
  }

  return response.json();
}

function nameKey(value) {
  return String(value ?? "").trim().toLowerCase();
}

function getExistingByJobPlannerId(existingRows) {
  const byJobPlannerId = new Map();
  for (const row of existingRows) {
    const jobPlannerId = row?.metadata?.jobplanner?.submittal_id;
    if (jobPlannerId != null) {
      byJobPlannerId.set(String(jobPlannerId), row);
    }
  }
  return byJobPlannerId;
}

function getExistingByNumberRevision(existingRows) {
  const byNumberRevision = new Map();
  for (const row of existingRows) {
    const key = `${row.submittal_number}::${row.revision ?? 0}`;
    byNumberRevision.set(key, row);
  }
  return byNumberRevision;
}

async function main() {
  console.log(
    `Importing Job Planner submittals: JP project ${JP_PROJECT_ID} -> app project ${APP_PROJECT_ID}${DRY_RUN ? " (DRY RUN)" : ""}`,
  );

  const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { persistSession: false },
  });

  const [
    jobPlannerSubmittals,
    { data: appProject, error: appProjectError },
    { data: userProfiles, error: userProfilesError },
    { data: companyRows, error: companyRowsError },
    { data: submittalTypes, error: submittalTypesError },
    { data: existingRows, error: existingRowsError },
  ] = await Promise.all([
    jpGet(`${API_V1}/projects/${JP_PROJECT_ID}/submittals`),
    supabase.from("projects").select("id, name, archived").eq("id", APP_PROJECT_ID).single(),
    supabase.from("user_profiles").select("id, email"),
    supabase.from("companies").select("id, name"),
    supabase.from("submittal_types").select("id, name"),
    supabase
      .from("submittals")
      .select("id, submittal_number, revision, metadata")
      .eq("project_id", APP_PROJECT_ID),
  ]);

  if (appProjectError || !appProject) {
    throw new Error(`Could not load app project ${APP_PROJECT_ID}: ${appProjectError?.message ?? "missing project"}`);
  }
  if (userProfilesError) throw new Error(`Could not load user profiles: ${userProfilesError.message}`);
  if (companyRowsError) throw new Error(`Could not load companies: ${companyRowsError.message}`);
  if (submittalTypesError) throw new Error(`Could not load submittal types: ${submittalTypesError.message}`);
  if (existingRowsError) throw new Error(`Could not load existing submittals: ${existingRowsError.message}`);
  if (!Array.isArray(jobPlannerSubmittals)) {
    throw new Error("Job Planner submittals endpoint did not return an array.");
  }

  const submitter = userProfiles.find((profile) => nameKey(profile.email) === SUBMITTER_EMAIL);
  if (!submitter) {
    throw new Error(`Could not resolve submitted_by user for ${SUBMITTER_EMAIL}.`);
  }

  const userIdByEmail = new Map(
    userProfiles
      .filter((profile) => profile.email)
      .map((profile) => [nameKey(profile.email), profile.id]),
  );
  const companyIdByName = new Map(companyRows.map((company) => [nameKey(company.name), company.id]));
  const submittalTypeByName = new Map(submittalTypes.map((type) => [nameKey(type.name), type]));
  const existingByJobPlannerId = getExistingByJobPlannerId(existingRows ?? []);
  const existingByNumberRevision = getExistingByNumberRevision(existingRows ?? []);

  const operations = [];

  for (const source of jobPlannerSubmittals) {
    const mappedTypeName = mapSubmittalTypeName(source.itemTypes);
    const mappedType = submittalTypeByName.get(nameKey(mappedTypeName))
      ?? submittalTypeByName.get(nameKey("Other"))
      ?? null;
    if (!mappedType) {
      throw new Error(`Could not resolve a local submittal type for Job Planner submittal ${source.submittalId}.`);
    }

    const revision = Math.max(Number(source.lastRevisionNumber ?? 0) || 0, 0);
    const existing =
      existingByJobPlannerId.get(String(source.submittalId))
      ?? existingByNumberRevision.get(`${String(source.submittalNumber ?? "").trim()}::${revision}`)
      ?? null;

    const managerId = userIdByEmail.get(nameKey(source.manager?.email)) ?? submitter.id;
    const responsibleContractorId =
      companyIdByName.get(nameKey(source.ballInCourt?.companyName)) ?? null;
    const payload = {
      project_id: APP_PROJECT_ID,
      submittal_number: String(source.submittalNumber ?? "").trim(),
      revision,
      title: String(source.title ?? "").trim() || `Submittal ${source.submittalId}`,
      status: mapSubmittalStatus(source),
      submittal_type: mappedType.name,
      submittal_type_id: mappedType.id,
      description: String(source.notes ?? "").trim() || null,
      final_due_date: normalizeDate(source.dueDate),
      submission_date: normalizeDate(source.submittedOn),
      required_approval_date: normalizeDate(source.approvedDate),
      ball_in_court: formatPartyDisplay(source.ballInCourt),
      submitter_company: String(source.ballInCourt?.companyName ?? "").trim() || null,
      responsible_contractor_id: responsibleContractorId,
      submittal_manager_id: managerId,
      is_private: false,
      submitted_by: submitter.id,
      created_by: submitter.id,
      updated_by: submitter.id,
      metadata: buildSubmittalMetadata(JP_PROJECT_ID, source),
    };

    if (!payload.submittal_number) {
      throw new Error(`Job Planner submittal ${source.submittalId} is missing submittalNumber.`);
    }

    operations.push({
      mode: existing ? "update" : "insert",
      id: existing?.id ?? null,
      jobPlannerSubmittalId: source.submittalId,
      payload,
    });
  }

  const summary = {
    project: { jobPlannerProjectId: JP_PROJECT_ID, appProjectId: APP_PROJECT_ID, appProjectName: appProject.name },
    totals: {
      sourceSubmittals: jobPlannerSubmittals.length,
      existingRows: (existingRows ?? []).length,
      inserts: operations.filter((operation) => operation.mode === "insert").length,
      updates: operations.filter((operation) => operation.mode === "update").length,
    },
  };

  console.log(JSON.stringify(summary, null, 2));

  if (DRY_RUN) {
    return;
  }

  let inserted = 0;
  let updated = 0;
  for (const operation of operations) {
    if (operation.mode === "insert") {
      const { error } = await supabase.from("submittals").insert(operation.payload);
      if (error) {
        throw new Error(`Insert failed for JP submittal ${operation.jobPlannerSubmittalId}: ${error.message}`);
      }
      inserted += 1;
      continue;
    }

    const { error } = await supabase
      .from("submittals")
      .update(operation.payload)
      .eq("id", operation.id);
    if (error) {
      throw new Error(`Update failed for JP submittal ${operation.jobPlannerSubmittalId}: ${error.message}`);
    }
    updated += 1;
  }

  const { count, error: countError } = await supabase
    .from("submittals")
    .select("*", { count: "exact", head: true })
    .eq("project_id", APP_PROJECT_ID);

  if (countError) {
    throw new Error(`Read-back count failed: ${countError.message}`);
  }

  console.log(
    JSON.stringify(
      {
        result: "ok",
        inserted,
        updated,
        projectId: APP_PROJECT_ID,
        totalSubmittalsAfterImport: count,
      },
      null,
      2,
    ),
  );
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
