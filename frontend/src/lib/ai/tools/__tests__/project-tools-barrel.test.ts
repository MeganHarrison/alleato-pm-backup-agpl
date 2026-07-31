/**
 * Barrel completeness regression test for PR #294.
 *
 * This test guards against the primary failure mode of the decomposition:
 * a tool being silently dropped from the AI assistant due to a broken spread,
 * name collision, or missing factory call in project-tools.ts.
 *
 * If any of these tool names disappear from createProjectTools() output, this
 * test will fail loudly before the change reaches production.
 */

// Mock heavy dependencies so we can import the barrel without a real DB
const mockDbClient = () => ({
  from: jest.fn().mockReturnValue({
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    in: jest.fn().mockReturnThis(),
    not: jest.fn().mockReturnThis(),
    is: jest.fn().mockReturnThis(),
    ilike: jest.fn().mockReturnThis(),
    order: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    single: jest.fn().mockResolvedValue({ data: null, error: null }),
    maybeSingle: jest.fn().mockResolvedValue({ data: null, error: null }),
  }),
  rpc: jest.fn().mockResolvedValue({ data: [], error: null }),
});
jest.mock("@/lib/supabase/service", () => ({
  createServiceClient: mockDbClient,
  createRagServiceClient: mockDbClient,
}));

const mockGuardrails = () => ({
  getScopedProjectIds: jest.fn().mockResolvedValue([67]),
  pinnedProjectId: undefined,
  enforceProjectAccess: jest.fn().mockResolvedValue({ ok: true }),
  getScope: jest.fn().mockResolvedValue({ isAdmin: false, allowedProjectIds: [67] }),
});

jest.mock("../guardrails", () => ({
  createToolGuardrails: mockGuardrails,
}));

// Mock createToolContext so barrel tests don't need a real OpenAI key or RAG client.
jest.mock("../tool-context", () => ({
  createToolContext: (_input: unknown) => ({
    db: jest.requireMock("@/lib/supabase/service").createServiceClient(),
    rag: jest.requireMock("@/lib/supabase/service").createRagServiceClient(),
    openai: {},
    guardrails: mockGuardrails(),
  }),
  createFakeToolContext: jest.fn(),
}));

jest.mock("../acumatica", () => ({
  createAcumaticaTools: () => ({
    getVendorAging: { description: "mock", inputSchema: {}, execute: jest.fn() },
    getCashPosition: { description: "mock", inputSchema: {}, execute: jest.fn() },
  }),
}));

// Mock operational.ts to avoid heavy import chain during barrel test
jest.mock("../operational", () => ({
  createOperationalTools: () => ({
    semanticSearch: { description: "mock", inputSchema: {}, execute: jest.fn() },
    search_conversation_memories: { description: "mock", inputSchema: {}, execute: jest.fn() },
    searchMeetingsByTopic: { description: "mock", inputSchema: {}, execute: jest.fn() },
    writeMemory: { description: "mock", inputSchema: {}, execute: jest.fn() },
  }),
}));

jest.mock("../outlook-operations", () => ({
  createOutlookOperationsTools: () => ({
    getOutlookOperationsStatus: { description: "mock", inputSchema: {}, execute: jest.fn() },
    getOutlookCalendarEvents: { description: "mock", inputSchema: {}, execute: jest.fn() },
  }),
}));

import {
  buildDocumentLookupFallbackTerms,
  buildDocumentLookupOrFilter,
  createProjectTools,
  shouldFallbackToPsrLookup,
} from "../project-tools";

// Tools that were extracted into new modules in this PR — these are the most
// likely to be accidentally dropped from the barrel
const EXTRACTED_TOOLS = [
  "getScheduleAnalysis",   // → schedule-tools.ts
  "searchAppHelp",         // → app-help-tools.ts
  "getForecastComparison", // → forecast-tools.ts
];

// Core tools that must always be present in the barrel
const CORE_TOOLS = [
  // project-tools.ts own tools
  "getProjectBriefingSnapshot",
  "getPortfolioOverview",
  "getProjectsWithRisks",
  "getProjectRiskAnalysis",
  "getFinancialAnalysis",
  "getProjectBudgetSummary",
  "getActionItemsAndInsights",
  "getMeetingsByDate",
  "getOutlookOperationsStatus",
  "getOutlookCalendarEvents",
  "searchPastConversations",
  "searchDocuments",
  "getProjectDetails",
  // financial module
  "getCommitmentsOverview",
  "getChangeOrderDetails",
  "getDirectCostsSummary",
  "getBudgetLineItems",
];

describe("createProjectTools barrel (#294 regression)", () => {
  let tools: ReturnType<typeof createProjectTools>;

  beforeEach(() => {
    tools = createProjectTools("test-user-id", { pinnedProjectId: 67 });
  });

  it("exports all tools extracted into new modules (primary regression guard)", () => {
    const actualNames = Object.keys(tools);
    for (const name of EXTRACTED_TOOLS) {
      expect(actualNames).toContain(name);
    }
  });

  it("exports all core project-tools.ts tools", () => {
    const actualNames = Object.keys(tools);
    for (const name of CORE_TOOLS) {
      expect(actualNames).toContain(name);
    }
  });

  it("all extracted tools are callable (have an execute function)", () => {
    for (const name of EXTRACTED_TOOLS) {
      const t = tools[name as keyof typeof tools] as { execute?: unknown } | undefined;
      expect(typeof t?.execute).toBe("function");
    }
  });

  it("flags PSR-style document lookups for fallback search", () => {
    expect(
      shouldFallbackToPsrLookup({
        category: "financial_document",
      }),
    ).toBe(true);
    expect(
      shouldFallbackToPsrLookup({
        titleKeyword: "PSR",
      }),
    ).toBe(true);
    expect(
      shouldFallbackToPsrLookup({
        documentType: "executed_contract",
        titleKeyword: "PSR",
      }),
    ).toBe(false);
  });

  it("includes source_path in PSR fallback filters", () => {
    const terms = buildDocumentLookupFallbackTerms({
      category: "financial_document",
      titleKeyword: "Project Status Report",
    });
    expect(terms).toEqual(
      expect.arrayContaining(["Project Status Report", "PSR"]),
    );
    expect(buildDocumentLookupOrFilter(terms)).toContain(
      "source_path.ilike.%PSR%",
    );
  });
});
