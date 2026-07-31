export const dynamic = "force-dynamic";

import { z } from "zod";
import { withApiGuardrails, parseJsonBody } from "@/lib/guardrails/api";
import { GuardrailError } from "@/lib/guardrails/errors";
import { getApiRouteUser } from "@/lib/supabase/server";
import {
  createContentCalendarDraft,
  getMarketingCalendar,
} from "@/lib/ai/services/marketing-service";
import { marketingError } from "../_utils";

const WHERE_GET = "ai-assistant/marketing/calendar#GET";
const WHERE_POST = "ai-assistant/marketing/calendar#POST";

const calendarStatusSchema = z.enum([
  "draft",
  "needs_review",
  "approved",
  "scheduled",
  "published",
  "archived",
]);

const createCalendarSchema = z.object({
  weekStartDate: z.string().min(1),
  items: z.array(z.object({
    plannedDate: z.string().optional(),
    channel: z.enum(["linkedin", "blog", "email", "website", "case_study", "video", "presentation", "internal"]),
    funnelStage: z.enum(["awareness", "consideration", "conversion", "retention", "reputation"]).default("awareness"),
    title: z.string().min(1),
    angle: z.string().min(1),
    targetAudience: z.string().optional(),
    projectId: z.number().nullable().optional(),
    companyId: z.string().nullable().optional(),
    sourceItemIds: z.array(z.string()).default([]),
    rationale: z.string().min(1),
    status: calendarStatusSchema.default("needs_review"),
  })).min(1),
});

function parseNumberParam(value: string | null): number | null {
  if (!value) return null;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : null;
}

async function requireUser(where: string) {
  const user = await getApiRouteUser();
  if (!user) {
    throw new GuardrailError({
      code: "AUTH_EXPIRED",
      where,
      message: "Authentication required to manage marketing content.",
    });
  }
  return user;
}

export const GET = withApiGuardrails(WHERE_GET, async ({ request }) => {
  await requireUser(WHERE_GET);
  const { searchParams } = new URL(request.url);

  try {
    const items = await getMarketingCalendar({
      dateRange: {
        start: searchParams.get("start") ?? undefined,
        end: searchParams.get("end") ?? undefined,
      },
      status: searchParams.get("status"),
      projectId: parseNumberParam(searchParams.get("projectId")),
    });
    return Response.json({ items });
  } catch (error) {
    throw marketingError(error, WHERE_GET);
  }
});

export const POST = withApiGuardrails(WHERE_POST, async ({ request }) => {
  const user = await requireUser(WHERE_POST);
  const body = await parseJsonBody(request, createCalendarSchema, WHERE_POST);

  try {
    const items = await createContentCalendarDraft({
      weekStartDate: body.weekStartDate,
      createdBy: user.id,
      items: body.items.map((item) => ({
        plannedDate: item.plannedDate,
        channel: item.channel,
        funnel_stage: item.funnelStage,
        title: item.title,
        angle: item.angle,
        target_audience: item.targetAudience ?? null,
        project_id: item.projectId ?? null,
        company_id: item.companyId ?? null,
        source_item_ids: item.sourceItemIds,
        rationale: item.rationale,
        status: item.status,
      })),
    });
    return Response.json({ items }, { status: 201 });
  } catch (error) {
    throw marketingError(error, WHERE_POST);
  }
});
