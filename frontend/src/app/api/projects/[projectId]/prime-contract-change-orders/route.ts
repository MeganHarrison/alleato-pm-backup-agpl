import { withApiGuardrails } from "@/lib/guardrails/api";
import { GuardrailError } from "@/lib/guardrails/errors";
import { NextResponse } from "next/server";
import { z } from "zod";

import { createClient, getApiRouteUser } from "@/lib/supabase/server";
import { apiErrorResponse } from "@/lib/api-error";
import { requirePermission } from "@/lib/permissions-guard";

interface RouteParams {
  params: Promise<{ projectId: string }>;
}

// --- API-007: Zod validation schema for PCCO creation ---
const createPccoSchema = z.object({
  title: z.string().min(1, "Title is required"),
  contract_id: z.string().nullish(),
  prime_contract_id: z.string().nullish(),
  status: z.string().optional(),
  total_amount: z.number().optional(),
  executed: z.boolean().optional(),
  description: z.string().nullish(),
  change_reason: z.string().nullish(),
  designated_reviewer: z.string().nullish(),
  review_date: z.string().nullish(),
  reviewed_by: z.string().nullish(),
  request_received_from: z.string().nullish(),
  due_date: z.string().nullish(),
  invoiced_date: z.string().nullish(),
  paid_date: z.string().nullish(),
  schedule_impact: z.number().nullish(),
  revised_substantial_completion_date: z.string().nullish(),
  location: z.string().nullish(),
  reference: z.string().nullish(),
  field_change: z.boolean().optional(),
  is_private: z.boolean().optional(),
  paid_in_full: z.boolean().optional(),
  contract_company: z.string().nullish(),
});

/**
 * GET /api/projects/[projectId]/prime-contract-change-orders
 * List all PCCOs for a project with joins, pagination, and filters (API-006)
 */
export const GET = withApiGuardrails(
  "projects/[projectId]/prime-contract-change-orders#GET",
  async ({ request, params }) => {
  
    const { projectId } = await params;
    const supabase = await createClient();
    const user = await getApiRouteUser();

    if (!user) {
      throw new GuardrailError({
        code: "AUTH_EXPIRED",
        where: "projects/[projectId]/prime-contract-change-orders#GET",
        message: "Authentication required.",
      });
    }
    const url = request.nextUrl;

    // --- Parse query params ---
    const status = url.searchParams.get("status");
    const search = url.searchParams.get("search");
    const page = Math.max(1, Number(url.searchParams.get("page") || "1"));
    const perPage = Math.min(
      100,
      Math.max(1, Number(url.searchParams.get("per_page") || "50"))
    );

    // --- Build query with join to prime_contracts ---
    let query = supabase
      .from("prime_contract_change_orders")
      .select(
        "*, prime_contracts:prime_contract_id(id, contract_number, title)",
        { count: "exact" }
      )
      .eq("project_id", Number(projectId));

    // --- Filters ---
    if (status) {
      query = query.eq("status", status);
    }
    if (search) {
      query = query.or(
        `title.ilike.%${search}%,pcco_number.ilike.%${search}%,description.ilike.%${search}%`
      );
    }

    // --- Pagination ---
    const from = (page - 1) * perPage;
    const to = from + perPage - 1;
    query = query.range(from, to);

    // --- Ordering ---
    query = query.order("created_at", { ascending: false });

    const { data, error, count } = await query;

    if (error) {
      return apiErrorResponse(error);
    }

    return NextResponse.json({
      data: data ?? [],
      pagination: {
        page,
        per_page: perPage,
        total: count ?? 0,
        total_pages: Math.ceil((count ?? 0) / perPage),
      },
    });
    },
);

/**
 * POST /api/projects/[projectId]/prime-contract-change-orders
 * Create a new PCCO with Zod validation and auto-generated number (API-007)
 */
export const POST = withApiGuardrails(
  "projects/[projectId]/prime-contract-change-orders#POST",
  async ({ request, params }) => {
  
    const { projectId } = await params;

    const guard = await requirePermission(Number(projectId), "change_orders", "write");
    if (guard.denied) return guard.response;

    const supabase = await createClient();

    const user = await getApiRouteUser();

    if (!user) {
      throw new GuardrailError({ code: "AUTH_EXPIRED", where: "projects/[projectId]/prime-contract-change-orders#POST", message: "Authentication required." });
    }

    // --- Validate request body ---
    const rawBody = await request.json();
    const parsed = createPccoSchema.safeParse(rawBody);

    if (!parsed.success) {
      const firstIssue = parsed.error.issues[0];
      return NextResponse.json(
        {
          error: firstIssue?.message ?? "Validation failed",
          details: parsed.error.issues,
        },
        { status: 400 }
      );
    }

    const body = parsed.data;

    // --- Auto-generate PCCO number (API-007: never client-supplied) ---
    const { data: lastPcco } = await supabase
      .from("prime_contract_change_orders")
      .select("pcco_number")
      .eq("project_id", Number(projectId))
      .not("pcco_number", "is", null)
      .order("id", { ascending: false })
      .limit(10);

    let nextNumber = 1;
    if (lastPcco && lastPcco.length > 0) {
      // Find the highest numeric pcco_number
      for (const row of lastPcco) {
        const num = parseInt(String(row.pcco_number), 10);
        if (!isNaN(num) && num >= nextNumber) {
          nextNumber = num + 1;
        }
      }
    }

    const pccoNumber = String(nextNumber).padStart(3, "0");

    const { data, error } = await supabase
      .from("prime_contract_change_orders")
      .insert({
        pcco_number: pccoNumber,
        title: body.title,
        status: body.status || "proposed",
        total_amount: body.total_amount ?? 0,
        contract_id: body.contract_id ?? null,
        prime_contract_id: body.prime_contract_id ?? null,
        executed: body.executed ?? false,
        project_id: Number(projectId),
        description: body.description ?? null,
        change_reason: body.change_reason ?? null,
        designated_reviewer: body.designated_reviewer ?? null,
        review_date: body.review_date ?? null,
        reviewed_by: body.reviewed_by ?? null,
        request_received_from: body.request_received_from ?? null,
        due_date: body.due_date ?? null,
        invoiced_date: body.invoiced_date ?? null,
        paid_date: body.paid_date ?? null,
        schedule_impact: body.schedule_impact ?? null,
        revised_substantial_completion_date:
          body.revised_substantial_completion_date ?? null,
        location: body.location ?? null,
        reference: body.reference ?? null,
        field_change: body.field_change ?? false,
        is_private: body.is_private ?? false,
        paid_in_full: body.paid_in_full ?? false,
        contract_company: body.contract_company ?? null,
        created_by: user.id,
      })
      .select("*")
      .single();

    if (error) {
      return apiErrorResponse(error);
    }

    return NextResponse.json(data, { status: 201 });
    },
);
