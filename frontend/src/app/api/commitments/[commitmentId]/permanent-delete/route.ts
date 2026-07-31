import { withApiGuardrails } from "@/lib/guardrails/api";
import { GuardrailError } from "@/lib/guardrails/errors";
import { createClient, getApiRouteUser } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { apiErrorResponse } from "@/lib/api-error";

/**
 * Permanent Delete Commitment
 *
 * Hard deletes a commitment from the database. This action is irreversible.
 * The commitment must be soft-deleted first (deleted_at must be set).
 *
 * @route DELETE /api/commitments/[commitmentId]/permanent-delete
 * @param id - Commitment ID
 * @returns 204 No Content on success
 *
 * Business Rules:
 * - Commitment must be soft-deleted first (deleted_at IS NOT NULL)
 * - Cascades delete to related records (attachments, change orders, invoices)
 * - Determines correct table (subcontracts vs purchase_orders) from unified view
 *
 * Error Cases:
 * - 401: Unauthorized (no user session)
 * - 404: Commitment not found
 * - 400: Commitment not soft-deleted yet
 */
export const DELETE = withApiGuardrails<{ commitmentId: string }>(
  "commitments/[commitmentId]/permanent-delete#DELETE",
  async ({ request, params }) => {
  
    const { commitmentId } = await params;
    const supabase = await createClient();

    // Get the current user
    const user = await getApiRouteUser();

    if (!user) {
      throw new GuardrailError({ code: "AUTH_EXPIRED", where: "commitments/[commitmentId]/permanent-delete#DELETE", message: "Authentication required." });
    }

    // First determine the type and verify it's deleted from the unified view
    const { data: existing, error: fetchError } = await supabase
      .from("commitments_unified")
      .select("id, commitment_type, deleted_at")
      .eq("id", commitmentId)
      .single();

    if (fetchError || !existing) {
      return NextResponse.json(
        { error: "Commitment not found" },
        { status: 404 },
      );
    }

    // Verify the commitment is actually soft-deleted
    if (!existing.deleted_at) {
      return NextResponse.json(
        {
          error: "Commitment must be soft-deleted first",
          message: "Only soft-deleted commitments can be permanently deleted",
        },
        { status: 400 },
      );
    }

    // Hard delete from the appropriate table
    const tableName =
      existing.commitment_type === "subcontract" ? "subcontracts" : "purchase_orders";

    const { error } = await supabase.from(tableName).delete().eq("id", commitmentId);

    if (error) {
      return apiErrorResponse(error);
    }

    // Return 204 No Content for successful deletion
    return new NextResponse(null, { status: 204 });
    },
);
