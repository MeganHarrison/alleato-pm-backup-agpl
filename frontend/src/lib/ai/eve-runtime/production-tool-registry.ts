import { createActionTools } from "@/lib/ai/tools/action-tools";
import { createDocumentIntelligenceTools } from "@/lib/ai/tools/document-intelligence";
import { createExecutiveBriefTools } from "@/lib/ai/tools/executive-brief-tools";
import { createFeatureRequestTools } from "@/lib/ai/tools/feature-request-tools";
import { createIntelligenceTools } from "@/lib/ai/tools/intelligence-tools";
import { createMarketingTools } from "@/lib/ai/tools/marketing";
import { createProgressReportTools } from "@/lib/ai/tools/progress-report-tools";
import { createProjectTools } from "@/lib/ai/tools/project-tools";
import { createStructuredOutputTools } from "@/lib/ai/tools/structured-output";
import {
  createToolContext,
  type ToolContext,
} from "@/lib/ai/tools/tool-context";
import { createWebSearchTools } from "@/lib/ai/tools/web-search";
import { createWorkspaceTools } from "@/lib/ai/tools/workspace-tools";

import {
  createCanonicalToolRegistry,
  type AiSdkStyleTool,
  type ApprovalRequirement,
  type CanonicalToolDefinition,
  type CanonicalToolRegistry,
  type EveToolSurface,
  type ProjectResolution,
  type RequestScopedToolCatalog,
  type SourceFamily,
  type ToolEffectClass,
} from "./canonical-tool-registry";

export const EVE_READ_PERMISSION = "ai_assistant.tools.read";
export const EVE_WRITE_PERMISSION = "ai_assistant.tools.write";
export const EVE_DELIVERY_PERMISSION = "ai_assistant.tools.deliver";

export type ProductionToolFactoryId =
  | "project"
  | "action"
  | "web_search"
  | "structured_output"
  | "feature_request"
  | "progress_report"
  | "workspace"
  | "document_intelligence"
  | "intelligence"
  | "executive_brief"
  | "marketing";

export interface ProductionToolManifestEntry {
  name: string;
  factoryId: ProductionToolFactoryId;
  effect: ToolEffectClass;
  approvalRequirement: ApprovalRequirement;
  requiresProjectScope: boolean;
  sourceFamily: SourceFamily;
}

export interface ProductionToolFactoryManifest {
  id: ProductionToolFactoryId;
  modulePath: string;
  exportName: string;
  tools: readonly ProductionToolManifestEntry[];
}

export type ProductionToolBlockReason =
  | "factory_initialization_failed"
  | "factory_did_not_return_expected_tool"
  | "invalid_tool_shape";

export interface BlockedProductionTool {
  name: string;
  factoryId: ProductionToolFactoryId;
  reason: ProductionToolBlockReason;
  detail: string;
}

export interface ProductionToolRegistryReport {
  targetCount: number;
  registeredCount: number;
  blockedCount: number;
  unexpectedCount: number;
  complete: boolean;
  registeredNames: readonly string[];
  blocked: readonly BlockedProductionTool[];
  unexpectedFactoryTools: readonly {
    name: string;
    factoryId: ProductionToolFactoryId;
  }[];
}

type ProductionToolSet = Record<string, AiSdkStyleTool>;
type ProductionFactory = (
  input: ProductionToolFactoryRequest,
) => ProductionToolSet;

export type ProductionToolFactories = Record<
  ProductionToolFactoryId,
  ProductionFactory
>;

export interface ProductionToolFactoryRequest {
  userId: string;
  pinnedProjectId?: number;
  sessionId?: string;
  toolContext: ToolContext;
  onTrace?: (trace: {
    tool: string;
    input: Record<string, unknown>;
    output?: unknown;
    error?: string;
    timestamp: string;
  }) => void;
}

export interface CreateProductionEveRegistryInput {
  userId: string;
  project: ProjectResolution;
  provider: string;
  sessionId?: string;
  toolContext?: ToolContext;
  toolFactories?: Partial<ProductionToolFactories>;
  onTrace?: ProductionToolFactoryRequest["onTrace"];
}

export interface CreateProductionEveCatalogInput
  extends CreateProductionEveRegistryInput {
  surface?: EveToolSurface;
  actorPermissions?: Iterable<string>;
  allowWrites?: boolean;
  allowDelivery?: boolean;
}

export interface ProductionEveRegistryResult {
  registry: CanonicalToolRegistry;
  report: ProductionToolRegistryReport;
}

export interface ProductionEveCatalogResult
  extends ProductionEveRegistryResult {
  catalog: RequestScopedToolCatalog;
}

const write = new Set<string>([
  "saveToKnowledgeBase",
  "saveInsight",
  "writeMemory",
  "captureFeatureRequestPacket",
  "captureIdeaItem",
  "updateFeatureRequestPacket",
  "generateImplementationPlan",
  "generateClaudeCodeHandoff",
  "draftLinearIssueFromFeatureRequest",
  "draftLinearSubIssuesFromImplementationPlan",
  "attachLinearIssueToFeatureRequest",
  "attachLinearSubIssueToFeatureRequest",
  "recordLinearStatusUpdateForFeatureRequest",
  "createWeeklyProgressReportDraft",
  "updateProgressReportSections",
  "selectProgressReportPhotos",
  "generateProgressReportPdf",
  "saveWorkspaceArtifact",
  "promoteWorkspaceArtifact",
  "logFeedback",
  "reviewDocument",
  "createMarketingIntelligenceItem",
  "createMarketingIntelligenceFromCandidate",
  "createContentCalendarDraft",
  "createMarketingContentAsset",
]);

const delivery = new Set<string>([
  "createOutlookCalendarInvite",
  "draftOutlookEmail",
  "sendTeamsMessage",
]);

const projectScopedActionTools = new Set<string>([
  "createInitiativeCard",
  "createOutlookCalendarInvite",
]);

const askAlleatoReadTools = new Set<string>([
  "findProject",
  "getProjectDetails",
  "getProjectBriefingSnapshot",
  "getPortfolioOverview",
  "getProjectsWithRisks",
  "getProjectRiskAnalysis",
  "getFinancialAnalysis",
  "getScheduleAnalysis",
  "getPeopleAndRoles",
  "getRFIStatus",
  "getSubmittalStatus",
  "semanticSearch",
  "getCompanyKnowledge",
  "searchMeetingsByTopic",
  "getMeetingDetails",
  "findProjectDocuments",
  "searchDocuments",
]);

const unscopedProjectTools = new Set<string>([
  "getAcumaticaProjectList",
  "getCrossProjectComparison",
  "getHistoricalTrends",
  "getCompanyKnowledge",
  "recallPastConversations",
  "searchPastConversations",
  "findProject",
  "searchAppHelp",
  "findAppPage",
  "getOutlookOperationsStatus",
  "getSopBacklog",
  "getFinanceSpendRollup",
  "getPortfolioOverview",
  "getProjectsWithRisks",
  "getImplementationStatus",
]);

function effectFor(name: string, factoryId: ProductionToolFactoryId) {
  if (factoryId === "action") {
    return delivery.has(name) ? "external_delivery" : "write";
  }
  return write.has(name) ? "write" : "read";
}

function sourceFamilyFor(
  name: string,
  factoryId: ProductionToolFactoryId,
): SourceFamily {
  if (factoryId === "web_search") return "external_service";
  if (factoryId === "document_intelligence") return "documents";
  if (factoryId === "executive_brief") return "documents";
  if (
    name.toLowerCase().includes("email") ||
    name.toLowerCase().includes("outlook")
  ) {
    return "email";
  }
  if (name.toLowerCase().includes("meeting")) return "meetings";
  if (
    name.toLowerCase().includes("document") ||
    name.toLowerCase().includes("semantic") ||
    name.toLowerCase().includes("spec")
  ) {
    return "documents";
  }
  return "alleato_database";
}

function manifest(
  id: ProductionToolFactoryId,
  modulePath: string,
  exportName: string,
  names: readonly string[],
  options: { requiresProjectScope?: boolean } = {},
): ProductionToolFactoryManifest {
  return {
    id,
    modulePath,
    exportName,
    tools: names.map((name) => {
      const effect = effectFor(name, id);
      return {
        name,
        factoryId: id,
        effect,
        approvalRequirement: effect === "read" ? "none" : "user",
        requiresProjectScope:
          id === "action"
            ? projectScopedActionTools.has(name)
            : id === "project"
              ? !unscopedProjectTools.has(name)
              : (options.requiresProjectScope ?? false),
        sourceFamily: sourceFamilyFor(name, id),
      };
    }),
  };
}

const PROJECT_TOOL_NAMES = [
  "getCommitmentsOverview",
  "getChangeOrderDetails",
  "getDirectCostsSummary",
  "getBudgetLineItems",
  "getCostTrends",
  "getMarginAnalysis",
  "getAPAgingReport",
  "getARAgingReport",
  "getCashPositionReport",
  "getVendorSpendReport",
  "getRecentBills",
  "getRecentInvoices",
  "getAcumaticaProjectBudget",
  "getAcumaticaProjectList",
  "getPurchaseOrderSummary",
  "getPeopleAndRoles",
  "getVendorPerformance",
  "getRFIStatus",
  "getSubmittalStatus",
  "getCrossProjectComparison",
  "getHistoricalTrends",
  "semanticSearch",
  "getCompanyKnowledge",
  "recallPastConversations",
  "searchPastConversations",
  "searchMeetingsByTopic",
  "getMeetingDetails",
  "saveToKnowledgeBase",
  "saveInsight",
  "searchMemories",
  "writeMemory",
  "findProject",
  "getRecentEmails",
  "searchEmails",
  "searchTeamsMessages",
  "searchExternalDocuments",
  "queryBudgetData",
  "queryChangeOrders",
  "queryCommitments",
  "queryDirectCosts",
  "queryScheduleTasks",
  "queryDocumentRows",
  "searchStructuredFinancialRows",
  "getScheduleAnalysis",
  "searchAppHelp",
  "findAppPage",
  "getForecastComparison",
  "getOutlookOperationsStatus",
  "getOutlookCalendarEvents",
  "getSopBacklog",
  "getFinanceSpendRollup",
  "getProjectBriefingSnapshot",
  "getPortfolioOverview",
  "getProjectsWithRisks",
  "getProjectRiskAnalysis",
  "getFinancialAnalysis",
  "getProjectBudgetSummary",
  "getActionItemsAndInsights",
  "getMeetingsByDate",
  "findProjectDocuments",
  "searchDocuments",
  "getProjectDetails",
  "getImplementationStatus",
] as const;

const ACTION_TOOL_NAMES = [
  "createChangeOrder",
  "createChangeEvent",
  "updateProjectStatus",
  "createRFI",
  "createTask",
  "createGeneratedTask",
  "createProjectCompany",
  "createProjectContact",
  "createContact",
  "updateGeneratedTask",
  "deleteGeneratedTask",
  "flagProjectRisk",
  "updateRFIStatus",
  "createMeetingNote",
  "createSubmittal",
  "logDailyReport",
  "generateProjectSummary",
  "createInitiativeCard",
  "createCommitment",
  "createPrimeContract",
  "editPrimeContractSov",
  "submitFeedback",
  "addBoardItem",
  "createOutlookCalendarInvite",
  "draftOutlookEmail",
  "sendTeamsMessage",
  "dispatchImplementationRequest",
] as const;

export const PRODUCTION_EVE_FACTORY_MANIFESTS = [
  manifest(
    "project",
    "frontend/src/lib/ai/tools/project-tools.ts",
    "createProjectTools",
    PROJECT_TOOL_NAMES,
  ),
  manifest(
    "action",
    "frontend/src/lib/ai/tools/action-tools.ts",
    "createActionTools",
    ACTION_TOOL_NAMES,
  ),
  manifest(
    "web_search",
    "frontend/src/lib/ai/tools/web-search.ts",
    "createWebSearchTools",
    ["searchWeb", "researchCompany", "searchConstructionMarket"],
  ),
  manifest(
    "structured_output",
    "frontend/src/lib/ai/tools/structured-output.ts",
    "createStructuredOutputTools",
    ["extractStructuredActionBrief"],
  ),
  manifest(
    "feature_request",
    "frontend/src/lib/ai/tools/feature-request-tools.ts",
    "createFeatureRequestTools",
    [
      "findRelatedFeatureRequests",
      "captureFeatureRequestPacket",
      "captureIdeaItem",
      "updateFeatureRequestPacket",
      "scoreFeatureRequestReadiness",
      "generateImplementationPlan",
      "generateClaudeCodeHandoff",
      "draftLinearIssueFromFeatureRequest",
      "draftLinearSubIssuesFromImplementationPlan",
      "attachLinearIssueToFeatureRequest",
      "attachLinearSubIssueToFeatureRequest",
      "recordLinearStatusUpdateForFeatureRequest",
    ],
  ),
  manifest(
    "progress_report",
    "frontend/src/lib/ai/tools/progress-report-tools.ts",
    "createProgressReportTools",
    [
      "createWeeklyProgressReportDraft",
      "updateProgressReportSections",
      "listProgressReportPhotos",
      "selectProgressReportPhotos",
      "generateProgressReportPdf",
    ],
    { requiresProjectScope: true },
  ),
  manifest(
    "workspace",
    "frontend/src/lib/ai/tools/workspace-tools.ts",
    "createWorkspaceTools",
    [
      "listWorkspaceArtifacts",
      "getDraftArtifact",
      "saveWorkspaceArtifact",
      "promoteWorkspaceArtifact",
    ],
  ),
  manifest(
    "document_intelligence",
    "frontend/src/lib/ai/tools/document-intelligence.ts",
    "createDocumentIntelligenceTools",
    [
      "getSubmittalLog",
      "getSpecRequirements",
      "detectMissingSubmittals",
      "reviewSubmittalAgainstDrawings",
      "identifySubmittalPackages",
      "logFeedback",
      "reviewDocument",
    ],
  ),
  manifest(
    "intelligence",
    "frontend/src/lib/ai/tools/intelligence-tools.ts",
    "createIntelligenceTools",
    ["listDomainIntelligence", "getDomainIntelligence"],
  ),
  manifest(
    "executive_brief",
    "frontend/src/lib/ai/tools/executive-brief-tools.ts",
    "createExecutiveBriefTools",
    ["readCurrentDailyExecutiveBrief"],
  ),
  manifest(
    "marketing",
    "frontend/src/lib/ai/tools/marketing.ts",
    "createMarketingTools",
    [
      "findMarketingSourceCandidates",
      "createMarketingIntelligenceItem",
      "createMarketingIntelligenceFromCandidate",
      "createContentCalendarDraft",
      "createMarketingContentAsset",
      "getMarketingCalendar",
    ],
  ),
] as const satisfies readonly ProductionToolFactoryManifest[];

/**
 * ASRS owns these tools in its dedicated product runtime. They are outside the
 * Eve assistant registry and must not be introduced through a broad factory
 * spread.
 */
export const NON_EVE_RUNTIME_TOOL_NAMES = Object.freeze([
  "searchFmds2026Evidence",
  "evaluateFmds2026Configuration",
]);

export const EVE_TOOL_MANIFEST = Object.freeze(
  PRODUCTION_EVE_FACTORY_MANIFESTS.flatMap((entry) => entry.tools),
);

function defaultFactories(): ProductionToolFactories {
  return {
    project: ({ userId, pinnedProjectId, sessionId, toolContext, onTrace }) =>
      createProjectTools(userId, {
        pinnedProjectId,
        sessionId,
        ctx: toolContext,
        onTrace,
      }),
    action: ({ userId, pinnedProjectId, toolContext, onTrace }) =>
      createActionTools(userId, {
        pinnedProjectId,
        ctx: toolContext,
        onTrace,
      }),
    web_search: ({ onTrace }) => createWebSearchTools({ onTrace }),
    structured_output: ({ onTrace }) =>
      createStructuredOutputTools({ onTrace }),
    feature_request: ({ userId, pinnedProjectId, onTrace }) =>
      createFeatureRequestTools(userId, { pinnedProjectId, onTrace }),
    progress_report: ({ userId, pinnedProjectId, onTrace }) =>
      createProgressReportTools(userId, { pinnedProjectId, onTrace }),
    workspace: ({ userId, onTrace }) =>
      createWorkspaceTools(userId, { onTrace }),
    document_intelligence: ({
      userId,
      pinnedProjectId,
      toolContext,
      onTrace,
    }) =>
      createDocumentIntelligenceTools(userId, {
        pinnedProjectId,
        ctx: toolContext,
        onTrace,
      }),
    intelligence: ({ toolContext, onTrace }) =>
      createIntelligenceTools({ ctx: toolContext, onTrace }),
    executive_brief: ({ onTrace }) =>
      createExecutiveBriefTools({ onTrace }),
    marketing: ({ userId, pinnedProjectId, onTrace }) =>
      createMarketingTools(userId, { pinnedProjectId, onTrace }),
  };
}

function isAiSdkStyleTool(value: unknown): value is AiSdkStyleTool {
  if (!value || typeof value !== "object") return false;
  const candidate = value as AiSdkStyleTool;
  return candidate.inputSchema !== undefined || candidate.parameters !== undefined;
}

function permissionsFor(entry: ProductionToolManifestEntry): string[] {
  if (entry.effect === "external_delivery") {
    return [
      EVE_READ_PERMISSION,
      EVE_WRITE_PERMISSION,
      EVE_DELIVERY_PERMISSION,
    ];
  }
  if (entry.effect === "write") {
    return [EVE_READ_PERMISSION, EVE_WRITE_PERMISSION];
  }
  return [EVE_READ_PERMISSION];
}

function definitionFor(
  entry: ProductionToolManifestEntry,
  tool: AiSdkStyleTool,
  provider: string,
): CanonicalToolDefinition {
  return {
    name: entry.name,
    description:
      typeof tool.description === "string"
        ? tool.description
        : `Production AI Assistant tool provided by ${entry.factoryId}: ${entry.name}.`,
    tool,
    effect: entry.effect,
    owningService: entry.factoryId,
    requiredPermissions: permissionsFor(entry),
    approvalRequirement: entry.approvalRequirement,
    // Ask Alleato receives a deliberately smaller read-only catalog from the
    // same executable registry; it never receives write or delivery tools.
    allowedSurfaces:
      entry.effect === "read" && askAlleatoReadTools.has(entry.name)
        ? ["ai_assistant", "ask_alleato"]
        : ["ai_assistant"],
    runtimeAvailability: { providers: [provider] },
    requiresProjectScope: entry.requiresProjectScope,
    sourceFamily: entry.sourceFamily,
  };
}

function errorDetail(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export function createProductionEveToolRegistry(
  input: CreateProductionEveRegistryInput,
): ProductionEveRegistryResult {
  const pinnedProjectId =
    input.project.status === "resolved" ? input.project.projectId : undefined;
  const toolContext =
    input.toolContext ??
    createToolContext({
      userId: input.userId,
      pinnedProjectId,
    });
  const factories = {
    ...defaultFactories(),
    ...input.toolFactories,
  };
  const request: ProductionToolFactoryRequest = {
    userId: input.userId,
    pinnedProjectId,
    sessionId: input.sessionId,
    toolContext,
    onTrace: input.onTrace,
  };
  const definitions: CanonicalToolDefinition[] = [];
  const registeredNames: string[] = [];
  const blocked: BlockedProductionTool[] = [];
  const unexpectedFactoryTools: Array<{
    name: string;
    factoryId: ProductionToolFactoryId;
  }> = [];

  for (const factoryManifest of PRODUCTION_EVE_FACTORY_MANIFESTS) {
    let tools: ProductionToolSet;
    try {
      tools = factories[factoryManifest.id](request);
    } catch (error) {
      const detail = errorDetail(error);
      blocked.push(
        ...factoryManifest.tools.map((entry) => ({
          name: entry.name,
          factoryId: factoryManifest.id,
          reason: "factory_initialization_failed" as const,
          detail,
        })),
      );
      continue;
    }

    const expectedNames = new Set(
      factoryManifest.tools.map((entry) => entry.name),
    );
    for (const name of Object.keys(tools)) {
      if (!expectedNames.has(name)) {
        unexpectedFactoryTools.push({ name, factoryId: factoryManifest.id });
      }
    }

    for (const entry of factoryManifest.tools) {
      const tool = tools[entry.name];
      if (tool === undefined) {
        blocked.push({
          name: entry.name,
          factoryId: factoryManifest.id,
          reason: "factory_did_not_return_expected_tool",
          detail: `${factoryManifest.exportName} did not return ${entry.name}.`,
        });
        continue;
      }
      if (!isAiSdkStyleTool(tool)) {
        blocked.push({
          name: entry.name,
          factoryId: factoryManifest.id,
          reason: "invalid_tool_shape",
          detail: `${factoryManifest.exportName}.${entry.name} has no AI SDK inputSchema or parameters schema.`,
        });
        continue;
      }

      definitions.push(definitionFor(entry, tool, input.provider));
      registeredNames.push(entry.name);
    }
  }

  const report: ProductionToolRegistryReport = Object.freeze({
    targetCount: EVE_TOOL_MANIFEST.length,
    registeredCount: registeredNames.length,
    blockedCount: blocked.length,
    unexpectedCount: unexpectedFactoryTools.length,
    complete:
      registeredNames.length === EVE_TOOL_MANIFEST.length &&
      blocked.length === 0 &&
      unexpectedFactoryTools.length === 0,
    registeredNames: Object.freeze(registeredNames),
    blocked: Object.freeze(blocked),
    unexpectedFactoryTools: Object.freeze(unexpectedFactoryTools),
  });

  return {
    registry: createCanonicalToolRegistry(definitions),
    report,
  };
}

export function assertProductionEveToolRegistryComplete(
  report: ProductionToolRegistryReport,
): void {
  if (report.complete) return;

  const blocked = report.blocked
    .map((entry) => `${entry.name} (${entry.reason})`)
    .join(", ");
  const unexpected = report.unexpectedFactoryTools
    .map((entry) => `${entry.factoryId}.${entry.name}`)
    .join(", ");
  throw new Error(
    [
      `Eve production tool registry is incomplete: ${report.registeredCount}/${report.targetCount} tools registered.`,
      blocked ? `Blocked: ${blocked}.` : "",
      unexpected ? `Unexpected factory tools: ${unexpected}.` : "",
    ]
      .filter(Boolean)
      .join(" "),
  );
}

export function createProductionEveRequestCatalog(
  input: CreateProductionEveCatalogInput,
): ProductionEveCatalogResult {
  const result = createProductionEveToolRegistry(input);
  const permissions = new Set(input.actorPermissions ?? []);
  permissions.add(EVE_READ_PERMISSION);
  if (input.allowWrites) permissions.add(EVE_WRITE_PERMISSION);
  if (input.allowDelivery) permissions.add(EVE_DELIVERY_PERMISSION);

  return {
    ...result,
    catalog: result.registry.forRequest({
      actor: {
        id: input.userId,
        permissions,
      },
      surface: input.surface ?? "ai_assistant",
      provider: input.provider,
      project: input.project,
    }),
  };
}
