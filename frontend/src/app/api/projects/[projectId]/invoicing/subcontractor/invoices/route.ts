import { withApiGuardrails } from "@/lib/guardrails/api";
import { GuardrailError } from "@/lib/guardrails/errors";
import { NextResponse } from "next/server";
import { createClient, getApiRouteUser } from "@/lib/supabase/server";
import { apiErrorResponse } from "@/lib/api-error";

const ACTIVE_RETAINAGE_STATUSES = [
  "draft",
  "under_review",
  "approved",
  "approved_as_noted",
  "pending_owner_approval",
  "paid",
  "revise_and_resubmit",
] as const;

type ReleaseLineSeed = {
  description: string | null;
  budget_code: string | null;
  scheduled_value: number;
  work_completed_previous: number;
  work_completed_period: number;
  materials_stored: number;
  retainage_pct: number;
  retainage_amount: number;
  materials_retainage_pct: number;
  materials_retainage_amount: number;
  previous_work_retainage: number;
  previous_materials_retainage: number;
  work_retainage_released: number;
  materials_retainage_released: number;
  retainage_released: number;
  work_completed_pct: number;
  sort_order: number;
};

function num(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function roundCurrency(value: number): number {
  return Math.round(value * 100) / 100;
}

function lineKey(input: {
  sort_order?: number | null;
  line_number?: number | null;
  budget_code?: string | null;
  description?: string | null;
}): string {
  const order = input.sort_order ?? input.line_number;
  if (order != null && Number.isFinite(Number(order))) {
    return `order:${Number(order)}`;
  }
  return `text:${input.budget_code ?? ""}:${input.description ?? ""}`.toLowerCase();
}

async function buildRetainageReleaseLineItems(args: {
  supabase: Awaited<ReturnType<typeof createClient>>;
  projectId: number;
  subcontractId?: string | null;
  purchaseOrderId?: string | null;
}): Promise<ReleaseLineSeed[]> {
  const { supabase, projectId, subcontractId, purchaseOrderId } = args;
  const contractId = subcontractId ?? purchaseOrderId;
  if (!contractId) return [];

  const isSubcontract = Boolean(subcontractId);
  const foreignKey = isSubcontract ? "subcontract_id" : "purchase_order_id";
  const sovResult = isSubcontract
    ? await supabase
        .from("subcontract_sov_items")
        .select("line_number, budget_code, description, amount, billed_to_date")
        .eq("subcontract_id", contractId)
        .order("line_number", { ascending: true })
    : await supabase
        .from("purchase_order_sov_items")
        .select(
          "line_number, sort_order, budget_code, description, amount, billed_to_date",
        )
        .eq("purchase_order_id", contractId)
        .order("line_number", { ascending: true });
  const sovRows = (sovResult.data ?? []) as Array<{
    line_number?: number | null;
    sort_order?: number | null;
    budget_code?: string | null;
    description?: string | null;
    amount?: number | null;
    billed_to_date?: number | null;
  }>;
  const sovError = sovResult.error;

  if (sovError) {
    throw new Error(
      `Failed to load commitment SOV for retainage release: ${sovError.message}`,
    );
  }

  const seedByKey = new Map<
    string,
    {
      description: string | null;
      budget_code: string | null;
      scheduled_value: number;
      sort_order: number;
      latest_completed: number;
      retained_work: number;
      retained_materials: number;
    }
  >();

  for (const row of sovRows) {
    const sortOrder = num(row.sort_order ?? row.line_number);
    seedByKey.set(lineKey(row), {
      description: row.description ?? null,
      budget_code: row.budget_code ?? null,
      scheduled_value: num(row.amount),
      sort_order: sortOrder,
      latest_completed: num(row.billed_to_date),
      retained_work: 0,
      retained_materials: 0,
    });
  }

  const { data: priorInvoices, error: priorError } = await supabase
    .from("subcontractor_invoices")
    .select(
      `
      id,
      created_at,
      status,
      subcontractor_invoice_line_items(
        sort_order,
        budget_code,
        description,
        scheduled_value,
        work_completed_previous,
        work_completed_period,
        materials_stored,
        total_completed_stored,
        retainage_amount,
        materials_retainage_amount,
        previous_work_retainage,
        previous_materials_retainage,
        work_retainage_released,
        materials_retainage_released
      )
      `,
    )
    .eq("project_id", projectId)
    .eq(foreignKey, contractId)
    .in("status", [...ACTIVE_RETAINAGE_STATUSES])
    .order("created_at", { ascending: true })
    .order("id", { ascending: true });

  if (priorError) {
    throw new Error(
      `Failed to load prior invoices for retainage release: ${priorError.message}`,
    );
  }

  for (const invoice of priorInvoices ?? []) {
    const lineItems = (invoice.subcontractor_invoice_line_items ?? []) as Array<
      Record<string, unknown>
    >;
    for (const line of lineItems) {
      const key = lineKey(line);
      const existing = seedByKey.get(key) ?? {
        description:
          typeof line.description === "string" ? line.description : null,
        budget_code:
          typeof line.budget_code === "string" ? line.budget_code : null,
        scheduled_value: num(line.scheduled_value),
        sort_order: num(line.sort_order),
        latest_completed: 0,
        retained_work: 0,
        retained_materials: 0,
      };

      const latestCompleted =
        num(line.total_completed_stored) ||
        num(line.work_completed_previous) +
          num(line.work_completed_period) +
          num(line.materials_stored);
      existing.latest_completed = latestCompleted;
      existing.retained_work = roundCurrency(
        num(line.previous_work_retainage) +
          num(line.retainage_amount) -
          num(line.work_retainage_released),
      );
      existing.retained_materials = roundCurrency(
        num(line.previous_materials_retainage) +
          num(line.materials_retainage_amount) -
          num(line.materials_retainage_released),
      );
      seedByKey.set(key, existing);
    }
  }

  return Array.from(seedByKey.values())
    .filter(
      (line) => line.retained_work > 0.005 || line.retained_materials > 0.005,
    )
    .map((line) => {
      const previousWorkRetainage = Math.max(
        roundCurrency(line.retained_work),
        0,
      );
      const previousMaterialsRetainage = Math.max(
        roundCurrency(line.retained_materials),
        0,
      );
      const totalReleased = previousWorkRetainage + previousMaterialsRetainage;
      const completed = Math.max(roundCurrency(line.latest_completed), 0);
      const scheduled = Math.max(roundCurrency(line.scheduled_value), 0);
      return {
        description: line.description,
        budget_code: line.budget_code,
        scheduled_value: scheduled,
        work_completed_previous: completed,
        work_completed_period: 0,
        materials_stored: 0,
        retainage_pct: 0,
        retainage_amount: 0,
        materials_retainage_pct: 0,
        materials_retainage_amount: 0,
        previous_work_retainage: previousWorkRetainage,
        previous_materials_retainage: previousMaterialsRetainage,
        work_retainage_released: previousWorkRetainage,
        materials_retainage_released: previousMaterialsRetainage,
        retainage_released: totalReleased,
        work_completed_pct: scheduled > 0 ? (completed / scheduled) * 100 : 0,
        sort_order: line.sort_order,
      };
    });
}

// GET /api/projects/[projectId]/invoicing/subcontractor/invoices
// List subcontractor invoices for a project with commitment and billing period joins
export const GET = withApiGuardrails<{ projectId: string }>(
  "projects/[projectId]/invoicing/subcontractor/invoices#GET",
  async ({ request, params }) => {
    const supabase = await createClient();
    const { projectId } = await params;

    const user = await getApiRouteUser();
    const authError = null as Error | null;

    if (authError) {
      return NextResponse.json(
        { error: "Authentication failed", details: authError.message },
        { status: 401 },
      );
    }

    if (!user) {
      throw new GuardrailError({
        code: "AUTH_EXPIRED",
        where: "projects/[projectId]/invoicing/subcontractor/invoices#GET",
        message: "Authentication required.",
      });
    }

    const projectIdNum = parseInt(projectId, 10);

    const { searchParams } = new URL(request.url);
    const billingPeriodId = searchParams.get("billing_period_id");
    const subcontractId = searchParams.get("subcontract_id");
    const purchaseOrderId = searchParams.get("purchase_order_id");
    const status = searchParams.get("status");

    let query = supabase
      .from("subcontractor_invoices")
      .select(
        `
        *,
        subcontracts(contract_number, title, contract_company_id),
        purchase_orders(contract_number, title, contract_company_id),
        billing_periods(name, start_date, end_date)
        `,
      )
      .eq("project_id", projectIdNum)
      .order("created_at", { ascending: false });

    if (billingPeriodId) {
      query = query.eq("billing_period_id", billingPeriodId);
    }
    if (subcontractId) {
      query = query.eq("subcontract_id", subcontractId);
    }
    if (purchaseOrderId) {
      query = query.eq("purchase_order_id", purchaseOrderId);
    }
    if (status) {
      const SUBCONTRACTOR_INVOICE_STATUSES = [
        "draft",
        "approved",
        "pending",
        "paid",
        "void",
        "under_review",
        "revise_and_resubmit",
        "not_invited",
        "invited",
        "approved_as_noted",
        "pending_owner_approval",
      ] as const;
      type SubcontractorInvoiceStatus =
        (typeof SUBCONTRACTOR_INVOICE_STATUSES)[number];
      if (
        !(SUBCONTRACTOR_INVOICE_STATUSES as readonly string[]).includes(status)
      ) {
        return NextResponse.json(
          {
            error: `Invalid status "${status}". Expected one of: ${SUBCONTRACTOR_INVOICE_STATUSES.join(", ")}.`,
          },
          { status: 400 },
        );
      }
      query = query.eq("status", status as SubcontractorInvoiceStatus);
    }

    const { data: invoices, error: invoicesError } = await query;

    if (invoicesError) {
      return NextResponse.json(
        {
          error: "Failed to fetch subcontractor invoices",
          details: invoicesError.message,
        },
        { status: 500 },
      );
    }

    const invoiceRows = invoices ?? [];
    const invoiceIds = invoiceRows.map((i) => i.id);

    // Batch: ERP (Acumatica AP bill) status for linked invoices, keyed by bill id.
    const apBillStatusById = new Map<number, string | null>();
    const apBillIds = Array.from(
      new Set(
        invoiceRows
          .map((i) => i.acumatica_ap_bill_id as number | null)
          .filter((id): id is number => id != null),
      ),
    );
    if (apBillIds.length > 0) {
      const { data: billRows } = await supabase
        .from("acumatica_ap_bills")
        .select("id, status")
        .in("id", apBillIds);
      for (const bill of billRows ?? []) {
        apBillStatusById.set(
          bill.id as number,
          (bill.status as string | null) ?? null,
        );
      }
    }

    // Batch: line items for all invoices
    const lineItemsByInvoice = new Map<
      number,
      Array<Record<string, unknown>>
    >();
    if (invoiceIds.length > 0) {
      const { data: liRows } = await supabase
        .from("subcontractor_invoice_line_items")
        .select(
          "invoice_id, work_completed_period, materials_stored, total_completed_stored, retainage_amount, materials_retainage_amount, net_amount_this_period, scheduled_value",
        )
        .in("invoice_id", invoiceIds);
      for (const li of liRows ?? []) {
        const arr = lineItemsByInvoice.get(li.invoice_id as number) ?? [];
        arr.push(li as Record<string, unknown>);
        lineItemsByInvoice.set(li.invoice_id as number, arr);
      }
    }

    // Batch: Acumatica AP check payments projected onto subcontractor invoices.
    const paymentsByInvoice = new Map<number, number>();
    if (invoiceIds.length > 0) {
      const { data: paymentRows, error: paymentsError } = await supabase
        .from("commitment_payments")
        .select("subcontractor_invoice_id, amount")
        .in("subcontractor_invoice_id", invoiceIds);

      if (paymentsError) {
        throw new GuardrailError({
          code: "INTERNAL_ERROR",
          where: "projects/[projectId]/invoicing/subcontractor/invoices#GET",
          message: "Failed to load Acumatica subcontractor payment records.",
          details: paymentsError.message,
          cause: paymentsError,
        });
      }

      for (const payment of paymentRows ?? []) {
        if (!payment.subcontractor_invoice_id) continue;
        paymentsByInvoice.set(
          payment.subcontractor_invoice_id,
          (paymentsByInvoice.get(payment.subcontractor_invoice_id) ?? 0) +
            (Number(payment.amount) || 0),
        );
      }
    }

    // Collect contract ids (subcontract or PO) + company ids
    const subIds = new Set<string>();
    const poIds = new Set<string>();
    const companyIds = new Set<string>();
    for (const inv of invoiceRows) {
      const sc = inv.subcontracts as {
        contract_company_id: string | null;
      } | null;
      const po = inv.purchase_orders as {
        contract_company_id: string | null;
      } | null;
      if (inv.subcontract_id) subIds.add(inv.subcontract_id as string);
      if (inv.purchase_order_id) poIds.add(inv.purchase_order_id as string);
      const cid = sc?.contract_company_id ?? po?.contract_company_id ?? null;
      if (cid) companyIds.add(cid);
    }

    // Batch: SOV items per contract
    const sovSumByContract = new Map<string, number>();
    if (subIds.size > 0) {
      const { data: sovRows } = await supabase
        .from("subcontract_sov_items")
        .select("subcontract_id, amount")
        .in("subcontract_id", Array.from(subIds));
      for (const r of sovRows ?? []) {
        const k = r.subcontract_id as string;
        sovSumByContract.set(
          k,
          (sovSumByContract.get(k) ?? 0) + (Number(r.amount) || 0),
        );
      }
    }
    if (poIds.size > 0) {
      const { data: poSovRows } = await supabase
        .from("purchase_order_sov_items")
        .select("purchase_order_id, amount")
        .in("purchase_order_id", Array.from(poIds));
      for (const r of poSovRows ?? []) {
        const k = r.purchase_order_id as string;
        sovSumByContract.set(
          k,
          (sovSumByContract.get(k) ?? 0) + (Number(r.amount) || 0),
        );
      }
    }

    // Batch: approved change orders per contract
    const coSumByContract = new Map<string, number>();
    if (subIds.size > 0 || poIds.size > 0) {
      const contractIds = [...subIds, ...poIds];
      const { data: coRows } = await supabase
        .from("contract_change_orders")
        .select("contract_id, amount, status")
        .in("contract_id", contractIds);
      for (const r of coRows ?? []) {
        if ((r.status ?? "").toLowerCase() !== "approved") continue;
        const k = r.contract_id as string;
        coSumByContract.set(
          k,
          (coSumByContract.get(k) ?? 0) + (Number(r.amount) || 0),
        );
      }
    }

    // Batch: companies
    const companyNameById = new Map<string, string>();
    if (companyIds.size > 0) {
      const { data: companyRows } = await supabase
        .from("companies")
        .select("id, name")
        .in("id", Array.from(companyIds));
      for (const c of companyRows ?? []) {
        companyNameById.set(c.id as string, (c.name as string) ?? "");
      }
    }

    // Flatten + enrich
    const enriched = invoiceRows.map((invoice) => {
      const sc = invoice.subcontracts as {
        contract_number: string | null;
        title: string | null;
        contract_company_id: string | null;
      } | null;
      const po = invoice.purchase_orders as {
        contract_number: string | null;
        title: string | null;
        contract_company_id: string | null;
      } | null;
      const bp = invoice.billing_periods as {
        name: string | null;
        start_date: string | null;
        end_date: string | null;
      } | null;

      const {
        subcontracts: _sc,
        purchase_orders: _po,
        billing_periods: _bp,
        ...invoiceData
      } = invoice;

      const lineItems = lineItemsByInvoice.get(invoice.id as number) ?? [];
      const num = (v: unknown) => Number(v) || 0;
      const grossAmount = lineItems.reduce(
        (s, li) => s + num(li.work_completed_period) + num(li.materials_stored),
        0,
      );
      const totalCompleted = lineItems.reduce(
        (s, li) => s + num(li.total_completed_stored),
        0,
      );
      const totalWorkRet = lineItems.reduce(
        (s, li) => s + num(li.retainage_amount),
        0,
      );
      const totalMatRet = lineItems.reduce(
        (s, li) => s + num(li.materials_retainage_amount),
        0,
      );
      const netAmount = lineItems.reduce(
        (s, li) => s + num(li.net_amount_this_period),
        0,
      );
      const totalRetainage = totalWorkRet + totalMatRet;

      const contractId =
        (invoice.subcontract_id as string | null) ??
        (invoice.purchase_order_id as string | null) ??
        null;
      const originalContractSum = contractId
        ? (sovSumByContract.get(contractId) ?? 0)
        : 0;
      const netChangeByCos = contractId
        ? (coSumByContract.get(contractId) ?? 0)
        : 0;
      const totalContractAmount = originalContractSum + netChangeByCos;
      const percentComplete =
        totalContractAmount > 0
          ? (totalCompleted / totalContractAmount) * 100
          : 0;

      const contractCompanyId =
        sc?.contract_company_id ?? po?.contract_company_id ?? null;

      const syncedPaidAmount = paymentsByInvoice.get(invoice.id as number) ?? 0;
      // Legacy fallback for manually marked paid invoices that predate Acumatica payment projection.
      const paidAmount =
        syncedPaidAmount > 0
          ? syncedPaidAmount
          : invoice.status === "paid"
            ? grossAmount - totalRetainage
            : 0;
      let paymentStatus: "unpaid" | "partially_paid" | "paid" = "unpaid";
      if (netAmount > 0 && paidAmount >= netAmount) {
        paymentStatus = "paid";
      } else if (paidAmount > 0) {
        paymentStatus = "partially_paid";
      }

      return {
        ...invoiceData,
        contract_number: sc?.contract_number ?? po?.contract_number ?? null,
        contract_title: sc?.title ?? po?.title ?? null,
        contract_company_id: contractCompanyId,
        contract_company_name: contractCompanyId
          ? (companyNameById.get(contractCompanyId) ?? null)
          : null,
        contract_type: invoice.subcontract_id
          ? "subcontract"
          : invoice.purchase_order_id
            ? "purchase_order"
            : null,
        billing_period_name: bp?.name ?? null,
        billing_period_start: bp?.start_date ?? null,
        billing_period_end: bp?.end_date ?? null,
        gross_amount: grossAmount,
        net_amount: netAmount,
        total_completed: totalCompleted,
        total_retainage: totalRetainage,
        paid_amount: paidAmount,
        original_contract_sum: originalContractSum,
        net_change_by_cos: netChangeByCos,
        total_contract_amount: totalContractAmount,
        percent_complete: percentComplete,
        // ERP status = the linked Acumatica AP bill's status (Open/Closed/Hold/…);
        // fall back to a sync signal when a ref exists without a resolvable bill.
        erp_status: (() => {
          const billId = invoice.acumatica_ap_bill_id as number | null;
          const billStatus =
            billId != null ? apBillStatusById.get(billId) : null;
          if (billStatus) return billStatus;
          if (invoice.acumatica_ref_nbr || invoice.acumatica_sync_at)
            return "Synced";
          return null;
        })() as string | null,
        payment_status: paymentStatus,
      };
    });

    return NextResponse.json({ data: enriched });
  },
);

// POST /api/projects/[projectId]/invoicing/subcontractor/invoices
// Create a new subcontractor invoice for a project
export const POST = withApiGuardrails<{ projectId: string }>(
  "projects/[projectId]/invoicing/subcontractor/invoices#POST",
  async ({ request, params }) => {
    const supabase = await createClient();
    const { projectId } = await params;

    const user = await getApiRouteUser();
    const authError = null as Error | null;

    if (authError) {
      return NextResponse.json(
        { error: "Authentication failed", details: authError.message },
        { status: 401 },
      );
    }

    if (!user) {
      throw new GuardrailError({
        code: "AUTH_EXPIRED",
        where: "projects/[projectId]/invoicing/subcontractor/invoices#POST",
        message: "Authentication required.",
      });
    }

    const projectIdNum = parseInt(projectId, 10);
    const body = await request.json();
    const {
      subcontract_id,
      purchase_order_id,
      billing_period_id,
      invoice_number,
      period_start,
      period_end,
      billing_date,
      notes,
      status: statusRaw,
      line_items,
      is_retainage_release,
    } = body;

    const isRetainageRelease = is_retainage_release === true;

    // Validate status. Retainage release invoices start as Not Invited by
    // default because the subcontractor must be invited before they can submit.
    const allowedStatuses = ["draft", "under_review", "not_invited", "invited"];
    const status =
      statusRaw && allowedStatuses.includes(statusRaw)
        ? statusRaw
        : isRetainageRelease
          ? "not_invited"
          : "draft";

    // Exactly one of subcontract_id or purchase_order_id is required
    if (!subcontract_id && !purchase_order_id) {
      return NextResponse.json(
        { error: "Either subcontract_id or purchase_order_id is required" },
        { status: 400 },
      );
    }
    if (subcontract_id && purchase_order_id) {
      return NextResponse.json(
        {
          error: "Provide either subcontract_id or purchase_order_id, not both",
        },
        { status: 400 },
      );
    }

    // Verify the commitment belongs to this project and capture default retainage %
    let defaultRetainagePct = 0;
    if (subcontract_id) {
      const { data: sc, error: scError } = await supabase
        .from("subcontracts")
        .select("id, default_retainage_percent")
        .eq("id", subcontract_id)
        .eq("project_id", projectIdNum)
        .single();

      if (scError || !sc) {
        return NextResponse.json(
          { error: "Subcontract not found or does not belong to this project" },
          { status: 404 },
        );
      }
      defaultRetainagePct = Number(sc.default_retainage_percent) || 0;
    }

    if (purchase_order_id) {
      const { data: po, error: poError } = await supabase
        .from("purchase_orders")
        .select("id, default_retainage_percent")
        .eq("id", purchase_order_id)
        .eq("project_id", projectIdNum)
        .single();

      if (poError || !po) {
        return NextResponse.json(
          {
            error:
              "Purchase order not found or does not belong to this project",
          },
          { status: 404 },
        );
      }
      defaultRetainagePct = Number(po.default_retainage_percent) || 0;
    }

    let resolvedBillingPeriodId = billing_period_id ?? null;
    let resolvedPeriodStart = period_start ?? null;
    let resolvedPeriodEnd = period_end ?? null;
    let resolvedBillingDate =
      billing_date === "" ? null : (billing_date ?? null);

    if (!resolvedBillingPeriodId) {
      const { data: openPeriod, error: openPeriodError } = await supabase
        .from("billing_periods")
        .select("id, start_date, end_date")
        .eq("project_id", projectIdNum)
        .eq("is_closed", false)
        .maybeSingle();

      if (openPeriodError) {
        return NextResponse.json(
          {
            error:
              "The current billing period could not be resolved. No invoice was created.",
            details: openPeriodError.message,
          },
          { status: 500 },
        );
      }

      if (!openPeriod) {
        return NextResponse.json(
          {
            error:
              "No billing period is open for this project. Open or create a billing period before creating an invoice.",
            details:
              "No subcontractor invoice was created because an open billing period is required.",
          },
          { status: 409 },
        );
      }

      resolvedBillingPeriodId = openPeriod.id;
      resolvedPeriodStart = resolvedPeriodStart ?? openPeriod.start_date;
      resolvedPeriodEnd = resolvedPeriodEnd ?? openPeriod.end_date;
      resolvedBillingDate = resolvedBillingDate ?? openPeriod.end_date;
    }

    const { data: invoice, error: insertError } = await supabase
      .from("subcontractor_invoices")
      .insert({
        project_id: projectIdNum,
        subcontract_id: subcontract_id ?? null,
        purchase_order_id: purchase_order_id ?? null,
        billing_period_id: resolvedBillingPeriodId,
        invoice_number: invoice_number || null,
        period_start: resolvedPeriodStart,
        period_end: resolvedPeriodEnd,
        billing_date: resolvedBillingDate,
        notes: notes ?? null,
        status,
        is_retainage_release: isRetainageRelease,
      })
      .select()
      .single();

    if (insertError) {
      return NextResponse.json(
        {
          error: "Failed to create subcontractor invoice",
          details: insertError.message,
        },
        { status: 500 },
      );
    }

    // Auto-generate invoice number if none was supplied
    if (!invoice_number) {
      const contractForeignKey = subcontract_id
        ? "subcontract_id"
        : "purchase_order_id";
      const contractIdValue = subcontract_id ?? purchase_order_id;
      const { count: priorCount } = await supabase
        .from("subcontractor_invoices")
        .select("id", { count: "exact", head: true })
        .eq(contractForeignKey, contractIdValue)
        .lt("id", invoice.id);
      const appNum = (priorCount ?? 0) + 1;
      const generated = `APP-${String(appNum).padStart(2, "0")}`;
      await supabase
        .from("subcontractor_invoices")
        .update({ invoice_number: generated })
        .eq("id", invoice.id);
      invoice.invoice_number = generated;
    }

    const releaseLineItems =
      isRetainageRelease &&
      (!Array.isArray(line_items) || line_items.length === 0)
        ? await buildRetainageReleaseLineItems({
            supabase,
            projectId: projectIdNum,
            subcontractId: subcontract_id ?? null,
            purchaseOrderId: purchase_order_id ?? null,
          })
        : [];

    if (isRetainageRelease && releaseLineItems.length === 0) {
      await supabase
        .from("subcontractor_invoices")
        .delete()
        .eq("id", invoice.id);
      return NextResponse.json(
        {
          error: "No releasable retainage found",
          message:
            "A retainage release invoice can only be created after retainage has been withheld on at least one prior invoice.",
        },
        { status: 409 },
      );
    }

    // Insert line items if provided, or prefilled release rows when this is a
    // dedicated retainage release invoice.
    const effectiveLineItems =
      releaseLineItems.length > 0 ? releaseLineItems : line_items;
    if (Array.isArray(effectiveLineItems) && effectiveLineItems.length > 0) {
      const lineItemRows = effectiveLineItems.map(
        (
          item: {
            description: string;
            budget_code?: string | null;
            scheduled_value: number;
            work_completed_previous: number;
            work_completed_period: number;
            materials_stored: number;
            retainage_pct: number;
            retainage_amount?: number;
            materials_retainage_pct?: number;
            materials_retainage_amount?: number;
            previous_work_retainage?: number;
            previous_materials_retainage?: number;
            work_retainage_released?: number;
            materials_retainage_released?: number;
            retainage_released?: number;
            work_completed_pct?: number;
            sort_order?: number;
            line_item_type?: string | null;
            commitment_value?: number | null;
            change_value?: number | null;
          },
          index: number,
        ) => {
          const scheduled = Number(item.scheduled_value) || 0;
          const previous = Number(item.work_completed_previous) || 0;
          const thisPeriod = Number(item.work_completed_period) || 0;
          const stored = Number(item.materials_stored) || 0;
          // Fall back to commitment's default retainage % when caller doesn't supply one
          const retainagePct =
            item.retainage_pct != null
              ? Number(item.retainage_pct)
              : defaultRetainagePct;
          const materialsRetainagePct =
            item.materials_retainage_pct != null
              ? Number(item.materials_retainage_pct)
              : defaultRetainagePct;

          // Derived fields — total_completed_stored is GENERATED in Postgres, compute only for pct
          const totalCompletedStored = previous + thisPeriod + stored;
          const workCompletedPct =
            scheduled > 0 ? (totalCompletedStored / scheduled) * 100 : 0;
          // "Work Retainage This Period" applies ONLY to work billed this period.
          // Prior periods' retainage is tracked in previous_work_retainage separately.
          const retainageAmount =
            item.retainage_amount != null
              ? Number(item.retainage_amount) || 0
              : (thisPeriod * retainagePct) / 100;
          const materialsRetainageAmount =
            item.materials_retainage_amount != null
              ? Number(item.materials_retainage_amount) || 0
              : (stored * materialsRetainagePct) / 100;

          return {
            invoice_id: invoice.id,
            description: item.description,
            budget_code: item.budget_code ?? null,
            scheduled_value: scheduled,
            work_completed_previous: previous,
            work_completed_period: thisPeriod,
            materials_stored: stored,
            retainage_pct: retainagePct,
            retainage_amount: retainageAmount,
            materials_retainage_pct: materialsRetainagePct,
            materials_retainage_amount: materialsRetainageAmount,
            previous_work_retainage: Number(item.previous_work_retainage) || 0,
            previous_materials_retainage:
              Number(item.previous_materials_retainage) || 0,
            work_retainage_released: Number(item.work_retainage_released) || 0,
            materials_retainage_released:
              Number(item.materials_retainage_released) || 0,
            retainage_released: Number(item.retainage_released) || 0,
            line_item_type: item.line_item_type ?? null,
            commitment_value:
              item.commitment_value != null
                ? Number(item.commitment_value) || 0
                : null,
            change_value:
              item.change_value != null ? Number(item.change_value) || 0 : null,
            work_completed_pct:
              item.work_completed_pct != null
                ? Number(item.work_completed_pct) || 0
                : workCompletedPct,
            sort_order: item.sort_order ?? index,
          };
        },
      );

      const { error: lineItemsError } = await supabase
        .from("subcontractor_invoice_line_items")
        .insert(lineItemRows);

      if (lineItemsError) {
        await supabase
          .from("subcontractor_invoices")
          .delete()
          .eq("id", invoice.id);
        return NextResponse.json(
          {
            error: "Invoice created but failed to insert line items",
            details: lineItemsError.message,
          },
          { status: 500 },
        );
      }
    }

    return NextResponse.json({ data: invoice }, { status: 201 });
  },
);
