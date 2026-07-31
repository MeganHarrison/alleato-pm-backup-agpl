import { NextResponse } from "next/server";

import { withApiGuardrails } from "@/lib/guardrails/api";
import { GuardrailError } from "@/lib/guardrails/errors";
import { requirePermission } from "@/lib/permissions-guard";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import type { Database } from "@/types/database.types";

type BillingFrequency = Database["public"]["Enums"]["billing_period_frequency"];

const DEFAULT_SETTINGS = {
  default_billing_start_day: 1,
  default_billing_end_day: 31,
  default_billing_due_day: 25,
  default_retainage_percent: 10,
  allow_over_billing: false,
  notify_subs_on_approval: true,
  send_under_review_digest: true,
  invite_reminder_frequency_days: 0,
  invoice_pdf_footer_text: "",
  invitation_custom_message: "",
  automatic_billing_frequency: "never" as BillingFrequency,
  automatic_anchor_start_date: null as string | null,
  automatic_anchor_end_date: null as string | null,
  automatic_anchor_due_date: null as string | null,
  automatic_occurrence_cursor: 0,
};

const UPDATABLE_FIELDS = [
  "default_billing_start_day",
  "default_billing_end_day",
  "default_billing_due_day",
  "default_retainage_percent",
  "allow_over_billing",
  "notify_subs_on_approval",
  "send_under_review_digest",
  "invite_reminder_frequency_days",
  "invoice_pdf_footer_text",
  "invitation_custom_message",
] as const;

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

function withDefaults(projectId: number, data: Record<string, unknown> | null) {
  if (!data) {
    return {
      id: null,
      project_id: projectId,
      ...DEFAULT_SETTINGS,
      created_at: null,
      updated_at: null,
    };
  }
  return {
    ...DEFAULT_SETTINGS,
    ...Object.fromEntries(
      Object.entries(data).filter(
        ([, value]) => value !== null && value !== undefined,
      ),
    ),
    automatic_anchor_start_date: data.automatic_anchor_start_date ?? null,
    automatic_anchor_end_date: data.automatic_anchor_end_date ?? null,
    automatic_anchor_due_date: data.automatic_anchor_due_date ?? null,
  };
}

export const GET = withApiGuardrails<{ projectId: string }>(
  "projects/[projectId]/invoicing/settings#GET",
  async ({ params }) => {
    const where = "projects/[projectId]/invoicing/settings#GET";
    const projectIdNum = parseProjectId(params.projectId, where);
    const guard = await requirePermission(projectIdNum, "contracts", "read");
    if (guard.denied) return guard.response;

    const supabase = await createClient();
    const { data, error } = await supabase
      .from("invoicing_settings")
      .select("*")
      .eq("project_id", projectIdNum)
      .maybeSingle();

    if (error) {
      return NextResponse.json(
        { error: "Failed to load invoicing settings.", details: error.message },
        { status: 500 },
      );
    }
    return NextResponse.json({
      data: withDefaults(projectIdNum, data as Record<string, unknown> | null),
    });
  },
);

export const PATCH = withApiGuardrails<{ projectId: string }>(
  "projects/[projectId]/invoicing/settings#PATCH",
  async ({ request, params }) => {
    const where = "projects/[projectId]/invoicing/settings#PATCH";
    const projectIdNum = parseProjectId(params.projectId, where);
    const guard = await requirePermission(projectIdNum, "contracts", "admin");
    if (guard.denied) return guard.response;

    const body = (await request.json()) as Record<string, unknown>;
    const updates: Record<string, unknown> = {};
    for (const field of UPDATABLE_FIELDS) {
      if (field in body && body[field] !== undefined)
        updates[field] = body[field];
    }

    for (const field of [
      "default_billing_start_day",
      "default_billing_end_day",
      "default_billing_due_day",
    ] as const) {
      if (updates[field] === undefined || updates[field] === null) continue;
      const value = Number(updates[field]);
      if (!Number.isInteger(value) || value < 1 || value > 31) {
        return NextResponse.json(
          { error: `${field} must be an integer between 1 and 31.` },
          { status: 400 },
        );
      }
      updates[field] = value;
    }

    if (updates.default_retainage_percent !== undefined) {
      const value = Number(updates.default_retainage_percent);
      if (!Number.isFinite(value) || value < 0 || value > 100) {
        return NextResponse.json(
          { error: "default_retainage_percent must be between 0 and 100." },
          { status: 400 },
        );
      }
      updates.default_retainage_percent = value;
    }

    if (updates.invite_reminder_frequency_days !== undefined) {
      const value = Number(updates.invite_reminder_frequency_days);
      if (!Number.isInteger(value) || value < 0) {
        return NextResponse.json(
          {
            error:
              "invite_reminder_frequency_days must be a non-negative integer.",
          },
          { status: 400 },
        );
      }
      updates.invite_reminder_frequency_days = value;
    }

    const service = createServiceClient();
    const frequencyValue = body.automatic_billing_frequency;
    if (frequencyValue !== undefined) {
      if (!["never", "monthly", "weekly"].includes(String(frequencyValue))) {
        return NextResponse.json(
          { error: "Automatic frequency must be Never, Monthly, or Weekly." },
          { status: 400 },
        );
      }

      const frequency = String(frequencyValue) as BillingFrequency;
      const startDate =
        typeof body.automatic_anchor_start_date === "string"
          ? body.automatic_anchor_start_date
          : null;
      const endDate =
        typeof body.automatic_anchor_end_date === "string"
          ? body.automatic_anchor_end_date
          : null;
      const dueDate =
        typeof body.automatic_anchor_due_date === "string"
          ? body.automatic_anchor_due_date
          : null;

      const { error } = await service.rpc(
        "configure_automatic_billing_periods",
        {
          p_project_id: projectIdNum,
          p_frequency: frequency,
          p_anchor_start_date: startDate as never,
          p_anchor_end_date: endDate as never,
          p_anchor_due_date: dueDate as never,
        },
      );
      if (error) {
        const status =
          error.code === "23514"
            ? 422
            : error.code === "23505"
              ? 409
              : error.code === "P0002"
                ? 404
                : 500;
        return NextResponse.json(
          {
            error:
              error.message ||
              "Automatic billing settings could not be saved. The prior schedule is unchanged.",
          },
          { status },
        );
      }
    }

    if (Object.keys(updates).length > 0) {
      const { error } = await service
        .from("invoicing_settings")
        .upsert(
          {
            project_id: projectIdNum,
            ...updates,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "project_id" },
        );
      if (error) {
        return NextResponse.json(
          {
            error: "Invoicing settings could not be saved.",
            details: error.message,
          },
          { status: 500 },
        );
      }
    }

    const { data, error } = await service
      .from("invoicing_settings")
      .select("*")
      .eq("project_id", projectIdNum)
      .maybeSingle();
    if (error) {
      return NextResponse.json(
        {
          error: "Settings were saved but could not be read back.",
          details: error.message,
        },
        { status: 500 },
      );
    }
    return NextResponse.json({
      data: withDefaults(projectIdNum, data as Record<string, unknown> | null),
    });
  },
);
