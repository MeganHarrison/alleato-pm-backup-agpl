/**
 * Batch trigger all pending pipeline jobs against the Render backend.
 * Loops until no pending jobs remain. Processes 5 concurrently with 10s pauses.
 */
import { config } from "dotenv";
import { resolve } from "path";

config({ path: resolve(__dirname, "../.env.local") });
config({ path: resolve(__dirname, "../../.env") });

import { createClient } from "@supabase/supabase-js";

const BACKEND_URL = "https://alleato-backend-rbnj.onrender.com";
const ADMIN_API_KEY = process.env.ADMIN_API_KEY?.trim();
const BATCH_SIZE = 5;
const BATCH_DELAY_MS = 10_000;
const PAGE_SIZE = 500; // Supabase allows up to 1000

async function main() {
  if (!ADMIN_API_KEY) {
    throw new Error("ADMIN_API_KEY is required to trigger the RAG pipeline.");
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
          const res = await fetch(`${BACKEND_URL}/api/pipeline/process`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "x-admin-api-key": ADMIN_API_KEY,
            },
            body: JSON.stringify({ metadataId }),
          });
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
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
