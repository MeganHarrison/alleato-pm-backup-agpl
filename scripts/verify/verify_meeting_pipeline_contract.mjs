#!/usr/bin/env node

/**
 * Fireflies pipeline contract.
 *
 * Short or summary-only Fireflies records must not die between parser and
 * embedder just because the LLM returned no semantic segments.
 */

import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const parserPath = path.join(root, "backend/src/services/pipeline/parser.py");
const llmPath = path.join(root, "backend/src/services/pipeline/llm.py");
const extractorPath = path.join(root, "backend/src/services/pipeline/extractor.py");
const source = [
  fs.readFileSync(parserPath, "utf8"),
  fs.readFileSync(llmPath, "utf8"),
  fs.readFileSync(extractorPath, "utf8"),
].join("\n");

const failures = [];

function requireContains(needle, message) {
  if (!source.includes(needle)) {
    failures.push(message);
  }
}

requireContains("No transcript lines found", "Parser must detect summary-only meetings.");
requireContains("Meeting Notes", "Parser must create a fallback speaker/segment for summary-only meetings.");
requireContains("LLM returned no segments", "Parser must detect empty LLM segmentation results.");
requireContains("created fallback meeting-notes segment", "Parser must fall back instead of letting embedder fail with no segments.");
requireContains("Segment LLM failed", "Parser must fall back when AI Gateway returns non-JSON segmentation text.");
requireContains('provider_path != "vercel_gateway"', "AI Gateway chat calls must not send unsupported response_format payloads.");
requireContains("Structured extraction returned non-JSON", "Extractor must not fail the whole meeting pipeline when structured JSON extraction is unavailable.");
requireContains("error_message=None", "Successful meeting pipeline completion must clear stale job error_message values.");

if (failures.length > 0) {
  console.error("Meeting pipeline contract: FAIL");
  for (const failure of failures) {
    console.error(` - ${failure}`);
  }
  process.exit(1);
}

console.log("Meeting pipeline contract: PASS");
