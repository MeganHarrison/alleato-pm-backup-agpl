import { NextResponse } from "next/server";
import { apiErrorResponse } from "@/lib/api-error";
import { createClient, getApiRouteUser } from "@/lib/supabase/server";

export async function POST() {
  try {
    const supabase = await createClient();
    const user = await getApiRouteUser();

    if (!user) {
      return NextResponse.json(
        { success: false, error_code: "AUTH_EXPIRED", error_message: "Unauthorized" },
        { status: 401 },
      );
    }

    const { error } = await supabase
      .from("user_profiles")
      .update({ onboarding_completed_at: new Date().toISOString() })
      .eq("id", user.id)
      .is("onboarding_completed_at", null);

    if (error) {
      return apiErrorResponse(error);
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[onboarding] failed to mark onboarding complete", {
      error: error instanceof Error ? error.message : String(error),
    });
    return apiErrorResponse(error);
  }
}
