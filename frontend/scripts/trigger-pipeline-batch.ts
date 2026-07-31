/**
 * Batch trigger pending jobs through the canonical Vercel Workflow ingress.
 * Loops until no pending jobs remain. Processes 5 concurrently with 10s pauses.
 */
import { config } from "dotenv";
import { resolve } from "path";

config({ path: resolve(__dirname, "../.env.local") });
config({ path: resolve(__dirname, "../../.env") });

import { createClient } from "@supabase/supabase-js";

const APP_URL = (
  process.env.ALLEATO_APP_URL ||
  process.env.NEXT_PUBLIC_APP_URL ||
  "https://projects.alleatogroup.com"
).replace(/\/+$/, "");
const WORKFLOW_SECRET =
  process.env.RAG_PIPELINE_WORKFLOW_SECRET?.trim();
const BATCH_SIZE = 5;
const BATCH_DELAY_MS = 10_000;
const PAGE_SIZE = 500; // Supabase allows up to 1000

async function main() {
  if (!WORKFLOW_SECRET) {
    throw new Error(
      "RAG_PIPELINE_WORKFLOW_SECRET is required to trigger the RAG pipeline.",
    );
  }
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );

  let totalTriggered = 0;
  let totalErrors = 0;
  let round = 0;

  while (true) {
    round++;
    // Fetch next page of pending jobs
    const { data: jobs, error } = await supabase
      .from("fireflies_ingestion_jobs")
      .select("metadata_id")
      .eq("stage", "raw_ingested")
      .not("metadata_id", "is", null)
      .order("created_at", { ascending: true })
      .limit(PAGE_SIZE);

    if (error) throw error;
    const ids = (jobs ?? []).map((j) => j.metadata_id).filter(Boolean);

    if (ids.length === 0) {
      console.log(`\nNo more pending jobs. Total: ${totalTriggered} triggered, ${totalErrors} errors.`);
      break;
    }

    console.log(`\n=== Round ${round}: ${ids.length} pending jobs ===`);

    for (let i = 0; i < ids.length; i += BATCH_SIZE) {
      const batch = ids.slice(i, i + BATCH_SIZE);
      const batchNum = Math.floor(i / BATCH_SIZE) + 1;
      const totalBatches = Math.ceil(ids.length / BATCH_SIZE);

      const results = await Promise.allSettled(
        batch.map(async (metadataId) => {
          const res = await fetch(`${APP_URL}/api/rag-pipeline/process`, {
            method: "POST",
            headers: {
              Authorization: `Bearer ${WORKFLOW_SECRET}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ documentId: metadataId }),
          });
          if (res.status !== 202) {
            throw new Error(`HTTP ${res.status}`);
          }
          return metadataId;
        }),
      );

      for (const r of results) {
        if (r.status === "fulfilled") totalTriggered++;
        else {
          totalErrors++;
          console.error(`  Failed: ${r.reason}`);
        }
      }

      console.log(`  [${batchNum}/${totalBatches}] Total triggered: ${totalTriggered} (${totalErrors} errors)`);

      if (i + BATCH_SIZE < ids.length) {
        await new Promise((r) => setTimeout(r, BATCH_DELAY_MS));
      }
    }

    // Brief pause between rounds
    console.log(`Round ${round} complete. Checking for more...`);
    await new Promise((r) => setTimeout(r, 5_000));
  }
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
