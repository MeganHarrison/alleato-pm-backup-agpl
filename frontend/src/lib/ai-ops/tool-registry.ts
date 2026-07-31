import type { ToolDefinition, ToolPolicy } from "./contracts";
import { toolDefinitionsForWorkflow } from "@/lib/ai/tool-registry";
import {
  EXECUTIVE_DAILY_BRIEF_ALLOWED_TOOLS,
  EXECUTIVE_DAILY_BRIEF_WORKFLOW,
  EXECUTIVE_DAILY_BRIEF_WORKFLOW_ID,
} from "./executive-daily-brief-workflow";

export const EXECUTIVE_DAILY_BRIEF_TOOL_REGISTRY =
  toolDefinitionsForWorkflow({
    workflowId: EXECUTIVE_DAILY_BRIEF_WORKFLOW_ID,
    allowedToolNames: EXECUTIVE_DAILY_BRIEF_ALLOWED_TOOLS,
  });

export function createExecutiveDailyBriefToolPolicy(input: {
  actorMode?: ToolPolicy["actorMode"];
  allowDelivery: boolean;
  allowWrites: boolean;
  allowedProjectIds?: number[] | null;
  allowedSourceFamilies?: ToolPolicy["allowedSourceFamilies"];
  allowedChannels?: Array<"teams" | "email">;
}): ToolPolicy {
  const allowedChannels =
    input.allowedChannels ??
    EXECUTIVE_DAILY_BRIEF_WORKFLOW.deliveryPolicy.allowedChannels;
  const requiredSourceFamilies =
    EXECUTIVE_DAILY_BRIEF_WORKFLOW.sourcePolicy.requiredSourceFamilies;
  const allowedSourceFamilies = input.allowedSourceFamilies
    ? requiredSourceFamilies.filter((sourceFamily) =>
        input.allowedSourceFamilies?.includes(sourceFamily),
      )
    : requiredSourceFamilies;

  if (allowedSourceFamilies.length === 0) {
    throw new Error(
      "Executive Daily Brief tool policy must allow at least one workflow source family.",
    );
  }

  return {
    workflowId: EXECUTIVE_DAILY_BRIEF_WORKFLOW_ID,
    allowedToolNames: EXECUTIVE_DAILY_BRIEF_TOOL_REGISTRY.map(
      (toolDefinition) => toolDefinition.name,
    ),
    actorMode: input.actorMode ?? "service",
    allowedProjectIds: input.allowedProjectIds ?? null,
    allowedSourceFamilies,
    allowDelivery: input.allowDelivery,
    allowWrites: input.allowWrites,
    metadata: {
      allowedChannels,
      workflowVersion: EXECUTIVE_DAILY_BRIEF_WORKFLOW.version,
    },
  };
}

export function visibleToolsForPolicy(
  registry: ToolDefinition[],
  policy: ToolPolicy,
) {
  const allowedNames = new Set(policy.allowedToolNames);
  const allowedChannels = new Set(
    Array.isArray(policy.metadata.allowedChannels)
      ? policy.metadata.allowedChannels
      : [],
  );

  return registry.filter((toolDefinition) => {
    if (!allowedNames.has(toolDefinition.name)) return false;
    const metadata = toolDefinition.metadata ?? {};
    const sourceFamilies = Array.isArray(metadata.sourceFamilies)
      ? metadata.sourceFamilies.filter(
          (sourceFamily): sourceFamily is ToolPolicy["allowedSourceFamilies"][number] =>
            typeof sourceFamily === "string",
        )
      : [];
    if (
      sourceFamilies.length > 0 &&
      !sourceFamilies.some((sourceFamily) =>
        policy.allowedSourceFamilies.includes(sourceFamily),
      )
    ) {
      return false;
    }
    const channel =
      typeof metadata.channel === "string"
        ? metadata.channel
        : null;
    if (channel && allowedChannels.size > 0 && !allowedChannels.has(channel)) {
      return false;
    }
    if (metadata.deliveryTool === true) {
      return policy.allowDelivery && policy.allowWrites;
    }
    return true;
  });
}

export function executiveDailyBriefToolScope(input: {
  actorMode?: ToolPolicy["actorMode"];
  allowDelivery: boolean;
  allowWrites: boolean;
  allowedProjectIds?: number[] | null;
  allowedSourceFamilies?: ToolPolicy["allowedSourceFamilies"];
  allowedChannels?: Array<"teams" | "email">;
}) {
  const policy = createExecutiveDailyBriefToolPolicy({
    actorMode: input.actorMode,
    allowDelivery: input.allowDelivery,
    allowWrites: input.allowWrites,
    allowedProjectIds: input.allowedProjectIds,
    allowedSourceFamilies: input.allowedSourceFamilies,
    allowedChannels: input.allowedChannels,
  });
  const visibleTools = visibleToolsForPolicy(
    EXECUTIVE_DAILY_BRIEF_TOOL_REGISTRY,
    policy,
  );

  return {
    policy,
    visibleToolNames: visibleTools.map((toolDefinition) => toolDefinition.name),
    hiddenToolNames: EXECUTIVE_DAILY_BRIEF_TOOL_REGISTRY.map(
      (toolDefinition) => toolDefinition.name,
    ).filter(
      (toolName) =>
        !visibleTools.some((toolDefinition) => toolDefinition.name === toolName),
    ),
  };
}
