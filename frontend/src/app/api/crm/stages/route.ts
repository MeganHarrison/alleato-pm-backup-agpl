import { NextResponse } from "next/server";

import { apiErrorResponse } from "@/lib/api-error";
import { withApiGuardrails } from "@/lib/guardrails/api";
import { createClient } from "@/lib/supabase/server";

export const GET = withApiGuardrails("crm/stages#GET", async () => {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("crm_pipeline_stages")
    .select("id, name, sort_order, is_terminal, outcome")
    .order("sort_order", { ascending: true });

  if (error) {
    return apiErrorResponse(error);
  }

  return NextResponse.json({ data: data ?? [] });
});
