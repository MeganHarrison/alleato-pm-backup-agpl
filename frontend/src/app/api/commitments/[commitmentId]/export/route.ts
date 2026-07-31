/**
 * =============================================================================
 * COMMITMENT EXPORT API ENDPOINT
 * =============================================================================
 *
 * Export commitment data to CSV, Excel, or PDF format
 * Supports various templates and options for SOV, change orders, and invoices
 */

import { withApiGuardrails } from "@/lib/guardrails/api";
import { GuardrailError } from "@/lib/guardrails/errors";
import { NextResponse } from "next/server";
import { createClient, getApiRouteUser } from "@/lib/supabase/server";

interface ExportParams {
  format: "csv" | "excel" | "pdf";
  template: "standard" | "financial" | "summary";
  include_sov_items: boolean;
  include_change_orders: boolean;
  include_invoices: boolean;
}

interface SovItem {
  id: string;
  line_number: number | null;
  description: string | null;
  budget_code: string | null;
  amount: number | null;
  billed_to_date: number | null;
  type: string | null;
}

interface CommitmentData {
  id: string;
  number: string;
  title: string;
  description: string | null;
  status: string;
  type: string;
  original_amount: number;
  approved_change_orders: number;
  revised_contract_amount: number;
  billed_to_date: number;
  balance_to_finish: number;
  retention_percentage: number | null;
  start_date: string | null;
  executed_date: string | null;
  substantial_completion_date: string | null;
  accounting_method: string | null;
  contract_date: string | null;
  payment_terms: string | null;
  delivery_date: string | null;
  bill_to: string | null;
  ship_to: string | null;
  issued_on_date: string | null;
  contract_company: {
    id?: string;
    name: string;
    address?: string | null;
    city?: string | null;
    state?: string | null;
  } | null;
  project: {
    id: number;
    name: string | null;
    project_number: string | null;
    address: string | null;
    state: string | null;
    company_id: string | null;
  } | null;
  project_company: {
    name: string;
    address?: string | null;
    city?: string | null;
    state?: string | null;
  } | null;
  vendor_contact: {
    name: string;
    phone: string | null;
    email: string | null;
  } | null;
  invoice_contact: {
    name: string;
    phone: string | null;
    email: string | null;
  } | null;
  created_by_name: string | null;
  line_items: SovItem[];
  created_at: string;
  updated_at: string;
}

/**
 * POST /api/commitments/[commitmentId]/export
 *
 * Exports a single commitment's data in CSV, Excel, or PDF format.
 * Supports multiple export templates (standard, financial, summary) and
 * configurable inclusion of SOV items, change orders, and invoices.
 *
 * - CSV: Returns text/csv with commitment details and optional SOV table
 * - Excel: Returns XLSX workbook with Summary sheet and optional SOV sheet
 * - PDF: Returns HTML document with print-ready layout (auto-triggers print dialog)
 *
 * @route POST /api/commitments/[commitmentId]/export
 * @param {string} commitmentId - Commitment UUID
 *
 * @requestBody {object}
 *   - format {string} [default="pdf"] - Export format: "csv", "excel", or "pdf"
 *   - template {string} [default="standard"] - Template: "standard", "financial", or "summary"
 *   - include_sov_items {boolean} [default=true] - Include SOV line items
 *   - include_change_orders {boolean} [default=true] - Include change orders
 *   - include_invoices {boolean} [default=false] - Include invoice data
 *
 * @returns {Blob} 200 - File download with appropriate Content-Type and Content-Disposition headers
 * @returns {object} 400 - Unsupported export format
 * @returns {object} 401 - Unauthorized (no user session)
 * @returns {object} 404 - Commitment not found
 * @returns {object} 500 - Export generation error
 */
export const POST = withApiGuardrails<{ commitmentId: string }>(
  "commitments/[commitmentId]/export#POST",
  async ({ request, params }) => {
  
    const { commitmentId } = await params;
    const supabase = await createClient();

    // Check authentication
    const user = await getApiRouteUser();

    if (!user) {
      throw new GuardrailError({ code: "AUTH_EXPIRED", where: "commitments/[commitmentId]/export#POST", message: "Authentication required." });
    }

    const body = await request.json();
    const exportParams: ExportParams = {
      format: body.format || "pdf",
      template: body.template || "standard",
      include_sov_items: body.include_sov_items !== false,
      include_change_orders: body.include_change_orders !== false,
      include_invoices: body.include_invoices === true,
    };

    // Fetch commitment data
    const commitmentData = await fetchCommitmentData(supabase, commitmentId);
    if (!commitmentData) {
      return NextResponse.json(
        { error: "Commitment not found" },
        { status: 404 }
      );
    }

    // Generate export based on format
    const baseFilename = `commitment-${commitmentData.number || commitmentId}`;
    const dateStr = new Date().toISOString().split("T")[0];

    if (exportParams.format === "csv") {
      const csv = generateCSV(commitmentData, exportParams);
      return new NextResponse(csv, {
        status: 200,
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="${baseFilename}-${dateStr}.csv"`,
        },
      });
    } else if (exportParams.format === "excel") {
      const excelBuffer = await generateExcel(commitmentData, exportParams);
      return new NextResponse(excelBuffer, {
        status: 200,
        headers: {
          "Content-Type":
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          "Content-Disposition": `attachment; filename="${baseFilename}-${dateStr}.xlsx"`,
        },
      });
    } else if (exportParams.format === "pdf") {
      const html = generatePDFHTML(commitmentData, exportParams);
      const { renderPdfFromHtml } = await import("@/lib/documents/pdf");
      const pdfBuffer = await renderPdfFromHtml(html);
      return new NextResponse(new Uint8Array(pdfBuffer), {
        status: 200,
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": `attachment; filename="${baseFilename}-${dateStr}.pdf"`,
        },
      });
    }

    return NextResponse.json(
      { error: "Unsupported export format" },
      { status: 400 }
    );
    },
);

// =============================================================================
// DATA FETCHING
// =============================================================================

async function fetchCommitmentData(
  supabase: Awaited<ReturnType<typeof createClient>>,
  id: string
): Promise<CommitmentData | null> {
  // Determine type from unified view
  const { data: unifiedData, error: unifiedError } = await supabase
    .from("commitments_unified")
    .select("commitment_type")
    .eq("id", id)
    .single();

  if (unifiedError || !unifiedData) {
    return null;
  }

  const isSubcontract = unifiedData.commitment_type === "subcontract";
  const sovTableName = isSubcontract
    ? "subcontract_sov_items"
    : "purchase_order_sov_items";
  const sovFkColumn = isSubcontract ? "subcontract_id" : "purchase_order_id";
  const totalsViewName = isSubcontract
    ? "subcontracts_with_totals"
    : "purchase_orders_with_totals";

  // Fetch base record. FK to companies isn't declared in the generated
  // schema for either PO or subcontract, so we look up the company
  // separately below. Branch on type so TS keeps table-specific columns.
  const baseRecord = isSubcontract
    ? await supabase.from("subcontracts").select("*").eq("id", id).single()
    : await supabase.from("purchase_orders").select("*").eq("id", id).single();

  if (baseRecord.error || !baseRecord.data) {
    return null;
  }
  const data = baseRecord.data;

  // Narrow via the branch we took above. Each table's Row shape is distinct,
  // so guard with a runtime property presence check — no `as any`.
  const subcontractData =
    "start_date" in data ? data : null;
  const purchaseOrderData =
    "accounting_method" in data ? data : null;

  // Look up the contract company (one extra query; FK isn't declared).
  let contractCompany: CommitmentData["contract_company"] = null;
  if (data.contract_company_id) {
    const { data: companyRow } = await supabase
      .from("companies")
      .select("id, name, address, city, state")
      .eq("id", data.contract_company_id)
      .maybeSingle();
    if (companyRow?.name) {
      contractCompany = {
        id: companyRow.id,
        name: companyRow.name,
        address: companyRow.address,
        city: companyRow.city,
        state: companyRow.state,
      };
    }
  }

  // Fetch financial totals
  const { data: totalsData } = await (supabase as any)
    .from(totalsViewName)
    .select(
      "total_sov_amount, total_billed_to_date, total_amount_remaining, sov_line_count"
    )
    .eq("id", id)
    .single();

  // Fetch SOV line items
  const { data: sovItems } = await (supabase as any)
    .from(sovTableName)
    .select("*")
    .eq(sovFkColumn, id)
    .order("line_number", { ascending: true });

  const originalAmount = Number(totalsData?.total_sov_amount) || 0;
  const billedToDate = Number(totalsData?.total_billed_to_date) || 0;
  const balanceToFinish = Number(totalsData?.total_amount_remaining) || 0;
  const invoiceContactIds = Array.isArray(data.invoice_contact_ids)
    ? data.invoice_contact_ids
    : [];

  const { data: projectData } = await (supabase as any)
    .from("projects")
    .select("id, name, project_number, address, state, company_id")
    .eq("id", data.project_id)
    .maybeSingle();

  let projectCompany: CommitmentData["project_company"] = null;
  if (projectData?.company_id) {
    const { data: projectCompanyData } = await (supabase as any)
      .from("companies")
      .select("name, address, city, state")
      .eq("id", projectData.company_id)
      .maybeSingle();

    if (projectCompanyData?.name) {
      projectCompany = {
        name: projectCompanyData.name,
        address: projectCompanyData.address,
        city: projectCompanyData.city,
        state: projectCompanyData.state,
      };
    }
  }

  let invoiceContact: CommitmentData["invoice_contact"] = null;
  if (invoiceContactIds.length > 0) {
    const { data: invoicePeople } = await (supabase as any)
      .from("people")
      .select("first_name, last_name, email, phone_business, phone_mobile")
      .in("id", invoiceContactIds)
      .limit(1);

    const person = invoicePeople?.[0];
    if (person) {
      invoiceContact = {
        name: `${person.first_name || ""} ${person.last_name || ""}`.trim(),
        email: person.email || null,
        phone: person.phone_business || person.phone_mobile || null,
      };
    }
  }

  let vendorContact: CommitmentData["vendor_contact"] = null;
  if (data.contract_company_id) {
    const { data: vendorPeople } = await (supabase as any)
      .from("people")
      .select("first_name, last_name, email, phone_business, phone_mobile")
      .eq("company_id", data.contract_company_id)
      .order("created_at", { ascending: true })
      .limit(1);

    const person = vendorPeople?.[0];
    if (person) {
      vendorContact = {
        name: `${person.first_name || ""} ${person.last_name || ""}`.trim(),
        email: person.email || null,
        phone: person.phone_business || person.phone_mobile || null,
      };
    }
  }

  let createdByName: string | null = null;
  if (data.created_by) {
    const { data: createdByPerson } = await (supabase as any)
      .from("people")
      .select("first_name, last_name")
      .eq("auth_user_id", data.created_by)
      .maybeSingle();

    if (createdByPerson) {
      createdByName =
        `${createdByPerson.first_name || ""} ${createdByPerson.last_name || ""}`.trim() ||
        null;
    }
  }

  if (!data.id) {
    return null;
  }

  return {
    id: data.id,
    number: data.contract_number || data.id,
    title: data.title || (isSubcontract ? "Subcontract" : "Purchase Order"),
    description: data.description,
    status: data.status,
    type: unifiedData.commitment_type ?? (isSubcontract ? "subcontract" : "purchase_order"),
    original_amount: originalAmount,
    approved_change_orders: 0,
    revised_contract_amount: originalAmount,
    billed_to_date: billedToDate,
    balance_to_finish: balanceToFinish,
    retention_percentage: data.default_retainage_percent ?? null,
    start_date: subcontractData?.start_date ?? null,
    executed_date: data.contract_date || null,
    substantial_completion_date:
      subcontractData?.estimated_completion_date ?? null,
    accounting_method: purchaseOrderData?.accounting_method ?? null,
    contract_date: data.contract_date || null,
    payment_terms: purchaseOrderData?.payment_terms ?? null,
    delivery_date: purchaseOrderData?.delivery_date ?? null,
    bill_to: purchaseOrderData?.bill_to ?? null,
    ship_to: purchaseOrderData?.ship_to ?? null,
    issued_on_date: data.issued_on_date || null,
    contract_company: contractCompany,
    project: projectData
      ? {
          id: projectData.id,
          name: projectData.name,
          project_number: projectData.project_number,
          address: projectData.address,
          state: projectData.state,
          company_id: projectData.company_id,
        }
      : null,
    project_company: projectCompany,
    vendor_contact: vendorContact,
    invoice_contact: invoiceContact,
    created_by_name: createdByName,
    line_items: (sovItems || []).map((item: any) => ({
      id: item.id,
      line_number: item.line_number,
      description: item.description,
      budget_code: item.budget_code,
      amount: item.amount,
      billed_to_date: item.billed_to_date || 0,
      type: item.change_event_line_item || (isSubcontract ? "Subcontract" : "Material"),
    })),
    created_at: data.created_at ?? "",
    updated_at: data.updated_at ?? "",
  };
}

// =============================================================================
// CSV GENERATION
// =============================================================================

function generateCSV(data: CommitmentData, params: ExportParams): string {
  const rows: string[][] = [];

  // Header info
  rows.push(["Commitment Export"]);
  rows.push([`Number: ${data.number}`]);
  rows.push([`Title: ${data.title}`]);
  rows.push([`Company: ${data.contract_company?.name || "N/A"}`]);
  rows.push([`Status: ${data.status}`]);
  rows.push([`Type: ${data.type}`]);
  rows.push([]);

  // Financial Summary
  if (params.template !== "summary") {
    rows.push(["Financial Summary"]);
    rows.push(["Field", "Amount"]);
    rows.push(["Original Contract Amount", formatCurrency(data.original_amount)]);
    rows.push(["Approved Change Orders", formatCurrency(data.approved_change_orders)]);
    rows.push(["Revised Contract Amount", formatCurrency(data.revised_contract_amount)]);
    rows.push(["Billed to Date", formatCurrency(data.billed_to_date)]);
    rows.push(["Balance to Finish", formatCurrency(data.balance_to_finish)]);
    if (data.retention_percentage) {
      rows.push(["Retention %", `${data.retention_percentage}%`]);
    }
    rows.push([]);
  }

  // SOV Line Items
  if (params.include_sov_items && data.line_items.length > 0) {
    rows.push(["Schedule of Values"]);
    rows.push(["Line #", "Description", "Budget Code", "Amount", "Billed to Date", "Remaining"]);

    for (const item of data.line_items) {
      const amount = item.amount || 0;
      const billed = item.billed_to_date || 0;
      rows.push([
        String(item.line_number || ""),
        item.description || "",
        item.budget_code || "",
        formatCurrency(amount),
        formatCurrency(billed),
        formatCurrency(amount - billed),
      ]);
    }
    rows.push([]);
  }

  // Key Dates
  rows.push(["Key Dates"]);
  rows.push(["Date Type", "Date"]);
  if (data.start_date) rows.push(["Start Date", formatDate(data.start_date)]);
  if (data.executed_date) rows.push(["Executed Date", formatDate(data.executed_date)]);
  if (data.substantial_completion_date)
    rows.push(["Substantial Completion", formatDate(data.substantial_completion_date)]);

  return rows.map((row) => row.map((cell) => escapeCSVCell(cell)).join(",")).join("\n");
}

// =============================================================================
// EXCEL GENERATION
// =============================================================================

async function generateExcel(data: CommitmentData, params: ExportParams): Promise<ArrayBuffer> {
  const XLSX = await import("xlsx");
  const workbook = XLSX.utils.book_new();

  // Summary Sheet
  const summaryData: (string | number)[][] = [
    ["Commitment Details"],
    [],
    ["Field", "Value"],
    ["Number", data.number],
    ["Title", data.title],
    ["Company", data.contract_company?.name || "N/A"],
    ["Status", data.status],
    ["Type", data.type],
    [],
    ["Financial Summary"],
    [],
    ["Original Contract Amount", data.original_amount],
    ["Approved Change Orders", data.approved_change_orders],
    ["Revised Contract Amount", data.revised_contract_amount],
    ["Billed to Date", data.billed_to_date],
    ["Balance to Finish", data.balance_to_finish],
  ];

  if (data.retention_percentage) {
    summaryData.push(["Retention %", data.retention_percentage]);
  }

  const summarySheet = XLSX.utils.aoa_to_sheet(summaryData);
  summarySheet["!cols"] = [{ wch: 25 }, { wch: 40 }];
  XLSX.utils.book_append_sheet(workbook, summarySheet, "Summary");

  // SOV Sheet
  if (params.include_sov_items && data.line_items.length > 0) {
    const sovData: (string | number)[][] = [
      ["Line #", "Description", "Budget Code", "Amount", "Billed to Date", "Remaining"],
    ];

    for (const item of data.line_items) {
      const amount = item.amount || 0;
      const billed = item.billed_to_date || 0;
      sovData.push([
        item.line_number || "",
        item.description || "",
        item.budget_code || "",
        amount,
        billed,
        amount - billed,
      ]);
    }

    // Add totals row
    const totalAmount = data.line_items.reduce((sum, item) => sum + (item.amount || 0), 0);
    const totalBilled = data.line_items.reduce((sum, item) => sum + (item.billed_to_date || 0), 0);
    sovData.push([]);
    sovData.push(["", "TOTAL", "", totalAmount, totalBilled, totalAmount - totalBilled]);

    const sovSheet = XLSX.utils.aoa_to_sheet(sovData);
    sovSheet["!cols"] = [
      { wch: 10 },
      { wch: 40 },
      { wch: 15 },
      { wch: 15 },
      { wch: 15 },
      { wch: 15 },
    ];
    XLSX.utils.book_append_sheet(workbook, sovSheet, "Schedule of Values");
  }

  return XLSX.write(workbook, { type: "array", bookType: "xlsx" }) as ArrayBuffer;
}

// =============================================================================
// PDF/HTML GENERATION
// =============================================================================

function generatePDFHTML(data: CommitmentData, params: ExportParams): string {
  const isPurchaseOrder = data.type === "purchase_order";
  const documentType = isPurchaseOrder ? "Purchase Order" : "Subcontract";
  const projectLabel = [data.project?.project_number, data.project?.name]
    .filter(Boolean)
    .join(" ")
    .trim();
  const projectAddress = [data.project?.address, data.project?.state]
    .filter(Boolean)
    .join(", ");
  const contractorAddress = [
    data.project_company?.address,
    data.project_company?.city,
    data.project_company?.state,
  ]
    .filter(Boolean)
    .join(", ");
  const vendorAddress = [
    data.contract_company?.address,
    data.contract_company?.city,
    data.contract_company?.state,
  ]
    .filter(Boolean)
    .join(", ");
  const invoiceContactLine = data.invoice_contact
    ? [data.invoice_contact.name, data.invoice_contact.phone, data.invoice_contact.email]
        .filter(Boolean)
        .join(" ")
    : "N/A";
  const vendorContactLine = data.vendor_contact
    ? [data.vendor_contact.name, data.vendor_contact.phone, data.vendor_contact.email]
        .filter(Boolean)
        .join(" ")
    : "N/A";
  const createdDate = formatDate(data.created_at);
  const startDate = formatDate(data.start_date);
  const contractDate = formatDate(data.contract_date);
  const estCompleteDate = formatDate(data.substantial_completion_date);
  const deliveryDate = formatDate(data.delivery_date);
  const statusLabel = data.status ? `${data.status.charAt(0).toUpperCase()}${data.status.slice(1)}` : "Draft";
  const workRetainage = isPurchaseOrder ? "0%" : `${data.retention_percentage ?? 0}%`;
  const materialRetainage = `${data.retention_percentage ?? 0}%`;

  const lineItemsForTable = params.include_sov_items ? data.line_items : [];
  const lineItemsRows = lineItemsForTable
    .map((item) => {
      const amount = item.amount || 0;
      return `
        <tr>
          <td class="center">${item.line_number || ""}</td>
          <td>${escapeHTML(item.budget_code || "")}</td>
          <td>${escapeHTML(item.type || (isPurchaseOrder ? "Material" : "Subcontract"))}</td>
          <td>${escapeHTML(item.description || "")}</td>
          <td class="amount">${formatCurrency(amount)}</td>
        </tr>
      `;
    })
    .join("");

  const totalAmount = lineItemsForTable.reduce((sum, item) => sum + (item.amount || 0), 0);
  const subtotalAmount = totalAmount || data.original_amount || 0;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHTML(documentType)} ${escapeHTML(data.number)}</title>
  <style>
    @page { margin: 0.45in; size: letter; }
    * { box-sizing: border-box; }
    body {
      font-family: Arial, Helvetica, sans-serif;
      font-size: 10pt;
      line-height: 1.35;
      margin: 0;
      color: #111827;
    }
    .page {
      min-height: 9.8in;
      display: flex;
      flex-direction: column;
    }
    .page-break {
      page-break-before: always;
    }
    .top-row {
      display: flex;
      justify-content: space-between;
      font-size: 9pt;
      margin-bottom: 6px;
    }
    .company-block {
      border-top: 1px solid #374151;
      border-bottom: 1px solid #374151;
      padding: 6px 0;
      margin-bottom: 8px;
      font-size: 9pt;
    }
    .headline {
      font-size: 18pt;
      font-weight: 700;
      margin: 0 0 8px 0;
    }
    .meta-line {
      margin: 2px 0;
      font-size: 9.5pt;
    }
    .label {
      font-weight: 700;
      letter-spacing: 0.02em;
    }
    .description-block {
      margin: 8px 0 10px;
      min-height: 20px;
    }
    .sov-title {
      margin-top: 10px;
      margin-bottom: 4px;
      font-weight: 700;
      font-size: 10pt;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      font-size: 9pt;
      margin-top: 4px;
    }
    th, td {
      border: 1px solid #9ca3af;
      padding: 5px 6px;
      vertical-align: top;
    }
    th {
      background: #f3f4f6;
      font-weight: 700;
      text-align: left;
    }
    .center { text-align: center; }
    .amount {
      text-align: right;
      white-space: nowrap;
      font-variant-numeric: tabular-nums;
    }
    .totals {
      margin-top: 6px;
      width: 280px;
      margin-left: auto;
      font-size: 9.5pt;
    }
    .totals-row {
      display: flex;
      justify-content: space-between;
      padding: 2px 0;
    }
    .totals-row.grand {
      font-weight: 600;
      border-top: 1px solid #111827;
      margin-top: 2px;
      padding-top: 4px;
    }
    .signature-wrap {
      margin-top: 48px;
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 34px;
      align-items: end;
    }
    .signature-block {
      min-height: 145px;
    }
    .signature-company {
      font-size: 11pt;
      margin-bottom: 48px;
    }
    .signature-line {
      border-bottom: 1px solid #111827;
      height: 18px;
      margin-bottom: 4px;
    }
    .signature-label {
      font-size: 9pt;
      margin-bottom: 14px;
    }
    .mt-2 { margin-top: 8px; }
    .muted { color: #4b5563; }
    .flex-grow { flex-grow: 1; }
    .nowrap { white-space: nowrap; }
    .w-8 { width: 8%; }
    .w-18 { width: 18%; }
    .w-14 { width: 14%; }
    .w-46 { width: 46%; }
    .w-14b { width: 14%; }
    .empty-state {
      border: 1px solid #9ca3af;
      padding: 10px;
      font-size: 9pt;
    }
  </style>
</head>
<body>
  <div class="page">
    <div class="top-row">
      <div>Project: ${escapeHTML(projectLabel || data.project?.name || "N/A")} ${escapeHTML(data.number)}</div>
      <div>Page 1 of 2</div>
    </div>

    <div class="company-block">
      <div><strong>${escapeHTML(data.project_company?.name || "Alleato Group")}</strong>${contractorAddress ? ` ${escapeHTML(contractorAddress)}` : ""}</div>
    </div>

    <div class="headline">${escapeHTML(documentType)} ${escapeHTML(data.number)}</div>

    <div class="meta-line"><span class="label">PROJECT:</span> ${escapeHTML(projectLabel || "N/A")}${projectAddress ? ` ${escapeHTML(projectAddress)}` : ""}</div>
    <div class="meta-line"><span class="label">CONTRACTOR:</span> ${escapeHTML(data.project_company?.name || "Alleato Group")}${contractorAddress ? ` ${escapeHTML(contractorAddress)}` : ""}</div>
    <div class="meta-line"><span class="label">VENDOR:</span> ${escapeHTML(data.contract_company?.name || "N/A")}${vendorAddress ? ` ${escapeHTML(vendorAddress)}` : ""} ${escapeHTML(vendorContactLine)}</div>
    <div class="meta-line"><span class="label">BILL TO:</span> ${escapeHTML(data.bill_to || `${data.project_company?.name || "Alleato Group"} ${invoiceContactLine}`)}</div>
    <div class="meta-line"><span class="label">SHIP TO:</span> ${escapeHTML(data.ship_to || projectAddress || "N/A")}</div>
    <div class="meta-line"><span class="label">TITLE:</span> ${escapeHTML(data.title)} <span class="label" style="margin-left: 18px;">DATE CREATED:</span> ${escapeHTML(createdDate || "N/A")}</div>
    <div class="meta-line"><span class="label">CREATED BY:</span> ${escapeHTML(data.created_by_name || "N/A")} <span class="label" style="margin-left: 18px;">STATUS:</span> ${escapeHTML(statusLabel)}</div>
    <div class="meta-line"><span class="label">INVOICE CONTACT:</span> ${escapeHTML(invoiceContactLine)} <span class="label" style="margin-left: 18px;">DEFAULT WORK RETAINAGE:</span> ${escapeHTML(workRetainage)}</div>
    <div class="meta-line"><span class="label">DEFAULT MATERIAL RETAINAGE:</span> ${escapeHTML(materialRetainage)} <span class="label" style="margin-left: 18px;">START DATE:</span> ${escapeHTML(startDate || "N/A")}</div>
    <div class="meta-line"><span class="label">EST. COMPLETE DATE:</span> ${escapeHTML(estCompleteDate || "N/A")} <span class="label" style="margin-left: 18px;">ACTUAL COMPLETE DATE:</span> N/A</div>
    <div class="meta-line"><span class="label">CONTRACT DATE:</span> ${escapeHTML(contractDate || "N/A")} <span class="label" style="margin-left: 18px;">PAYMENT TERMS:</span> ${escapeHTML(data.payment_terms || "N/A")}</div>
    <div class="meta-line"><span class="label">SHIPPING INFO:</span> ${escapeHTML(data.ship_to || projectAddress || "N/A")}</div>
    <div class="meta-line"><span class="label">DELIVERY DATE:</span> ${escapeHTML(deliveryDate || "N/A")}</div>

    <div class="description-block">
      <span class="label">DESCRIPTION:</span> ${escapeHTML(data.description || "")}
    </div>

    <div class="sov-title">SCHEDULE OF VALUES:</div>
    ${
      lineItemsForTable.length > 0
        ? `
      <table>
        <thead>
          <tr>
            <th class="w-8">#</th>
            <th class="w-18">Cost Code</th>
            <th class="w-14">Type</th>
            <th class="w-46">Description</th>
            <th class="w-14b amount">Subtotal</th>
          </tr>
        </thead>
        <tbody>
          ${lineItemsRows}
        </tbody>
      </table>
      <div class="totals">
        <div class="totals-row"><span>Subtotal</span><span>${formatCurrency(subtotalAmount)}</span></div>
        <div class="totals-row grand"><span>Grand Total</span><span>${formatCurrency(subtotalAmount)}</span></div>
      </div>
      `
        : `<div class="empty-state">No line items available.</div>`
    }

    <div class="flex-grow"></div>
  </div>

  <div class="page page-break">
    <div class="top-row">
      <div>Project: ${escapeHTML(projectLabel || data.project?.name || "N/A")} ${escapeHTML(data.number)}</div>
      <div>Page 2 of 2</div>
    </div>
    <div class="company-block">
      <div><strong>${escapeHTML(data.project_company?.name || "Alleato Group")}</strong>${contractorAddress ? ` ${escapeHTML(contractorAddress)}` : ""}</div>
    </div>

    <div class="signature-wrap">
      <div class="signature-block">
        <div class="signature-company">${escapeHTML(data.contract_company?.name || "Vendor")}</div>
        <div class="signature-line"></div>
        <div class="signature-label">Signature <span class="muted" style="margin-left: 20px;">Date</span></div>
        <div class="signature-line"></div>
        <div class="signature-label">Printed Name</div>
      </div>

      <div class="signature-block">
        <div class="signature-company">${escapeHTML(data.project_company?.name || "Alleato Group")}</div>
        <div class="signature-line"></div>
        <div class="signature-label">Signature <span class="muted" style="margin-left: 20px;">Date</span></div>
        <div class="signature-line"></div>
        <div class="signature-label">Printed Name</div>
      </div>
    </div>
  </div>
</body>
</html>`;
}

// =============================================================================
// UTILITY FUNCTIONS
// =============================================================================

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

function formatDate(value: string | null): string {
  if (!value) return "";
  try {
    return new Date(value).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch {
    return value;
  }
}

function escapeCSVCell(cell: string): string {
  if (cell.includes(",") || cell.includes('"') || cell.includes("\n")) {
    return `"${cell.replace(/"/g, '""')}"`;
  }
  return cell;
}

function escapeHTML(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
