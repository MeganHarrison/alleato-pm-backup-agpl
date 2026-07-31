import { resolveProjectLabel } from "../project-label";

jest.mock("ai", () => ({
  tool: (definition: unknown) => definition,
}));

jest.mock("../tool-utils", () => ({
  asNumber: (value: unknown) => Number(value ?? 0),
  withTrace: (
    _name: string,
    _options: unknown,
    execute: (input: unknown) => Promise<unknown>,
  ) => execute,
}));

jest.mock("@/lib/ai/insight-cards", () => ({
  RISK_CARD_TYPES: ["risk"],
  deriveSeverity: () => "low",
  resolveTargetIdsForProjects: async () => new Map(),
  insightCardBaseQuery: jest.fn(),
  sortByUrgencyDesc: (rows: unknown[]) => rows,
}));

jest.mock("@/lib/ai/data/project-repo", () => ({
  createProjectRepo: () => ({}),
  isOpenRfiStatus: () => false,
}));

for (const moduleName of [
  "../financial",
  "../acumatica",
  "../operational",
  "../schedule-tools",
  "../app-help-tools",
  "../forecast-tools",
  "../outlook-operations",
  "../sais",
  "../search-past-conversations",
]) {
  jest.mock(moduleName, () => new Proxy({}, {
    get: () => () => ({}),
  }));
}

type QueryResult = { data: unknown; error: null };

function queryFor(result: QueryResult) {
  const query = {
    select: jest.fn(),
    eq: jest.fn(),
    in: jest.fn(),
    neq: jest.fn(),
    or: jest.fn(),
    order: jest.fn(),
    limit: jest.fn(),
    single: jest.fn(async () => result),
    then: (
      resolve: (value: QueryResult) => unknown,
      reject?: (reason: unknown) => unknown,
    ) => Promise.resolve(result).then(resolve, reject),
  };
  for (const method of [
    "select",
    "eq",
    "in",
    "neq",
    "or",
    "order",
    "limit",
  ] as const) {
    query[method].mockReturnValue(query);
  }
  return query;
}

describe("project risk source labeling", () => {
  it("falls back to the persisted project name when Eve supplies an empty name", () => {
    expect(resolveProjectLabel("", "Union Collective", 1009)).toBe(
      "Union Collective",
    );
  });

  it("falls back to the project id when neither name is available", () => {
    expect(resolveProjectLabel("  ", null, 1009)).toBe("Project 1009");
  });

  it("executes getProjectRiskAnalysis and uses the persisted label in both output fields", async () => {
    const empty = { data: [], error: null } as const;
    const db = {
      from: jest.fn((table: string) =>
        queryFor(
          table === "projects"
            ? {
                data: {
                  id: 1009,
                  name: "Union Collective",
                  phase: "Current",
                },
                error: null,
              }
            : empty,
        ),
      ),
    };
    const guardrails = {
      getScopedProjectIds: jest.fn(async () => [1009]),
      enforceProjectAccess: jest.fn(async () => ({ ok: true })),
    };
    const { createProjectTools } = require("../project-tools") as typeof import("../project-tools");
    const tools = createProjectTools("test-user", {
      ctx: {
        db,
        rag: {},
        openai: {},
        guardrails,
      } as never,
    });
    const execute = (tools.getProjectRiskAnalysis as {
      execute: (input: {
        projectId: number;
        projectName: string;
      }) => Promise<Record<string, unknown>>;
    }).execute;

    const result = await execute({ projectId: 1009, projectName: "" });

    expect(result).toMatchObject({
      sourceRef: "[Source: Risk Analysis - Union Collective]",
      project: {
        id: 1009,
        name: "Union Collective",
        phase: "Current",
      },
    });
  });
});
