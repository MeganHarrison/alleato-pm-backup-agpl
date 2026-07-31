import type { PacketFreshnessStatus } from "@/lib/ai/intelligence/types";

export function currentPacketFreshnessStatus(input: {
  freshnessStatus: PacketFreshnessStatus;
  isStale: boolean;
}): PacketFreshnessStatus {
  return input.isStale ? "stale" : input.freshnessStatus;
}
