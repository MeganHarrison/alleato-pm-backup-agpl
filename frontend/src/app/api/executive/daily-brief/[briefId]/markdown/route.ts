import { NextResponse } from "next/server";

import { requireCurrentUserExecutiveDetail } from "@/lib/executive/executive-visibility";
import { loadDailyExecutiveBriefPacketById } from "@/lib/daily-briefs/canonical-packets";
import { withApiGuardrails } from "@/lib/guardrails/api";
import { GuardrailError } from "@/lib/guardrails/errors";

const WHERE = "/api/executive/daily-brief/[briefId]/markdown#GET";

/** The exact Markdown written and persisted by the canonical Deep Read. */
export const GET = withApiGuardrails<{ briefId: string }>(WHERE, async ({ params }) => {
  await requireCurrentUserExecutiveDetail(WHERE);

  const { briefId } = await params;
  const packet = await loadDailyExecutiveBriefPacketById(briefId);
  if (!packet) {
    throw new GuardrailError({ code: "NOT_FOUND", where: WHERE, message: "Daily Brief Markdown artifact not found.", status: 404 });
  }

  return new NextResponse(packet.briefMarkdown, {
    headers: {
      "Content-Type": "text/markdown; charset=utf-8",
      "Content-Disposition": `inline; filename="daily-executive-brief-${packet.businessDate}.md"`,
      "X-Content-Type-Options": "nosniff",
    },
  });
});
