import { NextRequest, NextResponse } from "next/server";

import { getOrCreateRequestId, logEvent } from "@/lib/guardrails/observability";
import {
  completeMicrosoftOAuth,
  MICROSOFT_OAUTH_COOKIE,
  recruitingAppOrigin,
  verifyMicrosoftOAuthState,
} from "@/lib/recruiting/microsoft-connection";
import {
  requireRecruitingAccess,
  type RecruitingSessionClient,
} from "@/lib/recruiting/server";
import { createServiceClient } from "@/lib/supabase/service";

export const dynamic = "force-dynamic";

function recruitingRedirect(
  request: NextRequest,
  result: "connected" | "error" | "denied",
  capability?: string,
) {
  const url = new URL(
    "/recruiting",
    recruitingAppOrigin(request.nextUrl.origin),
  );
  url.searchParams.set("microsoft", result);
  if (capability) url.searchParams.set("capability", capability);
  const response = NextResponse.redirect(url);
  response.cookies.set(MICROSOFT_OAUTH_COOKIE, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/api/recruiting/integrations/microsoft",
    expires: new Date(0),
  });
  response.headers.set("cache-control", "no-store");
  return response;
}

export async function GET(request: NextRequest) {
  const requestId = getOrCreateRequestId(request.headers);
  try {
    const state = request.nextUrl.searchParams.get("state");
    const cookieValue = request.cookies.get(MICROSOFT_OAUTH_COOKIE)?.value;
    if (!state || !cookieValue) {
      return recruitingRedirect(request, "error");
    }

    const { viewer, userEmail } = await requireRecruitingAccess("write");
    const oauthState = verifyMicrosoftOAuthState(
      cookieValue,
      state,
      viewer.personId,
    );
    if (request.nextUrl.searchParams.get("error")) {
      return recruitingRedirect(request, "denied", oauthState.capability);
    }
    const code = request.nextUrl.searchParams.get("code");
    if (!code) return recruitingRedirect(request, "error");

    const connection = await completeMicrosoftOAuth({
      origin: request.nextUrl.origin,
      code,
      verifier: oauthState.verifier,
      expectedEmail: userEmail,
      capability: oauthState.capability,
    });
    const adminDb = createServiceClient() as unknown as RecruitingSessionClient;
    const { error } = await adminDb.rpc(
      "recruiting_admin_upsert_microsoft_connection",
      {
        p_person_id: viewer.personId,
        p_tenant_id: connection.tenantId,
        p_microsoft_user_id: connection.microsoftUserId,
        p_email: connection.email,
        p_display_name: connection.displayName,
        p_granted_scopes: connection.scopes,
        p_access_token_ciphertext: connection.accessTokenCiphertext,
        p_refresh_token_ciphertext: connection.refreshTokenCiphertext,
        p_access_token_expires_at: connection.expiresAt,
        p_capability: oauthState.capability,
      },
    );
    if (error) throw new Error("Microsoft connection could not be saved.");
    return recruitingRedirect(request, "connected", oauthState.capability);
  } catch (error) {
    logEvent({
      event: "recruiting_microsoft_callback_failed",
      level: "error",
      requestId,
      where: "recruiting/microsoft/callback#GET",
      details: {
        reason:
          error instanceof Error
            ? error.message
            : "Unknown Microsoft callback failure.",
      },
    });
    return recruitingRedirect(request, "error");
  }
}
