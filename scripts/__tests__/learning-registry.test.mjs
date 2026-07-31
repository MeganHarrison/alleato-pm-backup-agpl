import assert from "node:assert/strict";
import test from "node:test";

import {
  auditTaskText,
  findMatches,
  loadRegistry,
  validateRegistry,
} from "../ops/learning-registry.mjs";

const { data: registry } = loadRegistry();
const registryIds = new Set(registry.failures.map((failure) => failure.id));

test("the canonical registry is structurally valid with no unresolved promotion debt", () => {
  const result = validateRegistry(registry);
  assert.deepEqual(result.errors, []);
  assert.deepEqual(result.warnings, []);
  const viewerFailure = registry.failures.find(
    (failure) => failure.id === "frontend.viewer-capability-regression",
  );
  assert.equal(viewerFailure?.maturity, "detectable");
  assert.equal(viewerFailure?.guardrail?.status, "active");
});

test("lookup ranks a matching owned path above unrelated incidents", () => {
  const matches = findMatches(registry.failures, {
    symptom: "zoom control does nothing",
    files: ["frontend/src/components/drawings/PdfjsExpressDrawingViewer.tsx"],
  });
  assert.equal(matches[0].failure.id, "frontend.viewer-capability-regression");
  assert.ok(matches[0].score >= 30);
});

test("registry validation rejects duplicate fingerprints", () => {
  const duplicate = structuredClone(registry);
  duplicate.failures.push(structuredClone(duplicate.failures[0]));
  const result = validateRegistry(duplicate);
  assert.ok(result.errors.some((error) => error.includes("duplicate failure id")));
});

test("task audit rejects an unknown failure fingerprint", () => {
  const text = `# Task\n\n## Incident Learning\n\n- Failure fingerprint: \`unknown.failure\`\n- Root cause: A real cause.\n- Detection gap: A real gap.\n- Prevention: A real prevention.\n- Guardrail evidence: scripts/test.mjs\n`;
  const result = auditTaskText(text, "task.md", registryIds);
  assert.equal(result.checked, true);
  assert.ok(result.errors.some((error) => error.includes("unknown failure fingerprint")));
});

test("task audit accepts an existing completed fingerprint", () => {
  const text = `# Task\n\n## Incident Learning\n\n- Failure fingerprint: \`process.passive-incident-memory\`\n- Root cause: Incident records were passive.\n- Detection gap: No lookup ran at task start.\n- Prevention: Validate registry linkage during finish.\n- Guardrail evidence: scripts/__tests__/learning-registry.test.mjs\n`;
  const result = auditTaskText(text, "task.md", registryIds);
  assert.deepEqual(result, { checked: true, errors: [] });
});

test("task audit allows an explicit non-incident task", () => {
  const text = `# Task\n\n## Incident Learning\n\n- Failure fingerprint: \`N/A\`\n- Root cause: N/A\n- Detection gap: N/A\n- Prevention: N/A\n- Guardrail evidence: N/A\n`;
  const result = auditTaskText(text, "task.md", registryIds);
  assert.deepEqual(result, { checked: true, errors: [] });
});

test("task audit rejects placeholder guardrail evidence", () => {
  const text = `# Task\n\n## Incident Learning\n\n- Failure fingerprint: \`process.passive-incident-memory\`\n- Root cause: Incident records were passive.\n- Detection gap: No lookup ran at task start.\n- Prevention: Validate registry linkage during finish.\n- Guardrail evidence: Pending implementation and tests.\n`;
  const result = auditTaskText(text, "task.md", registryIds);
  assert.ok(result.errors.some((error) => error.includes("Guardrail evidence")));
});
