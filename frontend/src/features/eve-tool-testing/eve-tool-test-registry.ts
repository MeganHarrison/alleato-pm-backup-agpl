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
  screenshotStatus: EveToolScreenshotStatus;
  screenshotPath: string | null;
  testPrompt: string;
  evidence: string | null;
  blocker: string | null;
}

interface KnownTestResult {
  status: Exclude<EveToolTestStatus, "not_tested">;
  evidence?: string;
  blocker?: string;
}

const LIVE_BROWSER_TRACE =
  "Live browser trace, Eve tool audit, July 30, 2026";

const PASSED_TOOL_NAMES = [
  "extractStructuredActionBrief",
  "findAppPage",
  "findMarketingSourceCandidates",
  "findProjectDocuments",
  "getActionItemsAndInsights",
  "getBudgetLineItems",
  "getCompanyKnowledge",
  "getCostTrends",
  "getCrossProjectComparison",
  "getHistoricalTrends",
  "getImplementationStatus",
  "getMarketingCalendar",
  "getMeetingsByDate",
  "getOutlookCalendarEvents",
  "getOutlookOperationsStatus",
  "getPortfolioOverview",
  "getProjectDetails",
  "getRecentEmails",
  "getSopBacklog",
  "getSpecRequirements",
  "getSubmittalLog",
  "listDomainIntelligence",
  "listWorkspaceArtifacts",
  "queryBudgetData",
  "queryChangeOrders",
  "queryCommitments",
  "queryDirectCosts",
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
      { status: "passed", evidence: LIVE_BROWSER_TRACE },
    ]),
  ),
  findProject: {
    status: "needs_retest",
    evidence: LIVE_BROWSER_TRACE,
    blocker:
      "Portfolio recognized Test July 2026, but the project resolver did not.",
  },
  getProjectBriefingSnapshot: {
    status: "needs_retest",
    evidence: LIVE_BROWSER_TRACE,
    blocker:
      "Project briefing did not resolve the same project returned by portfolio search.",
  },
  findRelatedFeatureRequests: {
    status: "needs_retest",
    evidence: LIVE_BROWSER_TRACE,
    blocker:
      "The tool required explicit project scope although registry metadata treats it as unscoped.",
  },
  searchWeb: {
    status: "blocked",
    blocker: "Registered in Eve but unavailable to the live assistant run.",
  },
  researchCompany: {
    status: "blocked",
    blocker: "Registered in Eve but unavailable to the live assistant run.",
  },
  searchConstructionMarket: {
    status: "blocked",
    blocker: "Registered in Eve but unavailable to the live assistant run.",
  },
  listProgressReportPhotos: {
    status: "blocked",
    blocker:
      "The test account lacks required access and the direct Supabase binding is mismatched.",
  },
});

export const KNOWN_EVE_TOOL_SCREENSHOTS: Readonly<Record<string, string>> =
  Object.freeze({});

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
