import {
  compactProjectDisplayName,
  getProjectDisplayName,
} from "../project-display-name";

describe("project display names", () => {
  it("prefers a trimmed human name over technical identifiers", () => {
    expect(
      getProjectDisplayName({
        name: "  Goodwill Noblesville  ",
        internalIdentifiers: [26116, "26116"],
      }),
    ).toBe("Goodwill Noblesville");
  });

  it("rejects code-as-name source values", () => {
    expect(
      getProjectDisplayName({
        name: "26116",
        internalIdentifiers: ["26116"],
      }),
    ).toBe("Unnamed project");
  });

  it("removes formatted code prefixes from otherwise human names", () => {
    expect(
      getProjectDisplayName({
        description: "26-116 Exol Morrisville",
        internalIdentifiers: ["26116"],
      }),
    ).toBe("Exol Morrisville");
    expect(
      getProjectDisplayName({
        description: "26-104 - CEVA Bernville ASRS Phase 2",
        internalIdentifiers: ["26104"],
      }),
    ).toBe("CEVA Bernville ASRS Phase 2");
  });

  it("uses explicit human-safe missing-project states", () => {
    expect(getProjectDisplayName({ name: null })).toBe("Unnamed project");
    expect(
      getProjectDisplayName({
        name: "(No Project)",
        internalIdentifiers: ["(No Project)"],
        isUnassigned: true,
      }),
    ).toBe("Unassigned");
  });

  it("compacts long names without replacing them with a code", () => {
    expect(compactProjectDisplayName("Goodwill Noblesville", 14)).toBe(
      "Goodwill Nobl…",
    );
    expect(compactProjectDisplayName("Vermillion", 14)).toBe("Vermillion");
  });
});
