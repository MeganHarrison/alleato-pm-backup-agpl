import { withApiGuardrails } from "@/lib/guardrails/api";
import { GuardrailError } from "@/lib/guardrails/errors";
import { createClient, getApiRouteUser } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { apiErrorResponse } from "@/lib/api-error";

/**
 * POST /api/commitments/[commitmentId]/restore
 * Restore a soft-deleted commitment from the recycle bin
 *
 * Restores a commitment that was previously soft-deleted by setting deleted_at = NULL.
 * The commitment will be restored to its previous status.
 *
 * @route POST /api/commitments/[commitmentId]/restore
 * @param id - Commitment ID
 * @returns RestoreCommitmentResponse with restored commitment data
 *
 * Error Cases:
 * - 401: Unauthorized (no user session)
 * - 404: Commitment not found
 * - 400: Commitment is not deleted (cannot restore)
 */
export const POST = withApiGuardrails<{ commitmentId: string }>(
  "commitments/[commitmentId]/restore#POST",
  async ({ request, params }) => {
  
    const { commitmentId } = await params;
    const supabase = await createClient();

    // Get the current user
    const user = await getApiRouteUser();

    if (!user) {
      throw new GuardrailError({ code: "AUTH_EXPIRED", where: "commitments/[commitmentId]/restore#POST", message: "Authentication required." });
    }

    // First determine the type from the unified view (including deleted records)
    const { data: existing, error: fetchError } = await supabase
      .from("commitments_unified")
      .select("id, commitment_type, deleted_at, status")
      .eq("id", commitmentId)
      .single();

    if (fetchError || !existing) {
      return NextResponse.json(
        { error: "COMMITMENT_NOT_FOUND", message: "Commitment does not exist" },
        { status: 404 },
      );
    }

    // Check if the commitment is actually deleted
    if (!existing.deleted_at) {
      return NextResponse.json(
        {
          error: "NOT_DELETED",
          message: "Commitment is not deleted and cannot be restored",
        },
        { status: 400 },
      );
    }

    // Restore the commitment by setting deleted_at to null
    const tableName =
      existing.commitment_type === "subcontract" ? "subcontracts" : "purchase_orders";

    const restoredAt = new Date().toISOString();
    const { data, error } = await supabase
      .from(tableName)
      .update({
        deleted_at: null,
        updated_at: restoredAt,
      })
      .eq("id", commitmentId)
      .select("status")
      .single();

    if (error) {
      return apiErrorResponse(error);
    }

    // Return response matching API specification
    return NextResponse.json({
      success: true,
      message: "Commitment restored from recycle bin",
      data: {
        id: commitmentId,
        restoredAt,
        status: data?.status || existing.status || "draft",
      },
    });
    },
);
