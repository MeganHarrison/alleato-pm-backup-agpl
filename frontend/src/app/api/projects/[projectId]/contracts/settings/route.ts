import {
  parseJsonBody,
  validateResponseContract,
  withApiGuardrails,
} from "@/lib/guardrails/api";
import { GuardrailError } from "@/lib/guardrails/errors";
import { createClient, getApiRouteUser } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import { requirePermission } from "@/lib/permissions-guard";

interface RouteParams {
  params: Promise<{ projectId: string }>;
}

// Defaults used when no row exists yet (lazy-init pattern)
const DEFAULT_SETTINGS = {
  co_tier_count: 2 as const,
  allow_standard_users_create_pcco: false,
  allow_standard_users_create_pco: false,
  sov_always_editable: false,
  enable_completed_work_retainage: false,
  enable_stored_materials_retainage: false,
  default_retainage_percent: 10,
  show_markup_on_co_pdf: true,
  show_markup_on_invoice_pdf: true,
  default_distribution_prime_contract: null as string | null,
  default_distribution_pcco: null as string | null,
  default_distribution_pco: null as string | null,
};

const updateSettingsSchema = z.object({
  co_tier_count: z.union([z.literal(1), z.literal(2)]).optional(),
  allow_standard_users_create_pcco: z.boolean().optional(),
  allow_standard_users_create_pco: z.boolean().optional(),
  sov_always_editable: z.boolean().optional(),
  enable_completed_work_retainage: z.boolean().optional(),
  enable_stored_materials_retainage: z.boolean().optional(),
  default_retainage_percent: z.number().min(0).max(100).optional(),
  show_markup_on_co_pdf: z.boolean().optional(),
  show_markup_on_invoice_pdf: z.boolean().optional(),
  default_distribution_prime_contract: z.string().nullable().optional(),
  default_distribution_pcco: z.string().nullable().optional(),
  default_distribution_pco: z.string().nullable().optional(),
});

const settingsResponseSchema = z.object({
  project_id: z.number().int(),
  co_tier_count: z.union([z.literal(1), z.literal(2)]),
  allow_standard_users_create_pcco: z.boolean(),
  allow_standard_users_create_pco: z.boolean(),
  sov_always_editable: z.boolean(),
  enable_completed_work_retainage: z.boolean(),
  enable_stored_materials_retainage: z.boolean(),
  default_retainage_percent: z.number().min(0).max(100),
  show_markup_on_co_pdf: z.boolean(),
  show_markup_on_invoice_pdf: z.boolean(),
  default_distribution_prime_contract: z.string().nullable(),
  default_distribution_pcco: z.string().nullable(),
  default_distribution_pco: z.string().nullable(),
});

type SettingsRow = {
  co_tier_count?: number | null;
  allow_standard_users_create_pcco?: boolean | null;
  allow_standard_users_create_pco?: boolean | null;
  sov_always_editable?: boolean | null;
  enable_completed_work_retainage?: boolean | null;
  enable_stored_materials_retainage?: boolean | null;
  default_retainage_percent?: number | null;
  show_markup_on_co_pdf?: boolean | null;
  show_markup_on_invoice_pdf?: boolean | null;
  default_distribution_prime_contract?: string | null;
  default_distribution_pcco?: string | null;
  default_distribution_pco?: string | null;
};

function normalizeSettingsRow(projectId: number, data?: SettingsRow | null) {
  const coTier: 1 | 2 = data?.co_tier_count === 1 ? 1 : data?.co_tier_count === 2 ? 2 : DEFAULT_SETTINGS.co_tier_count;
  return {
    ...DEFAULT_SETTINGS,
    ...(data ?? {}),
    co_tier_count: coTier,
    project_id: projectId,
  };
}

/**
 * GET /api/projects/[projectId]/contracts/settings
 * Returns the prime contract project-level settings.
 * If no row exists, returns defaults (lazy init — no row written until first save).
 */
export const GET = withApiGuardrails(
  "projects/[projectId]/contracts/settings#GET",
  async ({ params }) => {
    const { projectId } = await params;
    const projectIdNum = parseInt(projectId, 10);
    const supabase = await createClient();
    const user = await getApiRouteUser();

    if (!user) {
      throw new GuardrailError({
        code: "AUTH_EXPIRED",
        where: "projects/[projectId]/contracts/settings#GET",
        message: "Authentication required.",
      });
    }

    const { data, error } = await supabase
      .from("prime_contract_project_settings")
      .select("*")
      .eq("project_id", projectIdNum)
      .single();

    if (error && error.code !== "PGRST116") {
      throw new GuardrailError({
        code: "INTERNAL_ERROR",
        where: "projects/[projectId]/contracts/settings#GET",
        message: "Failed to fetch prime contract settings.",
        details: error.message,
      });
    }

    const responseBody = validateResponseContract(
      settingsResponseSchema,
      normalizeSettingsRow(projectIdNum, data),
      "projects/[projectId]/contracts/settings#GET:response",
    );

    return NextResponse.json(responseBody);
  },
);

/**
 * PUT /api/projects/[projectId]/contracts/settings
 * Upserts the prime contract settings for a project.
 */
export const PUT = withApiGuardrails(
  "projects/[projectId]/contracts/settings#PUT",
  async ({ request, params }) => {
    const { projectId } = await params;
    const projectIdNum = parseInt(projectId, 10);
    const guard = await requirePermission(projectIdNum, "contracts", "admin");
    if (guard.denied) return guard.response;

    const supabase = await createClient();
    const validatedData = await parseJsonBody(
      request,
      updateSettingsSchema,
      "projects/[projectId]/contracts/settings#PUT:payload",
    );

    // Upsert (insert if not exists, update if exists)
    const { data, error } = await supabase
      .from("prime_contract_project_settings")
      .upsert(
        {
          project_id: parseInt(projectId, 10),
          ...validatedData,
        },
        { onConflict: "project_id" },
      )
      .select()
      .single();

    if (error) {
      throw new GuardrailError({
        code: "INTERNAL_ERROR",
        where: "projects/[projectId]/contracts/settings#PUT",
        message: "Failed to save prime contract settings.",
        details: error.message,
      });
    }

    const responseBody = validateResponseContract(
      settingsResponseSchema,
      normalizeSettingsRow(projectIdNum, data),
      "projects/[projectId]/contracts/settings#PUT:response",
    );

    return NextResponse.json(responseBody);
  },
);
