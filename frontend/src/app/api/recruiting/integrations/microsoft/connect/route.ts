import { NextResponse } from "next/server";

import { withApiGuardrails } from "@/lib/guardrails/api";
import { GuardrailError } from "@/lib/guardrails/errors";
import {
  buildMicrosoftAuthorizeUrl,
  createMicrosoftOAuthState,
  MICROSOFT_OAUTH_COOKIE,
  parseMicrosoftCapability,
} from "@/lib/recruiting/microsoft-connection";
import { recruitingMicrosoftConnectionSchema } from "@/lib/recruiting/production-contracts";
import { requireRecruitingAccess } from "@/lib/recruiting/server";

export const dynamic = "force-dynamic";

export const GET = withApiGuardrails(
  "recruiting/microsoft/connect#GET",
  async ({ request }) => {
    const { db, viewer } = await requireRecruitingAccess("write");
    const requestedCapability = parseMicrosoftCapability(
      request.nextUrl.searchParams.get("capability"),
    );
    const { data: statusData, error: statusError } = await db.rpc(
      "recruiting_get_microsoft_connection_status",
    );
    if (statusError) {
      throw new GuardrailError({
        code: "INTERNAL_ERROR",
        where: "recruiting/microsoft/connect#GET",
        message: "Microsoft connection status could not be verified.",
        cause: statusError,
      });
    }
    const status = recruitingMicrosoftConnectionSchema.safeParse(statusData);
    const capability =
      status.success &&
      ((requestedCapability === "mail" && status.data.calendarConnected) ||
        (requestedCapability === "calendar" && status.data.mailConnected))
        ? "all"
        : requestedCapability;
    const oauthState = createMicrosoftOAuthState({
      capability,
      personId: viewer.personId,
    });
    const response = NextResponse.redirect(
      buildMicrosoftAuthorizeUrl({
        origin: request.nextUrl.origin,
        state: oauthState.payload.state,
        codeChallenge: oauthState.codeChallenge,
        capability,
      }),
    );
    response.cookies.set(MICROSOFT_OAUTH_COOKIE, oauthState.cookieValue, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/api/recruiting/integrations/microsoft",
      maxAge: 10 * 60,
    });
    response.headers.set("cache-control", "no-store");
    return response;
  },
);
