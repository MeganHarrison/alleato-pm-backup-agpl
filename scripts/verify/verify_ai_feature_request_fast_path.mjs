#!/usr/bin/env node

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const repoRoot = resolve(import.meta.dirname, "..", "..");
const read = (path) =>
  readFileSync(resolve(repoRoot, path), "utf8");

const agentTools = read(
  "agents/alleato-assistant/agent/tools/production_read_tools.ts",
);
const bridge = read(
  "frontend/src/app/api/ai-assistant/eve/tools/route.ts",
);
const client = read(
  "frontend/src/hooks/use-alleato-eve-chat.ts",
);

const required = [
  [agentTools, 'from "eve/tools/approval"', "native Eve approval import"],
  [agentTools, "approval: always()", "per-call write approval"],
  [agentTools, "eveContext.callId", "Eve call binding"],
  [agentTools, "x-alleato-eve-signature", "signed bridge request"],
  [bridge, "GovernedCreateRfiInput", "server-owned RFI action schema"],
  [bridge, 'hasPermission(permissions, "rfis", "write")', "live RFI permission check"],
  [bridge, "confirmed: true", "server-owned legacy execution control"],
  [bridge, "receipt.idempotencyKey", "server-owned idempotency receipt"],
  [client, "inputResponses:", "Eve continuation response"],
  [client, 'optionId: response.approved ? "approve" : "deny"', "approval outcome mapping"],
];

const failures = required
  .filter(([source, fragment]) => !source.includes(fragment))
  .map(([, , label]) => `missing governed Eve contract: ${label}`);

if (bridge.includes("randomUUID()")) {
  failures.push(
    "the bridge invents a tool-call ID instead of using Eve's approved call",
  );
}
if (
  agentTools.includes("attributes?.accessToken") ||
  agentTools.includes("authorization: `Bearer ${accessToken}`")
) {
  failures.push(
    "the durable Eve tool resolver still depends on a persisted user access token",
  );
}

if (failures.length > 0) {
  console.error("Governed Eve action verification failed:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log("Governed Eve action verification passed.");
