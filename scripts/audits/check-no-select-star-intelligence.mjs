#!/usr/bin/env node
/**
 * Guardrail: no SELECT * in the backend intelligence services.
 *
 * The 2026-07-02 PM APP saturation incident traced the biggest legitimate
 * production-DB load to unbounded `.select("*")` reads issued by the
 * intelligence compiler (document_metadata content detoasting, full-table
 * card scans). service_role now runs with statement_timeout=30s, so an
 * unbounded read is not just load — it fails. Every query in
 * backend/src/services/intelligence must name its columns explicitly
 * (see the *_COLUMNS constants in compiler.py).
 *
 * Scans the whole directory on every run — the fix set removed all
 * occurrences, so any hit is a regression.
 */
import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";

const DIR = "backend/src/services/intelligence";
const PATTERN = /\.select\(\s*["'`]\*["'`]\s*\)/;

const files = execSync(`git ls-files -- "${DIR}/**/*.py" "${DIR}/*.py"`, {
  encoding: "utf8",
})
  .split("\n")
  .filter(Boolean);

const violations = [];
for (const file of files) {
  let source;
  try {
    source = readFileSync(file, "utf8");
  } catch {
    continue; // staged deletion
  }
  source.split("\n").forEach((line, index) => {
    if (PATTERN.test(line)) {
      violations.push(`${file}:${index + 1}: ${line.trim()}`);
    }
  });
}

if (violations.length > 0) {
  console.error("");
  console.error(
    "ERROR: SELECT * found in backend/src/services/intelligence — banned since the 2026-07-02 DB incident:",
  );
  console.error("");
  for (const violation of violations) {
    console.error(`  ${violation}`);
  }
  console.error("");
  console.error(
    "Use an explicit column list (see the *_COLUMNS constants in compiler.py),",
  );
  console.error(
    "bound the read with .limit() + a watermark filter, and only fetch heavy",
  );
  console.error("columns (content/raw_text/projection_payload) where consumed.");
  console.error("");
  process.exit(1);
}

process.exit(0);
