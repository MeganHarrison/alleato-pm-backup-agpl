import { withApiGuardrails } from "@/lib/guardrails/api";
import { GuardrailError } from "@/lib/guardrails/errors";
import { createClient, getApiRouteUser } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { z, ZodError } from "zod";
import { apiErrorResponse } from "@/lib/api-error";
import { logger } from "@/lib/logger";

interface RouteParams {
  params: Promise<{ projectId: string }>;
}

const createCommitmentPcoSchema = z.object({
  commitment_id: z.string().uuid("Invalid commitment ID"),
  commitment_type: z.enum(["subcontract", "purchase_order"], {
    error: "Must be 'subcontract' or 'purchase_order'",
  }),
  title: z.string().min(1, "Title is required").max(500),
  description: z.string().max(5000).nullish(),
  schedule_impact: z.number().int().nullish(),
  due_date: z.string().nullish(),
  designated_reviewer_id: z.string().uuid().nullish(),
});

/**
 * GET /api/projects/[projectId]/commitment-pcos
 * List all commitment PCOs for a project with optional filters
 */
export const GET = withApiGuardrails(
  "projects/[projectId]/commitment-pcos#GET",
  async ({ request, params }) => {
  
    const { projectId } = await params;
    const projectIdNum = parseInt(projectId, 10);
    const supabase = await createClient();
    const { searchParams } = new URL(request.url);

    // Auth check
    const user = await getApiRouteUser();
    if (!user) {
      throw new GuardrailError({ code: "AUTH_EXPIRED", where: "projects/[projectId]/commitment-pcos#GET", message: "Authentication required." });
    }

    // Build query
    let query = supabase
      .from("commitment_pcos")
      .select("*")
      .eq("project_id", projectIdNum)
      .order("created_at", { ascending: false });

    // Optional filters
    const status = searchParams.get("status");
    if (status) {
      query = query.eq("status", status);
    }

    const commitmentId = searchParams.get("commitment_id");
    if (commitmentId) {
      query = query.eq("commitment_id", commitmentId);
    }

    const { data: pcos, error } = await query;

    if (error) {
      return apiErrorResponse(error);
    }

    // Enrich with commitment info
    const enrichedPcos = await enrichWithCommitmentInfo(supabase, pcos || []);

    // Enrich with linked change event count
    const pcoIds = (pcos || []).map((p) => p.id);
    const ceCountMap: Record<string, number> = {};
    if (pcoIds.length > 0) {
      const { data: links } = await supabase
        .from("change_event_pco_links")
        .select("pco_id")
        .in("pco_id", pcoIds)
        .eq("pco_type", "commitment");

      if (links) {
        for (const link of links) {
          ceCountMap[link.pco_id] = (ceCountMap[link.pco_id] || 0) + 1;
        }
      }
    }

    // Enrich with promoted CO number (PCCO column)
    const promotedCoIds = (pcos || [])
      .map((p) => p.promoted_to_co_id)
      .filter((id): id is string => id != null);
    const promotedCoNumberMap: Record<string, string> = {};
    if (promotedCoIds.length > 0) {
      const { data: coRows } = await supabase
        .from("contract_change_orders")
        .select("id, change_order_number")
        .in("id", promotedCoIds);
      if (coRows) {
        for (const co of coRows) {
          promotedCoNumberMap[co.id] = co.change_order_number;
        }
      }
    }

    const result = enrichedPcos.map((pco: any) => ({
      ...pco,
      linked_change_events_count: ceCountMap[pco.id] || 0,
      promoted_co_number: pco.promoted_to_co_id
        ? (promotedCoNumberMap[pco.promoted_to_co_id] ?? null)
        : null,
    }));

    return NextResponse.json(result);
    },
);

/**
 * POST /api/projects/[projectId]/commitment-pcos
 * Create a new commitment PCO
 */
export const POST = withApiGuardrails(
  "projects/[projectId]/commitment-pcos#POST",
  async ({ request, params }) => {
  
    const { projectId } = await params;
    const projectIdNum = parseInt(projectId, 10);
    const supabase = await createClient();

    // Auth check
    const user = await getApiRouteUser();
    if (!user) {
      throw new GuardrailError({ code: "AUTH_EXPIRED", where: "projects/[projectId]/commitment-pcos#POST", message: "Authentication required." });
    }

    const body = await request.json();
    const validatedData = createCommitmentPcoSchema.parse(body);

    // Auto-generate PCO number
    const { data: pcoNumber, error: rpcError } = await supabase.rpc(
      "generate_pco_number",
      {
        p_project_id: projectIdNum,
        p_type: "commitment",
      },
    );

    if (rpcError) {
      logger.error({ msg: "[commitment-pcos POST] RPC error", error: rpcError.message });
      return NextResponse.json(
        { error: "Failed to generate PCO number", details: rpcError.message },
        { status: 500 },
      );
    }

    // Create the PCO
    const { data, error } = await supabase
      .from("commitment_pcos")
      .insert({
        project_id: projectIdNum,
        commitment_id: validatedData.commitment_id,
        commitment_type: validatedData.commitment_type,
        pco_number: pcoNumber,
        title: validatedData.title,
        description: validatedData.description ?? null,
        schedule_impact: validatedData.schedule_impact ?? null,
        due_date: validatedData.due_date ?? null,
        designated_reviewer_id: validatedData.designated_reviewer_id ?? null,
        status: "draft",
        created_by: user.id,
      })
      .select("*")
      .single();

    if (error) {
      logger.error({ msg: "[commitment-pcos POST] Insert error", error: error.message });
      return apiErrorResponse(error);
    }

    return NextResponse.json(data, { status: 201 });
    },
);

/**
 * Enrich PCO rows with commitment info (subcontract or purchase_order)
 */
async function enrichWithCommitmentInfo(
  supabase: Awaited<ReturnType<typeof createClient>>,
  pcos: Array<Record<string, any>>,
) {
  if (pcos.length === 0) return pcos;

  // Group by commitment_type
  const subcontractIds = [
    ...new Set(
      pcos
        .filter((p) => p.commitment_type === "subcontract")
        .map((p) => p.commitment_id),
    ),
  ];
  const poIds = [
    ...new Set(
      pcos
        .filter((p) => p.commitment_type === "purchase_order")
        .map((p) => p.commitment_id),
    ),
  ];

  const commitmentMap: Record<
    string,
    { contract_number: string | null; title: string | null; vendor_name: string | null }
  > = {};

  if (subcontractIds.length > 0) {
    const { data: subs } = await supabase
      .from("subcontracts")
      .select("id, contract_number, title, vendor:companies!subcontracts_vendor_id_fkey(name)")
      .in("id", subcontractIds);

    for (const s of subs || []) {
      commitmentMap[s.id] = {
        contract_number: s.contract_number,
        title: s.title,
        vendor_name: (s.vendor as any)?.name || null,
      };
    }
  }

  if (poIds.length > 0) {
    const { data: pos } = await supabase
      .from("purchase_orders")
      .select("id, contract_number, title, vendor:companies!purchase_orders_vendor_id_fkey(name)")
      .in("id", poIds);

    for (const p of pos || []) {
      commitmentMap[p.id] = {
        contract_number: p.contract_number,
        title: p.title,
        vendor_name: (p.vendor as any)?.name || null,
      };
    }
  }

  return pcos.map((pco) => ({
    ...pco,
    commitment: commitmentMap[pco.commitment_id] || null,
  }));
}
