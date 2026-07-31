import { wordStartFilter } from "../command";

describe("wordStartFilter", () => {
  it("matches command items by keyword aliases as well as item value", () => {
    expect(wordStartFilter("871", "goodwill", ["Goodwill Industries"])).toBe(1);
  });

  it("does not return unrelated matches", () => {
    expect(wordStartFilter("871", "goodwill", ["Acme Construction"])).toBe(0);
  });

  it("matches at the start of the value", () => {
    expect(wordStartFilter("Hy-Tek Material Handling, LLC", "hy")).toBe(1);
  });

  it("matches at the start of any word within the value", () => {
    expect(wordStartFilter("Hy-Tek Material Handling, LLC", "material")).toBe(1);
    expect(wordStartFilter("Hy-Tek Material Handling, LLC", "tek")).toBe(1);
  });

  it("rejects mid-word matches", () => {
    expect(wordStartFilter("Ryan Timothy Combs", "hy")).toBe(0);
    expect(wordStartFilter("Andrew Brannan", "drew")).toBe(0);
  });

  it("supports multi-word queries spanning word boundaries", () => {
    expect(
      wordStartFilter("Hy-Tek Material Handling, LLC", "material handling"),
    ).toBe(1);
  });

  it("treats an empty or whitespace-only search as match-all", () => {
    expect(wordStartFilter("Anything", "")).toBe(1);
    expect(wordStartFilter("Anything", "   ")).toBe(1);
  });

  it("escapes regex metacharacters in the search term", () => {
    expect(wordStartFilter("Smith (East) Division", "(east")).toBe(1);
    expect(wordStartFilter("Smith Division", "(east")).toBe(0);
  });
});
