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

const bulkCreateItemSchema = z.object({
  change_event_id: z.string().uuid("Invalid change event ID"),
  commitment_id: z.string().uuid("Invalid commitment ID"),
  commitment_type: z.enum(["subcontract", "purchase_order"]),
});

const bulkCreateSchema = z.object({
  items: z
    .array(bulkCreateItemSchema)
    .min(1, "At least one item is required")
    .max(100, "Maximum 100 items per batch"),
});

/**
 * POST /api/projects/[projectId]/commitment-pcos/bulk-create
 * Bulk create commitment PCOs from multiple change events.
 * Groups CEs by commitment — one PCO per unique commitment.
 */
export const POST = withApiGuardrails(
  "projects/[projectId]/commitment-pcos/bulk-create#POST",
  async ({ request, params }) => {
  
    const { projectId } = await params;
    const projectIdNum = parseInt(projectId, 10);
    const supabase = await createClient();

    // Auth check
    const user = await getApiRouteUser();
    if (!user) {
      throw new GuardrailError({ code: "AUTH_EXPIRED", where: "projects/[projectId]/commitment-pcos/bulk-create#POST", message: "Authentication required." });
    }

    const body = await request.json();
    const { items } = bulkCreateSchema.parse(body);

    // Group items by commitment (one PCO per unique commitment)
    const commitmentGroups = new Map<
      string,
      {
        commitment_id: string;
        commitment_type: string;
        change_event_ids: string[];
      }
    >();

    for (const item of items) {
      const key = item.commitment_id;
      if (!commitmentGroups.has(key)) {
        commitmentGroups.set(key, {
          commitment_id: item.commitment_id,
          commitment_type: item.commitment_type,
          change_event_ids: [],
        });
      }
      commitmentGroups.get(key)!.change_event_ids.push(item.change_event_id);
    }

    // Fetch change event titles for PCO naming
    const allCeIds = items.map((i) => i.change_event_id);
    const { data: changeEvents } = await supabase
      .from("change_events")
      .select("id, number, title")
      .in("id", allCeIds);

    const ceMap = new Map(
      (changeEvents || []).map((ce) => [ce.id, ce]),
    );

    // Fetch commitment info for PCO titles
    const commitmentIds = [...commitmentGroups.keys()];
    const commitmentNames: Record<string, string> = {};

    const subIds = [...commitmentGroups.values()]
      .filter((g) => g.commitment_type === "subcontract")
      .map((g) => g.commitment_id);
    const poIds = [...commitmentGroups.values()]
      .filter((g) => g.commitment_type === "purchase_order")
      .map((g) => g.commitment_id);

    if (subIds.length > 0) {
      const { data: subs } = await supabase
        .from("subcontracts")
        .select("id, title, contract_number")
        .in("id", subIds);
      for (const s of subs || []) {
        commitmentNames[s.id] = s.title || s.contract_number || "Subcontract";
      }
    }

    if (poIds.length > 0) {
      const { data: pos } = await supabase
        .from("purchase_orders")
        .select("id, title, contract_number")
        .in("id", poIds);
      for (const p of pos || []) {
        commitmentNames[p.id] = p.title || p.contract_number || "Purchase Order";
      }
    }

    const createdPcos: Array<Record<string, any>> = [];
    const createdLinks: Array<Record<string, any>> = [];
    const errors: Array<{ commitment_id: string; error: string }> = [];

    // Create one PCO per commitment group
    for (const [, group] of commitmentGroups) {
      try {
        // Generate PCO number
        const { data: pcoNumber, error: rpcError } = await supabase.rpc(
          "generate_pco_number",
          {
            p_project_id: projectIdNum,
            p_type: "commitment",
          },
        );

        if (rpcError) {
          errors.push({
            commitment_id: group.commitment_id,
            error: `Failed to generate PCO number: ${rpcError.message}`,
          });
          continue;
        }

        // Build title from commitment name + CE references
        const ceRefs = group.change_event_ids
          .map((id) => {
            const ce = ceMap.get(id);
            return ce ? `CE-${ce.number}` : null;
          })
          .filter(Boolean);

        const commitmentName =
          commitmentNames[group.commitment_id] || "Commitment";
        const title =
          ceRefs.length > 0
            ? `${commitmentName} — ${ceRefs.join(", ")}`
            : commitmentName;

        // Create PCO
        const { data: pco, error: insertError } = await supabase
          .from("commitment_pcos")
          .insert({
            project_id: projectIdNum,
            commitment_id: group.commitment_id,
            commitment_type: group.commitment_type,
            pco_number: pcoNumber,
            title: title.slice(0, 500),
            status: "draft",
            created_by: user.id,
          })
          .select("*")
          .single();

        if (insertError) {
          errors.push({
            commitment_id: group.commitment_id,
            error: insertError.message,
          });
          continue;
        }

        createdPcos.push(pco);

        // Create change_event_pco_links
        const linkRows = group.change_event_ids.map((ceId) => ({
          change_event_id: ceId,
          pco_id: pco.id,
          pco_type: "commitment" as const,
          linked_by: user.id,
        }));

        const { data: links, error: linkError } = await supabase
          .from("change_event_pco_links")
          .insert(linkRows)
          .select("*");

        if (linkError) {
          logger.error({ msg: "[bulk-create] Link creation error", error: linkError.message });
          // Non-fatal — PCO was created, links failed
        } else {
          createdLinks.push(...(links || []));
        }

        // Update change events: set sent_to_commitment_pco = true
        const { error: ceUpdateError } = await supabase
          .from("change_events")
          .update({ sent_to_commitment_pco: true })
          .in("id", group.change_event_ids);

        if (ceUpdateError) {
          logger.error({ msg: "[bulk-create] CE update error", error: ceUpdateError.message });
        }
      } catch (groupError) {
        errors.push({
          commitment_id: group.commitment_id,
          error:
            groupError instanceof Error
              ? groupError.message
              : "Unknown error",
        });
      }
    }

    return NextResponse.json(
      {
        created: createdPcos,
        links: createdLinks,
        errors: errors.length > 0 ? errors : undefined,
        summary: {
          pcos_created: createdPcos.length,
          links_created: createdLinks.length,
          errors: errors.length,
        },
      },
      { status: 201 },
    );
    },
);
