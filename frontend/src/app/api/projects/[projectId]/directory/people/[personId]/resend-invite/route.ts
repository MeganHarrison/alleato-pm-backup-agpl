import { withApiGuardrails } from "@/lib/guardrails/api";
import { GuardrailError } from "@/lib/guardrails/errors";
import { NextResponse } from "next/server";
import { createClient, getApiRouteUser } from "@/lib/supabase/server";
import { InviteService } from "@/services/inviteService";
import { apiErrorResponse } from "@/lib/api-error";

export const POST = withApiGuardrails<{ projectId: string; personId: string }>(
  "projects/[projectId]/directory/people/[personId]/resend-invite#POST",
  async ({ request, params }) => {
  
    const { projectId, personId } = await params;
    const supabase = await createClient();

    // Check authentication
    const user = await getApiRouteUser();
    if (!user) {
      throw new GuardrailError({ code: "AUTH_EXPIRED", where: "projects/[projectId]/directory/people/[personId]/resend-invite#POST", message: "Authentication required." });
    }

    const inviteService = new InviteService(supabase);
    const result = await inviteService.resendInvite(projectId, personId);

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || "Failed to resend invite" },
        { status: 400 },
      );
    }

    return NextResponse.json(
      {
        user_id: personId,
        status: "invited",
        message: result.message || "Invitation resent successfully",
      },
      { status: 200 },
    );
    },
);
