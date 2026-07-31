import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const repositoryRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../..",
);

const callers = [
  "scripts/rag/detect-under-embedded-docs.mjs",
  "scripts/jobplanner/import-submittal-documents.mjs",
  "scripts/ops/requeue-vision-analysis.mjs",
  "frontend/scripts/trigger-pipeline-batch.ts",
];

for (const relativePath of callers) {
  test(`${relativePath} authenticates compatibility-ingress calls`, () => {
    const source = readFileSync(path.join(repositoryRoot, relativePath), "utf8");
    assert.match(source, /process\.env\.ADMIN_API_KEY\?\.trim\(\)/);
    assert.match(source, /\/api\/pipeline\/process/);
    assert.match(source, /"x-admin-api-key": ADMIN_API_KEY/);
    assert.match(
      source,
      /ADMIN_API_KEY[^]*?(required|not set|no ADMIN_API_KEY)/i,
      "Caller must fail or report explicitly when the credential is absent.",
    );
  });
}
