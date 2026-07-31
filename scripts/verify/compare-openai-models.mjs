#!/usr/bin/env node

import fs from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import dotenv from "dotenv";

const __filename = fileURLToPath(import.meta.url);
const repoRoot = path.resolve(path.dirname(__filename), "../..");

dotenv.config({ path: path.join(repoRoot, ".env"), quiet: true });
dotenv.config({ path: path.join(repoRoot, ".env.local"), quiet: true });
dotenv.config({ path: path.join(repoRoot, "frontend/.env.local"), quiet: true });

const PACK_PATH = path.join(repoRoot, "docs/ai-plan/evals/model-comparison/prompt-pack.json");
const RUNS_DIR = path.join(repoRoot, "docs/ai-plan/evals/model-comparison/runs");
const AI_GATEWAY_BASE_URL = "https://ai-gateway.vercel.sh/v1";

const args = process.argv.slice(2);
const hasFlag = (flag) => args.includes(flag);
const flagValue = (flag) => {
  const idx = args.indexOf(flag);
  return idx >= 0 ? args[idx + 1] : undefined;
};

const dryRun = hasFlag("--dry-run");
const onlyCase = flagValue("--case");
const modelOverride = flagValue("--models");
const maxOutputOverride = flagValue("--max-output-tokens");

function normalizeModelForProvider(model, useGateway) {
  const clean = model.replace(/^openai[/:]/, "");
  return useGateway ? `openai/${clean}` : clean;
}

function getProviderConfig() {
  const gatewayKey = process.env.AI_GATEWAY_API_KEY?.trim();
  if (gatewayKey) {
    return {
      providerPath: "vercel_gateway",
      apiKey: gatewayKey,
      baseUrl: AI_GATEWAY_BASE_URL,
      useGateway: true,
    };
  }

  const openAiKey = process.env.OPENAI_API_KEY?.trim();
  if (openAiKey) {
    return {
      providerPath: "openai",
      apiKey: openAiKey,
      baseUrl: "https://api.openai.com/v1",
      useGateway: false,
    };
  }

  throw new Error("AI_GATEWAY_API_KEY or OPENAI_API_KEY is required.");
}

function caseMessages(testCase) {
  const sourceJson = JSON.stringify(testCase.sourceContext ?? [], null, 2);
  return [
    {
      role: "system",
      content: testCase.system,
    },
    {
      role: "user",
      content: [
        testCase.user,
        "",
        "Source context:",
        sourceJson,
        "",
        "Expected review signals for the human evaluator:",
        JSON.stringify(testCase.expectedSignals ?? [], null, 2),
      ].join("\n"),
    },
  ];
}

function renderPlaygroundCase(testCase) {
  const messages = caseMessages(testCase);
  return [
    `# ${testCase.id}`,
    "",
    "System:",
    messages[0].content,
    "",
    "User:",
    messages[1].content,
    "",
  ].join("\n");
}

async function callChatCompletion({ provider, model, messages, maxOutputTokens }) {
  const started = Date.now();
  const response = await fetch(`${provider.baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${provider.apiKey}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model,
      messages,
      max_completion_tokens: maxOutputTokens,
    }),
  });

  const elapsedMs = Date.now() - started;
  const text = await response.text();
  let payload = null;
  try {
    payload = JSON.parse(text);
  } catch {
    payload = { raw: text };
  }

  if (!response.ok) {
    const detail = payload?.error?.message || payload?.raw || response.statusText;
    throw new Error(`HTTP ${response.status}: ${detail}`);
  }

  const content = payload.choices?.[0]?.message?.content ?? "";
  return {
    content,
    elapsedMs,
    usage: payload.usage ?? null,
    finishReason: payload.choices?.[0]?.finish_reason ?? null,
  };
}

function markdownForRun({ pack, providerPath, results }) {
  const lines = [
    "# GPT-5.5 vs GPT-5.4-mini Comparison Run",
    "",
    `Provider path: ${providerPath}`,
    `Generated: ${new Date().toISOString()}`,
    "",
    "## Summary",
    "",
    "| Case | Model | Status | Latency | Tokens | Notes |",
    "| ---- | ----- | ------ | ------- | ------ | ----- |",
  ];

  for (const result of results) {
    const tokens = result.usage
      ? `${result.usage.prompt_tokens ?? "?"} in / ${result.usage.completion_tokens ?? "?"} out`
      : "";
    lines.push(
      `| ${result.caseId} | ${result.model} | ${result.status} | ${result.elapsedMs ?? ""}ms | ${tokens} | ${result.error ? result.error.replace(/\|/g, "\\|") : ""} |`,
    );
  }

  lines.push("", "## Human Scoring Rubric", "");
  for (const rubric of pack.rubric ?? []) {
    lines.push(`- ${rubric.label}: ${rubric.weight}`);
  }

  for (const result of results) {
    lines.push(
      "",
      `## ${result.caseId} - ${result.model}`,
      "",
      `Status: ${result.status}`,
      "",
      "### Output",
      "",
      result.content || result.error || "(empty)",
      "",
      "### Human Review",
      "",
      "- Source fidelity: pass/fail - notes",
      "- Decision quality: pass/fail - notes",
      "- No hallucination: pass/fail - notes",
      "- Executive format: pass/fail - notes",
      "- Speed/cost: pass/fail - notes",
      "- Winner for this case: TBD",
    );
  }

  return lines.join("\n");
}

const pack = JSON.parse(await fs.readFile(PACK_PATH, "utf8"));
const models = (modelOverride ? modelOverride.split(",") : pack.models)
  .map((model) => model.trim())
  .filter(Boolean);
const maxOutputTokens = Number(maxOutputOverride ?? pack.defaultMaxOutputTokens ?? 900);
const cases = (pack.cases ?? []).filter((testCase) => !onlyCase || testCase.id === onlyCase);

if (cases.length === 0) {
  console.error(`No cases matched${onlyCase ? ` --case ${onlyCase}` : ""}.`);
  process.exit(1);
}

if (dryRun) {
  console.log(`# Playground prompt pack: ${PACK_PATH}`);
  for (const testCase of cases) {
    console.log(renderPlaygroundCase(testCase));
  }
  process.exit(0);
}

const provider = getProviderConfig();
const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
const runDir = path.join(RUNS_DIR, timestamp);
if (!existsSync(RUNS_DIR)) await fs.mkdir(RUNS_DIR, { recursive: true });
await fs.mkdir(runDir, { recursive: true });

const results = [];

for (const testCase of cases) {
  const messages = caseMessages(testCase);
  for (const rawModel of models) {
    const model = normalizeModelForProvider(rawModel, provider.useGateway);
    process.stderr.write(`[compare] ${testCase.id} -> ${model}\n`);
    try {
      const response = await callChatCompletion({
        provider,
        model,
        messages,
        maxOutputTokens,
      });
      results.push({
        caseId: testCase.id,
        model,
        status: "pass",
        ...response,
      });
    } catch (error) {
      results.push({
        caseId: testCase.id,
        model,
        status: "failed",
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
}

const artifact = {
  version: pack.version,
  providerPath: provider.providerPath,
  models,
  cases: cases.map((testCase) => testCase.id),
  generatedAt: new Date().toISOString(),
  results,
};

await fs.writeFile(path.join(runDir, "results.json"), JSON.stringify(artifact, null, 2));
await fs.writeFile(
  path.join(runDir, "summary.md"),
  markdownForRun({ pack, providerPath: provider.providerPath, results }),
);

const failed = results.filter((result) => result.status !== "pass");
console.log(`Wrote ${path.relative(repoRoot, runDir)}`);
if (failed.length > 0) {
  console.error(`${failed.length}/${results.length} model calls failed. See results.json.`);
  process.exit(1);
}
