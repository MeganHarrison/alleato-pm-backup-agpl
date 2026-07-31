import { NextResponse } from "next/server";

import { requireCurrentUserExecutiveDetail } from "@/lib/executive/executive-visibility";
import {
  loadCurrentDailyExecutiveBriefPacket,
  toCanonicalDailyBriefApiResponse,
} from "@/lib/daily-briefs/canonical-packets";
import { withApiGuardrails } from "@/lib/guardrails/api";

export const GET = withApiGuardrails(
  "/api/executive/daily-brief/widget#GET",
  async () => {
    await requireCurrentUserExecutiveDetail("/api/executive/daily-brief/widget#GET");

    const packet = await loadCurrentDailyExecutiveBriefPacket();

    return NextResponse.json({
      ...toCanonicalDailyBriefApiResponse(packet),
      widget: {
        type: "daily_executive_brief_packet",
        title: packet.title,
        summary: packet.executiveSummary,
        sourceCount: packet.sourceCount,
        businessDate: packet.businessDate,
      },
    });
  },
);
