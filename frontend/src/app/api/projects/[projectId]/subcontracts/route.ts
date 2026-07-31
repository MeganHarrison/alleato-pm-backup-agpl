import { withApiGuardrails } from "@/lib/guardrails/api";
import { GuardrailError } from "@/lib/guardrails/errors";
import { NextResponse } from "next/server";
import { createClient, getApiRouteUser } from "@/lib/supabase/server";
import { CreateSubcontractSchema } from "@/lib/schemas/create-subcontract-schema";
import { mapFormToInsert } from "@/lib/db/subcontracts";
import { apiErrorResponse } from "@/lib/api-error";
import { logger } from "@/lib/logger";
import {
  fetchCommitmentSovProjectBudgetCodes,
  resolveCommitmentSovBudgetCodeFromLookup,
} from "@/lib/commitments/sov-budget-code-resolution.server";

/**
 * GET /api/projects/[id]/subcontracts
 * Fetch all subcontracts for a project
 */
export const GET = withApiGuardrails<{ projectId: string }>(
  "projects/[projectId]/subcontracts#GET",
  async ({ request, params }) => {
  
    const { projectId } = await params;
    const supabase = await createClient();

    const user = await getApiRouteUser();
    if (!user) {
      throw new GuardrailError({ code: "AUTH_EXPIRED", where: "projects/[projectId]/subcontracts#GET", message: "Authentication required." });
    }

    // Fetch subcontracts with totals view
    const { data, error } = await supabase
      .from("subcontracts_with_totals")
      .select("*")
      .eq("project_id", parseInt(projectId, 10))
      .order("created_at", { ascending: false });

    if (error) {
      logger.error({ msg: "Error fetching subcontracts", error: error.message });
      return NextResponse.json(
        { error: "Failed to fetch subcontracts" },
        { status: 500 },
      );
    }

    return NextResponse.json({ data });
    },
);

/**
 * POST /api/projects/[id]/subcontracts
 * Create a new subcontract
 */
export const POST = withApiGuardrails<{ projectId: string }>(
  "projects/[projectId]/subcontracts#POST",
  async ({ request, params }) => {
  const { projectId } = await params;
  logger.info({ msg: `[Subcontracts API] POST /api/projects/${projectId}/subcontracts - Starting` });

  try {
    const supabase = await createClient();

    const user = await getApiRouteUser();
    if (!user) {
      logger.error({ msg: "[Subcontracts API] No authenticated user found" });
      return NextResponse.json(
        { error: "Unauthorized - no user session. Please log in again." },
        { status: 401 },
      );
    }

    logger.debug({ msg: "[Subcontracts API] Authenticated user", email: user.email ?? "unknown", userId: user.id });

    // Parse and validate request body
    const body = await request.json();
    logger.debug({ msg: "[Subcontracts API] Request body received" });

    const validationResult = CreateSubcontractSchema.safeParse(body);

    if (!validationResult.success) {
      logger.error({ msg: "[Subcontracts API] Validation failed", issues: validationResult.error.issues });
      return NextResponse.json(
        {
          error: "Validation failed - please check your input",
          details: validationResult.error.issues.map((issue) => ({
            field: issue.path.join("."),
            message: issue.message,
          })),
        },
        { status: 400 },
      );
    }

    const data = validationResult.data;

    // Use the typed mapper - this is the ONLY place camelCase -> snake_case happens
    // If you get schema errors, fix them in src/lib/db/subcontracts.ts
    const subcontractData = mapFormToInsert(data, parseInt(projectId), user.id);

    logger.debug({ msg: "[Subcontracts API] Inserting subcontract" });

    const { data: subcontract, error: subcontractError } = await supabase
      .from("subcontracts")
      .insert(subcontractData)
      .select()
      .single();

    if (subcontractError) {
      logger.error({ msg: "[Subcontracts API] Database insert error", error: subcontractError.message, code: subcontractError.code });

      // Provide more helpful error messages based on error code
      let userMessage = "Failed to create subcontract";
      if (subcontractError.code === "23505") {
        userMessage =
          "A subcontract with this contract number already exists for this project";
      } else if (subcontractError.code === "42501") {
        userMessage =
          "Permission denied - RLS policy blocked the insert. Check your project permissions.";
      } else if (subcontractError.code === "23503") {
        userMessage =
          "Invalid reference - contract company or other referenced record does not exist";
      }

      return NextResponse.json(
        {
          error: userMessage,
          details: {
            code: subcontractError.code,
            message: subcontractError.message,
            hint: subcontractError.hint,
          },
        },
        { status: 500 },
      );
    }

    logger.info({ msg: "[Subcontracts API] Subcontract created successfully", subcontractId: subcontract.id });

    // Create SOV line items if provided
    if (data.sov && data.sov.length > 0) {
      logger.info({ msg: `[Subcontracts API] Creating ${data.sov.length} SOV line items` });
      const toNumber = (v: unknown): number => {
        if (typeof v === "number") return v;
        if (typeof v === "string") {
          const n = Number(v);
          return Number.isFinite(n) ? n : 0;
        }
        return 0;
      };
      const projectBudgetCodes = await fetchCommitmentSovProjectBudgetCodes(
        supabase,
        parseInt(projectId, 10),
        "projects/[projectId]/subcontracts#POST",
      );
      const sovItems = await Promise.all(
        data.sov.map((item, index) => {
          const lineNumber = item.lineNumber || index + 1;
          const budgetCode = resolveCommitmentSovBudgetCodeFromLookup({
            budgetCodes: projectBudgetCodes,
            lineNumber,
            where: "projects/[projectId]/subcontracts#POST",
            submittedBudgetCode: item.budgetCode,
            submittedProjectBudgetCodeId:
              item.projectBudgetCodeId ?? item.budgetCodeId ?? null,
          });

          return {
            subcontract_id: subcontract.id,
            line_number: lineNumber,
            change_event_line_item: item.changeEventLineItem || null,
            budget_code: budgetCode.displayBudgetCode,
            project_budget_code_id: budgetCode.projectBudgetCodeId,
            description: item.description || null,
            amount: toNumber(item.amount),
            billed_to_date: toNumber(item.billedToDate),
            sort_order: index,
          };
        }),
      );

      const { error: sovError } = await supabase
        .from("subcontract_sov_items")
        .insert(sovItems);

      if (sovError) {
        logger.error({ msg: "[Subcontracts API] Error creating SOV items", error: sovError.message });
        // Rollback: delete the subcontract we just created
        await supabase.from("subcontracts").delete().eq("id", subcontract.id);
        return NextResponse.json(
          {
            error: "Failed to create schedule of values line items",
            details: {
              code: sovError.code,
              message: sovError.message,
            },
          },
          { status: 500 },
        );
      }
      logger.info({ msg: "[Subcontracts API] SOV items created successfully" });
    }

    // Fetch the complete subcontract with totals
    const { data: completeSubcontract, error: fetchError } = await supabase
      .from("subcontracts_with_totals")
      .select("*")
      .eq("id", subcontract.id)
      .single();

    if (fetchError) {
      logger.error({ msg: "[Subcontracts API] Error fetching complete subcontract", error: fetchError.message });
      // Don't fail here, we already created successfully
      logger.warn({ msg: "[Subcontracts API] Returning basic subcontract data" });
      return NextResponse.json({
        data: subcontract,
        message: "Subcontract created successfully",
      });
    }

    logger.info({ msg: "[Subcontracts API] Request completed successfully" });
    return NextResponse.json({
      data: completeSubcontract,
      message: "Subcontract created successfully",
    });
  } catch (error) {
    if (error instanceof GuardrailError) {
      throw error;
    }
    return apiErrorResponse(error);
  }
  },
);
