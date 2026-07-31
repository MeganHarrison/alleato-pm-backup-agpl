import type { CanonicalDailyBriefPacket } from "@/lib/daily-briefs/canonical-packets";

import { toEveDailyBriefResponse } from "../executive-brief-tools";

jest.mock("ai", () => ({
  tool: (definition: unknown) => definition,
}));

function source(alias: string, index: number) {
  return {
    id: `stable-source-id-${index}`,
    alias,
    sourceRecordId: null,
    appDocumentId: null,
    title: `Source ${alias}`,
    lane: "emails",
    projectId: 700 + index,
    projectName: `Project ${alias}`,
    sourceAt: `2026-07-21T${String(index).padStart(2, "0")}:00:00.000Z`,
    url: `https://example.com/${alias.toLowerCase()}`,
  };
}

const packet = {
  id: "packet-1",
  targetId: "target-1",
  packetType: "daily",
  generatedAt: "2026-07-22T18:25:15.000Z",
  coveredStartAt: "2026-07-21T04:00:00.000Z",
  coveredEndAt: "2026-07-22T04:00:00.000Z",
  freshnessStatus: "fresh",
  businessDate: "2026-07-21",
  title: "Daily Executive Brief - 2026-07-21",
  executiveSummary: "Schedule risk is supported by [S2].",
  currentStatus: "Current status cites [S3].",
  strategicRead: "Strategic read cites [S4] but remains excluded from Eve.",
  whyItMatters: "Client commitments are exposed [S5].",
  recommendedNextMoves: ["Confirm the schedule with [S6]."],
  confidenceSummary: { level: "medium" },
  sourceCoverage: {
    sourceIds: Array.from({ length: 224 }, (_, index) => `source-${index}`),
  },
  sourceCounts: { emails: 198, meetings: 14, teams: 12 },
  sourceIds: ["source-1", "source-2"],
  sourceCount: 224,
  sources: [
    source("S1", 1),
    source("S2", 2),
    source("S3", 3),
    source("S4", 4),
    source("S5", 5),
    source("S6", 6),
    source("S7", 7),
    source("S8", 8),
    source("S9", 9),
  ],
  briefMarkdown: "Large duplicate markdown cites [S7] but Eve must not receive it.",
  sections: [{ title: "Risks [S8]", body: "Schedule risk remains open." }],
  brief: {
    version: "v3",
    businessDate: "2026-07-21",
    executiveSignal: {
      headline: "Executive signal",
      whyNow: "A decision is needed.",
      focus: "Schedule",
      watchouts: [],
    },
    callsToday: [],
    projects: [],
    looseEnds: [],
    preventionFindings: [],
    sourceCoverage: {
      meetings: 1,
      emails: 1,
      teams: 1,
      documents: 1,
      thinLanes: [],
      note: null,
    },
    executiveSynthesis: {
      patterns: [],
      rootCauses: [],
      facts: [],
      inferences: [],
      recommendations: [],
      risks: [
        {
          id: "risk-1",
          statement: "Structured risk cites S9.",
          sourceIds: ["S9"],
          confidence: "high",
        },
      ],
      opportunities: [],
      financial: [],
      schedule: [],
      decisions: [],
      evidenceCoverage: {
        eligibleSourceCount: 9,
        citedSourceCount: 8,
        uncoveredSourceIds: ["S1"],
        note: null,
      },
    },
    sources: {
      S1: {
        title: "Uncovered source",
        type: "email",
        url: null,
        project: null,
      },
    },
  },
  compilerVersion: "brief-v3",
  runStatus: "completed",
} satisfies CanonicalDailyBriefPacket;

describe("toEveDailyBriefResponse", () => {
  it("keeps all cited evidence traceable while omitting oversized packet fields", () => {
    const response = toEveDailyBriefResponse(packet);

    expect(
      response.packet.sourceEvidence.map((evidence) => evidence.alias),
    ).toEqual(["S2", "S3", "S4", "S5", "S6", "S7", "S8", "S9"]);
    expect(response.packet.sourceEvidence).not.toEqual(
      expect.arrayContaining([expect.objectContaining({ alias: "S1" })]),
    );
    expect(response.packet.sourceEvidence).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "stable-source-id-9",
          alias: "S9",
          projectId: 709,
          url: "https://example.com/s9",
        }),
      ]),
    );
    expect(response.packet.referencedSourceCount).toBe(8);
    expect(response.packet.sourceCount).toBe(224);
    expect(response.packet).not.toHaveProperty("sourceCoverage");
    expect(response.packet).not.toHaveProperty("sourceIds");
    expect(response.packet).not.toHaveProperty("brief");
    expect(response.packet).not.toHaveProperty("briefMarkdown");
    expect(response.packet).not.toHaveProperty("strategicRead");
    expect(JSON.stringify(response).length).toBeLessThan(5_000);
  });
});
