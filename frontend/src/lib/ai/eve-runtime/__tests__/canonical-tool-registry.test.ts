import {
  AmbiguousProjectResolutionError,
  createCanonicalToolRegistry,
  defineCanonicalTool,
  InvalidCanonicalToolDefinitionError,
  InvalidResolvedProjectError,
  ProjectNotFoundResolutionError,
  type CanonicalToolDefinition,
  type EveToolSurface,
  type ProjectResolution,
} from "../canonical-tool-registry";

function aiTool(description: string) {
  return {
    description,
    inputSchema: { type: "object", properties: {} },
    execute: jest.fn(),
  };
}

function toolDefinition(
  overrides: Partial<CanonicalToolDefinition> & { name: string },
): CanonicalToolDefinition {
  const effect = overrides.effect ?? "read";
  return defineCanonicalTool({
    name: overrides.name,
    description: overrides.description ?? `${overrides.name} description`,
    tool: overrides.tool ?? aiTool(overrides.name),
    effect,
    owningService: overrides.owningService ?? "project-intelligence",
    requiredPermissions: overrides.requiredPermissions ?? [],
    approvalRequirement:
      overrides.approvalRequirement ?? (effect === "read" ? "none" : "user"),
    allowedSurfaces:
      overrides.allowedSurfaces ?? ["ai_assistant", "ask_alleato"],
    runtimeAvailability: overrides.runtimeAvailability ?? {
      providers: ["openai", "anthropic"],
    },
    requiresProjectScope: overrides.requiresProjectScope ?? false,
    sourceFamily: overrides.sourceFamily ?? "alleato_database",
  });
}

function requestContext({
  surface = "ai_assistant",
  provider = "openai",
  permissions = [],
  project = { status: "resolved", projectId: 42 },
}: {
  surface?: EveToolSurface;
  provider?: string;
  permissions?: string[];
  project?: ProjectResolution;
} = {}) {
  return {
    actor: {
      id: "user-123",
      permissions: new Set(permissions),
    },
    surface,
    provider,
    project,
  };
}

describe("Eve canonical request-scoped tool registry", () => {
  it("derives identical advertised and executable names from one filtered catalog", () => {
    const registry = createCanonicalToolRegistry([
      toolDefinition({ name: "portfolioSummary" }),
      toolDefinition({
        name: "projectForecast",
        requiresProjectScope: true,
      }),
    ]);

    const catalog = registry.forRequest(requestContext());

    expect(catalog.advertisedNames).toEqual([
      "portfolioSummary",
      "projectForecast",
    ]);
    expect(catalog.executableNames).toEqual(catalog.advertisedNames);
    expect(Object.keys(catalog.advertisedTools)).toEqual(
      Object.keys(catalog.executableTools),
    );
    expect(catalog.advertisedTools.projectForecast).toBe(
      catalog.executableTools.projectForecast,
    );
  });

  it("gives Ask Alleato a smaller read-only catalog", () => {
    const registry = createCanonicalToolRegistry([
      toolDefinition({ name: "askPortfolioSummary" }),
      toolDefinition({
        name: "assistantOnlyRead",
        allowedSurfaces: ["ai_assistant"],
      }),
      toolDefinition({
        name: "updateProject",
        effect: "write",
        approvalRequirement: "user",
      }),
    ]);

    const assistant = registry.forRequest(requestContext());
    const askAlleato = registry.forRequest(
      requestContext({ surface: "ask_alleato" }),
    );

    expect(assistant.executableNames).toEqual([
      "askPortfolioSummary",
      "assistantOnlyRead",
      "updateProject",
    ]);
    expect(askAlleato.executableNames).toEqual(["askPortfolioSummary"]);
    expect(askAlleato.entries.every((entry) => entry.effect === "read")).toBe(
      true,
    );
  });

  it("removes tools unavailable for the active provider", () => {
    const registry = createCanonicalToolRegistry([
      toolDefinition({
        name: "openAiSearch",
        runtimeAvailability: { providers: ["openai"] },
      }),
      toolDefinition({
        name: "anthropicSearch",
        runtimeAvailability: { providers: ["anthropic"] },
      }),
    ]);

    expect(
      registry.forRequest(requestContext({ provider: "openai" }))
        .executableNames,
    ).toEqual(["openAiSearch"]);
  });

  it("removes tools when the actor lacks any required permission", () => {
    const registry = createCanonicalToolRegistry([
      toolDefinition({
        name: "financialForecast",
        requiredPermissions: ["financials.read", "projects.read"],
      }),
    ]);

    expect(
      registry.forRequest(
        requestContext({ permissions: ["financials.read"] }),
      ).executableNames,
    ).toEqual([]);
    expect(
      registry.forRequest(
        requestContext({
          permissions: ["financials.read", "projects.read"],
        }),
      ).executableNames,
    ).toEqual(["financialForecast"]);
  });

  it.each([
    [{ status: "ambiguous", candidateProjectIds: [42, 43] }, AmbiguousProjectResolutionError],
    [{ status: "not_found", query: "Unknown project" }, ProjectNotFoundResolutionError],
  ] as const)(
    "omits and blocks project tools when resolution is %s",
    (project, expectedError) => {
      const registry = createCanonicalToolRegistry([
        toolDefinition({ name: "portfolioSummary" }),
        toolDefinition({
          name: "projectForecast",
          requiresProjectScope: true,
        }),
      ]);

      const catalog = registry.forRequest(requestContext({ project }));

      expect(catalog.executableNames).toEqual(["portfolioSummary"]);
      expect(() => catalog.getExecutableTool("projectForecast")).toThrow(
        expectedError,
      );
    },
  );

  it.each([0, -1, 1.5, Number.NaN])(
    "forbids invalid resolved project ID %s",
    (projectId) => {
      const registry = createCanonicalToolRegistry([
        toolDefinition({
          name: "projectForecast",
          requiresProjectScope: true,
        }),
      ]);

      expect(() =>
        registry.forRequest(
          requestContext({
            project: { status: "resolved", projectId },
          }),
        ),
      ).toThrow(InvalidResolvedProjectError);
    },
  );

  it("requires approval metadata for write and external-delivery tools", () => {
    expect(() =>
      createCanonicalToolRegistry([
        toolDefinition({
          name: "updateProject",
          effect: "write",
          approvalRequirement: "none",
        }),
      ]),
    ).toThrow(InvalidCanonicalToolDefinitionError);

    expect(() =>
      createCanonicalToolRegistry([
        toolDefinition({
          name: "sendEmail",
          effect: "external_delivery",
          approvalRequirement: "none",
        }),
      ]),
    ).toThrow(InvalidCanonicalToolDefinitionError);
  });

  it("adapts an existing AI SDK-style tool without wrapping its implementation", () => {
    const productionTool = aiTool("Existing production implementation");
    const registry = createCanonicalToolRegistry([
      toolDefinition({
        name: "existingProductionTool",
        tool: productionTool,
      }),
    ]);

    const catalog = registry.forRequest(requestContext());

    expect(catalog.entries[0]?.tool).toBe(productionTool);
    expect(catalog.entries[0]?.inputSchema).toBe(productionTool.inputSchema);
    expect(catalog.getExecutableTool("existingProductionTool")).toBe(
      productionTool,
    );
  });
});
