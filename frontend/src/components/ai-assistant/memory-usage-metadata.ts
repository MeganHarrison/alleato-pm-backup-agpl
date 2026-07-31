import type { MemoryUsage } from "./memory-usage-disclosure";

export interface MemoryUsageMetadataMessage {
  id: string;
  metadata?: {
    response_message_id?: unknown;
    memory_usage?: MemoryUsage;
  } | null;
}

function metadataMessageIds(msg: MemoryUsageMetadataMessage): string[] {
  const ids = new Set<string>([msg.id]);
  const responseMessageId = msg.metadata?.response_message_id;
  if (typeof responseMessageId === "string" && responseMessageId.trim()) {
    ids.add(responseMessageId);
  }
  return Array.from(ids);
}

export function extractMemoryUsage(
  messages: MemoryUsageMetadataMessage[],
): Record<string, MemoryUsage> {
  const usageByMessageId: Record<string, MemoryUsage> = {};
  messages.forEach((msg) => {
    const usage = msg.metadata?.memory_usage;
    if (usage && typeof usage.totalUsed === "number") {
      for (const messageId of metadataMessageIds(msg)) {
        usageByMessageId[messageId] = usage;
      }
    }
  });
  return usageByMessageId;
}
