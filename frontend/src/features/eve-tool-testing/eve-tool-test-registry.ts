import { EVE_TOOL_MANIFEST } from "@/lib/ai/eve-runtime/production-tool-registry";
import { GLOBAL_ASSISTANT_TOOL_REGISTRY } from "@/lib/ai/tool-registry";

export type EveToolTestStatus =
  | "passed"
  | "needs_retest"
  | "blocked"
  | "not_tested";

export type EveToolScreenshotStatus = "verified" | "not_verified";

export interface EveToolTestRow {
  id: string;
  name: string;
  label: string;
  description: string;
  family: string;
  effect: "read" | "write" | "delivery";
  approval: string;
  scope: "Project" | "Company";
  status: EveToolTestStatus;
  testedAt: string | null;
  screenshotStatus: EveToolScreenshotStatus;
  screenshotPath: string | null;
  testPrompt: string;
  evidence: string | null;
  blocker: string | null;
}

interface KnownTestResult {
  status: Exclude<EveToolTestStatus, "not_tested">;
  testedAt: string;
  evidence?: string;
  blocker?: string;
}

const LIVE_BROWSER_TRACE =
  "Live browser trace, Eve tool audit, July 30, 2026";
const LIVE_BROWSER_TEST_DATE = "2026-07-30";
const CURRENT_BROWSER_TEST_DATE = "2026-07-31";

const PASSED_TOOL_NAMES = [
  "extractStructuredActionBrief",
  "findAppPage",
  "findMarketingSourceCandidates",
  "findProject",
  "findProjectDocuments",
  "getActionItemsAndInsights",
  "getBudgetLineItems",
  "getChangeOrderDetails",
  "getCompanyKnowledge",
  "getCommitmentsOverview",
  "getCostTrends",
  "getCrossProjectComparison",
  "getDirectCostsSummary",
  "getPeopleAndRoles",
  "getProjectBudgetSummary",
  "getDomainIntelligence",
  "getFinanceSpendRollup",
  "getFinancialAnalysis",
  "getForecastComparison",
  "getRFIStatus",
  "getVendorPerformance",
  "detectMissingSubmittals",
  "reviewSubmittalAgainstDrawings",
  "getHistoricalTrends",
  "getImplementationStatus",
  "getMarketingCalendar",
  "getMarginAnalysis",
  "getMeetingDetails",
  "getMeetingsByDate",
  "getOutlookCalendarEvents",
  "getOutlookOperationsStatus",
  "getPortfolioOverview",
  "getAPAgingReport",
  "getARAgingReport",
  "getCashPositionReport",
  "getVendorSpendReport",
  "getRecentBills",
  "getRecentInvoices",
  "getScheduleAnalysis",
  "getAcumaticaProjectBudget",
  "getAcumaticaProjectList",
  "getPurchaseOrderSummary",
  "getProjectDetails",
  "getProjectRiskAnalysis",
  "getProjectsWithRisks",
  "getRecentEmails",
  "getSopBacklog",
  "getSpecRequirements",
  "getSubmittalLog",
  "getSubmittalStatus",
  "listDomainIntelligence",
  "listWorkspaceArtifacts",
  "queryBudgetData",
  "queryChangeOrders",
  "queryCommitments",
  "queryDirectCosts",
  "queryDocumentRows",
  "queryScheduleTasks",
  "readCurrentDailyExecutiveBrief",
  "searchAppHelp",
  "searchEmails",
  "searchExternalDocuments",
  "searchMeetingsByTopic",
  "searchMemories",
  "searchPastConversations",
  "searchStructuredFinancialRows",
  "searchTeamsMessages",
  "semanticSearch",
] as const;

export const KNOWN_EVE_TOOL_TEST_RESULTS: Readonly<
  Record<string, KnownTestResult>
> = Object.freeze({
  ...Object.fromEntries(
    PASSED_TOOL_NAMES.map((name) => [
      name,
      {
        status: "passed",
        testedAt: LIVE_BROWSER_TEST_DATE,
        evidence: LIVE_BROWSER_TRACE,
      },
    ]),
  ),
  getProjectBriefingSnapshot: {
    status: "needs_retest",
    testedAt: LIVE_BROWSER_TEST_DATE,
    evidence: LIVE_BROWSER_TRACE,
    blocker:
      "Project briefing did not resolve the same project returned by portfolio search.",
  },
  findRelatedFeatureRequests: {
    status: "needs_retest",
    testedAt: LIVE_BROWSER_TEST_DATE,
    evidence: LIVE_BROWSER_TRACE,
    blocker:
      "The tool required explicit project scope although registry metadata treats it as unscoped.",
  },
  searchWeb: {
    status: "blocked",
    testedAt: LIVE_BROWSER_TEST_DATE,
    blocker: "Registered in Eve but unavailable to the live assistant run.",
  },
  researchCompany: {
    status: "blocked",
    testedAt: LIVE_BROWSER_TEST_DATE,
    blocker: "Registered in Eve but unavailable to the live assistant run.",
  },
  searchConstructionMarket: {
    status: "blocked",
    testedAt: LIVE_BROWSER_TEST_DATE,
    blocker: "Registered in Eve but unavailable to the live assistant run.",
  },
  listProgressReportPhotos: {
    status: "blocked",
    testedAt: LIVE_BROWSER_TEST_DATE,
    blocker:
      "The test account lacks required access and the direct Supabase binding is mismatched.",
  },
  ...Object.fromEntries(
    [
      "getMarginAnalysis",
      "getFinanceSpendRollup",
      "getFinancialAnalysis",
      "getAPAgingReport",
      "getARAgingReport",
      "getCashPositionReport",
      "getVendorSpendReport",
      "getRecentBills",
      "getRecentInvoices",
      "getAcumaticaProjectBudget",
      "getAcumaticaProjectList",
      "getPurchaseOrderSummary",
      "readCurrentDailyExecutiveBrief",
      "getMarketingCalendar",
      "listWorkspaceArtifacts",
      "queryScheduleTasks",
      "getScheduleAnalysis",
      "getProjectsWithRisks",
      "getMeetingDetails",
      "getSubmittalStatus",
      "queryDocumentRows",
      "findProject",
      "getProjectRiskAnalysis",
      "getChangeOrderDetails",
      "getCommitmentsOverview",
      "getDirectCostsSummary",
      "getPeopleAndRoles",
      "getProjectBudgetSummary",
      "getDomainIntelligence",
      "getForecastComparison",
      "getRFIStatus",
      "getVendorPerformance",
      "detectMissingSubmittals",
      "reviewSubmittalAgainstDrawings",
    ].map((name) => [
      name,
      {
        status: "passed" as const,
        testedAt: CURRENT_BROWSER_TEST_DATE,
        evidence:
          "Strict authenticated Eve browser result with an output-available tool trace, no hidden tool error, and dedicated screenshot proof.",
      },
    ]),
  ),
});

export const KNOWN_EVE_TOOL_SCREENSHOTS: Readonly<Record<string, string>> =
  Object.freeze(
    Object.fromEntries(
      [
        "getMarginAnalysis",
        "getFinanceSpendRollup",
        "getFinancialAnalysis",
        "getAPAgingReport",
        "getARAgingReport",
        "getCashPositionReport",
        "getVendorSpendReport",
        "getRecentBills",
        "getRecentInvoices",
        "getAcumaticaProjectBudget",
        "getAcumaticaProjectList",
        "getPurchaseOrderSummary",
        "readCurrentDailyExecutiveBrief",
        "getMarketingCalendar",
        "listWorkspaceArtifacts",
        "queryScheduleTasks",
        "getScheduleAnalysis",
        "getProjectsWithRisks",
        "getMeetingDetails",
        "getSubmittalStatus",
        "queryDocumentRows",
        "findProject",
        "getProjectRiskAnalysis",
        "getChangeOrderDetails",
        "getCommitmentsOverview",
        "getDirectCostsSummary",
        "getPeopleAndRoles",
        "getProjectBudgetSummary",
        "getDomainIntelligence",
        "getForecastComparison",
        "getRFIStatus",
        "getVendorPerformance",
        "detectMissingSubmittals",
        "reviewSubmittalAgainstDrawings",
      ].map((name) => [
        name,
        `C:/Users/KimiClaw/AppData/Local/Temp/eve-tool-verification-20260731/${name}${
          name === "readCurrentDailyExecutiveBrief"
            ? "-traceable"
            : name === "getMarketingCalendar" ||
                name === "listWorkspaceArtifacts"
              ? "-pinned"
              : ""
        }-passed.png`,
      ]),
    ),
  );

const FAMILY_LABELS: Record<string, string> = {
  project: "Project",
  action: "Actions",
  web_search: "Web research",
  structured_output: "Structured output",
  feature_request: "Feature requests",
  progress_report: "Progress reports",
  workspace: "Workspace",
  document_intelligence: "Documents",
  intelligence: "Intelligence",
  executive_brief: "Executive brief",
  marketing: "Marketing",
};

function humanizeToolName(name: string): string {
  return name
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

function defaultTestPrompt(
  name: string,
  effect: EveToolTestRow["effect"],
  requiresProjectScope: boolean,
): string {
  if (effect === "read") {
    return requiresProjectScope
      ? `For a selected project, use ${name} and cite the records used.`
      : `Use ${name} and cite the records used.`;
  }
  if (effect === "write") {
    return `Ask Eve to use ${name}; verify the read-only assistant blocks execution and explains the approval boundary.`;
  }
  return `Ask Eve to use ${name}; verify the read-only assistant blocks delivery and explains the delivery boundary.`;
}

export function buildEveToolTestRows(): EveToolTestRow[] {
  const registryByName = new Map(
    GLOBAL_ASSISTANT_TOOL_REGISTRY.map((entry) => [entry.name, entry]),
  );

  return EVE_TOOL_MANIFEST.map((entry) => {
    const registryEntry = registryByName.get(entry.name);
    const knownResult = KNOWN_EVE_TOOL_TEST_RESULTS[entry.name];
    const screenshotPath = KNOWN_EVE_TOOL_SCREENSHOTS[entry.name] ?? null;
    const regressionPrompt = registryEntry?.routingPolicy?.regressionPrompts[0];
    const effect: EveToolTestRow["effect"] =
      entry.effect === "external_delivery" ? "delivery" : entry.effect;
    const scope: EveToolTestRow["scope"] = entry.requiresProjectScope
      ? "Project"
      : "Company";

    return {
      id: entry.name,
      name: entry.name,
      label: humanizeToolName(entry.name),
      description:
        registryEntry?.description ??
        `${humanizeToolName(entry.name)} capability owned by Eve.`,
      family: FAMILY_LABELS[entry.factoryId] ?? humanizeToolName(entry.factoryId),
      effect,
      approval:
        entry.approvalRequirement === "none"
          ? "None"
          : humanizeToolName(entry.approvalRequirement),
      scope,
      status: knownResult?.status ?? "not_tested",
      testedAt: knownResult?.testedAt ?? null,
      screenshotStatus: screenshotPath ? "verified" : "not_verified",
      screenshotPath,
      testPrompt:
        regressionPrompt ??
        defaultTestPrompt(
          entry.name,
          effect,
          entry.requiresProjectScope,
        ),
      evidence: knownResult?.evidence ?? null,
      blocker: knownResult?.blocker ?? null,
    };
  }).sort((left, right) => {
    const statusOrder: Record<EveToolTestStatus, number> = {
      blocked: 0,
      needs_retest: 1,
      not_tested: 2,
      passed: 3,
    };
    return (
      statusOrder[left.status] - statusOrder[right.status] ||
      left.family.localeCompare(right.family) ||
      left.label.localeCompare(right.label)
    );
  });
}
