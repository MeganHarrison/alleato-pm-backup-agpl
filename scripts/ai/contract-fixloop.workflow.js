/**
 * AI write-tool contract fix loop.
 *
 * Runs the contract harness, then for EACH failing tool spawns an isolated fix
 * agent (own git worktree) that diagnoses + patches the tool, and a verify
 * agent that re-runs just that tool's contract to confirm green. Fixes come
 * back as reviewable diffs — nothing is auto-merged.
 *
 * Run with:  Workflow({ scriptPath: "scripts/ai/contract-fixloop.workflow.js" })
 * The harness itself: `cd frontend && npm run ai:contract` (all tools)
 *                     `npm run ai:contract -- -t <toolName>` (one tool)
 */
export const meta = {
  name: "ai-contract-fixloop",
  description:
    "Run the AI write-tool contract harness and fix every failing tool in parallel",
  phases: [
    { title: "Scan", detail: "run the contract harness, collect failing tools" },
    { title: "Fix", detail: "one isolated fix agent per failing tool, then verify" },
  ],
};

const SCAN_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["failures"],
  properties: {
    failures: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["tool", "message"],
        properties: {
          tool: { type: "string", description: "the failing tool name (test title prefix)" },
          message: { type: "string", description: "the assertion failure message" },
        },
      },
    },
  },
};

const VERDICT_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["tool", "fixed", "summary"],
  properties: {
    tool: { type: "string" },
    fixed: { type: "boolean", description: "true only if the tool's contract test now passes" },
    summary: { type: "string", description: "what changed and the re-run result" },
    diff: { type: "string", description: "unified diff of the fix, or empty if none" },
  },
};

phase("Scan");
const scan = await agent(
  `Run the AI write-tool contract harness and report which tools fail.

  From the repo root:
    cd frontend && npm run ai:contract -- --json --outputFile=/tmp/ai-contract-results.json 2>/dev/null || true

  Then read /tmp/ai-contract-results.json. Jest JSON has testResults[].assertionResults[]
  with { title, status, failureMessages }. A title like 'createProjectContact' or
  'updateProjectStatus [preview-only ...]' identifies the tool — use the leading tool
  name (strip any ' [preview-only ...]' suffix) as "tool".

  Return every assertionResult whose status is 'failed', with its first failureMessage
  (trimmed to the key error line). If all pass, return an empty failures array.`,
  { schema: SCAN_SCHEMA, phase: "Scan", label: "scan:harness" },
);

const failures = (scan?.failures ?? []).filter(Boolean);
if (failures.length === 0) {
  log("Contract harness is green — no AI write tools to fix.");
  return { failures: [], fixed: [] };
}

log(`${failures.length} failing tool(s): ${failures.map((f) => f.tool).join(", ")}`);

phase("Fix");
const results = await pipeline(
  failures,
  // Stage 1 — isolated fix in its own worktree.
  (f) =>
    agent(
      `The AI assistant write tool "${f.tool}" fails its DB contract test:

      ${f.message}

      The tool is defined in frontend/src/lib/ai/tools/action-tools.ts (and the spec is in
      frontend/src/lib/ai/tools/contract/write-tools.contract.ts). Diagnose the root cause —
      it is almost always a contract mismatch between what the tool writes and what the
      database accepts (a CHECK constraint, an FK target, a NOT NULL column, or an
      auth-id vs people.id shape). Use the Supabase MCP or read database.types.ts to confirm
      the real allowed values; do NOT guess. Apply the minimal correct fix to the tool.

      Do NOT weaken the contract test to make it pass, and do NOT loosen a DB constraint
      unless that is clearly the intended data model. Prefer mapping/validating the tool's
      input to what the DB allows. After editing, leave the change in the working tree.

      Return a unified diff of your change and a one-paragraph summary of the root cause + fix.`,
      {
        schema: VERDICT_SCHEMA,
        phase: "Fix",
        label: `fix:${f.tool}`,
        isolation: "worktree",
      },
    ),
  // Stage 2 — verify just this tool went green.
  (fix, f) =>
    agent(
      `Verify the fix for the AI write tool "${f.tool}".

      Run: cd frontend && npm run ai:contract -- -t ${f.tool}
      Report whether that tool's contract test now passes (fixed=true only if it does).
      Include the proposed diff verbatim in the diff field and a short summary including the
      re-run result. Do not modify any files.`,
      { schema: VERDICT_SCHEMA, phase: "Fix", label: `verify:${f.tool}`, diff: fix?.diff },
    ),
);

const verdicts = results.filter(Boolean);
return {
  failures: failures.map((f) => f.tool),
  fixed: verdicts.filter((v) => v.fixed).map((v) => v.tool),
  unresolved: verdicts.filter((v) => !v.fixed).map((v) => v.tool),
  verdicts,
};
