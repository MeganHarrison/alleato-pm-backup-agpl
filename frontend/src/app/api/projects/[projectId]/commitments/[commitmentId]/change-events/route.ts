import { NextResponse } from "next/server";
import { withApiGuardrails } from "@/lib/guardrails/api";
import { GuardrailError } from "@/lib/guardrails/errors";
import { createClient, getApiRouteUser } from "@/lib/supabase/server";
import { apiErrorResponse } from "@/lib/api-error";

/**
 * GET /api/projects/[projectId]/commitments/[commitmentId]/change-events
 *
 * Returns change events linked to a specific commitment through any of:
 *   1. change_event_line_items.commitment_id (line item directly references commitment)
 *   2. change_event_pco_links → commitment_pcos (linked via commitment PCO)
 *   3. change_event_pco_links → contract_change_orders (linked via commitment CO)
 *
 * Source 1 matches Procore behavior: selecting a commitment on a CE line item
 * is sufficient linkage — no PCO creation required.
 */
export const GET = withApiGuardrails(
  "projects/[projectId]/commitments/[commitmentId]/change-events#GET",
  async ({ params }) => {
    const { projectId, commitmentId } = await params;
    const supabase = await createClient();
    const user = await getApiRouteUser();

    if (!user) {
      throw new GuardrailError({
        code: "AUTH_EXPIRED",
        where: "projects/[projectId]/commitments/[commitmentId]/change-events#GET",
        message: "Authentication required.",
      });
    }

    // --- Source 1: change events with a line item referencing this commitment ---
    const { data: lineItemCEs, error: lineItemError } = await supabase
      .from("change_event_line_items")
      .select("change_event_id")
      .eq("commitment_id", commitmentId);

    if (lineItemError) return apiErrorResponse(lineItemError);

    // --- Source 2 & 3: change events linked via PCOs/CCOs ---

    // Get all commitment PCO IDs for this commitment
    const { data: pcos, error: pcoError } = await supabase
      .from("commitment_pcos")
      .select("id")
      .eq("commitment_id", commitmentId);

    if (pcoError) return apiErrorResponse(pcoError);

    // Get all CCO IDs for this commitment
    const { data: ccos, error: ccoError } = await supabase
      .from("contract_change_orders")
      .select("id")
      .eq("contract_id", commitmentId);

    if (ccoError) return apiErrorResponse(ccoError);

    const pcoIds = (pcos ?? []).map((p) => p.id);
    const ccoIds = (ccos ?? []).map((c) => c.id);
    const allLinkedIds = [...pcoIds, ...ccoIds];

    const pcoLinkCEIds: string[] = [];
    if (allLinkedIds.length > 0) {
      const { data: links, error: linkError } = await supabase
        .from("change_event_pco_links")
        .select("change_event_id")
        .in("pco_id", allLinkedIds);

      if (linkError) return apiErrorResponse(linkError);
      pcoLinkCEIds.push(...(links ?? []).map((l) => l.change_event_id));
    }

    // Merge and deduplicate CE IDs from all sources
    const lineItemCEIds = (lineItemCEs ?? []).map((r) => r.change_event_id);
    const allCEIds = [...new Set([...lineItemCEIds, ...pcoLinkCEIds])];

    if (allCEIds.length === 0) {
      return NextResponse.json({ data: [], meta: { total_count: 0 } });
    }

    // Fetch the actual change events
    const { data: changeEvents, error: ceError } = await supabase
      .from("change_events")
      .select("id, number, title, status, reason, scope, type, created_at, description")
      .in("id", allCEIds)
      .eq("project_id", Number(projectId))
      .is("deleted_at", null)
      .order("number", { ascending: true });

    if (ceError) return apiErrorResponse(ceError);

    return NextResponse.json({
      data: changeEvents ?? [],
      meta: { total_count: (changeEvents ?? []).length },
    });
  },
);
