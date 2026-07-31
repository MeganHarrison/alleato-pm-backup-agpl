import { NextResponse } from "next/server";

import { requireCurrentUserExecutiveDetail } from "@/lib/executive/executive-visibility";
import { previewCanonicalDailyBriefTeamsPayload } from "@/lib/daily-briefs/canonical-teams-delivery";
import { withApiGuardrails } from "@/lib/guardrails/api";

export const dynamic = "force-dynamic";

export const POST = withApiGuardrails(
  "executive/daily-brief/preview-teams#POST",
  async (): Promise<Response> => {
    await requireCurrentUserExecutiveDetail("executive/daily-brief/preview-teams#POST");

    const preview = await previewCanonicalDailyBriefTeamsPayload();
    return NextResponse.json({
      success: true,
      preview,
      sourceOfTruth: "intelligence_packets",
    });
  },
);
