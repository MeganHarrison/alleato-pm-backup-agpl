import { withApiGuardrails } from "@/lib/guardrails/api";
import { GuardrailError } from "@/lib/guardrails/errors";
import { createClient, getApiRouteUser } from "@/lib/supabase/server";
import { apiErrorResponse } from "@/lib/api-error";
import { NextResponse } from "next/server";
import { createLineItemSchema } from "./validation";
import { ZodError } from "zod";
import { requirePermission } from "@/lib/permissions-guard";

interface RouteParams {
  params: Promise<{ projectId: string; contractId: string }>;
}

/**
 * GET /api/projects/[id]/contracts/[contractId]/line-items
 * Returns all line items for a specific contract
 */
export const GET = withApiGuardrails(
  "projects/[projectId]/contracts/[contractId]/line-items#GET",
  async ({ request, params }) => {
  
    const { projectId, contractId } = await params;
    const supabase = await createClient();
    const user = await getApiRouteUser();
    if (!user) {
      throw new GuardrailError({
        code: "AUTH_EXPIRED",
        where: "projects/[projectId]/contracts/[contractId]/line-items#GET",
        message: "Authentication required.",
      });
    }

    // Verify contract exists and belongs to project
    const { data: contract } = await supabase
      .from("prime_contracts")
      .select("id")
      .eq("id", contractId)
      .eq("project_id", parseInt(projectId, 10))
      .single();

    if (!contract) {
      return NextResponse.json(
        { error: "Contract not found" },
        { status: 404 },
      );
    }

    // Get all line items for this contract
    const { data, error } = await supabase
      .from("contract_line_items")
      .select("*")
      .eq("contract_id", contractId)
      .order("line_number", { ascending: true });

    if (error) {
      return NextResponse.json(
        { error: "Failed to fetch line items", details: error.message },
        { status: 400 },
      );
    }

    const lineItems = data || [];
    const costCodeIds = Array.from(
      new Set(
        lineItems
          .map((item) => item.cost_code_id)
          .filter((id): id is string => id != null),
      ),
    );

    // cost_codes.id and contract_line_items.cost_code_id are both TEXT columns.
    // Direct string match — no numeric coercion needed.
    const costCodesById = new Map<string, { id: string; code: string; name: string }>();
    if (costCodeIds.length > 0) {
      const { data: costCodes, error: costCodesError } = await supabase
        .from("cost_codes")
        .select("id, title")
        .in("id", costCodeIds);

      if (!costCodesError && costCodes) {
        for (const costCode of costCodes) {
          costCodesById.set(costCode.id, {
            id: costCode.id,
            code: costCode.id,
            name: costCode.title || "",
          });
        }
      }
    }

    return NextResponse.json(
      lineItems.map((item) => ({
        ...item,
        cost_code:
          item.cost_code_id != null
            ? costCodesById.get(item.cost_code_id) ?? undefined
            : undefined,
      })),
    );
    },
);

/**
 * POST /api/projects/[id]/contracts/[contractId]/line-items
 * Creates a new line item for a contract
 */
export const POST = withApiGuardrails(
  "projects/[projectId]/contracts/[contractId]/line-items#POST",
  async ({ request, params }) => {
  
    const { projectId, contractId } = await params;
    const projectIdNum = parseInt(projectId, 10);
    const guard = await requirePermission(projectIdNum, "contracts", "write");
    if (guard.denied) return guard.response;

    const supabase = await createClient();
    const body = await request.json();

    // Validate request body
    const validatedData = createLineItemSchema.parse({
      ...body,
      contract_id: contractId,
    });

    // Get current user
    const user = await getApiRouteUser();

    if (!user) {
      throw new GuardrailError({ code: "AUTH_EXPIRED", where: "projects/[projectId]/contracts/[contractId]/line-items#POST", message: "Authentication required." });
    }

    // DEVELOPMENT: Membership-specific line-item overrides remain disabled here.
    // TODO: Re-enable project membership enforcement against the live directory membership model.
    // const { data: projectMember } = await supabase
    //   .from("project directory membership source")
    //   .select("access")
    //   .eq("project_id", parseInt(projectId, 10))
    //   .eq("user_id", user.id)
    //   .single();

    // if (
    //   !projectMember ||
    //   !["editor", "admin", "owner"].includes(projectMember.access)
    // ) {
    //   return NextResponse.json(
    //     {
    //       error:
    //         "Forbidden: You do not have permission to create line items for this project",
    //     },
    //     { status: 403 },
    //   );
    // }

    // Verify contract exists and belongs to project
    const { data: contract } = await supabase
      .from("prime_contracts")
      .select("id")
      .eq("id", contractId)
      .eq("project_id", parseInt(projectId, 10))
      .single();

    if (!contract) {
      return NextResponse.json(
        { error: "Contract not found" },
        { status: 404 },
      );
    }

    // Create the line item (budget_code_id is a real FK column on contract_line_items)
    // NOTE: Uniqueness of (contract_id, line_number) is enforced by the DB constraint.
    // We do NOT do an app-level pre-check here because it creates a race condition
    // when multiple line items are inserted sequentially from the same request.
    const { data, error } = await supabase
      .from("contract_line_items")
      .insert(validatedData)
      .select("*")
      .single();

    if (error) {
      // Unique constraint violation on (contract_id, line_number)
      if (error.code === "23505") {
        return NextResponse.json(
          { error: `Line number ${validatedData.line_number} already exists for this contract` },
          { status: 409 },
        );
      }
      // FK violation — budget_code_id not found in project_budget_codes
      if (error.code === "23503") {
        return NextResponse.json(
          { error: "Invalid budget code: the selected code does not exist for this project" },
          { status: 400 },
        );
      }
      return NextResponse.json(
        { error: "Failed to create line item", details: error.message },
        { status: 400 },
      );
    }

    return NextResponse.json(data, { status: 201 });
    },
);
