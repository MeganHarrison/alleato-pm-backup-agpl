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

const whereBase = "projects/[projectId]/change-events/settings";

const budgetRomModeSchema = z.enum(["latest_cost", "latest_price", "none"]);

const DEFAULT_SETTINGS = {
  maintain_budget_codes_in_sync: false,
  display_revenue_rom_columns: true,
  display_unit_columns: false,
  allow_line_item_autopopulation: true,
  always_create_commitment_cos_using_latest_cost: false,
  copy_attachments_to_prime_pcos: false,
  copy_attachments_to_commitment_cos: false,
  budget_rom_in_scope: "none" as const,
  budget_rom_out_of_scope: "none" as const,
  budget_rom_tbd_scope: "none" as const,
  prevent_budget_changes_and_prime_pcos_on_same_line_item: false,
};

const settingsPayloadSchema = z.object({
  maintain_budget_codes_in_sync: z.boolean().optional(),
  display_revenue_rom_columns: z.boolean().optional(),
  display_unit_columns: z.boolean().optional(),
  allow_line_item_autopopulation: z.boolean().optional(),
  always_create_commitment_cos_using_latest_cost: z.boolean().optional(),
  copy_attachments_to_prime_pcos: z.boolean().optional(),
  copy_attachments_to_commitment_cos: z.boolean().optional(),
  budget_rom_in_scope: budgetRomModeSchema.optional(),
  budget_rom_out_of_scope: budgetRomModeSchema.optional(),
  budget_rom_tbd_scope: budgetRomModeSchema.optional(),
  prevent_budget_changes_and_prime_pcos_on_same_line_item: z.boolean().optional(),
});

const settingsResponseSchema = settingsPayloadSchema.required().extend({
  project_id: z.number().int(),
  updated_at: z.string().nullable(),
});

type ChangeEventSettingsRow = z.infer<typeof settingsPayloadSchema> & {
  project_id?: number | null;
  updated_at?: string | null;
};

type RuntimeChangeEventSettingsClient = {
  from: (table: "change_event_project_settings") => {
    select: (query: string) => {
      eq: (
        column: "project_id",
        value: number,
      ) => {
        maybeSingle: () => Promise<{
          data: ChangeEventSettingsRow | null;
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
          data: ChangeEventSettingsRow | null;
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
    serialized.includes("change_event_project_settings") ||
    serialized.includes("PGRST205") ||
    serialized.includes("schema cache")
  );
}

function normalizeSettings(projectId: number, row?: ChangeEventSettingsRow | null) {
  return {
    ...DEFAULT_SETTINGS,
    ...(row ?? {}),
    project_id: projectId,
    updated_at: row?.updated_at ?? null,
  };
}

const responseColumns = [
  "project_id",
  "maintain_budget_codes_in_sync",
  "display_revenue_rom_columns",
  "display_unit_columns",
  "allow_line_item_autopopulation",
  "always_create_commitment_cos_using_latest_cost",
  "copy_attachments_to_prime_pcos",
  "copy_attachments_to_commitment_cos",
  "budget_rom_in_scope",
  "budget_rom_out_of_scope",
  "budget_rom_tbd_scope",
  "prevent_budget_changes_and_prime_pcos_on_same_line_item",
  "updated_at",
].join(", ");

export const GET = withApiGuardrails(`${whereBase}#GET`, async ({ params }) => {
  const { projectId } = await params;
  const where = `${whereBase}#GET`;
  const projectIdNum = parseProjectId(projectId, where);

  const guard = await requirePermission(projectIdNum, "change_events", "read");
  if (guard.denied) return guard.response;

  const supabase =
    (await createClient()) as unknown as RuntimeChangeEventSettingsClient;
  const { data, error } = await supabase
    .from("change_event_project_settings")
    .select(responseColumns)
    .eq("project_id", projectIdNum)
    .maybeSingle();

  if (error) {
    if (isMissingSettingsTable(error)) {
      throw new GuardrailError({
        code: "INTERNAL_ERROR",
        where,
        message:
          "Change event settings table is missing. Apply the latest Supabase migrations before loading change event settings.",
        status: 500,
        severity: "high",
      });
    }
    throw new GuardrailError({
      code: "INTERNAL_ERROR",
      where,
      message: "Failed to load change event settings.",
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

    const guard = await requirePermission(projectIdNum, "change_events", "admin");
    if (guard.denied) return guard.response;

    const payload = await parseJsonBody(
      request,
      settingsPayloadSchema,
      `${where}:payload`,
    );

    const user = await getApiRouteUser();
    if (!user) {
      throw new GuardrailError({
        code: "AUTH_EXPIRED",
        where,
        message: "Authentication required.",
      });
    }

    const supabase =
      (await createClient()) as unknown as RuntimeChangeEventSettingsClient;
    const { data, error } = await supabase
      .from("change_event_project_settings")
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
            "Change event settings table is missing. Apply the latest Supabase migrations before saving change event settings.",
          status: 500,
          severity: "high",
        });
      }
      throw new GuardrailError({
        code: "INTERNAL_ERROR",
        where,
        message: "Failed to save change event settings.",
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
