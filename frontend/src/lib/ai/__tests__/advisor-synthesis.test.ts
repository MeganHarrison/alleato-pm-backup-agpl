import { synthesizeAdvisorResponse, synthesizeMissingPacketResponse } from "../intelligence/advisor-synthesis";
import type {
  ClientProjectIntelligencePacket,
  ResolvedIntelligenceTarget,
} from "../intelligence/types";

const target: ResolvedIntelligenceTarget = {
  id: "target-1",
  targetType: "client_project",
  name: "Westfield Collective",
  slug: "westfield-collective",
  projectId: 43,
  status: "active",
  resolutionReason: "test",
  source: "target_match",
};

const packet: ClientProjectIntelligencePacket = {
  id: "packet-1",
  targetId: "target-1",
  packetType: "current",
  packetVersion: "manual-v1",
  generatedAt: "2026-04-30T00:00:00.000Z",
  coveredStartAt: null,
  coveredEndAt: "2026-04-22T00:00:00.000Z",
  freshnessStatus: "working_sample",
  executiveSummary: "Executive summary",
  currentStatus: "Active closeout/commercial coordination.",
  strategicRead: "Strategic read",
  whyItMatters: "Why it matters",
  recommendedNextMoves: ["Verify structured financials.", "Assign follow-up owners."],
  confidenceSummary: {
    overall: "medium",
    reason: "Linked communications are present, but structured costs still need verification.",
  },
  sourceCoverage: {
    freshnessStatus: "working_sample",
    documentMetadataRows: 1223,
    aiMemoryRows: 544,
    projectEmailRows: 0,
    latestSourceAt: "2026-04-22T00:00:00.000Z",
    gaps: ["project_emails has zero project-scoped rows"],
  },
  reviewQueueCount: 3,
  staleItemCount: 0,
  packetJson: {},
  compilerVersion: "manual-test",
  cards: [
    {
      id: "card-1",
      title: "Financial exposure",
      cardType: "financial_exposure",
      section: "financial_exposure",
      rank: 20,
      summary: "Past-due invoice communication is present.",
      whyItMatters: null,
      currentStatus: "open",
      confidence: "medium",
      attributionStatus: "approved",
      nextAction: null,
      sourceCount: 1,
      metadata: {},
      evidence: [],
      latestFeedback: null,
    },
    {
      id: "card-2",
      title: "Change-management risk",
      cardType: "change_management",
      section: "change_management",
      rank: 30,
      summary: "Plumbing change-order documentation needs verification.",
      whyItMatters: null,
      currentStatus: "open",
      confidence: "medium",
      attributionStatus: "approved",
      nextAction: null,
      sourceCount: 1,
      metadata: {},
      evidence: [],
      latestFeedback: null,
    },
  ],
};

const operatingPacket: ClientProjectIntelligencePacket = {
  ...packet,
  freshnessStatus: "fresh",
  compilerVersion: "project_intelligence_synthesis_v1",
  packetJson: {
    strategicReport: {
      whatChanged: [
        {
          title: "Permit package deadline tightened",
          impact: "Open design items now threaten the June permit target.",
        },
      ],
      risks: [
        {
          title: "Permit schedule may slip",
          recommendedAction: "Escalate unresolved permit-blocking decisions.",
          severity: "high",
        },
      ],
      openDecisions: [
        {
          title: "Finalize second-floor private room configuration",
          owner: "Design team / owner",
          neededBy: "Before permit package finalization",
        },
      ],
      moneyImpact: {
        summary: "Scope growth needs current estimate reconciliation.",
      },
      promisesMade: [
        {
          title: "Permit drawings due June 11",
          owner: "Project team",
          dueDate: "2026-06-11",
        },
      ],
    },
  },
  sourceCoverage: {
    freshnessStatus: "fresh",
    linkedEvidenceCount: 90,
    latestSourceAt: "2026-05-19T00:00:00.000Z",
    categoryCoverage: [
      { label: "Meetings", sourceCount: 32, availableCount: 32 },
      { label: "Emails", sourceCount: 20, availableCount: 383 },
    ],
  },
};

describe("advisor synthesis", () => {
  it("turns a packet into the required project advisor response sections", () => {
    const response = synthesizeAdvisorResponse({
      target,
      packet,
      intent: "latest_status",
      query: "What's the latest on Westfield Collective?",
    });

    expect(response).toContain("Current read:");
    expect(response).toContain("Financial/change-management exposure:");
    expect(response).toContain("Schedule/operational risk:");
    expect(response).toContain("Recommended next action:");
    expect(response).toContain("Evidence basis and confidence:");
    expect(response).toContain("Packet status: working sample");
    expect(response).toContain("Resolved target: Westfield Collective (project 43).");
  });

  it("is honest when the packet is missing", () => {
    const response = synthesizeMissingPacketResponse({
      target,
      query: "What's the latest on Westfield Collective?",
    });

    expect(response).toContain("I do not have a current intelligence packet");
    expect(response).toContain("live lookup");
  });

  it("uses the operating packet strategic report and meeting coverage when present", () => {
    const response = synthesizeAdvisorResponse({
      target,
      packet: operatingPacket,
      intent: "latest_status",
      query: "What's the latest on Union Collective?",
    });

    expect(response).toContain("Permit package deadline tightened");
    expect(response).toContain("Escalate unresolved permit-blocking decisions");
    expect(response).toContain("Finalize second-floor private room configuration");
    expect(response).toContain("90 linked packet citations");
    expect(response).toContain("Meetings: 32 selected / 32 available");
  });
});
