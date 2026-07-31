export type AutomationBlueprintKey =
  | "daily_recap"
  | "source_rag_health"
  | "microsoft_executive_assistant_check"
  | "graph_sync";

export interface AutomationBlueprintDefinition {
  key: AutomationBlueprintKey;
  title: string;
  description: string;
  runtimeOwner: string;
  existingRenderCronName: string;
  currentSchedule: string;
  supportedKeywords: string[];
  approvalNotes: string;
}

export const AUTOMATION_BLUEPRINT_CATALOG: AutomationBlueprintDefinition[] = [
  {
    key: "daily_recap",
    title: "Daily recap generation",
    description: "Generate project daily recaps from recent source activity.",
    runtimeOwner: "render-cron",
    existingRenderCronName: "alleato-daily-recap",
    currentSchedule: "30 9 * * *",
    supportedKeywords: ["daily recap", "recap", "project recap"],
    approvalNotes:
      "Review with executive brief timing before changing this schedule; the brief depends on fresh recaps.",
  },
  {
    key: "source_rag_health",
    title: "Source RAG health check",
    description: "Check source freshness, embedding backlog, compiler backlog, and persisted alerts.",
    runtimeOwner: "render-cron",
    existingRenderCronName: "alleato-source-rag-health",
    currentSchedule: "5 */4 * * *",
    supportedKeywords: ["source rag health", "rag health", "source health", "pipeline health"],
    approvalNotes:
      "Health schedules can be frequent, but alert delivery and remediation webhooks must remain configured.",
  },
  {
    key: "microsoft_executive_assistant_check",
    title: "Microsoft executive assistant check",
    description: "Run the Microsoft Executive Assistant check for Brandon-facing email triage.",
    runtimeOwner: "render-cron",
    existingRenderCronName: "alleato-microsoft-executive-assistant-check",
    currentSchedule: "render.yaml",
    supportedKeywords: ["executive assistant", "email triage", "brandon email", "microsoft assistant"],
    approvalNotes:
      "Confirm mailbox scope, write policy, and Teams/email delivery settings before changing cadence.",
  },
  {
    key: "graph_sync",
    title: "Microsoft Graph sync",
    description: "Sync Outlook, Teams, and Microsoft Graph source data.",
    runtimeOwner: "render-cron",
    existingRenderCronName: "alleato-graph-sync",
    currentSchedule: "render.yaml",
    supportedKeywords: ["graph sync", "outlook sync", "teams sync", "microsoft sync"],
    approvalNotes:
      "Graph sync changes can affect ingestion volume and provider throttling; review backend sync windows first.",
  },
];

export function matchAutomationBlueprint(input: string): AutomationBlueprintDefinition | null {
  const lower = input.toLowerCase();
  return (
    AUTOMATION_BLUEPRINT_CATALOG.find((blueprint) =>
      blueprint.supportedKeywords.some((keyword) => lower.includes(keyword)),
    ) ?? null
  );
}
