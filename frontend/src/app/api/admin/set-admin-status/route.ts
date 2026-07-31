import { withApiGuardrails } from "@/lib/guardrails/api";
import { GuardrailError } from "@/lib/guardrails/errors";
import { NextResponse } from "next/server";
import { createClient, getApiRouteUser } from "@/lib/supabase/server";
import { apiErrorResponse } from "@/lib/api-error";
import { logger } from "@/lib/logger";

export const POST = withApiGuardrails(
  "admin/set-admin-status#POST",
  async ({ request }) => {
  
    const supabase = await createClient();

    // Verify the requesting user is an admin
    const user = await getApiRouteUser();

    if (!user) {
      throw new GuardrailError({ code: "AUTH_EXPIRED", where: "admin/set-admin-status#POST", message: "Authentication required." });
    }

    // Check if requesting user is admin
    const { data: requestingUserProfile } = await supabase
      .from("user_profiles")
      .select("is_admin")
      .eq("id", user.id)
      .maybeSingle();

    if (!requestingUserProfile?.is_admin) {
      return NextResponse.json(
        { error: "Only admins can modify admin status" },
        { status: 403 }
      );
    }

    // Get the target user's auth_user_id and new admin status
    const body = await request.json();
    const { auth_user_id, is_admin } = body;

    if (!auth_user_id || typeof is_admin !== "boolean") {
      return NextResponse.json(
        { error: "auth_user_id and is_admin are required" },
        { status: 400 }
      );
    }

    // Update the user_profiles table
    const { error: updateError } = await supabase
      .from("user_profiles")
      .update({ is_admin, updated_at: new Date().toISOString() })
      .eq("id", auth_user_id);

    if (updateError) {
      logger.error({ msg: "[SetAdminStatus] Error updating profile:", data: updateError });
      return NextResponse.json(
        { error: "Failed to update admin status" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: `User ${is_admin ? "granted" : "removed"} admin access`,
    });
    },
);
