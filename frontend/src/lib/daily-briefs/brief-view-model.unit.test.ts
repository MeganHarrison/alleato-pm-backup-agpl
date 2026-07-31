import type { CanonicalDailyBriefPacket } from "./canonical-packets";
import { splitDailyBriefMarkdown } from "./canonical-packets";
import {
  buildExecutiveBriefViewModel,
  classifySeverity,
  detectDate,
  detectMoney,
  parseInline,
  plainText,
  segmentsToText,
  splitLeadRest,
  stripCitations,
  topLevelBullets,
} from "./brief-view-model";

describe("brief-view-model parsing primitives", () => {
  it("strips citation tokens but keeps prose", () => {
    expect(
      stripCitations("Solar decision due by 7/8 [01KWC3EJZ9ZMX80Y9VF96RX90R]."),
    ).toBe("Solar decision due by 7/8.");
    expect(stripCitations("A [outlook_abc, teamsdm_x] B")).toBe("A B");
  });

  it("parses **bold** into inline segments", () => {
    const segments = parseInline(
      "Two items need **action now** before **7/8**.",
    );
    expect(segments.filter((s) => s.bold).map((s) => s.text)).toEqual([
      "action now",
      "7/8",
    ]);
    expect(segmentsToText(segments)).toBe(
      "Two items need action now before 7/8.",
    );
  });

  it("splits a bold lead sentence from the rest", () => {
    const { lead, rest } = splitLeadRest(
      "**Make the solar decision by 7/8.** This gates electrical design.",
    );
    expect(lead).toBe("Make the solar decision by 7/8");
    expect(rest).toBe("This gates electrical design.");
  });

  it("returns null lead when a bullet has no bold prefix", () => {
    const { lead, rest } = splitLeadRest("Cost exposure may add $10k.");
    expect(lead).toBeNull();
    expect(rest).toBe("Cost exposure may add $10k.");
  });

  it("classifies severity from keywords and dates", () => {
    expect(classifySeverity("escalate now, in failure mode")).toBe("critical");
    expect(classifySeverity("pending approval, due 7/10")).toBe("amber");
    expect(classifySeverity("decision due by 7/8")).toBe("amber");
    expect(classifySeverity("bids improving and awarded")).toBe("positive");
    expect(classifySeverity("general status note")).toBe("info");
  });

  it("detects the first M/D date", () => {
    expect(detectDate("start slipped to 7/13 pending permits")).toBe("7/13");
    expect(detectDate("no date here")).toBeNull();
  });

  it("detects money figures including ranges", () => {
    expect(detectMoney("adds $10k–$12k exposure")).toEqual(["$10k–$12k"]);
    expect(detectMoney("$9,620.20 permit fee and $100 registration")).toEqual([
      "$9,620.20",
      "$100",
    ]);
    expect(detectMoney("no money")).toEqual([]);
  });

  it("extracts only top-level bullets", () => {
    const body = "- First\n  - nested\n- Second";
    expect(topLevelBullets(body)).toEqual(["First", "Second"]);
  });

  it("plainText removes both citations and bold markers", () => {
    expect(plainText("Cost may add **$10k–$12k** [01KWC].")).toBe(
      "Cost may add $10k–$12k.",
    );
  });
});

const SAMPLE_MARKDOWN = `## Executive Brief
Two owner-level items need action now: **Union Collective solar selection by 7/8** or design slips [01KWC3EJZ9ZMX80Y9VF96RX90R]. Separately, **McLean sprinkler execution is in failure mode** [01KWVKBKFGZWJFQT45FJHRBATQ].

Cash/watch items: **$16k Washington contingency** awaits approval [01KWSKJ5WQQQQWKGVRG2NFATZ7].

## Highest-Leverage Owner Decisions
- **Make the Union Collective solar decision by 7/8.** This gates electrical and permit-set completion [01KWC3EJZ9ZMX80Y9VF96RX90R].
- **Confirm remedy posture on McLean now.** Team is preparing to enforce remedies [01KWVKBKFGZWJFQT45FJHRBATQ].

## Project Intelligence Updates
- **Union Collective**
  - Solar decision due now; permit target **7/28** [01KWC3EJZ9ZMX80Y9VF96RX90R].
  - Cost exposure may add **$10k–$12k** [01KWC3EJZ9ZMX80Y9VF96RX90R].
- **Superior Beverage**
  - Permit fee **$9,620.20** now visible; start slipped to **7/13** [outlook_x].

## Risk Candidates
- **Brooksville still on permit hold.** City comment remains vague [01KWC3EJZ130Q2KHS9RXWCB9D1].
- Bid coverage is thin in electrical and steel [teamsdm_x].

## Source Coverage
\`\`\`json
{ "note": "ignored" }
\`\`\`
`;

function makePacket(): CanonicalDailyBriefPacket {
  return {
    id: "packet-1",
    targetId: "target-1",
    packetType: "current",
    generatedAt: "2026-07-07T23:02:18.929Z",
    coveredStartAt: "2026-07-07T10:00:00Z",
    coveredEndAt: "2026-07-07T22:00:00Z",
    freshnessStatus: "fresh",
    businessDate: "2026-07-07",
    title: "Daily Executive Brief - 2026-07-07",
    executiveSummary: null,
    currentStatus: null,
    strategicRead: null,
    whyItMatters: null,
    recommendedNextMoves: [],
    confidenceSummary: {},
    sourceCoverage: {
      included: { meetings: 11, emails: 98, teams: 15, documents: 20 },
      skipped: 485,
    },
    sourceCounts: { meetings: 11, emails: 98, teams: 15, documents: 20 },
    sourceIds: [],
    sources: [
      {
        id: "S247",
        alias: "S247",
        title: "Union decision record",
        lane: "meetings",
        projectId: 1,
        projectName: "Union Collective",
        sourceAt: null,
        url: "https://example.test/union",
      },
      {
        id: "S53",
        alias: "S53",
        title: "Paving change email",
        lane: "email",
        projectId: 2,
        projectName: "Vermillion Rise",
        sourceAt: null,
        url: null,
      },
    ],
    sourceCount: 144,
    briefMarkdown: SAMPLE_MARKDOWN,
    sections: splitDailyBriefMarkdown(SAMPLE_MARKDOWN),
    brief: null, // legacy packet: exercises the section-parsing fallback
    compilerVersion: "daily_deep_read",
  };
}

function makeV3Packet(): CanonicalDailyBriefPacket {
  return {
    ...makePacket(),
    brief: {
      version: "v3",
      businessDate: "2026-07-07",
      executiveSignal: {
        headline: "Execution discipline is now the portfolio constraint.",
        whyNow:
          "Release gates and supplier commitments are converging this week.",
        focus:
          "Close the owner decisions before the next field commitments are made.",
        watchouts: [
          "Union's permit target is at risk.",
          "McLane sprinkler support resolved today.",
        ],
      },
      callsToday: [
        {
          project: "Union Collective",
          question: "decide on battery storage.",
          optional: false,
          sourceIds: ["S247"],
        },
        {
          project: "Vermillion Rise",
          question: "approve the ~$11,000 paving change?",
          optional: false,
          sourceIds: ["S53"],
        },
      ],
      projects: [
        {
          name: "Union Collective",
          urgencyRank: 1,
          hasOwnerDecision: true,
          resolvedToday: false,
          actionItems: [
            {
              ownerIsBrandon: true,
              owner: "You",
              text: "decide on battery storage",
              due: null,
              dueIso: null,
              urgency: null,
              optional: false,
              sourceIds: ["S247"],
            },
            {
              ownerIsBrandon: false,
              owner: "Andrew Cannon",
              text: "email Viox for the 70% set",
              due: "July 14",
              dueIso: "2026-07-14",
              urgency: null,
              optional: false,
              sourceIds: ["S247"],
            },
          ],
          context:
            "Union is losing money this week; steel bid is $950,109. [S247]",
        },
        {
          name: "McLane Jazz, Utah",
          urgencyRank: 9,
          hasOwnerDecision: false,
          resolvedToday: true,
          actionItems: [],
          context: "Sprinkler support resolved today. [S259]",
        },
      ],
      looseEnds: [],
      preventionFindings: [],
      sourceCoverage: {
        meetings: 11,
        emails: 98,
        teams: 15,
        documents: 20,
        thinLanes: [],
        note: null,
      },
      sources: {},
    },
  };
}

describe("buildExecutiveBriefViewModel", () => {
  const model = buildExecutiveBriefViewModel(makePacket());

  it("formats the masthead date and coverage counts", () => {
    expect(model.weekday).toBe("Tuesday");
    expect(model.dateLabel).toBe("July 7, 2026");
    expect(model.preparedFor).toBe("Brandon");
    expect(model.counts).toEqual({
      meetings: 11,
      emails: 98,
      teams: 15,
      documents: 20,
    });
    expect(model.filteredCount).toBe(485);
  });

  it("derives a thesis from the first Executive Brief sentence without markup", () => {
    expect(model.thesis).toMatch(/^Two owner-level items need action now/);
    expect(model.thesis).not.toContain("**");
    expect(model.thesis).not.toContain("[");
  });

  it("builds decisions with severity, badge, and reference", () => {
    const solar = model.decisions.find((d) =>
      d.title.includes("solar decision"),
    );
    expect(solar).toBeDefined();
    expect(solar?.severity).toBe("amber");
    expect(solar?.reference).toBe("Union Collective");
    expect(solar?.due?.value).toBe("7/8");

    const mclean = model.decisions.find((d) =>
      d.title.includes("remedy posture"),
    );
    expect(mclean?.severity).toBe("critical");
    expect(mclean?.badge).toBe("Escalate today");
  });

  it("does not duplicate a decision that appears in two source sections", () => {
    const titles = model.decisions.map((d) => d.title.toLowerCase());
    const unique = new Set(titles);
    expect(unique.size).toBe(titles.length);
  });

  it("builds money stats from dollar figures across sections", () => {
    const figures = model.money.map((m) => m.figure);
    expect(figures).toContain("$16k");
    expect(figures).toContain("$9,620.20");
    // no fabricated cash-flow hero — just real figures
    expect(model.money.length).toBeGreaterThan(0);
  });

  it("maps risk candidates into operations rows with severity", () => {
    const brooksville = model.operations.find((o) =>
      o.title.includes("Brooksville"),
    );
    expect(brooksville).toBeDefined();
    expect(brooksville?.severity).toBe("amber");
    // no raw markdown markers leak into plain-text titles
    expect(model.operations.every((o) => !o.title.includes("**"))).toBe(true);
    expect(model.decisions.every((d) => !d.title.includes("**"))).toBe(true);
  });

  it("parses project cards with names, figures, and pills", () => {
    const union = model.projects.find((p) => p.name === "Union Collective");
    expect(union).toBeDefined();
    const figureText =
      union?.figures.map((f) => f.label.map((s) => s.text).join("")) ?? [];
    expect(figureText.join(" ")).toContain("$10k–$12k");

    const superior = model.projects.find((p) => p.name === "Superior Beverage");
    expect(superior).toBeDefined();
  });

  it("produces a data-driven temperature strip", () => {
    const labels = model.temperature.map((t) => t.label);
    expect(labels).toContain("decisions needed");
    expect(labels).toContain("schedule risks");
    expect(labels).toContain("cash items");
  });

  it("uses top decisions as the 'today's read' highlights", () => {
    expect(model.read.lead.length).toBeGreaterThan(0);
    expect(model.read.items.length).toBeGreaterThan(0);
    expect(model.read.items.length).toBeLessThanOrEqual(3);
  });
});

describe("buildExecutiveBriefViewModel — v3 structured brief", () => {
  const model = buildExecutiveBriefViewModel(makeV3Packet());

  it("builds decisions from callsToday (optional flagged)", () => {
    expect(model.decisions).toHaveLength(2);
    expect(model.decisions[0].title).toBe("Union Collective");
    expect(model.decisions[0].badge).toBe("Decision");
    expect(model.decisions[0].sourceRefs).toEqual([
      {
        title: "Union decision record",
        url: "https://example.test/union",
        lane: "meetings",
      },
    ]);
  });

  it("orders projects by urgency and labels decision vs on-track", () => {
    expect(model.projects[0].name).toBe("Union Collective");
    expect(model.projects[0].pill).toBe("Action");
    const mclane = model.projects.find((p) => p.name.startsWith("McLane"));
    expect(mclane?.subtitle).toBe("Resolved today");
  });

  it("derives operations from action items with owner/due tags", () => {
    const viox = model.operations.find((o) => o.title.includes("Viox"));
    expect(viox?.tag).toBe("Due July 14");
  });

  it("pulls money exposure from project context", () => {
    expect(model.money.some((m) => m.figure.includes("950,109"))).toBe(true);
  });

  it("synthesizes a decisions-count thesis", () => {
    expect(model.thesis).toBe(
      "Execution discipline is now the portfolio constraint.",
    );
    expect(model.read.supporting).toHaveLength(2);
  });

  it("keeps project context with each decision instead of showing a question alone", () => {
    expect(
      model.decisions[0].context.map((segment) => segment.text).join(""),
    ).toContain("Union is losing money this week");
  });

  it("projects every persisted report section for citation-aware landing-page rendering", () => {
    expect(model.narrativeSections.map((section) => section.title)).toEqual([
      "Executive Brief",
      "Highest-Leverage Owner Decisions",
      "Project Intelligence Updates",
      "Risk Candidates",
      "Source Coverage",
    ]);
    expect(model.narrativeSections.map((section) => section.kind)).toEqual([
      "assessment",
      "action",
      "portfolio",
      "risk",
      "evidence",
    ]);
  });
});

describe("buildExecutiveBriefViewModel — recommended systems", () => {
  function packetWithFindings(): CanonicalDailyBriefPacket {
    const packet = makeV3Packet();
    packet.brief!.preventionFindings = [
      {
        issueKey: "change-mgmt-discipline",
        title: "Field changes proceeding without a change request",
        category: "change_management",
        severity: "high",
        observedCondition: "Crews executed added scope before pricing. [S12]",
        preventability: "preventable",
        preventabilityBasis: "A gate would have blocked the work order.",
        missingControl: "No hard link between a field change and a change request.",
        recommendedSystem:
          "Block a change-event line from saving without a linked change request and RFI.",
        accountableRole: "Project Manager",
        leadingIndicator: "Change events with no linked CR, counted weekly.",
        confidence: "high",
        sourceIds: ["S12"],
      },
      {
        issueKey: "unknowable",
        title: "Possible permit slippage",
        category: "scheduling",
        severity: "low",
        observedCondition: "Permit status unclear.",
        // Not assessable — must not be presented as a recommended fix.
        preventability: "cannot_determine",
        preventabilityBasis: "Insufficient evidence.",
        missingControl: "Unknown.",
        recommendedSystem: "Unknown.",
        accountableRole: null,
        leadingIndicator: null,
        confidence: "low",
        sourceIds: [],
      },
    ];
    return packet;
  }

  it("surfaces the fix (missing control + recommended system), not just the problem", () => {
    const model = buildExecutiveBriefViewModel(packetWithFindings());
    expect(model.recommendedSystems).toHaveLength(1);
    const [item] = model.recommendedSystems;
    expect(item.title).toBe("Field changes proceeding without a change request");
    expect(item.missingControl).toContain("No hard link");
    expect(item.recommendedSystem).toContain("without a linked change request");
    expect(item.accountableRole).toBe("Project Manager");
    expect(item.leadingIndicator).toContain("counted weekly");
    expect(item.severity).toBe("critical");
  });

  it("omits findings whose preventability could not be determined", () => {
    const model = buildExecutiveBriefViewModel(packetWithFindings());
    expect(
      model.recommendedSystems.some((item) => item.id === "unknowable"),
    ).toBe(false);
  });

  it("is empty for legacy markdown packets", () => {
    expect(buildExecutiveBriefViewModel(makePacket()).recommendedSystems).toEqual(
      [],
    );
  });
});
