import "server-only";

import { redirect } from "next/navigation";

import { getCurrentUser } from "@/lib/auth/current-user";
import { GuardrailError } from "@/lib/guardrails/errors";
import { createClient } from "@/lib/supabase/server";

async function loadTrainingReviewerAccess(where: string) {
  const user = await getCurrentUser();
  if (!user) {
    return { userId: null, allowed: false };
  }

  const { data, error } = await (
    await createClient()
  ).rpc("current_is_app_admin");
  if (error) {
    throw new GuardrailError({
      code: "UPSTREAM_FAILURE",
      where,
      message: `Training reviewer access check failed: ${error.message}`,
    });
  }

  return { userId: user.id, allowed: data === true };
}

export async function canCurrentUserReviewTraining() {
  return (await loadTrainingReviewerAccess("training.reviewerAccess")).allowed;
}

export async function requireTrainingReviewer(where: string) {
  const access = await loadTrainingReviewerAccess(where);
  if (!access.userId) {
    throw new GuardrailError({
      code: "AUTH_EXPIRED",
      where,
      message: "Sign in before accessing training review controls.",
      status: 401,
    });
  }
  if (!access.allowed) {
    throw new GuardrailError({
      code: "FORBIDDEN",
      where,
      message: "Training reviewer access required.",
      status: 403,
    });
  }

  return access.userId;
}

export async function requireTrainingReviewerPageAccess() {
  const access = await loadTrainingReviewerAccess(
    "training.requireReviewerPageAccess",
  );
  if (!access.userId) {
    redirect("/auth/login");
  }
  if (!access.allowed) {
    redirect("/access-denied?reason=training-reviewer");
  }

  return access.userId;
}
