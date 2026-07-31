import {
  buildBoardCaptureMetadata,
  matchesBoardItemType,
  matchesBoardTextMetadata,
  normalizeBoardItemType,
  normalizeBoardTextField,
} from "../metadata";

describe("board metadata helpers", () => {
  it("normalizes optional text metadata", () => {
    expect(normalizeBoardTextField("  Figma  ")).toBe("Figma");
    expect(normalizeBoardTextField("")).toBeUndefined();
    expect(normalizeBoardTextField("   ")).toBeUndefined();
  });

  it("normalizes the board item type enum", () => {
    expect(normalizeBoardItemType(" design_issue ")).toBe("Design issue");
    expect(normalizeBoardItemType("")).toBeUndefined();
  });

  it("builds compact metadata with only populated fields", () => {
    expect(
      buildBoardCaptureMetadata({
        topics: ["mobile", "responsive", "mobile"],
        tool: " Figma ",
        category: " UX ",
        type: "  My Type  ",
      }),
    ).toEqual({
      topics: ["mobile", "responsive"],
      tool: "Figma",
      category: "UX",
      type: "My Type",
    });
  });

  it("matches optional metadata filters", () => {
    const item = {
        metadata: {
          tool: "Figma",
          category: "UX",
          type: "Initiative",
        },
      } as never;

    expect(matchesBoardTextMetadata(item, "tool", "Figma")).toBe(true);
    expect(matchesBoardTextMetadata(item, "tool", "Notion")).toBe(false);
    expect(matchesBoardTextMetadata(item, "category", "UX")).toBe(true);
    expect(matchesBoardItemType(item, "Initiative")).toBe(true);
    expect(matchesBoardItemType(item, "Question")).toBe(false);
  });
});
