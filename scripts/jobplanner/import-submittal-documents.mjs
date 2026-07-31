#!/usr/bin/env node

/**
 * Import Job Planner submittal attachments into the PM app as first-class,
 * app-native documents ("Pattern C").
 *
 * Source: the submittal DETAIL endpoint carries the files (the list endpoint
 *   returns attachments: null):
 *     GET https://api.jobplanner.com/submittals/{submittalId}
 *       -> { attachments: [ { attachmentId, guid, name, url, size, version, ... } ] }
 *   Each attachment.url is a direct, ApiKey-authenticated download.
 *
 * What lands where (matches frontend/src/lib/documents/pattern-c-attachments.ts):
 *   1. Storage: bucket `project-files`, path `{appId}/submittal/{submittalId}/{ts}_{rand}.{ext}`
 *   2. document_metadata  — the canonical document row (source_system="jobplanner",
 *                           status="uploaded", category="attachment").
 *   3. submittal_doc_links — junction { submittal_id, document_metadata_id, attached_by, attached_at }.
 *   4. OCR/embedding: POST {APP_URL}/api/rag-pipeline/process { documentId } (best-effort),
 *                     so extracted_text / AI-review become available downstream.
 *
 * NOTE: does NOT write the legacy `submittal_documents` table (dead for writes;
 *       only read as an AI-review fallback).
 *
 * Idempotent: skips any JP attachment whose guid already appears in
 *   document_metadata.source_metadata->>jobplanner_attachment_guid for this project.
 *
 * Usage:
 *   node scripts/jobplanner/import-submittal-documents.mjs --jp=8344 --app=876                # DRY RUN
 *   node scripts/jobplanner/import-submittal-documents.mjs --jp=8344 --app=876 --apply
 *   node scripts/jobplanner/import-submittal-documents.mjs --jp=8344 --app=876 --apply --no-ocr
 */

import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import crypto from "node:crypto";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const frontendRequire = createRequire(path.join(repoRoot, "frontend", "package.json"));
const dotenv = frontendRequire("dotenv");
const { createClient } = frontendRequire("@supabase/supabase-js");
dotenv.config({ path: path.join(repoRoot, ".env"), quiet: true });
dotenv.config({ path: path.join(repoRoot, ".env.local"), quiet: true });
dotenv.config({ path: path.join(repoRoot, "frontend/.env.local"), quiet: true });

const APPLY = process.argv.includes("--apply");
const NO_OCR = process.argv.includes("--no-ocr");
const arg = (n) => { const h = process.argv.find((a) => a.startsWith(`--${n}=`)); return h ? h.slice(n.length + 3) : undefined; };
const JP = Number(arg("jp"));
const APP = Number(arg("app"));
const UPLOADER_EMAIL = String(arg("uploader-email") ?? "dsatterfield@alleatogroup.com").trim().toLowerCase();
if (!Number.isInteger(JP) || !Number.isInteger(APP)) {
  console.error("Usage: node scripts/jobplanner/import-submittal-documents.mjs --jp=<id> --app=<id> [--apply] [--no-ocr]");
  process.exit(1);
}

const JP_KEY = process.env.JOBPLANNER_API_KEY?.trim()?.replace(/^["']|["']$/g, "");
const SUPABASE_URL = process.env.SUPABASE_URL?.trim() || process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() || process.env.SUPABASE_SERVICE_KEY?.trim();
const APP_URL = (
  process.env.ALLEATO_APP_URL ||
  process.env.NEXT_PUBLIC_APP_URL ||
  "https://projects.alleatogroup.com"
).replace(/\/+$/, "");
const WORKFLOW_SECRET =
  process.env.RAG_PIPELINE_WORKFLOW_SECRET?.trim();
if (!JP_KEY) { console.error("Missing JOBPLANNER_API_KEY."); process.exit(1); }
if (!SUPABASE_URL || !SERVICE_KEY) { console.error("Missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY."); process.exit(1); }

const BUCKET = "project-files";
const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36";
const sb = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

const MIME = {
  pdf: "application/pdf", png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", gif: "image/gif",
  webp: "image/webp", tif: "image/tiff", tiff: "image/tiff", bmp: "image/bmp", heic: "image/heic",
  dwg: "image/vnd.dwg", dxf: "image/vnd.dxf",
  doc: "application/msword", docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xls: "application/vnd.ms-excel", xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  csv: "text/csv", txt: "text/plain", zip: "application/zip",
};
const extOf = (name) => (String(name).split(".").pop() || "").toLowerCase();
const mimeOf = (name) => MIME[extOf(name)] || "application/octet-stream";
const sanitize = (name) => String(name).replace(/[^a-zA-Z0-9._-]/g, "_");

async function jpGet(pathname) {
  const r = await fetch(`https://api.jobplanner.com${pathname}`, {
    headers: { ApiKey: JP_KEY, "User-Agent": UA, Accept: "application/json" },
  });
  if (!r.ok) throw new Error(`JP ${pathname} -> ${r.status}`);
  return r.json();
}

async function triggerOcr(metadataId) {
  if (NO_OCR) return { queued: false, message: "skipped" };
  if (!WORKFLOW_SECRET) {
    return { queued: false, message: "no RAG_PIPELINE_WORKFLOW_SECRET" };
  }
  try {
    const res = await fetch(`${APP_URL}/api/rag-pipeline/process`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${WORKFLOW_SECRET}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ documentId: metadataId }), cache: "no-store",
    });
    return res.status === 202 ? { queued: true, message: null } : { queued: false, message: `HTTP ${res.status}` };
  } catch (e) { return { queued: false, message: e.message }; }
}

async function main() {
  console.log(`Submittal attachments: JP ${JP} -> app ${APP}${APPLY ? "" : "  (DRY RUN)"}${NO_OCR ? "  [no-ocr]" : ""}`);

  // Uploader (attached_by / uploaded_by) — a real user_profiles id.
  const { data: uploader } = await sb.from("user_profiles").select("id, email").eq("email", UPLOADER_EMAIL).maybeSingle();
  if (!uploader) throw new Error(`Uploader ${UPLOADER_EMAIL} not found in user_profiles.`);

  // App submittals for this project — map JP submittal id (+ number::rev fallback) -> app id.
  const { data: appSubs, error: subErr } = await sb.from("submittals")
    .select("id, submittal_number, revision, metadata").eq("project_id", APP).is("deleted_at", null);
  if (subErr) throw new Error(`read submittals: ${subErr.message}`);
  const byJpId = new Map();
  const byNumRev = new Map();
  for (const s of appSubs ?? []) {
    const jpId = s.metadata?.jobplanner?.submittal_id;
    if (jpId != null) byJpId.set(String(jpId), s.id);
    byNumRev.set(`${String(s.submittal_number ?? "").trim()}::${s.revision ?? 0}`, s.id);
  }

  // Already-imported JP attachment guids (idempotency).
  const { data: existingDocs } = await sb.from("document_metadata")
    .select("source_metadata").eq("project_id", APP).eq("source_system", "jobplanner");
  const importedGuids = new Set();
  for (const d of existingDocs ?? []) {
    const g = d.source_metadata?.jobplanner_attachment_guid;
    if (g) importedGuids.add(String(g));
  }

  const list = await jpGet(`/projects/${JP}/submittals`);
  if (!Array.isArray(list)) throw new Error("submittals list did not return an array");

  const summary = { submittalsWithFiles: 0, filesFound: 0, toImport: 0, alreadyImported: 0, unmatchedSubmittals: [], imported: 0, failed: 0, ocrQueued: 0, plan: [] };

  for (const item of list) {
    const detail = await jpGet(`/submittals/${item.submittalId}`);
    const atts = Array.isArray(detail.attachments) ? detail.attachments : [];
    if (atts.length === 0) continue;
    summary.submittalsWithFiles++;
    summary.filesFound += atts.length;

    const appId = byJpId.get(String(item.submittalId))
      ?? byNumRev.get(`${String(item.submittalNumber ?? "").trim()}::${Math.max(Number(item.lastRevisionNumber ?? 0) || 0, 0)}`)
      ?? byNumRev.get(`${String(item.submittalNumber ?? "").trim()}::0`);
    if (!appId) {
      summary.unmatchedSubmittals.push(`#${item.submittalNumber} (jpId ${item.submittalId})`);
      continue;
    }

    for (const a of atts) {
      const guid = String(a.guid ?? a.attachmentId ?? "");
      if (guid && importedGuids.has(guid)) { summary.alreadyImported++; continue; }
      summary.toImport++;
      summary.plan.push({ submittal: `#${item.submittalNumber}`, file: a.name, version: a.version });

      if (!APPLY) continue;

      let storagePath = null;
      let docId = null;
      try {
        // 1. download from JP
        const dl = await fetch(a.url, { headers: { ApiKey: JP_KEY, "User-Agent": UA } });
        if (!dl.ok) throw new Error(`download ${dl.status}`);
        const buf = Buffer.from(await dl.arrayBuffer());
        const ext = extOf(a.name);
        const contentType = mimeOf(a.name);
        const safeName = sanitize(a.name);
        storagePath = `${APP}/submittal/${appId}/${Date.now()}_${crypto.randomUUID().slice(0, 8)}${ext ? `.${ext}` : ""}`;

        // 2. upload to storage
        const { error: upErr } = await sb.storage.from(BUCKET).upload(storagePath, buf, { contentType, upsert: false });
        if (upErr) throw new Error(`upload: ${upErr.message}`);

        // 3. document_metadata
        docId = crypto.randomUUID();
        const today = new Date().toISOString().split("T")[0];
        const { error: metaErr } = await sb.from("document_metadata").insert({
          id: docId,
          title: a.name,
          file_name: safeName,
          file_path: storagePath,
          storage_bucket: BUCKET,
          source: "jobplanner",
          source_system: "jobplanner",
          status: "uploaded",
          project_id: APP,
          type: contentType,
          category: "attachment",
          source_size: a.size || buf.length,
          date: today,
          document_type: "submittal",
          source_metadata: {
            uploaded_by: uploader.id,
            uploaded_for_entity_type: "submittal",
            uploaded_for_entity_id: appId,
            jobplanner_submittal_id: item.submittalId,
            jobplanner_attachment_id: a.attachmentId ?? null,
            jobplanner_attachment_guid: guid || null,
            jobplanner_version: a.version ?? null,
          },
        });
        if (metaErr) { await sb.storage.from(BUCKET).remove([storagePath]); throw new Error(`metadata: ${metaErr.message}`); }

        // 4. submittal_doc_links junction
        const { error: linkErr } = await sb.from("submittal_doc_links").insert({
          submittal_id: appId,
          document_metadata_id: docId,
          attached_by: uploader.id,
          attached_at: new Date().toISOString(),
          document_type: "submittal",
        });
        if (linkErr) {
          await sb.from("document_metadata").delete().eq("id", docId);
          await sb.storage.from(BUCKET).remove([storagePath]);
          throw new Error(`link: ${linkErr.message}`);
        }

        if (guid) importedGuids.add(guid);
        summary.imported++;

        // 5. OCR/embedding (best-effort)
        const ocr = await triggerOcr(docId);
        if (ocr.queued) summary.ocrQueued++;
        console.log(`  ✓ #${item.submittalNumber} "${a.name}" -> ${appId.slice(0, 8)}  ocr=${ocr.queued ? "queued" : ocr.message}`);
      } catch (e) {
        summary.failed++;
        console.error(`  ✗ #${item.submittalNumber} "${a.name}": ${e.message}`);
      }
    }
  }

  console.log(JSON.stringify({
    dryRun: !APPLY,
    submittalsWithFiles: summary.submittalsWithFiles,
    filesFound: summary.filesFound,
    alreadyImported: summary.alreadyImported,
    toImport: summary.toImport,
    unmatchedSubmittals: summary.unmatchedSubmittals,
    ...(APPLY ? { imported: summary.imported, failed: summary.failed, ocrQueued: summary.ocrQueued } : { plan: summary.plan }),
  }, null, 2));
}

main().catch((e) => { console.error("Import failed:", e.message); process.exit(1); });
