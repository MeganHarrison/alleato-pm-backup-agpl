import { withApiGuardrails } from "@/lib/guardrails/api";
import { GuardrailError } from "@/lib/guardrails/errors";
import { createClient } from "@/lib/supabase/server";
import { getApiRouteUser } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { apiErrorResponse } from "@/lib/api-error";

/**
 * GET /api/commitments/[commitmentId]/history
 *
 * Returns change history for a commitment from commitment_audit_log, most
 * recent first. Populated automatically by the `log_commitment_change` trigger
 * on subcontracts and purchase_orders.
 */
export const GET = withApiGuardrails(
  "commitments/[commitmentId]/history#GET",
  async ({ params }) => {
    const { commitmentId } = (await params) as { commitmentId: string };

    // Auth first — outside the try below, so the 401 isn't swallowed into a 500
    // by the handler's own catch block.
    const user = await getApiRouteUser();
    if (!user) {
      throw new GuardrailError({
        code: "AUTH_EXPIRED",
        where: "commitments/[commitmentId]/history#GET",
        message: "Authentication required.",
      });
    }

    if (!commitmentId) {
      return NextResponse.json(
        { error: "commitmentId is required" },
        { status: 400 },
      );
    }

    try {
      const supabase = await createClient();

      const { data: entries, error } = await supabase
        .from("commitment_audit_log")
        .select("id, commitment_id, commitment_type, action, changed_fields, actor_id, created_at")
        .eq("commitment_id", commitmentId)
        .order("created_at", { ascending: false })
        .limit(200);

      if (error) {
        return NextResponse.json(
          { error: "Failed to load change history", details: error.message },
          { status: 400 },
        );
      }

      const actorIds = Array.from(
        new Set(
          (entries ?? [])
            .map((e) => e.actor_id)
            .filter((id): id is string => Boolean(id)),
        ),
      );

      let actorMap = new Map<string, { email: string | null; full_name: string | null }>();
      if (actorIds.length > 0) {
        const { data: users } = await supabase
          .from("user_profiles")
          .select("id, email, full_name")
          .in("id", actorIds);
        actorMap = new Map((users ?? []).map((u) => [u.id, { email: u.email, full_name: u.full_name }]));
      }

      const data = (entries ?? []).map((e) => ({
        ...e,
        actor: e.actor_id ? actorMap.get(e.actor_id) ?? null : null,
      }));

      return NextResponse.json({ success: true, data });
    } catch (error) {
      return apiErrorResponse(error);
    }
  },
);
