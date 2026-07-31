#!/usr/bin/env node

import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

import {
  buildDrawingNaturalKey,
  buildDrawingSetKey,
  inferFileType,
  normalizeDate,
  normalizeName,
  normalizeRevisionCode,
  normalizeRevisionName,
  pickCurrentRevision,
} from "./import-drawings-lib.mjs";

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
const UPLOADER_EMAIL = String(argValue("uploader-email", "bclymer@alleatogroup.com")).trim().toLowerCase();

if (!Number.isInteger(JP_PROJECT_ID) || !Number.isInteger(APP_PROJECT_ID)) {
  console.error("Usage: node scripts/jobplanner/import-drawings.mjs --jp=<jobplannerProjectId> --app=<alleatoProjectId> [--dry-run] [--uploader-email=email]");
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

async function fetchFileDetails(url) {
  const response = await fetch(url, {
    headers: {
      ApiKey: JP_KEY,
      Accept: "*/*",
      "User-Agent": USER_AGENT,
    },
  });

  if (!response.ok) {
    throw new Error(`Job Planner ${response.status} on file download ${url.replace(API_V1, "")}`);
  }

  const bytes = Buffer.from(await response.arrayBuffer());
  const contentType = response.headers.get("content-type");
  const contentDisposition = response.headers.get("content-disposition");
  const fileNameMatch = contentDisposition?.match(/filename=\"([^\"]+)\"/i);

  return {
    fileSize: bytes.byteLength,
    contentType,
    fileNameFromHeader: fileNameMatch?.[1] ?? null,
  };
}

function groupRealVersions(versions) {
  return versions.filter((version) => Number(version?.versionId) !== -1);
}

function getExistingDrawingMap(drawings) {
  return new Map(
    drawings.map((drawing) => [buildDrawingNaturalKey(drawing.drawing_number), drawing]),
  );
}

function getExistingSetMap(sets) {
  return new Map(
    sets.map((drawingSet) => [`${drawingSet.name}::${normalizeDate(drawingSet.issued_at) ?? ""}`, drawingSet]),
  );
}

function getExistingRevisionMap(revisions) {
  return new Map(
    revisions.map((revision) => [`${revision.drawing_id}::${revision.revision_number}`, revision]),
  );
}

async function main() {
  console.log(
    `Importing Job Planner drawings: JP project ${JP_PROJECT_ID} -> app project ${APP_PROJECT_ID}${DRY_RUN ? " (DRY RUN)" : ""}`,
  );

  const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { persistSession: false },
  });

  const [
    versionsPayload,
    { data: appProject, error: appProjectError },
    { data: userProfile, error: userProfileError },
    { data: existingSets, error: existingSetsError },
    { data: existingDrawings, error: existingDrawingsError },
  ] = await Promise.all([
    jpGet(`${API_V1}/projects/${JP_PROJECT_ID}/versions`),
    supabase.from("projects").select("id, name, archived").eq("id", APP_PROJECT_ID).single(),
    supabase.from("user_profiles").select("id, email").ilike("email", UPLOADER_EMAIL).maybeSingle(),
    supabase.from("drawing_sets").select("id, name, issued_at").eq("project_id", APP_PROJECT_ID),
    supabase
      .from("drawings")
      .select("id, drawing_number, current_revision_id, review_revision_id")
      .eq("project_id", APP_PROJECT_ID),
  ]);

  if (appProjectError || !appProject) {
    throw new Error(`Could not load app project ${APP_PROJECT_ID}: ${appProjectError?.message ?? "missing project"}`);
  }
  if (userProfileError || !userProfile) {
    throw new Error(`Could not resolve uploader user for ${UPLOADER_EMAIL}: ${userProfileError?.message ?? "missing user"}`);
  }
  if (existingSetsError) throw new Error(`Could not load drawing sets: ${existingSetsError.message}`);
  if (existingDrawingsError) throw new Error(`Could not load drawings: ${existingDrawingsError.message}`);
  if (!Array.isArray(versionsPayload)) {
    throw new Error("Job Planner versions endpoint did not return an array.");
  }

  const versions = groupRealVersions(versionsPayload);
  const existingDrawingMap = getExistingDrawingMap(existingDrawings ?? []);
  const existingSetMap = getExistingSetMap(existingSets ?? []);

  const uniqueDrawingNumbers = new Set();
  for (const version of versions) {
    for (const drawing of version.drawings ?? []) {
      const drawingNumber = normalizeName(drawing?.name, "");
      if (!drawingNumber) continue;
      uniqueDrawingNumbers.add(buildDrawingNaturalKey(drawingNumber));
    }
  }

  const { data: existingRevisions, error: existingRevisionsError } = await supabase
    .from("drawing_revisions")
    .select("id, drawing_id, revision_number")
    .in("drawing_id", [...new Set((existingDrawings ?? []).map((drawing) => drawing.id))].length > 0
      ? [...new Set((existingDrawings ?? []).map((drawing) => drawing.id))]
      : ["00000000-0000-0000-0000-000000000000"]);

  if (existingRevisionsError) {
    throw new Error(`Could not load drawing revisions: ${existingRevisionsError.message}`);
  }

  const existingRevisionMap = getExistingRevisionMap(existingRevisions ?? []);

  const setOps = [];
  const drawingOpsByKey = new Map();
  const revisionOps = [];

  const stagedSetIds = new Map();
  for (const version of versions) {
    const setKey = buildDrawingSetKey(version);
    const existingSet = existingSetMap.get(setKey);

    if (existingSet) {
      stagedSetIds.set(setKey, existingSet.id);
      continue;
    }

    setOps.push({
      mode: "insert",
      key: setKey,
        payload: {
          project_id: APP_PROJECT_ID,
          name: normalizeRevisionName(version),
          issued_at: version.issuedOn ?? version.createdOn ?? new Date().toISOString(),
          status: "active",
          description: `Imported from Job Planner project ${JP_PROJECT_ID}`,
          created_by: userProfile.id,
        },
      });
  }

  const latestByDrawingNumber = new Map();
  for (const drawingKey of uniqueDrawingNumbers) {
    const drawingNumber = drawingKey;
    const winner = pickCurrentRevision(
      versions,
      drawingNumber,
    );
    if (winner) {
      latestByDrawingNumber.set(drawingKey, {
        versionId: winner.version.versionId,
        revisionCode: normalizeRevisionCode(winner.version),
      });
    }
  }

  for (const version of versions) {
    const setKey = buildDrawingSetKey(version);

    for (const drawing of version.drawings ?? []) {
      const drawingNumber = normalizeName(drawing?.name, "");
      if (!drawingNumber) {
        throw new Error(`Job Planner drawing in version ${version.versionId} is missing a drawing name.`);
      }

      const drawingKey = buildDrawingNaturalKey(drawingNumber);
      const existingDrawing = existingDrawingMap.get(drawingKey) ?? null;
      const revisionName = normalizeRevisionName(version);
      const revisionCode = normalizeRevisionCode(version);
      const isCurrent = latestByDrawingNumber.get(drawingKey)?.revisionCode === revisionCode;

      const title = normalizeName(drawing?.title, drawingNumber);
      const discipline = Array.isArray(drawing?.tags) && drawing.tags.length > 0
        ? normalizeName(drawing.tags[0], null)
        : null;

      if (!drawingOpsByKey.has(drawingKey)) {
        if (!existingDrawing) {
          drawingOpsByKey.set(drawingKey, {
            mode: "insert",
            drawingKey,
            payload: {
              project_id: APP_PROJECT_ID,
              drawing_number: drawingNumber,
              title,
              discipline,
              drawing_type: null,
              is_published: true,
              is_obsolete: false,
              created_by: userProfile.id,
            },
          });
        } else {
          drawingOpsByKey.set(drawingKey, {
            mode: "update",
            id: existingDrawing.id,
            drawingKey,
            payload: {
              title,
              discipline,
              drawing_type: null,
              is_published: true,
              is_obsolete: false,
              updated_at: new Date().toISOString(),
            },
          });
        }
      }

      revisionOps.push({
        drawingKey,
        revisionName,
        revisionCode,
        setKey,
        versionId: version.versionId,
        drawing,
        isCurrent,
      });
    }
  }

  const drawingOps = [...drawingOpsByKey.values()];

  const summary = {
    project: {
      jobPlannerProjectId: JP_PROJECT_ID,
      appProjectId: APP_PROJECT_ID,
      appProjectName: appProject.name,
    },
    totals: {
      sourceVersions: versions.length,
      sourceDrawings: revisionOps.length,
      uniqueDrawings: uniqueDrawingNumbers.size,
      drawingSetInserts: setOps.length,
      drawingInserts: drawingOps.filter((operation) => operation.mode === "insert").length,
      drawingUpdates: drawingOps.filter((operation) => operation.mode === "update").length,
      revisionCandidates: revisionOps.length,
    },
  };

  console.log(JSON.stringify(summary, null, 2));

  if (DRY_RUN) {
    return;
  }

  for (const operation of setOps) {
    const { data, error } = await supabase
      .from("drawing_sets")
      .insert(operation.payload)
      .select("id, name, issued_at")
      .single();

    if (error || !data) {
      throw new Error(`Insert failed for drawing set ${operation.payload.name}: ${error?.message ?? "missing row"}`);
    }

    stagedSetIds.set(operation.key, data.id);
  }

  for (const [key, existingSet] of existingSetMap.entries()) {
    stagedSetIds.set(key, existingSet.id);
  }

  const stagedDrawingIds = new Map();
  for (const operation of drawingOps) {
    if (operation.mode === "insert") {
      const { data, error } = await supabase
        .from("drawings")
        .insert(operation.payload)
        .select("id, drawing_number")
        .single();

      if (error || !data) {
        throw new Error(`Insert failed for drawing ${operation.payload.drawing_number}: ${error?.message ?? "missing row"}`);
      }

      stagedDrawingIds.set(operation.drawingKey, data.id);
      continue;
    }

    const { error } = await supabase.from("drawings").update(operation.payload).eq("id", operation.id);
    if (error) {
      throw new Error(`Update failed for drawing ${operation.drawingKey}: ${error.message}`);
    }

    stagedDrawingIds.set(operation.drawingKey, operation.id);
  }

  for (const [drawingKey, existingDrawing] of existingDrawingMap.entries()) {
    if (!stagedDrawingIds.has(drawingKey)) {
      stagedDrawingIds.set(drawingKey, existingDrawing.id);
    }
  }

  const insertedDrawingIds = [...stagedDrawingIds.values()];
  const { data: allRevisions, error: allRevisionsError } = await supabase
    .from("drawing_revisions")
    .select("id, drawing_id, revision_number, description, is_current_revision")
    .in("drawing_id", insertedDrawingIds.length > 0 ? insertedDrawingIds : ["00000000-0000-0000-0000-000000000000"]);

  if (allRevisionsError) {
    throw new Error(`Could not reload drawing revisions: ${allRevisionsError.message}`);
  }

  const revisionMap = getExistingRevisionMap(allRevisions ?? []);
  const revisionResults = [];

  for (const operation of revisionOps) {
    const drawingId = stagedDrawingIds.get(operation.drawingKey);
    const drawingSetId = stagedSetIds.get(operation.setKey) ?? null;

    if (!drawingId) {
      throw new Error(`Missing staged drawing id for ${operation.drawingKey}.`);
    }

    const revisionKey = `${drawingId}::${operation.revisionCode}`;
    const existingRevision = revisionMap.get(revisionKey) ?? null;
    const fileDetails = await fetchFileDetails(operation.drawing.url);
    const fileName = normalizeName(
      operation.drawing.fileName ?? fileDetails.fileNameFromHeader,
      `${normalizeName(operation.drawing.name)}.pdf`,
    );
    const fileType = inferFileType(fileName, fileDetails.contentType);
    const payload = {
      drawing_id: drawingId,
      revision_number: operation.revisionCode,
      drawing_set_id: drawingSetId,
      drawing_date: normalizeDate(operation.drawing.issuedOn ?? operation.drawing.createdOn ?? null),
      received_date: normalizeDate(operation.drawing.createdOn ?? operation.drawing.issuedOn ?? operation.drawing.createdOn ?? null) ?? new Date().toISOString().slice(0, 10),
      status: "approved",
      file_url: operation.drawing.url,
      file_name: fileName,
      file_size: fileDetails.fileSize,
      file_type: fileType,
      description: `Imported from Job Planner version ${operation.revisionName}`,
      uploaded_by: userProfile.id,
      is_current_revision: operation.isCurrent,
      is_published: true,
      published_at: new Date().toISOString(),
      published_by: userProfile.id,
      rotation_degrees: Number(operation.drawing.rotation ?? 0) || 0,
      ocr_confidence_label: "unknown",
      ocr_confidence_score: null,
      ocr_confidence_source: "not_run",
    };

    if (!existingRevision) {
      const { data, error } = await supabase
        .from("drawing_revisions")
        .insert(payload)
        .select("id")
        .single();

      if (error || !data) {
        throw new Error(`Insert failed for drawing revision ${revisionKey}: ${error?.message ?? "missing row"}`);
      }

      revisionMap.set(revisionKey, { id: data.id, drawing_id: drawingId, revision_number: operation.revisionCode });
      revisionResults.push({
        drawingId,
        revisionId: data.id,
        isCurrent: operation.isCurrent,
        mode: "insert",
      });
      continue;
    }

    const { error } = await supabase
      .from("drawing_revisions")
      .update(payload)
      .eq("id", existingRevision.id);

    if (error) {
      throw new Error(`Update failed for drawing revision ${revisionKey}: ${error.message}`);
    }

    revisionResults.push({
      drawingId,
      revisionId: existingRevision.id,
      isCurrent: operation.isCurrent,
      mode: "update",
    });
  }

  const currentRevisionByDrawingId = new Map(
    revisionResults.filter((result) => result.isCurrent).map((result) => [result.drawingId, result.revisionId]),
  );

  for (const [drawingId, revisionId] of currentRevisionByDrawingId.entries()) {
    const { error: unsetError } = await supabase
      .from("drawing_revisions")
      .update({ is_current_revision: false })
      .eq("drawing_id", drawingId)
      .neq("id", revisionId);

    if (unsetError) {
      throw new Error(`Could not clear previous current revisions for drawing ${drawingId}: ${unsetError.message}`);
    }

    const { error: drawingError } = await supabase
      .from("drawings")
      .update({
        current_revision_id: revisionId,
        review_revision_id: revisionId,
        is_published: true,
        updated_at: new Date().toISOString(),
      })
      .eq("id", drawingId);

    if (drawingError) {
      throw new Error(`Could not update current revision pointers for drawing ${drawingId}: ${drawingError.message}`);
    }
  }

  const obsoleteRevisionIds = [];
  const expectedRevisionByDescription = new Map(
    revisionOps.map((operation) => [
      `${stagedDrawingIds.get(operation.drawingKey)}::Imported from Job Planner version ${operation.revisionName}`,
      operation.revisionCode,
    ]),
  );

  for (const revision of allRevisions ?? []) {
    const expectedCode = expectedRevisionByDescription.get(`${revision.drawing_id}::${revision.description ?? ""}`);
    if (!expectedCode) continue;
    if (revision.revision_number === expectedCode) continue;
    if (revision.is_current_revision) continue;
    obsoleteRevisionIds.push(revision.id);
  }

  if (obsoleteRevisionIds.length > 0) {
    const { error: deleteError } = await supabase
      .from("drawing_revisions")
      .delete()
      .in("id", obsoleteRevisionIds);

    if (deleteError) {
      throw new Error(`Could not delete obsolete Job Planner revisions: ${deleteError.message}`);
    }
  }

  const { count: drawingCount, error: drawingCountError } = await supabase
    .from("drawings")
    .select("*", { count: "exact", head: true })
    .eq("project_id", APP_PROJECT_ID);

  const { data: revisionRows, error: revisionCountError } = await supabase
    .from("drawing_revisions")
    .select("id, drawing_id")
    .in("drawing_id", insertedDrawingIds.length > 0 ? insertedDrawingIds : ["00000000-0000-0000-0000-000000000000"]);

  if (drawingCountError) throw new Error(`Drawing read-back failed: ${drawingCountError.message}`);
  if (revisionCountError) throw new Error(`Revision read-back failed: ${revisionCountError.message}`);

  console.log(
    JSON.stringify(
      {
        result: "ok",
        drawingSetsInserted: setOps.length,
        drawingsInserted: drawingOps.filter((operation) => operation.mode === "insert").length,
        drawingsUpdated: drawingOps.filter((operation) => operation.mode === "update").length,
        revisionsInserted: revisionResults.filter((result) => result.mode === "insert").length,
        revisionsUpdated: revisionResults.filter((result) => result.mode === "update").length,
        obsoleteRevisionsDeleted: obsoleteRevisionIds.length,
        totalDrawingsAfterImport: drawingCount,
        totalRevisionsAfterImport: revisionRows.length,
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
