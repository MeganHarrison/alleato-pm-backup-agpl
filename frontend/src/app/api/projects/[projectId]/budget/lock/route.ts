import { withApiGuardrails } from "@/lib/guardrails/api";
import { GuardrailError } from "@/lib/guardrails/errors";
import { createClient, getApiRouteUser } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { apiErrorResponse } from "@/lib/api-error";
import { requirePermission } from "@/lib/permissions-guard";
import { logger } from "@/lib/logger";
import { serviceDb } from "@/lib/supabase/service-db";

async function resolveLockOwnerName(
  userId: string | null,
): Promise<string | null> {
  if (!userId) return null;

    const { data: profile, error } = await serviceDb.from("user_profiles")
    .select("full_name, email")
    .eq("id", userId)
    .maybeSingle();

  if (error) {
    logger.warn({
      msg: "Failed to resolve budget lock owner display name",
      data: { userId, error: error.message },
    });
    return null;
  }

  const fullName = profile?.full_name?.trim();
  if (fullName) return fullName;

  const email = profile?.email?.trim();
  return email || null;
}

// POST /api/projects/[id]/budget/lock - Lock the budget
export const POST = withApiGuardrails<{ projectId: string }>(
  "projects/[projectId]/budget/lock#POST",
  async ({ request, params }) => {

    const { projectId } = await params;
    const projectIdNum = Number.parseInt(projectId, 10);

    if (Number.isNaN(projectIdNum)) {
      return NextResponse.json(
        { error: "Invalid project ID" },
        { status: 400 },
      );
    }

    // Permission check: locking budget requires "admin" on budget
    const guard = await requirePermission(projectIdNum, "budget", "admin");
    if (guard.denied) return guard.response;

    const supabase = await createClient();

    // Get current user
    const user = await getApiRouteUser();

    // Check if budget is already locked
    const { data: project, error: fetchError } = await supabase
      .from("projects")
      .select("budget_locked, budget_locked_at, budget_locked_by")
      .eq("id", projectIdNum)
      .single();

    if (fetchError) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    if (project.budget_locked) {
      return NextResponse.json(
        {
          error: "Budget is already locked",
          lockedAt: project.budget_locked_at,
        },
        { status: 400 },
      );
    }

    // Lock the budget - Remove .single() to avoid "Cannot coerce" error
    const { data, error } = await supabase
      .from("projects")
      .update({
        budget_locked: true,
        budget_locked_at: new Date().toISOString(),
        budget_locked_by: user?.id || null,
      })
      .eq("id", projectIdNum)
      .select();

    if (error) {
      return apiErrorResponse(error);
    }

    // Check if any rows were updated (RLS might have blocked it)
    if (!data || data.length === 0) {
      return NextResponse.json(
        {
          error:
            "Permission denied: You do not have access to lock this budget",
        },
        { status: 403 },
      );
    }

    const updatedProject = data[0];
    const lockedByName = await resolveLockOwnerName(
      updatedProject.budget_locked_by,
    );

    return NextResponse.json({
      success: true,
      message: "Budget locked successfully",
      data: {
        budget_locked: updatedProject.budget_locked,
        budget_locked_at: updatedProject.budget_locked_at,
        budget_locked_by: updatedProject.budget_locked_by,
        budget_locked_by_name: lockedByName,
      },
    });
    },
);

// DELETE /api/projects/[id]/budget/lock - Unlock the budget
export const DELETE = withApiGuardrails<{ projectId: string }>(
  "projects/[projectId]/budget/lock#DELETE",
  async ({ request, params }) => {

    const { projectId } = await params;
    const projectIdNum = Number.parseInt(projectId, 10);

    if (Number.isNaN(projectIdNum)) {
      return NextResponse.json(
        { error: "Invalid project ID" },
        { status: 400 },
      );
    }

    // Permission check: unlocking budget requires "admin" on budget
    const guardDel = await requirePermission(projectIdNum, "budget", "admin");
    if (guardDel.denied) return guardDel.response;

    const supabase = await createClient();

    // Parse request body to get preserveLineItems flag
    let preserveLineItems = true; // Default to preserving line items
    try {
      const body = await request.json();
      preserveLineItems = body.preserveLineItems ?? true;
    } catch {
      // If no body or invalid JSON, use default (preserve)
      preserveLineItems = true;
    }

    // Check if budget is locked
    const { data: project, error: fetchError } = await supabase
      .from("projects")
      .select("budget_locked")
      .eq("id", projectIdNum)
      .single();

    if (fetchError) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    if (!project.budget_locked) {
      return NextResponse.json(
        { error: "Budget is not locked" },
        { status: 400 },
      );
    }

    // Procore-parity rule: Unlock is BLOCKED while active budget modifications exist.
    // Users must delete (draft) or void (approved) every modification first.
    // Active = anything not already voided.
    const { data: activeMods, error: modCheckError } = await supabase
      .from("budget_modifications")
      .select("id, number, status")
      .eq("project_id", projectIdNum)
      .neq("status", "void");

    if (modCheckError) {
      return apiErrorResponse(modCheckError);
    }

    if (activeMods && activeMods.length > 0) {
      return NextResponse.json(
        {
          error:
            `Budget cannot be unlocked while ${activeMods.length} budget modification${activeMods.length === 1 ? "" : "s"} exist${activeMods.length === 1 ? "s" : ""}. ` +
            "Delete or void each modification first, then unlock the budget.",
          code: "BUDGET_HAS_ACTIVE_MODIFICATIONS",
          modificationCount: activeMods.length,
          modifications: activeMods.map((m) => ({
            id: m.id,
            number: m.number,
            status: m.status,
          })),
        },
        { status: 409 },
      );
    }

    // Delete budget line items if requested
    let deletedCount = 0;
    if (!preserveLineItems) {
      const { error: deleteError, count } = await supabase
        .from("budget_lines")
        .delete({ count: "exact" })
        .eq("project_id", projectIdNum);

      if (deleteError) {
        return NextResponse.json(
          { error: `Failed to delete budget line items: ${deleteError.message}` },
          { status: 500 },
        );
      }

      deletedCount = count || 0;
    }

    // Unlock the budget - Remove .single() to avoid "Cannot coerce" error
    const { data, error } = await supabase
      .from("projects")
      .update({
        budget_locked: false,
        budget_locked_at: null,
        budget_locked_by: null,
      })
      .eq("id", projectIdNum)
      .select();

    if (error) {
      return apiErrorResponse(error);
    }

    // Check if any rows were updated (RLS might have blocked it)
    if (!data || data.length === 0) {
      return NextResponse.json(
        {
          error:
            "Permission denied: You do not have access to unlock this budget",
        },
        { status: 403 },
      );
    }

    const updatedProject = data[0];

    return NextResponse.json({
      success: true,
      message: "Budget unlocked successfully",
      deletedCount,
      data: {
        budget_locked: updatedProject.budget_locked,
        budget_locked_at: updatedProject.budget_locked_at,
        budget_locked_by: updatedProject.budget_locked_by,
      },
    });
    },
);

// GET /api/projects/[id]/budget/lock - Get budget lock status
export const GET = withApiGuardrails<{ projectId: string }>(
  "projects/[projectId]/budget/lock#GET",
  async ({ request, params }) => {

    const { projectId } = await params;
    const projectIdNum = Number.parseInt(projectId, 10);

    if (Number.isNaN(projectIdNum)) {
      return NextResponse.json(
        { error: "Invalid project ID" },
        { status: 400 },
      );
    }

    const guard = await requirePermission(projectIdNum, "budget", "read");
    if (guard.denied) return guard.response;

    const supabase = await createClient();

    const { data: project, error } = await supabase
      .from("projects")
      .select("budget_locked, budget_locked_at, budget_locked_by")
      .eq("id", projectIdNum)
      .single();

    if (error) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    return NextResponse.json({
      isLocked: project.budget_locked || false,
      lockedAt: project.budget_locked_at,
      lockedBy: await resolveLockOwnerName(project.budget_locked_by),
      lockedByUserId: project.budget_locked_by,
    });
    },
);
