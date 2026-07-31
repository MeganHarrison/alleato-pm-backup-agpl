import { NextResponse } from "next/server";

import { apiErrorResponse } from "@/lib/api-error";
import { requireCrmAccess } from "@/lib/crm/server";
import { withApiGuardrails } from "@/lib/guardrails/api";

export const GET = withApiGuardrails("crm/pipelines#GET", async () => {
  const { db } = await requireCrmAccess("read");
  const { data, error } = await db
    .from("crm_pipelines")
    .select("*, crm_stages(*)")
    .is("archived_at", null)
    .order("name");
  if (error) return apiErrorResponse(error);
  return NextResponse.json({ data: data ?? [] });
});
