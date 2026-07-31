import {
  getFirstTeamsMessageTimestamp,
  parseTeamsContent,
} from "../teams-conversation";

describe("parseTeamsContent", () => {
  it("parses Teams message markers into sender/time/message blocks", () => {
    const messages = parseTeamsContent(
      [
        "[Teams Direct Message Conversation: Operations]",
        "Date: 2026-06-22",
        "",
        "[message:1782143035299] [2026-06-22 15:43:55] Jesse Dawson: Good Morning everyone",
        "[message:1782147859248] [2026-06-22 17:04:19] Jesse Dawson: Code card transactions weekly.",
      ].join("\n"),
    );

    expect(messages).toEqual([
      {
        id: "1782143035299",
        timestamp: "2026-06-22 15:43:55",
        sender: "Jesse Dawson",
        text: "Good Morning everyone",
      },
      {
        id: "1782147859248",
        timestamp: "2026-06-22 17:04:19",
        sender: "Jesse Dawson",
        text: "Code card transactions weekly.",
      },
    ]);
  });

  it("returns null when content has no parseable Teams messages", () => {
    expect(parseTeamsContent("No markers here")).toBeNull();
  });

  it("returns the first Teams message timestamp for sheet header display", () => {
    expect(
      getFirstTeamsMessageTimestamp(
        "[message:1782143035299] [2026-06-22 15:43:55] Jesse Dawson: Good Morning everyone",
      ),
    ).toBe("2026-06-22 15:43:55");
  });
});
