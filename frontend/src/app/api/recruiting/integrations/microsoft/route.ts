import { NextResponse } from "next/server";

import { withApiGuardrails } from "@/lib/guardrails/api";
import { GuardrailError } from "@/lib/guardrails/errors";
import { recruitingAppOrigin } from "@/lib/recruiting/microsoft-connection";
import { requireRecruitingAccess } from "@/lib/recruiting/server";

export const dynamic = "force-dynamic";

export const GET = withApiGuardrails("recruiting/microsoft#GET", async () => {
  const { db } = await requireRecruitingAccess("read");
  const { data, error } = await db.rpc(
    "recruiting_get_microsoft_connection_status",
  );
  if (error) {
    throw new GuardrailError({
      code: "INTERNAL_ERROR",
      where: "recruiting/microsoft#GET",
      message: "Microsoft connection status could not be loaded.",
      cause: error,
    });
  }
  return NextResponse.json({ ok: true, connection: data });
});

export const DELETE = withApiGuardrails(
  "recruiting/microsoft#DELETE",
  async ({ request }) => {
    const expectedOrigin = recruitingAppOrigin(request.nextUrl.origin);
    if (request.headers.get("origin") !== expectedOrigin) {
      throw new GuardrailError({
        code: "FORBIDDEN",
        where: "recruiting/microsoft#DELETE",
        message: "The Microsoft disconnect request was not accepted.",
        status: 403,
      });
    }
    const { db } = await requireRecruitingAccess("write");
    const { data, error } = await db.rpc(
      "recruiting_disconnect_microsoft_connection",
    );
    if (error) {
      throw new GuardrailError({
        code: "INTERNAL_ERROR",
        where: "recruiting/microsoft#DELETE",
        message: "The Microsoft connection could not be disconnected.",
        cause: error,
      });
    }
    return NextResponse.json({ ok: true, disconnected: data === true });
  },
);
