#!/usr/bin/env node

import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import dotenv from "dotenv";
import { Client } from "langsmith";

const __filename = fileURLToPath(import.meta.url);
const repoRoot = path.resolve(path.dirname(__filename), "../..");

dotenv.config({ path: path.join(repoRoot, ".env"), quiet: true });
dotenv.config({ path: path.join(repoRoot, "frontend/.env.local"), quiet: true });

const DEFAULT_DATASET_NAME = "Strategic Operator Eval v1";

const args = process.argv.slice(2);

function flagValue(flag) {
  const index = args.indexOf(flag);
  return index >= 0 ? args[index + 1] : undefined;
}

const dryRun = args.includes("--dry-run");
const append = args.includes("--append");
const datasetFile = flagValue("--file");
const datasetName = flagValue("--name") ?? DEFAULT_DATASET_NAME;

function usage() {
  console.log(`Usage:
  node scripts/ops/upload-langsmith-strategic-dataset.mjs [--dry-run] [--append] [--name "Dataset Name"] [--file path/to/dataset.json]

Defaults:
  --name "${DEFAULT_DATASET_NAME}"
  --file path/to/dataset.json (required)

Safety:
  Existing datasets are not modified unless --append is provided.
`);
}

if (args.includes("--help")) {
  usage();
  process.exit(0);
}

if (!datasetFile) {
  console.error("--file is required; this command does not own a default strategic dataset artifact.");
  usage();
  process.exit(1);
}

const datasetPath = path.resolve(repoRoot, datasetFile);

if (!process.env.LANGSMITH_API_KEY) {
  console.error("LANGSMITH_API_KEY is required. Set it in .env or the shell.");
  process.exit(1);
}

const raw = await fs.readFile(datasetPath, "utf8");
const examples = JSON.parse(raw);

if (!Array.isArray(examples) || examples.length === 0) {
  console.error("Dataset file must contain a non-empty JSON array.");
  process.exit(1);
}

const invalidIndex = examples.findIndex(
  (example) =>
    !example ||
    typeof example !== "object" ||
    !example.inputs ||
    typeof example.inputs !== "object",
);

if (invalidIndex >= 0) {
  console.error(`Example at index ${invalidIndex} is missing object inputs.`);
  process.exit(1);
}

const categories = examples.reduce((acc, example) => {
  const category = example.metadata?.category ?? "uncategorized";
  acc[category] = (acc[category] ?? 0) + 1;
  return acc;
}, {});

console.log(
  JSON.stringify(
    {
      datasetName,
      datasetPath: path.relative(repoRoot, datasetPath),
      examples: examples.length,
      categories,
      dryRun,
      append,
      langsmithProject: process.env.LANGSMITH_PROJECT ?? null,
      hasWorkspaceId: Boolean(process.env.LANGSMITH_WORKSPACE_ID),
    },
    null,
    2,
  ),
);

if (dryRun) {
  process.exit(0);
}

const client = new Client({
  apiKey: process.env.LANGSMITH_API_KEY,
  workspaceId: process.env.LANGSMITH_WORKSPACE_ID,
});

const exists = await client.hasDataset({ datasetName });
if (exists && !append) {
  console.error(
    `Dataset "${datasetName}" already exists. Re-run with --append to add examples, or choose a new --name.`,
  );
  process.exit(1);
}

if (!exists) {
  await client.createDataset(datasetName, {
    description:
      "Strategic/operator eval examples for ASRS sprinkler RAG, Microsoft Office triage, weekly meeting insights, and cross-source open loops.",
    dataType: "kv",
    metadata: {
      source: "alleato-pm",
      file: path.relative(repoRoot, datasetPath),
      version: "2026-05-19",
    },
  });
}

await client.createExamples({
  datasetName,
  inputs: examples.map((example) => example.inputs),
  outputs: examples.map((example) => example.outputs ?? {}),
  metadata: examples.map((example) => example.metadata ?? {}),
  splits: examples.map((example) => example.metadata?.langsmith_split ?? "baseline"),
});

const datasetUrl = await client.getDatasetUrl({ datasetName });
console.log(`Uploaded ${examples.length} examples to "${datasetName}".`);
console.log(datasetUrl);
