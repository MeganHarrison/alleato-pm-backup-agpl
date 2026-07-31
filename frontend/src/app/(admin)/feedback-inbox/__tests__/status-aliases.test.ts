import {
  expandFeedbackStatusAliases,
  normalizeFeedbackStoredStatus,
} from "../status-aliases";

describe("feedback inbox status aliases", () => {
  it("normalizes verified writes to closed", () => {
    expect(normalizeFeedbackStoredStatus("verified")).toBe("closed");
    expect(normalizeFeedbackStoredStatus("closed")).toBe("closed");
  });

  it("expands verified reads to include both canonical and legacy values", () => {
    expect(expandFeedbackStatusAliases("verified")).toEqual(["closed", "verified"]);
  });

  it("expands in-review reads to include resolved and in_review", () => {
    expect(expandFeedbackStatusAliases("in_review")).toEqual([
      "resolved",
      "in_review",
    ]);
  });
});
