import {
  parseJsonBody,
  validateResponseContract,
  withApiGuardrails,
} from "@/lib/guardrails/api";
import { GuardrailError } from "@/lib/guardrails/errors";
import { requirePermission } from "@/lib/permissions-guard";
import { createClient, getApiRouteUser } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { z } from "zod";

const whereBase = "projects/[projectId]/submittals/settings";

const packageSortOrderSchema = z.enum(["ascending", "descending"]);

const DEFAULT_SETTINGS = {
  default_submittal_manager_id: null as string | null,
  default_distribution: null as string | null,
  package_sort_order: "ascending" as const,
  default_submit_response_days: 14,
  include_spec_section_number: true,
  submittals_private_by_default: false,
  allow_approvers_to_add_reviewers: true,
  approver_responses_required_by_default: true,
  enable_reject_workflow: false,
  enable_dynamic_approver_due_dates: false,
  enable_overdue_email_reminders: true,
  enable_qr_codes: false,
  enable_schedule_calculations: false,
  allow_email_attachment_download_without_login: false,
  email_notify_submittal_created: true,
  email_notify_submittal_updated: true,
  email_notify_submittal_distributed: true,
  email_notify_submittal_closed: true,
};

const settingsPayloadSchema = z.object({
  default_submittal_manager_id: z.string().uuid().nullable().optional(),
  default_distribution: z.string().trim().max(4000).nullable().optional(),
  package_sort_order: packageSortOrderSchema.optional(),
  default_submit_response_days: z.number().int().min(0).max(365).optional(),
  include_spec_section_number: z.boolean().optional(),
  submittals_private_by_default: z.boolean().optional(),
  allow_approvers_to_add_reviewers: z.boolean().optional(),
  approver_responses_required_by_default: z.boolean().optional(),
  enable_reject_workflow: z.boolean().optional(),
  enable_dynamic_approver_due_dates: z.boolean().optional(),
  enable_overdue_email_reminders: z.boolean().optional(),
  enable_qr_codes: z.boolean().optional(),
  enable_schedule_calculations: z.boolean().optional(),
  allow_email_attachment_download_without_login: z.boolean().optional(),
  email_notify_submittal_created: z.boolean().optional(),
  email_notify_submittal_updated: z.boolean().optional(),
  email_notify_submittal_distributed: z.boolean().optional(),
  email_notify_submittal_closed: z.boolean().optional(),
});

const settingsResponseSchema = settingsPayloadSchema.required().extend({
  project_id: z.number().int(),
  updated_at: z.string().nullable(),
});

type SubmittalSettingsRow = z.infer<typeof settingsPayloadSchema> & {
  project_id?: number | null;
  updated_at?: string | null;
};

type RuntimeSubmittalSettingsClient = {
  auth: {
    getUser: () => Promise<{
      data: { user: { id: string } | null };
      error: unknown;
    }>;
  };
  from: (table: "submittal_project_settings") => {
    select: (query: string) => {
      eq: (
        column: "project_id",
        value: number,
      ) => {
        maybeSingle: () => Promise<{
          data: SubmittalSettingsRow | null;
          error: unknown;
        }>;
      };
    };
    upsert: (
      row: Record<string, unknown>,
      options: { onConflict: string },
    ) => {
      select: (query: string) => {
        single: () => Promise<{
          data: SubmittalSettingsRow | null;
          error: unknown;
        }>;
      };
    };
  };
};

function parseProjectId(projectId: string, where: string): number {
  const parsed = Number.parseInt(projectId, 10);
  if (!Number.isInteger(parsed)) {
    throw new GuardrailError({
      code: "INVALID_PAYLOAD",
      where,
      message: "Invalid project ID.",
      details: [{ path: "projectId", message: "Project ID must be a number." }],
    });
  }
  return parsed;
}

function isMissingSettingsTable(error: unknown): boolean {
  const serialized = JSON.stringify(error);
  return (
    serialized.includes("submittal_project_settings") ||
    serialized.includes("PGRST205") ||
    serialized.includes("schema cache")
  );
}

function normalizeSettings(projectId: number, row?: SubmittalSettingsRow | null) {
  return {
    ...DEFAULT_SETTINGS,
    ...(row ?? {}),
    project_id: projectId,
    updated_at: row?.updated_at ?? null,
  };
}

const responseColumns = [
  "project_id",
  "default_submittal_manager_id",
  "default_distribution",
  "package_sort_order",
  "default_submit_response_days",
  "include_spec_section_number",
  "submittals_private_by_default",
  "allow_approvers_to_add_reviewers",
  "approver_responses_required_by_default",
  "enable_reject_workflow",
  "enable_dynamic_approver_due_dates",
  "enable_overdue_email_reminders",
  "enable_qr_codes",
  "enable_schedule_calculations",
  "allow_email_attachment_download_without_login",
  "email_notify_submittal_created",
  "email_notify_submittal_updated",
  "email_notify_submittal_distributed",
  "email_notify_submittal_closed",
  "updated_at",
].join(", ");

export const GET = withApiGuardrails(`${whereBase}#GET`, async ({ params }) => {
  const { projectId } = await params;
  const where = `${whereBase}#GET`;
  const projectIdNum = parseProjectId(projectId, where);

  const guard = await requirePermission(projectIdNum, "submittals", "read");
  if (guard.denied) return guard.response;

  const supabase =
    (await createClient()) as unknown as RuntimeSubmittalSettingsClient;
  const { data, error } = await supabase
    .from("submittal_project_settings")
    .select(responseColumns)
    .eq("project_id", projectIdNum)
    .maybeSingle();

  if (error) {
    if (isMissingSettingsTable(error)) {
      throw new GuardrailError({
        code: "INTERNAL_ERROR",
        where,
        message:
          "Submittal settings table is missing. Apply the latest Supabase migrations before loading submittal settings.",
        status: 500,
        severity: "high",
      });
    }
    throw new GuardrailError({
      code: "INTERNAL_ERROR",
      where,
      message: "Failed to load submittal settings.",
      details: error,
    });
  }

  return NextResponse.json(
    validateResponseContract(
      settingsResponseSchema,
      normalizeSettings(projectIdNum, data),
      `${where}:response`,
    ),
  );
});

export const PUT = withApiGuardrails(
  `${whereBase}#PUT`,
  async ({ request, params }) => {
    const { projectId } = await params;
    const where = `${whereBase}#PUT`;
    const projectIdNum = parseProjectId(projectId, where);

    const guard = await requirePermission(projectIdNum, "submittals", "admin");
    if (guard.denied) return guard.response;

    const payload = await parseJsonBody(
      request,
      settingsPayloadSchema,
      `${where}:payload`,
    );

    const supabase =
      (await createClient()) as unknown as RuntimeSubmittalSettingsClient;
    const user = await getApiRouteUser();

    if (!user) {
      throw new GuardrailError({
        code: "AUTH_EXPIRED",
        where,
        message: "Authentication required.",
      });
    }

    const { data, error } = await supabase
      .from("submittal_project_settings")
      .upsert(
        {
          project_id: projectIdNum,
          ...payload,
          updated_by: user.id,
        },
        { onConflict: "project_id" },
      )
      .select(responseColumns)
      .single();

    if (error) {
      if (isMissingSettingsTable(error)) {
        throw new GuardrailError({
          code: "INTERNAL_ERROR",
          where,
          message:
            "Submittal settings table is missing. Apply the latest Supabase migrations before saving submittal settings.",
          status: 500,
          severity: "high",
        });
      }
      throw new GuardrailError({
        code: "INTERNAL_ERROR",
        where,
        message: "Failed to save submittal settings.",
        details: error,
      });
    }

    return NextResponse.json(
      validateResponseContract(
        settingsResponseSchema,
        normalizeSettings(projectIdNum, data),
        `${where}:response`,
      ),
    );
  },
);
