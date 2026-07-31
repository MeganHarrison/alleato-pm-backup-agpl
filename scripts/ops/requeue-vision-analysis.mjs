/**
 * Re-queue all PDF documents in a project through the pipeline
 * so they get vision-analyzed by the new vision_analyzer stage.
 *
 * Usage:
 *   node scripts/ops/requeue-vision-analysis.mjs [projectId]
 *
 * If no projectId given, re-queues the specific Exol Morrisville PDF
 * (submittal attachment) plus all 63 drawings for project 876.
 */

import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: resolve(__dirname, "../../frontend/.env.local") });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
);

const BACKEND_URL = process.env.BACKEND_URL || process.env.PYTHON_BACKEND_URL;
const ADMIN_API_KEY = process.env.ADMIN_API_KEY?.trim();
const projectId = parseInt(process.argv[2] || "876");

if (!BACKEND_URL) throw new Error("BACKEND_URL or PYTHON_BACKEND_URL is required.");
if (!ADMIN_API_KEY) throw new Error("ADMIN_API_KEY is required.");

const DELAY_MS = 500; // stagger requests to avoid overwhelming the pipeline queue

async function queueDoc(metadataId, label) {
  const res = await fetch(`${BACKEND_URL}/api/pipeline/process`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-admin-api-key": ADMIN_API_KEY,
    },
    body: JSON.stringify({ metadataId }),
  });
  const body = await res.json().catch(() => ({}));
  const ok = res.ok && body.status === "queued";
  console.log(`  ${ok ? "✓" : "✗"} ${label} (${metadataId})`);
  return ok;
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

console.log(`\nRe-queuing PDFs for project ${projectId} → ${BACKEND_URL}\n`);

// 1. Submittal attachments — docs linked via submittal_doc_links
const { data: links } = await supabase
  .from("submittal_doc_links")
  .select("document_metadata_id, submittal_id")
  .limit(500);

const linkMetaIds = [...new Set((links || []).map((l) => l.document_metadata_id))];
if (linkMetaIds.length > 0) {
  const { data: metas } = await supabase
    .from("document_metadata")
    .select("id, title, file_path")
    .in("id", linkMetaIds)
    .ilike("file_path", "%.pdf");

  console.log(`Submittal attachments (${metas?.length ?? 0} PDFs):`);
  let s = 0, f = 0;
  for (const m of metas ?? []) {
    const ok = await queueDoc(m.id, m.title || m.file_path);
    ok ? s++ : f++;
    await sleep(DELAY_MS);
  }
  console.log(`  → ${s} queued, ${f} failed\n`);
}

// 2. Project drawings
const { data: drawings } = await supabase
  .from("drawings")
  .select("drawing_number, title, document_metadata_id")
  .eq("project_id", projectId)
  .not("document_metadata_id", "is", null);

console.log(`Drawings for project ${projectId} (${drawings?.length ?? 0}):`);
let ds = 0, df = 0;
for (const d of drawings ?? []) {
  const label = `${d.drawing_number} ${d.title || ""}`.trim();
  const ok = await queueDoc(d.document_metadata_id, label);
  ok ? ds++ : df++;
  await sleep(DELAY_MS);
}
console.log(`  → ${ds} queued, ${df} failed\n`);

console.log("Done. Monitor document_page_intelligence for results.");
