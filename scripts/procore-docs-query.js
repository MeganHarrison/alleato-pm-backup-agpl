#!/usr/bin/env node
/**
 * Query Procore documentation embeddings stored in Supabase.
 *
 * Usage (from project root):
 *   node scripts/procore-docs-query.js "your question about Procore"
 *   node scripts/procore-docs-query.js "change order statuses" 12   # optional topK
 *
 * Returns the top matching documentation chunks with similarity scores.
 * Uses the same search_support_articles RPC and text-embedding-3-large model
 * as the /api/procore-docs/ask production endpoint.
 */

import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

// Load frontend/.env manually (dotenv not available as ESM at root)
function loadEnv(envPath) {
  try {
    const content = readFileSync(envPath, "utf8");
    for (const line of content.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eq = trimmed.indexOf("=");
      if (eq === -1) continue;
      const key = trimmed.slice(0, eq).trim();
      const val = trimmed.slice(eq + 1).trim().replace(/^['"]|['"]$/g, "");
      if (!process.env[key]) process.env[key] = val;
    }
  } catch {
    // file might not exist — fall through to env check
  }
}

loadEnv(resolve(__dirname, "../frontend/.env"));
loadEnv(resolve(__dirname, "../frontend/.env.local"));

const query = process.argv[2];
if (!query) {
  console.error('Usage: node scripts/procore-docs-query.js "your question"');
  process.exit(1);
}

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const OPENAI_API_KEY = process.env.AI_GATEWAY_API_KEY || process.env.OPENAI_API_KEY;
const OPENAI_BASE = process.env.AI_GATEWAY_API_KEY
  ? "https://ai-gateway.vercel.sh/v1"
  : "https://api.openai.com/v1";

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in frontend/.env");
  process.exit(1);
}
if (!OPENAI_API_KEY) {
  console.error("Missing AI_GATEWAY_API_KEY or OPENAI_API_KEY in frontend/.env");
  process.exit(1);
}

const TOP_K = parseInt(process.argv[3] || "8", 10);

async function generateEmbedding(text) {
  const res = await fetch(`${OPENAI_BASE}/embeddings`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${OPENAI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "text-embedding-3-large",
      dimensions: 3072,
      input: text.substring(0, 8000),
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`OpenAI embedding error (${res.status}): ${err}`);
  }

  const data = await res.json();
  return data.data[0].embedding;
}

async function searchDocs(embedding) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/search_support_articles`, {
    method: "POST",
    headers: {
      apikey: SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      query_embedding: embedding,
      match_count: TOP_K,
      match_threshold: 0.3,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Supabase RPC error (${res.status}): ${err}`);
  }

  return res.json();
}

async function main() {
  console.log(`\nSearching Procore docs: "${query}"\n`);

  const embedding = await generateEmbedding(query);
  const results = await searchDocs(embedding);

  if (!results || results.length === 0) {
    console.log("No results found. Try rephrasing your query.");
    return;
  }

  console.log(`Found ${results.length} relevant documentation chunks:\n`);
  console.log("=".repeat(72));

  results.forEach((r, i) => {
    const score = (r.similarity * 100).toFixed(1);
    console.log(`\n[${i + 1}] ${r.title} — ${score}% match`);
    if (r.heading) console.log(`    Section: ${r.heading}`);
    if (r.category) {
      const cat = r.subcategory ? `${r.category} > ${r.subcategory}` : r.category;
      console.log(`    Category: ${cat}`);
    }
    console.log(`    URL: ${r.url}`);
    console.log();
    const preview = r.chunk_text.length > 500
      ? r.chunk_text.substring(0, 500) + "..."
      : r.chunk_text;
    preview.split("\n").forEach((line) => console.log(`    ${line}`));
    console.log("\n" + "-".repeat(72));
  });
}

main().catch((err) => {
  console.error("Error:", err.message);
  process.exit(1);
});
