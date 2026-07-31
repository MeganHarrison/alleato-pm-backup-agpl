import { evaluateExecutiveArtifactIntegrity, governedArtifactSnapshotHash } from "../governed-executive-artifact-integrity";
import type { ExecutiveConflictFeed } from "../executive-conflicts";
import type { CanonicalExecutiveState } from "../executive-state";

const state = {
  inputs: [
    { id: "canonical_packet", required: true, freshness: "fresh" },
    { id: "project_operating_record", required: true, freshness: "fresh" },
  ],
} as unknown as CanonicalExecutiveState;

describe("evaluateExecutiveArtifactIntegrity", () => {
  it("changes the immutable version identity when action state changes", () => {
    const base = governedArtifactSnapshotHash({ state, executive: { attention: [], conflicts: [] } as unknown as ExecutiveConflictFeed });
    const changed = governedArtifactSnapshotHash({ state, executive: { attention: [{ id: "attention-1" }], conflicts: [] } as unknown as ExecutiveConflictFeed });
    expect(changed).not.toEqual(base);
  });
  it("does not mint a new state version when only packet delivery evidence changes", () => {
    const withoutReceipt = governedArtifactSnapshotHash({ state: { ...state, deliveryReceipts: [] } as CanonicalExecutiveState, executive: { attention: [], conflicts: [] } as unknown as ExecutiveConflictFeed });
    const withReceipt = governedArtifactSnapshotHash({ state: { ...state, deliveryReceipts: [{ id: "receipt-1", status: "dry_run", channel: "teams", attemptedAt: "2026-07-16T12:00:00.000Z" }] } as CanonicalExecutiveState, executive: { attention: [], conflicts: [] } as unknown as ExecutiveConflictFeed });
    expect(withReceipt).toEqual(withoutReceipt);
  });
  it("does not mint a new state version when a financial read timestamp changes", () => {
    const baselineState = { ...state, financial: { generatedAt: "2026-07-16T12:00:00.000Z", totalOverdueAR: 100 } } as CanonicalExecutiveState;
    const rereadState = { ...state, financial: { generatedAt: "2026-07-16T12:00:01.000Z", totalOverdueAR: 100 } } as CanonicalExecutiveState;
    const executive = { attention: [], conflicts: [] } as unknown as ExecutiveConflictFeed;
    expect(governedArtifactSnapshotHash({ state: rereadState, executive })).toEqual(governedArtifactSnapshotHash({ state: baselineState, executive }));
  });
  it("keeps a governed artifact ready only when required state and critical evidence are fresh", () => {
    expect(evaluateExecutiveArtifactIntegrity(state, { conflicts: [] } as unknown as ExecutiveConflictFeed)).toEqual({ integrity: "ready", failures: [] });
  });

  it("blocks a stale critical conflict rather than allowing a plausible delivery", () => {
    const result = evaluateExecutiveArtifactIntegrity(state, {
      conflicts: [{ status: "open", priority: "critical", subject: "Budget authority", claims: [{ label: "ERP export", freshness: "stale" }] }],
    } as unknown as ExecutiveConflictFeed);
    expect(result.integrity).toBe("blocked");
    expect(result.failures[0]).toContain("Budget authority");
    expect(result.failures[0]).toContain("stale");
  });

  it("blocks a required state source that is not fresh", () => {
    const result = evaluateExecutiveArtifactIntegrity({ inputs: [{ id: "canonical_packet", required: true, freshness: "partial" }] } as unknown as CanonicalExecutiveState, { conflicts: [] } as unknown as ExecutiveConflictFeed);
    expect(result).toEqual({ integrity: "blocked", failures: ["Required canonical packet is partial."] });
  });
});
