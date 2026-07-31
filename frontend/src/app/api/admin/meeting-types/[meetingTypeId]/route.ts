import { NextResponse } from "next/server";

import { requireAppAdmin } from "@/lib/auth/require-app-admin";
import { withApiGuardrails } from "@/lib/guardrails/api";
import { GuardrailError } from "@/lib/guardrails/errors";
import { assertNonNilUuid } from "@/lib/guardrails/path-params";
import { createServiceClient } from "@/lib/supabase/service";

const WHERE = "admin/meeting-types/[meetingTypeId]";

export const DELETE = withApiGuardrails<{ meetingTypeId: string }>(
  `${WHERE}#DELETE`,
  async ({ params }) => {
    await requireAppAdmin(`${WHERE}#DELETE`);
    assertNonNilUuid(params.meetingTypeId, "meetingTypeId", `${WHERE}#DELETE`);
    const service = createServiceClient();
    const { data, error } = await service
      .from("company_meeting_types")
      .update({ archived_at: new Date().toISOString() })
      .eq("id", params.meetingTypeId)
      .is("archived_at", null)
      .select("id, name, archived_at")
      .maybeSingle();
    if (error) throw new GuardrailError({ code: "INTERNAL_ERROR", where: `${WHERE}#DELETE`, message: `Failed to archive meeting type: ${error.message}`, details: error });
    if (!data) throw new GuardrailError({ code: "NOT_FOUND", where: `${WHERE}#DELETE`, message: "Meeting type was not found or is already archived.", status: 404 });
    return NextResponse.json({ meetingType: data });
  },
);
