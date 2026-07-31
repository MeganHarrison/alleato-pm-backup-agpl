import { normalizeSubmittalDetailTab } from "../detail-tabs";

describe("normalizeSubmittalDetailTab", () => {
  it("accepts the AI review deep-link tab", () => {
    expect(normalizeSubmittalDetailTab("ai-review")).toBe("ai-review");
  });

  it("falls back to details for missing or unknown tab values", () => {
    expect(normalizeSubmittalDetailTab(null)).toBe("details");
    expect(normalizeSubmittalDetailTab("workflow")).toBe("details");
  });
});
