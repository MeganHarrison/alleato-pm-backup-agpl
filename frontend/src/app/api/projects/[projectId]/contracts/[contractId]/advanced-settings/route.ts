import { NextResponse } from "next/server";
import { z } from "zod";

import {
  parseJsonBody, validateResponseContract, withApiGuardrails, } from "@/lib/guardrails/api";
import { GuardrailError } from "@/lib/guardrails/errors";
import { requirePermission } from "@/lib/permissions-guard";
import { createClient } from "@/lib/supabase/server";
import { serviceDb } from "@/lib/supabase/service-db";

interface RouteParams {
  params: Promise<{ projectId: string; contractId: string }>;
}

const projectSettingsSchema = z.object({
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

const contractSettingsSchema = z.object({
  inclusions: z.string().nullable(),
  exclusions: z.string().nullable(),
  is_private: z.boolean(),
  retention_percentage: z.number().min(0).max(100),
  payment_terms: z.string().nullable(),
  billing_schedule: z.string().nullable(),
});

const saveAdvancedSettingsSchema = z.object({
  project_settings: projectSettingsSchema,
  contract_settings: contractSettingsSchema,
});

const responseSchema = z.object({
  project_settings: projectSettingsSchema.extend({
    project_id: z.number().int(),
  }),
  contract: z.object({
    id: z.string().uuid(),
    project_id: z.number().int(),
    inclusions: z.string().nullable(),
    exclusions: z.string().nullable(),
    is_private: z.boolean(),
    retention_percentage: z.number().nullable(),
    payment_terms: z.string().nullable(),
    billing_schedule: z.string().nullable(),
    updated_at: z.string(),
  }),
});

export const PUT = withApiGuardrails(
  "projects/[projectId]/contracts/[contractId]/advanced-settings#PUT",
  async ({ request, params }) => {
    const { projectId, contractId } = await params;
    const projectIdNum = parseInt(projectId, 10);
    const permission = await requirePermission(projectIdNum, "contracts", "admin");
    if (permission.denied) return permission.response;

    const supabase = await createClient();
    const payload = await parseJsonBody(
      request,
      saveAdvancedSettingsSchema,
      "projects/[projectId]/contracts/[contractId]/advanced-settings#PUT:payload",
    );

    const { data: contractExists, error: contractCheckError } = await supabase
      .from("prime_contracts")
      .select("id")
      .eq("id", contractId)
      .eq("project_id", projectIdNum)
      .maybeSingle();

    if (contractCheckError) {
      throw new GuardrailError({
        code: "INTERNAL_ERROR",
        where: "projects/[projectId]/contracts/[contractId]/advanced-settings#PUT",
        message: "Failed to validate contract before save.",
        details: contractCheckError.message,
      });
    }

    if (!contractExists) {
      throw new GuardrailError({
        code: "INVALID_PAYLOAD",
        where: "projects/[projectId]/contracts/[contractId]/advanced-settings#PUT",
        message: "Prime contract not found for this project.",
        status: 404,
      });
    }

    const { data: previousProjectSettings, error: previousSettingsError } = await supabase
      .from("prime_contract_project_settings")
      .select("*")
      .eq("project_id", projectIdNum)
      .maybeSingle();

    if (previousSettingsError && previousSettingsError.code !== "PGRST116") {
      throw new GuardrailError({
        code: "INTERNAL_ERROR",
        where: "projects/[projectId]/contracts/[contractId]/advanced-settings#PUT",
        message: "Failed to read existing project settings before save.",
        details: previousSettingsError.message,
      });
    }

    const { data: previousContractSettings, error: previousContractError } = await supabase
      .from("prime_contracts")
      .select(
        "inclusions, exclusions, is_private, retention_percentage, payment_terms, billing_schedule",
      )
      .eq("id", contractId)
      .eq("project_id", projectIdNum)
      .single();

    if (previousContractError) {
      throw new GuardrailError({
        code: "INTERNAL_ERROR",
        where: "projects/[projectId]/contracts/[contractId]/advanced-settings#PUT",
        message: "Failed to read existing contract settings before save.",
        details: previousContractError.message,
      });
    }

    // Business rule: CO tier count is locked once any change order exists for the project
    const incomingTierCount = payload.project_settings.co_tier_count;
    const existingTierCount = previousProjectSettings?.co_tier_count;
    const tierCountIsChanging = existingTierCount !== undefined && existingTierCount !== incomingTierCount;
    if (tierCountIsChanging) {
      const { count: coCount } = await supabase
        .from("prime_contract_change_orders")
        .select("id", { count: "exact", head: true })
        .eq("project_id", projectIdNum);

      if ((coCount ?? 0) > 0) {
        return NextResponse.json(
          {
            error: "Cannot change CO tier count",
            details: `The change order tier cannot be modified after change orders have been created. This project has ${coCount} change order(s). To change the tier, all change orders must be deleted first.`,
          },
          { status: 422 },
        );
      }
    }

    // Use service client for writes: the RLS INSERT policy on this table requires
    // project_directory_memberships membership, but authorization is already
    // enforced above via requirePermission(..., "admin"). Service role bypasses
    // the redundant membership check without loosening actual access control.
        const { data: savedProjectSettings, error: projectSaveError } = await serviceDb.from("prime_contract_project_settings")
      .upsert(
        {
          project_id: projectIdNum,
          ...payload.project_settings,
        },
        { onConflict: "project_id" },
      )
      .select()
      .single();

    if (projectSaveError) {
      throw new GuardrailError({
        code: "INTERNAL_ERROR",
        where: "projects/[projectId]/contracts/[contractId]/advanced-settings#PUT",
        message: "Failed to save project advanced settings.",
        details: projectSaveError.message,
      });
    }

    const { data: savedContract, error: contractSaveError } = await supabase
      .from("prime_contracts")
      .update({
        ...payload.contract_settings,
      })
      .eq("id", contractId)
      .eq("project_id", projectIdNum)
      .select(
        "id, project_id, inclusions, exclusions, is_private, retention_percentage, payment_terms, billing_schedule, updated_at",
      )
      .single();

    if (contractSaveError) {
      if (previousProjectSettings) {
        await serviceDb.from("prime_contract_project_settings")
          .update({
            co_tier_count: previousProjectSettings.co_tier_count,
            allow_standard_users_create_pcco:
              previousProjectSettings.allow_standard_users_create_pcco,
            allow_standard_users_create_pco:
              previousProjectSettings.allow_standard_users_create_pco,
            sov_always_editable: previousProjectSettings.sov_always_editable,
            enable_completed_work_retainage:
              previousProjectSettings.enable_completed_work_retainage,
            enable_stored_materials_retainage:
              previousProjectSettings.enable_stored_materials_retainage,
            default_retainage_percent:
              previousProjectSettings.default_retainage_percent,
            show_markup_on_co_pdf: previousProjectSettings.show_markup_on_co_pdf,
            show_markup_on_invoice_pdf:
              previousProjectSettings.show_markup_on_invoice_pdf,
            default_distribution_prime_contract:
              previousProjectSettings.default_distribution_prime_contract,
            default_distribution_pcco:
              previousProjectSettings.default_distribution_pcco,
            default_distribution_pco:
              previousProjectSettings.default_distribution_pco,
          })
          .eq("project_id", projectIdNum);
      } else {
        await serviceDb.from("prime_contract_project_settings")
          .delete()
          .eq("project_id", projectIdNum);
      }

      await supabase
        .from("prime_contracts")
        .update(previousContractSettings)
        .eq("id", contractId)
        .eq("project_id", projectIdNum);

      throw new GuardrailError({
        code: "INTERNAL_ERROR",
        where: "projects/[projectId]/contracts/[contractId]/advanced-settings#PUT",
        message:
          "Failed to save contract advanced settings. No settings were persisted.",
        details: contractSaveError.message,
      });
    }

    const responseBody = validateResponseContract(
      responseSchema,
      {
        project_settings: savedProjectSettings,
        contract: savedContract,
      },
      "projects/[projectId]/contracts/[contractId]/advanced-settings#PUT:response",
    );

    return NextResponse.json(responseBody);
  },
);

