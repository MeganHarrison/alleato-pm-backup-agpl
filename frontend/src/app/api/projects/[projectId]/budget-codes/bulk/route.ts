import { withApiGuardrails } from "@/lib/guardrails/api";
import { GuardrailError } from "@/lib/guardrails/errors";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import { createClient, getApiRouteUser } from "@/lib/supabase/server";
import { apiErrorResponse } from "@/lib/api-error";

/**
 * PUT /api/projects/[projectId]/budget-codes/bulk
 *
 * Bulk sync project cost codes for a given cost type.
 * Accepts the full set of selected cost_code_ids for a cost_type_id
 * and reconciles against what currently exists:
 *   - Inserts new selections
 *   - Soft-deletes (is_active=false) removed selections
 *   - Re-activates previously soft-deleted selections
 *
 * Body: { cost_type_id: string, cost_code_ids: string[] }
 */
export const PUT = withApiGuardrails<{ projectId: string }>(
  "projects/[projectId]/budget-codes/bulk#PUT",
  async ({ request, params }) => {
  
    const { projectId } = await params;
    const projectIdNum = Number.parseInt(projectId, 10);

    if (Number.isNaN(projectIdNum)) {
      return NextResponse.json(
        { error: "Invalid project ID" },
        { status: 400 },
      );
    }

    const body = await request.json();
    const { cost_type_id, cost_code_ids } = body as {
      cost_type_id: string;
      cost_code_ids: string[];
    };

    if (!cost_type_id) {
      return NextResponse.json(
        { error: "cost_type_id is required" },
        { status: 400 },
      );
    }

    if (!Array.isArray(cost_code_ids)) {
      return NextResponse.json(
        { error: "cost_code_ids must be an array" },
        { status: 400 },
      );
    }

    const supabase = await createClient();

    const user = await getApiRouteUser();

    if (!user) {
      throw new GuardrailError({ code: "AUTH_EXPIRED", where: "projects/[projectId]/budget-codes/bulk#PUT", message: "Authentication required." });
    }

    // Fetch ALL existing project_budget_codes for this project + cost type
    // (including inactive ones so we can reactivate)
    const { data: existing, error: fetchError } = await supabase
      .from("project_budget_codes")
      .select("id, cost_code_id, is_active")
      .eq("project_id", projectIdNum)
      .eq("cost_type_id", cost_type_id);

    if (fetchError) {
      return NextResponse.json(
        { error: "Failed to fetch existing codes", details: fetchError.message },
        { status: 500 },
      );
    }

    const existingMap = new Map(
      (existing || []).map((row) => [row.cost_code_id, row]),
    );
    const desiredSet = new Set(cost_code_ids);

    // Batch-resolve descriptions for codes we'll be inserting
    const newCodeIds = cost_code_ids.filter((id) => !existingMap.has(id));
    const descriptionMap = new Map<string, string>();
    if (newCodeIds.length > 0) {
      const { data: costCodeRows } = await supabase
        .from("cost_codes")
        .select("id, title")
        .in("id", newCodeIds);
      for (const row of costCodeRows ?? []) {
        descriptionMap.set(row.id, row.title ?? row.id);
      }
    }

    // Determine operations
    const toInsert: { project_id: number; cost_code_id: string; cost_type_id: string; description: string; is_active: boolean }[] = [];
    const toActivate: string[] = [];
    const toDeactivate: string[] = [];

    // New codes to add
    for (const codeId of cost_code_ids) {
      const row = existingMap.get(codeId);
      if (!row) {
        toInsert.push({
          project_id: projectIdNum,
          cost_code_id: codeId,
          cost_type_id,
          description: descriptionMap.get(codeId) ?? codeId,
          is_active: true,
        });
      } else if (!row.is_active) {
        toActivate.push(row.id);
      }
    }

    // Codes to deactivate (exist but not in desired set)
    for (const [codeId, row] of existingMap) {
      if (!desiredSet.has(codeId) && row.is_active) {
        toDeactivate.push(row.id);
      }
    }

    // Execute operations
    const errors: string[] = [];

    if (toInsert.length > 0) {
      const { error: insertError } = await supabase
        .from("project_budget_codes")
        .insert(toInsert);
      if (insertError) errors.push(`Insert failed: ${insertError.message}`);
    }

    if (toActivate.length > 0) {
      const { error: activateError } = await supabase
        .from("project_budget_codes")
        .update({ is_active: true })
        .in("id", toActivate);
      if (activateError) errors.push(`Activate failed: ${activateError.message}`);
    }

    if (toDeactivate.length > 0) {
      const { error: deactivateError } = await supabase
        .from("project_budget_codes")
        .update({ is_active: false })
        .in("id", toDeactivate);
      if (deactivateError) errors.push(`Deactivate failed: ${deactivateError.message}`);
    }

    if (errors.length > 0) {
      return NextResponse.json(
        { error: "Partial failure", details: errors },
        { status: 500 },
      );
    }

    return NextResponse.json({
      success: true,
      added: toInsert.length,
      activated: toActivate.length,
      deactivated: toDeactivate.length,
    });
    },
);
