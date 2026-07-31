import { NextResponse } from "next/server";
import { withApiGuardrails } from "@/lib/guardrails/api";
import { requireCurrentUserAppCapability } from "@/lib/app-capabilities";
import {
  loadCurrentDailyExecutiveBriefPacket,
  toCanonicalDailyBriefApiResponse,
} from "@/lib/daily-briefs/canonical-packets";

export const GET = withApiGuardrails(
  "/api/executive/intelligence-brief#GET",
  async ({ request }) => {
    await requireCurrentUserAppCapability(
      "view_executive_briefing",
      "/api/executive/intelligence-brief#GET",
      "Executive briefing access required.",
    );

    const packet = await loadCurrentDailyExecutiveBriefPacket();
    return NextResponse.json(toCanonicalDailyBriefApiResponse(packet));
  },
);
