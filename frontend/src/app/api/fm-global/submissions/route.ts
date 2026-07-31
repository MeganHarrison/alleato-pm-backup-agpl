/**
 * FM Global form submissions — list endpoint.
 * GET /api/fm-global/submissions
 */

import { NextResponse } from "next/server";
import { withApiGuardrails } from "@/lib/guardrails/api";
import { GuardrailError } from "@/lib/guardrails/errors";
import { getApiRouteUser } from "@/lib/supabase/server";
import { createAsrsServiceClient } from "@/lib/supabase/service";

export const dynamic = "force-dynamic";

export const GET = withApiGuardrails("fm-global/submissions#GET", async () => {
  // fm_form_submissions lives in the ASRS project, not PM APP.
  const supabase = createAsrsServiceClient();

  const user = await getApiRouteUser();

  if (!user) {
    throw new GuardrailError({
      code: "AUTH_EXPIRED",
      where: "fm-global/submissions#GET",
      message: "Authentication required.",
    });
  }

  const { data, error } = await supabase
    .from("fm_form_submissions")
    .select(
      "id,created_at,updated_at,contact_info,project_details,user_input,matched_table_ids,lead_status,lead_score",
    )
    .order("created_at", { ascending: false });

  if (error) {
    throw new GuardrailError({
      code: "DB_ERROR",
      where: "fm-global/submissions#GET",
      message: error.message,
    });
  }

  return NextResponse.json({ data: data ?? [] });
});
