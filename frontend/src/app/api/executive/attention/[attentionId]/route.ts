import { NextResponse } from "next/server";
import { z } from "zod";

import {
  resolveExecutiveAttentionItem,
  transitionExecutiveAttentionItem,
} from "@/lib/executive/executive-attention-conflicts";
import { requireCurrentUserExecutiveDetail } from "@/lib/executive/executive-visibility";
import { parseJsonBody, withApiGuardrails } from "@/lib/guardrails/api";
import { createServiceClient } from "@/lib/supabase/service";

const transitionSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("acknowledge") }),
  z.object({ action: z.literal("start") }),
  z.object({ action: z.literal("escalate"), escalationLevel: z.number().int().min(1).max(3) }),
  z.object({ action: z.literal("resolve"), resolutionSummary: z.string().trim().min(4).max(2_000) }),
  z.object({ action: z.literal("dismiss"), resolutionSummary: z.string().trim().min(4).max(2_000) }),
]);

export const PATCH = withApiGuardrails(
  "api.executive.attention.[attentionId].PATCH",
  async ({ request, params }) => {
    const { user } = await requireCurrentUserExecutiveDetail("api.executive.attention.[attentionId].PATCH");
    const { attentionId } = await params;
    const body = await parseJsonBody(
      request,
      transitionSchema,
      "api.executive.attention.[attentionId].PATCH",
    );
    const db = createServiceClient();
    const actorLabel = user.email || user.id;
    if (body.action === "resolve" || body.action === "dismiss") {
      await resolveExecutiveAttentionItem(db, {
        id: attentionId,
        actor_label: actorLabel,
        actor_user_id: user.id,
        actor_kind: "human",
        resolution_summary: body.resolutionSummary,
        dismiss: body.action === "dismiss",
      });
    } else {
      await transitionExecutiveAttentionItem(db, {
        id: attentionId,
        actor_label: actorLabel,
        actor_user_id: user.id,
        actor_kind: "human",
        lifecycle: body.action === "acknowledge" ? "acknowledged" : body.action === "start" ? "in_progress" : "escalated",
        escalation_level: body.action === "escalate" ? body.escalationLevel : undefined,
        assigned_at: new Date().toISOString(),
      });
    }
    return NextResponse.json({ success: true });
  },
);
