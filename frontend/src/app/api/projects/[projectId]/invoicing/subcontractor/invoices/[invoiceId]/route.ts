import { withApiGuardrails } from "@/lib/guardrails/api";
import { GuardrailError } from "@/lib/guardrails/errors";
import { NextResponse } from "next/server";
import { createClient, getApiRouteUser } from "@/lib/supabase/server";
import { apiErrorResponse } from "@/lib/api-error";
import {
  stampSubcontractorInvoiceStatusAuditActor,
  type SubcontractorInvoiceStatus,
} from "@/lib/invoicing/subcontractor-invoice-audit";
import { resolveGeneralContractorCompany } from "@/lib/invoicing/subcontractor-invoice-company";
import {
  computeSubcontractorRollup,
  type PaymentApplicationRollupLine,
} from "@/lib/invoicing/payment-application";

// GET /api/projects/[projectId]/invoicing/subcontractor/invoices/[invoiceId]
// Fetch a single subcontractor invoice with line items, commitment, and billing period joins
export const GET = withApiGuardrails<{ projectId: string; invoiceId: string }>(
  "projects/[projectId]/invoicing/subcontractor/invoices/[invoiceId]#GET",
  async ({ request, params }) => {
  
    const supabase = await createClient();
    const { projectId, invoiceId } = params;

    const user = await getApiRouteUser();
    const authError = null as Error | null;

    if (authError) {
      return NextResponse.json(
        { error: "Authentication failed", details: authError.message },
        { status: 401 },
      );
    }

    if (!user) {
      throw new GuardrailError({ code: "AUTH_EXPIRED", where: "projects/[projectId]/invoicing/subcontractor/invoices/[invoiceId]#GET", message: "Authentication required." });
    }

    const projectIdNum = parseInt(projectId, 10);
    const invoiceIdNum = parseInt(invoiceId, 10);

    const { data: invoice, error: invoiceError } = await supabase
      .from("subcontractor_invoices")
      .select(
        `
        *,
        subcontractor_invoice_line_items(*),
        subcontracts(contract_number, title, contract_company_id, default_retainage_percent, contract_date),
        purchase_orders(contract_number, title, contract_company_id, default_retainage_percent, contract_date),
        billing_periods(name, start_date, end_date)
        `,
      )
      .eq("id", invoiceIdNum)
      .eq("project_id", projectIdNum)
      .single();

    if (invoiceError) {
      if (invoiceError.code === "PGRST116") {
        return NextResponse.json(
          { error: "Invoice not found" },
          { status: 404 },
        );
      }
      return NextResponse.json(
        { error: "Failed to fetch invoice", details: invoiceError.message },
        { status: 500 },
      );
    }

    const sc = invoice.subcontracts as {
      contract_number: string | null;
      title: string | null;
      contract_company_id: string | null;
      default_retainage_percent: number | null;
      contract_date: string | null;
    } | null;
    const po = invoice.purchase_orders as {
      contract_number: string | null;
      title: string | null;
      contract_company_id: string | null;
      default_retainage_percent: number | null;
      contract_date: string | null;
    } | null;
    const bp = invoice.billing_periods as {
      name: string | null;
      start_date: string | null;
      end_date: string | null;
    } | null;

    const { subcontracts: _sc, purchase_orders: _po, billing_periods: _bp, subcontractor_invoice_line_items: _rawLineItems, ...invoiceData } = invoice;

    // ----- Application-for-Payment rollup -----
    // Compute the 9-line AIA G702-style header totals from source data so the
    // detail page can render them without duplicating the math client-side.
    const contractId = invoice.subcontract_id ?? invoice.purchase_order_id ?? null;

    // Original contract sum = sum of commitment SOV items
    let originalContractSum = 0;
    if (contractId) {
      const sovTable = invoice.subcontract_id
        ? "subcontract_sov_items"
        : "purchase_order_sov_items";
      const sovForeignKey = invoice.subcontract_id
        ? "subcontract_id"
        : "purchase_order_id";
      const { data: sovRows } = await supabase
        .from(sovTable)
        .select("amount")
        .eq(sovForeignKey, contractId);
      originalContractSum = (sovRows ?? []).reduce(
        (sum, row) => sum + (Number(row.amount) || 0),
        0,
      );
    }

    // Net change by approved change orders on this commitment
    let netChangeByChangeOrders = 0;
    if (contractId) {
      const { data: coRows } = await supabase
        .from("contract_change_orders")
        .select("amount, status")
        .eq("contract_id", contractId);
      netChangeByChangeOrders = (coRows ?? [])
        .filter((co) => (co.status ?? "").toLowerCase() === "approved")
        .reduce((sum, co) => sum + (Number(co.amount) || 0), 0);
    }

    // Enrich line items with SOV data (budget_code, commitment_value, change_value)
    const rawLineItems = (invoice.subcontractor_invoice_line_items ?? []) as Array<Record<string, unknown>>;
    let sovItems: Array<{
      sort_order: number | null;
      budget_code: string | null;
      description: string | null;
      amount: number | null;
    }> = [];
    if (contractId) {
      const sovResult = invoice.subcontract_id
        ? await supabase
            .from("subcontract_sov_items")
            .select("line_number, budget_code, description, amount")
            .eq("subcontract_id", contractId)
            .order("line_number", { ascending: true })
        : await supabase
            .from("purchase_order_sov_items")
            .select("sort_order, line_number, budget_code, description, amount")
            .eq("purchase_order_id", contractId)
            .order("line_number", { ascending: true });
      const sov = (sovResult.data ?? []) as Array<{
        sort_order?: number | null;
        line_number?: number | null;
        budget_code?: string | null;
        description?: string | null;
        amount?: number | null;
      }>;
      sovItems = sov.map((row) => ({
        sort_order: Number(row.sort_order ?? row.line_number ?? 0),
        budget_code: row.budget_code ?? null,
        description: row.description ?? null,
        amount: row.amount ?? null,
      }));
    }
    // Map SOV items by sort_order for fast lookup
    const sovBySort = new Map(
      sovItems.map((s) => [s.sort_order, s]),
    );
    const enrichedLineItems = rawLineItems.map((li) => {
      const sortOrder = Number(li.sort_order) || 0;
      const sovMatch = sovBySort.get(sortOrder);
      const storedLineItemType =
        typeof li.line_item_type === "string" ? li.line_item_type : null;
      const isChangeOrderLine =
        storedLineItemType?.toLowerCase().includes("change") ?? false;
      const commitmentValue = isChangeOrderLine
        ? Number(li.commitment_value ?? 0) || 0
        : sovMatch
          ? (Number(sovMatch.amount) || 0)
          : null;
      const scheduledValue = Number(li.scheduled_value) || 0;
      const changeValue = isChangeOrderLine
        ? Number(li.change_value ?? scheduledValue) || 0
        : commitmentValue != null
          ? scheduledValue - commitmentValue
          : null;
      const workPrev = Number(li.work_completed_previous) || 0;
      const workPrevPct = scheduledValue > 0 ? (workPrev / scheduledValue) * 100 : 0;
      return {
        ...li,
        budget_code:
          sovMatch?.budget_code ??
          (typeof li.budget_code === "string" ? li.budget_code : null),
        line_item_type: storedLineItemType ?? "SOV",
        commitment_value: commitmentValue,
        change_value: changeValue,
        work_completed_previous_pct: workPrevPct,
      };
    });

    // This invoice's per-line figures come straight from the DB generated columns.
    const lineItems = enrichedLineItems as unknown as PaymentApplicationRollupLine[];

    // Less previous certificates: sum of net_amount_this_period from approved
    // prior invoices on the same commitment (before this invoice's period_end).
    let lessPreviousCertificates = 0;
    if (contractId) {
      const foreignKey = invoice.subcontract_id
        ? "subcontract_id"
        : "purchase_order_id";
      const { data: priorInvoices } = await supabase
        .from("subcontractor_invoices")
        .select(
          "id, status, period_end, subcontractor_invoice_line_items(net_amount_this_period)",
        )
        .eq(foreignKey, contractId)
        .neq("id", invoiceIdNum)
        .in("status", ["approved", "approved_as_noted", "paid"]);
      for (const prior of priorInvoices ?? []) {
        // Only count invoices with an earlier or equal period end
        if (
          invoice.period_end &&
          prior.period_end &&
          prior.period_end > invoice.period_end
        ) {
          continue;
        }
        const priorLines = (prior.subcontractor_invoice_line_items ?? []) as Array<{
          net_amount_this_period: number | null;
        }>;
        lessPreviousCertificates += priorLines.reduce(
          (sum, li) => sum + (Number(li.net_amount_this_period) || 0),
          0,
        );
      }
    }

    // The AIA G702 rollup is owned by the payment-application module.
    const rollup = computeSubcontractorRollup({
      lineItems,
      original_contract_sum: originalContractSum,
      net_change_by_change_orders: netChangeByChangeOrders,
      less_previous_certificates: lessPreviousCertificates,
      is_retainage_release: Boolean(invoice.is_retainage_release),
    });

    // Tab badge counts (single round-trip using head+count)
    const [
      { count: relatedCount },
      { count: emailCount },
      { count: historyCount },
    ] = await Promise.all([
      supabase
        .from("subcontractor_invoice_related_items")
        .select("id", { count: "exact", head: true })
        .eq("invoice_id", invoiceIdNum),
      supabase
        .from("subcontractor_invoice_emails")
        .select("id", { count: "exact", head: true })
        .eq("invoice_id", invoiceIdNum),
      supabase
        .from("subcontractor_invoice_audit_log")
        .select("id", { count: "exact", head: true })
        .eq("invoice_id", invoiceIdNum),
    ]);

    const tab_counts = {
      related_items: relatedCount ?? 0,
      emails: emailCount ?? 0,
      change_history: historyCount ?? 0,
    };

    // Resolve contract company (subcontractor) with full address
    const contractCompanyId =
      sc?.contract_company_id ?? po?.contract_company_id ?? null;
    let contractCompany: {
      name: string | null;
      address: string | null;
      city: string | null;
      state: string | null;
      zip_code: string | null;
    } | null = null;
    if (contractCompanyId) {
      const { data: company } = await supabase
        .from("companies")
        .select("name, address, city, state, zip_code")
        .eq("id", contractCompanyId)
        .maybeSingle();
      contractCompany = company ?? null;
    }

    // Fetch project info (name, number, address)
    const { data: project } = await supabase
      .from("projects")
      .select("name, project_number, address")
      .eq("id", projectIdNum)
      .maybeSingle();

    // The "General Contractor" on a subcontractor invoice is the GC issuing the
    // subcontract — Alleato — NEVER the project owner/client. `projects.company_id`
    // holds the OWNER (e.g. "Goodwill Industries" on project 754), so deriving the
    // GC from it mislabels the owner as the GC on the AIA G702 form. Always resolve
    // to Alleato (resolveGeneralContractorCompany(null) returns the Alleato identity).
    const resolvedGcCompany = resolveGeneralContractorCompany(null);

    // Contract date from subcontract or PO
    const contractDate = sc?.contract_date ?? po?.contract_date ?? null;

    // Change order breakdown: additions vs deductions
    let coAdditions = 0;
    let coDeductions = 0;
    if (contractId) {
      const { data: coRows } = await supabase
        .from("contract_change_orders")
        .select("amount, status")
        .eq("contract_id", contractId)
        .in("status", ["approved"]);
      for (const co of coRows ?? []) {
        const amt = Number(co.amount) || 0;
        if (amt >= 0) coAdditions += amt;
        else coDeductions += amt;
      }
    }

    const percentComplete =
      rollup.contract_sum_to_date > 0
        ? (rollup.total_completed_and_stored / rollup.contract_sum_to_date) * 100
        : 0;

    // Determine application number: count prior invoices on same commitment + 1
    let applicationNumber = 1;
    if (contractId) {
      const foreignKey = invoice.subcontract_id
        ? "subcontract_id"
        : "purchase_order_id";
      const { count: priorCount } = await supabase
        .from("subcontractor_invoices")
        .select("id", { count: "exact", head: true })
        .eq(foreignKey, contractId)
        .lt("created_at", invoice.created_at ?? new Date().toISOString());
      applicationNumber = (priorCount ?? 0) + 1;
    }

    // Back-fill invoice_number for legacy records that were created without one
    let resolvedInvoiceNumber = invoiceData.invoice_number as string | null;
    if (!resolvedInvoiceNumber) {
      resolvedInvoiceNumber = `APP-${String(applicationNumber).padStart(2, "0")}`;
      await supabase
        .from("subcontractor_invoices")
        .update({ invoice_number: resolvedInvoiceNumber })
        .eq("id", invoiceIdNum);
    }

    return NextResponse.json({
      data: {
        ...invoiceData,
        invoice_number: resolvedInvoiceNumber,
        subcontractor_invoice_line_items: enrichedLineItems,
        contract_number: sc?.contract_number ?? po?.contract_number ?? null,
        contract_title: sc?.title ?? po?.title ?? null,
        contract_company_id: contractCompanyId,
        contract_company_name: contractCompany?.name ?? null,
        contract_company_address: contractCompany?.address ?? null,
        contract_company_city: contractCompany?.city ?? null,
        contract_company_state: contractCompany?.state ?? null,
        contract_company_zip: contractCompany?.zip_code ?? null,
        contract_retainage_percent: sc?.default_retainage_percent ?? po?.default_retainage_percent ?? null,
        contract_date: contractDate as string | null,
        gc_company_name: resolvedGcCompany.name,
        gc_company_address: resolvedGcCompany.address,
        gc_company_city: resolvedGcCompany.city,
        gc_company_state: resolvedGcCompany.state,
        gc_company_zip: resolvedGcCompany.zip_code,
        project_name: project?.name ?? null,
        project_number: project?.project_number ?? null,
        project_address: project?.address ?? null,
        application_number: applicationNumber,
        percent_complete: percentComplete,
        billing_period_name: bp?.name ?? null,
        billing_period_start: bp?.start_date ?? null,
        billing_period_end: bp?.end_date ?? null,
        rollup,
        co_summary: {
          additions: coAdditions,
          deductions: coDeductions,
          net: coAdditions + coDeductions,
        },
        tab_counts,
      },
    });
    },
);

// PATCH /api/projects/[projectId]/invoicing/subcontractor/invoices/[invoiceId]
// Update a subcontractor invoice (only when status is draft, invited, or revise_and_resubmit)
export const PATCH = withApiGuardrails<{ projectId: string; invoiceId: string }>(
  "projects/[projectId]/invoicing/subcontractor/invoices/[invoiceId]#PATCH",
  async ({ request, params }) => {
  
    const supabase = await createClient();
    const { projectId, invoiceId } = params;

    const user = await getApiRouteUser();
    const authError = null as Error | null;

    if (authError) {
      return NextResponse.json(
        { error: "Authentication failed", details: authError.message },
        { status: 401 },
      );
    }

    if (!user) {
      throw new GuardrailError({ code: "AUTH_EXPIRED", where: "projects/[projectId]/invoicing/subcontractor/invoices/[invoiceId]#PATCH", message: "Authentication required." });
    }

    const projectIdNum = parseInt(projectId, 10);
    const invoiceIdNum = parseInt(invoiceId, 10);

    const body = await request.json();
    const allowedFields = [
      "invoice_number",
      "period_start",
      "period_end",
      "billing_date",
      "notes",
      "status",
    ];
    const updatePayload: Record<string, unknown> = {};
    for (const field of allowedFields) {
      if (field in body) {
        updatePayload[field] = body[field] === "" ? null : body[field];
      }
    }

    if (Object.keys(updatePayload).length === 0) {
      return NextResponse.json(
        { error: "No valid fields provided for update" },
        { status: 400 },
      );
    }

    // Verify the invoice exists and belongs to the project
    const { data: existing, error: fetchError } = await supabase
      .from("subcontractor_invoices")
      .select("id, status")
      .eq("id", invoiceIdNum)
      .eq("project_id", projectIdNum)
      .single();

    if (fetchError) {
      if (fetchError.code === "PGRST116") {
        return NextResponse.json(
          { error: "Invoice not found" },
          { status: 404 },
        );
      }
      return NextResponse.json(
        { error: "Failed to verify invoice", details: fetchError.message },
        { status: 500 },
      );
    }

    const editableStatuses = ["draft", "invited", "revise_and_resubmit"];
    if (!editableStatuses.includes(existing.status)) {
      return NextResponse.json(
        {
          error: "Cannot edit invoice",
          message: `Invoice status is '${existing.status}'. Only draft, invited, or revise-and-resubmit invoices can be edited.`,
        },
        { status: 400 },
      );
    }

    // Fetch current values for audit comparison (non-status fields)
    const { data: currentData } = await supabase
      .from("subcontractor_invoices")
      .select("invoice_number, period_start, period_end, billing_date, notes")
      .eq("id", invoiceIdNum)
      .single();

    const transitionStartedAt = new Date().toISOString();
    const { data: updated, error: updateError } = await supabase
      .from("subcontractor_invoices")
      .update(updatePayload)
      .eq("id", invoiceIdNum)
      .select()
      .single();

    if (updateError) {
      if (updateError.code === "42501") {
        return NextResponse.json(
          { error: "Permission denied" },
          { status: 403 },
        );
      }
      return NextResponse.json(
        { error: "Failed to update invoice", details: updateError.message },
        { status: 500 },
      );
    }

    const nextStatus =
      typeof updatePayload.status === "string"
        ? (updatePayload.status as SubcontractorInvoiceStatus)
        : null;

    if (nextStatus && nextStatus !== existing.status) {
      const auditStamp = await stampSubcontractorInvoiceStatusAuditActor({
        supabase,
        invoiceId: invoiceIdNum,
        fromStatus: existing.status,
        toStatus: nextStatus,
        transitionStartedAt,
        actor: user,
      });
      if (!auditStamp.ok) {
        throw new GuardrailError({
          code: "INTERNAL_ERROR",
          where: "projects/[projectId]/invoicing/subcontractor/invoices/[invoiceId]#PATCH",
          message: "Invoice status changed, but the audit actor could not be recorded.",
          details: { reason: auditStamp.reason },
        });
      }
    }

    // Log field-level edits to audit log.
    if (currentData) {
      const fieldsToLog = ["invoice_number", "period_start", "period_end", "billing_date", "notes"];
      const toJsonValue = (v: unknown): string | number | boolean | null =>
        v === undefined || v === null
          ? null
          : typeof v === "string" || typeof v === "number" || typeof v === "boolean"
            ? v
            : JSON.stringify(v);
      const auditRows = fieldsToLog
        .filter((f) => f in updatePayload && (currentData as Record<string, unknown>)[f] !== updatePayload[f])
        .map((f) => ({
          invoice_id: invoiceIdNum,
          event_type: "field.updated",
          field_name: f,
          old_value: toJsonValue((currentData as Record<string, unknown>)[f]),
          new_value: toJsonValue(updatePayload[f]),
          actor_user_id: user.id,
          actor_email: user.email ?? null,
          notes: `Updated ${f.replace(/_/g, " ")}`,
        }));
      if (auditRows.length > 0) {
        await supabase.from("subcontractor_invoice_audit_log").insert(auditRows);
      }
    }

    return NextResponse.json({ data: updated });
    },
);

// DELETE /api/projects/[projectId]/invoicing/subcontractor/invoices/[invoiceId]
// Delete a subcontractor invoice (blocked if status is approved or paid)
export const DELETE = withApiGuardrails<{ projectId: string; invoiceId: string }>(
  "projects/[projectId]/invoicing/subcontractor/invoices/[invoiceId]#DELETE",
  async ({ request, params }) => {
  
    const supabase = await createClient();
    const { projectId, invoiceId } = params;

    const user = await getApiRouteUser();
    const authError = null as Error | null;

    if (authError) {
      return NextResponse.json(
        { error: "Authentication failed", details: authError.message },
        { status: 401 },
      );
    }

    if (!user) {
      throw new GuardrailError({ code: "AUTH_EXPIRED", where: "projects/[projectId]/invoicing/subcontractor/invoices/[invoiceId]#DELETE", message: "Authentication required." });
    }

    const projectIdNum = parseInt(projectId, 10);
    const invoiceIdNum = parseInt(invoiceId, 10);

    const { data: invoice, error: fetchError } = await supabase
      .from("subcontractor_invoices")
      .select("id, status")
      .eq("id", invoiceIdNum)
      .eq("project_id", projectIdNum)
      .single();

    if (fetchError) {
      if (fetchError.code === "PGRST116") {
        return NextResponse.json(
          { error: "Invoice not found" },
          { status: 404 },
        );
      }
      return NextResponse.json(
        { error: "Failed to verify invoice", details: fetchError.message },
        { status: 500 },
      );
    }

    if (invoice.status === "approved" || invoice.status === "paid") {
      return NextResponse.json(
        {
          error: "Cannot delete approved or paid invoices",
          message: `Invoice status is '${invoice.status}'. Only draft, submitted, or void invoices can be deleted.`,
        },
        { status: 400 },
      );
    }

    const { error: deleteError } = await supabase
      .from("subcontractor_invoices")
      .delete()
      .eq("id", invoiceIdNum);

    if (deleteError) {
      if (deleteError.code === "42501") {
        return NextResponse.json(
          { error: "Permission denied" },
          { status: 403 },
        );
      }
      return NextResponse.json(
        { error: "Failed to delete invoice", details: deleteError.message },
        { status: 500 },
      );
    }

    return NextResponse.json({ message: "Invoice deleted successfully" });
    },
);
