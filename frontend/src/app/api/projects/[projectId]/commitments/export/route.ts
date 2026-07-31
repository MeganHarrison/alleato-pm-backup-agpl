/**
 * =============================================================================
 * COMMITMENTS EXPORT API ENDPOINT
 * =============================================================================
 *
 * Export commitments data to CSV, Excel, or PDF format
 * Supports filtering, templates, and SOV items inclusion
 */

import { NextResponse } from "next/server";
import { buildPrintPageCss } from "@/lib/documents/print-layout";
import { createClient, getApiRouteUser } from "@/lib/supabase/server";
import { parseJsonBody, withApiGuardrails } from "@/lib/guardrails/api";
import { GuardrailError } from "@/lib/guardrails/errors";
import {
  CommitmentExportSchema,
  type CommitmentExportRow,
  type CommitmentDetailForPDF,
} from "@/lib/schemas/commitment-export-schema";

/**
 * POST /api/projects/[projectId]/commitments/export
 *
 * Exports commitments data for an entire project in CSV, Excel, or PDF format.
 * Supports filtering by type, status, company, and search text. Validates
 * request body against CommitmentExportSchema (Zod).
 *
 * Three export formats:
 * - CSV: Text file with configurable template columns
 * - Excel: XLSX workbook with auto-sized columns
 * - PDF: HTML document with print-ready layout (auto-triggers print)
 *
 * Three template options:
 * - "standard" - All fields including dates, ERP status, privacy
 * - "financial" - Financial-focused with detailed amounts and percentages
 * - "summary" - Compact view with number, title, type, company, status, amount, balance
 *
 * For individual commitment PDF export, pass `commitmentId` in the body to
 * generate a detailed single-commitment report with SOV items.
 *
 * @route POST /api/projects/[projectId]/commitments/export
 * @param {string} projectId - Project ID (integer)
 *
 * @requestBody {object} Validated by CommitmentExportSchema:
 *   - format {string} (required) - Export format: "csv", "excel", or "pdf"
 *   - template {string} [default="standard"] - Template: "standard", "financial", "summary"
 *   - commitmentId {string} [optional] - For individual PDF export
 *   - filters {object} [optional]:
 *     - type {string} - "subcontract", "purchase_order", or "all"
 *     - status {string} - Filter by status
 *     - companyId {string} - Filter by company
 *     - search {string} - Search in number/title
 *
 * @returns {Blob} 200 - File download with appropriate Content-Type and Content-Disposition
 * @returns {object} 400 - Invalid parameters or unsupported format
 * @returns {object} 401 - Unauthorized (no user session)
 * @returns {object} 404 - No commitments found matching filters
 * @returns {object} 500 - Export generation error
 */
export const POST = withApiGuardrails<Promise<{ projectId: string }>>(
  "/api/projects/[projectId]/commitments/export#POST",
  async ({ request, params }) => {
    const { projectId } = await params;
    const projectIdNum = Number.parseInt(projectId, 10);
    if (Number.isNaN(projectIdNum)) {
      throw new GuardrailError({
        code: "INVALID_PAYLOAD",
        where: "/api/projects/[projectId]/commitments/export#POST",
        message: "Invalid project ID.",
      });
    }

    const supabase = await createClient();
    const user = await getApiRouteUser();

    if (!user) {
      throw new GuardrailError({
        code: "AUTH_EXPIRED",
        where: "/api/projects/[projectId]/commitments/export#POST",
        message: "Unauthorized export request.",
        status: 401,
        severity: "medium",
      });
    }

    const exportParams = await parseJsonBody(
      request,
      CommitmentExportSchema,
      "/api/projects/[projectId]/commitments/export#POST",
    );

    if (exportParams.format === "pdf" && exportParams.commitmentId) {
      const commitmentDetail = await fetchCommitmentDetail(
        supabase,
        exportParams.commitmentId,
        projectIdNum,
      );

      if (!commitmentDetail) {
        throw new GuardrailError({
          code: "ROUTE_BINDING_MISSING",
          where: "/api/projects/[projectId]/commitments/export#POST",
          message: "Commitment not found.",
          status: 404,
          severity: "low",
        });
      }

      const html = generateCommitmentPDFHTML(commitmentDetail);
      return new NextResponse(html, {
        status: 200,
        headers: {
          "Content-Type": "text/html; charset=utf-8",
          "Content-Disposition": `inline; filename="commitment-${commitmentDetail.number || commitmentDetail.id}.html"`,
        },
      });
    }

    const commitments = await fetchCommitmentsForExport(
      supabase,
      projectIdNum,
      exportParams.filters,
    );

    if (commitments.length === 0) {
      throw new GuardrailError({
        code: "ROUTE_BINDING_MISSING",
        where: "/api/projects/[projectId]/commitments/export#POST",
        message: "No commitments found matching the filters.",
        status: 404,
        severity: "low",
      });
    }

    if (exportParams.format === "csv") {
      const csv = generateCSV(commitments, exportParams);
      return new NextResponse(csv, {
        status: 200,
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="commitments-${new Date().toISOString().split("T")[0]}.csv"`,
        },
      });
    }

    if (exportParams.format === "excel") {
      const excelBuffer = await generateExcel(commitments, exportParams);
      const excelBlob = new Blob([excelBuffer]);
      return new NextResponse(excelBlob, {
        status: 200,
        headers: {
          "Content-Type":
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          "Content-Disposition": `attachment; filename="commitments-${new Date().toISOString().split("T")[0]}.xlsx"`,
        },
      });
    }

    if (exportParams.format === "pdf") {
      const html = generateListPDFHTML(commitments, exportParams);
      return new NextResponse(html, {
        status: 200,
        headers: {
          "Content-Type": "text/html; charset=utf-8",
          "Content-Disposition": `attachment; filename="commitments-${new Date().toISOString().split("T")[0]}.html"`,
        },
      });
    }

    throw new GuardrailError({
      code: "INVALID_PAYLOAD",
      where: "/api/projects/[projectId]/commitments/export#POST",
      message: "Unsupported export format.",
    });
  },
);

// =============================================================================
// DATA FETCHING
// =============================================================================

async function fetchCommitmentsForExport(
  supabase: any,
  projectId: number,
  filters?: { type?: string; status?: string; companyId?: string; search?: string; ids?: string[] }
): Promise<CommitmentExportRow[]> {
  const allCommitments: CommitmentExportRow[] = [];
  const filterType = filters?.type;

  // Fetch subcontracts
  if (!filterType || filterType === 'subcontract' || filterType === 'all') {
    let scQuery = supabase
      .from('subcontracts_with_totals')
      .select('*')
      .eq('project_id', projectId)
      .order('contract_number', { ascending: true });

    if (filters?.status) {
      scQuery = scQuery.ilike('status', filters.status);
    }
    if (filters?.companyId) {
      scQuery = scQuery.eq('contract_company_id', filters.companyId);
    }
    if (filters?.search) {
      scQuery = scQuery.or(
        `contract_number.ilike.%${filters.search}%,title.ilike.%${filters.search}%`
      );
    }
    if (filters?.ids?.length) {
      scQuery = scQuery.in('id', filters.ids);
    }

    const { data: scData, error: scError } = await scQuery;
    if (scError) throw scError;

    (scData || []).forEach((row: any) => {
      allCommitments.push(mapRowToExport(row, 'subcontract'));
    });
  }

  // Fetch purchase orders
  if (!filterType || filterType === 'purchase_order' || filterType === 'all') {
    let poQuery = supabase
      .from('purchase_orders_with_totals')
      .select('*')
      .eq('project_id', projectId)
      .order('contract_number', { ascending: true });

    if (filters?.status) {
      poQuery = poQuery.ilike('status', filters.status);
    }
    if (filters?.companyId) {
      poQuery = poQuery.eq('contract_company_id', filters.companyId);
    }
    if (filters?.search) {
      poQuery = poQuery.or(
        `contract_number.ilike.%${filters.search}%,title.ilike.%${filters.search}%`
      );
    }
    if (filters?.ids?.length) {
      poQuery = poQuery.in('id', filters.ids);
    }

    const { data: poData, error: poError } = await poQuery;
    if (poError) throw poError;

    (poData || []).forEach((row: any) => {
      allCommitments.push(mapRowToExport(row, 'purchase_order'));
    });
  }

  return allCommitments;
}

async function fetchCommitmentDetail(
  supabase: any,
  commitmentId: string,
  projectId: number
): Promise<CommitmentDetailForPDF | null> {
  // Try subcontracts first
  const { data: scData } = await supabase
    .from('subcontracts_with_totals')
    .select('*')
    .eq('id', commitmentId)
    .eq('project_id', projectId)
    .maybeSingle();

  let commitment: CommitmentDetailForPDF | null = null;
  let commitmentType: 'subcontract' | 'purchase_order' = 'subcontract';

  if (scData) {
    commitment = {
      ...mapRowToExport(scData, 'subcontract'),
      project_name: null,
      retention_percentage: scData.default_retainage_percent || null,
    };
    commitmentType = 'subcontract';
  } else {
    // Try purchase orders
    const { data: poData } = await supabase
      .from('purchase_orders_with_totals')
      .select('*')
      .eq('id', commitmentId)
      .eq('project_id', projectId)
      .maybeSingle();

    if (poData) {
      commitment = {
        ...mapRowToExport(poData, 'purchase_order'),
        project_name: null,
        retention_percentage: poData.default_retainage_percent || null,
      };
      commitmentType = 'purchase_order';
    }
  }

  if (!commitment) return null;

  // Fetch project name
  const { data: projectData } = await supabase
    .from('projects')
    .select('name')
    .eq('id', projectId)
    .maybeSingle();

  if (projectData) {
    commitment.project_name = projectData.name;
  }

  // Fetch SOV items
  const sovTable = commitmentType === 'subcontract'
    ? 'subcontract_sov_items'
    : 'purchase_order_sov_items';
  const sovFk = commitmentType === 'subcontract'
    ? 'subcontract_id'
    : 'purchase_order_id';

  const { data: sovData } = await supabase
    .from(sovTable)
    .select('*')
    .eq(sovFk, commitmentId)
    .order('line_number', { ascending: true });

  if (sovData && sovData.length > 0) {
    commitment.sov_items = sovData.map((item: any) => ({
      id: item.id,
      line_number: item.line_number || '',
      description: item.description || null,
      cost_code: item.cost_code || null,
      scheduled_value: Number(item.scheduled_value) || 0,
      work_completed_previous: Number(item.work_completed_previous_period) || 0,
      work_completed_this_period: Number(item.work_completed_this_period) || 0,
      materials_stored: Number(item.materials_presently_stored) || 0,
      total_completed: Number(item.total_completed_and_stored) || 0,
      percent_complete: Number(item.percent_complete) || 0,
      balance_to_finish: Number(item.balance_to_finish) || 0,
      retainage: Number(item.retainage) || 0,
    }));
  }

  return commitment;
}

function mapRowToExport(row: any, type: 'subcontract' | 'purchase_order'): CommitmentExportRow {
  const originalAmount = Number(row.total_sov_amount) || 0;
  const billedToDate = Number(row.total_billed_to_date) || 0;
  const balanceToFinish = Number(row.total_amount_remaining) || 0;
  const paymentsIssued = 0; // Placeholder
  const percentPaid = originalAmount > 0 ? (paymentsIssued / originalAmount) * 100 : 0;

  return {
    id: row.id || '',
    number: row.contract_number || '',
    title: row.title || null,
    type,
    status: row.status?.toLowerCase() || 'draft',
    executed: row.executed ?? false,
    contract_company_name: row.company_name || null,
    description: row.description || null,
    start_date: row.start_date || null,
    executed_date: row.contract_date || null,
    original_amount: originalAmount,
    approved_change_orders: 0,
    revised_contract_amount: originalAmount,
    billed_to_date: billedToDate,
    balance_to_finish: balanceToFinish,
    invoiced_amount: billedToDate,
    payments_issued: paymentsIssued,
    percent_paid: percentPaid,
    remaining_balance: originalAmount - paymentsIssued,
    erp_status: row.erp_status || null,
    ssov_status: row.ssov_status || null,
    is_private: row.is_private ?? true,
    created_at: row.created_at || new Date().toISOString(),
    updated_at: row.updated_at || new Date().toISOString(),
  };
}

// =============================================================================
// CSV GENERATION
// =============================================================================

function generateCSV(
  commitments: CommitmentExportRow[],
  params: { template: string }
): string {
  const { template } = params;
  const headers = getHeadersForTemplate(template);
  const rows: string[][] = [headers];

  for (const commitment of commitments) {
    rows.push(getCommitmentRow(commitment, template));
  }

  return rows.map((row) => row.map((cell) => escapeCSVCell(cell)).join(',')).join('\n');
}

function getHeadersForTemplate(template: string): string[] {
  if (template === 'financial') {
    return [
      'Number',
      'Title',
      'Type',
      'Company',
      'Status',
      'Original Amount',
      'Approved COs',
      'Revised Amount',
      'Billed to Date',
      'Balance to Finish',
      'Invoiced Amount',
      'Payments Issued',
      '% Paid',
      'Remaining Balance',
    ];
  } else if (template === 'summary') {
    return [
      'Number',
      'Title',
      'Type',
      'Company',
      'Status',
      'Revised Amount',
      'Balance to Finish',
    ];
  } else {
    // Standard template
    return [
      'Number',
      'Title',
      'Type',
      'Company',
      'Status',
      'Executed',
      'Start Date',
      'Executed Date',
      'Original Amount',
      'Approved COs',
      'Revised Amount',
      'Billed to Date',
      'Balance to Finish',
      'ERP Status',
      'SSOV Status',
      'Private',
      'Created',
    ];
  }
}

function getCommitmentRow(commitment: CommitmentExportRow, template: string): string[] {
  const typeLabel = commitment.type === 'purchase_order' ? 'Purchase Order' : 'Subcontract';

  if (template === 'financial') {
    return [
      commitment.number,
      commitment.title || '',
      typeLabel,
      commitment.contract_company_name || '',
      commitment.status,
      formatCurrency(commitment.original_amount),
      formatCurrency(commitment.approved_change_orders),
      formatCurrency(commitment.revised_contract_amount),
      formatCurrency(commitment.billed_to_date),
      formatCurrency(commitment.balance_to_finish),
      formatCurrency(commitment.invoiced_amount),
      formatCurrency(commitment.payments_issued),
      commitment.percent_paid.toFixed(1) + '%',
      formatCurrency(commitment.remaining_balance),
    ];
  } else if (template === 'summary') {
    return [
      commitment.number,
      commitment.title || '',
      typeLabel,
      commitment.contract_company_name || '',
      commitment.status,
      formatCurrency(commitment.revised_contract_amount),
      formatCurrency(commitment.balance_to_finish),
    ];
  } else {
    return [
      commitment.number,
      commitment.title || '',
      typeLabel,
      commitment.contract_company_name || '',
      commitment.status,
      commitment.executed ? 'Yes' : 'No',
      formatDate(commitment.start_date),
      formatDate(commitment.executed_date),
      formatCurrency(commitment.original_amount),
      formatCurrency(commitment.approved_change_orders),
      formatCurrency(commitment.revised_contract_amount),
      formatCurrency(commitment.billed_to_date),
      formatCurrency(commitment.balance_to_finish),
      commitment.erp_status || '',
      commitment.ssov_status || '',
      commitment.is_private ? 'Yes' : 'No',
      formatDate(commitment.created_at),
    ];
  }
}

function escapeCSVCell(cell: string): string {
  if (cell.includes(',') || cell.includes('"') || cell.includes('\n')) {
    return `"${cell.replace(/"/g, '""')}"`;
  }
  return cell;
}

function formatCurrency(amount: number): string {
  return amount.toFixed(2);
}

function formatDate(value: string | null | undefined): string {
  if (!value) return '';
  try {
    return new Date(value).toLocaleDateString('en-US');
  } catch {
    return value;
  }
}

// =============================================================================
// EXCEL GENERATION
// =============================================================================

async function generateExcel(
  commitments: CommitmentExportRow[],
  params: { template: string }
): Promise<ArrayBuffer> {
  const XLSX = await import("xlsx");
  const { template } = params;
  const workbook = XLSX.utils.book_new();
  const headers = getHeadersForTemplate(template);
  const rows: (string | number)[][] = [headers];

  for (const commitment of commitments) {
    rows.push(getCommitmentRow(commitment, template));
  }

  const worksheet = XLSX.utils.aoa_to_sheet(rows);

  // Set column widths
  const columnWidths = headers.map((header) => ({
    wch: Math.max(header.length, 15),
  }));
  worksheet['!cols'] = columnWidths;

  XLSX.utils.book_append_sheet(workbook, worksheet, 'Commitments');

  const excelBuffer = XLSX.write(workbook, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer;
  return excelBuffer;
}

// =============================================================================
// PDF/HTML GENERATION - LIST
// =============================================================================

function generateListPDFHTML(
  commitments: CommitmentExportRow[],
  params: { template: string }
): string {
  const { template } = params;
  const headers = getHeadersForTemplate(template);

  let rowsHTML = '';
  for (const commitment of commitments) {
    const row = getCommitmentRow(commitment, template);
    rowsHTML += `<tr>${row.map((cell) => `<td>${escapeHTML(cell)}</td>`).join('')}</tr>\n`;
  }

  // Calculate totals
  const totalOriginal = commitments.reduce((sum, c) => sum + c.original_amount, 0);
  const totalRevised = commitments.reduce((sum, c) => sum + c.revised_contract_amount, 0);
  const totalBilled = commitments.reduce((sum, c) => sum + c.billed_to_date, 0);
  const totalBalance = commitments.reduce((sum, c) => sum + c.balance_to_finish, 0);

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Commitments Export</title>
  <style>
    ${buildPrintPageCss({ landscape: true })}
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      font-size: 9pt;
      margin: 0;
      padding: 20px;
    }
    h1 { font-size: 18pt; margin-bottom: 10px; color: #333; }
    .summary { margin-bottom: 20px; display: flex; gap: 20px; flex-wrap: wrap; }
    .summary-card {
      background: #f5f5f5;
      padding: 10px 15px;
      border-radius: 4px;
    }
    .summary-card .label { font-size: 8pt; color: #666; }
    .summary-card .value { font-size: 12pt; font-weight: 600; }
    table { width: 100%; border-collapse: collapse; margin-top: 10px; }
    th, td { border: 1px solid #ddd; padding: 6px 8px; text-align: left; }
    th { background-color: #f5f5f5; font-weight: 600; font-size: 8pt; }
    td { font-size: 8pt; }
    tr:nth-child(even) { background-color: #fafafa; }
    .footer { margin-top: 30px; font-size: 7pt; color: #666; }
    .text-right { text-align: right; }
  </style>
</head>
<body>
  <h1>Commitments Export</h1>
  <p style="font-size: 9pt; color: #666;">Generated: ${new Date().toLocaleString()}</p>

  <div class="summary">
    <div class="summary-card">
      <div class="label">Total Original</div>
      <div class="value">$${totalOriginal.toLocaleString('en-US', { minimumFractionDigits: 2 })}</div>
    </div>
    <div class="summary-card">
      <div class="label">Total Revised</div>
      <div class="value">$${totalRevised.toLocaleString('en-US', { minimumFractionDigits: 2 })}</div>
    </div>
    <div class="summary-card">
      <div class="label">Total Billed</div>
      <div class="value">$${totalBilled.toLocaleString('en-US', { minimumFractionDigits: 2 })}</div>
    </div>
    <div class="summary-card">
      <div class="label">Total Balance</div>
      <div class="value">$${totalBalance.toLocaleString('en-US', { minimumFractionDigits: 2 })}</div>
    </div>
  </div>

  <table>
    <thead>
      <tr>${headers.map((h) => `<th>${escapeHTML(h)}</th>`).join('')}</tr>
    </thead>
    <tbody>
      ${rowsHTML}
    </tbody>
  </table>

  <div class="footer">
    <p>This report can be printed to PDF using your browser's print function (Ctrl+P / Cmd+P).</p>
  </div>
  <script>window.onload = function() { window.print(); };</script>
</body>
</html>`;
}

// =============================================================================
// PDF/HTML GENERATION - INDIVIDUAL COMMITMENT
// =============================================================================

function generateCommitmentPDFHTML(commitment: CommitmentDetailForPDF): string {
  const typeLabel = commitment.type === 'purchase_order' ? 'Purchase Order' : 'Subcontract';

  // SOV items table
  let sovHTML = '';
  if (commitment.sov_items && commitment.sov_items.length > 0) {
    const sovHeaders = [
      'Line #',
      'Description',
      'Cost Code',
      'Scheduled Value',
      'Previous',
      'This Period',
      'Materials',
      'Total Complete',
      '% Complete',
      'Balance',
      'Retainage',
    ];

    let sovRows = '';
    let totalScheduled = 0;
    let totalPrevious = 0;
    let totalThisPeriod = 0;
    let totalMaterials = 0;
    let totalComplete = 0;
    let totalBalance = 0;
    let totalRetainage = 0;

    for (const item of commitment.sov_items) {
      totalScheduled += item.scheduled_value;
      totalPrevious += item.work_completed_previous;
      totalThisPeriod += item.work_completed_this_period;
      totalMaterials += item.materials_stored;
      totalComplete += item.total_completed;
      totalBalance += item.balance_to_finish;
      totalRetainage += item.retainage;

      sovRows += `<tr>
        <td>${escapeHTML(item.line_number)}</td>
        <td>${escapeHTML(item.description || '')}</td>
        <td>${escapeHTML(item.cost_code || '')}</td>
        <td class="text-right">$${item.scheduled_value.toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
        <td class="text-right">$${item.work_completed_previous.toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
        <td class="text-right">$${item.work_completed_this_period.toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
        <td class="text-right">$${item.materials_stored.toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
        <td class="text-right">$${item.total_completed.toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
        <td class="text-right">${item.percent_complete.toFixed(1)}%</td>
        <td class="text-right">$${item.balance_to_finish.toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
        <td class="text-right">$${item.retainage.toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
      </tr>`;
    }

    // Totals row
    sovRows += `<tr style="font-weight: bold; background: #f0f0f0;">
      <td colspan="3">TOTALS</td>
      <td class="text-right">$${totalScheduled.toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
      <td class="text-right">$${totalPrevious.toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
      <td class="text-right">$${totalThisPeriod.toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
      <td class="text-right">$${totalMaterials.toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
      <td class="text-right">$${totalComplete.toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
      <td class="text-right">${totalScheduled > 0 ? ((totalComplete / totalScheduled) * 100).toFixed(1) : 0}%</td>
      <td class="text-right">$${totalBalance.toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
      <td class="text-right">$${totalRetainage.toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
    </tr>`;

    sovHTML = `
    <h2>Schedule of Values</h2>
    <table>
      <thead>
        <tr>${sovHeaders.map((h) => `<th>${escapeHTML(h)}</th>`).join('')}</tr>
      </thead>
      <tbody>
        ${sovRows}
      </tbody>
    </table>`;
  }

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${typeLabel} - ${commitment.number || commitment.id}</title>
  <style>
    @media print {
      @page { margin: 0.5in; }
      .no-print { display: none; }
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      font-size: 10pt;
      margin: 0;
      padding: 20px;
      max-width: 1200px;
      margin: 0 auto;
    }
    h1 { font-size: 20pt; margin-bottom: 5px; color: #333; }
    h2 { font-size: 14pt; margin-top: 30px; margin-bottom: 10px; color: #333; border-bottom: 1px solid #ddd; padding-bottom: 5px; }
    .subtitle { font-size: 12pt; color: #666; margin-bottom: 20px; }
    .header-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 20px;
      margin-bottom: 30px;
    }
    .info-section { background: #f9f9f9; padding: 15px; border-radius: 4px; }
    .info-row { display: flex; margin-bottom: 8px; }
    .info-label { width: 140px; font-weight: 500; color: #666; }
    .info-value { flex: 1; }
    .financial-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 15px;
      margin-bottom: 30px;
    }
    .financial-card {
      background: #f5f5f5;
      padding: 15px;
      border-radius: 4px;
      text-align: center;
    }
    .financial-card .label { font-size: 9pt; color: #666; margin-bottom: 5px; }
    .financial-card .value { font-size: 16pt; font-weight: 600; }
    table { width: 100%; border-collapse: collapse; margin-top: 10px; font-size: 9pt; }
    th, td { border: 1px solid #ddd; padding: 6px 8px; text-align: left; }
    th { background-color: #f5f5f5; font-weight: 600; }
    tr:nth-child(even) { background-color: #fafafa; }
    .text-right { text-align: right; }
    .footer { margin-top: 30px; font-size: 8pt; color: #666; text-align: center; }
    .status-badge {
      display: inline-block;
      padding: 2px 8px;
      border-radius: 4px;
      font-size: 9pt;
      font-weight: 500;
      text-transform: capitalize;
    }
    .status-draft { background: #f3f4f6; color: #374151; }
    .status-pending { background: #fef3c7; color: #92400e; }
    .status-approved { background: #d1fae5; color: #065f46; }
    .status-executed { background: #dbeafe; color: #1e40af; }
    .status-complete { background: #d1fae5; color: #065f46; }
    .status-terminated { background: #fee2e2; color: #991b1b; }
  </style>
</head>
<body>
  <h1>${typeLabel}</h1>
  <div class="subtitle">
    ${commitment.number ? `#${escapeHTML(commitment.number)}` : ''}
    ${commitment.title ? `- ${escapeHTML(commitment.title)}` : ''}
  </div>

  <div class="header-grid">
    <div class="info-section">
      <h3 style="margin-top: 0; font-size: 11pt;">General Information</h3>
      <div class="info-row">
        <span class="info-label">Status:</span>
        <span class="info-value">
          <span class="status-badge status-${commitment.status}">${commitment.status}</span>
        </span>
      </div>
      <div class="info-row">
        <span class="info-label">Company:</span>
        <span class="info-value">${escapeHTML(commitment.contract_company_name || 'N/A')}</span>
      </div>
      <div class="info-row">
        <span class="info-label">Executed:</span>
        <span class="info-value">${commitment.executed ? 'Yes' : 'No'}</span>
      </div>
      <div class="info-row">
        <span class="info-label">Start Date:</span>
        <span class="info-value">${commitment.start_date ? new Date(commitment.start_date).toLocaleDateString() : 'N/A'}</span>
      </div>
      <div class="info-row">
        <span class="info-label">Executed Date:</span>
        <span class="info-value">${commitment.executed_date ? new Date(commitment.executed_date).toLocaleDateString() : 'N/A'}</span>
      </div>
      ${commitment.retention_percentage !== null ? `
      <div class="info-row">
        <span class="info-label">Retainage:</span>
        <span class="info-value">${commitment.retention_percentage}%</span>
      </div>
      ` : ''}
    </div>

    <div class="info-section">
      <h3 style="margin-top: 0; font-size: 11pt;">Project Information</h3>
      <div class="info-row">
        <span class="info-label">Project:</span>
        <span class="info-value">${escapeHTML(commitment.project_name || 'N/A')}</span>
      </div>
      <div class="info-row">
        <span class="info-label">Created:</span>
        <span class="info-value">${new Date(commitment.created_at).toLocaleDateString()}</span>
      </div>
      <div class="info-row">
        <span class="info-label">Last Updated:</span>
        <span class="info-value">${new Date(commitment.updated_at).toLocaleDateString()}</span>
      </div>
      ${commitment.description ? `
      <div class="info-row" style="flex-direction: column;">
        <span class="info-label" style="width: 100%; margin-bottom: 5px;">Description:</span>
        <span class="info-value">${escapeHTML(commitment.description)}</span>
      </div>
      ` : ''}
    </div>
  </div>

  <h2>Financial Summary</h2>
  <div class="financial-grid">
    <div class="financial-card">
      <div class="label">Original Contract Amount</div>
      <div class="value">$${commitment.original_amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}</div>
    </div>
    <div class="financial-card">
      <div class="label">Approved Change Orders</div>
      <div class="value">$${commitment.approved_change_orders.toLocaleString('en-US', { minimumFractionDigits: 2 })}</div>
    </div>
    <div class="financial-card">
      <div class="label">Revised Contract Amount</div>
      <div class="value">$${commitment.revised_contract_amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}</div>
    </div>
    <div class="financial-card">
      <div class="label">Balance to Finish</div>
      <div class="value">$${commitment.balance_to_finish.toLocaleString('en-US', { minimumFractionDigits: 2 })}</div>
    </div>
  </div>

  <div class="financial-grid">
    <div class="financial-card">
      <div class="label">Billed to Date</div>
      <div class="value">$${commitment.billed_to_date.toLocaleString('en-US', { minimumFractionDigits: 2 })}</div>
    </div>
    <div class="financial-card">
      <div class="label">Payments Issued</div>
      <div class="value">$${commitment.payments_issued.toLocaleString('en-US', { minimumFractionDigits: 2 })}</div>
    </div>
    <div class="financial-card">
      <div class="label">% Paid</div>
      <div class="value">${commitment.percent_paid.toFixed(1)}%</div>
    </div>
    <div class="financial-card">
      <div class="label">Remaining Balance</div>
      <div class="value">$${commitment.remaining_balance.toLocaleString('en-US', { minimumFractionDigits: 2 })}</div>
    </div>
  </div>

  ${sovHTML}

  <div class="footer">
    <p>Generated: ${new Date().toLocaleString()}</p>
    <p class="no-print">This report can be printed to PDF using your browser's print function (Ctrl+P / Cmd+P).</p>
  </div>
  <script>window.onload = function() { window.print(); };</script>
</body>
</html>`;
}

function escapeHTML(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
