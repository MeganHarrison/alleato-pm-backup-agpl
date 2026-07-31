/**
 * Server-only route guard for developer-restricted pages.
 *
 * Use in a server component (typically a layout.tsx for a route group):
 *
 *   import { requireDeveloper } from "@/lib/auth/require-developer";
 *
 *   export default async function DeveloperLayout({ children }) {
 *     await requireDeveloper();
 *     return <>{children}</>;
 *   }
 *
 * Redirects:
 *   - /auth/login          if no session
 *   - /access-denied       if logged in but not is_developer
 *
 * DO NOT import this from 'use client' components.
 */

import { redirect } from "next/navigation";
import { NextResponse } from "next/server";
import { getCurrentUser, getIsDeveloper } from "@/lib/auth/current-user";
import { createClientWithToken } from "@/lib/supabase/server";
import { serviceDb } from "@/lib/supabase/service-db";

export async function requireDeveloper(): Promise<void> {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/auth/login");
  }

  const isDeveloper = await getIsDeveloper();
  if (!isDeveloper) {
    redirect("/access-denied?reason=developer-only");
  }
}

export async function requireDeveloperApi(
  request?: Pick<Request, "headers">,
): Promise<NextResponse | null> {
  const authHeader = request?.headers.get("authorization");
  if (authHeader?.startsWith("Bearer ")) {
    const token = authHeader.slice(7).trim();
    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const supabase = createClientWithToken(token);
    const {
      data: { user },
    } = await supabase.auth.getUser(token);

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    let isDeveloper =
      (user.app_metadata as Record<string, unknown> | undefined)?.is_developer === true;

    if (!isDeveloper) {
      const { data: profile } = await serviceDb
        .from("user_profiles")
        .select("is_developer")
        .eq("id", user.id)
        .maybeSingle();
      isDeveloper = profile?.is_developer === true;
    }

    if (!isDeveloper) {
      return NextResponse.json(
        {
          error: "Developer access required",
          required: { role: "developer" },
        },
        { status: 403 },
      );
    }

    return null;
  }

  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const isDeveloper = await getIsDeveloper();
  if (!isDeveloper) {
    return NextResponse.json(
      {
        error: "Developer access required",
        required: { role: "developer" },
      },
      { status: 403 },
    );
  }

  return null;
}
