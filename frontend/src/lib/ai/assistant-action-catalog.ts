import {
  AI_ASSISTANT_CHAT_WORKFLOW_ID,
  assistantToolsForWorkflow,
  type AssistantToolRegistryEntry,
} from "@/lib/ai/tool-registry";

export type AssistantActionCatalogStatus =
  | "ready"
  | "preview_required"
  | "needs_setup"
  | "admin_only"
  | "not_ready";

export type AssistantActionCatalogItem = {
  id: string;
  label: string;
  group: string;
  prompt: string;
  href: string | null;
  status: AssistantActionCatalogStatus;
  statusLabel: string;
  unavailableReason: string | null;
  toolName: string | null;
  requiresApproval: boolean;
  sourceFamilies: string[];
};

export type AssistantActionCatalogGroup = {
  title: string;
  description: string;
  items: AssistantActionCatalogItem[];
};

type CatalogDefinition = {
  toolName: string;
  label: string;
  group: string;
  prompt: string;
  status?: AssistantActionCatalogStatus;
  unavailableReason?: string;
};

type RouteCatalogDefinition = {
  id: string;
  label: string;
  group: string;
  prompt: string;
  href: string;
  status?: AssistantActionCatalogStatus;
  unavailableReason?: string;
};

const GROUP_COPY: Record<string, string> = {
  "Find evidence": "Search project records, meetings, Teams, emails, and documents.",
  "Create records": "Draft construction records and follow-ups for review.",
  "Reports and briefings": "Prepare owner-ready summaries and progress outputs.",
  "Review and approve": "Review AI-created drafts, approvals, and personal context.",
  "Personalization": "Use memory, learning, and company knowledge.",
  "Delivery": "Prepare email, calendar, and Teams messages with confirmation.",
};

const GROUP_ORDER = [
  "Review and approve",
  "Create records",
  "Find evidence",
  "Reports and briefings",
  "Personalization",
  "Delivery",
];

const FEATURED_ACTIONS: CatalogDefinition[] = [
  {
    toolName: "getProjectBriefingSnapshot",
    label: "Project status report",
    group: "Find evidence",
    prompt:
      "Start a project status report conversation for the selected project. Use the selected project context, ask me for the project if none is selected, and include source-backed current status, risks, decisions, and next steps.",
  },
  {
    toolName: "searchTeamsMessages",
    label: "Search Teams messages",
    group: "Find evidence",
    prompt: "Search Teams messages for recent project risks or decisions.",
  },
  {
    toolName: "searchEmails",
    label: "Search Outlook email",
    group: "Find evidence",
    prompt: "Search Outlook emails for recent project issues that need action.",
  },
  {
    toolName: "searchMeetingsByTopic",
    label: "Search meeting transcripts",
    group: "Find evidence",
    prompt: "Search meeting transcripts for decisions, blockers, and action items.",
  },
  {
    toolName: "createRFI",
    label: "Draft an RFI",
    group: "Create records",
    prompt: "Help me draft a new RFI. Ask for anything missing before previewing it.",
  },
  {
    toolName: "createChangeEvent",
    label: "Create change request",
    group: "Create records",
    prompt:
      "Help me create a change request for the selected project. Ask for any missing required fields, use available project evidence where possible, and preview the change request before anything is submitted.",
  },
  {
    toolName: "createCommitment",
    label: "Draft a commitment",
    group: "Create records",
    prompt: "Help me draft a commitment. Preview all dates, vendor fields, and line items before committing.",
  },
  {
    toolName: "createPrimeContract",
    label: "Draft a Prime Contract",
    group: "Create records",
    prompt:
      "Help me draft a Prime Contract for the selected project. Resolve the owner/client, preview the contract number and Schedule of Values, and require my approval before creating it.",
  },
  {
    toolName: "editPrimeContractSov",
    label: "Edit a Prime Contract SOV",
    group: "Create records",
    prompt:
      "Help me add or update Schedule of Values rows on an existing draft Prime Contract. Match only active project budget codes, preview every row and the new total, and require my approval before writing.",
  },
  {
    toolName: "createGeneratedTask",
    label: "Tasks overview",
    group: "Create records",
    prompt:
      "Give me a tasks overview for the selected project. Summarize open tasks, likely follow-ups, owners, due dates, and blockers from available project context before suggesting any new task.",
  },
  {
    toolName: "createWeeklyProgressReportDraft",
    label: "Draft a progress report",
    group: "Reports and briefings",
    prompt: "Create a weekly progress report draft with source-backed highlights.",
  },
  {
    toolName: "readCurrentDailyExecutiveBrief",
    label: "Read executive brief",
    group: "Reports and briefings",
    prompt: "Show me the current canonical Daily Executive Brief.",
  },
  {
    toolName: "reviewSubmittalAgainstDrawings",
    label: "Review submittal against drawings",
    group: "Reports and briefings",
    prompt: "Review a submittal against linked drawings and call out conflicts with evidence.",
  },
  {
    toolName: "writeMemory",
    label: "Save a preference or memory",
    group: "Personalization",
    prompt: "Save this as a memory or preference, and show me what will be saved first.",
  },
  {
    toolName: "saveToKnowledgeBase",
    label: "Save company knowledge",
    group: "Personalization",
    prompt: "Save this as company knowledge with the source and scope clearly labeled.",
  },
  {
    toolName: "draftOutlookEmail",
    label: "Draft an Outlook email",
    group: "Delivery",
    prompt: "Draft an Outlook email response and show me the recipient, subject, and body before anything is sent.",
  },
  {
    toolName: "sendTeamsMessage",
    label: "Prepare a Teams message",
    group: "Delivery",
    prompt: "Prepare a Teams message and ask me to confirm the channel, recipients, and message before sending.",
  },
];

const ROUTE_ACTIONS: RouteCatalogDefinition[] = [
  {
    id: "openAiApprovals",
    label: "Review AI approvals",
    group: "Review and approve",
    prompt:
      "Open the AI approvals queue so I can review preview-first AI-created drafts before anything is committed.",
    href: "/ai/approvals",
  },
  {
    id: "openAiProfile",
    label: "Review my AI profile",
    group: "Review and approve",
    prompt:
      "Open my AI profile so I can review what the assistant knows about my role, preferences, and prompt context.",
    href: "/ai/profile",
  },
];

function statusForEntry(
  entry: AssistantToolRegistryEntry,
  definition: CatalogDefinition,
): AssistantActionCatalogStatus {
  if (definition.status) return definition.status;
  if (entry.metadata.optionalFactory === true) return "needs_setup";
  if (entry.requiresDeliveryPermission) return "preview_required";
  if (entry.evidencePolicy.ledgerRequired || entry.requiresWritePermission) {
    return "preview_required";
  }
  return "ready";
}

function statusLabel(status: AssistantActionCatalogStatus): string {
  switch (status) {
    case "ready":
      return "Ready";
    case "preview_required":
      return "Preview required";
    case "needs_setup":
      return "Needs setup";
    case "admin_only":
      return "Admin only";
    case "not_ready":
      return "Not ready";
  }
}

function unavailableReason(
  status: AssistantActionCatalogStatus,
  entry: AssistantToolRegistryEntry,
  definition: CatalogDefinition,
): string | null {
  if (definition.unavailableReason) return definition.unavailableReason;
  if (status === "needs_setup") {
    return "This action depends on a provider or optional tool factory that may not be configured.";
  }
  if (status === "admin_only") {
    return "This action is restricted to admin or operations users.";
  }
  if (status === "not_ready") {
    return "This action is not ready for user-facing launch.";
  }
  if (entry.requiresProjectScope) {
    return "Select a project before using this action.";
  }
  return null;
}

export function buildAssistantActionCatalog(input: {
  registry?: AssistantToolRegistryEntry[];
} = {}): AssistantActionCatalogGroup[] {
  const entries = assistantToolsForWorkflow({
    registry: input.registry,
    workflowId: AI_ASSISTANT_CHAT_WORKFLOW_ID,
  });
  const byName = new Map(entries.map((entry) => [entry.name, entry]));
  const groups = new Map<string, AssistantActionCatalogItem[]>();

  for (const definition of FEATURED_ACTIONS) {
    const entry = byName.get(definition.toolName);
    if (!entry) {
      throw new Error(
        `AI action catalog metadata missing registry entry: ${definition.toolName}`,
      );
    }

    const status = statusForEntry(entry, definition);
    const item: AssistantActionCatalogItem = {
      id: definition.toolName,
      label: definition.label,
      group: definition.group,
      prompt: definition.prompt,
      href: null,
      status,
      statusLabel: statusLabel(status),
      unavailableReason: unavailableReason(status, entry, definition),
      toolName: entry.name,
      requiresApproval:
        entry.requiresWritePermission ||
        entry.requiresDeliveryPermission ||
        entry.evidencePolicy.ledgerRequired,
      sourceFamilies: entry.sourceFamilies ?? [],
    };

    const current = groups.get(definition.group) ?? [];
    current.push(item);
    groups.set(definition.group, current);
  }

  for (const definition of ROUTE_ACTIONS) {
    const status = definition.status ?? "ready";
    const item: AssistantActionCatalogItem = {
      id: definition.id,
      label: definition.label,
      group: definition.group,
      prompt: definition.prompt,
      href: definition.href,
      status,
      statusLabel: statusLabel(status),
      unavailableReason: definition.unavailableReason ?? null,
      toolName: null,
      requiresApproval: false,
      sourceFamilies: [],
    };

    const current = groups.get(definition.group) ?? [];
    current.push(item);
    groups.set(definition.group, current);
  }

  return Array.from(groups.entries())
    .sort(([left], [right]) => {
      const leftIndex = GROUP_ORDER.indexOf(left);
      const rightIndex = GROUP_ORDER.indexOf(right);
      if (leftIndex === -1 && rightIndex === -1) return left.localeCompare(right);
      if (leftIndex === -1) return 1;
      if (rightIndex === -1) return -1;
      return leftIndex - rightIndex;
    })
    .map(([title, items]) => ({
      title,
      description: GROUP_COPY[title] ?? "Assistant actions available in Alleato.",
      items,
    }));
}

export const ASSISTANT_ACTION_CATALOG = buildAssistantActionCatalog();

export function flattenAssistantActionCatalog(
  catalog: AssistantActionCatalogGroup[] = ASSISTANT_ACTION_CATALOG,
): AssistantActionCatalogItem[] {
  return catalog.flatMap((group) => group.items);
}

export function assistantActionCatalogItemById(
  id: string,
  catalog: AssistantActionCatalogGroup[] = ASSISTANT_ACTION_CATALOG,
): AssistantActionCatalogItem | null {
  return flattenAssistantActionCatalog(catalog).find((item) => item.id === id) ?? null;
}
