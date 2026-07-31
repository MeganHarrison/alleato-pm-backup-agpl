import { isOwnerEmail } from "@/lib/auth/owner";
import { GuardrailError } from "@/lib/guardrails/errors";
import { getApiRouteUser } from "@/lib/supabase/server";

export async function requireTrainingDataAdmin(where: string) {
  const user = await getApiRouteUser();
  if (!user) {
    throw new GuardrailError({
      code: "AUTH_EXPIRED",
      where,
      status: 401,
      message: "Sign in before managing training data.",
    });
  }
  if (!isOwnerEmail(user.email)) {
    throw new GuardrailError({
      code: "FORBIDDEN",
      where,
      status: 403,
      message: "Training data management is restricted to the workspace owner.",
    });
  }
  return user.id;
}
