import { withApiGuardrails } from "@/lib/guardrails/api";
import { GuardrailError } from "@/lib/guardrails/errors";
import { NextResponse } from "next/server";

import { createClient, getApiRouteUser } from "@/lib/supabase/server";
import { apiErrorResponse } from "@/lib/api-error";
import { requirePermission } from "@/lib/permissions-guard";
import {
  canDeletePrimeContractChangeOrderStatus,
  primeContractChangeOrderDeleteBlockedMessage,
} from "@/lib/change-orders/prime-contract-change-order-statuses";

interface RouteParams {
  params: Promise<{ projectId: string; primeCoId: string }>;
}

// Force dynamic execution to prevent dev static-path resolution from attempting
// to prerender this route handler path and throwing PageNotFoundError.
export const dynamic = "force-dynamic";

type PersonRecord = {
  id: string;
  auth_user_id: string | null;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
};

function buildPersonName(person: PersonRecord | null | undefined): string | null {
  if (!person) return null;
  const fullName = [person.first_name, person.last_name].filter(Boolean).join(" ").trim();
  return fullName || person.email || null;
}

/**
 * GET /api/projects/[projectId]/prime-contract-change-orders/[primeCoId]
 * Returns the PCCO with related contract info and line items.
 */
export const GET = withApiGuardrails(
  "projects/[projectId]/prime-contract-change-orders/[primeCoId]#GET",
  async ({ request, params }) => {
  
    const { projectId, primeCoId } = await params;

    const user = await getApiRouteUser();
    if (!user) {
      throw new GuardrailError({
        code: "AUTH_EXPIRED",
        where: "projects/[projectId]/prime-contract-change-orders/[primeCoId]#GET",
        message: "Authentication required.",
      });
    }

    const numericId = Number(primeCoId);
    if (!Number.isFinite(numericId) || numericId <= 0) {
      return NextResponse.json({ error: "Invalid ID" }, { status: 404 });
    }

    const supabase = await createClient();

    // Fetch the PCCO
    const { data, error } = await supabase
      .from("prime_contract_change_orders")
      .select("*")
      .eq("id", numericId)
      .eq("project_id", Number(projectId))
      .single();

    if (error) {
      if (error.code === "PGRST116") {
        return NextResponse.json({ error: "Not found" }, { status: 404 });
      }
      return apiErrorResponse(error);
    }

    // Fetch line items for this PCCO
    const { data: lineItems } = await supabase
      .from("pcco_line_items")
      .select("*")
      .eq("pcco_id", numericId)
      .order("id", { ascending: true });

    // Fetch contract info if linked
    let contractInfo = null;
    if (data.prime_contract_id) {
      const { data: contract } = await supabase
        .from("prime_contracts")
        .select("id, contract_number, title, original_contract_value, revised_contract_value")
        .eq("id", data.prime_contract_id)
        .single();
      contractInfo = contract;
    }

    const creatorIdentifier =
      typeof data.created_by === "string" && data.created_by.trim().length > 0
        ? data.created_by
        : null;

    let createdByName: string | null = null;
    if (creatorIdentifier) {
      const [{ data: personById, error: personByIdError }, { data: personByAuth, error: personByAuthError }] =
        await Promise.all([
          supabase
            .from("people")
            .select("id, auth_user_id, first_name, last_name, email")
            .eq("id", creatorIdentifier)
            .maybeSingle<PersonRecord>(),
          supabase
            .from("people")
            .select("id, auth_user_id, first_name, last_name, email")
            .eq("auth_user_id", creatorIdentifier)
            .maybeSingle<PersonRecord>(),
        ]);

      if (personByIdError) {
        return apiErrorResponse(personByIdError);
      }
      if (personByAuthError) {
        return apiErrorResponse(personByAuthError);
      }

      createdByName = buildPersonName(personById ?? personByAuth);
    }

    return NextResponse.json({
      ...data,
      created_by_name: createdByName,
      line_items: lineItems ?? [],
      contract: contractInfo,
    });
    },
);

// --- API-008: Whitelist of fields allowed in PUT updates ---
const allowedFields = new Set([
  "title",
  "status",
  "description",
  "change_reason",
  "designated_reviewer",
  "review_date",
  "reviewed_by",
  "request_received_from",
  "due_date",
  "invoiced_date",
  "paid_date",
  "schedule_impact",
  "revised_substantial_completion_date",
  "location",
  "reference",
  "field_change",
  "is_private",
  "paid_in_full",
  "total_amount",
  "executed",
  "contract_id",
  "prime_contract_id",
  "contract_company",
  "revision",
  "signed_co_received_date",
]);

/**
 * PUT /api/projects/[projectId]/prime-contract-change-orders/[primeCoId]
 * Update a PCCO — whitelisted fields only (API-008)
 */
export const PUT = withApiGuardrails(
  "projects/[projectId]/prime-contract-change-orders/[primeCoId]#PUT",
  async ({ request, params }) => {
  
    const { projectId, primeCoId } = await params;
    const numericId = Number(primeCoId);

    if (!Number.isFinite(numericId) || numericId <= 0) {
      return NextResponse.json({ error: "Invalid ID" }, { status: 404 });
    }

    const guard = await requirePermission(Number(projectId), "change_orders", "write");
    if (guard.denied) return guard.response;

    const supabase = await createClient();

    const user = await getApiRouteUser();

    if (!user) {
      throw new GuardrailError({ code: "AUTH_EXPIRED", where: "projects/[projectId]/prime-contract-change-orders/[primeCoId]#PUT", message: "Authentication required." });
    }

    const body = await request.json();

    // --- API-008: Only allow whitelisted fields ---
    const updateData: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(body)) {
      if (allowedFields.has(key)) {
        updateData[key] = value;
      }
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json(
        { error: "No valid fields to update" },
        { status: 400 },
      );
    }

    // Invariant: a PCCO carries `approved_at` only while its status is "approved".
    // Approval (stamping `approved_at`) is owned by the dedicated approve route,
    // which also recalculates the contract's revised value. This route only ever
    // leaves the approved state, so any status change to a non-approved value must
    // clear `approved_at` — otherwise a reverted-to-draft row keeps looking
    // approved (phantom approved date in the budget CO drilldown and detail page).
    if ("status" in updateData) {
      const nextStatus = String(updateData.status ?? "").toLowerCase();
      if (nextStatus !== "approved") {
        updateData.approved_at = null;
      }
    }

    const { data, error } = await supabase
      .from("prime_contract_change_orders")
      .update(updateData)
      .eq("id", numericId)
      .eq("project_id", Number(projectId))
      .select("*")
      .single();

    if (error) {
      return apiErrorResponse(error);
    }

    return NextResponse.json(data);
    },
);

/**
 * DELETE /api/projects/[projectId]/prime-contract-change-orders/[primeCoId]
 */
export const DELETE = withApiGuardrails(
  "projects/[projectId]/prime-contract-change-orders/[primeCoId]#DELETE",
  async ({ request, params }) => {
  
    const { projectId, primeCoId } = await params;
    const numericId = Number(primeCoId);

    if (!Number.isFinite(numericId) || numericId <= 0) {
      return NextResponse.json({ error: "Invalid ID" }, { status: 404 });
    }

    const guard = await requirePermission(Number(projectId), "change_orders", "admin");
    if (guard.denied) return guard.response;

    const supabase = await createClient();

    const user = await getApiRouteUser();

    if (!user) {
      throw new GuardrailError({ code: "AUTH_EXPIRED", where: "projects/[projectId]/prime-contract-change-orders/[primeCoId]#DELETE", message: "Authentication required." });
    }

    // Guard: only draft, pending, or rejected PCCOs can be deleted
    const { data: existing, error: fetchError } = await supabase
      .from("prime_contract_change_orders")
      .select("id, status")
      .eq("id", numericId)
      .eq("project_id", Number(projectId))
      .single();

    if (fetchError || !existing) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    if (!canDeletePrimeContractChangeOrderStatus(existing.status)) {
      return NextResponse.json(
        { error: primeContractChangeOrderDeleteBlockedMessage(existing.status) },
        { status: 409 },
      );
    }

    const { error } = await supabase
      .from("prime_contract_change_orders")
      .delete()
      .eq("id", numericId)
      .eq("project_id", Number(projectId));

    if (error) {
      return apiErrorResponse(error);
    }

    return NextResponse.json({ message: "Deleted successfully" });
    },
);
