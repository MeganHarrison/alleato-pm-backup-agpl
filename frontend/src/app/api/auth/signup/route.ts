import { withApiGuardrails } from "@/lib/guardrails/api";
import { GuardrailError } from "@/lib/guardrails/errors";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { apiErrorResponse } from "@/lib/api-error";
import { z } from "zod";
import { passwordSchema } from "@/lib/validation/password";
import { logger } from "@/lib/logger";

// Zod schema for signup request body validation
// OWASP: Input validation for authentication endpoints (A07:2021 - Identification and Authentication Failures)
const signupSchema = z.object({
  email: z
    .string()
    .trim()
    .min(1, "Email is required")
    .email("Invalid email address")
    .max(255, "Email must be at most 255 characters"),
  password: passwordSchema,
  name: z
    .string()
    .trim()
    .max(255, "Name must be at most 255 characters")
    .optional(),
});

function getSiteUrl() {
  if (process.env.NEXT_PUBLIC_SITE_URL) {
    return process.env.NEXT_PUBLIC_SITE_URL;
  }
  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`;
  }
  if (process.env.SITE_URL) {
    return process.env.SITE_URL;
  }
  return "http://localhost:3000";
}

export const POST = withApiGuardrails(
  "auth/signup#POST",
  async ({ request }) => {
  
    const body = await request.json();

    // Validate input with Zod schema
    const result = signupSchema.safeParse(body);
    if (!result.success) {
      return NextResponse.json(
        { error: "Validation failed", details: result.error.flatten() },
        { status: 400 },
      );
    }

    const { email, password, name } = result.data;

    const supabase = await createClient();
    const serviceDb = createServiceClient();

    const displayName = name?.trim() || email.split("@")[0];

    // Create user in Supabase Auth to establish a session + OTP flow
    const { data: signUpData, error: signUpError } = await supabase.auth.signUp(
      {
        email,
        password,
        options: {
          data: { full_name: displayName },
          emailRedirectTo: `${getSiteUrl()}/auth/callback`,
        },
      },
    );

    if (signUpError) {
      // Log the real error server-side, but return a generic message to prevent email enumeration
      logger.error({ msg: "[Signup Error]", error: signUpError.message });
      return NextResponse.json(
        { message: "If this email is available, a confirmation link has been sent." },
        { status: 200 },
      );
    }

    // Check if person record exists
    const { data: existingPerson } = await serviceDb
      .from("people")
      .select("id, first_name, last_name, email")
      .eq("email", email)
      .maybeSingle();

    let personId = existingPerson?.id;

    if (!existingPerson) {
      // Create new person record
      const nameParts = displayName.split(" ");
      const { data: newPerson, error: personError } = await serviceDb
        .from("people")
        .insert({
          first_name: nameParts[0] || displayName,
          last_name: nameParts.slice(1).join(" ") || "",
          email,
          person_type: "user",
          status: "active",
        })
        .select("id, first_name, last_name, email")
        .single();

      if (personError) {
        return apiErrorResponse(personError);
      }
      personId = newPerson.id;
    }

    // Link auth user to person record
    if (signUpData.user?.id && personId) {
      const { error: authLinkError } = await serviceDb
        .from("users_auth")
        .upsert({
          auth_user_id: signUpData.user.id,
          person_id: personId,
        }, { onConflict: "auth_user_id" });

      if (authLinkError) {
        return apiErrorResponse(authLinkError);
      }
    }

    return NextResponse.json({
      message: "User created successfully",
      user: existingPerson || { id: personId, email, first_name: displayName },
      emailConfirmationSent: !signUpData.session,
    });
    },
);
