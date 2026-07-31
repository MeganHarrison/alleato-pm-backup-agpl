import { withApiGuardrails } from "@/lib/guardrails/api";
import { GuardrailError } from "@/lib/guardrails/errors";
import { assertNonNilUuid } from "@/lib/guardrails/path-params";
import { createClient, getApiRouteUser } from "@/lib/supabase/server";
import { getIsAdmin } from "@/lib/auth/current-user";
import { NextResponse } from "next/server";
import type { ZodError } from "@/app/api/types";
import { logger } from "@/lib/logger";
import { z } from "zod";
import { apiErrorResponse } from "@/lib/api-error";
import { getCommitmentSovLockStateForCommitment } from "@/lib/commitments/commitment-sov-lock.server";
import {
  fetchCommitmentSovProjectBudgetCodes,
  resolveCommitmentSovBudgetCodeFromLookup,
} from "@/lib/commitments/sov-budget-code-resolution.server";
import { normalizeSubcontractStatus } from "@/lib/db/subcontracts";
import { normalizeCommitmentContractNumber } from "@/lib/commitments/contract-number";

/**
 * Schema that matches what the commitment detail edit form actually sends.
 * Both subcontract and purchase order forms send contract_number (not number),
 * status as Title Case strings, contract_company_id as nullable string,
 * and do NOT send original_amount or accounting_method (required in the old
 * commitmentSchema).
 */
const commitmentEditSchema = z
  .object({
    contract_number: z.string().optional(),
    title: z.string().optional(),
    contract_company_id: z.string().nullable().optional(),
    company_license_number: z.string().nullable().optional(),
    status: z.string().optional(),
    description: z.string().nullable().optional(),
    inclusions: z.string().nullable().optional(),
    exclusions: z.string().nullable().optional(),
    start_date: z.string().nullable().optional(),
    estimated_completion_date: z.string().nullable().optional(),
    actual_completion_date: z.string().nullable().optional(),
    contract_date: z.string().nullable().optional(),
    signed_contract_received_date: z.string().nullable().optional(),
    signed_po_received_date: z.string().nullable().optional(),
    issued_on_date: z.string().nullable().optional(),
    delivery_date: z.string().nullable().optional(),
    default_retainage_percent: z.number().nullable().optional(),
    is_private: z.boolean().optional(),
    non_admin_user_ids: z.array(z.string()).optional(),
    allow_non_admin_view_sov_items: z.boolean().optional(),
    invoice_contact_ids: z.array(z.string()).optional(),
    accounting_method: z.string().nullable().optional(),
    bill_to: z.string().nullable().optional(),
    ship_to: z.string().nullable().optional(),
    bill_to_company_id: z.string().nullable().optional(),
    bill_to_contact_id: z.string().nullable().optional(),
    bill_to_address: z.string().nullable().optional(),
    bill_to_address_line2: z.string().nullable().optional(),
    bill_to_city: z.string().nullable().optional(),
    bill_to_state: z.string().nullable().optional(),
    bill_to_zip: z.string().nullable().optional(),
    ship_to_company_id: z.string().nullable().optional(),
    ship_to_contact_id: z.string().nullable().optional(),
    ship_to_address: z.string().nullable().optional(),
    ship_to_address_line2: z.string().nullable().optional(),
    ship_to_city: z.string().nullable().optional(),
    ship_to_state: z.string().nullable().optional(),
    ship_to_zip: z.string().nullable().optional(),
    ship_via: z.string().nullable().optional(),
    payment_terms: z.string().nullable().optional(),
    assigned_to: z.string().nullable().optional(),
    executed: z.boolean().optional(),
  })
  .passthrough();

const commitmentInlinePatchSchema = z
  .object({
    number: z.string().trim().min(1).optional(),
    title: z.string().trim().min(1).optional(),
    status: z.string().optional(),
    // `description` and `executed` exist on both subcontracts and
    // purchase_orders, so the table can edit them inline for either type.
    description: z.string().nullable().optional(),
    executed: z.boolean().optional(),
  })
  .refine(
    (data) => Object.keys(data).length > 0,
    "At least one editable field is required",
  );

/**
 * GET /api/commitments/[commitmentId]
 *
 * Retrieves complete details for a single commitment including:
 * - Base record data (from subcontracts or purchase_orders table)
 * - Contract company information (joined from companies table)
 * - Financial totals from the *_with_totals view
 * - SOV line items ordered by line_number
 * - Change order totals aggregated by status (approved, pending, draft, void)
 * - Calculated revised contract amount (original + approved change orders)
 *
 * The commitment type is first resolved from the `commitments_unified` view
 * to determine which underlying table to query.
 *
 * @route GET /api/commitments/[commitmentId]
 * @param {string} commitmentId - Commitment UUID
 *
 * @returns {object} 200 - Full commitment details with nested data:
 *   { data: { ...commitment, type, original_amount, approved_change_orders,
 *     revised_contract_amount, billed_to_date, balance_to_finish,
 *     line_items, change_order_totals } }
 * @returns {object} 404 - Commitment not found
 * @returns {object} 400 - Database query error
 * @returns {object} 500 - Internal server error
 */
export const GET = withApiGuardrails<{ commitmentId: string }>(
  "commitments/[commitmentId]#GET",
  async ({ request, params }) => {
  
    const { commitmentId } = await params;
    assertNonNilUuid(commitmentId, "commitmentId", "commitments/[commitmentId]#GET");
    const supabase = await createClient();
    const user = await getApiRouteUser();

    if (!user) {
      throw new GuardrailError({
        code: "AUTH_EXPIRED",
        where: "commitments/[commitmentId]#GET",
        message: "Authentication required.",
      });
    }

    // Determine type from unified view
    const { data: unifiedData, error: unifiedError } = await supabase
      .from("commitments_unified")
      .select("commitment_type, status")
      .eq("id", commitmentId)
      .single();

    if (unifiedError || !unifiedData) {
      return NextResponse.json(
        { error: "Commitment not found" },
        { status: 404 },
      );
    }

    const isSubcontract = unifiedData.commitment_type === "subcontract";
    const subcontractBaseSelect = `
      id, project_id, contract_number, title, description, status, executed,
      contract_company_id, start_date, estimated_completion_date,
      actual_completion_date, contract_date, signed_contract_received_date,
      issued_on_date, default_retainage_percent,
      is_private, non_admin_user_ids, allow_non_admin_view_sov_items,
      invoice_contact_ids, created_by, created_at, updated_at, deleted_at,
      inclusions, exclusions
    `;
    const purchaseOrderBaseSelect = `
      id, project_id, contract_number, title, description, status, executed,
      contract_company_id, contract_date, delivery_date, signed_po_received_date,
      issued_on_date, default_retainage_percent, accounting_method,
      is_private, non_admin_user_ids, allow_non_admin_view_sov_items,
      invoice_contact_ids, created_by, created_at, updated_at, deleted_at,
      bill_to, ship_to, ship_via, payment_terms, assigned_to,
      bill_to_company_id, bill_to_contact_id, bill_to_address, bill_to_address_line2, bill_to_city, bill_to_state, bill_to_zip,
      ship_to_company_id, ship_to_contact_id, ship_to_address, ship_to_address_line2, ship_to_city, ship_to_state, ship_to_zip
    `;

    // Performance optimization: Run all detail queries in parallel
    // instead of sequentially (Phase 9)
    const [baseResult, totalsResult, sovResult, coResult] = isSubcontract
      ? await Promise.all([
          // Fetch base record with company join (select needed columns only)
          supabase
            .from("subcontracts")
            .select(subcontractBaseSelect)
            .eq("id", commitmentId)
            .single(),

          // Fetch financial totals from _with_totals view
          supabase
            .from("subcontracts_with_totals")
            .select(
              "total_sov_amount, total_billed_to_date, total_amount_remaining, sov_line_count",
            )
            .eq("id", commitmentId)
            .single(),

          // Fetch SOV line items (select needed columns)
          supabase
            .from("subcontract_sov_items")
            .select(
              "id, line_number, budget_code, project_budget_code_id, description, amount, quantity, unit_of_measure, unit_cost, billed_to_date, sort_order",
            )
            .eq("subcontract_id", commitmentId)
            .order("line_number", { ascending: true }),

          // Fetch change order totals by status (only need status + amount)
          supabase
            .from("contract_change_orders")
            .select("status, amount")
            .eq("contract_id", commitmentId),
        ])
      : await Promise.all([
          // Fetch base record with company join (select needed columns only)
          supabase
            .from("purchase_orders")
            .select(purchaseOrderBaseSelect)
            .eq("id", commitmentId)
            .single(),

          // Fetch financial totals from _with_totals view
          supabase
            .from("purchase_orders_with_totals")
            .select(
              "total_sov_amount, total_billed_to_date, total_amount_remaining, sov_line_count",
            )
            .eq("id", commitmentId)
            .single(),

          // Fetch SOV line items (select needed columns)
          supabase
            .from("purchase_order_sov_items")
            .select(
              "id, line_number, budget_code, project_budget_code_id, description, amount, quantity, uom, unit_cost, billed_to_date, sort_order",
            )
            .eq("purchase_order_id", commitmentId)
            .order("line_number", { ascending: true }),

          // Fetch change order totals by status (only need status + amount)
          supabase
            .from("contract_change_orders")
            .select("status, amount")
            .eq("contract_id", commitmentId),
        ]);

    const { data, error } = baseResult;
    const { data: totalsData } = totalsResult;
    const { data: sovItems } = sovResult;
    const { data: changeOrders } = coResult;

    if (error) {
      logger.error({ msg: "[commitments/[commitmentId] GET] base query error", error: error.message, code: error.code });
      if (error.code === "PGRST116") {
        return NextResponse.json(
          { error: "Commitment not found" },
          { status: 404 },
        );
      }
      return apiErrorResponse(error);
    }

    // Calculate change order totals by status
    const changeOrderTotals = {
      approved: 0,
      pending: 0,
      draft: 0,
      executed: 0,
      void: 0,
      total: 0,
    };

    if (changeOrders && changeOrders.length > 0) {
      for (const co of changeOrders) {
        const amount = Number(co.amount) || 0;
        const status = (co.status || "draft").toLowerCase();
        changeOrderTotals.total += amount;

        if (status === "approved" || status === "executed") {
          changeOrderTotals.approved += amount;
        } else if (status === "pending") {
          changeOrderTotals.pending += amount;
        } else if (status === "draft") {
          changeOrderTotals.draft += amount;
        } else if (status === "void") {
          changeOrderTotals.void += amount;
        }
      }
    }

    // Fetch contract company — contract_company_id FK references companies(id)
    const record = data as Record<string, unknown>;
    let contractCompany: {
      id: string;
      name: string;
      type: string | null;
      license_number: string | null;
    } | null = null;
    if (record?.contract_company_id) {
      const { data: companyData } = await supabase
        .from("companies")
        .select("id, name, license_number")
        .eq("id", record.contract_company_id as string)
        .single();
      if (companyData) {
        contractCompany = {
          id: companyData.id,
          name: companyData.name,
          type: "vendor",
          license_number: companyData.license_number ?? null,
        };
      }
    }

    // Fetch invoice contacts from people table
    const invoiceContactIds = Array.isArray(record.invoice_contact_ids)
      ? (record.invoice_contact_ids as string[])
      : [];
    let invoiceContacts: Array<{ id: string; name: string }> = [];
    if (invoiceContactIds.length > 0) {
      const { data: peopleData } = await (supabase as any)
        .from("people")
        .select("id, first_name, last_name")
        .in("id", invoiceContactIds);
      if (peopleData) {
        invoiceContacts = (peopleData as Array<{ id: string; first_name: string | null; last_name: string | null }>).map((p) => ({
          id: p.id,
          name: [p.first_name, p.last_name].filter(Boolean).join(" ") || "Unknown",
        }));
      }
    }

    // Resolve created_by UUID → display name via people.auth_user_id
    let createdByName: string | null = null;
    const createdByUuid = typeof record.created_by === "string" ? record.created_by : null;
    if (createdByUuid) {
      const { data: creatorData } = await (supabase as any)
        .from("people")
        .select("first_name, last_name")
        .eq("auth_user_id", createdByUuid)
        .maybeSingle();
      if (creatorData) {
        createdByName =
          [creatorData.first_name, creatorData.last_name].filter(Boolean).join(" ") || null;
      }
    }

    // Resolve assigned_to (people.id) → display name for POs
    let assignedToName: string | null = null;
    const assignedToId = typeof record.assigned_to === "string" ? record.assigned_to : null;
    if (assignedToId) {
      const { data: assigneeData } = await supabase
        .from("people")
        .select("first_name, last_name")
        .eq("id", assignedToId)
        .maybeSingle();
      if (assigneeData) {
        assignedToName =
          [assigneeData.first_name, assigneeData.last_name].filter(Boolean).join(" ") || null;
      }
    }

    const originalAmount = Number(totalsData?.total_sov_amount) || 0;
    const billedToDate = Number(totalsData?.total_billed_to_date) || 0;
    // Revised amount = original + approved change orders
    const revisedAmount = originalAmount + changeOrderTotals.approved;
    const balanceToFinish = revisedAmount - billedToDate;

    const sovLock = await getCommitmentSovLockStateForCommitment(supabase, {
      commitmentId,
      commitmentType: isSubcontract ? "subcontract" : "purchase_order",
    });

    const responseData = {
      ...data,
      contract_company: contractCompany,
      type: unifiedData.commitment_type,
      // Normalize date field names across subcontracts and purchase orders.
      signed_received_date:
        (data as Record<string, unknown>).signed_contract_received_date ??
        (data as Record<string, unknown>).signed_po_received_date ??
        null,
      original_amount: originalAmount,
      approved_change_orders: changeOrderTotals.approved,
      pending_change_orders: changeOrderTotals.pending,
      draft_change_orders: changeOrderTotals.draft,
      revised_contract_amount: revisedAmount,
      billed_to_date: billedToDate,
      balance_to_finish: balanceToFinish,
      sov_line_count: Number(totalsData?.sov_line_count) || 0,
      line_items: sovItems || [],
      change_order_totals: changeOrderTotals,
      invoice_contacts: invoiceContacts,
      created_by_name: createdByName,
      assigned_to_name: assignedToName,
      sov_lock: sovLock,
    };

    // Add cache headers for detail data (5 seconds, revalidate in background)
    return NextResponse.json({ data: responseData }, {
      headers: {
        "Cache-Control": "private, max-age=5, stale-while-revalidate=30",
      },
    });
    },
);

/**
 * PUT /api/commitments/[commitmentId]
 *
 * Updates an existing commitment. Validates the request body against the
 * commitmentSchema (Zod). The commitment type is resolved from the
 * `commitments_unified` view and the appropriate table (subcontracts or
 * purchase_orders) is updated.
 *
 * @route PUT /api/commitments/[commitmentId]
 * @param {string} commitmentId - Commitment UUID
 *
 * @requestBody {object} - Partial commitment fields validated by commitmentSchema.
 *   Fields include: title, status, description, contract_company_id,
 *   start_date, estimated_completion_date, default_retainage_percent, etc.
 *
 * @returns {object} 200 - Updated commitment with company and assignee joins
 * @returns {object} 400 - Validation error (Zod) or database error
 * @returns {object} 401 - Unauthorized (no user session)
 * @returns {object} 404 - Commitment not found
 * @returns {object} 500 - Internal server error
 */
export const PUT = withApiGuardrails<{ commitmentId: string }>(
  "commitments/[commitmentId]#PUT",
  async ({ request, params }) => {
    const { commitmentId } = await params;
    // Guard: reject the nil UUID before hitting the DB. This happens when a
    // caller fires the mutation before the real commitment id has loaded.
    // Surfaced via telemetry: 22 events of PUT with the nil UUID.
    assertNonNilUuid(commitmentId, "commitmentId", "commitments/[commitmentId]#PUT");

    const supabase = await createClient();

    // Auth check FIRST — before parsing the request body. An unauthenticated
    // request with an empty body must return 401, not 500 from a JSON parse
    // error. Issue surfaced via api-smoke-contracts.mjs PR gate.
    const user = await getApiRouteUser();
    if (!user) {
      throw new GuardrailError({
        code: "UNAUTHORIZED",
        where: "commitments/[commitmentId]#PUT",
        message: "Authentication required.",
      });
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      throw new GuardrailError({
        code: "INVALID_PAYLOAD",
        where: "commitments/[commitmentId]#PUT",
        message: "Request body is not valid JSON.",
      });
    }

    // Validate request body against the form's actual payload shape
    const parsed = commitmentEditSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation error", issues: parsed.error.issues },
        { status: 400 },
      );
    }
    const validatedData = parsed.data;

    // Determine the commitment type from the unified view
    const { data: unifiedData, error: unifiedError } = await supabase
      .from("commitments_unified")
      .select("commitment_type, status")
      .eq("id", commitmentId)
      .single();

    if (unifiedError || !unifiedData) {
      return NextResponse.json(
        { error: "Commitment not found" },
        { status: 404 },
      );
    }

    // Approved commitments remain editable here — general fields (title, dates,
    // retainage, private/non-admin flags, etc.) can always be updated. Only SOV
    // line items stay locked once approved, enforced independently in
    // ScheduleOfValuesTab / the subcontractor-sov and PCO line-item routes.

    // Query the appropriate table based on type
    const tableName =
      unifiedData.commitment_type === "subcontract"
        ? "subcontracts"
        : "purchase_orders";
    const contractNumberPrefix =
      unifiedData.commitment_type === "subcontract" ? "SC-" : "PO-";

    // Build a safe update payload containing only columns that exist in both
    // subcontracts and purchase_orders. Undefined values are omitted so Supabase
    // does not overwrite existing data with NULL unintentionally.
    const updatePayload: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    const def = <T>(val: T | undefined | null, key: string) => {
      if (val !== undefined) updatePayload[key] = val;
    };

    if (validatedData.contract_number !== undefined) {
      updatePayload.contract_number = normalizeCommitmentContractNumber(
        validatedData.contract_number,
        contractNumberPrefix,
      );
    }
    def(validatedData.title, "title");
    def(validatedData.contract_company_id, "contract_company_id");
    if (validatedData.status !== undefined) {
      updatePayload.status =
        unifiedData.commitment_type === "subcontract"
          ? normalizeSubcontractStatus(validatedData.status)
          : validatedData.status;
    }
    def(validatedData.description, "description");
    def(validatedData.default_retainage_percent, "default_retainage_percent");
    def(validatedData.is_private, "is_private");
    def(validatedData.non_admin_user_ids, "non_admin_user_ids");
    def(validatedData.allow_non_admin_view_sov_items, "allow_non_admin_view_sov_items");
    def(validatedData.invoice_contact_ids, "invoice_contact_ids");
    def(validatedData.contract_date, "contract_date");
    def(validatedData.issued_on_date, "issued_on_date");
    // `executed` exists on both subcontracts and purchase_orders — apply for both types.
    // Previously this was inside the purchase_order-only block, silently dropping any
    // `executed` toggle made on a subcontract edit (field-loss bug).
    def(validatedData.executed, "executed");

    // Subcontract-only columns
    if (unifiedData.commitment_type === "subcontract") {
      def(validatedData.start_date, "start_date");
      def(validatedData.estimated_completion_date, "estimated_completion_date");
      def(validatedData.actual_completion_date, "actual_completion_date");
      def(validatedData.signed_contract_received_date, "signed_contract_received_date");
      def(validatedData.inclusions, "inclusions");
      def(validatedData.exclusions, "exclusions");
    }

    // Purchase-order-only columns
    // `accounting_method` is a PO-only column (not present on subcontracts table).
    if (unifiedData.commitment_type === "purchase_order") {
      def(validatedData.delivery_date, "delivery_date");
      def(validatedData.accounting_method, "accounting_method");
      def(validatedData.signed_po_received_date, "signed_po_received_date");
      def(validatedData.bill_to, "bill_to");
      def(validatedData.ship_to, "ship_to");
      def(validatedData.bill_to_company_id, "bill_to_company_id");
      def(validatedData.bill_to_contact_id, "bill_to_contact_id");
      def(validatedData.bill_to_address, "bill_to_address");
      def(validatedData.bill_to_address_line2, "bill_to_address_line2");
      def(validatedData.bill_to_city, "bill_to_city");
      def(validatedData.bill_to_state, "bill_to_state");
      def(validatedData.bill_to_zip, "bill_to_zip");
      def(validatedData.ship_to_company_id, "ship_to_company_id");
      def(validatedData.ship_to_contact_id, "ship_to_contact_id");
      def(validatedData.ship_to_address, "ship_to_address");
      def(validatedData.ship_to_address_line2, "ship_to_address_line2");
      def(validatedData.ship_to_city, "ship_to_city");
      def(validatedData.ship_to_state, "ship_to_state");
      def(validatedData.ship_to_zip, "ship_to_zip");
      def(validatedData.ship_via, "ship_via");
      def(validatedData.payment_terms, "payment_terms");
      def(validatedData.assigned_to, "assigned_to");
    }

    // Update commitment
    // Note: avoid PostgREST join syntax (companies!contract_company_id) — schema cache
    // doesn't have that relationship configured. The client re-fetches full details
    // via GET after a successful PUT, so a simple select(*) is sufficient here.
    const { data, error } = await supabase
      .from(tableName)
      .update(updatePayload)
      .eq("id", commitmentId)
      .select("*")
      .single();

    if (error) {
      return apiErrorResponse(error);
    }

    if (
      validatedData.company_license_number !== undefined &&
      validatedData.contract_company_id
    ) {
      const { error: companyUpdateError } = await supabase
        .from("companies")
        .update({
          license_number: validatedData.company_license_number,
          updated_at: new Date().toISOString(),
        })
        .eq("id", validatedData.contract_company_id);

      if (companyUpdateError) {
        return apiErrorResponse(companyUpdateError);
      }
    }

    // Update SOV line items (budget_code, description, amount) if provided.
    // The edit form sends sov_lines when the user modifies SOV fields — budget_code
    // lives on the SOV item, not on the subcontract/PO record itself.
    const rawBody = body && typeof body === "object" ? (body as Record<string, unknown>) : {};
    const sovLines = Array.isArray(rawBody.sov_lines)
      ? (rawBody.sov_lines as Array<{
          line_number: number;
          budget_code: string | null;
          project_budget_code_id?: string | null;
          projectBudgetCodeId?: string | null;
          description: string | null;
          amount: number;
        }>)
      : null;

    if (sovLines && sovLines.length > 0) {
      // Admins bypass the approved-status SOV lock — they can edit the schedule
      // of values even on an approved commitment (matches the client-side admin
      // bypass on the detail page and edit form). Non-admins stay locked.
      const isApprovedSovLocked =
        (unifiedData.status ?? "").trim().toLowerCase() === "approved" &&
        !(await getIsAdmin());
      if (isApprovedSovLocked) {
        throw new GuardrailError({
          code: "PRECONDITION_FAILED",
          where: "commitments/[commitmentId]#PUT",
          message:
            "Approved commitments have a locked schedule of values. Change the status before editing SOV line items.",
        });
      }

      const sovTable =
        unifiedData.commitment_type === "subcontract"
          ? "subcontract_sov_items"
          : "purchase_order_sov_items";
      const sovFk =
        unifiedData.commitment_type === "subcontract"
          ? "subcontract_id"
          : "purchase_order_id";
      const sovProjectId =
        data && typeof data === "object" && "project_id" in data
          ? Number((data as { project_id?: number | string }).project_id)
          : NaN;

      if (Number.isNaN(sovProjectId)) {
        throw new GuardrailError({
          code: "SCHEMA_MISMATCH",
          where: "commitments/[commitmentId]#PUT#sov-project-id",
          message: "Cannot update commitment SOV lines because the parent project_id could not be resolved.",
        });
      }

      const projectBudgetCodes = await fetchCommitmentSovProjectBudgetCodes(
        supabase,
        sovProjectId,
        "commitments/[commitmentId]#PUT",
      );

      for (const line of sovLines) {
        const resolvedBudgetCode = resolveCommitmentSovBudgetCodeFromLookup({
          budgetCodes: projectBudgetCodes,
          lineNumber: line.line_number,
          where: "commitments/[commitmentId]#PUT",
          submittedBudgetCode: line.budget_code,
          submittedProjectBudgetCodeId:
            line.project_budget_code_id ?? line.projectBudgetCodeId ?? null,
        });

        const { data: existing } = await supabase
          .from(sovTable as "subcontract_sov_items")
          .select("id")
          .eq(sovFk as "subcontract_id", commitmentId)
          .eq("line_number", line.line_number)
          .maybeSingle();

        if (existing) {
          await supabase
            .from(sovTable as "subcontract_sov_items")
            .update({
              budget_code: resolvedBudgetCode.displayBudgetCode,
              project_budget_code_id: resolvedBudgetCode.projectBudgetCodeId,
              description: line.description,
              amount: line.amount,
            })
            .eq("id", existing.id);
        } else {
          if (unifiedData.commitment_type === "subcontract") {
            await supabase
              .from("subcontract_sov_items")
              .insert({
                subcontract_id: commitmentId,
                line_number: line.line_number,
                budget_code: resolvedBudgetCode.displayBudgetCode,
                project_budget_code_id: resolvedBudgetCode.projectBudgetCodeId,
                description: line.description,
                amount: line.amount,
              });
          } else {
            await supabase
              .from("purchase_order_sov_items")
              .insert({
                purchase_order_id: commitmentId,
                line_number: line.line_number,
                budget_code: resolvedBudgetCode.displayBudgetCode,
                project_budget_code_id: resolvedBudgetCode.projectBudgetCodeId,
                description: line.description,
                amount: line.amount,
              });
          }
        }
      }
    }

    return NextResponse.json({ data });
    },
);

/**
 * DELETE /api/commitments/[commitmentId]
 * Soft delete commitment (move to recycle bin by setting deleted_at timestamp)
 *
 * This performs a soft delete - the commitment is not permanently removed
 * and can be restored using POST /api/commitments/[commitmentId]/restore
 *
 * For permanent deletion, use DELETE /api/commitments/[commitmentId]/permanent-delete
 */
export const DELETE = withApiGuardrails<{ commitmentId: string }>(
  "commitments/[commitmentId]#DELETE",
  async ({ request, params }) => {

    const { commitmentId } = await params;
    assertNonNilUuid(commitmentId, "commitmentId", "commitments/[commitmentId]#DELETE");
    const supabase = await createClient();

    // Get the current user
    const user = await getApiRouteUser();
    if (!user) {
      throw new GuardrailError({ code: "UNAUTHORIZED", where: "commitments/[commitmentId]#DELETE", message: "Authentication required." });
    }

    // Determine the commitment type from the unified view
    const { data: unifiedData, error: unifiedError } = await supabase
      .from("commitments_unified")
      .select("commitment_type, deleted_at")
      .eq("id", commitmentId)
      .single();

    if (unifiedError || !unifiedData) {
      return NextResponse.json(
        { error: "COMMITMENT_NOT_FOUND", message: "Commitment does not exist" },
        { status: 404 },
      );
    }

    // Check if already soft-deleted
    if (unifiedData.deleted_at) {
      return NextResponse.json(
        {
          error: "ALREADY_DELETED",
          message: "Commitment is already deleted",
        },
        { status: 400 },
      );
    }

    // Query the appropriate table based on type
    const tableName =
      unifiedData.commitment_type === "subcontract"
        ? "subcontracts"
        : "purchase_orders";
    const contractNumberPrefix =
      unifiedData.commitment_type === "subcontract" ? "SC-" : "PO-";

    // Soft delete commitment (set deleted_at timestamp)
    const deletedAt = new Date().toISOString();
    const { error } = await supabase
      .from(tableName)
      .update({
        deleted_at: deletedAt,
        updated_at: deletedAt,
      })
      .eq("id", commitmentId);

    if (error) {
      return apiErrorResponse(error);
    }

    // Return response matching API specification
    return NextResponse.json({
      success: true,
      message: "Commitment moved to recycle bin",
      data: {
        id: commitmentId,
        deletedAt,
        canRestore: true,
      },
    });
    },
);

/**
 * PATCH /api/commitments/[commitmentId]
 *
 * Lightweight partial update endpoint used by inline editing in list views.
 * Supports the safe per-cell editable fields: number, title, status,
 * description, executed. Derived/financial fields (amounts, change-order
 * rollups) are intentionally excluded — edit those via the SOV / full editor.
 */
export const PATCH = withApiGuardrails<{ commitmentId: string }>(
  "commitments/[commitmentId]#PATCH",
  async ({ request, params }) => {
    const { commitmentId } = await params;
    assertNonNilUuid(commitmentId, "commitmentId", "commitments/[commitmentId]#PATCH");
    const supabase = await createClient();

    // Auth check FIRST — see PUT handler comment.
    const user = await getApiRouteUser();
    if (!user) {
      throw new GuardrailError({
        code: "UNAUTHORIZED",
        where: "commitments/[commitmentId]#PATCH",
        message: "Authentication required.",
      });
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      throw new GuardrailError({
        code: "INVALID_PAYLOAD",
        where: "commitments/[commitmentId]#PATCH",
        message: "Request body is not valid JSON.",
      });
    }
    const parsed = commitmentInlinePatchSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          error: parsed.error.issues[0]?.message ?? "Validation error",
          issues: parsed.error.issues,
        },
        { status: 400 },
      );
    }

    const { data: unifiedData, error: unifiedError } = await supabase
      .from("commitments_unified")
      .select("commitment_type, status")
      .eq("id", commitmentId)
      .single();

    if (unifiedError || !unifiedData) {
      return NextResponse.json({ error: "Commitment not found" }, { status: 404 });
    }

    const tableName =
      unifiedData.commitment_type === "subcontract"
        ? "subcontracts"
        : "purchase_orders";
    const contractNumberPrefix =
      unifiedData.commitment_type === "subcontract" ? "SC-" : "PO-";

    const updatePayload: Record<string, string | boolean | null> = {
      updated_at: new Date().toISOString(),
    };
    if (parsed.data.number !== undefined) {
      updatePayload.contract_number = normalizeCommitmentContractNumber(
        parsed.data.number,
        contractNumberPrefix,
      );
    }
    if (parsed.data.title !== undefined) {
      updatePayload.title = parsed.data.title;
    }
    if (parsed.data.status !== undefined) {
      // Both subcontracts and purchase_orders share the same DB check constraint:
      // CHECK (status IN ('Draft','Out for Bid','Out for Signature','Approved','Complete','Terminated'))
      // The inline dropdown sends lowercase snake_case values (e.g. "approved", "out_for_bid").
      // Always normalize via normalizeSubcontractStatus so the stored value satisfies the constraint.
      updatePayload.status = normalizeSubcontractStatus(parsed.data.status);
    }
    if (parsed.data.description !== undefined) {
      updatePayload.description = parsed.data.description;
    }
    if (parsed.data.executed !== undefined) {
      updatePayload.executed = parsed.data.executed;
    }

    const { data, error } = await supabase
      .from(tableName)
      .update(updatePayload)
      .eq("id", commitmentId)
      .select("id, contract_number, title, status, description, executed, updated_at")
      .single();

    if (error) {
      return apiErrorResponse(error);
    }

    return NextResponse.json({
      data: {
        id: data.id,
        number: data.contract_number,
        title: data.title,
        status: data.status,
        description: data.description,
        executed: data.executed,
        updated_at: data.updated_at,
      },
    });
    },
);
