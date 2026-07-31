import type { SkillUsage } from "./skill-usage-disclosure";

export interface SkillUsageMetadataMessage {
  id: string;
  metadata?: {
    response_message_id?: unknown;
    skill_usage?: SkillUsage;
  } | null;
}

function metadataMessageIds(msg: SkillUsageMetadataMessage): string[] {
  const ids = new Set<string>([msg.id]);
  const responseMessageId = msg.metadata?.response_message_id;
  if (typeof responseMessageId === "string" && responseMessageId.trim()) {
    ids.add(responseMessageId);
  }
  return Array.from(ids);
}

export function extractSkillUsage(
  messages: SkillUsageMetadataMessage[],
): Record<string, SkillUsage> {
  const usageByMessageId: Record<string, SkillUsage> = {};
  messages.forEach((msg) => {
    const usage = msg.metadata?.skill_usage;
    if (
      usage &&
      typeof usage.totalSelected === "number" &&
      Array.isArray(usage.skills) &&
      usage.skills.length > 0
    ) {
      for (const messageId of metadataMessageIds(msg)) {
        usageByMessageId[messageId] = usage;
      }
    }
  });
  return usageByMessageId;
}
