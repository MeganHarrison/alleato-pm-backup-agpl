import {
  SEARCH_ENTITY_CONFIGS,
  RESULTS_PER_GROUP,
  sanitizeSearchTerm,
} from "../global-search-config";

describe("sanitizeSearchTerm", () => {
  it("strips PostgREST or() delimiters that would break the filter string", () => {
    // Arrange
    const raw = "acme, inc (west) 100%";
    // Act
    const result = sanitizeSearchTerm(raw);
    // Assert — no commas, parens, or wildcards survive
    expect(result).toBe("acme inc west 100");
    expect(result).not.toMatch(/[,()%*\\]/);
  });

  it("collapses whitespace and trims", () => {
    expect(sanitizeSearchTerm("  foo   bar  ")).toBe("foo bar");
  });

  it("returns an empty string when the input is only special characters", () => {
    expect(sanitizeSearchTerm(",,, ()")).toBe("");
  });

  it("leaves a normal single-word query untouched", () => {
    expect(sanitizeSearchTerm("foundation")).toBe("foundation");
  });
});

describe("SEARCH_ENTITY_CONFIGS", () => {
  it("has a positive per-group result cap", () => {
    expect(RESULTS_PER_GROUP).toBeGreaterThan(0);
  });

  it("uses a unique kind for every entity", () => {
    const kinds = SEARCH_ENTITY_CONFIGS.map((c) => c.kind);
    expect(new Set(kinds).size).toBe(kinds.length);
  });

  it("declares at least one text search column per entity", () => {
    for (const config of SEARCH_ENTITY_CONFIGS) {
      expect(config.searchColumns.length).toBeGreaterThan(0);
    }
  });

  it("builds project-scoped URLs that include both the project id and record id", () => {
    for (const config of SEARCH_ENTITY_CONFIGS) {
      const url = config.buildUrl("rec-1", 42);
      expect(url.startsWith("/")).toBe(true);
      if (config.projectScoped) {
        expect(url).toContain("/42/");
        expect(url).toContain("rec-1");
      }
    }
  });

  it("builds global (non-project) URLs without needing a project id", () => {
    const globalConfigs = SEARCH_ENTITY_CONFIGS.filter((c) => !c.projectScoped);
    expect(globalConfigs.length).toBeGreaterThan(0);
    for (const config of globalConfigs) {
      const url = config.buildUrl("abc", null);
      expect(url).toContain("abc");
      expect(url).not.toContain("null");
    }
  });
});
