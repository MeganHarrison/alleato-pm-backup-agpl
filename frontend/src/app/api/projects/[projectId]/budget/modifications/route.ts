import { withApiGuardrails } from "@/lib/guardrails/api";
import { GuardrailError } from "@/lib/guardrails/errors";
import {
  BudgetModificationPayloadSchema,
  BudgetModificationActionSchema,
} from "@/lib/schemas/budget";
import { createClient, getApiRouteUser } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { apiErrorResponse } from "@/lib/api-error";
import { logger } from "@/lib/logger";
import type { Database } from "@/types/database.types";
import {
  hasGranular,
  hasPermission,
  loadUserPermissions,
} from "@/lib/permissions";
import {
  canDeleteBudgetChange,
  getBudgetChangeAllowedActions,
  getBudgetChangeSelectableStatuses,
  mapBudgetChangeActionToStatus,
  type BudgetChangeStatus,
} from "@/lib/budget/budget-change-access";

function getBudgetChangePermissions(
  permissions: Awaited<ReturnType<typeof loadUserPermissions>>,
) {
  if (!permissions) return null;

  return {
    isAdmin: permissions.isAdmin,
    canManageBudgetChanges:
      permissions.isAdmin ||
      (hasPermission(permissions, "budget", "read") &&
        hasGranular(permissions, "create_budget_modifications")),
    canApproveBudgetChanges:
      permissions.isAdmin ||
      (hasPermission(permissions, "budget", "read") &&
        hasGranular(permissions, "approve_budget_changes")),
  };
}

// GET /api/projects/[id]/budget/modifications - Fetch budget modifications
export const GET = withApiGuardrails<{ projectId: string }>(
  "projects/[projectId]/budget/modifications#GET",
  async ({ request, params }) => {
  
    const { projectId } = await params;
    const projectIdNum = parseInt(projectId, 10);

    if (Number.isNaN(projectIdNum)) {
      return NextResponse.json(
        { error: "Invalid project ID" },
        { status: 400 },
      );
    }

    const user = await getApiRouteUser();
    if (!user) {
      throw new GuardrailError({
        code: "AUTH_EXPIRED",
        where: "projects/[projectId]/budget/modifications#GET",
        message: "Authentication required.",
      });
    }

    const permissions = await loadUserPermissions(projectIdNum);
    if (!permissions || !hasPermission(permissions, "budget", "read")) {
      return NextResponse.json(
        {
          error: "Insufficient permissions: requires read access to budget",
          required: { module: "budget", level: "read" },
        },
        { status: 403 },
      );
    }

    const budgetChangePermissions = getBudgetChangePermissions(permissions);
    if (!budgetChangePermissions) {
      return NextResponse.json(
        { error: "No project membership found" },
        { status: 403 },
      );
    }

    const { searchParams } = new URL(request.url);
    const budgetLineId = searchParams.get("budgetLineId");
    const status = searchParams.get("status");

    const supabase = await createClient();

    // If budgetLineId is provided, first resolve matching modification IDs.
    // This avoids clipping nested budget_mod_lines to only the matched line.
    let matchingModificationIds: string[] | null = null;
    if (budgetLineId) {
      const { data: budgetLine, error: lineError } = await supabase
        .from("budget_lines")
        .select("cost_code_id, cost_type_id, sub_job_id")
        .eq("id", budgetLineId)
        .single();

      if (lineError || !budgetLine) {
        return NextResponse.json(
          { error: "Budget line not found" },
          { status: 404 },
        );
      }

      let lineMatchQuery = supabase
        .from("budget_mod_lines")
        .select("budget_modification_id")
        .eq("project_id", projectIdNum)
        .eq("cost_code_id", budgetLine.cost_code_id);

      if (budgetLine.cost_type_id) {
        lineMatchQuery = lineMatchQuery.eq("cost_type_id", budgetLine.cost_type_id);
      }

      const { data: matchingLines, error: matchingLinesError } =
        await lineMatchQuery;

      if (matchingLinesError) {
        return NextResponse.json(
          { error: "Failed to resolve matching budget modifications" },
          { status: 500 },
        );
      }

      matchingModificationIds = Array.from(
        new Set(
          (matchingLines || [])
            .map((line) => line.budget_modification_id)
            .filter((id): id is string => typeof id === "string" && id.length > 0),
        ),
      );

      if (matchingModificationIds.length === 0) {
        return NextResponse.json({
          modifications: [],
        });
      }
    }

    // Build query for budget modifications with their full line items
    let query = supabase
      .from("budget_modifications")
      .select(
        `
        id,
        number,
        title,
        reason,
        status,
        effective_date,
        created_at,
        updated_at,
        created_by,
        budget_mod_lines (
          id,
          cost_code_id,
          cost_type_id,
          sub_job_id,
          amount,
          description,
          cost_codes (
            id,
            title
          ),
          cost_code_types (
            code
          )
        )
      `,
      )
      .eq("project_id", projectIdNum)
      .order("created_at", { ascending: false });

    // Filter by status if provided
    if (status && status !== "all") {
      query = query.eq("status", status);
    }

    if (matchingModificationIds) {
      query = query.in("id", matchingModificationIds);
    }

    const { data, error } = await query;

    if (error) {
      return NextResponse.json(
        { error: "Failed to fetch budget modifications" },
        { status: 500 },
      );
    }

    // Transform data to include computed fields
    interface ModLine {
      id: unknown;
      cost_code_id: unknown;
      cost_type_id: unknown;
      cost_code_types: unknown;
      sub_job_id: unknown;
      amount: unknown;
      description: unknown;
      cost_codes: unknown;
    }

    const modifications = (data || []).map((mod) => {
      const lines = (mod.budget_mod_lines || []) as ModLine[];
      const totalAmount = lines.reduce(
        (sum: number, line) => sum + (Number(line.amount) || 0),
        0,
      );

      return {
        id: mod.id,
        number: mod.number,
        title: mod.title,
        reason: mod.reason,
        status: mod.status as BudgetChangeStatus,
        effectiveDate: mod.effective_date,
        createdAt: mod.created_at,
        updatedAt: mod.updated_at,
        createdBy: mod.created_by,
        amount: totalAmount,
        editableStatuses: getBudgetChangeSelectableStatuses(
          mod.status as BudgetChangeStatus,
          budgetChangePermissions,
        ),
        allowedActions: getBudgetChangeAllowedActions(
          mod.status as BudgetChangeStatus,
          budgetChangePermissions,
        ),
        canDelete: canDeleteBudgetChange(
          mod.status as BudgetChangeStatus,
          budgetChangePermissions,
        ),
        lines: lines.map((line) => {
          const costCodes = line.cost_codes as
            | { id?: string; title?: string }
            | { id?: string; title?: string }[]
            | null;
          const costCodeTypes = line.cost_code_types as
            | { code?: string }
            | { code?: string }[]
            | null;
          const costCodeTitle = Array.isArray(costCodes)
            ? costCodes[0]?.title || ""
            : costCodes?.title || "";
          const costTypeCode = Array.isArray(costCodeTypes)
            ? costCodeTypes[0]?.code || ""
            : costCodeTypes?.code || "";

          return {
            id: String(line.id),
            costCodeId: String(line.cost_code_id),
            costTypeId: String(line.cost_type_id),
            costTypeCode,
            subJobId: line.sub_job_id ? String(line.sub_job_id) : null,
            amount: Number(line.amount) || 0,
            description: line.description ? String(line.description) : null,
            costCodeTitle,
          };
        }),
      };
    });

    return NextResponse.json({
      modifications,
      permissions: {
        canManageBudgetChanges: budgetChangePermissions.canManageBudgetChanges,
        canApproveBudgetChanges: budgetChangePermissions.canApproveBudgetChanges,
        isAdmin: budgetChangePermissions.isAdmin,
      },
    });
    },
);

// POST /api/projects/[id]/budget/modifications - Create a budget modification
export const POST = withApiGuardrails<{ projectId: string }>(
  "projects/[projectId]/budget/modifications#POST",
  async ({ request, params }) => {

    const { projectId } = await params;
    const projectIdNum = parseInt(projectId, 10);

    if (Number.isNaN(projectIdNum)) {
      return NextResponse.json(
        { error: "Invalid project ID" },
        { status: 400 },
      );
    }

    const user = await getApiRouteUser();
    if (!user) {
      throw new GuardrailError({
        code: "AUTH_EXPIRED",
        where: "projects/[projectId]/budget/modifications#POST",
        message: "Authentication required.",
      });
    }

    const permissions = await loadUserPermissions(projectIdNum);
    const budgetChangePermissions = getBudgetChangePermissions(permissions);

    if (!permissions || !hasPermission(permissions, "budget", "read")) {
      return NextResponse.json(
        {
          error: "Insufficient permissions: requires read access to budget",
          required: { module: "budget", level: "read" },
        },
        { status: 403 },
      );
    }

    if (!budgetChangePermissions?.canManageBudgetChanges) {
      return NextResponse.json(
        {
          error:
            'Insufficient permissions: requires the "Create budget modifications" permission',
          required: { granularFlag: "create_budget_modifications" },
        },
        { status: 403 },
      );
    }

    const body = await request.json();

    // Support both budgetItemId and budgetLineId for backwards compatibility
    const budgetLineId =
      body.budgetLineId ??
      body.budgetItemId ??
      body.budget_line_id ??
      body.budget_item_id;

    const parsedPayload = BudgetModificationPayloadSchema.safeParse({
      budgetItemId: budgetLineId,
      amount: body.amount,
      title: body.title,
      description: body.description,
      reason: body.reason,
      approver: body.approver,
      modificationType: body.modificationType ?? body.modification_type,
      changeEventId: body.changeEventId ?? body.change_event_id,
      transferLines: body.transferLines ?? body.transfer_lines,
    });

    if (!parsedPayload.success) {
      return NextResponse.json(
        {
          error: "Invalid payload",
          details: parsedPayload.error.flatten().fieldErrors,
        },
        { status: 400 },
      );
    }

    const { budgetItemId, amount, title, description, reason, modificationType, changeEventId, transferLines } =
      parsedPayload.data;

    const parsedAmount = amount ? Number.parseFloat(amount) : 0;
    if (!transferLines?.length && (parsedAmount === 0 || Number.isNaN(parsedAmount))) {
      return NextResponse.json(
        { error: "Amount must be a non-zero number" },
        { status: 400 },
      );
    }

    const supabase = await createClient();

type BudgetLineForModification = {
      id: string;
      project_id: number;
      cost_code_id: string;
      cost_type_id: string;
      sub_job_id: string | null;
      original_amount: number | null;
    };
    type BudgetModLineInsert =
      Database["public"]["Tables"]["budget_mod_lines"]["Insert"];

    const transferLineIds = transferLines?.flatMap((line) => [
      line.fromBudgetLineId,
      line.toBudgetLineId,
    ]) ?? [];
    const budgetLineIds = Array.from(
      new Set(transferLineIds.length ? transferLineIds : budgetItemId ? [budgetItemId] : []),
    );

    const { data: budgetLines, error: lineError } = await supabase
      .from("budget_lines")
      .select(
        "id, project_id, cost_code_id, cost_type_id, sub_job_id, original_amount",
      )
      .eq("project_id", projectIdNum)
      .in("id", budgetLineIds);

    if (lineError) {
      return apiErrorResponse(lineError);
    }

    const budgetLinesById = new Map(
      ((budgetLines ?? []) as BudgetLineForModification[]).map((line) => [
        line.id,
        line,
      ]),
    );

    if (budgetLinesById.size !== budgetLineIds.length) {
      return NextResponse.json(
        { error: "One or more budget lines were not found in this project" },
        { status: 404 },
      );
    }

    // Generate the next modification number for this project
    const { data: lastMod } = await supabase
      .from("budget_modifications")
      .select("number")
      .eq("project_id", projectIdNum)
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    let nextNumber = "BM-0001";
    if (lastMod?.number) {
      const currentNum = parseInt(lastMod.number.replace("BM-", ""), 10);
      if (!Number.isNaN(currentNum)) {
        nextNumber = `BM-${(currentNum + 1).toString().padStart(4, "0")}`;
      }
    }

    const transferDescription =
      transferLines
        ?.map((line) => line.notes)
        .find((note): note is string => Boolean(note))
        ?? description
        ?? reason
        ?? null;

    const { data: modification, error: modError } = await supabase
      .from("budget_modifications")
      .insert({
        project_id: projectIdNum,
        number: nextNumber,
        title: title || (transferLines?.length ? `Budget Transfer ${nextNumber}` : `Budget Modification ${nextNumber}`),
        reason: reason || transferDescription,
        status: "draft",
        effective_date: null,
        created_by: user.id,
      })
      .select()
      .single();

    if (modError) {
      return NextResponse.json(
        {
          error: "Failed to create budget modification",
          details: modError.message,
        },
        { status: 500 },
      );
    }

    const modificationLineRows: BudgetModLineInsert[] = transferLines?.length
      ? transferLines.flatMap((line) => {
          const fromLine = budgetLinesById.get(line.fromBudgetLineId);
          const toLine = budgetLinesById.get(line.toBudgetLineId);
          const transferAmount = Math.abs(Number.parseFloat(line.amount));

          if (!fromLine || !toLine) return [];

          return [
            {
              budget_modification_id: modification.id,
              project_id: projectIdNum,
              cost_code_id: fromLine.cost_code_id,
              cost_type_id: fromLine.cost_type_id,
              sub_job_id: fromLine.sub_job_id,
              amount: -transferAmount,
              description: line.notes ?? null,
              modification_type: "deduction",
              change_event_id: changeEventId ?? null,
            },
            {
              budget_modification_id: modification.id,
              project_id: projectIdNum,
              cost_code_id: toLine.cost_code_id,
              cost_type_id: toLine.cost_type_id,
              sub_job_id: toLine.sub_job_id,
              amount: transferAmount,
              description: line.notes ?? null,
              modification_type: "addition",
              change_event_id: changeEventId ?? null,
            },
          ];
        })
      : (() => {
          const budgetLine = budgetItemId ? budgetLinesById.get(budgetItemId) : null;
          if (!budgetLine) return [];
          return [
            {
              budget_modification_id: modification.id,
              project_id: projectIdNum,
              cost_code_id: budgetLine.cost_code_id,
              cost_type_id: budgetLine.cost_type_id,
              sub_job_id: budgetLine.sub_job_id,
              amount: parsedAmount,
              description: description || null,
              modification_type: modificationType ?? "addition",
              change_event_id: changeEventId ?? null,
            },
          ];
        })();

    const { error: lineInsertError } = await supabase
      .from("budget_mod_lines")
      .insert(modificationLineRows);

    if (lineInsertError) {
      // Clean up the parent modification if line insert fails
      await supabase
        .from("budget_modifications")
        .delete()
        .eq("id", modification.id);
      return NextResponse.json(
        {
          error: "Failed to create budget modification line",
          details: lineInsertError.message,
        },
        { status: 500 },
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        id: modification.id,
        number: modification.number,
        title: modification.title,
        status: modification.status,
        amount: transferLines?.length
          ? transferLines.reduce((sum, line) => sum + Math.abs(Number.parseFloat(line.amount)), 0)
          : parsedAmount,
        createdAt: modification.created_at,
      },
      message: "Budget modification created as draft",
    });
    },
);

// PATCH /api/projects/[id]/budget/modifications - Update modification status
export const PATCH = withApiGuardrails<{ projectId: string }>(
  "projects/[projectId]/budget/modifications#PATCH",
  async ({ request, params }) => {
  
    const { projectId } = await params;
    const projectIdNum = parseInt(projectId, 10);

    if (Number.isNaN(projectIdNum)) {
      return NextResponse.json(
        { error: "Invalid project ID" },
        { status: 400 },
      );
    }

    const body = await request.json();

    // Normalize field names for backwards compatibility, then validate with Zod
    // OWASP: Input validation on state-changing operations (A03:2021 - Injection)
    const normalizedBody = {
      modificationId:
        body.modificationId ?? body.modification_id ?? body.modId,
      action: body.action,
      status: body.status,
      voidedReason: body.voidedReason ?? body.voided_reason,
    };

    const validation = BudgetModificationActionSchema.safeParse(normalizedBody);

    if (!validation.success) {
      return NextResponse.json(
        {
          error: "Validation failed",
          details: validation.error.flatten(),
        },
        { status: 400 },
      );
    }

    const {
      modificationId: modId,
      action,
      status,
      voidedReason,
    } = validation.data;

    const user = await getApiRouteUser();
    if (!user) {
      throw new GuardrailError({
        code: "AUTH_EXPIRED",
        where: "projects/[projectId]/budget/modifications#PATCH",
        message: "Authentication required.",
      });
    }

    const permissions = await loadUserPermissions(projectIdNum);
    const budgetChangePermissions = getBudgetChangePermissions(permissions);

    if (!permissions || !hasPermission(permissions, "budget", "read")) {
      return NextResponse.json(
        {
          error: "Insufficient permissions: requires read access to budget",
          required: { module: "budget", level: "read" },
        },
        { status: 403 },
      );
    }

    if (!budgetChangePermissions) {
      return NextResponse.json(
        { error: "No project membership found" },
        { status: 403 },
      );
    }

    const supabase = await createClient();

    // Get current modification status
    const { data: currentMod, error: fetchError } = await supabase
      .from("budget_modifications")
      .select("id, status, project_id")
      .eq("id", modId)
      .single();

    if (fetchError || !currentMod) {
      return NextResponse.json(
        { error: "Modification not found" },
        { status: 404 },
      );
    }

    // Verify project ownership
    if (currentMod.project_id !== projectIdNum) {
      return NextResponse.json(
        { error: "Modification not found in this project" },
        { status: 404 },
      );
    }

    const currentStatus = currentMod.status as BudgetChangeStatus;
    const targetStatus = (
      status ?? (action ? mapBudgetChangeActionToStatus(action) : null)
    ) as BudgetChangeStatus | null;

    if (!targetStatus) {
      return NextResponse.json(
        {
          error: "A target budget change status is required",
        },
        { status: 422 },
      );
    }

    const allowedStatuses = getBudgetChangeSelectableStatuses(
      currentStatus,
      budgetChangePermissions,
    );

    if (!allowedStatuses.includes(targetStatus) || targetStatus === currentStatus) {
      return NextResponse.json(
        {
          error: `You cannot change a ${currentStatus} budget change to ${targetStatus}`,
          currentStatus,
          targetStatus,
          allowedStatuses,
          required:
            targetStatus === "approved" || targetStatus === "void"
              ? { granularFlag: "approve_budget_changes" }
              : { granularFlag: "create_budget_modifications" },
        },
        { status: 403 },
      );
    }

    // Update the modification status
    const updateData: {
      status: string;
      updated_at: string;
      effective_date?: string | null;
    } = {
      status: targetStatus,
      updated_at: new Date().toISOString(),
    };

    // Set effective_date when approved
    if (targetStatus === "approved") {
      updateData.effective_date = new Date().toISOString();
    }

    // Write voided_reason to all budget_modification_lines when voiding
    if (targetStatus === "void" && voidedReason) {
      const { data: modLines } = await supabase
        .from("budget_modification_lines")
        .select("id")
        .eq("budget_modification_id", modId);
      if (modLines && modLines.length > 0) {
        await supabase
          .from("budget_modification_lines")
          .update({ voided_reason: voidedReason })
          .eq("budget_modification_id", modId);
      }
    }

    const { data: updatedMod, error: updateError } = await supabase
      .from("budget_modifications")
      .update(updateData)
      .eq("id", modId)
      .select()
      .single();

    if (updateError) {
      return NextResponse.json(
        { error: "Failed to update budget modification" },
        { status: 500 },
      );
    }

    // Refresh derived budget rollups when approval state changes.
    // This keeps rollup reads consistent with the status transition we just applied.
    let refreshWarning: string | null = null;
    if (targetStatus === "approved" || currentMod.status === "approved") {
      const { error: refreshError } = await supabase.rpc("refresh_budget_rollup", {
        p_project_id: projectIdNum,
      });
      if (refreshError) {
        logger.error({ msg: "Budget rollup refresh failed after modification status update", data: {
          projectId: projectIdNum,
          modificationId: modId,
          previousStatus: currentMod.status,
          targetStatus,
          error: refreshError.message,
        } });
        refreshWarning =
          "Modification status saved, but budget totals refresh failed. Totals may be temporarily stale.";
      }
    }

    const actionMessages: Record<string, string> = {
      submit: "Modification submitted for approval",
      approve: "Modification approved - budget totals updated",
      reject: "Modification rejected - returned to draft",
      void: "Modification voided - budget totals updated",
    };
    const statusMessages: Record<BudgetChangeStatus, string> = {
      draft: "Modification returned to draft",
      pending: "Modification marked pending",
      approved: "Modification approved - budget totals updated",
      void: "Modification voided - budget totals updated",
    };

    return NextResponse.json({
      success: true,
      data: {
        id: updatedMod.id,
        number: updatedMod.number,
        status: updatedMod.status,
        effectiveDate: updatedMod.effective_date,
      },
      message: action ? actionMessages[action] : statusMessages[targetStatus],
      warning: refreshWarning,
    });
    },
);

// DELETE /api/projects/[id]/budget/modifications - Delete a draft modification
export const DELETE = withApiGuardrails<{ projectId: string }>(
  "projects/[projectId]/budget/modifications#DELETE",
  async ({ request, params }) => {

    const { projectId } = await params;
    const projectIdNum = parseInt(projectId, 10);

    if (Number.isNaN(projectIdNum)) {
      return NextResponse.json(
        { error: "Invalid project ID" },
        { status: 400 },
      );
    }

    const user = await getApiRouteUser();
    if (!user) {
      throw new GuardrailError({
        code: "AUTH_EXPIRED",
        where: "projects/[projectId]/budget/modifications#DELETE",
        message: "Authentication required.",
      });
    }

    const permissions = await loadUserPermissions(projectIdNum);
    const budgetChangePermissions = getBudgetChangePermissions(permissions);

    if (!permissions || !hasPermission(permissions, "budget", "read")) {
      return NextResponse.json(
        {
          error: "Insufficient permissions: requires read access to budget",
          required: { module: "budget", level: "read" },
        },
        { status: 403 },
      );
    }

    if (!budgetChangePermissions?.canManageBudgetChanges) {
      return NextResponse.json(
        {
          error:
            'Insufficient permissions: requires the "Create budget modifications" permission',
          required: { granularFlag: "create_budget_modifications" },
        },
        { status: 403 },
      );
    }

    const { searchParams } = new URL(request.url);
    const modificationId = searchParams.get("modificationId");

    if (!modificationId) {
      return NextResponse.json(
        { error: "modificationId is required" },
        { status: 400 },
      );
    }

    const supabase = await createClient();

    // Get the modification details first
    const { data: modification, error: fetchError } = await supabase
      .from("budget_modifications")
      .select("id, status, project_id")
      .eq("id", modificationId)
      .single();

    if (fetchError || !modification) {
      return NextResponse.json(
        { error: "Modification not found" },
        { status: 404 },
      );
    }

    // Verify project ownership
    if (modification.project_id !== projectIdNum) {
      return NextResponse.json(
        { error: "Modification not found in this project" },
        { status: 404 },
      );
    }

    // App admins can delete any budget change. Other users can delete drafts only.
    if (
      !canDeleteBudgetChange(
        modification.status as BudgetChangeStatus,
        budgetChangePermissions,
      )
    ) {
      return NextResponse.json(
        {
          error: permissions.isAdmin
            ? "This budget change cannot be deleted."
            : "Only draft budget changes can be deleted. Use a status change for approved items.",
        },
        { status: 403 },
      );
    }

    // Delete the budget_mod_lines first (due to foreign key constraint)
    const { error: linesDeleteError } = await supabase
      .from("budget_mod_lines")
      .delete()
      .eq("budget_modification_id", modificationId);

    if (linesDeleteError) {
      return NextResponse.json(
        { error: "Failed to delete modification lines" },
        { status: 500 },
      );
    }

    // Delete the parent modification
    const { error: deleteError } = await supabase
      .from("budget_modifications")
      .delete()
      .eq("id", modificationId);

    if (deleteError) {
      return NextResponse.json(
        { error: "Failed to delete budget modification" },
        { status: 500 },
      );
    }

    return NextResponse.json({
      success: true,
      message: "Budget modification deleted successfully",
    });
    },
);
