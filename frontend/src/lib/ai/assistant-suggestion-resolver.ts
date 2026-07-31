import {
  ASSISTANT_ACTION_CATALOG,
  assistantActionCatalogItemById,
  type AssistantActionCatalogGroup,
  type AssistantActionCatalogItem,
} from "@/lib/ai/assistant-action-catalog";

export type AssistantSuggestionSurface =
  | "command_center"
  | "widget"
  | "page_action"
  | "onboarding";

export type AssistantSuggestion = Pick<
  AssistantActionCatalogItem,
  | "id"
  | "label"
  | "prompt"
  | "status"
  | "statusLabel"
  | "unavailableReason"
  | "requiresApproval"
  | "href"
> & {
  reason: string;
};

export type ResolveAssistantSuggestionsInput = {
  pathname?: string | null;
  surface: AssistantSuggestionSurface;
  catalog?: AssistantActionCatalogGroup[];
  maxSuggestions?: number;
};

type RouteRule = {
  pattern: RegExp;
  actionIds: string[];
  reason: string;
};

const DEFAULT_MAX_SUGGESTIONS = 4;

const ROUTE_RULES: RouteRule[] = [
  {
    pattern: /\/home(?:\/|$)/,
    actionIds: [
      "openAiApprovals",
      "openAiProfile",
      "getProjectBriefingSnapshot",
      "createGeneratedTask",
    ],
    reason: "Homepage context",
  },
  {
    pattern: /\/ai\/approvals(?:\/|$)/,
    actionIds: [
      "openAiApprovals",
      "openAiProfile",
      "getProjectBriefingSnapshot",
      "createGeneratedTask",
    ],
    reason: "AI approvals context",
  },
  {
    pattern: /\/ai\/profile(?:\/|$)/,
    actionIds: [
      "openAiProfile",
      "writeMemory",
      "saveToKnowledgeBase",
      "openAiApprovals",
    ],
    reason: "AI profile context",
  },
  {
    pattern: /\/rfis(?:\/|$)/,
    actionIds: ["createRFI", "getProjectBriefingSnapshot", "searchEmails", "searchTeamsMessages"],
    reason: "RFI route context",
  },
  {
    pattern: /\/change-(?:events|orders|management)(?:\/|$)/,
    actionIds: ["createChangeEvent", "getProjectBriefingSnapshot", "searchEmails", "createGeneratedTask"],
    reason: "Change management route context",
  },
  {
    pattern: /\/commitments(?:\/|$)/,
    actionIds: ["createCommitment", "getProjectBriefingSnapshot", "searchEmails", "createGeneratedTask"],
    reason: "Commitments route context",
  },
  {
    pattern: /\/progress-reports(?:\/|$)|\/project-status-report(?:\/|$)|\/reporting(?:\/|$)/,
    actionIds: [
      "createWeeklyProgressReportDraft",
      "getProjectBriefingSnapshot",
      "searchMeetingsByTopic",
      "searchTeamsMessages",
    ],
    reason: "Reporting route context",
  },
  {
    pattern: /\/submittals(?:\/|$)/,
    actionIds: [
      "reviewSubmittalAgainstDrawings",
      "getProjectBriefingSnapshot",
      "searchEmails",
      "createGeneratedTask",
    ],
    reason: "Submittal route context",
  },
  {
    pattern: /\/meetings(?:\/|$)/,
    actionIds: ["searchMeetingsByTopic", "createGeneratedTask", "getProjectBriefingSnapshot", "searchTeamsMessages"],
    reason: "Meeting route context",
  },
  {
    pattern: /\/emails(?:\/|$)|\/email-/,
    actionIds: ["searchEmails", "draftOutlookEmail", "createGeneratedTask", "getProjectBriefingSnapshot"],
    reason: "Email route context",
  },
  {
    pattern: /\/directory(?:\/|$)/,
    actionIds: ["getProjectBriefingSnapshot", "searchEmails", "createGeneratedTask", "saveToKnowledgeBase"],
    reason: "Directory route context",
  },
];

const SURFACE_DEFAULTS: Record<AssistantSuggestionSurface, string[]> = {
  command_center: [
    "openAiApprovals",
    "getProjectBriefingSnapshot",
    "createRFI",
    "createChangeEvent",
    "createWeeklyProgressReportDraft",
  ],
  widget: [
    "openAiApprovals",
    "getProjectBriefingSnapshot",
    "createChangeEvent",
    "createGeneratedTask",
  ],
  page_action: [
    "getProjectBriefingSnapshot",
    "createGeneratedTask",
    "searchEmails",
    "searchTeamsMessages",
  ],
  onboarding: [
    "openAiProfile",
    "openAiApprovals",
    "getProjectBriefingSnapshot",
    "createRFI",
  ],
};

function normalizePathname(pathname: string | null | undefined): string {
  if (!pathname) return "/";
  return pathname.split("?")[0] || "/";
}

function actionIdsForPath(pathname: string): { ids: string[]; reason: string } | null {
  const rule = ROUTE_RULES.find((candidate) => candidate.pattern.test(pathname));
  return rule ? { ids: rule.actionIds, reason: rule.reason } : null;
}

function suggestionFromId(input: {
  id: string;
  catalog: AssistantActionCatalogGroup[];
  reason: string;
}): AssistantSuggestion {
  const item = assistantActionCatalogItemById(input.id, input.catalog);
  if (!item) {
    throw new Error(`AI suggestion resolver referenced unknown catalog action: ${input.id}`);
  }

  return {
    id: item.id,
    label: item.label,
    prompt: item.prompt,
    href: item.href,
    status: item.status,
    statusLabel: item.statusLabel,
    unavailableReason: item.unavailableReason,
    requiresApproval: item.requiresApproval,
    reason: input.reason,
  };
}

export function resolveAssistantSuggestions({
  pathname,
  surface,
  catalog = ASSISTANT_ACTION_CATALOG,
  maxSuggestions = DEFAULT_MAX_SUGGESTIONS,
}: ResolveAssistantSuggestionsInput): AssistantSuggestion[] {
  const normalizedPathname = normalizePathname(pathname);
  const routeMatch = actionIdsForPath(normalizedPathname);
  const routeIds = routeMatch?.ids ?? [];
  const fallbackIds = SURFACE_DEFAULTS[surface];
  const orderedIds = Array.from(new Set([...routeIds, ...fallbackIds]));

  return orderedIds
    .map((id) =>
      suggestionFromId({
        id,
        catalog,
        reason: routeMatch?.ids.includes(id)
          ? routeMatch.reason
          : `${surface.replace("_", " ")} default`,
      }),
    )
    .slice(0, maxSuggestions);
}
