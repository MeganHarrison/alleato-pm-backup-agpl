/**
 * Contract specs for the AI assistant's READ/query tools.
 *
 * A read tool "works" when it executes without throwing, returns a well-shaped
 * result, and does NOT return an `{ error }` object — a surfaced error means the
 * tool's query failed (nonexistent table, broken RPC, etc.).
 *
 * The high-value extra check (the resignation-search incident class): a tool
 * must not swallow an RPC error and return empty. We catch that with TARGETED
 * non-empty assertions against projects where the data is known to exist —
 * notably semanticSearch against project 1009 (465 docs / 330 emails / 32
 * meetings). Broad "must be non-empty" is deliberately avoided: empty is a
 * legitimate result for sparsely-populated projects.
 *
 * Scope: Supabase/RAG-backed read tools. External-API tools (Acumatica ERP,
 * Tavily web search, live Outlook Graph) are out of scope here — they need a
 * separate integration test with the provider mocked.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

export type ReadFactoryKey =
  | "operational"
  | "financial"
  | "documentIntelligence"
  | "schedule"
  | "structured"
  | "project";

export type ReadSpecContext = {
  sb: SupabaseClient;
  /** Richly-populated project (docs/emails/meetings). */
  richProjectId: number;
  /** Project with structured PM data (RFIs, commitments). */
  structuredProjectId: number;
};

export type ReadToolSpec = {
  tool: string;
  factory: ReadFactoryKey;
  input: (ctx: ReadSpecContext) => Record<string, unknown>;
  /**
   * Optional targeted check: return the array the result should be non-empty
   * on. Only use where data is KNOWN to exist for the chosen project.
   */
  expectNonEmpty?: (result: Record<string, unknown>) => unknown[] | undefined;
};

const RICH = (c: ReadSpecContext) => c.richProjectId; // 1009
const STRUCT = (c: ReadSpecContext) => c.structuredProjectId; // 67

export const READ_TOOL_SPECS: ReadToolSpec[] = [
  // ---- operational.ts ----------------------------------------------------
  { tool: "getPeopleAndRoles", factory: "operational", input: (c) => ({ projectId: STRUCT(c) }) },
  { tool: "getVendorPerformance", factory: "operational", input: (c) => ({ projectId: STRUCT(c) }) },
  {
    tool: "getRFIStatus",
    factory: "operational",
    input: (c) => ({ projectId: STRUCT(c) }),
    // project 67 has RFIs — recentRFIs must be present.
    expectNonEmpty: (r) => (r.recentRFIs as unknown[]) ?? undefined,
  },
  { tool: "getSubmittalStatus", factory: "operational", input: (c) => ({ projectId: STRUCT(c) }) },
  { tool: "getCrossProjectComparison", factory: "operational", input: () => ({}) },
  { tool: "getHistoricalTrends", factory: "operational", input: (c) => ({ projectId: STRUCT(c) }) },
  {
    tool: "semanticSearch",
    factory: "operational",
    // Global query (no project filter) so the check doesn't depend on
    // per-project embedding mapping — the whole corpus must return something.
    input: () => ({ query: "project schedule and budget", matchCount: 5 }),
    // THE resignation-incident guard: a swallowed RPC error surfaces as empty.
    expectNonEmpty: (r) => (r.results as unknown[]) ?? undefined,
  },
  { tool: "getCompanyKnowledge", factory: "operational", input: () => ({ query: "lessons learned" }) },
  { tool: "recallPastConversations", factory: "operational", input: () => ({ query: "budget" }) },
  { tool: "searchMeetingsByTopic", factory: "operational", input: (c) => ({ topic: "schedule", projectId: RICH(c) }) },
  { tool: "searchMemories", factory: "operational", input: () => ({ query: "preferences" }) },
  { tool: "findProject", factory: "operational", input: () => ({ projectName: "Union Collective" }) },
  { tool: "searchEmails", factory: "operational", input: (c) => ({ query: "schedule", projectId: RICH(c) }) },
  { tool: "searchTeamsMessages", factory: "operational", input: () => ({ query: "update" }) },
  { tool: "searchExternalDocuments", factory: "operational", input: (c) => ({ query: "contract", projectId: RICH(c) }) },

  // ---- financial.ts ------------------------------------------------------
  {
    tool: "getCommitmentsOverview",
    factory: "financial",
    input: (c) => ({ projectId: STRUCT(c) }),
    expectNonEmpty: (r) => (r.commitments as unknown[]) ?? undefined,
  },
  { tool: "getChangeOrderDetails", factory: "financial", input: (c) => ({ projectId: STRUCT(c), changeOrderId: "all" }) },
  { tool: "getDirectCostsSummary", factory: "financial", input: (c) => ({ projectId: STRUCT(c) }) },
  { tool: "getBudgetLineItems", factory: "financial", input: (c) => ({ projectId: RICH(c) }) },
  { tool: "getCostTrends", factory: "financial", input: (c) => ({ projectId: STRUCT(c) }) },
  { tool: "getMarginAnalysis", factory: "financial", input: (c) => ({ projectId: STRUCT(c) }) },

  // ---- document-intelligence.ts (reads only) -----------------------------
  { tool: "getSubmittalLog", factory: "documentIntelligence", input: (c) => ({ projectId: STRUCT(c) }) },
  { tool: "getSpecRequirements", factory: "documentIntelligence", input: (c) => ({ projectId: STRUCT(c), query: "fire rating" }) },
  { tool: "detectMissingSubmittals", factory: "documentIntelligence", input: (c) => ({ projectId: STRUCT(c) }) },
  { tool: "identifySubmittalPackages", factory: "documentIntelligence", input: (c) => ({ projectId: STRUCT(c) }) },

  // ---- schedule-tools.ts -------------------------------------------------
  { tool: "getScheduleAnalysis", factory: "schedule", input: (c) => ({ projectId: STRUCT(c) }) },

  // ---- structured-queries.ts ---------------------------------------------
  {
    tool: "queryBudgetData",
    factory: "structured",
    input: (c) => ({ projectId: RICH(c) }),
    expectNonEmpty: (r) => (r.lineItems as unknown[]) ?? undefined,
  },
  { tool: "queryChangeOrders", factory: "structured", input: (c) => ({ projectId: STRUCT(c) }) },
  {
    tool: "queryCommitments",
    factory: "structured",
    input: (c) => ({ projectId: STRUCT(c) }),
    expectNonEmpty: (r) => (r.commitments as unknown[]) ?? undefined,
  },
  { tool: "queryDirectCosts", factory: "structured", input: (c) => ({ projectId: STRUCT(c) }) },
  { tool: "queryScheduleTasks", factory: "structured", input: (c) => ({ projectId: STRUCT(c) }) },
  // queryDocumentRows is deferred: it reads rows from a specific spreadsheet
  // dataset (requires a datasetId fixture), not a project — out of scope here.
  { tool: "searchStructuredFinancialRows", factory: "structured", input: (c) => ({ projectId: STRUCT(c), query: "labor" }) },

  // ---- project-tools.ts (own tools) --------------------------------------
  { tool: "getProjectBriefingSnapshot", factory: "project", input: (c) => ({ projectId: STRUCT(c) }) },
  { tool: "getPortfolioOverview", factory: "project", input: () => ({}) },
  { tool: "getProjectsWithRisks", factory: "project", input: () => ({}) },
  { tool: "getProjectRiskAnalysis", factory: "project", input: (c) => ({ projectId: STRUCT(c) }) },
  { tool: "getFinancialAnalysis", factory: "project", input: (c) => ({ projectId: STRUCT(c) }) },
  { tool: "getProjectBudgetSummary", factory: "project", input: (c) => ({ projectId: RICH(c) }) },
  { tool: "getActionItemsAndInsights", factory: "project", input: (c) => ({ projectId: STRUCT(c) }) },
  {
    tool: "getMeetingsByDate",
    factory: "project",
    input: (c) => ({ projectId: RICH(c), startDate: "2020-01-01", endDate: "2030-01-01" }),
  },
  { tool: "findProjectDocuments", factory: "project", input: (c) => ({ projectId: RICH(c) }) },
  { tool: "searchDocuments", factory: "project", input: (c) => ({ projectId: RICH(c), query: "budget" }) },
  { tool: "getProjectDetails", factory: "project", input: (c) => ({ projectId: STRUCT(c) }) },
];

/** Assert a read result is well-shaped and not a surfaced error. */
export function expectReadOk(result: unknown): asserts result is Record<string, unknown> {
  if (result === null || result === undefined) {
    throw new Error("tool returned null/undefined");
  }
  if (typeof result !== "object") {
    throw new Error(`tool returned a non-object result: ${JSON.stringify(result)}`);
  }
  const r = result as Record<string, unknown>;
  if (r.error) {
    throw new Error(`tool returned a surfaced error: ${String(r.error)}`);
  }
}
