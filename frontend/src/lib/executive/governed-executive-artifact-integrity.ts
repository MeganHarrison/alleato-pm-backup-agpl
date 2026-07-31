import { createHash } from "node:crypto";
import type { ExecutiveConflictFeed } from "./executive-conflicts";
import type { CanonicalExecutiveState } from "./executive-state";

export type ExecutiveArtifactIntegrity = "ready" | "limited" | "blocked";

/** Stable identity for the exact immutable state represented by a version. */
export function governedArtifactSnapshotHash(input: {
  state: CanonicalExecutiveState | null;
  executive: ExecutiveConflictFeed | null;
  artifactKind?: "daily" | "weekly" | "monthly";
}): string {
  const { generatedAt: _financialReadAt, ...financial } = input.state?.financial ?? {};
  return createHash("sha256")
    .update(stableJson({
      // Delivery attempts are append-only evidence that occur after issuance;
      // they must not mint a new state version for otherwise identical action.
      inputs: input.state?.inputs.filter((item) => item.id !== "delivery_receipts") ?? [],
      projects: input.state?.projects ?? [],
      financial,
      attention: input.executive?.attention ?? [],
      conflicts: input.executive?.conflicts ?? [],
      ...(input.artifactKind === "monthly" ? { monthlyReviewSchema: "v2-persisted-portfolio-and-delivery" } : {}),
    }))
    .digest("hex");
}

function stableJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  if (!value || typeof value !== "object") return JSON.stringify(value);
  const record = value as Record<string, unknown>;
  return `{${Object.keys(record).sort().map((key) => `${JSON.stringify(key)}:${stableJson(record[key])}`).join(",")}}`;
}

/** Pure guardrail: no stale critical input can pass as a deliverable artifact. */
export function evaluateExecutiveArtifactIntegrity(state: CanonicalExecutiveState, executive: ExecutiveConflictFeed): {
  integrity: ExecutiveArtifactIntegrity;
  failures: string[];
} {
  const failures: string[] = [];
  for (const input of state.inputs) {
    if (input.required && input.freshness !== "fresh") {
      failures.push(`Required ${input.id.replaceAll("_", " ")} is ${input.freshness}.`);
    }
  }
  for (const conflict of executive.conflicts) {
    if (conflict.status !== "open" || conflict.priority !== "critical") continue;
    const staleClaim = conflict.claims.find((claim) => claim.freshness !== "fresh");
    if (staleClaim) failures.push(`Critical conflict “${conflict.subject}” has ${staleClaim.freshness} evidence (${staleClaim.label}).`);
  }
  return { integrity: failures.length ? "blocked" : "ready", failures };
}
