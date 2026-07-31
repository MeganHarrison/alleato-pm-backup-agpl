import { withApiGuardrails } from "@/lib/guardrails/api";
import { GuardrailError } from "@/lib/guardrails/errors";
import { NextResponse } from "next/server";

import { apiErrorResponse } from "@/lib/api-error";
import { createClient, getApiRouteUser } from "@/lib/supabase/server";

interface RouteParams {
  params: Promise<{ projectId: string; changeEventId: string }>;
}

export const GET = withApiGuardrails(
  "projects/[projectId]/change-events/[changeEventId]/lineage#GET",
  async ({ request, params }) => {
  
    const { projectId, changeEventId } = await params;
    const projectIdNum = Number.parseInt(projectId, 10);

    if (Number.isNaN(projectIdNum) || projectIdNum <= 0) {
      return NextResponse.json({ error: "Invalid project ID" }, { status: 400 });
    }

    const supabase = await createClient();
    const user = await getApiRouteUser();
    if (!user) {
      throw new GuardrailError({ code: "AUTH_EXPIRED", where: "projects/[projectId]/change-events/[changeEventId]/lineage#GET", message: "Authentication required." });
    }

    const { data: links, error: linksError } = await supabase
      .from("change_event_pco_links")
      .select("pco_id, pco_type, linked_at")
      .eq("change_event_id", changeEventId);

    if (linksError) return apiErrorResponse(linksError);
    if (!links || links.length === 0) {
      return NextResponse.json({ data: [], summary: { count: 0 } });
    }

    const primePcoIds = links
      .filter((link) => link.pco_type === "prime")
      .map((link) => link.pco_id);
    const commitmentPcoIds = links
      .filter((link) => link.pco_type === "commitment")
      .map((link) => link.pco_id);

    const linkedAtMap = new Map<string, string | null>();
    for (const link of links) {
      linkedAtMap.set(`${link.pco_type}:${link.pco_id}`, link.linked_at);
    }

    const { data: primePcos, error: primePcosError } = primePcoIds.length
      ? await supabase
          .from("prime_contract_pcos")
          .select("id, pco_number, title, status, total_amount, promoted_to_co_id, prime_contract_id")
          .in("id", primePcoIds)
          .eq("project_id", projectIdNum)
      : { data: [], error: null };
    if (primePcosError) return apiErrorResponse(primePcosError);

    const { data: commitmentPcos, error: commitmentPcosError } = commitmentPcoIds.length
      ? await supabase
          .from("commitment_pcos")
          .select("id, pco_number, title, status, total_amount, promoted_to_co_id, commitment_id, commitment_type")
          .in("id", commitmentPcoIds)
          .eq("project_id", projectIdNum)
      : { data: [], error: null };
    if (commitmentPcosError) return apiErrorResponse(commitmentPcosError);

    const promotedPrimeCoIds = (primePcos ?? [])
      .map((pco) => pco.promoted_to_co_id)
      .filter((id): id is number => typeof id === "number");
    const promotedCommitmentCoIds = (commitmentPcos ?? [])
      .map((pco) => pco.promoted_to_co_id)
      .filter((id): id is string => typeof id === "string");

    const { data: primeCos, error: primeCosError } = promotedPrimeCoIds.length
      ? await supabase
          .from("prime_contract_change_orders")
          .select("id, pcco_number, title, status, total_amount")
          .in("id", promotedPrimeCoIds)
      : { data: [], error: null };
    if (primeCosError) return apiErrorResponse(primeCosError);

    const directCommitmentCoIds = commitmentPcoIds.filter(
      (id) => !(commitmentPcos ?? []).some((pco) => pco.id === id),
    );
    const commitmentCoIds = [
      ...new Set([...promotedCommitmentCoIds, ...directCommitmentCoIds]),
    ];

    const { data: commitmentCos, error: commitmentCosError } = commitmentCoIds.length
      ? await supabase
          .from("contract_change_orders")
          .select("id, change_order_number, title, status, amount")
          .in("id", commitmentCoIds)
          .eq("project_id", projectIdNum)
      : { data: [], error: null };
    if (commitmentCosError) return apiErrorResponse(commitmentCosError);

    const primeCoMap = new Map(
      (primeCos ?? []).map((co) => [co.id, co]),
    );
    const commitmentCoMap = new Map(
      (commitmentCos ?? []).map((co) => [co.id, co]),
    );

    const rows = [
      ...(primePcos ?? []).map((pco) => {
        const promotedCo = pco.promoted_to_co_id
          ? primeCoMap.get(pco.promoted_to_co_id) ?? null
          : null;
        return {
          pco_type: "prime" as const,
          pco: {
            id: pco.id,
            number: pco.pco_number,
            title: pco.title,
            status: pco.status,
            total_amount: pco.total_amount,
          },
          resulting_co: promotedCo
            ? {
                id: promotedCo.id,
                number: promotedCo.pcco_number,
                title: promotedCo.title,
                status: promotedCo.status,
                total_amount: promotedCo.total_amount,
              }
            : null,
          linked_at: linkedAtMap.get(`prime:${pco.id}`) ?? null,
        };
      }),
      ...(commitmentPcos ?? []).map((pco) => {
        const promotedCo = pco.promoted_to_co_id
          ? commitmentCoMap.get(pco.promoted_to_co_id) ?? null
          : null;
        return {
          pco_type: "commitment" as const,
          pco: {
            id: pco.id,
            number: pco.pco_number,
            title: pco.title,
            status: pco.status,
            total_amount: pco.total_amount,
          },
          resulting_co: promotedCo
            ? {
                id: promotedCo.id,
                number: promotedCo.change_order_number,
                title: promotedCo.title,
                status: promotedCo.status,
                total_amount: promotedCo.amount,
              }
            : null,
          linked_at: linkedAtMap.get(`commitment:${pco.id}`) ?? null,
        };
      }),
      ...directCommitmentCoIds.flatMap((coId) => {
        const co = commitmentCoMap.get(coId);
        if (!co) return [];

        return [{
          pco_type: "commitment" as const,
          pco: {
            id: co.id,
            number: co.change_order_number,
            title: co.title,
            status: co.status,
            total_amount: co.amount,
            record_type: "change_order" as const,
          },
          resulting_co: {
            id: co.id,
            number: co.change_order_number,
            title: co.title,
            status: co.status,
            total_amount: co.amount,
          },
          linked_at: linkedAtMap.get(`commitment:${co.id}`) ?? null,
        }];
      }),
    ];

    rows.sort((a, b) => {
      const aDate = a.linked_at ? new Date(a.linked_at).getTime() : 0;
      const bDate = b.linked_at ? new Date(b.linked_at).getTime() : 0;
      return bDate - aDate;
    });

    return NextResponse.json({
      data: rows,
      summary: {
        count: rows.length,
        prime_count: rows.filter((row) => row.pco_type === "prime").length,
        commitment_count: rows.filter((row) => row.pco_type === "commitment").length,
      },
    });
    },
);
