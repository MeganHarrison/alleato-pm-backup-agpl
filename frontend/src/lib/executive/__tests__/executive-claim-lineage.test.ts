jest.mock("server-only", () => ({}));
jest.mock("@/lib/daily-briefs/canonical-packets", () => ({ loadDailyExecutiveBriefPacketById: jest.fn() }));
jest.mock("../executive-state", () => ({ loadCanonicalExecutiveState: jest.fn() }));
jest.mock("../executive-conflicts", () => ({ loadExecutiveConflictFeed: jest.fn() }));

import { loadDailyExecutiveBriefPacketById } from "@/lib/daily-briefs/canonical-packets";
import { loadExecutiveClaimLineage } from "../executive-claim-lineage";
import { loadCanonicalExecutiveState } from "../executive-state";
import { loadExecutiveConflictFeed } from "../executive-conflicts";

const id = "11111111-1111-4111-8111-111111111111";
const claimId = "22222222-2222-4222-8222-222222222222";
const conflictId = "33333333-3333-4333-8333-333333333333";

describe("executive claim lineage", () => {
  beforeEach(() => {
    jest.resetAllMocks();
    (loadDailyExecutiveBriefPacketById as jest.Mock).mockResolvedValue({ id, sources: [{ id: "source-1", title: "Signed change", lane: "documents", sourceAt: "2026-07-16T12:00:00.000Z", url: "https://example.test/source", projectId: 7 } ] });
    (loadCanonicalExecutiveState as jest.Mock).mockResolvedValue({ projects: [{ projectId: 7, projectionWriter: "controlled projection", projectionGeneratedAt: "2026-07-16T12:01:00.000Z", projectionEnvelopeId: "envelope-1" }] });
    (loadExecutiveConflictFeed as jest.Mock).mockResolvedValue({ canonicalPacket: { id }, conflicts: [{ id: conflictId, resolver: "Finance owner", status: "resolved", resolutionSummary: "Use the signed change.", claims: [{ id: claimId, label: "Cost", statement: "Cost is approved.", authority: "authoritative", freshness: "fresh", sourceId: "source-1", sourceHash: "immutable-hash", sourceUrl: null, sourceExcerpt: null, assertedAt: "2026-07-16T12:00:00.000Z" }], history: [{ id: "history-1", action: "resolved", actorLabel: "executive@example.com", rationale: "Signed change controls.", createdAt: "2026-07-16T12:05:00.000Z" }] }] });
  });

  it("returns each named stage from stable evidence without page-local synthesis", async () => {
    const result = await loadExecutiveClaimLineage(id, claimId);
    expect(result).toMatchObject({ state: "ready", claimId });
    if (result.state === "ready") expect(result.stages.map((stage) => stage.id)).toEqual(["source", "event", "fact_or_signal", "authority_policy", "projection", "decision_or_artifact"]);
  });

  it("fails loudly rather than fabricating a source link", async () => {
    (loadDailyExecutiveBriefPacketById as jest.Mock).mockResolvedValue({ id, sources: [] });
    await expect(loadExecutiveClaimLineage(id, claimId)).resolves.toMatchObject({ state: "lineage_unavailable", missingStage: "source", owner: "Source/AI ops owner" });
  });

  it("fails loudly when controlled projection provenance is missing", async () => {
    (loadCanonicalExecutiveState as jest.Mock).mockResolvedValue({ projects: [{ projectId: 7, projectionWriter: null, projectionGeneratedAt: null, projectionEnvelopeId: null }] });
    await expect(loadExecutiveClaimLineage(id, claimId)).resolves.toMatchObject({ state: "lineage_unavailable", missingStage: "projection", owner: "Projection owner" });
  });
});
