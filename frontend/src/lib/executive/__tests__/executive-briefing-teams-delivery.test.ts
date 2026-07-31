const mockSendProactiveCard = jest.fn();

jest.mock("chat", () => ({
  Card: (opts: { title?: string; subtitle?: string; children?: unknown[] }) => ({
    type: "card",
    title: opts?.title,
    subtitle: opts?.subtitle,
    children: opts?.children ?? [],
  }),
  CardText: (content: string, opts?: { style?: string }) => ({
    type: "text",
    content,
    style: opts?.style,
  }),
  Divider: () => ({ type: "divider" }),
  Actions: (children: unknown[]) => ({ type: "actions", children }),
  LinkButton: (opts: { label: string; url: string }) => ({
    type: "link-button",
    label: opts.label,
    url: opts.url,
  }),
}));

jest.mock("@/lib/bot/teams-chat", () => ({
  sendProactiveCard: (...args: unknown[]) => mockSendProactiveCard(...args),
}));

jest.mock("@/lib/executive/executive-briefing-workflow", () => ({
  CEO_EXECUTIVE_BRIEFING_RECAP_KIND: "executive_briefing",
}));

jest.mock("../brandon-daily-update", () => ({
  DEFAULT_EXECUTIVE_WINDOW_DAYS: 3,
}));

import {
  formatExecutiveBriefingTeamsMessage,
  buildExecutiveBriefingCard,
  sendApprovedExecutiveBriefingToTeams,
} from "../executive-briefing-teams-delivery";
import type { BrandonDailyUpdatePacket } from "../brandon-daily-update";

const packet: BrandonDailyUpdatePacket = {
  generatedAt: "2026-05-06T12:00:00.000Z",
  windowDays: 3,
  retrievalOrder: [],
  sections: {
    needsBrandon: [
      {
        title: "Signed owner approval is needed",
        summary: "The owner approval is ready but not signed.",
        bullets: [
          "Owner approval is ready but still needs signature.",
          "Deadline pressure is now visible in the source thread.",
        ],
        recommendedAction: "Confirm the approver and deadline.",
        whyItMatters: "The project cannot move cleanly until the owner approval is signed.",
        source: "Email",
        sourceDetail: "Owner approval email",
        sourceUrl: "https://example.com/source",
        sourceId: "source-1",
        evidence: "The owner approval is ready but not signed.",
        date: "May 6, 2026",
        citations: [
          {
            source: "Email",
            sourceDetail: "Owner approval email",
            sourceUrl: "https://example.com/source",
            sourceId: "source-1",
            evidence: "The owner approval is ready but not signed.",
            date: "May 6, 2026",
          },
        ],
        project: "983 Test Project",
      },
    ],
    waitingOnOthers: [],
    importantUpdates: [],
  },
  operatingBrief: {
    startHere: ["Confirm the owner approval path first."],
    hasUnusualExecutiveLoad: false,
    topExecutiveFocus: [
      {
        item: {
          title: "GC schedule recovery needs executive commitment",
          summary: "The project team is trying to recover a two-week schedule slip.",
          bullets: ["Two-week recovery plan is not yet committed by the field team."],
          recommendedAction: "Decide whether to authorize weekend work.",
          whyItMatters: "Schedule recovery protects the customer relationship and revenue timing.",
          source: "Teams",
          sourceDetail: "Field ops thread",
          sourceId: "teams-1",
          evidence: "Weekend work is the fastest recovery path.",
          date: "May 6, 2026",
          citations: [
            {
              source: "Teams",
              sourceDetail: "Field ops thread",
              sourceId: "teams-1",
              evidence: "Weekend work is the fastest recovery path.",
              date: "May 6, 2026",
            },
          ],
          project: "983 Test Project",
        },
        score: 88,
        materiality: ["Schedule", "Customer"],
        lane: "scheduleField",
        whatChanged: "The recovery path now needs executive commitment.",
        whyItMatters: "A missed commitment could affect turnover and customer confidence.",
        recommendedNextMove: "Ask the PM for the weekend-work cost and customer approval path.",
      },
    ],
    additionalMaterialItems: {
      cashMargin: [],
      scheduleField: [],
      customerOwner: [],
      subcontractorVendor: [],
      designPreconstruction: [],
      internalAccountability: [],
    },
    projectRiskRadar: [
      {
        item: {
          title: "Vendor delay could hit install date",
          summary: "Vendor delivery has slipped without a confirmed recovery plan.",
          bullets: ["Vendor delivery date is not confirmed."],
          recommendedAction: "Get a confirmed ship date and backup vendor option.",
          whyItMatters: "Late material can push installation and create field downtime.",
          source: "Email",
          sourceDetail: "Vendor delivery thread",
          sourceId: "email-2",
          evidence: "Vendor delivery date is not confirmed.",
          date: "May 6, 2026",
          citations: [
            {
              source: "Email",
              sourceDetail: "Vendor delivery thread",
              sourceId: "email-2",
              evidence: "Vendor delivery date is not confirmed.",
              date: "May 6, 2026",
            },
          ],
          project: "983 Test Project",
        },
        score: 72,
        materiality: ["Schedule", "Vendor"],
        nextAction: "Have purchasing confirm ship date and escalation path.",
        impact: "Install date and field productivity are exposed.",
      },
    ],
    cashAndMarginWatch: [],
    waitingOn: {
      brandonWaitingOn: [],
      othersWaitingOnBrandon: [],
    },
    peopleAndAccountability: [],
    importantBusinessSignals: [],
    recommendedMoves: ["Confirm the approval owner before end of day."],
    lowerPriorityMomentum: [],
  },
  sourceCoverage: [],
  retrievalNotes: [],
};

describe("executive briefing Teams delivery", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("blocks the deprecated direct Teams sender", async () => {
    await expect(
      sendApprovedExecutiveBriefingToTeams({
        userId: "user-1",
      }),
    ).rejects.toThrow(
      "Deprecated Executive Daily Brief Teams sender is blocked.",
    );
    expect(mockSendProactiveCard).not.toHaveBeenCalled();
  });

  it("buildExecutiveBriefingCard: sends a card with the correct title and decisions content", () => {
    const cardPayload = buildExecutiveBriefingCard(packet, "Brandon", {
      now: new Date("2026-05-08T13:00:00.000Z"),
    });
    expect(cardPayload.fallbackText).toContain("Daily Brief");
    expect(cardPayload.fallbackText).toContain("1 item");
    const card = cardPayload.card;

    expect(card.title).toMatch(/Daily Brief —/);
    const contentStrings = card.children
      .filter((c) => c.type === "text" && c.content)
      .map((c) => c.content as string);
    expect(contentStrings.some((s) => s.includes("Needs your attention (1)"))).toBe(true);
    expect(contentStrings.some((s) => s.includes("[Owner approval email]"))).toBe(true);
  });

  it("formats a Teams message preview from the stored packet", () => {
    const message = formatExecutiveBriefingTeamsMessage(packet, "Brandon", {
      now: new Date("2026-05-08T13:00:00.000Z"),
    });

    expect(message).toContain("Daily Brief");
    expect(message).toContain("Needs your attention");
    expect(message).toContain("Owner approval email");
  });

  it("buildExecutiveBriefingCard: uses a morning greeting before noon Eastern", () => {
    const { card } = buildExecutiveBriefingCard(packet, null, {
      now: new Date("2026-05-08T13:00:00.000Z"),
    });

    expect(card.title).toContain("Daily Brief — Friday, May 8");
    expect(card.subtitle).toBe("Good morning.");
    const texts = card.children
      .filter((c) => c.type === "text" && (c as { content?: string }).content)
      .map((c) => (c as { content: string }).content);
    expect(texts.some((t) => t.includes("Needs your attention (1)"))).toBe(true);
    expect(texts.some((t) => t.includes("1. Test Project"))).toBe(true);
    expect(texts.some((t) => t.includes("Owner approval is ready but still needs signature."))).toBe(true);
    expect(texts.some((t) => t.includes("[Owner approval email]"))).toBe(true);
  });

  it("buildExecutiveBriefingCard: uses an evening greeting for the 6pm Eastern send", () => {
    const { card } = buildExecutiveBriefingCard(packet, "Brandon", {
      now: new Date("2026-05-08T22:00:00.000Z"),
    });

    expect(card.title).toContain("Daily Brief — Friday, May 8");
    expect(card.subtitle).toBe("Good evening, Brandon.");
  });

});
