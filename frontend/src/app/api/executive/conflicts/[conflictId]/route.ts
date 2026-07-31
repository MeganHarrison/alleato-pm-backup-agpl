import { NextResponse } from "next/server";

import { requireCurrentUserExecutiveDetail } from "@/lib/executive/executive-visibility";
import { resolveExecutiveClaimConflict } from "@/lib/executive/executive-attention-conflicts";
import { resolveExecutiveConflictRequestSchema } from "@/lib/executive/executive-conflict-contract";
import { loadExecutiveConflictFeed } from "@/lib/executive/executive-conflicts";
import { GuardrailError } from "@/lib/guardrails/errors";
import { parseJsonBody, withApiGuardrails } from "@/lib/guardrails/api";
import { createServiceClient } from "@/lib/supabase/service";

export const PATCH = withApiGuardrails(
  "api.executive.conflicts.[conflictId].PATCH",
  async ({ request, params }) => {
    const { user } = await requireCurrentUserExecutiveDetail("api.executive.conflicts.[conflictId].PATCH");
    const { conflictId } = await params;
    const body = await parseJsonBody(request, resolveExecutiveConflictRequestSchema, "api.executive.conflicts.[conflictId].PATCH");
    const feed = await loadExecutiveConflictFeed();
    const conflict = feed.conflicts.find((item) => item.id === conflictId);
    const attention = conflict?.attentionId ? feed.attention.find((item) => item.id === conflict.attentionId) : null;
    if (feed.canonicalPacket.id !== body.briefId || !conflict || !attention || ["resolved", "dismissed"].includes(conflict.status) || ["resolved", "dismissed"].includes(attention.lifecycle)) {
      throw new GuardrailError({ code: "PRECONDITION_FAILED", where: "api.executive.conflicts.[conflictId].PATCH", status: 409, message: "This conflict is not an open conflict attached to Executive Attention on the current canonical Daily Brief." });
    }
    await resolveExecutiveClaimConflict(createServiceClient(), {
      id: conflictId,
      actor_label: user.email || user.id,
      actor_user_id: user.id,
      actor_kind: "human",
      resolution_summary: body.resolutionSummary,
      dismiss: body.dismiss ?? false,
    }, { current_operational_meaning: body.currentOperationalMeaning });
    return NextResponse.json({ success: true });
  },
);
