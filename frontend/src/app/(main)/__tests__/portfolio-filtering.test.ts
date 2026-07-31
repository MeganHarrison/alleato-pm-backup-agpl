import {
  getDefaultPortfolioFilters,
  getPortfolioScope,
  matchesPortfolioFilters,
  matchesPortfolioScope,
} from "../portfolio-filtering";

const params = (query: Record<string, string>) => ({
  get: (name: string) => query[name] ?? null,
});

describe("getPortfolioScope", () => {
  it("defaults to the all scope when the param is missing", () => {
    expect(getPortfolioScope(null)).toBe("all");
  });

  it("defaults to the all scope for unrecognized values", () => {
    expect(getPortfolioScope("bogus")).toBe("all");
    expect(getPortfolioScope("")).toBe("all");
  });

  it("keeps the named scopes", () => {
    expect(getPortfolioScope("client")).toBe("client");
    expect(getPortfolioScope("estimating")).toBe("estimating");
    expect(getPortfolioScope("internal")).toBe("internal");
  });
});

describe("getDefaultPortfolioFilters", () => {
  it("applies no filters when the URL has none", () => {
    expect(getDefaultPortfolioFilters(params({}))).toEqual({
      client: undefined,
      phase: undefined,
      category: undefined,
    });
  });

  // Regression guard: a hidden `phase: "Current"` default once reduced the
  // Company page from 114 visible projects to 2 with no UI way to clear it.
  it("never defaults the phase filter", () => {
    expect(getDefaultPortfolioFilters(params({})).phase).toBeUndefined();
  });

  it("honors explicit URL filter params", () => {
    const filters = getDefaultPortfolioFilters(
      params({ client: "440 West Inc.", phase: "Current", category: "New Build" }),
    );
    expect(filters).toEqual({
      client: "440 West Inc.",
      phase: "Current",
      category: "New Build",
    });
  });
});

describe("matchesPortfolioScope", () => {
  const currentClient = { phase: "Current", type: "General" };
  const developmentProject = { phase: "Development", type: "General" };
  const noPhaseProject = { phase: null, type: "General" };
  const internalCurrent = { phase: "Current", type: "Internal" };
  const internalNoPhase = { phase: null, type: "Internal" };
  const internalDevelopment = { phase: "Development", type: "Internal" };
  const internalByCategory = { phase: "Current", type: null, category: "Internal" };
  const estimatingProject = { phase: "Estimating", type: "General" };

  it("all scope shows every project, including projects with no phase", () => {
    for (const project of [
      currentClient,
      developmentProject,
      noPhaseProject,
      internalCurrent,
      estimatingProject,
    ]) {
      expect(matchesPortfolioScope(project, "all")).toBe(true);
    }
  });

  it("client scope shows only current, non-internal projects", () => {
    expect(matchesPortfolioScope(currentClient, "client")).toBe(true);
    expect(matchesPortfolioScope(developmentProject, "client")).toBe(false);
    expect(matchesPortfolioScope(internalCurrent, "client")).toBe(false);
    expect(matchesPortfolioScope(noPhaseProject, "client")).toBe(false);
    expect(matchesPortfolioScope(estimatingProject, "client")).toBe(false);
  });

  it("estimating scope shows only estimating-phase projects", () => {
    expect(matchesPortfolioScope(estimatingProject, "estimating")).toBe(true);
    expect(matchesPortfolioScope(currentClient, "estimating")).toBe(false);
    expect(matchesPortfolioScope(noPhaseProject, "estimating")).toBe(false);
  });

  it("internal scope matches type OR category === internal, regardless of phase", () => {
    expect(matchesPortfolioScope(internalCurrent, "internal")).toBe(true);
    expect(matchesPortfolioScope(internalNoPhase, "internal")).toBe(true);
    expect(matchesPortfolioScope(internalDevelopment, "internal")).toBe(true);
    expect(matchesPortfolioScope(internalByCategory, "internal")).toBe(true);
    expect(matchesPortfolioScope(currentClient, "internal")).toBe(false);
    expect(matchesPortfolioScope(noPhaseProject, "internal")).toBe(false);
  });

  it("a category-internal project is excluded from the client tab", () => {
    expect(matchesPortfolioScope(internalByCategory, "client")).toBe(false);
  });

  it("matches phase and type case-insensitively", () => {
    expect(matchesPortfolioScope({ phase: "current", type: "GENERAL" }, "client")).toBe(true);
    expect(matchesPortfolioScope({ phase: "Development", type: "internal" }, "internal")).toBe(true);
  });
});

describe("matchesPortfolioFilters", () => {
  const project = {
    client: "440 West Inc.",
    phase: "Development",
    category: "New Build",
  };

  it("matches everything when no filters are set", () => {
    expect(matchesPortfolioFilters(project, {})).toBe(true);
    expect(
      matchesPortfolioFilters(project, {
        client: undefined,
        phase: undefined,
        category: undefined,
      }),
    ).toBe(true);
  });

  it("filters by phase case-insensitively", () => {
    expect(matchesPortfolioFilters(project, { phase: "development" })).toBe(true);
    expect(matchesPortfolioFilters(project, { phase: "Current" })).toBe(false);
  });

  it("projects with no phase do not match a phase filter", () => {
    expect(
      matchesPortfolioFilters({ ...project, phase: null }, { phase: "Current" }),
    ).toBe(false);
  });

  it("requires all active filters to match", () => {
    expect(
      matchesPortfolioFilters(project, { client: "440 West Inc.", phase: "Development" }),
    ).toBe(true);
    expect(
      matchesPortfolioFilters(project, { client: "440 West Inc.", phase: "Current" }),
    ).toBe(false);
  });
});
