import { formatExecutiveBriefingTeamsMessage } from "../executive-briefing-render";
import type {
  BrandonBriefItem,
  BrandonDailyUpdatePacket,
} from "../brandon-daily-update";

// A non-breaking space is the only separator Teams will not collapse between
// two consecutive bold lines (section header / bold insight → bold project
// name). Each project name must have one above it so it reads as a distinct,
// spaced group. Regression guard for the "GW Kokomo glued to its header" bug.
const NBSP = " ";

function makeItem(overrides: Partial<BrandonBriefItem> = {}): BrandonBriefItem {
  return {
    title: "Exterior wall panel decision",
    summary: "The wall package depends on a panel-type decision.",
    bullets: ["Insulated metal panels may not arrive until December."],
    source: "Meeting",
    sourceDetail: "Goodwill Weekly OAC Meeting",
    date: "2026-06-09",
    citations: [],
    project: "26 GW Kokomo",
    whyItMatters:
      "If Brandon does not confirm whether to pursue insulated metal panels, Tony Courtney may keep planning around exterior wall panels.",
    ...overrides,
  };
}

function makePacket(
  sections: Partial<BrandonDailyUpdatePacket["sections"]>,
): BrandonDailyUpdatePacket {
  return {
    generatedAt: "2026-06-09T13:00:00.000Z",
    windowDays: 3,
    retrievalOrder: [],
    sections: {
      needsBrandon: [],
      waitingOnOthers: [],
      importantUpdates: [],
      ...sections,
    },
    sourceCoverage: [],
    retrievalNotes: [],
  };
}

const NOW = new Date("2026-06-09T13:00:00.000Z");

describe("formatExecutiveBriefingTeamsMessage spacing", () => {
  it("puts a non-collapsing blank line above the first project name under a section header", () => {
    const message = formatExecutiveBriefingTeamsMessage(
      makePacket({ importantUpdates: [makeItem()] }),
      "Brandon",
      { now: NOW },
    );

    // "26 GW Kokomo" → "GW Kokomo" after the code prefix is stripped.
    expect(message).toContain("**Project updates**");
    expect(message).toContain("**GW Kokomo**");
    // The header must not sit directly on top of the project name (Teams glues
    // two adjacent bold lines). A NBSP spacer block must come between them.
    expect(message).toContain(
      `**Project updates**\n\n${NBSP}\n\n**GW Kokomo**`,
    );
    expect(message).not.toContain("**Project updates**\n\n**GW Kokomo**");
  });

  it("gives every project name its own spacer, even an item with no source link", () => {
    const message = formatExecutiveBriefingTeamsMessage(
      makePacket({
        importantUpdates: [
          makeItem({ project: "26 GW Kokomo", citations: [] }),
          makeItem({ project: "31 Uniqlo Fishers", citations: [] }),
        ],
      }),
      "Brandon",
      { now: NOW },
    );

    // The first item has no source link, so its bold insight line would
    // otherwise glue directly onto the next project name.
    expect(message).toContain(`${NBSP}\n\n**GW Kokomo**`);
    expect(message).toContain(`${NBSP}\n\n**Uniqlo Fishers**`);
  });

  it("does not strip address-style project names like 440 W", () => {
    const message = formatExecutiveBriefingTeamsMessage(
      makePacket({
        importantUpdates: [
          makeItem({
            project: "440 W",
            title: "440 West needs a clear explanation for the higher bid",
            summary:
              "440 W bid increased after the scope changed to full restoration.",
            bullets: [
              "440 W bid increased after the scope changed to full restoration.",
            ],
          }),
        ],
      }),
      "Brandon",
      { now: NOW },
    );

    expect(message).toContain("**440 W**");
    expect(message).not.toContain("**W**");
  });
});
