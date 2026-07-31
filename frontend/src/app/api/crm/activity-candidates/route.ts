import { NextResponse } from "next/server";

import { apiErrorResponse } from "@/lib/api-error";
import { requireCrmAccess } from "@/lib/crm/server";
import { withApiGuardrails } from "@/lib/guardrails/api";

export const GET = withApiGuardrails("crm/activity-candidates#GET", async ({ request }) => {
  const { db } = await requireCrmAccess("admin");
  const status = request.nextUrl.searchParams.get("status") ?? "pending";
  const { data, error } = await db
    .from("crm_activity_candidates")
    .select("*")
    .eq("visibility_scope", "standard")
    .eq("status", status)
    .order("created_at", { ascending: true })
    .limit(250);
  if (error) return apiErrorResponse(error);
  return NextResponse.json({ data: data ?? [] });
});
