import {
  buildCanonicalDailyBriefTeamsCard,
  deliverCanonicalDailyBriefToTeams,
  previewCanonicalDailyBriefTeamsPayload,
} from "../canonical-teams-delivery";
import type { CanonicalDailyBriefPacket } from "../canonical-packets";

jest.mock("chat", () => ({
  Actions: (children: unknown[]) => ({ type: "actions", children }),
  Card: (input: unknown) => ({ type: "card", ...input }),
  CardText: (text: string, options?: unknown) => ({
    type: "text",
    text,
    options,
  }),
  Divider: () => ({ type: "divider" }),
  LinkButton: (input: unknown) => ({ type: "link", ...input }),
}));

jest.mock("@/lib/executive/owner-briefing-recipients", () => ({
  OWNER_BRIEFING_RECIPIENTS: [],
}));

jest.mock("../canonical-packets", () => ({
  loadCurrentDailyExecutiveBriefPacket: jest.fn(),
}));

const packet: CanonicalDailyBriefPacket = {
  id: "packet-1",
  targetId: "target-1",
  packetType: "current",
  generatedAt: "2026-07-07T05:32:00.000Z",
  coveredStartAt: "2026-07-06T00:00:00.000Z",
  coveredEndAt: "2026-07-06T23:59:59.000Z",
  freshnessStatus: "fresh",
  businessDate: "2026-07-06",
  title: "Daily Executive Brief - 2026-07-06",
  executiveSummary: "Executive read",
  currentStatus: "On track",
  strategicRead: null,
  whyItMatters: null,
  recommendedNextMoves: ["Call Jason"],
  confidenceSummary: {},
  sourceCoverage: {},
  sourceCounts: { email: 2, meeting: 1 },
  sourceIds: ["source-1", "source-2", "source-3"],
  sources: [],
  sourceCount: 3,
  briefMarkdown: "## Executive read\nSummary",
  sections: [{ title: "Executive read", body: "Summary" }],
  brief: null,
  compilerVersion: "manual-v1",
};

describe("canonical Teams daily brief delivery", () => {
  it("builds Teams card metadata from the canonical packet", () => {
    const card = buildCanonicalDailyBriefTeamsCard(packet);

    expect(card.fallbackText).toContain("Daily Executive Brief - 2026-07-06");
    expect(JSON.stringify(card.card)).toEqual(
      expect.stringContaining("Canonical packet packet-1"),
    );
    expect(JSON.stringify(card.card)).toEqual(
      expect.stringContaining("Business date: 2026-07-06"),
    );
    expect(JSON.stringify(card.card)).toEqual(
      expect.stringContaining("Executive read"),
    );
  });

  it("includes an authenticated Download PDF action alongside the live brief link", () => {
    const card = buildCanonicalDailyBriefTeamsCard(packet);
    const serialized = JSON.stringify(card.card);

    expect(serialized).toEqual(expect.stringContaining("Download PDF"));
    expect(serialized).toEqual(
      expect.stringContaining("/api/executive/daily-brief/packet-1/pdf"),
    );
    // The live-brief button must still be present — PDF is additive, not a swap.
    expect(serialized).toEqual(
      expect.stringContaining("/daily-briefs/packet-1"),
    );
  });

  it("returns preview payload fields tied to intelligence_packets", async () => {
    await expect(
      previewCanonicalDailyBriefTeamsPayload(packet),
    ).resolves.toEqual(
      expect.objectContaining({
        sourceOfTruth: "intelligence_packets",
        targetSlug: "daily-executive-brief",
        packetId: "packet-1",
        businessDate: "2026-07-06",
        sourceCount: 3,
      }),
    );
  });

  it("fails loudly when no Teams recipients are configured", async () => {
    await expect(
      deliverCanonicalDailyBriefToTeams({ packet }),
    ).resolves.toEqual({
      ok: false,
      status: "blocked",
      reason: "no_recipients_configured",
    });
  });
});
