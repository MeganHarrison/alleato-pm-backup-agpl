import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const workflowPath = fileURLToPath(new URL("../../.github/workflows/prune-merged-branches.yml", import.meta.url));
const workflow = await readFile(workflowPath, "utf8");

for (const requiredSnippet of [
  "push:\n    branches: [main]", "schedule:", "workflow_dispatch:", "contents: write", "pull-requests: read",
  "head: `${owner}:${name}`", "if (openPullRequests.length > 0)", "base: defaultBranch", "head: name",
  '["behind", "identical"].includes(comparison.data.status)', "ref: `heads/${name}`", "core.setFailed",
]) assert.ok(workflow.includes(requiredSnippet), `Missing cleanup guardrail: ${requiredSnippet}`);

console.log("PASS verify_branch_cleanup_workflow: safe merged-branch cleanup contract is present");
