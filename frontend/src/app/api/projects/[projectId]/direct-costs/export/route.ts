/**
 * =============================================================================
 * DIRECT COSTS EXPORT API ENDPOINT
 * =============================================================================
 *
 * Export direct costs data to CSV, Excel, or PDF format
 * Supports filtering, templates, and line items inclusion
 */

import { withApiGuardrails } from "@/lib/guardrails/api";
import { GuardrailError } from "@/lib/guardrails/errors";
import { buildPrintPageCss } from "@/lib/documents/print-layout";
import { NextResponse } from 'next/server';
import * as XLSX from 'xlsx';
import { createClient, getApiRouteUser } from '@/lib/supabase/server';
import { apiErrorResponse } from "@/lib/api-error";
import {
  DirectCostExportSchema,
  type DirectCostWithLineItems,
} from '@/lib/schemas/direct-costs';
import { DirectCostService } from '@/lib/services/direct-cost-service';

// =============================================================================
// POST - Export Direct Costs
// =============================================================================

export const POST = withApiGuardrails<{ projectId: string }>(
  "projects/[projectId]/direct-costs/export#POST",
  async ({ request, params }) => {
  
    const { projectId } = await params;
    const supabase = await createClient();

    // Check authentication
    const user = await getApiRouteUser();

    if (!user) {
      throw new GuardrailError({ code: "AUTH_EXPIRED", where: "projects/[projectId]/direct-costs/export#POST", message: "Authentication required." });
    }

    const body = await request.json();

    // Validate request data
    const validation = DirectCostExportSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        {
          error: 'Invalid export parameters',
          details: validation.error.format(),
        },
        { status: 400 }
      );
    }

    const exportParams = validation.data;
    const service = new DirectCostService(supabase);

    // Fetch data with filters
    const listParams = {
      page: 1,
      limit: 10000, // Large limit for export (can be adjusted)
      sort: 'date' as const,
      order: 'desc' as const,
      view: 'summary' as const,
      ...exportParams.filters,
    };

    const result = await service.list(projectId, listParams);
    const directCosts = result.data;

    if (directCosts.length === 0) {
      return NextResponse.json(
        { error: 'No direct costs found matching the filters' },
        { status: 404 }
      );
    }

    // Generate export based on format
    if (exportParams.format === 'csv') {
      const csv = generateCSV(directCosts, exportParams);
      return new NextResponse(csv, {
        status: 200,
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="direct-costs-${new Date().toISOString().split('T')[0]}.csv"`,
        },
      });
    } else if (exportParams.format === 'excel') {
      const excelBuffer = generateExcel(directCosts, exportParams);
      const excelBlob = new Blob([excelBuffer]);
      return new NextResponse(excelBlob, {
        status: 200,
        headers: {
          'Content-Type':
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'Content-Disposition': `attachment; filename="direct-costs-${new Date().toISOString().split('T')[0]}.xlsx"`,
        },
      });
    } else if (exportParams.format === 'pdf') {
      // For PDF, return a print-friendly HTML that can be printed to PDF
      const html = generatePDFHTML(directCosts, exportParams);
      return new NextResponse(html, {
        status: 200,
        headers: {
          'Content-Type': 'text/html; charset=utf-8',
          'Content-Disposition': `inline; filename="direct-costs-${new Date().toISOString().split('T')[0]}.html"`,
        },
      });
    }

    return NextResponse.json(
      { error: 'Unsupported export format' },
      { status: 400 }
    );
    },
);

// =============================================================================
// CSV GENERATION
// =============================================================================

function generateCSV(
  directCosts: DirectCostWithLineItems[],
  params: {
    include_line_items: boolean;
    template: string;
  }
): string {
  const { include_line_items, template } = params;

  // Define headers based on template
  const headers = getHeadersForTemplate(template);
  const rows: string[][] = [];

  // Add header row
  rows.push(headers);

  // Add data rows
  for (const cost of directCosts) {
    if (include_line_items && cost.line_items && cost.line_items.length > 0) {
      // Include line items as separate rows
      for (const lineItem of cost.line_items) {
        rows.push(getCostRowWithLineItem(cost, lineItem, template));
      }
    } else {
      // Just the direct cost summary
      rows.push(getCostRow(cost, template));
    }
  }

  // Convert to CSV format
  return rows.map((row) => row.map((cell) => escapeCSVCell(cell)).join(',')).join('\n');
}

function getHeadersForTemplate(template: string): string[] {
  if (template === 'accounting') {
    return [
      'Date',
      'Invoice Number',
      'Vendor',
      'Account Code',
      'Description',
      'Quantity',
      'Unit Cost',
      'Line Total',
      'Total Amount',
      'Status',
      'Paid Date',
    ];
  } else if (template === 'summary') {
    return [
      'Date',
      'Vendor',
      'Type',
      'Invoice #',
      'Status',
      'Amount',
      'Description',
    ];
  } else {
    // Standard template
    return [
      'Date',
      'Vendor',
      'Employee',
      'Type',
      'Invoice #',
      'Status',
      'Budget Code',
      'Line Description',
      'Quantity',
      'UOM',
      'Unit Cost',
      'Line Total',
      'Total Amount',
      'Description',
      'Received Date',
      'Paid Date',
    ];
  }
}

function getCostRow(
  cost: DirectCostWithLineItems,
  template: string
): string[] {
  const vendor = cost.vendor?.vendor_name || '';
  const employee = cost.employee
    ? `${cost.employee.first_name} ${cost.employee.last_name}`
    : '';
  const totalAmount = formatCurrency(cost.total_amount);

  if (template === 'accounting') {
    return [
      formatDate(cost.date),
      cost.invoice_number || '',
      vendor,
      '', // Account Code (would need budget code aggregation)
      cost.description || '',
      '', // Quantity
      '', // Unit Cost
      '', // Line Total
      totalAmount,
      cost.status,
      formatDate(cost.paid_date),
    ];
  } else if (template === 'summary') {
    return [
      formatDate(cost.date),
      vendor,
      cost.cost_type,
      cost.invoice_number || '',
      cost.status,
      totalAmount,
      cost.description || '',
    ];
  } else {
    // Standard template
    return [
      formatDate(cost.date),
      vendor,
      employee,
      cost.cost_type,
      cost.invoice_number || '',
      cost.status,
      '', // Budget Code
      '', // Line Description
      '', // Quantity
      '', // UOM
      '', // Unit Cost
      '', // Line Total
      totalAmount,
      cost.description || '',
      formatDate(cost.received_date),
      formatDate(cost.paid_date),
    ];
  }
}

function getCostRowWithLineItem(
  cost: DirectCostWithLineItems,
  lineItem: DirectCostWithLineItems['line_items'][0],
  template: string
): string[] {
  const vendor = cost.vendor?.vendor_name || '';
  const employee = cost.employee
    ? `${cost.employee.first_name} ${cost.employee.last_name}`
    : '';
  const totalAmount = formatCurrency(cost.total_amount);
  const lineTotal = formatCurrency(lineItem.line_total);
  const unitCost = formatCurrency(lineItem.unit_cost);
  const budgetCode = lineItem.budget_code?.code || lineItem.budget_code_id || '';

  if (template === 'accounting') {
    return [
      formatDate(cost.date),
      cost.invoice_number || '',
      vendor,
      budgetCode,
      lineItem.description || '',
      lineItem.quantity.toString(),
      unitCost,
      lineTotal,
      totalAmount,
      cost.status,
      formatDate(cost.paid_date),
    ];
  } else if (template === 'summary') {
    // For summary, don't include line item details
    return getCostRow(cost, template);
  } else {
    // Standard template with full details
    return [
      formatDate(cost.date),
      vendor,
      employee,
      cost.cost_type,
      cost.invoice_number || '',
      cost.status,
      budgetCode,
      lineItem.description || '',
      lineItem.quantity.toString(),
      lineItem.uom || '',
      unitCost,
      lineTotal,
      totalAmount,
      cost.description || '',
      formatDate(cost.received_date),
      formatDate(cost.paid_date),
    ];
  }
}

function escapeCSVCell(cell: string): string {
  // Escape special characters for CSV
  if (cell.includes(',') || cell.includes('"') || cell.includes('\n')) {
    return `"${cell.replace(/"/g, '""')}"`;
  }
  return cell;
}

function formatCurrency(amount: number): string {
  return amount.toFixed(2);
}

function formatDate(value: string | Date | null | undefined): string {
  if (!value) return '';
  return typeof value === 'string' ? value : value.toISOString();
}

// =============================================================================
// EXCEL GENERATION
// =============================================================================

function generateExcel(
  directCosts: DirectCostWithLineItems[],
  params: {
    include_line_items: boolean;
    template: string;
  }
): ArrayBuffer {
  const { include_line_items, template } = params;

  // Create workbook
  const workbook = XLSX.utils.book_new();

  // Get headers
  const headers = getHeadersForTemplate(template);
  const rows: (string | number)[][] = [headers];

  // Add data rows
  for (const cost of directCosts) {
    if (include_line_items && cost.line_items && cost.line_items.length > 0) {
      for (const lineItem of cost.line_items) {
        rows.push(getCostRowWithLineItem(cost, lineItem, template));
      }
    } else {
      rows.push(getCostRow(cost, template));
    }
  }

  // Create worksheet
  const worksheet = XLSX.utils.aoa_to_sheet(rows);

  // Set column widths
  const columnWidths = headers.map((header) => ({
    wch: Math.max(header.length, 15),
  }));
  worksheet['!cols'] = columnWidths;

  // Add worksheet to workbook
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Direct Costs');

  // Generate buffer (compatible with NextResponse)
  const excelBuffer = XLSX.write(workbook, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer;
  return excelBuffer;
}

// =============================================================================
// PDF/HTML GENERATION
// =============================================================================

function generatePDFHTML(
  directCosts: DirectCostWithLineItems[],
  params: {
    include_line_items: boolean;
    template: string;
  }
): string {
  const { include_line_items, template } = params;
  const headers = getHeadersForTemplate(template);

  let rowsHTML = '';
  for (const cost of directCosts) {
    if (include_line_items && cost.line_items && cost.line_items.length > 0) {
      for (const lineItem of cost.line_items) {
        const row = getCostRowWithLineItem(cost, lineItem, template);
        rowsHTML += `<tr>${row.map((cell) => `<td>${escapeHTML(cell)}</td>`).join('')}</tr>\n`;
      }
    } else {
      const row = getCostRow(cost, template);
      rowsHTML += `<tr>${row.map((cell) => `<td>${escapeHTML(cell)}</td>`).join('')}</tr>\n`;
    }
  }

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Direct Costs Export</title>
  <style>
    ${buildPrintPageCss({ landscape: true })}
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      font-size: 10pt;
      margin: 0;
      padding: 20px;
    }
    h1 {
      font-size: 18pt;
      margin-bottom: 20px;
      color: #333;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin-top: 10px;
    }
    th, td {
      border: 1px solid #ddd;
      padding: 8px;
      text-align: left;
    }
    th {
      background-color: #f5f5f5;
      font-weight: 600;
      font-size: 9pt;
    }
    td {
      font-size: 9pt;
    }
    tr:nth-child(even) {
      background-color: #fafafa;
    }
    .footer {
      margin-top: 30px;
      font-size: 8pt;
      color: #666;
    }
  </style>
</head>
<body>
  <h1>Direct Costs Export</h1>
  <p>Generated: ${new Date().toLocaleString()}</p>
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
  <script>
    // Auto-trigger print dialog
    window.onload = function() {
      window.print();
    };
  </script>
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
