import { withApiGuardrails } from "@/lib/guardrails/api";
import { GuardrailError } from "@/lib/guardrails/errors";
import { apiErrorResponse } from "@/lib/api-error";
import { createClient, getApiRouteUser } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export const GET = withApiGuardrails("team-chat/users#GET", async () => {
  const supabase = await createClient();
  const user = await getApiRouteUser();

  if (!user) {
    throw new GuardrailError({
      code: "AUTH_EXPIRED",
      where: "team-chat/users#GET",
      message: "Authentication required.",
    });
  }

  const { data: profile, error: profileError } = await supabase
    .from("user_profiles")
    .select("is_admin")
    .eq("id", user.id)
    .single();

  if (profileError || !profile?.is_admin) {
    throw new GuardrailError({
      code: "FORBIDDEN",
      where: "team-chat/users#GET",
      message: "Admin access required.",
      status: 403,
    });
  }

  const { data: users, error } = await supabase
    .from("user_profiles")
    .select("id, full_name, email")
    .order("full_name", { ascending: true });

  if (error) {
    return apiErrorResponse(error);
  }

  return NextResponse.json(
    (users ?? [])
      .filter((u) => u.id !== user.id)
      .map((u) => ({
        id: u.id,
        name: u.full_name ?? u.email ?? "Unknown",
      })),
  );
});
