import { NextResponse } from "next/server";

import { validateResponseContract, withApiGuardrails } from "@/lib/guardrails/api";
import { GuardrailError } from "@/lib/guardrails/errors";
import { getApiRouteUser } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { loadCurrentUserProfilePayload } from "@/lib/users/current-user-profile-server";
import { z } from "zod";

const CurrentUserProfileSchema = z.object({
  id: z.string(),
  personId: z.string().nullable(),
  fullName: z.string(),
  email: z.string(),
  avatarUrl: z.string().optional(),
  company: z.string().optional(),
  title: z.string().optional(),
  role: z.string().optional(),
  phone: z.string().optional(),
  profileCompleteness: z.number(),
  isAdmin: z.boolean(),
  isDeveloper: z.boolean(),
  onboardingCompletedAt: z.string().nullable(),
});

export const GET = withApiGuardrails("/api/users/me/profile#GET", async () => {
  const user = await getApiRouteUser();

  if (!user) {
    throw new GuardrailError({
      code: "AUTH_EXPIRED",
      where: "/api/users/me/profile#GET",
      message: "Sign in before loading your profile.",
      status: 401,
    });
  }

  const supabase = createServiceClient();
  const responsePayload = validateResponseContract(
    CurrentUserProfileSchema,
    await loadCurrentUserProfilePayload({
      serviceClient: supabase,
      user,
      where: "/api/users/me/profile#GET",
    }),
    "/api/users/me/profile#GET",
  );

  return NextResponse.json({ profile: responsePayload });
});
