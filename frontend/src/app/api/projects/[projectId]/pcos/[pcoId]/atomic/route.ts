/**
 * ============================================================================
 * PCO ATOMIC UPDATE ROUTE
 * ============================================================================
 *
 * PUT /api/projects/[projectId]/pcos/[pcoId]/atomic
 *
 * Updates a Potential Change Order — header + grouped change events + all line
 * items — in a SINGLE transaction via the update_pco_with_lines RPC. This
 * replaces the edit page's old sequence of separate PATCH/POST/PUT/DELETE calls,
 * which could leave the PCO half-updated on a mid-chain failure.
 *
 * Body:
 *   { ...header fields, change_event_ids: string[], line_items: LineItem[] }
 * where LineItem = { id?: number (existing row), description, quantity, uom,
 *                    unit_cost, category, change_event_line_item_id? }
 * change_event_ids and line_items are the FULL desired sets; anything omitted is
 * removed.
 */

import { withApiGuardrails } from "@/lib/guardrails/api";
import { GuardrailError } from "@/lib/guardrails/errors";
import { createClient, getApiRouteUser } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/permissions-guard";
import { logger } from "@/lib/logger";
import type { Json } from "@/types/database.types";

function statusForPgCode(code: string | undefined): number {
  switch (code) {
    case "02000": // no_data_found -> PCO not found for project
    case "P0002":
      return 404;
    case "23514": // check_violation -> missing title
      return 422;
    case "23503": // foreign_key_violation -> change event not in project
      return 400;
    case "22P02": // invalid_text_representation -> bad numeric/uuid/date
      return 400;
    default:
      return 400;
  }
}

interface PcoLineItemInput {
  id?: number;
  description?: string | null;
  quantity?: number;
  uom?: string | null;
  unit_cost?: number;
  category?: string | null;
  change_event_line_item_id?: string | null;
}

export const PUT = withApiGuardrails<{ projectId: string; pcoId: string }>(
  "projects/[projectId]/pcos/[pcoId]/atomic#PUT",
  async ({ request, params }) => {
    const where = "projects/[projectId]/pcos/[pcoId]/atomic#PUT";
    const { projectId, pcoId } = params;
    const numericProjectId = parseInt(projectId, 10);
    const numericPcoId = parseInt(pcoId, 10);

    if (!Number.isFinite(numericProjectId) || !Number.isFinite(numericPcoId)) {
      throw new GuardrailError({ code: "INVALID_PAYLOAD", where, message: "Invalid project or PCO id." });
    }

    const guard = await requirePermission(numericProjectId, "change_orders", "write");
    if (guard.denied) return guard.response;

    const supabase = await createClient();
    const body = await request.json();

    const user = await getApiRouteUser();
    if (!user) {
      throw new GuardrailError({ code: "AUTH_EXPIRED", where, message: "Authentication required." });
    }

    if (!body.title || typeof body.title !== "string" || !body.title.trim()) {
      throw new GuardrailError({ code: "INVALID_PAYLOAD", where, message: "title is required." });
    }

    const changeEventIds = Array.isArray(body.change_event_ids)
      ? (body.change_event_ids as unknown[]).map((id) => String(id))
      : [];

    const lineItems = Array.isArray(body.line_items)
      ? (body.line_items as PcoLineItemInput[]).map((li) => ({
          ...(li.id != null ? { id: li.id } : {}),
          description: li.description ?? null,
          quantity: li.quantity ?? 1,
          uom: li.uom ?? null,
          unit_cost: li.unit_cost ?? 0,
          category: li.category ?? null,
          change_event_line_item_id: li.change_event_line_item_id ?? null,
        }))
      : [];

    const { data, error } = await supabase.rpc("update_pco_with_lines", {
      p_project_id: numericProjectId,
      p_pco_id: numericPcoId,
      p_user_id: user.id,
      p_header: body as Json,
      p_change_event_ids: changeEventIds,
      p_line_items: lineItems as Json,
    });

    if (error) {
      logger.error({ msg: "Failed to update PCO atomically", error: error.message });
      const status = statusForPgCode(error.code);
      const message = error.message?.trim() || "Failed to update the PCO. No changes were saved.";
      return NextResponse.json({ error: message, error_message: message }, { status });
    }

    return NextResponse.json(data);
  },
);
