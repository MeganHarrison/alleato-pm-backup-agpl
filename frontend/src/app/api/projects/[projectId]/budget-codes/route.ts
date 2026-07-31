import { withApiGuardrails } from "@/lib/guardrails/api";
import { GuardrailError } from "@/lib/guardrails/errors";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import { createClient, getApiRouteUser } from "@/lib/supabase/server";
import { apiErrorResponse } from "@/lib/api-error";

type BudgetCodeResponse = {
  budgetCodes: Array<{
    id: string;
    code: string;
    costCodeId: string | null;
    description: string;
    costType: string | null;
    costTypeId: string | null;
    fullLabel: string;
    divisionId: string | null;
    divisionTitle: string | null;
  }>;
};

type CostCodeJoin = {
  title: string | null;
  division_id: string | null;
  division_title: string | null;
};

type CostCodeTypeJoin = {
  id: string | null;
  code: string | null;
  description: string | null;
};

type ProjectBudgetCodeRow = {
  id: string;
  cost_code_id: string;
  cost_type_id: string | null;
  cost_codes: CostCodeJoin | CostCodeJoin[] | null;
  cost_code_types: CostCodeTypeJoin | CostCodeTypeJoin[] | null;
};

const formatBudgetCode = (options: {
  code: string;
  description?: string | null;
  costType?: string | null;
  costTypeDescription?: string | null;
}) => {
  const { code, description, costType, costTypeDescription } = options;
  const costTypeSuffix = costType ? `.${costType}` : "";
  const typeDescription = costTypeDescription
    ? ` – ${costTypeDescription}`
    : "";
  const safeDescription = description || "No description available";

  return `${code}${costTypeSuffix} – ${safeDescription}${typeDescription}`;
};

export const GET = withApiGuardrails<{ projectId: string }>(
  "projects/[projectId]/budget-codes#GET",
  async ({ request, params }) => {
  
    const { projectId } = await params;
    const projectIdNum = Number.parseInt(projectId, 10);

    if (Number.isNaN(projectIdNum)) {
      return NextResponse.json(
        { error: "Invalid project ID" },
        { status: 400 },
      );
    }

    const supabase = await createClient();
    const user = await getApiRouteUser();

    if (!user) {
      throw new GuardrailError({
        code: "AUTH_EXPIRED",
        where: "projects/[projectId]/budget-codes#GET",
        message: "Authentication required.",
      });
    }

    // Fetch project_budget_codes for this project (the chart of accounts).
    // Supabase/PostgREST caps a single response at ~1000 rows, and a mature
    // project's chart can exceed that (e.g. 2000+ codes). A single un-paged
    // query silently truncates, dropping codes that sort late (e.g. "55-0500")
    // out of the dropdown entirely. Page through with .range() until drained so
    // every active code is returned. The secondary order by id keeps paging
    // stable when many rows share a cost_code_id (one per cost type).
    const PAGE_SIZE = 1000;
    let projectBudgetCodesData: unknown[] = [];
    let projectBudgetCodesError: { message: string } | null = null;
    for (let from = 0; ; from += PAGE_SIZE) {
      const { data: page, error: pageError } = await supabase
        .from("project_budget_codes")
        .select(
          `
          id,
          cost_code_id,
          cost_type_id,
          cost_codes ( title, division_id, division_title ),
          cost_code_types ( id, code, description )
        `,
        )
        .eq("project_id", projectIdNum)
        .eq("is_active", true)
        .order("cost_code_id", { ascending: true })
        .order("id", { ascending: true })
        .range(from, from + PAGE_SIZE - 1);

      if (pageError) {
        projectBudgetCodesError = pageError;
        break;
      }

      projectBudgetCodesData = projectBudgetCodesData.concat(page ?? []);
      if (!page || page.length < PAGE_SIZE) break;
    }

    if (projectBudgetCodesError) {
      return NextResponse.json(
        {
          error: "Failed to load budget codes",
          details: projectBudgetCodesError.message,
        },
        { status: 500 },
      );
    }

    // project_budget_codes.cost_code_id is the canonical cost_codes.id.

    const budgetCodes: BudgetCodeResponse["budgetCodes"] = (
      projectBudgetCodesData || []
    ).map((item: unknown) => {
      const row = item as ProjectBudgetCodeRow;
      const costCodeTypeData = Array.isArray(row.cost_code_types)
        ? row.cost_code_types[0]
        : row.cost_code_types;
      const costType = costCodeTypeData?.code || null;
      const costTypeDescription = costCodeTypeData?.description || null;
      const costTypeId = row.cost_type_id || null;
      const costCodeData = Array.isArray(row.cost_codes)
        ? row.cost_codes[0]
        : row.cost_codes;
      const costCodeTitle = costCodeData?.title;
      const description = costCodeTitle || "";
      const divisionId = costCodeData?.division_id || null;
      const divisionTitle = costCodeData?.division_title || null;

      return {
        id: row.id,
        code: row.cost_code_id,
        costCodeId: row.cost_code_id,
        description,
        costType,
        costTypeId,
        fullLabel: formatBudgetCode({
          code: row.cost_code_id,
          description,
          costType,
          costTypeDescription,
        }),
        divisionId,
        divisionTitle,
      };
    });

    // Deduplicate by cost_code_id + costType (keep first occurrence).
    // Codes without a costTypeId cannot be linked to budget_lines
    // (budget_lines.cost_type_id NOT NULL) so filter them out of dropdowns.
    const seen = new Set<string>();
    const uniqueBudgetCodes = budgetCodes.filter((bc) => {
      if (!bc.costTypeId) return false;
      const key = `${bc.code}|${bc.costTypeId}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    return NextResponse.json({ budgetCodes: uniqueBudgetCodes });
    },
);

export const POST = withApiGuardrails<{ projectId: string }>(
  "projects/[projectId]/budget-codes#POST",
  async ({ request, params }) => {
  
    const { projectId } = await params;
    const projectIdNum = Number.parseInt(projectId, 10);

    if (Number.isNaN(projectIdNum)) {
      return NextResponse.json(
        { error: "Invalid project ID" },
        { status: 400 },
      );
    }

    const body = await request.json();
    const { cost_code_id, cost_type_id, description } = body;

    if (!cost_code_id) {
      return NextResponse.json(
        { error: "cost_code_id is required" },
        { status: 400 },
      );
    }

    if (!cost_type_id) {
      return NextResponse.json(
        { error: "cost_type_id is required" },
        { status: 400 },
      );
    }

    const supabase = await createClient();

    // Get the current user
    const user = await getApiRouteUser();

    if (!user) {
      throw new GuardrailError({ code: "AUTH_EXPIRED", where: "projects/[projectId]/budget-codes#POST", message: "Authentication required." });
    }

    // Resolve cost_type_id to UUID
    let costTypeUuid = cost_type_id;

    // If cost_type_id is a string like 'R', 'L', etc., look it up
    if (
      typeof cost_type_id === "string" &&
      !cost_type_id.match(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
      )
    ) {
      const { data: costTypeData } = await supabase
        .from("cost_code_types")
        .select("id")
        .ilike("code", cost_type_id)
        .single();

      if (costTypeData) {
        costTypeUuid = costTypeData.id;
      }
    }

    // Check for existing duplicate before inserting
    const { data: existingCode } = await supabase
      .from("project_budget_codes")
      .select("id")
      .eq("project_id", projectIdNum)
      .eq("cost_code_id", cost_code_id)
      .eq("cost_type_id", costTypeUuid)
      .maybeSingle();

    if (existingCode) {
      return NextResponse.json(
        { error: "This budget code already exists for this project" },
        { status: 409 },
      );
    }

    // Resolve description from cost_codes.title
    const { data: costCodeMeta } = await supabase
      .from("cost_codes")
      .select("title")
      .eq("id", cost_code_id)
      .maybeSingle();
    const resolvedDescription = costCodeMeta?.title || cost_code_id;

    // Insert new project_budget_code (the chart of accounts entry)
    const { data: newProjectBudgetCode, error: insertError } = await supabase
      .from("project_budget_codes")
      .insert({
        project_id: projectIdNum,
        cost_code_id,
        cost_type_id: costTypeUuid,
        description: description || resolvedDescription,
        is_active: true,
      })
      .select(
        `
          id,
          cost_code_id,
          cost_type_id,
          cost_codes ( title, division_id, division_title ),
          cost_code_types ( code, description )
        `,
      )
      .single();

    if (insertError) {
      // Check if it's a unique constraint violation
      if (insertError.code === "23505") {
        return NextResponse.json(
          { error: "This budget code already exists for this project" },
          { status: 409 },
        );
      }

      return NextResponse.json(
        { error: "Failed to create budget code", details: insertError.message },
        { status: 500 },
      );
    }

    // Transform response to match frontend format
    const typedBudgetCode =
      newProjectBudgetCode as unknown as ProjectBudgetCodeRow;
    const costCodeTypeData = Array.isArray(typedBudgetCode.cost_code_types)
      ? typedBudgetCode.cost_code_types[0]
      : typedBudgetCode.cost_code_types;
    const costType = costCodeTypeData?.code || null;
    const costTypeDescription = costCodeTypeData?.description || null;
    const costCodeData = Array.isArray(typedBudgetCode.cost_codes)
      ? typedBudgetCode.cost_codes[0]
      : typedBudgetCode.cost_codes;
    const costCodeTitle = costCodeData?.title;
    const finalDescription = costCodeTitle || "";
    const divisionId = costCodeData?.division_id || null;
    const divisionTitle = costCodeData?.division_title || null;

    const budgetCode = {
      id: newProjectBudgetCode.id,
      code: newProjectBudgetCode.cost_code_id,
      costCodeId: newProjectBudgetCode.cost_code_id,
      description: finalDescription,
      costType,
      costTypeId: newProjectBudgetCode.cost_type_id,
      fullLabel: formatBudgetCode({
        code: newProjectBudgetCode.cost_code_id,
        description: finalDescription,
        costType,
        costTypeDescription,
      }),
      divisionId,
      divisionTitle,
    };

    return NextResponse.json({ budgetCode });
    },
);
