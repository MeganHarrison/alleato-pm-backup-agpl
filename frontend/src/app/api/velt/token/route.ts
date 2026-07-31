import { type NextRequest, NextResponse } from "next/server";

import { fetchWithGuardrails, WRITE_POLICY } from "@/lib/fetch-with-guardrails";
import { getApiRouteUser } from "@/lib/supabase/server";

export async function POST(req: NextRequest) {
  try {
    const user = await getApiRouteUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const veltApiKey = process.env.NEXT_PUBLIC_VELT_API_KEY;
    const veltAuthToken = process.env.VELT_AUTH_TOKEN;

    if (!veltApiKey || !veltAuthToken) {
      return NextResponse.json(
        { error: "Server configuration error: missing Velt credentials" },
        { status: 500 },
      );
    }

    const { userId, organizationId, email, isAdmin } = await req.json();

    if (!userId || !organizationId) {
      return NextResponse.json(
        { error: "Missing userId or organizationId" },
        { status: 400 },
      );
    }

    const response = await fetchWithGuardrails(
      "https://api.velt.dev/v2/auth/token/get",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-velt-api-key": veltApiKey,
          "x-velt-auth-token": veltAuthToken,
        },
        body: JSON.stringify({
          data: {
            userId,
            userProperties: {
              ...(organizationId ? { organizationId } : {}),
              ...(email ? { email } : {}),
              ...(typeof isAdmin === "boolean" ? { isAdmin } : {}),
            },
          },
        }),
        requestId: crypto.randomUUID(),
        where: "api/velt/token",
        dependency: "velt",
        ...WRITE_POLICY,
      },
    );

    const json = await response.json();
    const token = json?.result?.data?.token;

    if (!response.ok || !token) {
      return NextResponse.json(
        { error: json?.error?.message || "Failed to generate Velt token" },
        { status: 500 },
      );
    }

    return NextResponse.json({ token });
  } catch {
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
