import { knowledgeDocumentKeys } from "../use-knowledge-documents";

describe("knowledgeDocumentKeys", () => {
  it("all key is stable", () => {
    expect(knowledgeDocumentKeys.all).toEqual(["knowledge-documents"]);
  });

  it("list key includes filters", () => {
    const filters = { search: "drywall", manage: true };
    const key = knowledgeDocumentKeys.list(filters);
    expect(key).toEqual(["knowledge-documents", "list", filters]);
    expect(key[2]).toHaveProperty("search", "drywall");
    expect(key[2]).toHaveProperty("manage", true);
  });

  it("list key with undefined vs defined filters differ", () => {
    const withoutFilters = knowledgeDocumentKeys.list(undefined);
    const withFilters = knowledgeDocumentKeys.list({ search: "test" });
    expect(withoutFilters).not.toEqual(withFilters);
    expect(withoutFilters[2]).toBeUndefined();
  });

  it("list key with empty filters differs from undefined", () => {
    const withUndefined = knowledgeDocumentKeys.list(undefined);
    const withEmpty = knowledgeDocumentKeys.list({});
    // Both are valid but they should produce different React Query cache entries
    expect(withUndefined[2]).toBeUndefined();
    expect(withEmpty[2]).toEqual({});
  });

  /**
   * Known limitation: projectId=0 is falsy in JS, so the hook skips adding
   * projectId to the query params when projectId is 0. This means "global"
   * (projectId=undefined) and projectId=0 yield the same API request.
   * This is acceptable because project IDs in this codebase start at 1.
   */
  it("documents projectId=0 falsy behavior as a known limitation", () => {
    const withZero = knowledgeDocumentKeys.list({ projectId: 0 });
    const withUndefined = knowledgeDocumentKeys.list({ projectId: undefined });
    // The query KEY differs (0 vs undefined), but the actual API call would be identical
    // because the hook does `if (filters?.projectId)` which is falsy for 0
    expect(withZero[2]).toHaveProperty("projectId", 0);
    expect(withUndefined[2]).toHaveProperty("projectId", undefined);
    // Document: these produce different cache keys but same API request
  });
});
