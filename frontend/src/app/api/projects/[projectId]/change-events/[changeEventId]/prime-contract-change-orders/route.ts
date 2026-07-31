import { withApiGuardrails } from "@/lib/guardrails/api";
import { GuardrailError } from "@/lib/guardrails/errors";
import { NextResponse } from "next/server";

import { createClient, getApiRouteUser } from "@/lib/supabase/server";
import { apiErrorResponse } from "@/lib/api-error";

interface RouteParams {
  params: Promise<{ projectId: string; changeEventId: string }>;
}

export const GET = withApiGuardrails(
  "projects/[projectId]/change-events/[changeEventId]/prime-contract-change-orders#GET",
  async ({ params }) => {
  
    const { projectId, changeEventId } = await params;
    const parsedProjectId = Number.parseInt(projectId, 10);

    if (Number.isNaN(parsedProjectId)) {
      return NextResponse.json({ error: "Invalid project id" }, { status: 400 });
    }

    const supabase = await createClient();
    const user = await getApiRouteUser();
    if (!user) {
      throw new GuardrailError({
        code: "AUTH_EXPIRED",
        where: "projects/[projectId]/change-events/[changeEventId]/prime-contract-change-orders#GET",
        message: "Authentication required.",
      });
    }

    // Fetch PCOs linked to this change event via change_event_related_items
    // where related_type = 'prime_contract_change_order'
    const { data: relatedItems, error: relatedError } = await supabase
      .from("change_event_related_items")
      .select("id, related_id, related_number, related_title, related_status, created_at")
      .eq("project_id", parsedProjectId)
      .eq("change_event_id", changeEventId)
      .eq("related_type", "prime_contract_change_order");

    if (relatedError) {
      if (
        relatedError.code === "42P01" ||
        relatedError.message?.includes("Could not find") ||
        relatedError.message?.includes("schema cache")
      ) {
        return NextResponse.json({ data: [] });
      }

      return NextResponse.json(
        { error: "Failed to fetch linked PCOs", details: relatedError.message },
        { status: 400 },
      );
    }

    if (!relatedItems || relatedItems.length === 0) {
      return NextResponse.json({ data: [] });
    }

    // Fetch fresh details for each linked PCCO from prime_contract_change_orders
    const pccoIds = relatedItems
      .map((item) => Number.parseInt(item.related_id, 10))
      .filter((id) => !Number.isNaN(id));

    if (pccoIds.length === 0) {
      return NextResponse.json({ data: [] });
    }

    const { data: pccos, error: pccoError } = await supabase
      .from("prime_contract_change_orders")
      .select(
        "id, pcco_number, title, status, total_amount, created_at, prime_contract_id, contract_id",
      )
      .in("id", pccoIds)
      .eq("project_id", parsedProjectId);

    if (pccoError) {
      // Graceful fallback: return data from related_items without live PCO details
      const fallback = relatedItems.map((item) => ({
        id: item.related_id,
        pcco_number: item.related_number ?? null,
        title: item.related_title,
        status: item.related_status ?? null,
        total_amount: null,
        created_at: item.created_at,
        contract: null,
        linked_at: item.created_at,
      }));

      return NextResponse.json({ data: fallback });
    }

    // Fetch contract details for linked PCOs
    const contractIds = [
      ...new Set(
        (pccos ?? [])
          .map((p) => p.prime_contract_id ?? p.contract_id)
          .filter((id): id is string => Boolean(id)),
      ),
    ];

    const contractMap: Record<string, { id: string; number: string | null; title: string }> = {};

    if (contractIds.length > 0) {
      const { data: contracts } = await supabase
        .from("prime_contracts")
        .select("id, contract_number, title")
        .in("id", contractIds);

      for (const contract of contracts ?? []) {
        contractMap[contract.id] = {
          id: contract.id,
          number: contract.contract_number,
          title: contract.title,
        };
      }
    }

    // Build a lookup from related_items to get linked_at timestamp
    const linkedAtMap: Record<string, string> = {};
    for (const item of relatedItems) {
      linkedAtMap[item.related_id] = item.created_at;
    }

    const response = (pccos ?? []).map((pcco) => {
      const contractId = pcco.prime_contract_id ?? pcco.contract_id;
      return {
        id: String(pcco.id),
        pcco_number: pcco.pcco_number,
        title: pcco.title,
        status: pcco.status,
        total_amount: pcco.total_amount,
        created_at: pcco.created_at,
        linked_at: linkedAtMap[String(pcco.id)] ?? pcco.created_at,
        contract: contractId ? (contractMap[contractId] ?? null) : null,
      };
    });

    return NextResponse.json({ data: response });
    },
);
