import { withApiGuardrails } from "@/lib/guardrails/api";
import { GuardrailError } from "@/lib/guardrails/errors";
import { NextResponse } from "next/server";
import { verifyProjectAccess, isAuthError } from "@/lib/supabase/auth-guard";
import { requirePermission } from "@/lib/permissions-guard";
import { getCommitmentSovLockStateForCommitment } from "@/lib/commitments/commitment-sov-lock.server";
import {
  fetchCommitmentSovProjectBudgetCodes,
  resolveCommitmentSovBudgetCodeFromLookup,
  type ResolvedCommitmentSovBudgetCode,
} from "@/lib/commitments/sov-budget-code-resolution.server";
import type { Database } from "@/types/database.types";
import type { SupabaseClient } from "@supabase/supabase-js";

interface LineItemInput {
  id?: string;
  line_number: number | null;
  budget_code: string | null;
  project_budget_code_id?: string | null;
  projectBudgetCodeId?: string | null;
  description: string | null;
  amount: number | null;
  billed_to_date: number | null;
  quantity?: number | null;
  unit_cost?: number | null;
  uom?: string | null;
  unit_of_measure?: string | null;
  retainage_percent?: number | null;
}

interface UpdatePayload {
  lineItems: LineItemInput[];
  commitmentType?: "subcontract" | "purchase_order" | string;
}

type DbClient = SupabaseClient<Database>;
type CommitmentType = "subcontract" | "purchase_order";
type Tables = Database["public"]["Tables"];
type SubcontractSovRow = Tables["subcontract_sov_items"]["Row"];
type SubcontractSovInsert = Tables["subcontract_sov_items"]["Insert"];
type SubcontractSovUpdate = Tables["subcontract_sov_items"]["Update"];
type PurchaseOrderSovRow = Tables["purchase_order_sov_items"]["Row"];
type PurchaseOrderSovInsert = Tables["purchase_order_sov_items"]["Insert"];
type PurchaseOrderSovUpdate = Tables["purchase_order_sov_items"]["Update"];
type SovRow = SubcontractSovRow | PurchaseOrderSovRow;
type ExistingSovItem = Pick<SovRow, "id" | "billed_to_date" | "amount">;

const ROUTE_WHERE = "projects/[projectId]/commitments/[commitmentId]/line-items";

function invalidPayload(message: string): never {
  throw new GuardrailError({
    code: "INVALID_PAYLOAD",
    where: ROUTE_WHERE,
    message,
    status: 400,
  });
}

function normalizeCommitmentType(
  value: string | null | undefined,
  fallback?: CommitmentType,
): CommitmentType {
  if (value === "subcontract" || value === "purchase_order") return value;
  if (fallback) return fallback;
  throw new GuardrailError({
    code: "SCHEMA_MISMATCH",
    where: ROUTE_WHERE,
    message: `Unsupported commitment type: ${value ?? "missing"}`,
  });
}

async function fetchCommitmentType(
  supabase: DbClient,
  commitmentId: string,
): Promise<CommitmentType> {
  const { data, error } = await supabase
    .from("commitments_unified")
    .select("commitment_type")
    .eq("id", commitmentId)
    .single();

  if (error || !data) {
    throw new GuardrailError({
      code: "INVALID_PAYLOAD",
      where: `${ROUTE_WHERE}#commitment-type`,
      message: "Commitment not found.",
      cause: error,
      status: 404,
    });
  }

  return normalizeCommitmentType(data.commitment_type);
}

/**
 * Commitment SOV edits are blocked once invoice workflow has started. Enforced
 * server-side so the lock cannot be bypassed by calling the API directly.
 */
async function assertCommitmentEditable(
  supabase: DbClient,
  commitmentId: string,
  commitmentType: CommitmentType,
): Promise<void> {
  const lock = await getCommitmentSovLockStateForCommitment(supabase, {
    commitmentId,
    commitmentType,
  });

  if (lock.locked) {
    throw new GuardrailError({
      code: "PRECONDITION_FAILED",
      where: `${ROUTE_WHERE}#invoice-locked`,
      message: lock.message ?? "This commitment schedule of values is locked.",
      details: {
        errorCode: "COMMITMENT_SOV_LOCKED_AFTER_INVOICE_SUBMISSION",
        reason: lock.reason,
      },
      status: 412,
    });
  }
}

async function fetchSovLineItems(
  supabase: DbClient,
  commitmentType: CommitmentType,
  commitmentId: string,
): Promise<SovRow[]> {
  if (commitmentType === "subcontract") {
    const { data, error } = await supabase
      .from("subcontract_sov_items")
      .select("*")
      .eq("subcontract_id", commitmentId)
      .order("line_number", { ascending: true });

    if (error) {
      throw new GuardrailError({
        code: "INTERNAL_ERROR",
        where: `${ROUTE_WHERE}#fetch-subcontract-sov`,
        message: `Failed to fetch subcontract line items: ${error.message}`,
        cause: error,
      });
    }
    return data ?? [];
  }

  const { data, error } = await supabase
    .from("purchase_order_sov_items")
    .select("*")
    .eq("purchase_order_id", commitmentId)
    .order("line_number", { ascending: true });

  if (error) {
    throw new GuardrailError({
      code: "INTERNAL_ERROR",
      where: `${ROUTE_WHERE}#fetch-purchase-order-sov`,
      message: `Failed to fetch purchase order line items: ${error.message}`,
      cause: error,
    });
  }
  return data ?? [];
}

async function fetchExistingSovItems(
  supabase: DbClient,
  commitmentType: CommitmentType,
  commitmentId: string,
): Promise<ExistingSovItem[]> {
  if (commitmentType === "subcontract") {
    const { data, error } = await supabase
      .from("subcontract_sov_items")
      .select("id, billed_to_date, amount")
      .eq("subcontract_id", commitmentId);

    if (error) {
      throw new GuardrailError({
        code: "INTERNAL_ERROR",
        where: `${ROUTE_WHERE}#fetch-existing-subcontract-sov`,
        message: `Failed to fetch existing subcontract line items: ${error.message}`,
        cause: error,
      });
    }
    return data ?? [];
  }

  const { data, error } = await supabase
    .from("purchase_order_sov_items")
    .select("id, billed_to_date, amount")
    .eq("purchase_order_id", commitmentId);

  if (error) {
    throw new GuardrailError({
      code: "INTERNAL_ERROR",
      where: `${ROUTE_WHERE}#fetch-existing-purchase-order-sov`,
      message: `Failed to fetch existing purchase order line items: ${error.message}`,
      cause: error,
    });
  }
  return data ?? [];
}

async function deleteSovItems(
  supabase: DbClient,
  commitmentType: CommitmentType,
  idsToDelete: string[],
) {
  if (idsToDelete.length === 0) return;

  const result =
    commitmentType === "subcontract"
      ? await supabase
          .from("subcontract_sov_items")
          .delete()
          .in("id", idsToDelete)
      : await supabase
          .from("purchase_order_sov_items")
          .delete()
          .in("id", idsToDelete);

  if (result.error) {
    throw new GuardrailError({
      code: "INTERNAL_ERROR",
      where: `${ROUTE_WHERE}#delete-sov-items`,
      message: `Failed to delete removed line items: ${result.error.message}`,
      cause: result.error,
    });
  }
}

function buildSubcontractSovData(
  commitmentId: string,
  lineNumber: number,
  item: LineItemInput,
  budgetCode: ResolvedCommitmentSovBudgetCode,
): SubcontractSovUpdate & SubcontractSovInsert {
  return {
    subcontract_id: commitmentId,
    line_number: lineNumber,
    budget_code: budgetCode.displayBudgetCode,
    project_budget_code_id: budgetCode.projectBudgetCodeId,
    description: item.description || "",
    amount: item.amount ?? 0,
    billed_to_date: item.billed_to_date ?? 0,
    quantity: item.quantity ?? null,
    unit_cost: item.unit_cost ?? null,
    unit_of_measure: item.unit_of_measure ?? item.uom ?? null,
    retainage_percent: item.retainage_percent ?? null,
    updated_at: new Date().toISOString(),
  };
}

function buildPurchaseOrderSovData(
  commitmentId: string,
  lineNumber: number,
  item: LineItemInput,
  budgetCode: ResolvedCommitmentSovBudgetCode,
): PurchaseOrderSovUpdate & PurchaseOrderSovInsert {
  return {
    purchase_order_id: commitmentId,
    line_number: lineNumber,
    budget_code: budgetCode.displayBudgetCode,
    project_budget_code_id: budgetCode.projectBudgetCodeId,
    description: item.description || "",
    amount: item.amount ?? 0,
    billed_to_date: item.billed_to_date ?? 0,
    quantity: item.quantity ?? null,
    unit_cost: item.unit_cost ?? null,
    uom: item.uom ?? item.unit_of_measure ?? null,
    updated_at: new Date().toISOString(),
  };
}

async function upsertSovItem(
  supabase: DbClient,
  commitmentType: CommitmentType,
  commitmentId: string,
  item: LineItemInput,
  lineNumber: number,
  isExisting: boolean,
  budgetCode: ResolvedCommitmentSovBudgetCode,
): Promise<SovRow> {
  if (commitmentType === "subcontract") {
    const itemData = buildSubcontractSovData(commitmentId, lineNumber, item, budgetCode);
    const result =
      item.id && isExisting
        ? await supabase
            .from("subcontract_sov_items")
            .update(itemData)
            .eq("id", item.id)
            .select()
            .single()
        : await supabase
            .from("subcontract_sov_items")
            .insert({
              ...itemData,
              created_at: new Date().toISOString(),
            })
            .select()
            .single();

    if (result.error) {
      throw new Error(result.error.message);
    }
    return result.data;
  }

  const itemData = buildPurchaseOrderSovData(commitmentId, lineNumber, item, budgetCode);
  const result =
    item.id && isExisting
      ? await supabase
          .from("purchase_order_sov_items")
          .update(itemData)
          .eq("id", item.id)
          .select()
          .single()
      : await supabase
          .from("purchase_order_sov_items")
          .insert({
            ...itemData,
            created_at: new Date().toISOString(),
          })
          .select()
          .single();

  if (result.error) {
    throw new Error(result.error.message);
  }
  return result.data;
}

/**
 * GET /api/projects/[projectId]/commitments/[commitmentId]/line-items
 *
 * Fetches all Schedule of Values (SOV) line items for a commitment.
 * Determines the commitment type from the `commitments_unified` view,
 * then queries the appropriate SOV table (subcontract_sov_items or
 * purchase_order_sov_items).
 *
 * @route GET /api/projects/[projectId]/commitments/[commitmentId]/line-items
 * @param {string} projectId - Project ID (integer)
 * @param {string} commitmentId - Commitment UUID
 *
 * @returns {object} 200 - {
 *     success: true,
 *     data: Array<SOVLineItem>,
 *     commitmentType: "subcontract" | "purchase_order"
 *   }
 * @returns {object} 400 - Invalid project ID or database query error
 * @returns {object} 401/403 - Unauthorized or insufficient project access
 * @returns {object} 404 - Commitment not found
 * @returns {object} 500 - Internal server error
 */
export const GET = withApiGuardrails(
  "projects/[projectId]/commitments/[commitmentId]/line-items#GET",
  async ({ request, params }) => {
    const { projectId, commitmentId } = await params;
    const numericProjectId = Number.parseInt(projectId, 10);

    if (Number.isNaN(numericProjectId)) {
      invalidPayload("Invalid project ID.");
    }

    const authResult = await verifyProjectAccess(numericProjectId);
    if (isAuthError(authResult)) return authResult;
    const supabase = authResult.serviceClient;

    const commitmentType = await fetchCommitmentType(supabase, commitmentId);
    const lineItems = await fetchSovLineItems(
      supabase,
      commitmentType,
      commitmentId,
    );

    return NextResponse.json({
      success: true,
      data: lineItems,
      commitmentType,
    });
  },
);

/**
 * PUT /api/projects/[projectId]/commitments/[commitmentId]/line-items
 *
 * Batch updates all SOV line items for a commitment using an upsert strategy:
 * 1. Fetches existing line item IDs
 * 2. Deletes items no longer present in the submitted list
 * 3. Updates existing items (matched by ID)
 * 4. Inserts new items (no ID or ID not in existing set)
 *
 * @route PUT /api/projects/[projectId]/commitments/[commitmentId]/line-items
 * @param {string} projectId - Project ID (integer)
 * @param {string} commitmentId - Commitment UUID
 *
 * @requestBody {object}
 *   - lineItems {Array<LineItemInput>} (required) - Full list of line items:
 *     - id {string} [optional] - Existing item ID (omit for new items)
 *     - line_number {number|null} - Line number (auto-assigned from index if null)
 *     - budget_code {string|null} - Budget/cost code
 *     - description {string|null} - Line item description
 *     - amount {number|null} - Dollar amount
 *     - billed_to_date {number|null} - Amount billed so far
 *   - commitmentType {string} [optional] - "subcontract" or "purchase_order"
 *     (auto-detected from commitments_unified if not provided)
 *
 * @returns {object} 200 - {
 *     success: true,
 *     savedCount: number,
 *     deletedCount: number,
 *     totalAmount: number,
 *     errors?: string[],
 *     message: string
 *   }
 * @returns {object} 400 - Invalid project ID, missing lineItems array, or DB errors
 * @returns {object} 401/403 - Unauthorized or insufficient project access
 * @returns {object} 500 - Internal server error
 */
export const PUT = withApiGuardrails(
  "projects/[projectId]/commitments/[commitmentId]/line-items#PUT",
  async ({ request, params }) => {
    const { projectId, commitmentId } = await params;
    const numericProjectId = Number.parseInt(projectId, 10);

    if (Number.isNaN(numericProjectId)) {
      invalidPayload("Invalid project ID.");
    }

    const authResult = await verifyProjectAccess(numericProjectId);
    if (isAuthError(authResult)) return authResult;
    const supabase = authResult.serviceClient;

    const guard = await requirePermission(numericProjectId, "contracts", "write");
    if (guard.denied) return guard.response;

    const body = (await request.json()) as UpdatePayload;
    const { lineItems, commitmentType: bodyCommitmentType } = body;

    if (!lineItems || !Array.isArray(lineItems)) {
      invalidPayload("Invalid payload: lineItems array required.");
    }

    const commitmentType = bodyCommitmentType
      ? normalizeCommitmentType(bodyCommitmentType, "subcontract")
      : await fetchCommitmentType(supabase, commitmentId);

    await assertCommitmentEditable(supabase, commitmentId, commitmentType);

    // Fetch existing line items (with billed_to_date + amount so we can lock invoiced lines)
    const existingItems = await fetchExistingSovItems(
      supabase,
      commitmentType,
      commitmentId,
    );

    const existingById = new Map<
      string,
      { billed_to_date: number | null; amount: number | null }
    >(
      existingItems.map((item) => [
        item.id,
        { billed_to_date: item.billed_to_date, amount: item.amount },
      ]),
    );
    const existingIds = new Set<string>(existingById.keys());
    const newItemIds = new Set<string>(
      lineItems.filter((item) => item.id).map((item) => item.id as string),
    );

    const isBilled = (id: string) =>
      (existingById.get(id)?.billed_to_date ?? 0) > 0;

    // Block deletion of invoiced lines
    const idsToDelete = [...existingIds].filter((id) => !newItemIds.has(id));
    const blockedDeletes = idsToDelete.filter(isBilled);
    if (blockedDeletes.length > 0) {
      throw new GuardrailError({
        code: "INVALID_PAYLOAD",
        where: `${ROUTE_WHERE}#delete-invoiced-lines`,
        message: "Cannot delete invoiced SOV lines.",
        details: {
          reason: `${blockedDeletes.length} line item(s) have billed_to_date > 0 and are locked. Remove the invoices first.`,
          blockedIds: blockedDeletes,
        },
        status: 400,
      });
    }

    // Block amount changes on invoiced lines
    const blockedAmountChanges: string[] = [];
    for (const item of lineItems) {
      if (!item.id || !existingById.has(item.id)) continue;
      if (!isBilled(item.id)) continue;
      const prevAmount = existingById.get(item.id)?.amount ?? 0;
      const nextAmount = item.amount ?? 0;
      if (Number(prevAmount) !== Number(nextAmount)) {
        blockedAmountChanges.push(item.id);
      }
    }
    if (blockedAmountChanges.length > 0) {
      throw new GuardrailError({
        code: "INVALID_PAYLOAD",
        where: `${ROUTE_WHERE}#change-invoiced-line-amount`,
        message: "Cannot change amount on invoiced SOV lines.",
        details: {
          reason: `${blockedAmountChanges.length} line item(s) have billed_to_date > 0; their amount is locked.`,
          blockedIds: blockedAmountChanges,
        },
        status: 400,
      });
    }

    const projectBudgetCodes = await fetchCommitmentSovProjectBudgetCodes(
      supabase,
      numericProjectId,
      ROUTE_WHERE,
    );

    await deleteSovItems(supabase, commitmentType, idsToDelete);

    // Upsert line items
    const upsertedItems: unknown[] = [];
    const errors: string[] = [];

    for (let i = 0; i < lineItems.length; i++) {
      const item = lineItems[i];
      const lineNumber = item.line_number ?? i + 1;
      const budgetCode = resolveCommitmentSovBudgetCodeFromLookup({
        budgetCodes: projectBudgetCodes,
        lineNumber,
        where: ROUTE_WHERE,
        submittedBudgetCode: item.budget_code,
        submittedProjectBudgetCodeId:
          item.project_budget_code_id ?? item.projectBudgetCodeId ?? null,
      });

      try {
        const upsertedItem = await upsertSovItem(
          supabase,
          commitmentType,
          commitmentId,
          item,
          lineNumber,
          Boolean(item.id && existingIds.has(item.id)),
          budgetCode,
        );
        upsertedItems.push(upsertedItem);
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown error";
        errors.push(`Line ${lineNumber}: ${message}`);
      }
    }

    if (errors.length > 0) {
      throw new GuardrailError({
        code: "INTERNAL_ERROR",
        where: `${ROUTE_WHERE}#upsert-sov-items`,
        message: "Failed to save one or more SOV line items.",
        details: errors,
      });
    }

    // Calculate total amount for budget impact tracking
    const totalAmount = lineItems.reduce(
      (sum, item) => sum + (item.amount ?? 0),
      0,
    );

    return NextResponse.json({
      success: true,
      savedCount: upsertedItems.length,
      deletedCount: idsToDelete.length,
      totalAmount,
      errors: errors.length > 0 ? errors : undefined,
      message: `Successfully saved ${upsertedItems.length} line items${
        idsToDelete.length > 0 ? `, deleted ${idsToDelete.length}` : ""
      }`,
    });
  },
);
