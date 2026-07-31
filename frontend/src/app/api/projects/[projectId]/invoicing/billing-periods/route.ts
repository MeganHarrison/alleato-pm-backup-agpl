import { NextResponse } from "next/server";

import { withApiGuardrails } from "@/lib/guardrails/api";
import { GuardrailError } from "@/lib/guardrails/errors";
import { requirePermission } from "@/lib/permissions-guard";
import { createClient, getApiRouteUser } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { validateBillingPeriodDraft } from "@/lib/invoicing/billing-period-validation";

function parseProjectId(projectId: string, where: string): number {
  const parsed = Number.parseInt(projectId, 10);
  if (!Number.isFinite(parsed)) {
    throw new GuardrailError({
      code: "INVALID_PAYLOAD",
      where,
      message: `Invalid project id '${projectId}'.`,
    });
  }
  return parsed;
}

function billingPeriodError(error: { code?: string; message?: string }) {
  if (error.code === "23505") {
    return NextResponse.json(
      {
        error:
          "A billing period already uses this From and To date range. Choose a unique range.",
      },
      { status: 409 },
    );
  }
  if (error.code === "23514") {
    return NextResponse.json(
      { error: error.message || "The billing period dates are invalid." },
      { status: 422 },
    );
  }
  if (error.code === "P0002") {
    return NextResponse.json(
      { error: error.message || "Project not found." },
      { status: 404 },
    );
  }
  return NextResponse.json(
    {
      error:
        error.message ||
        "The billing period could not be saved. No status changes were applied.",
    },
    { status: 500 },
  );
}

// GET /api/projects/[projectId]/invoicing/billing-periods
export const GET = withApiGuardrails<{ projectId: string }>(
  "projects/[projectId]/invoicing/billing-periods#GET",
  async ({ request, params }) => {
    const where = "projects/[projectId]/invoicing/billing-periods#GET";
    const projectIdNum = parseProjectId(params.projectId, where);
    const guard = await requirePermission(projectIdNum, "contracts", "read");
    if (guard.denied) return guard.response;

    const supabase = await createClient();
    const { searchParams } = new URL(request.url);
    const isClosedParam = searchParams.get("is_closed");

    let query = supabase
      .from("billing_periods")
      .select("*")
      .eq("project_id", projectIdNum)
      .order("start_date", { ascending: false });

    if (isClosedParam === "true") query = query.eq("is_closed", true);
    if (isClosedParam === "false") query = query.eq("is_closed", false);

    const { data, error } = await query;
    if (error) {
      return NextResponse.json(
        { error: "Failed to load billing periods.", details: error.message },
        { status: 500 },
      );
    }

    return NextResponse.json({ data: data ?? [] });
  },
);

// POST /api/projects/[projectId]/invoicing/billing-periods
// Creating a period always opens it and closes the previous open period in the
// same database transaction.
export const POST = withApiGuardrails<{ projectId: string }>(
  "projects/[projectId]/invoicing/billing-periods#POST",
  async ({ request, params }) => {
    const where = "projects/[projectId]/invoicing/billing-periods#POST";
    const projectIdNum = parseProjectId(params.projectId, where);
    const guard = await requirePermission(projectIdNum, "contracts", "admin");
    if (guard.denied) return guard.response;

    const user = await getApiRouteUser();
    if (!user) {
      throw new GuardrailError({
        code: "AUTH_EXPIRED",
        where,
        message: "Authentication required.",
      });
    }

    const body = (await request.json()) as Record<string, unknown>;
    const startDate =
      typeof body.start_date === "string" ? body.start_date : "";
    const endDate = typeof body.end_date === "string" ? body.end_date : "";
    const dueDate = typeof body.due_date === "string" ? body.due_date : "";
    const name = typeof body.name === "string" ? body.name : null;

    const validationError = validateBillingPeriodDraft({
      start_date: startDate,
      end_date: endDate,
      due_date: dueDate,
    });
    if (validationError) {
      return NextResponse.json({ error: validationError }, { status: 400 });
    }

    const service = createServiceClient();
    const { data, error } = await service.rpc("save_billing_period_atomic", {
      p_project_id: projectIdNum,
      p_period_id: null as never,
      p_start_date: startDate,
      p_end_date: endDate,
      p_due_date: dueDate,
      p_name: name as never,
      p_is_closed: false,
      p_actor_id: user.id,
    });

    if (error) return billingPeriodError(error);
    return NextResponse.json({ data }, { status: 201 });
  },
);
