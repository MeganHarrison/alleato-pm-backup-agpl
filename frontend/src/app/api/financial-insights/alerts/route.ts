import { NextResponse } from "next/server";
import { withApiGuardrails } from "@/lib/guardrails/api";
import { GuardrailError } from "@/lib/guardrails/errors";
import { getApiRouteUser } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import {
  insightCardBaseQuery,
  resolveTargetIdsForProjects,
  deriveSeverity,
  type InsightCardWithTarget,
} from "@/lib/ai/insight-cards";

/**
 * GET /api/financial-insights/alerts
 *
 * Returns financial alerts from the Pipeline B `insight_cards` table.
 *
 * Query params:
 *   ?status=open         — filter by current_status (default: "open")
 *   ?severity=critical   — optional derived-severity filter
 *   ?project_id=67       — optional project filter
 *   ?limit=50            — pagination limit (default: 50, max: 200)
 */
export const GET = withApiGuardrails("/api/financial-insights/alerts#GET", async ({ request }) => {
  const user = await getApiRouteUser();
  if (!user) {
    throw new GuardrailError({
      code: "AUTH_EXPIRED",
      where: "/api/financial-insights/alerts#GET",
      message: "Unauthorized request.",
      status: 401,
    });
  }

  const { searchParams } = new URL(request.url);

  const status = searchParams.get("status") ?? "open";
  const severity = searchParams.get("severity");
  const projectId = searchParams.get("project_id");
  const limitParam = searchParams.get("limit");
  const limit = Math.min(Math.max(parseInt(limitParam ?? "50", 10) || 50, 1), 200);

  const supabase = createServiceClient();

  // Financial alerts live under card types tied to monetary exposure.
  const financialCardTypes = ["financial_exposure", "risk", "change_management"];

  let query = insightCardBaseQuery(supabase, { includeAnyStatus: true })
    .in("card_type", financialCardTypes)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (status) {
    query = query.eq("current_status", status);
  }

  if (projectId) {
    const projectIdNum = parseInt(projectId, 10);
    if (Number.isNaN(projectIdNum)) {
      throw new GuardrailError({
        code: "INVALID_PAYLOAD",
        where: "/api/financial-insights/alerts#GET",
        message: "Invalid project_id; must be a number.",
        status: 400,
        details: { project_id: projectId },
      });
    }
    const targetMap = await resolveTargetIdsForProjects(supabase, [projectIdNum]);
    const targetId = targetMap.get(projectIdNum);
    if (!targetId) {
      return NextResponse.json({ alerts: [], total: 0 });
    }
    query = query.eq("primary_target_id", targetId);
  }

  const { data, error } = await query;

  if (error) {
    throw new GuardrailError({
      code: "INTERNAL_ERROR",
      where: "/api/financial-insights/alerts#GET",
      message: "Failed to fetch financial alerts.",
      details: { reason: error.message },
    });
  }

  let cards = (data ?? []) as unknown as InsightCardWithTarget[];

  // Derived-severity filter happens client-side because Pipeline B has no
  // severity column.
  if (severity) {
    cards = cards.filter((card) => deriveSeverity(card) === severity);
  }

  return NextResponse.json({
    alerts: cards,
    total: cards.length,
  });
});
