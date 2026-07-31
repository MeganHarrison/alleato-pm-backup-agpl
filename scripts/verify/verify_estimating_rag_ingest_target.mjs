#!/usr/bin/env node

/**
 * Static + dry-run guardrail for the estimating RAG ingest target.
 *
 * This intentionally does not touch Supabase. The ingestion script's own
 * dry-run path proves the configured folder is discoverable, classified, and
 * using stable IDs before anyone runs the live embedding command.
 */

import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import process from "node:process";

const repoRoot = process.cwd();
const packageJsonPath = path.join(repoRoot, "package.json");
const estimatingSourceDir = process.env.RAG_ESTIMATING_SOURCE_DIR;
const ingestScript = path.join(repoRoot, "scripts/ingestion/ingest_local_documents.py");

function fail(message) {
  console.error(`Estimating RAG ingest target: FAIL\n${message}`);
  process.exit(1);
}

function assert(condition, message) {
  if (!condition) {
    fail(message);
  }
}

assert(existsSync(packageJsonPath), "package.json was not found");
assert(
  typeof estimatingSourceDir === "string" && estimatingSourceDir.trim().length > 0,
  "RAG_ESTIMATING_SOURCE_DIR is required; estimating source material must be selected explicitly",
);
assert(
  existsSync(path.resolve(repoRoot, estimatingSourceDir)),
  `RAG_ESTIMATING_SOURCE_DIR does not exist: ${estimatingSourceDir}`,
);
assert(existsSync(ingestScript), "scripts/ingestion/ingest_local_documents.py was not found");

const packageJson = JSON.parse(readFileSync(packageJsonPath, "utf8"));
const scripts = packageJson.scripts ?? {};

assert(scripts["rag:ingest:estimating"], "package.json is missing rag:ingest:estimating");
assert(scripts["rag:ingest:estimating:dry"], "package.json is missing rag:ingest:estimating:dry");
assert(
  scripts["rag:ingest:estimating"].includes("--stable-source-ids"),
  "rag:ingest:estimating must use --stable-source-ids to update existing files instead of duplicating changed files",
);
assert(
  scripts["rag:ingest:estimating"].includes("--reindex-all"),
  "rag:ingest:estimating must re-check DB state so unchanged raw/error rows are not hidden by the manifest",
);
assert(
  scripts["rag:ingest:estimating"].includes("--workflow-target estimating"),
  "rag:ingest:estimating must stamp workflow_target=estimating",
);
assert(
  scripts["rag:ingest:estimating"].includes("--category financial_document"),
  "rag:ingest:estimating must stamp category=financial_document",
);
assert(
  scripts["rag:ingest:estimating"].includes("--storage-prefix local/estimating"),
  "rag:ingest:estimating must write to the stable local/estimating storage prefix",
);
assert(
  scripts["rag:ingest:estimating"].includes('PYTHONPATH="$PWD/backend'),
  "rag:ingest:estimating must set PYTHONPATH=$PWD/backend so process-now can import backend src modules",
);

let parsed;
try {
  const output = execFileSync(
    "npm",
    ["run", "rag:ingest:estimating:dry", "--", "--reindex-all", "--limit", "5"],
    {
      cwd: repoRoot,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    },
  );
  const jsonStart = output.lastIndexOf("\n{");
  assert(jsonStart >= 0, "dry-run output did not include a JSON summary");
  parsed = JSON.parse(output.slice(jsonStart + 1));
} catch (error) {
  fail(`dry-run command failed: ${error.stderr || error.message}`);
}

assert(parsed.stable_source_ids === true, "dry-run summary did not report stable_source_ids=true");
assert(parsed.total_supported_files > 0, "dry-run found no supported estimating files");
assert(parsed.processed > 0, "dry-run processed no estimating files");
assert(
  Array.isArray(parsed.results) && parsed.results.every((row) => row.category === "financial_document"),
  "estimating docs should classify as financial_document for the pipeline router",
);

console.log(
  `Estimating RAG ingest target: PASS (${parsed.total_supported_files} supported files, ${parsed.processed} dry-run processed)`,
);
