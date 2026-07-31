import type {
  AiRunStep,
  EvidenceRef,
  SourceHealthSnapshot,
  ToolDefinition,
} from "./contracts";

export type NormalizedSourceRecord = {
  sourceFamily: EvidenceRef["sourceFamily"];
  sourceId: string;
  sourceTitle: string;
  sourceUrl?: string | null;
  internalHref?: string | null;
  occurredAt?: string | null;
  excerpt: string;
  confidence: EvidenceRef["confidence"];
  projectId?: number | null;
  projectLabel?: string | null;
  metadata?: Record<string, unknown>;
};

export type SourceAdapterDefinition = {
  adapterId: string;
  title: string;
  sourceFamilies: EvidenceRef["sourceFamily"][];
  toolNames: string[];
  requiredForExecutiveBrief: boolean;
  defaultFreshnessMinutes: number;
  supportedHealthStates: SourceHealthSnapshot["status"][];
  outputRecordType: "evidence_ref";
  healthRecordType: "source_health_snapshot";
};

export type SourceAdapterRunResult = {
  adapter: SourceAdapterDefinition;
  status: SourceHealthSnapshot["status"];
  health: SourceHealthSnapshot[];
  loadedCount: number;
  missingCount: number;
  failureCode: string | null;
  failureMessage: string | null;
};

const REQUIRED_HEALTH_STATES: SourceHealthSnapshot["status"][] = [
  "loaded",
  "stale",
  "missing",
  "degraded",
  "failed",
  "skipped",
];

export const EXECUTIVE_DAILY_BRIEF_SOURCE_ADAPTERS: SourceAdapterDefinition[] = [
  {
    adapterId: "fireflies_meetings",
    title: "Fireflies meeting adapter",
    sourceFamilies: ["fireflies", "meeting"],
    toolNames: ["fetch-fireflies-meeting-sources"],
    requiredForExecutiveBrief: true,
    defaultFreshnessMinutes: 4_320,
    supportedHealthStates: REQUIRED_HEALTH_STATES,
    outputRecordType: "evidence_ref",
    healthRecordType: "source_health_snapshot",
  },
  {
    adapterId: "outlook_email",
    title: "Outlook email adapter",
    sourceFamilies: ["outlook", "email"],
    toolNames: ["fetch-outlook-email-sources"],
    requiredForExecutiveBrief: true,
    defaultFreshnessMinutes: 4_320,
    supportedHealthStates: REQUIRED_HEALTH_STATES,
    outputRecordType: "evidence_ref",
    healthRecordType: "source_health_snapshot",
  },
  {
    adapterId: "teams_messages",
    title: "Teams message adapter",
    sourceFamilies: ["teams"],
    toolNames: ["fetch-teams-message-sources"],
    requiredForExecutiveBrief: true,
    defaultFreshnessMinutes: 4_320,
    supportedHealthStates: REQUIRED_HEALTH_STATES,
    outputRecordType: "evidence_ref",
    healthRecordType: "source_health_snapshot",
  },
  {
    adapterId: "documents_rag",
    title: "Documents/RAG adapter",
    sourceFamilies: ["document", "rag"],
    toolNames: ["fetch-document-rag-sources"],
    requiredForExecutiveBrief: true,
    defaultFreshnessMinutes: 10_080,
    supportedHealthStates: REQUIRED_HEALTH_STATES,
    outputRecordType: "evidence_ref",
    healthRecordType: "source_health_snapshot",
  },
  {
    adapterId: "acumatica_financials",
    title: "Acumatica financial adapter",
    sourceFamilies: ["acumatica"],
    toolNames: ["fetch-acumatica-financial-sources"],
    requiredForExecutiveBrief: true,
    defaultFreshnessMinutes: 1_440,
    supportedHealthStates: REQUIRED_HEALTH_STATES,
    outputRecordType: "evidence_ref",
    healthRecordType: "source_health_snapshot",
  },
  {
    adapterId: "procore_project_data",
    title: "Procore/project data adapter",
    sourceFamilies: ["procore"],
    toolNames: ["fetch-procore-project-sources"],
    requiredForExecutiveBrief: false,
    defaultFreshnessMinutes: 10_080,
    supportedHealthStates: REQUIRED_HEALTH_STATES,
    outputRecordType: "evidence_ref",
    healthRecordType: "source_health_snapshot",
  },
  {
    adapterId: "daily_executive_brief_canonical_packet",
    title: "Canonical Daily Executive Brief packet adapter",
    sourceFamilies: ["intelligence_packet", "project_intelligence"],
    toolNames: ["fetch-daily-executive-brief-sources"],
    requiredForExecutiveBrief: true,
    defaultFreshnessMinutes: 1_440,
    supportedHealthStates: REQUIRED_HEALTH_STATES,
    outputRecordType: "evidence_ref",
    healthRecordType: "source_health_snapshot",
  },
  {
    adapterId: "project_intelligence_packets",
    title: "Project Intelligence packet adapter",
    sourceFamilies: [
      "project_intelligence",
      "intelligence_packet",
      "insight_card",
    ],
    toolNames: ["fetch-project-intelligence-sources"],
    requiredForExecutiveBrief: true,
    defaultFreshnessMinutes: 1_440,
    supportedHealthStates: REQUIRED_HEALTH_STATES,
    outputRecordType: "evidence_ref",
    healthRecordType: "source_health_snapshot",
  },
];

export function requiredExecutiveBriefSourceFamilies() {
  return Array.from(
    new Set(
      EXECUTIVE_DAILY_BRIEF_SOURCE_ADAPTERS.filter(
        (adapter) => adapter.requiredForExecutiveBrief,
      ).flatMap((adapter) => adapter.sourceFamilies),
    ),
  );
}

export function sourceAdapterToolDefinitions(): ToolDefinition[] {
  return EXECUTIVE_DAILY_BRIEF_SOURCE_ADAPTERS.flatMap((adapter) =>
    adapter.toolNames.map((toolName) => ({
      name: toolName,
      description: `${adapter.title} returns normalized source records and source health snapshots.`,
      owningAdapter: adapter.adapterId,
      inputSchemaName: `${adapter.adapterId}.input`,
      outputSchemaName: `${adapter.adapterId}.normalizedSourcesOutput`,
      failureShape: "status_payload" as const,
      metadata: {
        sourceFamilies: adapter.sourceFamilies,
        requiredForExecutiveBrief: adapter.requiredForExecutiveBrief,
        supportedHealthStates: adapter.supportedHealthStates,
      },
    })),
  );
}

function adapterStatusFromHealth(
  adapter: SourceAdapterDefinition,
  health: SourceHealthSnapshot[],
): SourceHealthSnapshot["status"] {
  if (health.length === 0) {
    return adapter.requiredForExecutiveBrief ? "missing" : "skipped";
  }

  if (health.some((snapshot) => snapshot.status === "failed")) return "failed";
  if (health.some((snapshot) => snapshot.status === "degraded"))
    return "degraded";
  if (health.some((snapshot) => snapshot.status === "missing"))
    return "missing";
  if (health.some((snapshot) => snapshot.status === "stale")) return "stale";
  if (health.every((snapshot) => snapshot.status === "skipped"))
    return "skipped";
  if (
    health.some(
      (snapshot) =>
        snapshot.status === "loaded" || snapshot.status === "healthy",
    )
  ) {
    return "loaded";
  }
  return "unknown";
}

function failureForAdapterStatus(
  status: SourceHealthSnapshot["status"],
): Pick<SourceAdapterRunResult, "failureCode" | "failureMessage"> {
  switch (status) {
    case "failed":
      return {
        failureCode: "SOURCE_ADAPTER_FAILED",
        failureMessage: "Source adapter reported a failed health state.",
      };
    case "degraded":
      return {
        failureCode: "SOURCE_ADAPTER_DEGRADED",
        failureMessage: "Source adapter reported degraded source coverage.",
      };
    case "missing":
      return {
        failureCode: "SOURCE_ADAPTER_MISSING",
        failureMessage: "Source adapter returned no usable source coverage.",
      };
    case "stale":
      return {
        failureCode: "SOURCE_ADAPTER_STALE",
        failureMessage: "Source adapter returned stale source coverage.",
      };
    default:
      return { failureCode: null, failureMessage: null };
  }
}

function stepStatusFromAdapterStatus(
  status: SourceHealthSnapshot["status"],
): AiRunStep["status"] {
  if (status === "loaded" || status === "healthy") return "succeeded";
  if (status === "skipped") return "skipped";
  if (status === "failed") return "failed_retryable";
  if (status === "missing" || status === "degraded" || status === "stale") {
    return "failed_retryable";
  }
  return "blocked";
}

export function sourceAdapterRunResultsFromHealth(
  health: SourceHealthSnapshot[],
): SourceAdapterRunResult[] {
  return EXECUTIVE_DAILY_BRIEF_SOURCE_ADAPTERS.map((adapter) => {
    const adapterFamilies = new Set(adapter.sourceFamilies);
    const adapterHealth = health.filter((snapshot) =>
      adapterFamilies.has(snapshot.sourceFamily),
    );
    const status = adapterStatusFromHealth(adapter, adapterHealth);
    const failure = failureForAdapterStatus(status);

    return {
      adapter,
      status,
      health: adapterHealth,
      loadedCount: adapterHealth.reduce(
        (sum, snapshot) => sum + snapshot.loadedCount,
        0,
      ),
      missingCount: adapterHealth.reduce(
        (sum, snapshot) => sum + snapshot.missingCount,
        0,
      ),
      ...failure,
    };
  });
}

export function sourceAdapterRunStepsFromHealth(input: {
  runId: string;
  health: SourceHealthSnapshot[];
  at: string;
}): AiRunStep[] {
  return sourceAdapterRunResultsFromHealth(input.health).map((result) => ({
    runId: input.runId,
    stepType: "source_fetch",
    status: stepStatusFromAdapterStatus(result.status),
    startedAt: input.at,
    completedAt: input.at,
    failureCode: result.failureCode,
    failureMessage: result.failureMessage,
    metadata: {
      adapterId: result.adapter.adapterId,
      title: result.adapter.title,
      toolNames: result.adapter.toolNames,
      sourceFamilies: result.adapter.sourceFamilies,
      requiredForExecutiveBrief: result.adapter.requiredForExecutiveBrief,
      sourceHealthStatus: result.status,
      loadedCount: result.loadedCount,
      missingCount: result.missingCount,
      healthResourceIds: result.health.map((snapshot) => snapshot.resourceId),
      warningMessages: result.health
        .map((snapshot) => snapshot.warning)
        .filter(Boolean),
    },
  }));
}
