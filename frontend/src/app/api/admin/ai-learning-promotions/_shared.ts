import { GuardrailError } from "@/lib/guardrails/errors";
import { createClient, getApiRouteUser } from "@/lib/supabase/server";

export async function requireAiLearningPromotionsAdmin(where: string) {
  const supabase = await createClient();
  const user = await getApiRouteUser();
  const userError = null as Error | null;

  if (userError || !user) {
    throw new GuardrailError({
      code: "AUTH_EXPIRED",
      where,
      message: "Sign in before reviewing AI learning promotions.",
      status: 401,
      details: userError?.message,
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
      where,
      message: "Admin access is required to review AI learning promotions.",
      status: 403,
      details: profileError?.message,
    });
  }

  return user;
}
