#!/usr/bin/env node
/**
 * Sync the assistant eval suite into a Langfuse dataset.
 *
 * Mirrors docs/ai-plan/evals/assistant-eval-suite.json into a Langfuse dataset.
 * into a Langfuse dataset so eval runs can become tracked experiments with scores,
 * diffable across runs, and gateable in CI. Idempotent: re-running upserts items
 * by their stable case id, so it's safe to run after every suite edit.
 *
 * Usage (credentials from repo .env, or the LANGFUSE_* env vars):
 *   node scripts/langfuse/sync-eval-dataset.mjs
 *   node scripts/langfuse/sync-eval-dataset.mjs --suite docs/ai-plan/evals/assistant-eval-suite.json --dataset assistant-eval-suite
 */
import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");

function arg(flag, fallback) {
  const i = process.argv.indexOf(flag);
  return i >= 0 ? process.argv[i + 1] : fallback;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Dataset-item writes aren't batched and Langfuse rate-limits bursts (429).
// Retry with exponential backoff so all items land.
async function withRetry(fn, label) {
  const maxAttempts = 10;
  let delay = 1000;
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      return await fn();
    } catch (error) {
      const msg = String(error?.message ?? error);
      const transient =
        !error?.fatal && (msg.includes("429") || /rate limit/i.test(msg) || /^5\d\d /.test(msg));
      if (!transient || attempt === maxAttempts) throw error;
      await sleep(delay);
      delay = Math.min(delay * 2, 30000); // up to 30s — rate-limit windows can be long
    }
  }
  throw new Error(`Exhausted retries for ${label}`);
}

async function loadEnvFromDotenv() {
  // Prefer already-exported env; otherwise read LANGFUSE_* from repo .env.
  if (process.env.LANGFUSE_SECRET_KEY && process.env.LANGFUSE_PUBLIC_KEY) return;
  try {
    const raw = await fs.readFile(path.join(repoRoot, ".env"), "utf8");
    for (const line of raw.split(/\r?\n/)) {
      const m = line.match(/^(LANGFUSE_[A-Z_]+)=(.*)$/);
      if (m && !process.env[m[1]]) {
        process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
      }
    }
  } catch {
    // no .env — rely on exported vars
  }
}

async function main() {
  await loadEnvFromDotenv();
  const secretKey = process.env.LANGFUSE_SECRET_KEY;
  const publicKey = process.env.LANGFUSE_PUBLIC_KEY;
  const baseUrl =
    process.env.LANGFUSE_BASE_URL || process.env.LANGFUSE_HOST || "https://us.cloud.langfuse.com";
  if (!secretKey || !publicKey) {
    console.error("Missing LANGFUSE_PUBLIC_KEY / LANGFUSE_SECRET_KEY (set them or add to .env).");
    process.exit(1);
  }

  const suitePath = arg("--suite", "docs/ai-plan/evals/assistant-eval-suite.json");
  const datasetName = arg("--dataset", "assistant-eval-suite");
  const suite = JSON.parse(await fs.readFile(path.join(repoRoot, suitePath), "utf8"));
  const cases = suite.cases ?? [];
  if (cases.length === 0) {
    console.error(`No cases found in ${suitePath}`);
    process.exit(1);
  }

  const host = baseUrl.replace(/\/+$/, "");
  const authHeader = `Basic ${Buffer.from(`${publicKey}:${secretKey}`).toString("base64")}`;

  // Direct, confirmed POST per item (the SDK queues + flushes in a burst the API
  // rate-limits, silently dropping items). Upsert by id; 200/201 = persisted.
  async function postLangfuse(pathname, body) {
    return withRetry(async () => {
      const res = await fetch(`${host}${pathname}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: authHeader },
        body: JSON.stringify(body),
      });
      if (res.status === 429 || res.status >= 500) {
        throw new Error(`${res.status} ${await res.text()}`);
      }
      if (!res.ok) {
        throw Object.assign(new Error(`${res.status} ${await res.text()}`), { fatal: true });
      }
      return res.json();
    }, pathname);
  }

  await postLangfuse("/api/public/v2/datasets", {
    name: datasetName,
    description: `Mirror of ${suitePath} (${suite.version ?? "?"}). Synced by scripts/langfuse/sync-eval-dataset.mjs.`,
    metadata: { source: suitePath, version: suite.version ?? null },
  });

  let synced = 0;
  for (const c of cases) {
    await postLangfuse("/api/public/dataset-items", {
      datasetName,
      // Stable id → upsert; re-running the sync updates rather than duplicates.
      id: `${datasetName}:${c.id}`,
      input: {
        prompt: c.prompt,
        selectedProjectId: c.selectedProjectId ?? null,
        intent: c.intent ?? null,
      },
      expectedOutput: {
        expectedToolNames: c.expectedToolNames ?? [],
        expectedToolFamilies: c.expectedToolFamilies ?? [],
        mustInclude: c.mustInclude ?? [],
        mustExclude: c.mustExclude ?? [],
        minAnswerLength: c.minAnswerLength ?? null,
      },
      metadata: {
        caseId: c.id,
        intent: c.intent ?? null,
        coverageNote: c.coverageNote ?? null,
      },
    });
    synced += 1;
    await sleep(120); // stay under the burst rate limit
  }

  console.log(`Synced ${synced} cases into Langfuse dataset "${datasetName}" (${host}).`);
}

main().catch((error) => {
  console.error("Sync failed:", error?.message ?? error);
  process.exit(1);
});
