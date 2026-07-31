import { SourceSyncStatusSchema } from "../_contracts";

/**
 * Minimal-but-representative backend `/api/health/source-sync` payload.
 * The `pipeline` block mixes breakdown maps with scalar counts, exactly as the
 * Python backend emits it.
 */
function baseStatus() {
  return {
    status: "degraded" as const,
    healthy: false,
    generatedAt: "2026-06-27T19:00:00.000Z",
    thresholds: { staleSyncMinutes: 120 },
    sources: [],
    pipeline: {
      documentMetadataBySource: { fireflies: 154, microsoft_graph: 1322 },
      graphSubscriptionsByStatus: { active: 1 },
      // The field that took down the entire RAG health page: a scalar count
      // inside `pipeline`, which the old `record(record(number))` contract
      // rejected with SCHEMA_MISMATCH (HTTP 500).
      unconfiguredGraphSubscriptions: 1,
    },
    alerts: [],
    recentRuns: [],
    stuckItems: [],
    counts: {
      sources: 0,
      alerts: 0,
      documents: 0,
      chunks: 0,
      unembedded: 0,
      uncompiled: 0,
      tasks: 0,
      graphSubscriptions: 0,
      stuckItems: 0,
    },
  };
}

describe("SourceSyncStatusSchema.pipeline", () => {
  it("accepts a scalar count inside pipeline (regression for 2026-06-27 SCHEMA_MISMATCH)", () => {
    const result = SourceSyncStatusSchema.safeParse(baseStatus());
    // Would have failed before the fix: `unconfiguredGraphSubscriptions: 1`
    // violated `record(string, record(string, number))`, 500ing the page.
    expect(result.success).toBe(true);
  });

  it("still accepts the normal breakdown-map shape", () => {
    const payload = baseStatus();
    payload.pipeline = {
      documentMetadataBySource: { fireflies: 10 },
    } as typeof payload.pipeline;
    expect(SourceSyncStatusSchema.safeParse(payload).success).toBe(true);
  });

  it("rejects a genuinely malformed pipeline value (string)", () => {
    const payload = baseStatus();
    // A string is neither a breakdown map nor a scalar count — this should
    // still be caught so the contract keeps real signal.
    (payload.pipeline as Record<string, unknown>).bogus = "not-a-count";
    expect(SourceSyncStatusSchema.safeParse(payload).success).toBe(false);
  });
});
