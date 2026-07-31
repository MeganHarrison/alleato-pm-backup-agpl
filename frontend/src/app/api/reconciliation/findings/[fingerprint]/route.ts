/**
 * PATCH /api/reconciliation/findings/[fingerprint]
 * Update a finding's triage state. Body: { reviewStatus: "open"|"reviewed"|"resolved" }.
 *
 * Auth: enforces the `view_accounting` capability. `getApiRouteUser()` alone is
 * NOT an auth check — it returns null for anonymous callers, and this handler
 * writes with the service client (RLS bypassed), so the capability check must
 * gate the write.
 */

import { NextResponse } from "next/server";

import { requireCurrentUserAppCapability } from "@/lib/app-capabilities";
import { withApiGuardrails } from "@/lib/guardrails/api";
import { GuardrailError } from "@/lib/guardrails/errors";
import { getApiRouteUser } from "@/lib/supabase/server";
import { serviceDb } from "@/lib/supabase/service-db";

export const dynamic = "force-dynamic";

const ALLOWED = new Set(["open", "reviewed", "resolved"]);
const WHERE = "/api/reconciliation/findings/[fingerprint]#PATCH";

export const PATCH = withApiGuardrails<{ fingerprint: string }>(
  WHERE,
  async ({ request, params }) => {
    await requireCurrentUserAppCapability(
      "view_accounting",
      WHERE,
      "Accounting access required.",
    );

    const { fingerprint } = params;
    const body = (await request.json()) as { reviewStatus?: string };
    const reviewStatus = body.reviewStatus;
    if (!reviewStatus || !ALLOWED.has(reviewStatus)) {
      throw new GuardrailError({
        code: "INVALID_PAYLOAD",
        where: WHERE,
        message: "Invalid reviewStatus",
        status: 400,
      });
    }

    const user = await getApiRouteUser();
    const reviewer = user?.email ?? user?.id ?? null;

    const { error } = await serviceDb.from("reconciliation_findings")
      .update({
        review_status: reviewStatus,
        reviewed_by: reviewStatus === "open" ? null : reviewer,
        reviewed_at: reviewStatus === "open" ? null : new Date().toISOString(),
      })
      .eq("fingerprint", decodeURIComponent(fingerprint));
    if (error) {
      throw new GuardrailError({
        code: "INTERNAL_ERROR",
        where: WHERE,
        message: "Failed to update the finding's review status.",
        details: { reason: error.message },
      });
    }

    return NextResponse.json({ ok: true });
  },
);
