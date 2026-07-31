import { withApiGuardrails } from "@/lib/guardrails/api";
import { getPostLoginRedirect } from "@/lib/auth/post-login-router";
import { createClient, getApiRouteUser } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export const GET = withApiGuardrails(
  "auth/post-login-redirect#GET",
  async ({ request }) => {
    const supabase = await createClient();
    const user = await getApiRouteUser();

    if (!user) {
      return NextResponse.json({ redirect: "/" });
    }

    const callbackUrl = new URL(request.url).searchParams.get("callbackUrl");
    const redirect = await getPostLoginRedirect(supabase, user.id, callbackUrl);
    return NextResponse.json({ redirect });
  },
);
