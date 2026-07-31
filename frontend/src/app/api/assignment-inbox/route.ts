export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";

import { withApiGuardrails } from "@/lib/guardrails/api";
import { GuardrailError } from "@/lib/guardrails/errors";
import { getApiRouteUser } from "@/lib/supabase/server";
import {
  INBOX_PAGE_SIZE,
  loadInboxItems,
} from "@/features/assignment-inbox/load-inbox-items";

const WHERE = "api.assignment-inbox.GET";

export const GET = withApiGuardrails(WHERE, async ({ request }) => {
  const user = await getApiRouteUser();
  if (!user) {
    throw new GuardrailError({
      code: "AUTH_EXPIRED",
      where: WHERE,
      message: "Sign in to view the assignment inbox.",
      status: 401,
    });
  }

  const params = request.nextUrl.searchParams;
  const offset = Math.max(0, Number(params.get("offset") ?? 0) || 0);
  const limit = Math.max(
    1,
    Math.min(500, Number(params.get("limit") ?? INBOX_PAGE_SIZE) || INBOX_PAGE_SIZE),
  );

  const { items, totalUnassigned, hasMore, nextOffset, errorMessage } =
    await loadInboxItems({ offset, limit });

  if (errorMessage) {
    throw new GuardrailError({
      code: "UPSTREAM_FAILURE",
      where: WHERE,
      message: "Failed to load assignment inbox items.",
      details: errorMessage,
    });
  }

  return NextResponse.json({ items, totalUnassigned, hasMore, nextOffset });
});
