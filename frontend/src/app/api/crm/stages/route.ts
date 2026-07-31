import { NextResponse } from "next/server";

import { apiErrorResponse } from "@/lib/api-error";
import { requireCrmAccess } from "@/lib/crm/server";
import { withApiGuardrails } from "@/lib/guardrails/api";

export const GET = withApiGuardrails("crm/stages#GET", async () => {
  const { db } = await requireCrmAccess("read");
  const { data, error } = await db
    .from("crm_stages")
    .select("id, pipeline_id, name, sort_order, stage_type, default_probability")
    .is("archived_at", null)
    .order("sort_order", { ascending: true });
  if (error) return apiErrorResponse(error);
  return NextResponse.json({ data: data ?? [] });
});
