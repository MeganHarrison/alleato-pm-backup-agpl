/**
 * One-time backfill: re-embed existing conversation memories
 * with text-embedding-3-large at 3072 dims.
 *
 * Usage: cd frontend && npx tsx ../scripts/backfill-conversation-embeddings.ts
 */
import { config } from "dotenv";
import { resolve } from "path";

// Load env — script lives in frontend/scripts/
config({ path: resolve(__dirname, "../.env.local") });
config({ path: resolve(__dirname, "../../.env") });

import OpenAI from "openai";
import { createClient } from "@supabase/supabase-js";

const EMBEDDING_MODEL = "text-embedding-3-large";
const EMBEDDING_DIMENSIONS = 3072;

async function main() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  }

  const gatewayKey = process.env.AI_GATEWAY_API_KEY;
  const openaiKey = process.env.OPENAI_API_KEY;
  const openai = gatewayKey
    ? new OpenAI({ apiKey: gatewayKey, baseURL: "https://ai-gateway.vercel.sh/v1" })
    : new OpenAI({ apiKey: openaiKey! });

  const supabase = createClient(supabaseUrl, serviceKey);

  // Fetch all conversation memories
  const { data: memories, error } = await supabase
    .from("memories")
    .select("id, content, session_id")
    .eq("memory_type", "conversation_summary")
    .order("created_at", { ascending: true });

  if (error) throw error;
  if (!memories?.length) {
    console.log("No conversation memories to backfill.");
    return;
  }

  console.log(`Found ${memories.length} conversation memories to re-embed.`);

  // Batch embed all at once
  const texts = memories.map((m) => (m.content || "").substring(0, 8000));
  const response = await openai.embeddings.create({
    model: EMBEDDING_MODEL,
    dimensions: EMBEDDING_DIMENSIONS,
    input: texts,
  });

  console.log(`Generated ${response.data.length} embeddings (${EMBEDDING_DIMENSIONS} dims).`);

  // Update each row
  let updated = 0;
  for (let i = 0; i < memories.length; i++) {
    const embedding = response.data[i].embedding;
    const { error: updateError } = await supabase
      .from("memories")
      .update({ embedding })
      .eq("id", memories[i].id);

    if (updateError) {
      console.error(`Failed to update memory ${memories[i].id}:`, updateError.message);
    } else {
      updated++;
      console.log(`  [${updated}/${memories.length}] Updated memory ${memories[i].id} (session ${memories[i].session_id})`);
    }
  }

  console.log(`\nDone. ${updated}/${memories.length} memories re-embedded with ${EMBEDDING_MODEL} @ ${EMBEDDING_DIMENSIONS} dims.`);
}

main().catch((err) => {
  console.error("Backfill failed:", err);
  process.exit(1);
});
