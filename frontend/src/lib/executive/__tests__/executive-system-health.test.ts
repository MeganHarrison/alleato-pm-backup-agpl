jest.mock("server-only", () => ({}));
jest.mock("../executive-state", () => ({ loadCanonicalExecutiveState: jest.fn() }));
jest.mock("../executive-conflicts", () => ({ loadExecutiveConflictFeed: jest.fn() }));

import { loadExecutiveSystemHealth } from "../executive-system-health";
import { loadCanonicalExecutiveState } from "../executive-state";
import { loadExecutiveConflictFeed } from "../executive-conflicts";

describe("executive business-impact health", () => {
  beforeEach(() => {
    (loadCanonicalExecutiveState as jest.Mock).mockResolvedValue({ inputs: [
      { id: "canonical_packet", readOwner: "packet owner", freshness: "stale", evidenceCount: 0 },
      { id: "project_operating_record", readOwner: "projection owner", freshness: "fresh", evidenceCount: 1 },
      { id: "delivery_receipts", readOwner: "delivery owner", freshness: "unknown", evidenceCount: 0 },
    ], projects: [{ projectionWriter: null, projectionGeneratedAt: null, projectionEnvelopeId: null }] });
    (loadExecutiveConflictFeed as jest.Mock).mockResolvedValue({ conflicts: [{ id: "conflict-1", subject: "Cost", status: "open", resolver: "Finance owner", impactOfDelay: "Approval can be wrong", claims: [{ id: "claim-1" }] }] });
  });
  it("orders decision blockers before material and delivery risk with recovery owners", async () => {
    const result = await loadExecutiveSystemHealth();
    expect(result.exceptions.map((item) => item.businessImpact)).toEqual(["decision_blocker", "decision_blocker", "material_risk", "delivery_risk"]);
    expect(result.exceptions.every((item) => item.owner && item.recoveryPath)).toBe(true);
  });
});
