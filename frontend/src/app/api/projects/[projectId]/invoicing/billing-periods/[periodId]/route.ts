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

function saveError(error: { code?: string; message?: string }) {
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
      { error: error.message || "Billing period not found." },
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

export const GET = withApiGuardrails<{
  projectId: string;
  periodId: string;
}>(
  "projects/[projectId]/invoicing/billing-periods/[periodId]#GET",
  async ({ params }) => {
    const where =
      "projects/[projectId]/invoicing/billing-periods/[periodId]#GET";
    const projectIdNum = parseProjectId(params.projectId, where);
    const guard = await requirePermission(projectIdNum, "contracts", "read");
    if (guard.denied) return guard.response;

    const supabase = await createClient();
    const { data, error } = await supabase
      .from("billing_periods")
      .select("*")
      .eq("id", params.periodId)
      .eq("project_id", projectIdNum)
      .maybeSingle();

    if (error) {
      return NextResponse.json(
        { error: "Failed to load billing period.", details: error.message },
        { status: 500 },
      );
    }
    if (!data) {
      return NextResponse.json(
        { error: "Billing period not found." },
        { status: 404 },
      );
    }
    return NextResponse.json({ data });
  },
);

export const PATCH = withApiGuardrails<{
  projectId: string;
  periodId: string;
}>(
  "projects/[projectId]/invoicing/billing-periods/[periodId]#PATCH",
  async ({ request, params }) => {
    const where =
      "projects/[projectId]/invoicing/billing-periods/[periodId]#PATCH";
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

    const supabase = await createClient();
    const { data: existing, error: fetchError } = await supabase
      .from("billing_periods")
      .select("*")
      .eq("id", params.periodId)
      .eq("project_id", projectIdNum)
      .maybeSingle();

    if (fetchError) {
      return NextResponse.json(
        {
          error: "Failed to inspect billing period.",
          details: fetchError.message,
        },
        { status: 500 },
      );
    }
    if (!existing) {
      return NextResponse.json(
        { error: "Billing period not found." },
        { status: 404 },
      );
    }

    const body = (await request.json()) as Record<string, unknown>;
    const startDate =
      typeof body.start_date === "string"
        ? body.start_date
        : existing.start_date;
    const endDate =
      typeof body.end_date === "string" ? body.end_date : existing.end_date;
    const dueDate =
      typeof body.due_date === "string"
        ? body.due_date
        : (existing.due_date ?? "");
    const name =
      body.name === null
        ? null
        : typeof body.name === "string"
          ? body.name
          : existing.name;
    const isClosed =
      typeof body.is_closed === "boolean"
        ? body.is_closed
        : existing.is_closed === true;

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
      p_period_id: params.periodId,
      p_start_date: startDate,
      p_end_date: endDate,
      p_due_date: dueDate,
      p_name: name ?? "",
      p_is_closed: isClosed,
      p_actor_id: user.id,
    });

    if (error) return saveError(error);
    return NextResponse.json({ data });
  },
);

export const DELETE = withApiGuardrails<{
  projectId: string;
  periodId: string;
}>(
  "projects/[projectId]/invoicing/billing-periods/[periodId]#DELETE",
  async ({ params }) => {
    const where =
      "projects/[projectId]/invoicing/billing-periods/[periodId]#DELETE";
    const projectIdNum = parseProjectId(params.projectId, where);
    const guard = await requirePermission(projectIdNum, "contracts", "admin");
    if (guard.denied) return guard.response;

    const service = createServiceClient();
    const { error } = await service.rpc("delete_billing_period_atomic", {
      p_project_id: projectIdNum,
      p_period_id: params.periodId,
    });

    if (error?.code === "23503") {
      return NextResponse.json(
        {
          error:
            "This billing period is linked to invoice or payment history and cannot be deleted.",
          details: error.details,
        },
        { status: 409 },
      );
    }
    if (error?.code === "P0002") {
      return NextResponse.json(
        { error: "Billing period not found." },
        { status: 404 },
      );
    }
    if (error) {
      return NextResponse.json(
        { error: error.message || "Failed to delete billing period." },
        { status: 500 },
      );
    }

    return NextResponse.json({ message: "Billing period deleted." });
  },
);
