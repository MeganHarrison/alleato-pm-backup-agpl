import { buildIntelligencePageState } from "../intelligence/page-state";
import type { ClientProjectIntelligencePacket, InsightCardEvidence } from "../intelligence/types";

const meetingEvidence: InsightCardEvidence = {
  id: "evidence-meeting-1",
  sourceDocumentId: "doc-meeting-1",
  sourceChunkId: "chunk-meeting-1",
  sourceMessageId: null,
  sourceType: "meeting",
  sourceCategory: "Meeting",
  sourceTitle: "Union Collective: OAC",
  sourceOccurredAt: "2026-05-14T12:00:00.000Z",
  participants: ["project team"],
  sourceContentPreview: "Meeting transcript summary with project decisions and open coordination items.",
  excerpt: "Permit coordination and financing timing are the gating issues.",
  summary: "Permit coordination and financing timing are the gating issues.",
  relevanceReason: "Supports the Union Collective operating read.",
  evidenceRole: "supporting",
  confidence: "high",
};

function makePacket(overrides: Partial<ClientProjectIntelligencePacket> = {}): ClientProjectIntelligencePacket {
  return {
    id: "packet-union",
    targetId: "target-union",
    packetType: "current",
    packetVersion: "project_intelligence_synthesis_v1:current",
    generatedAt: "2026-05-19T14:05:18.031Z",
    coveredStartAt: null,
    coveredEndAt: "2026-05-19T14:05:18.031Z",
    freshnessStatus: "fresh",
    executiveSummary:
      "Union Collective is moving through late-stage design and pre-permit coordination while financing and scope-control remain the main pressure points.",
    currentStatus: null,
    strategicRead:
      "The job is not quiet; the current risk is hidden in permit, financing, roof, and consultant coordination rather than in formal RFIs.",
    whyItMatters: "Leadership needs to freeze permit-critical scope before unpaid work accumulates.",
    recommendedNextMoves: ["Freeze permit-critical scope and run formal change control."],
    confidenceSummary: { overall: "high" },
    sourceCoverage: {
      freshnessStatus: "fresh",
      linkedEvidenceCount: 95,
      latestSourceAt: "2026-05-19T14:05:18.031Z",
      qualityGate: {
        status: "passed",
        reason: "Operating summary passed raw-source and metadata-only synthesis checks.",
      },
      gaps: [
        "Email content for the May 18-19 procurement and contract items is not available beyond metadata.",
      ],
      categoryCoverage: [
        { label: "Meetings", sourceCount: 32, availableCount: 32 },
      ],
    },
    reviewQueueCount: 5,
    staleItemCount: 0,
    packetJson: {
      strategicReport: {
        whatChanged: [
          {
            title: "Solar roof and title commitment coordination moved this week",
            impact: "Scope and administrative decisions need owner confirmation.",
          },
        ],
      },
    },
    compilerVersion: "project_intelligence_synthesis_v1",
    cards: [
      {
        id: "card-1",
        title: "Current read",
        cardType: "project_update",
        section: "current_read",
        rank: 1,
        summary: "Permit and financing coordination are the current operating read.",
        whyItMatters: "These decisions drive schedule and owner approval risk.",
        currentStatus: "active",
        confidence: "high",
        attributionStatus: "approved",
        nextAction: "Confirm permit-critical scope.",
        sourceCount: 1,
        metadata: {},
        evidence: [meetingEvidence],
        latestFeedback: null,
      },
    ],
    ageHours: 1,
    isStale: false,
    ...overrides,
  };
}

describe("buildIntelligencePageState", () => {
  it("does not show fatal resynthesis copy when a strategic report passed but has evidence limitations", () => {
    const state = buildIntelligencePageState(makePacket());

    expect(state.briefing.title).toBe("Daily project intelligence, synthesized from the sources that changed the job.");
    expect(state.briefing.title).not.toMatch(/needs resynthesis|failed source-quality/i);
    expect(state.warnings).toEqual([]);
    expect(state.limitations).toContain(
      "Email content for the May 18-19 procurement and contract items is not available beyond metadata.",
    );
  });

  it("shows a fatal source-quality state only when the quality gate fails", () => {
    const state = buildIntelligencePageState(makePacket({
      sourceCoverage: {
        qualityGate: {
          status: "failed",
          reason: "The packet mixed raw source text into the strategy layer.",
        },
      },
    }));

    expect(state.briefing.title).toBe("Daily intelligence failed source-quality checks.");
    expect(state.warnings).toContain("The packet mixed raw source text into the strategy layer.");
  });

  it("shows a missing-synthesis state when there is no usable strategic read", () => {
    const state = buildIntelligencePageState(makePacket({
      executiveSummary: "Subject: Union Collective",
      currentStatus: null,
      strategicRead: null,
      whyItMatters: null,
      packetJson: {},
      cards: [],
    }));

    expect(state.briefing.title).toBe("Daily intelligence could not produce a usable strategic read.");
  });

  it("surfaces stale and uncited packet warnings in the fail-loud state", () => {
    const state = buildIntelligencePageState(makePacket({
      sourceCoverage: {
        qualityGate: {
          status: "passed",
          reason: "Operating summary passed checks.",
        },
      },
      cards: [
        {
          id: "card-uncited",
          title: "Current read",
          cardType: "project_update",
          section: "current_read",
          rank: 1,
          summary: "Permit and financing coordination are the current operating read.",
          whyItMatters: "These decisions drive schedule and owner approval risk.",
          currentStatus: "active",
          confidence: "high",
          attributionStatus: "approved",
          nextAction: "Confirm permit-critical scope.",
          sourceCount: 0,
          metadata: {},
          evidence: [],
          latestFeedback: null,
        },
      ],
      ageHours: 12,
      isStale: true,
    }));

    expect(state.briefing.title).toBe("Daily intelligence failed source-quality checks.");
    expect(state.warnings).toContain("The packet is older than the expected refresh window.");
    expect(state.warnings).toContain("No linked citations are attached to the current packet.");
  });
});
