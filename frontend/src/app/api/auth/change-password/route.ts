import { NextResponse } from "next/server";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";

import { withApiGuardrails } from "@/lib/guardrails/api";
import { getApiRouteUser } from "@/lib/supabase/server";
import { getSupabaseConfig } from "@/lib/supabase/config";
import { createServiceClient } from "@/lib/supabase/service";
import { passwordSchema } from "@/lib/validation/password";

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, "Enter your current password"),
  newPassword: passwordSchema,
});

export const POST = withApiGuardrails("auth/change-password#POST", async ({ request }) => {
  const user = await getApiRouteUser();
  if (!user?.id || !user.email) {
    return NextResponse.json(
      { success: false, error_message: "You must be signed in to change your password." },
      { status: 401 },
    );
  }

  const body = await request.json().catch(() => null);
  const parsed = changePasswordSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        success: false,
        error_message:
          parsed.error.issues[0]?.message ?? "Your new password does not meet the requirements.",
      },
      { status: 400 },
    );
  }

  const { currentPassword, newPassword } = parsed.data;

  if (currentPassword === newPassword) {
    return NextResponse.json(
      { success: false, error_message: "Your new password must be different from your current one." },
      { status: 400 },
    );
  }

  // Verify the current password with a throwaway client so we never mutate the
  // caller's session cookies. Wrong password => 400, not a silent overwrite.
  const { url, anonKey } = getSupabaseConfig();
  const verifyClient = createSupabaseClient(url, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { error: verifyError } = await verifyClient.auth.signInWithPassword({
    email: user.email,
    password: currentPassword,
  });
  if (verifyError) {
    return NextResponse.json(
      { success: false, error_message: "Your current password is incorrect." },
      { status: 400 },
    );
  }

  // Update via the service role so the change applies regardless of session
  // refresh state.
  const serviceClient = createServiceClient();
  const { error: updateError } = await serviceClient.auth.admin.updateUserById(user.id, {
    password: newPassword,
  });
  if (updateError) {
    console.error("[change-password] update failed", {
      userId: user.id,
      error: updateError.message,
    });
    return NextResponse.json(
      { success: false, error_message: "Could not update your password. Please try again." },
      { status: 500 },
    );
  }

  return NextResponse.json({ success: true });
});
