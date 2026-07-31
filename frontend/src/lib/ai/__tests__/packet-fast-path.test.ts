import {
  projectPacketFastPathBlockReason,
  projectPacketIsFastPathEligible,
  shouldUseProjectPacketFastPath,
} from "../intelligence/packet-fast-path";
import type { ClientProjectIntelligencePacket } from "../intelligence/types";

const packet: ClientProjectIntelligencePacket = {
  id: "packet-1",
  targetId: "target-1",
  packetType: "current",
  packetVersion: "project_intelligence_synthesis_v1:current",
  generatedAt: "2026-05-19T14:00:00.000Z",
  coveredStartAt: null,
  coveredEndAt: "2026-05-19T14:00:00.000Z",
  freshnessStatus: "fresh",
  executiveSummary: "Current source-backed operating read.",
  currentStatus: "The project is active with current coordination risk.",
  strategicRead: "Leadership should press the next decision.",
  whyItMatters: "The issue can create unpaid work if not handled now.",
  recommendedNextMoves: ["Confirm the owner decision."],
  confidenceSummary: { overall: "high" },
  sourceCoverage: {
    freshnessStatus: "fresh",
    linkedEvidenceCount: 24,
    qualityGate: {
      status: "passed",
      reason: "Operating summary passed quality checks.",
    },
  },
  reviewQueueCount: 0,
  staleItemCount: 0,
  packetJson: {},
  compilerVersion: "project_intelligence_synthesis_v1",
  cards: [
    {
      id: "card-1",
      title: "Current read",
      cardType: "project_update",
      section: "current_read",
      rank: 1,
      summary: "Current project read.",
      whyItMatters: "Decision timing matters.",
      currentStatus: "active",
      confidence: "high",
      attributionStatus: "approved",
      nextAction: "Confirm owner decision.",
      sourceCount: 3,
      metadata: {},
      evidence: [],
      latestFeedback: null,
    },
  ],
  ageHours: 1,
  isStale: false,
};

describe("project packet fast path", () => {
  it("allows current project briefing intents that already load an intelligence packet", () => {
    expect(
      shouldUseProjectPacketFastPath({
        intent: "latest_status",
        responseFormat: "briefing_template",
        usesIntelligencePacket: true,
      }),
    ).toBe(true);
  });

  it("does not hijack source lookup or non-packet plans", () => {
    expect(
      shouldUseProjectPacketFastPath({
        intent: "source_lookup",
        responseFormat: "source_lookup",
        usesIntelligencePacket: false,
      }),
    ).toBe(false);
  });

  it("requires a fresh Project Intelligence synthesis packet with source-backed cards", () => {
    expect(projectPacketIsFastPathEligible(packet)).toBe(true);
    expect(projectPacketFastPathBlockReason(packet)).toBeNull();
  });

  it("blocks stale, failed-quality, and thin packets so the backend fallback still runs", () => {
    expect(
      projectPacketFastPathBlockReason({
        ...packet,
        isStale: true,
      }),
    ).toBe("packet_is_stale");

    expect(
      projectPacketFastPathBlockReason({
        ...packet,
        sourceCoverage: {
          ...packet.sourceCoverage,
          qualityGate: { status: "failed" },
        },
      }),
    ).toBe("quality_gate_not_passed");

    expect(
      projectPacketFastPathBlockReason({
        ...packet,
        sourceCoverage: {
          ...packet.sourceCoverage,
          linkedEvidenceCount: 2,
        },
      }),
    ).toBe("packet_has_too_few_linked_citations");
  });
});
