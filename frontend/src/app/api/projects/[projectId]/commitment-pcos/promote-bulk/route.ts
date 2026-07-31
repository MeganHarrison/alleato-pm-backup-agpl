import { withApiGuardrails } from "@/lib/guardrails/api";
import { GuardrailError } from "@/lib/guardrails/errors";
import { NextResponse } from "next/server";
import { z } from "zod";

import { apiErrorResponse } from "@/lib/api-error";
import { createClient, getApiRouteUser } from "@/lib/supabase/server";

interface RouteParams {
  params: Promise<{ projectId: string }>;
}

const requestSchema = z.object({
  pco_ids: z.array(z.string().uuid()).min(1),
  title: z.string().min(1).max(255).optional(),
  description: z.string().max(5000).optional(),
});

export const POST = withApiGuardrails(
  "projects/[projectId]/commitment-pcos/promote-bulk#POST",
  async ({ request, params }) => {
  
    const { projectId: projectIdParam } = await params;
    const projectId = Number.parseInt(projectIdParam, 10);
    if (Number.isNaN(projectId) || projectId <= 0) {
      return NextResponse.json({ error: "Invalid project ID" }, { status: 400 });
    }

    const supabase = await createClient();
    const user = await getApiRouteUser();
    if (!user) {
      throw new GuardrailError({ code: "AUTH_EXPIRED", where: "projects/[projectId]/commitment-pcos/promote-bulk#POST", message: "Authentication required." });
    }

    const body = requestSchema.parse(await request.json());
    const pcoIds = [...new Set(body.pco_ids)];

    const { data: pcos, error: fetchError } = await supabase
      .from("commitment_pcos")
      .select("*")
      .eq("project_id", projectId)
      .in("id", pcoIds);

    if (fetchError) return apiErrorResponse(fetchError);
    if (!pcos || pcos.length !== pcoIds.length) {
      return NextResponse.json(
        { error: "One or more selected commitment PCOs were not found in this project" },
        { status: 404 },
      );
    }

    const invalidStatus = pcos.find(
      (pco) => pco.status !== "pending" && pco.status !== "approved",
    );
    if (invalidStatus) {
      return NextResponse.json(
        {
          error: "Cannot promote selected PCOs",
          details: `PCO ${invalidStatus.pco_number} is in ${invalidStatus.status} status`,
        },
        { status: 409 },
      );
    }

    const alreadyPromoted = pcos.find((pco) => pco.promoted_to_co_id);
    if (alreadyPromoted) {
      return NextResponse.json(
        {
          error: "Cannot promote selected PCOs",
          details: `PCO ${alreadyPromoted.pco_number} is already promoted`,
        },
        { status: 409 },
      );
    }

    const { data: linkedRows, error: linkedRowsError } = await supabase
      .from("change_event_pco_links")
      .select("pco_id")
      .in("pco_id", pcoIds)
      .eq("pco_type", "commitment");

    if (linkedRowsError) return apiErrorResponse(linkedRowsError);

    const linkedPcoIds = new Set((linkedRows || []).map((row) => row.pco_id));
    const unlinkedPco = pcos.find((pco) => !linkedPcoIds.has(pco.id));
    if (unlinkedPco) {
      return NextResponse.json(
        {
          error: "Cannot promote selected PCOs",
          details: `PCO ${unlinkedPco.pco_number} is not linked to a change event`,
        },
        { status: 409 },
      );
    }

    const commitmentIds = [...new Set(pcos.map((pco) => pco.commitment_id))];
    const commitmentTypes = [...new Set(pcos.map((pco) => pco.commitment_type))];
    if (commitmentIds.length !== 1 || commitmentTypes.length !== 1) {
      return NextResponse.json(
        {
          error: "Selected PCOs must belong to the same commitment and type",
        },
        { status: 409 },
      );
    }

    const commitmentId = commitmentIds[0];
    const commitmentType = commitmentTypes[0];
    const now = new Date().toISOString();

    const { count } = await supabase
      .from("contract_change_orders")
      .select("id", { count: "exact", head: true })
      .eq("contract_id", commitmentId);

    const coNumber = `CCO-${String((count || 0) + 1).padStart(3, "0")}`;
    const defaultTitle = `Grouped CCO from ${pcos.length} PCO${pcos.length === 1 ? "" : "s"}`;
    const defaultDescription = pcos
      .map((pco) => `${pco.pco_number}: ${pco.title}`)
      .join("\n");
    const totalAmount = pcos.reduce((sum, pco) => sum + (pco.total_amount || 0), 0);
    const maxScheduleImpact = pcos.reduce((maxValue, pco) => {
      const impact = pco.schedule_impact ?? 0;
      return impact > maxValue ? impact : maxValue;
    }, 0);

    const { data: newCo, error: coError } = await supabase
      .from("contract_change_orders")
      .insert({
        contract_id: commitmentId,
        contract_type: commitmentType,
        change_order_number: coNumber,
        title: body.title || defaultTitle,
        description: body.description || defaultDescription,
        amount: totalAmount,
        status: "draft",
        schedule_impact: maxScheduleImpact || null,
        requested_date: now,
        created_by: user.id,
        updated_at: now,
      })
      .select("*")
      .single();

    if (coError || !newCo) {
      return apiErrorResponse(coError);
    }

    const { error: updateError } = await supabase
      .from("commitment_pcos")
      .update({
        promoted_to_co_id: newCo.id,
        promoted_at: now,
        status: "approved",
        approved_at: now,
        approved_by: user.id,
        updated_at: now,
        updated_by: user.id,
      })
      .eq("project_id", projectId)
      .in("id", pcoIds);

    if (updateError) {
      await supabase.from("contract_change_orders").delete().eq("id", newCo.id);
      return apiErrorResponse(updateError);
    }

    return NextResponse.json(
      {
        change_order_id: newCo.id,
        change_order_number: newCo.change_order_number,
        promoted_count: pcos.length,
        message: `Promoted ${pcos.length} PCO${pcos.length === 1 ? "" : "s"} to CCO #${newCo.change_order_number}`,
      },
      { status: 201 },
    );
    },
);
