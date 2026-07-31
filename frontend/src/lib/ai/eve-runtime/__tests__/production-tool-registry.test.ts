jest.mock("@/lib/ai/tools/action-tools", () => ({
  createActionTools: jest.fn(),
}));
jest.mock("@/lib/ai/tools/document-intelligence", () => ({
  createDocumentIntelligenceTools: jest.fn(),
}));
jest.mock("@/lib/ai/tools/executive-brief-tools", () => ({
  createExecutiveBriefTools: jest.fn(),
}));
jest.mock("@/lib/ai/tools/feature-request-tools", () => ({
  createFeatureRequestTools: jest.fn(),
}));
jest.mock("@/lib/ai/tools/intelligence-tools", () => ({
  createIntelligenceTools: jest.fn(),
}));
jest.mock("@/lib/ai/tools/marketing", () => ({
  createMarketingTools: jest.fn(),
}));
jest.mock("@/lib/ai/tools/progress-report-tools", () => ({
  createProgressReportTools: jest.fn(),
}));
jest.mock("@/lib/ai/tools/project-tools", () => ({
  createProjectTools: jest.fn(),
}));
jest.mock("@/lib/ai/tools/structured-output", () => ({
  createStructuredOutputTools: jest.fn(),
}));
jest.mock("@/lib/ai/tools/tool-context", () => ({
  createToolContext: jest.fn(),
}));
jest.mock("@/lib/ai/tools/web-search", () => ({
  createWebSearchTools: jest.fn(),
}));
jest.mock("@/lib/ai/tools/workspace-tools", () => ({
  createWorkspaceTools: jest.fn(),
}));

import type { AiSdkStyleTool } from "../canonical-tool-registry";
import {
  assertProductionEveToolRegistryComplete,
  createProductionEveRequestCatalog,
  createProductionEveToolRegistry,
  EVE_TOOL_MANIFEST,
  NON_EVE_RUNTIME_TOOL_NAMES,
  PRODUCTION_EVE_FACTORY_MANIFESTS,
  type ProductionToolFactories,
} from "../production-tool-registry";

function aiTool(name: string): AiSdkStyleTool {
  return {
    description: `${name} production tool`,
    inputSchema: { type: "object", properties: {} },
    execute: jest.fn(),
  };
}

function completeFactories(
  overrides: Partial<Record<string, AiSdkStyleTool>> = {},
): ProductionToolFactories {
  return Object.fromEntries(
    PRODUCTION_EVE_FACTORY_MANIFESTS.map((factory) => [
      factory.id,
      () =>
        Object.fromEntries(
          factory.tools.map((entry) => [
            entry.name,
            overrides[entry.name] ?? aiTool(entry.name),
          ]),
        ),
    ]),
  ) as ProductionToolFactories;
}

const fakeToolContext = {} as never;

describe("Eve production tool registry adapter", () => {
  it("owns exactly 131 Eve tools and keeps ASRS tools outside this runtime", () => {
    expect(EVE_TOOL_MANIFEST).toHaveLength(131);
    expect(new Set(EVE_TOOL_MANIFEST.map((entry) => entry.name)).size).toBe(
      131,
    );
    expect(NON_EVE_RUNTIME_TOOL_NAMES).toEqual([
      "searchFmds2026Evidence",
      "evaluateFmds2026Configuration",
    ]);
    for (const name of NON_EVE_RUNTIME_TOOL_NAMES) {
      expect(EVE_TOOL_MANIFEST.some((entry) => entry.name === name)).toBe(
        false,
      );
    }
  });

  it("adapts every target tool directly from its existing factory without copying implementations", () => {
    const getProjectDetails = aiTool("getProjectDetails");
    const result = createProductionEveToolRegistry({
      userId: "user-123",
      project: { status: "resolved", projectId: 42 },
      provider: "openai",
      toolContext: fakeToolContext,
      toolFactories: completeFactories({ getProjectDetails }),
    });

    expect(result.report).toMatchObject({
      targetCount: 131,
      registeredCount: 131,
      blockedCount: 0,
      unexpectedCount: 0,
      complete: true,
    });
    expect(result.registry.entries).toHaveLength(131);
    expect(
      result.registry.entries.find(
        (entry) => entry.name === "getProjectDetails",
      )?.tool,
    ).toBe(getProjectDetails);
    expect(
      result.registry.entries.some(
        (entry) => entry.name === "searchFmds2026Evidence",
      ),
    ).toBe(false);
  });

  it("fails loudly with a typed blocker when a real factory omits an expected tool", () => {
    const factories = completeFactories();
    factories.project = () =>
      Object.fromEntries(
        PRODUCTION_EVE_FACTORY_MANIFESTS.find(
          (entry) => entry.id === "project",
        )!.tools.filter((entry) => entry.name !== "getProjectDetails")
          .map((entry) => [entry.name, aiTool(entry.name)]),
      );

    const result = createProductionEveToolRegistry({
      userId: "user-123",
      project: { status: "resolved", projectId: 42 },
      provider: "openai",
      toolContext: fakeToolContext,
      toolFactories: factories,
    });

    expect(result.report).toMatchObject({
      registeredCount: 130,
      blockedCount: 1,
      complete: false,
    });
    expect(result.report.blocked).toEqual([
      expect.objectContaining({
        name: "getProjectDetails",
        factoryId: "project",
        reason: "factory_did_not_return_expected_tool",
      }),
    ]);
    expect(() =>
      assertProductionEveToolRegistryComplete(result.report),
    ).toThrow(
      "130/131 tools registered",
    );
  });

  it("does not advertise unmanifested or specialist tools returned by a factory", () => {
    const factories = completeFactories();
    const projectFactory = factories.project;
    factories.project = (request) => ({
      ...projectFactory(request),
      unmanifestedTool: aiTool("unmanifestedTool"),
      searchFmds2026Evidence: aiTool("searchFmds2026Evidence"),
    });

    const result = createProductionEveToolRegistry({
      userId: "user-123",
      project: { status: "resolved", projectId: 42 },
      provider: "openai",
      toolContext: fakeToolContext,
      toolFactories: factories,
    });

    expect(result.report.complete).toBe(false);
    expect(result.report.unexpectedFactoryTools).toEqual([
      { factoryId: "project", name: "unmanifestedTool" },
      { factoryId: "project", name: "searchFmds2026Evidence" },
    ]);
    expect(
      result.registry.entries.some(
        (entry) =>
          entry.name === "unmanifestedTool" ||
          entry.name === "searchFmds2026Evidence",
      ),
    ).toBe(false);
  });

  it("keeps writes approval-gated and hidden until request policy allows them", () => {
    const input = {
      userId: "user-123",
      project: { status: "resolved" as const, projectId: 42 },
      provider: "openai",
      toolContext: fakeToolContext,
      toolFactories: completeFactories(),
    };
    const readOnly = createProductionEveRequestCatalog(input);
    const writable = createProductionEveRequestCatalog({
      ...input,
      allowWrites: true,
      allowDelivery: true,
    });

    expect(readOnly.catalog.executableNames).toContain("getProjectDetails");
    expect(readOnly.catalog.executableNames).not.toContain("createRFI");
    expect(readOnly.catalog.executableNames).not.toContain("sendTeamsMessage");
    expect(writable.catalog.executableNames).toContain("createRFI");
    expect(writable.catalog.executableNames).toContain("sendTeamsMessage");
    expect(
      writable.registry.entries.find((entry) => entry.name === "createRFI"),
    ).toMatchObject({
      effect: "write",
      approvalRequirement: "user",
    });
    expect(
      writable.registry.entries.find(
        (entry) => entry.name === "sendTeamsMessage",
      ),
    ).toMatchObject({
      effect: "external_delivery",
      approvalRequirement: "user",
    });
  });

  it("gives Ask Alleato a smaller read-only catalog from the same registry", () => {
    const result = createProductionEveRequestCatalog({
      userId: "user-123",
      project: { status: "resolved", projectId: 42 },
      provider: "openai",
      surface: "ask_alleato",
      toolContext: fakeToolContext,
      toolFactories: completeFactories(),
      allowWrites: true,
      allowDelivery: true,
    });

    expect(result.catalog.executableNames).toContain("getProjectDetails");
    expect(result.catalog.executableNames).toContain("semanticSearch");
    expect(result.catalog.executableNames.length).toBeGreaterThan(0);
    expect(result.catalog.executableNames.length).toBeLessThan(
      result.report.registeredCount,
    );
    expect(
      result.catalog.entries.every(
        (entry) =>
          entry.effect === "read" &&
          entry.approvalRequirement === "none",
      ),
    ).toBe(true);
    expect(result.catalog.executableNames).not.toContain("createRFI");
    expect(result.catalog.executableNames).not.toContain("sendTeamsMessage");
  });

  it("advertises only unscoped resolution tools until a project is resolved", () => {
    const result = createProductionEveRequestCatalog({
      userId: "user-123",
      project: { status: "not_found" },
      provider: "openai",
      surface: "ai_assistant",
      toolContext: fakeToolContext,
      toolFactories: completeFactories(),
    });

    expect(result.catalog.executableNames).toContain("findProject");
    expect(result.catalog.executableNames).toContain("getPortfolioOverview");
    expect(result.catalog.executableNames).not.toContain("getProjectDetails");
    expect(result.catalog.executableNames).not.toContain("getBudgetLineItems");
  });
});
