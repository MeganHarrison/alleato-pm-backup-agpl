/**
 * GET /api/projects/[projectId]/change-events/[changeEventId]/commitment-pcos
 *
 * Returns all commitment change records linked to this change event through
 * change_event_pco_links (pco_type = "commitment"). Older links may point to
 * commitment_pcos; the current Procore-parity flow links directly to
 * contract_change_orders.
 */

import { withApiGuardrails } from "@/lib/guardrails/api";
import { serviceDb } from "@/lib/supabase/service-db";
import { NextResponse } from "next/server";
import { apiErrorResponse } from "@/lib/api-error";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const GET = withApiGuardrails(
  "projects/[projectId]/change-events/[changeEventId]/commitment-pcos#GET",
  async ({ params }) => {
    const { projectId, changeEventId } = await params;
    if (!UUID_RE.test(changeEventId)) {
      return NextResponse.json({ error: "Invalid change event id" }, { status: 400 });
    }
    const projectIdNum = parseInt(projectId, 10);
    // Use service client so RLS doesn't silently filter junction table rows.

    // Step 1: Get all commitment PCO links for this change event.
    // Two-step query because change_event_pco_links.pco_id is polymorphic
    // (no typed FK), so we join manually. Same pattern as prime-pcos route.
    const { data: links, error: linksError } = await serviceDb.from("change_event_pco_links")
      .select("id, pco_id, pco_type, linked_at")
      .eq("change_event_id", changeEventId)
      .eq("pco_type", "commitment")
      .order("linked_at", { ascending: false });

    if (linksError) {
      return apiErrorResponse(linksError);
    }

    const linkedIds = (links ?? []).map((l) => l.pco_id);

    if (linkedIds.length === 0) {
      return NextResponse.json({ data: [] });
    }

    // Step 2: Fetch commitment_pcos — select only columns the UI needs.
    const { data: pcos, error: pcosError } = await serviceDb.from("commitment_pcos")
      .select(
        "id, pco_number, title, status, total_amount, schedule_impact, commitment_id, commitment_type, created_at",
      )
      .in("id", linkedIds)
      .eq("project_id", projectIdNum);

    if (pcosError) {
      return apiErrorResponse(pcosError);
    }

    // Build an O(1) lookup map and merge with link metadata.
    const pcoMap = new Map((pcos ?? []).map((pco) => [pco.id, pco]));
    const directCoIds = linkedIds.filter((id) => !pcoMap.has(id));
    const { data: directCos, error: directCosError } = directCoIds.length
      ? await serviceDb.from("contract_change_orders")
          .select(
            "id, change_order_number, title, status, amount, schedule_impact, contract_id, contract_type, created_at",
          )
          .in("id", directCoIds)
          .eq("project_id", projectIdNum)
      : { data: [], error: null };

    if (directCosError) {
      return apiErrorResponse(directCosError);
    }

    const directCoMap = new Map((directCos ?? []).map((co) => [co.id, co]));

    const result = (links ?? [])
      .map((link) => {
        const pco = pcoMap.get(link.pco_id);
        if (pco) {
          return {
            linkId: link.id,
            linkedAt: link.linked_at,
            record_type: "pco" as const,
            ...pco,
          };
        }

        const co = directCoMap.get(link.pco_id);
        if (!co) return null;
        return {
          linkId: link.id,
          linkedAt: link.linked_at,
          record_type: "change_order" as const,
          id: co.id,
          pco_number: co.change_order_number,
          title: co.title,
          status: co.status,
          total_amount: co.amount,
          schedule_impact: co.schedule_impact,
          commitment_id: co.contract_id,
          commitment_type: co.contract_type,
          created_at: co.created_at,
        };
      })
      .filter(Boolean);

    return NextResponse.json({ data: result });
  },
);
