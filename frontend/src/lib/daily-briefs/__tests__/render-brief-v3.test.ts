import { renderBriefMarkdownV3 } from "../render-brief-v3";
import type { BriefV3 } from "../brief-v3-types";

function fixture(): BriefV3 {
  return {
    version: "v3",
    businessDate: "2026-07-08",
    callsToday: [
      {
        project: "Union Collective",
        question: "decide on battery storage, and confirm the early / split permit submission.",
        optional: false,
        sourceIds: ["S247"],
      },
      {
        project: "Goodwill Brookville",
        question: "do you want Tony to escalate the Koontz-Wagner signature directly?",
        optional: true,
        sourceIds: ["S126"],
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
            text: "email Viox to demand the 70% progress set, copy you",
            due: "July 14",
            dueIso: "2026-07-14",
            urgency: null,
            optional: false,
            sourceIds: ["S247"],
          },
        ],
        context: "This is where you're losing money this week. [S247]",
      },
      {
        name: "McLane Jazz, Utah",
        urgencyRank: 9,
        hasOwnerDecision: false,
        resolvedToday: true,
        actionItems: [],
        context: "Resolved today. [S259]",
      },
    ],
    looseEnds: [
      {
        text: "Confirm the Centier cash position and whether the $160,000 wire cleared.",
        sourceIds: [],
      },
    ],
    sourceCoverage: {
      meetings: 5,
      emails: 188,
      teams: 12,
      documents: 103,
      thinLanes: ["Goodwill Brookville email"],
      note: "S260 and S307 are the same email — dedup before writing.",
    },
    sources: {
      S247: { title: "Teams: Brandon/Andrew", type: "teams", url: null, project: "Union Collective" },
      S126: { title: "Koontz-Wagner subcontract", type: "email", url: "https://example.com/s126", project: "Goodwill Brookville Road" },
      S259: { title: "McLane sprinkler", type: "email", url: "https://example.com/s259", project: "McLane Jazz - UT" },
    },
  };
}

describe("renderBriefMarkdownV3", () => {
  const md = renderBriefMarkdownV3(fixture());

  it("opens at the title with no format-explainer line", () => {
    expect(md.startsWith("# Daily Executive Brief — 2026-07-08\n")).toBe(true);
    // The next non-blank content is the calls index, never a how-to-read paragraph.
    expect(md).not.toMatch(/Projects are ordered most urgent first/i);
    const afterTitle = md.split("\n").slice(1).find((l) => l.trim().length > 0 && l.trim() !== "---");
    expect(afterTitle).toBe("## Your calls today");
  });

  it("renders the decision index with only decisions, optional marked", () => {
    expect(md).toContain("## Your calls today");
    expect(md).toContain("- **Union Collective** — decide on battery storage");
    expect(md).toContain("- **Goodwill Brookville** *(optional)* — do you want Tony");
  });

  it("leads each project block with Action Items, Brandon as You, due dates real", () => {
    const unionIdx = md.indexOf("## Union Collective");
    const unionBlock = md.slice(unionIdx, md.indexOf("---", unionIdx + 1));
    // Action Items header appears before the context prose.
    expect(unionBlock.indexOf("**Action Items**")).toBeLessThan(unionBlock.indexOf("losing money"));
    expect(md).toContain("- **You — decide on battery storage** [S247]");
    expect(md).toContain("- **Andrew Cannon — email Viox to demand the 70% progress set, copy you** Due July 14. [S247]");
  });

  it("collapses no-decision projects into a details group with ### headings", () => {
    expect(md).toContain("## Also moving — nothing needed from you");
    expect(md).toContain("<details>");
    expect(md).toContain("<summary><strong>Show 1 project on track</strong></summary>");
    expect(md).toContain("### McLane Jazz, Utah");
    expect(md).toContain("**Action Items** — nothing, resolved today.");
    expect(md).toContain("</details>");
    // Collapsed project must NOT appear as a top-level ## heading (### is fine).
    expect(md).not.toMatch(/^## McLane Jazz, Utah$/m);
  });

  it("lists loose ends and emits linked source definitions (skipping url-less Teams)", () => {
    expect(md).toContain("## Loose ends — yours to chase");
    expect(md).toContain("- **Confirm the Centier cash position");
    // Teams S247 has no url → no definition; email sources do.
    expect(md).toContain("[S126]: https://example.com/s126");
    expect(md).toContain("[S259]: https://example.com/s259");
    expect(md).not.toContain("[S247]: ");
  });

  it("includes the source-coverage note (dedup caveat)", () => {
    expect(md).toContain("S260 and S307 are the same email");
  });
});
