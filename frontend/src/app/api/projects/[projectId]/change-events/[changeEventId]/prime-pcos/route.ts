/**
 * GET /api/projects/[projectId]/change-events/[changeEventId]/prime-pcos
 *
 * Returns all prime contract PCOs that this change event has been added to,
 * via the change_event_pco_links junction table.
 */

import { withApiGuardrails } from "@/lib/guardrails/api";
import { serviceDb } from "@/lib/supabase/service-db";
import { NextResponse } from "next/server";
import { apiErrorResponse } from "@/lib/api-error";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const GET = withApiGuardrails(
  "projects/[projectId]/change-events/[changeEventId]/prime-pcos#GET",
  async ({ params }) => {
    const { projectId, changeEventId } = await params;
    if (!UUID_RE.test(changeEventId)) {
      return NextResponse.json({ error: "Invalid change event id" }, { status: 400 });
    }
    const projectIdNum = parseInt(projectId, 10);
    // Use service client so RLS doesn't silently filter junction table rows.
    // This is a read-only endpoint scoped tightly by changeEventId + pco_type.

    // Step 1: Get all prime PCO links for this change event.
    // Two-step query because change_event_pco_links.pco_id is a polymorphic
    // UUID (no typed FK to prime_contract_pcos), so we can't use a single
    // Supabase join. This is intentional: two focused queries beat one
    // unindexed cross-join.
    const { data: links, error: linksError } = await serviceDb.from("change_event_pco_links")
      .select("id, pco_id, pco_type, linked_at")
      .eq("change_event_id", changeEventId)
      .eq("pco_type", "prime")
      .order("linked_at", { ascending: false });

    if (linksError) {
      return apiErrorResponse(linksError);
    }

    const pcoIds = (links ?? []).map((l) => l.pco_id);

    if (pcoIds.length === 0) {
      return NextResponse.json({ data: [] });
    }

    // Step 2: Fetch prime_contract_pcos with their prime contract details.
    // Select only the columns the UI needs — avoids over-fetching.
    // Service client is intentional here too (same client, same RLS bypass).
    const { data: pcos, error: pcosError } = await serviceDb.from("prime_contract_pcos")
      .select(
        `
        id,
        pco_number,
        title,
        status,
        total_amount,
        schedule_impact,
        created_at,
        prime_contract_id,
        prime_contracts!prime_contract_pcos_prime_contract_id_fkey(
          id,
          contract_number,
          title,
          status
        )
      `,
      )
      .in("id", pcoIds)
      .eq("project_id", projectIdNum);

    if (pcosError) {
      return apiErrorResponse(pcosError);
    }

    // Build an O(1) lookup map and merge with link metadata.
    const pcoMap = new Map((pcos ?? []).map((pco) => [pco.id, pco]));

    const result = (links ?? [])
      .map((link) => {
        const pco = pcoMap.get(link.pco_id);
        if (!pco) return null;
        return {
          linkId: link.id,
          linkedAt: link.linked_at,
          ...pco,
        };
      })
      .filter(Boolean);

    return NextResponse.json({ data: result });
  },
);
