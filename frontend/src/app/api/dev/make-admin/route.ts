import { withApiGuardrails } from "@/lib/guardrails/api";
import { GuardrailError } from "@/lib/guardrails/errors";
import { NextResponse } from "next/server";
import { createClient, getApiRouteUser } from "@/lib/supabase/server";

/**
 * POST /api/dev/make-admin
 *
 * Sets the currently logged-in user as an app admin.
 * Only available in development mode.
 *
 * This creates/updates the user_profiles row with is_admin = true,
 * which causes PermissionService.hasPermission to bypass all checks.
 */
export const POST = withApiGuardrails(
  "dev/make-admin#POST",
  async () => {
  if (process.env.NODE_ENV !== "development") {
    return NextResponse.json(
      { error: "Only available in development" },
      { status: 403 },
    );
  }

  try {
    const supabase = await createClient();

    const user = await getApiRouteUser();

    if (!user) {
      return NextResponse.json(
        { error: "Not authenticated. Log in first." },
        { status: 401 },
      );
    }

    // OWASP A01:2021 - Broken Access Control:
    // Only allow if the requesting user is already an admin OR if there are
    // zero admins in the database (initial setup / bootstrap scenario).
    const { data: existingAdmins, error: adminCheckError } = await supabase
      .from("user_profiles")
      .select("id")
      .eq("is_admin", true)
      .limit(1);

    if (adminCheckError) {
      return NextResponse.json(
        { error: `Failed to check admin status: ${adminCheckError.message}` },
        { status: 500 },
      );
    }

    const hasExistingAdmins = existingAdmins && existingAdmins.length > 0;

    if (hasExistingAdmins) {
      // There are existing admins — only an existing admin can promote others
      const isRequestingUserAdmin = existingAdmins.some((a) => a.id === user.id);
      if (!isRequestingUserAdmin) {
        return NextResponse.json(
          { error: "Only an existing admin can grant admin privileges. Contact a current admin." },
          { status: 403 },
        );
      }
    }
    // If no admins exist, this is initial setup — allow the first admin to self-promote

    // Upsert user_profiles with is_admin = true
    const { data, error } = await supabase
      .from("user_profiles")
      .upsert(
        {
          id: user.id,
          email: user.email || "",
          is_admin: true,
        },
        { onConflict: "id" },
      )
      .select()
      .single();

    if (error) {
      return NextResponse.json(
        { error: `Failed to set admin: ${error.message}` },
        { status: 500 },
      );
    }

    return NextResponse.json({
      success: true,
      message: hasExistingAdmins
        ? `Admin ${user.email} confirmed admin privileges`
        : `User ${user.email} is now the initial admin (no previous admins existed)`,
      user_id: user.id,
      profile: data,
    });
  } catch (error) {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
  },
);

/**
 * GET /api/dev/make-admin
 *
 * Check current admin status.
 */
export const GET = withApiGuardrails(
  "dev/make-admin#GET",
  async () => {
  if (process.env.NODE_ENV !== "development") {
    return NextResponse.json(
      { error: "Only available in development" },
      { status: 403 },
    );
  }

  try {
    const supabase = await createClient();

    const user = await getApiRouteUser();

    if (!user) {
      return NextResponse.json(
        { error: "Not authenticated" },
        { status: 401 },
      );
    }

    const { data: profile } = await supabase
      .from("user_profiles")
      .select("id, email, is_admin")
      .eq("id", user.id)
      .single();

    // profile is typed as Pick<Row, ...> from the select. is_admin lives on
    // the row but the inferred narrow type may drop it depending on the
    // generated type variant — so read defensively.
    const isAdmin =
      profile && typeof (profile as { is_admin?: boolean | null }).is_admin === "boolean"
        ? Boolean((profile as { is_admin?: boolean | null }).is_admin)
        : false;

    return NextResponse.json({
      user_id: user.id,
      email: user.email,
      is_admin: isAdmin,
      profile,
    });
  } catch {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
  },
);
