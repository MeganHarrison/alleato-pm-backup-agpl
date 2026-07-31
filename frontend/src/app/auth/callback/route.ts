import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { getPostLoginRedirect } from "@/lib/auth/post-login-router";

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const origin = requestUrl.origin;
  const isNewUser = requestUrl.searchParams.get("new_user") === "true";

  if (code) {
    const supabase = await createClient();

    try {
      const { data } = await supabase.auth.exchangeCodeForSession(code);

      if (data?.user) {
        const createdAt = new Date(data.user.created_at);
        const now = new Date();
        const diffSeconds = (now.getTime() - createdAt.getTime()) / 1000;

        // New signup — send to welcome page
        if (diffSeconds < 30 || isNewUser) {
          return NextResponse.redirect(`${origin}/welcome`);
        }

        // Existing user — smart redirect based on memberships
        const redirectPath = await getPostLoginRedirect(supabase, data.user.id);
        return NextResponse.redirect(`${origin}${redirectPath}`);
      }
    } catch {
      return NextResponse.redirect(
        `${origin}/auth/login?error=auth_callback_failed`,
      );
    }
  }

  return NextResponse.redirect(`${origin}/`);
}
