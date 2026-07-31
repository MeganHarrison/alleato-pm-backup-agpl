#!/usr/bin/env node

/**
 * One-time / idempotent import of Job Planner RFIs into the PM app `rfis` table.
 *
 * Job Planner exposes RFIs across three endpoints (verified live 2026-06-17):
 *   - list (questions)     GET /projects/{jpProjectId}/rfi        (V1)
 *   - detail + attachments GET /rfi/{rfiId}                       (V1, NOT project-scoped)
 *   - answers              GET /rfi/{rfiId}/responses             (V1, NOT project-scoped)
 *
 * What lands where:
 *   - Question-side fields (number, subject, question, status, dates, requester)
 *     become first-class `rfis` columns -> immediately visible in the RFI list/detail.
 *   - Answers + attachment metadata are preserved losslessly under `source_metadata`
 *     (the app has no structured RFI-response column; answers are modeled as
 *     collaboration_comments authored by real users, which requires a JP-user ->
 *     app-user identity map that does not exist yet — see FOLLOW-UPS below).
 *
 * Idempotency: keyed on `source_metadata->>jobplanner_rfi_id`. Re-runs UPDATE the
 * existing row rather than inserting a duplicate.
 *
 * Status map: JP status 1 -> "open", 2 -> "closed" (app's valid RFI statuses).
 *
 * Secrets: reads JOBPLANNER_API_KEY + SUPABASE_SERVICE_ROLE_KEY from env. Never printed.
 *
 * Usage:
 *   node scripts/jobplanner/import-rfis.mjs            # apply
 *   node scripts/jobplanner/import-rfis.mjs --dry-run  # preview, no writes
 *
 * FOLLOW-UPS (not done here, by design):
 *   - Land answers as collaboration_comments once JP userId -> app user_profiles map exists.
 *   - Stream attachment URLs into document_metadata + rfi_documents (reuse the
 *     Outlook-attachment download pattern) so PDFs are first-class.
 *   - Generalize beyond Noblesville (loop projects) + a cron for continuous sync.
 */

import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const __filename = fileURLToPath(import.meta.url);
const repoRoot = path.resolve(path.dirname(__filename), "../..");

// Resolve frontend deps (@supabase/supabase-js, dotenv) from the frontend package.
const frontendRequire = createRequire(path.join(repoRoot, "frontend", "package.json"));
const dotenv = frontendRequire("dotenv");
const { createClient } = frontendRequire("@supabase/supabase-js");

dotenv.config({ path: path.join(repoRoot, ".env"), quiet: true });
dotenv.config({ path: path.join(repoRoot, ".env.local"), quiet: true });
dotenv.config({ path: path.join(repoRoot, "frontend/.env.local"), quiet: true });

const DRY_RUN = process.argv.includes("--dry-run");

// --- Job Planner mapping (per-project via CLI args) ---
const argValue = (name) => {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : undefined;
};
const JP_PROJECT_ID = Number(argValue("jp"));
const APP_PROJECT_ID = Number(argValue("app"));
if (!Number.isInteger(JP_PROJECT_ID) || !Number.isInteger(APP_PROJECT_ID)) {
  console.error("Usage: node scripts/jobplanner/import-rfis.mjs --jp=<jobplannerProjectId> --app=<appProjectId> [--dry-run]");
  process.exit(1);
}

const API_V1 = "https://api.jobplanner.com";
// Cloudflare blocks default script user-agents (err 1010); send a browser UA.
const USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36";

const JP_KEY = process.env.JOBPLANNER_API_KEY?.trim();
const SUPABASE_URL =
  process.env.SUPABASE_URL?.trim() || process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
const SERVICE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() || process.env.SUPABASE_SERVICE_KEY?.trim();

if (!JP_KEY) {
  console.error("Missing JOBPLANNER_API_KEY. Add it to frontend/.env.local.");
  process.exit(1);
}
if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error("Missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY.");
  process.exit(1);
}

async function jpGet(pathname) {
  const res = await fetch(`${API_V1}${pathname}`, {
    headers: { ApiKey: JP_KEY, "User-Agent": USER_AGENT, Accept: "application/json" },
  });
  if (!res.ok) {
    throw new Error(`Job Planner ${res.status} on ${pathname}`);
  }
  return res.json();
}

const isoOrNull = (v) => (v ? new Date(v).toISOString() : null);

function mapStatus(jpStatus) {
  // JP: 1 = open, 2 = closed (observed on the Noblesville set).
  return jpStatus === 2 ? "closed" : "open";
}

function personSummary(p) {
  if (!p) return null;
  return {
    jpUserId: p.userId ?? null,
    name: p.contactName ?? null,
    email: p.email ?? null,
    company: p.companyName ?? null,
  };
}

async function buildRow(listItem) {
  const rfiId = listItem.rfiId;
  // detail carries attachments; /responses carries the answers.
  const [detail, responses] = await Promise.all([
    jpGet(`/rfi/${rfiId}`).catch(() => null),
    jpGet(`/rfi/${rfiId}/responses`).catch(() => []),
  ]);

  const attachments = Array.isArray(detail?.attachments)
    ? detail.attachments.map((a) => ({
        jpAttachmentId: a.attachmentId,
        name: a.name,
        guid: a.guid,
        url: a.url,
        createdOn: a.createdOn,
        createdBy: personSummary(a.createdBy),
      }))
    : [];

  const answers = Array.isArray(responses)
    ? responses.map((r) => ({
        jpResponseId: r.responseId,
        text: r.responseText,
        isAccepted: r.isAccepted,
        createdOn: r.createdOn,
        createdBy: personSummary(r.createdBy),
      }))
    : [];

  const requester = listItem.requestedBy;

  return {
    project_id: APP_PROJECT_ID,
    number: parseInt(String(listItem.number), 10),
    subject: listItem.title || `RFI ${listItem.number}`,
    question: listItem.question || "",
    status: mapStatus(listItem.status),
    is_private: listItem.isPublic === false,
    location: listItem.location || null,
    date_initiated: isoOrNull(listItem.createdOn),
    due_date: isoOrNull(listItem.dueDate),
    closed_date: isoOrNull(listItem.closedOn),
    created_by: requester?.contactName || null,
    received_from: requester?.companyName || requester?.contactName || null,
    source_system: "jobplanner",
    source_metadata: {
      jobplanner_rfi_id: rfiId,
      jobplanner_project_id: JP_PROJECT_ID,
      jobplanner_number: listItem.number,
      imported_endpoint: `${API_V1}/rfi/${rfiId}`,
      requested_by: personSummary(requester),
      answers,
      attachments,
    },
    updated_at: new Date().toISOString(),
  };
}

async function main() {
  console.log(
    `Importing Job Planner RFIs: JP project ${JP_PROJECT_ID} -> app project ${APP_PROJECT_ID}${DRY_RUN ? " (DRY RUN)" : ""}`,
  );

  const list = await jpGet(`/projects/${JP_PROJECT_ID}/rfi`);
  if (!Array.isArray(list) || list.length === 0) {
    console.log("No RFIs returned from Job Planner. Nothing to import.");
    return;
  }
  console.log(`Job Planner returned ${list.length} RFIs.`);

  const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { persistSession: false },
  });

  // ALL existing RFIs for this project -> two idempotency maps. `rfis.number` is an INTEGER
  // with a UNIQUE (project_id, number) index, so an existing row on the same number (even a
  // hand-entered/test row) must be ADOPTED, not inserted, or the insert collides.
  const { data: existing, error: readErr } = await supabase
    .from("rfis")
    .select("id, number, source_metadata")
    .eq("project_id", APP_PROJECT_ID);
  if (readErr) {
    throw new Error(`Failed to read existing RFIs: ${readErr.message}`);
  }
  const byJpId = new Map(
    (existing ?? [])
      .map((r) => [r.source_metadata?.jobplanner_rfi_id, r.id])
      .filter(([k]) => k != null),
  );
  const byNumber = new Map((existing ?? []).map((r) => [r.number, r.id]));

  let inserted = 0;
  let updated = 0;
  let answersTotal = 0;
  let attachmentsTotal = 0;

  for (const item of list) {
    const row = await buildRow(item);
    answersTotal += row.source_metadata.answers.length;
    attachmentsTotal += row.source_metadata.attachments.length;

    // Match by JobPlanner id (re-run), else by RFI number (adopt a pre-existing row).
    const existingId = byJpId.get(row.source_metadata.jobplanner_rfi_id) ?? byNumber.get(row.number);
    const label = `#${row.source_metadata.jobplanner_number} "${row.subject.slice(0, 40)}" [${row.status}] answers=${row.source_metadata.answers.length} att=${row.source_metadata.attachments.length}`;

    if (DRY_RUN) {
      console.log(`  ${existingId ? "UPDATE" : "INSERT"} ${label}`);
      existingId ? updated++ : inserted++;
      continue;
    }

    if (existingId) {
      const { error } = await supabase.from("rfis").update(row).eq("id", existingId);
      if (error) throw new Error(`Update failed for ${label}: ${error.message}`);
      updated++;
      console.log(`  UPDATED ${label}`);
    } else {
      const { error } = await supabase.from("rfis").insert(row);
      if (error) throw new Error(`Insert failed for ${label}: ${error.message}`);
      inserted++;
      console.log(`  INSERTED ${label}`);
    }
  }

  console.log(
    `\nDone. inserted=${inserted} updated=${updated} | preserved ${answersTotal} answers + ${attachmentsTotal} attachments in source_metadata.`,
  );
}

main().catch((err) => {
  console.error("Import failed:", err.message);
  process.exit(1);
});
