import { NextResponse } from "next/server";

import { requireCurrentUserExecutiveDetail } from "@/lib/executive/executive-visibility";
import {
  listDailyExecutiveBriefPackets,
  toDailyBriefHistoryItem,
} from "@/lib/daily-briefs/canonical-packets";
import type { DailyBriefHistoryResponse } from "@/lib/daily-briefs/types";
import { withApiGuardrails } from "@/lib/guardrails/api";

export const GET = withApiGuardrails(
  "/api/executive/daily-brief/history#GET",
  async () => {
    await requireCurrentUserExecutiveDetail("/api/executive/daily-brief/history#GET");

    const packets = await listDailyExecutiveBriefPackets();
    // Regeneration snapshots the superseded packet. History is a document
    // library, not a packet audit log, so expose one authoritative report per
    // business date: the newest packet returned by the descending query.
    const latestByBusinessDate = new Map<string, (typeof packets)[number]>();
    for (const packet of packets) {
      if (!latestByBusinessDate.has(packet.businessDate)) {
        latestByBusinessDate.set(packet.businessDate, packet);
      }
    }

    return NextResponse.json({
      briefs: [...latestByBusinessDate.values()].map(toDailyBriefHistoryItem),
    } satisfies DailyBriefHistoryResponse);
  },
);
