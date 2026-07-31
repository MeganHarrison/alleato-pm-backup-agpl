import { NextResponse } from "next/server";
import { withApiGuardrails } from "@/lib/guardrails/api";
import { GuardrailError } from "@/lib/guardrails/errors";
import { createClient, getApiRouteUser } from "@/lib/supabase/server";
import { getActiveManpowerPayload, hydrateAssignmentUpdate } from "@/features/manpower/server";
import type { ManpowerAssignment } from "@/features/manpower/types";

type UpdateBody = {
  assigneePersonId?: string | null;
  assigneeName?: string | null;
  status?: ManpowerAssignment["status"];
  notes?: string | null;
};

export const PATCH = withApiGuardrails<{ assignmentId: string }>(
  "manpower/assignments/[assignmentId]#PATCH",
  async ({ request, params }) => {
    const supabase = await createClient();
    const user = await getApiRouteUser();

    if (!user) {
      throw new GuardrailError({
        code: "AUTH_EXPIRED",
        where: "manpower/assignments/[assignmentId]#PATCH",
        message: "Authentication required.",
      });
    }

    const { assignmentId } = await params;
    const body = (await request.json()) as UpdateBody;
    const updates = await hydrateAssignmentUpdate(supabase, body);

    const { error } = await supabase
      .from("manpower_assignments")
      .update(updates)
      .eq("id", assignmentId);

    if (error) {
      return NextResponse.json(
        { error: error.message },
        { status: 422 },
      );
    }

    const payload = await getActiveManpowerPayload(supabase);
    return NextResponse.json(payload);
  },
);
