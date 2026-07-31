import {
  evaluateExecutiveBriefAgainstReference,
  formatExecutiveBriefReferenceEvalReport,
} from "../executive-brief-reference-eval";
import type {
  BrandonBriefItem,
  BrandonDailyUpdatePacket,
  ExecutiveOperatingBrief,
  ExecutiveOperatingBriefShortItem,
} from "../brandon-daily-update";

function briefItem(
  title: string,
  project: string,
  overrides: Partial<BrandonBriefItem> = {},
): BrandonBriefItem {
  return {
    title,
    summary: `${title} summary.`,
    evidenceFacts: [`${title} evidence.`],
    bullets: [`${title} bullet.`],
    recommendedAction: `Decide next move for ${title}.`,
    whyItMatters: `${title} changes the operating priority.`,
    source: "Meeting",
    sourceDetail: "June 25-26 transcript set",
    sourceId: `${project}-${title}`,
    evidence: `${title} was discussed in the meeting transcript.`,
    date: "2026-06-26",
    citations: [
      {
        source: "Meeting",
        sourceDetail: "June 25-26 transcript set",
        sourceId: `${project}-${title}`,
        evidence: `${title} was discussed in the meeting transcript.`,
        date: "2026-06-26",
      },
    ],
    project,
    tone: "watch",
    retrieval: "Transcript-first daily brief source",
    ...overrides,
  };
}

function shortItem(item: BrandonBriefItem): ExecutiveOperatingBriefShortItem {
  return {
    item,
    score: 8,
    materiality: ["Transcript-backed operating signal"],
    nextAction: item.recommendedAction ?? "Confirm owner and next step.",
  };
}

function packet(
  items: BrandonBriefItem[],
  operatingBrief?: ExecutiveOperatingBrief,
  retrievalNotes: string[] = [],
): BrandonDailyUpdatePacket {
  return {
    generatedAt: "2026-06-27T12:00:00.000Z",
    windowDays: 3,
    canonicalName: "Daily Brief",
    audiencePreset: "brandon",
    briefVersion: 2,
    retrievalOrder: [
      "Meetings",
      "Emails",
      "Teams",
      "Documents",
      "Financial pulse",
    ],
    sections: {
      needsBrandon: items.slice(0, 2),
      waitingOnOthers: items.slice(2, 4),
      importantUpdates: items.slice(4),
    },
    operatingBrief,
    sourceCoverage: [
      {
        label: "Meeting",
        detail: "Recent meeting transcripts",
        count: 23,
        latest: "2026-06-26T18:00:00.000Z",
        status: "loaded",
      },
      {
        label: "Email",
        detail: "Recent executive inbox",
        count: 236,
        latest: "2026-06-26T18:00:00.000Z",
        status: "loaded",
      },
    ],
    retrievalNotes,
  };
}

function referenceOperatingBrief(
  items: BrandonBriefItem[],
): ExecutiveOperatingBrief {
  return {
    startHere: [
      "Execution is healthy, but next week depends on external partner certainty.",
      "Financial systems are becoming an operating advantage, not back-office cleanup.",
    ],
    hasUnusualExecutiveLoad: false,
    topExecutiveFocus: [
      {
        item: items[0],
        score: 10,
        materiality: ["Strategic project", "Process redesign"],
        lane: "designPreconstruction",
        whatChanged:
          "Union Collective moved from ad hoc estimating to a Building Connected workflow.",
        whyItMatters:
          "The bid package can now catch scope gaps before they become execution risk.",
        recommendedNextMove:
          "Review the rebuilt bid package and confirm missing-scope owners.",
      },
    ],
    additionalMaterialItems: {
      cashMargin: [shortItem(items[3])],
      scheduleField: [shortItem(items[1])],
      customerOwner: [shortItem(items[2])],
      subcontractorVendor: [shortItem(items[5])],
      designPreconstruction: [shortItem(items[0])],
      internalAccountability: [shortItem(items[4])],
    },
    projectRiskRadar: [shortItem(items[1])],
    cashAndMarginWatch: [shortItem(items[3])],
    waitingOn: {
      brandonWaitingOn: [shortItem(items[1]), shortItem(items[5])],
      othersWaitingOnBrandon: [shortItem(items[0])],
    },
    peopleAndAccountability: [shortItem(items[5])],
    importantBusinessSignals: [
      "Revenue, WIP, reconciliation, payroll, AP, and AR are moving into a repeatable reporting cadence.",
      "Software evaluation now includes API and AI integration fit, not only feature checklists.",
    ],
    recommendedMoves: [
      "Lock the Superior permit and sprinkler material sequence before rack install.",
      "Make the monthly WIP review a standing leadership rhythm.",
    ],
    lowerPriorityMomentum: [shortItem(items[6])],
    businessHealth: [
      {
        area: "Projects",
        status: "watch",
        summary:
          "Union Collective, Superior Beverage, and Ice Cream Shop are moving, with external dependency risk concentrated in permits, manpower, and materials.",
      },
      {
        area: "Finance",
        status: "healthy",
        summary:
          "WIP reviews, reconciliation, payroll automation, AP, AR, and working capital visibility are becoming a financial operating rhythm.",
      },
      {
        area: "Operations",
        status: "healthy",
        summary:
          "Estimating, project execution, and communication workflows are being standardized into repeatable processes.",
      },
      {
        area: "Technology",
        status: "watch",
        summary:
          "Outbuild's lack of bidirectional API support validates the internal AI operating system strategy.",
      },
    ],
    emergingPatterns: [
      {
        title: "Alleato is standardizing its operating system",
        evidence: [
          "Building Connected is becoming the estimating workflow.",
          "Accounting is moving toward WIP, reconciliation, and reporting cadence.",
          "Project execution is using clearer weekly communication.",
        ],
        significance:
          "This reduces dependence on Brandon personally stitching together every project signal.",
        trend: "increasing",
      },
      {
        title: "External dependency management is the largest execution risk",
        evidence: [
          "Superior depends on permit timing, material release, and equipment coordination.",
          "SIVA manpower and subcontractor availability remain schedule constraints.",
        ],
        significance:
          "Alleato can be internally ready while partner, vendor, and permit timing still threatens certainty.",
        trend: "stable",
      },
    ],
    strategicRisks: [
      {
        title: "Manual integration limits can slow the AI operating system",
        likelihood: "medium",
        impact:
          "Software without bidirectional API support forces manual reconciliation and weakens source-backed automation.",
        trend: "stable",
        nextAction:
          "Score new platforms on API access, data export quality, and AI integration fit.",
      },
    ],
    opportunities: [
      "Use the WIP reporting cadence as the template for other executive operating rhythms.",
      "Convert the Union bid package rebuild into an estimating standard.",
    ],
    leadershipWatchlist: [
      "Superior permit approval",
      "Superior rack install readiness",
      "Union bid package rollout",
      "July closeouts",
      "Accounting WIP workflow",
    ],
    chiefOfStaffInsights: [
      "The company is increasingly operating as construction execution, operational systems, and technology strategy at the same time.",
    ],
  };
}

describe("executive brief reference eval", () => {
  it("fails the prior thin Goodwill and repeated pending-CO failure mode", () => {
    const goodwill = briefItem(
      "Potential change event: Goodwill IL",
      "26-107 Goodwill Canton, IL",
      {
        source: "Email",
        citations: [
          {
            source: "Email",
            sourceDetail: "Weekly huddle email",
            date: "2026-06-26",
          },
        ],
      },
    );
    const pendingCos = briefItem(
      "$422K in pending COs on hold",
      "Multiple (9 projects)",
      {
        source: "Document",
        recommendedAction: undefined,
        whyItMatters: undefined,
        citations: [
          {
            source: "Document",
            sourceDetail: "Financial pulse",
            date: "2026-06-26",
          },
        ],
      },
    );
    const thinPacket = packet(
      [goodwill, pendingCos],
      {
        startHere: ["Goodwill and pending COs need attention."],
        hasUnusualExecutiveLoad: false,
        topExecutiveFocus: [],
        additionalMaterialItems: {
          cashMargin: [shortItem(pendingCos)],
          scheduleField: [],
          customerOwner: [],
          subcontractorVendor: [],
          designPreconstruction: [],
          internalAccountability: [],
        },
        projectRiskRadar: [shortItem(pendingCos)],
        cashAndMarginWatch: [shortItem(pendingCos)],
        waitingOn: {
          brandonWaitingOn: [],
          othersWaitingOnBrandon: [],
        },
        peopleAndAccountability: [],
        importantBusinessSignals: ["$422K in pending COs on hold."],
        recommendedMoves: ["Follow up on pending COs."],
        lowerPriorityMomentum: [],
        businessHealth: [
          {
            area: "Finance",
            status: "watch",
            summary: "$422K in pending COs on hold.",
          },
        ],
        emergingPatterns: [],
        strategicRisks: [
          {
            title: "$422K in pending COs on hold",
            likelihood: "medium",
            impact: "$422K in pending COs on hold.",
            trend: "stable",
            nextAction: "Follow up on pending COs.",
          },
        ],
        opportunities: [],
        leadershipWatchlist: ["$422K in pending COs on hold"],
        chiefOfStaffInsights: [],
      },
      [],
    );

    const result = evaluateExecutiveBriefAgainstReference(thinPacket);

    expect(result.passed).toBe(false);
    expect(result.failedCheckIds).toEqual(
      expect.arrayContaining([
        "source-breadth",
        "meeting-backed-synthesis",
        "cross-meeting-patterns",
        "operating-brief-shape",
        "actionability",
        "topic-duplication",
        "fail-loudly-on-thin-high-coverage",
      ]),
    );
  });

  it("passes a June 25/26 reference-shaped executive operating brief", () => {
    const items = [
      briefItem(
        "Union Collective bid package is being rebuilt in Building Connected",
        "Union Collective",
      ),
      briefItem(
        "Superior permit and sprinkler materials drive next schedule risk",
        "Superior Beverage",
      ),
      briefItem(
        "Ice Cream Shop design optimization is healthy",
        "Ice Cream Shop",
      ),
      briefItem(
        "Accounting WIP and reconciliation cadence is maturing",
        "Alleato Finance",
      ),
      briefItem(
        "Outbuild lacks bidirectional API support for the AI operating system",
        "Technology and AI",
      ),
      briefItem("SIVA manpower remains an external dependency", "Superior Beverage"),
      briefItem("July closeouts are the next profitability lever", "Portfolio"),
    ];
    const result = evaluateExecutiveBriefAgainstReference(
      packet(items, referenceOperatingBrief(items), [
        "Transcript-first synthesis: recent meeting transcripts drove the operating brief.",
      ]),
    );

    expect(result.passed).toBe(true);
    expect(result.score).toBe(result.maxScore);
    expect(result.failedCheckIds).toEqual([]);
  });

  it("formats a compact pass/fail report for scripts and handoffs", () => {
    const result = evaluateExecutiveBriefAgainstReference(packet([], undefined));
    const report = formatExecutiveBriefReferenceEvalReport(result);

    expect(report).toContain("FAIL executive brief reference eval");
    expect(report).toContain("source-breadth");
    expect(report).toContain("cross-meeting-patterns");
  });
});
