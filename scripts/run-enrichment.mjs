/**
 * Local runner for meeting segment enrichment
 * Uses frontend node_modules and .env.local
 *
 * Usage:
 *   node scripts/run-enrichment.mjs [--segments]
 *   (defaults to --segments)
 */

import { createClient } from "../frontend/node_modules/@supabase/supabase-js/dist/index.mjs";
import OpenAI from "../frontend/node_modules/openai/index.mjs";
import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Load .env.local
const envPath = path.join(__dirname, "../frontend/.env.local");
const envContent = fs.readFileSync(envPath, "utf-8");
for (const line of envContent.split("\n")) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith("#")) continue;
  const eqIdx = trimmed.indexOf("=");
  if (eqIdx === -1) continue;
  const key = trimmed.slice(0, eqIdx).trim();
  const val = trimmed.slice(eqIdx + 1).trim().replace(/^["']|["']$/g, "");
  if (!process.env[key]) process.env[key] = val;
}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
);
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const ENRICHMENT_MODEL = "gpt-4o-mini";
const BATCH_SIZE = 50; // larger for local run
const MAX_SEGMENT_LENGTH = 2000;

// ─── Segment Enrichment ───────────────────────────────────────────────────────

function buildClassificationPrompt(segment) {
  const content = [
    segment.title ? `Title: ${segment.title}` : null,
    segment.summary ? `Summary: ${segment.summary.slice(0, MAX_SEGMENT_LENGTH)}` : null,
    Array.isArray(segment.decisions) && segment.decisions.length > 0
      ? `Decisions: ${JSON.stringify(segment.decisions).slice(0, 500)}`
      : null,
    Array.isArray(segment.risks) && segment.risks.length > 0
      ? `Risks: ${JSON.stringify(segment.risks).slice(0, 500)}`
      : null,
    Array.isArray(segment.tasks) && segment.tasks.length > 0
      ? `Tasks: ${JSON.stringify(segment.tasks).slice(0, 300)}`
      : null,
  ]
    .filter(Boolean)
    .join("\n");

  return `You are a construction project management data classifier. Analyze this meeting segment and return a JSON object with exactly these fields:

{
  "data_class": string[],       // subset of: ["decision","risk_signal","financial_event","action_item","relationship_signal","lesson_learned","schedule_event","change_event"]
  "sentiment": string,           // exactly one of: "positive","neutral","negative","escalation"
  "project_impact": string[],   // subset of: ["schedule","cost","quality","relationship","safety","scope"]
  "mentioned_people": string[]  // first names or full names of people explicitly mentioned or speaking
}

Rules:
- data_class must contain at least one value
- "escalation" sentiment = disputes, raised concerns, owner dissatisfaction, threats to claim or stop work
- "negative" = problems flagged without escalation
- Only include project_impact dimensions that are explicitly relevant
- mentioned_people = only names clearly present in the text, no guessing

Meeting segment:
${content}

Return ONLY the JSON object, no explanation.`;
}

async function runSegmentEnrichment() {
  console.log("\n[enrichment] fetching unenriched segments...");
  const { data: segments, error } = await supabase
    .from("meeting_segments")
    .select("id, title, summary, decisions, risks, tasks")
    .is("enriched_at", null)
    .not("summary", "is", null)
    .order("created_at", { ascending: true })
    .limit(BATCH_SIZE);

  if (error || !segments?.length) {
    console.log("[enrichment] no unenriched segments:", error?.message ?? "none found");
    return { enriched: 0, errors: 0 };
  }

  console.log(`[enrichment] processing ${segments.length} segments...`);

  let enriched = 0;
  let errors = 0;

  for (let i = 0; i < segments.length; i++) {
    const segment = segments[i];
    process.stdout.write(`  [${i + 1}/${segments.length}] segment ${segment.id}...`);

    try {
      const prompt = buildClassificationPrompt(segment);
      const response = await openai.chat.completions.create({
        model: ENRICHMENT_MODEL,
        messages: [{ role: "user", content: prompt }],
        response_format: { type: "json_object" },
        temperature: 0,
        max_tokens: 300,
      });

      const raw = response.choices[0]?.message?.content ?? "{}";
      const classification = JSON.parse(raw);

      if (!Array.isArray(classification.data_class)) {
        throw new Error("Invalid classification: missing data_class");
      }

      const { error: updateError } = await supabase
        .from("meeting_segments")
        .update({
          data_class: classification.data_class,
          sentiment: classification.sentiment ?? "neutral",
          project_impact: classification.project_impact ?? [],
          mentioned_people: classification.mentioned_people ?? [],
          enriched_at: new Date().toISOString(),
          enrichment_model: ENRICHMENT_MODEL,
        })
        .eq("id", segment.id);

      if (updateError) {
        console.log(` ✗ update failed: ${updateError.message}`);
        errors++;
      } else {
        console.log(` ✓ [${classification.data_class.join(",")}] ${classification.sentiment}`);
        enriched++;
      }
    } catch (e) {
      console.log(` ✗ ${e.message}`);
      errors++;
      await supabase
        .from("meeting_segments")
        .update({
          data_class: [],
          enriched_at: new Date().toISOString(),
          enrichment_model: `${ENRICHMENT_MODEL}:error`,
        })
        .eq("id", segment.id);
    }
  }

  console.log(`\n[enrichment] done — enriched: ${enriched}, errors: ${errors}`);
  return { enriched, errors };
}

// ─── Main ─────────────────────────────────────────────────────────────────────

const args = process.argv.slice(2);
const runSegments = args.includes("--segments") || args.length === 0;

console.log("╔══════════════════════════════════════════════╗");
console.log("║  Council Mode — Enrichment Runner            ║");
console.log("╚══════════════════════════════════════════════╝");

if (runSegments) await runSegmentEnrichment();

console.log("\n✅ Done.\n");
