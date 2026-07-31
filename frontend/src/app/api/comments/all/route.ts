import { NextResponse } from "next/server";

import { apiErrorResponse } from "@/lib/api-error";
import { fetchAllComments, type AllCommentItem, type AllCommentMessage } from "@/lib/comments/all-comments";
import { withApiGuardrails } from "@/lib/guardrails/api";
import { GuardrailError } from "@/lib/guardrails/errors";
import { getApiRouteUser } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export type { AllCommentItem, AllCommentMessage };

export const GET = withApiGuardrails(
  "comments/all#GET",
  async () => {
    const user = await getApiRouteUser();
    if (!user) {
      throw new GuardrailError({
        code: "AUTH_EXPIRED",
        where: "comments/all#GET",
        message: "Authentication required.",
      });
    }

    try {
      const comments = await fetchAllComments();
      return NextResponse.json({ comments });
    } catch (error) {
      return apiErrorResponse(error);
    }
  },
);
