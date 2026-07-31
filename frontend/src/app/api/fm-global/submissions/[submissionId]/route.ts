/**
 * FM Global form submissions — single-row endpoint.
 * DELETE /api/fm-global/submissions/[submissionId] — remove a submission.
 */

import { NextResponse } from "next/server";
import { withApiGuardrails } from "@/lib/guardrails/api";
import { GuardrailError } from "@/lib/guardrails/errors";
import { getApiRouteUser } from "@/lib/supabase/server";
import { createAsrsServiceClient } from "@/lib/supabase/service";

export const dynamic = "force-dynamic";

interface RouteContext {
  params: Promise<{ submissionId: string }>;
}

export const DELETE = withApiGuardrails<RouteContext["params"]>(
  "fm-global/submissions/[submissionId]#DELETE",
  async ({ params }) => {
    // fm_form_submissions lives in the ASRS project, not PM APP.
    const supabase = createAsrsServiceClient();

    const user = await getApiRouteUser();

    if (!user) {
      throw new GuardrailError({
        code: "AUTH_EXPIRED",
        where: "fm-global/submissions/[submissionId]#DELETE",
        message: "Authentication required.",
      });
    }

    const { submissionId } = await params;
    if (!submissionId) {
      throw new GuardrailError({
        code: "INVALID_PAYLOAD",
        where: "fm-global/submissions/[submissionId]#DELETE",
        message: "submissionId is required.",
      });
    }

    const { error } = await supabase
      .from("fm_form_submissions")
      .delete()
      .eq("id", submissionId);

    if (error) {
      throw new GuardrailError({
        code: "DB_ERROR",
        where: "fm-global/submissions/[submissionId]#DELETE",
        message: error.message,
      });
    }

    return NextResponse.json({ ok: true });
  },
);
