import { withApiGuardrails } from "@/lib/guardrails/api";
import { GuardrailError } from "@/lib/guardrails/errors";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { verifyProjectAccess, isAuthError } from "@/lib/supabase/auth-guard";
import { apiErrorResponse } from "@/lib/api-error";
import {
  buildBrandedDocumentHtml,
  buildBrandedFooterTemplate,
  BRANDED_FOOTER_MARGIN,
} from "@/lib/documents/branded-letterhead";
import { buildBrandedLogTableHtml, renderPdfFromHtml } from "@/lib/documents/pdf";

// Puppeteer (used by the PDF export branch) requires the Node.js runtime.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function formatMoneyCell(value: number | string): string {
  if (typeof value !== "number") return String(value ?? "");
  return value.toLocaleString("en-US", { style: "currency", currency: "USD" });
}

// Cost types that count towards Job to Date (all approved)
const JTD_COST_TYPES = [
  "Invoice",
  "Expense",
  "Payroll",
  "Subcontractor Invoice",
];

// Cost types that count towards Direct Costs (excludes Subcontractor Invoice)
const DIRECT_COST_TYPES = ["Invoice", "Expense", "Payroll"];
const APPROVED_DIRECT_COST_STATUSES = ["Approved"];

// Pending commitment statuses for Pending Cost Changes calculation
const PENDING_SUBCONTRACT_STATUSES = ["Out for Signature", "Pending"];
const PENDING_PO_STATUSES = [
  "Draft",
  "Sent",
  "Acknowledged",
];

// Executed/Approved commitment statuses for Committed Costs calculation
const EXECUTED_SUBCONTRACT_STATUSES = ["Approved", "Complete"];
const EXECUTED_PO_STATUSES = ["Approved", "Completed"];
const BUDGET_LINES_VIEW = "v_budget_lines";
const PRIME_CHANGE_ORDER_LINES_TABLE = "change_order_lines";

interface RuntimeOrderedRowsClient {
  from: (tableName: string) => {
    select: (selectedColumns: string) => {
      eq: (column: string, value: number) => {
        order: (
          column: string,
          options: { ascending: boolean },
        ) => Promise<{ data: Array<Record<string, unknown>> | null; error: unknown }>;
      };
    };
  };
}

interface RuntimeDirectCostRowsClient {
  from: (tableName: string) => {
    select: (selectedColumns: string) => {
      eq: (column: string, value: number) => {
        in: (
          filterColumn: string,
          values: string[],
        ) => Promise<{ data: Array<Record<string, unknown>> | null; error: unknown }>;
      };
    };
  };
}

interface RuntimePendingChangeOrderRowsClient {
  from: (tableName: string) => {
    select: (selectedColumns: string) => {
      eq: (column: string, value: number) => {
        like: (
          filterColumn: string,
          pattern: string,
        ) => Promise<{ data: Array<Record<string, unknown>> | null; error: unknown }>;
      };
    };
  };
}

interface ExportBudgetRow {
  "Cost Code": string;
  "Cost Type": string;
  Description: string;
  "Unit Qty": number | string;
  UOM: string;
  "Unit Cost": number | string;
  "Original Budget": number;
  "Budget Modifications": number;
  "Approved Change Orders": number;
  "Revised Budget": number;
  "Job to Date Cost": number;
  "Direct Costs": number;
  "Pending Changes": number;
  "Committed Costs": number;
  "Forecast to Complete": number;
  "Estimated Cost at Completion": number;
  "Projected Over/Under": number;
}

export const GET = withApiGuardrails<{ projectId: string }>(
  "projects/[projectId]/budget/export#GET",
  async ({ request, params }) => {
  
    const { projectId } = params;
    const numericProjectId = parseInt(projectId, 10);

    if (Number.isNaN(numericProjectId)) {
      return NextResponse.json(
        { error: "Invalid project ID" },
        { status: 400 },
      );
    }

    const authResult = await verifyProjectAccess(numericProjectId);
    if (isAuthError(authResult)) return authResult;
    const supabase = authResult.serviceClient;

    const { searchParams } = new URL(request.url);
    const format = searchParams.get("format") || "excel";

    // Validate format
    if (!["excel", "csv", "pdf"].includes(format)) {
      return NextResponse.json(
        { error: "Invalid format. Must be 'excel', 'csv', or 'pdf'" },
        { status: 400 },
      );
    }

    // Fetch budget lines — try materialized view first, fall back to base table
    const budgetLineSelect = `
      *,
      cost_code:cost_codes(id, title, division_id),
      cost_type:cost_code_types(code, description),
      sub_job:sub_jobs(code, name)
    `;
     
    const runtimeOrderedClient = supabase as unknown as RuntimeOrderedRowsClient;
    const runtimeDirectCostClient = supabase as unknown as RuntimeDirectCostRowsClient;
    const runtimePendingChangeOrderClient =
      supabase as unknown as RuntimePendingChangeOrderRowsClient;

    let budgetLinesRes = await runtimeOrderedClient
      .from(BUDGET_LINES_VIEW)
      .select(budgetLineSelect)
      .eq("project_id", numericProjectId)
      .order("cost_code_id", { ascending: true });

    if (budgetLinesRes.error) {
      const errStr = JSON.stringify(budgetLinesRes.error);
      const isMissingView =
        errStr.includes(BUDGET_LINES_VIEW) ||
        errStr.includes("PGRST205") ||
        errStr.includes("schema cache");
      if (isMissingView) {
        budgetLinesRes = await supabase
          .from("budget_lines")
          .select(budgetLineSelect)
          .eq("project_id", numericProjectId)
          .order("cost_code_id", { ascending: true });
      }
    }

    // Fetch budget data using the same logic as the main budget API
    const [
      directCostsRes,
      subcontractSovRes,
      poSovRes,
      pendingPrimeChangeOrdersRes,
      executedSubcontractSovRes,
      executedPoSovRes,
      pendingCommitmentCOsRes,
      approvedCommitmentCOsRes,
    ] = await Promise.all([

      // Direct costs for calculations
       
      runtimeDirectCostClient
        .from("direct_cost_line_items")
        .select(
          `
          budget_code_id,
          line_total,
          quantity,
          unit_cost,
          direct_costs!inner(
            cost_type,
            status,
            project_id
          )
        `,
        )
        .eq("direct_costs.project_id", numericProjectId)
        .in("direct_costs.status", APPROVED_DIRECT_COST_STATUSES) as Promise<{ data: Array<Record<string, unknown>> | null; error: unknown }>,

      // Subcontract SOV items with pending status for Pending Cost Changes
      supabase
        .from("subcontract_sov_items")
        .select("budget_code, amount, subcontracts!inner(status, project_id)")
        .eq("subcontracts.project_id", numericProjectId)
        .in("subcontracts.status", PENDING_SUBCONTRACT_STATUSES),

      // PO SOV items with pending statuses for Pending Cost Changes
      supabase
        .from("purchase_order_sov_items")
        .select(
          "budget_code, amount, purchase_orders!inner(status, project_id)",
        )
        .eq("purchase_orders.project_id", numericProjectId)
        .in("purchase_orders.status", PENDING_PO_STATUSES),

      // Pending change orders for Pending Budget Changes
      (async () => {
        const result = await runtimePendingChangeOrderClient
          .from(PRIME_CHANGE_ORDER_LINES_TABLE)
          .select("cost_code_id, amount, change_orders!inner(status, project_id)")
          .eq("change_orders.project_id", numericProjectId)
          .like("change_orders.status", "Pending%");

        const errStr = JSON.stringify(result.error);
        const isMissingTable =
          errStr.includes(PRIME_CHANGE_ORDER_LINES_TABLE) ||
          errStr.includes("PGRST205") ||
          errStr.includes("schema cache");

        if (result.error && isMissingTable) {
          return { data: [], error: null };
        }

        return result;
      })() as Promise<{ data: Array<Record<string, unknown>> | null; error: unknown }>,

      // Executed/Approved Subcontract SOV items for Committed Costs
      supabase
        .from("subcontract_sov_items")
        .select("budget_code, amount, subcontracts!inner(status, project_id)")
        .eq("subcontracts.project_id", numericProjectId)
        .in("subcontracts.status", EXECUTED_SUBCONTRACT_STATUSES),

      // Executed/Approved PO SOV items for Committed Costs
      supabase
        .from("purchase_order_sov_items")
        .select(
          "budget_code, amount, purchase_orders!inner(status, project_id)",
        )
        .eq("purchase_orders.project_id", numericProjectId)
        .in("purchase_orders.status", EXECUTED_PO_STATUSES),

      // Pending commitment change orders for Pending Cost Changes
      supabase
        .from("commitment_change_order_lines")
        .select(
          `
          cost_code_id,
          amount,
          commitment_change_orders!inner(
            status,
            commitments!inner(project_id)
          )
        `,
        )
        .eq("commitment_change_orders.commitments.project_id", numericProjectId)
        .like("commitment_change_orders.status", "Pending%"),

      // Approved commitment change orders for Committed Costs
      supabase
        .from("commitment_change_order_lines")
        .select(
          `
          cost_code_id,
          amount,
          commitment_change_orders!inner(
            status,
            commitments!inner(project_id)
          )
        `,
        )
        .eq("commitment_change_orders.commitments.project_id", numericProjectId)
        .eq("commitment_change_orders.status", "Approved"),
    ]);

    if (budgetLinesRes.error) {
      return NextResponse.json(
        { error: "Failed to fetch budget data for export" },
        { status: 500 },
      );
    }

    // Build cost aggregation by cost_code_id (simplified for export)
    const costsByCode: Record<string, {
      jobToDateCostDetail: number;
      directCosts: number;
      pendingCostChanges: number;
      committedCosts: number;
      pendingBudgetChanges: number;
    }> = {};

    // Process direct costs
    for (const cost of (directCostsRes.data || []) as unknown as Array<{
      budget_code_id: string | null;
      line_total: number | null;
      quantity: number | null;
      unit_cost: number | null;
      direct_costs: { cost_type: string | null; status: string | null } | null;
    }>) {
      const codeId = cost.budget_code_id;
      if (!codeId) continue;

      if (!costsByCode[codeId]) {
        costsByCode[codeId] = {
          jobToDateCostDetail: 0,
          directCosts: 0,
          pendingCostChanges: 0,
          committedCosts: 0,
          pendingBudgetChanges: 0,
        };
      }

      const costType = cost.direct_costs?.cost_type || "Invoice";
      const amount =
        cost.line_total ?? (cost.quantity ?? 0) * (cost.unit_cost ?? 0);

      if (JTD_COST_TYPES.includes(costType)) {
        costsByCode[codeId].jobToDateCostDetail += amount;
      }

      if (DIRECT_COST_TYPES.includes(costType)) {
        costsByCode[codeId].directCosts += amount;
      }
    }

    // Pending Cost Changes from Subcontracts
    for (const item of (subcontractSovRes.data || []) as Array<{
      budget_code: string | null;
      amount: number | null;
    }>) {
      const codeId = item.budget_code;
      if (!codeId) continue;
      if (!costsByCode[codeId]) {
        costsByCode[codeId] = {
          jobToDateCostDetail: 0,
          directCosts: 0,
          pendingCostChanges: 0,
          committedCosts: 0,
          pendingBudgetChanges: 0,
        };
      }
      costsByCode[codeId].pendingCostChanges += item.amount || 0;
    }

    // Pending Cost Changes from Purchase Orders
    for (const item of (poSovRes.data || []) as Array<{
      budget_code: string | null;
      amount: number | null;
    }>) {
      const codeId = item.budget_code;
      if (!codeId) continue;
      if (!costsByCode[codeId]) {
        costsByCode[codeId] = {
          jobToDateCostDetail: 0,
          directCosts: 0,
          pendingCostChanges: 0,
          committedCosts: 0,
          pendingBudgetChanges: 0,
        };
      }
      costsByCode[codeId].pendingCostChanges += item.amount || 0;
    }

    // Pending Budget Changes from Prime Contract Change Orders
    for (const item of (pendingPrimeChangeOrdersRes.data || []) as Array<{
      cost_code_id: string | null;
      amount: number | null;
    }>) {
      const codeId = item.cost_code_id;
      if (!codeId) continue;
      if (!costsByCode[codeId]) {
        costsByCode[codeId] = {
          jobToDateCostDetail: 0,
          directCosts: 0,
          pendingCostChanges: 0,
          committedCosts: 0,
          pendingBudgetChanges: 0,
        };
      }
      costsByCode[codeId].pendingBudgetChanges += item.amount || 0;
    }

    // Pending Cost Changes from Commitment Change Orders
    for (const item of (pendingCommitmentCOsRes.data || []) as Array<{
      cost_code_id: string | null;
      amount: number | null;
    }>) {
      const codeId = item.cost_code_id;
      if (!codeId) continue;
      if (!costsByCode[codeId]) {
        costsByCode[codeId] = {
          jobToDateCostDetail: 0,
          directCosts: 0,
          pendingCostChanges: 0,
          committedCosts: 0,
          pendingBudgetChanges: 0,
        };
      }
      costsByCode[codeId].pendingCostChanges += item.amount || 0;
    }

    // Committed Costs from Executed Subcontracts
    for (const item of (executedSubcontractSovRes.data || []) as Array<{
      budget_code: string | null;
      amount: number | null;
    }>) {
      const codeId = item.budget_code;
      if (!codeId) continue;
      if (!costsByCode[codeId]) {
        costsByCode[codeId] = {
          jobToDateCostDetail: 0,
          directCosts: 0,
          pendingCostChanges: 0,
          committedCosts: 0,
          pendingBudgetChanges: 0,
        };
      }
      costsByCode[codeId].committedCosts += item.amount || 0;
    }

    // Committed Costs from Executed Purchase Orders
    for (const item of (executedPoSovRes.data || []) as Array<{
      budget_code: string | null;
      amount: number | null;
    }>) {
      const codeId = item.budget_code;
      if (!codeId) continue;
      if (!costsByCode[codeId]) {
        costsByCode[codeId] = {
          jobToDateCostDetail: 0,
          directCosts: 0,
          pendingCostChanges: 0,
          committedCosts: 0,
          pendingBudgetChanges: 0,
        };
      }
      costsByCode[codeId].committedCosts += item.amount || 0;
    }

    // Committed Costs from Approved Commitment Change Orders
    for (const item of (approvedCommitmentCOsRes.data || []) as Array<{
      cost_code_id: string | null;
      amount: number | null;
    }>) {
      const codeId = item.cost_code_id;
      if (!codeId) continue;
      if (!costsByCode[codeId]) {
        costsByCode[codeId] = {
          jobToDateCostDetail: 0,
          directCosts: 0,
          pendingCostChanges: 0,
          committedCosts: 0,
          pendingBudgetChanges: 0,
        };
      }
      costsByCode[codeId].committedCosts += item.amount || 0;
    }

    // Transform to export format
    const exportData: ExportBudgetRow[] = ((budgetLinesRes.data || []) as unknown as Record<string, unknown>[]).map(
      (item: Record<string, unknown>) => {
        const costCode = item.cost_code as
          | { id?: string; title?: string; division_id?: string }
          | undefined;
        const costType = item.cost_type as
          | { code?: string; description?: string }
          | undefined;
        const costCodeId = item.cost_code_id as string;

        // Get cost data for this line item
        const costData = costsByCode[costCodeId] || {
          jobToDateCostDetail: 0,
          directCosts: 0,
          pendingCostChanges: 0,
          committedCosts: 0,
          pendingBudgetChanges: 0,
        };

        // Core budget values
        const originalBudgetAmount = parseFloat(item.original_amount as string) || 0;
        const budgetModifications = parseFloat(item.budget_mod_total as string) || 0;
        const approvedCOs = parseFloat(item.approved_co_total as string) || 0;
        const revisedBudget = parseFloat(item.revised_budget as string) || 0;

        // Calculated fields
        const projectedBudget = revisedBudget + costData.pendingBudgetChanges;
        const projectedCosts =
          costData.directCosts +
          costData.committedCosts +
          costData.pendingCostChanges;
        const forecastToComplete = Math.max(0, projectedBudget - projectedCosts);
        const estimatedCostAtCompletion = projectedCosts + forecastToComplete;
        const projectedOverUnder = projectedBudget - estimatedCostAtCompletion;

        return {
          "Cost Code": costCodeId,
          "Cost Type": costType?.code || "",
          "Description": (item.description as string) ||
            `${costCodeId} - ${costCode?.title || ""} ${costType?.code ? `(${costType.code})` : ""}`,
          "Unit Qty": item.quantity ? parseFloat(item.quantity as string) : "",
          "UOM": (item.unit_of_measure as string) || "",
          "Unit Cost": item.unit_cost ? parseFloat(item.unit_cost as string) : "",
          "Original Budget": originalBudgetAmount,
          "Budget Modifications": budgetModifications,
          "Approved Change Orders": approvedCOs,
          "Revised Budget": revisedBudget,
          "Job to Date Cost": costData.jobToDateCostDetail,
          "Direct Costs": costData.directCosts,
          "Pending Changes": costData.pendingBudgetChanges,
          "Committed Costs": costData.committedCosts,
          "Forecast to Complete": forecastToComplete,
          "Estimated Cost at Completion": estimatedCostAtCompletion,
          "Projected Over/Under": projectedOverUnder,
        };
      },
    );

    // Get project name for filename
    const { data: project } = await supabase
      .from("projects")
      .select("name")
      .eq("id", numericProjectId)
      .single();

    const projectName = project?.name || `Project-${projectId}`;
    const timestamp = new Date().toISOString().split('T')[0];
    const filename = `${projectName}-Budget-${timestamp}`;

    if (format === "csv") {
      // Generate CSV
      const worksheet = XLSX.utils.json_to_sheet(exportData);
      const csv = XLSX.utils.sheet_to_csv(worksheet);

      return new NextResponse(csv, {
        headers: {
          "Content-Type": "text/csv",
          "Content-Disposition": `attachment; filename="${filename}.csv"`,
        },
      });
    } else if (format === "pdf") {
      const moneyCols = [
        "Original Budget",
        "Budget Modifications",
        "Approved Change Orders",
        "Revised Budget",
        "Job to Date Cost",
        "Direct Costs",
        "Pending Changes",
        "Committed Costs",
        "Forecast to Complete",
        "Estimated Cost at Completion",
        "Projected Over/Under",
      ] as const;

      const columns = [
        { label: "Cost Code", align: "left" as const },
        { label: "Description", align: "left" as const },
        { label: "Original Budget", align: "right" as const },
        { label: "Budget Mods", align: "right" as const },
        { label: "Approved COs", align: "right" as const },
        { label: "Revised Budget", align: "right" as const },
        { label: "JTD Cost", align: "right" as const },
        { label: "Direct Costs", align: "right" as const },
        { label: "Pending Changes", align: "right" as const },
        { label: "Committed Costs", align: "right" as const },
        { label: "Forecast to Complete", align: "right" as const },
        { label: "Est. Cost at Completion", align: "right" as const },
        { label: "Projected +/-", align: "right" as const },
      ];

      const rows = exportData.map((item) => [
        item["Cost Code"],
        item["Description"],
        formatMoneyCell(item["Original Budget"]),
        formatMoneyCell(item["Budget Modifications"]),
        formatMoneyCell(item["Approved Change Orders"]),
        formatMoneyCell(item["Revised Budget"]),
        formatMoneyCell(item["Job to Date Cost"]),
        formatMoneyCell(item["Direct Costs"]),
        formatMoneyCell(item["Pending Changes"]),
        formatMoneyCell(item["Committed Costs"]),
        formatMoneyCell(item["Forecast to Complete"]),
        formatMoneyCell(item["Estimated Cost at Completion"]),
        formatMoneyCell(item["Projected Over/Under"]),
      ]);

      const grandTotals = exportData.reduce(
        (totals, item) => {
          for (const col of moneyCols) {
            totals[col] = (totals[col] || 0) + (typeof item[col] === "number" ? item[col] : 0);
          }
          return totals;
        },
        {} as Record<(typeof moneyCols)[number], number>,
      );

      rows.push([
        "",
        "Grand Totals",
        formatMoneyCell(grandTotals["Original Budget"]),
        formatMoneyCell(grandTotals["Budget Modifications"]),
        formatMoneyCell(grandTotals["Approved Change Orders"]),
        formatMoneyCell(grandTotals["Revised Budget"]),
        formatMoneyCell(grandTotals["Job to Date Cost"]),
        formatMoneyCell(grandTotals["Direct Costs"]),
        formatMoneyCell(grandTotals["Pending Changes"]),
        formatMoneyCell(grandTotals["Committed Costs"]),
        formatMoneyCell(grandTotals["Forecast to Complete"]),
        formatMoneyCell(grandTotals["Estimated Cost at Completion"]),
        formatMoneyCell(grandTotals["Projected Over/Under"]),
      ]);

      const bodyHtml = buildBrandedLogTableHtml({
        columns,
        rows,
        emptyMessage: "No budget line items found.",
      });

      const html = buildBrandedDocumentHtml({
        title: "Budget Report",
        subtitle: projectName,
        detail: `${exportData.length} line item${exportData.length === 1 ? "" : "s"}`,
        bodyHtml,
        renderFooterInBody: false,
        contentWidth: "100%",
      });

      const pdfBuffer = await renderPdfFromHtml(html, {
        landscape: true,
        footerTemplate: buildBrandedFooterTemplate(),
        marginBottom: BRANDED_FOOTER_MARGIN,
      });

      return new NextResponse(new Uint8Array(pdfBuffer), {
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": `attachment; filename="${filename}.pdf"`,
        },
      });
    } else {
      // Generate Excel
      const workbook = XLSX.utils.book_new();
      const worksheet = XLSX.utils.json_to_sheet(exportData);

      // Set column widths for better readability
      const columnWidths = [
        { wch: 12 }, // Cost Code
        { wch: 10 }, // Cost Type
        { wch: 30 }, // Description
        { wch: 10 }, // Unit Qty
        { wch: 8 },  // UOM
        { wch: 12 }, // Unit Cost
        { wch: 15 }, // Original Budget
        { wch: 18 }, // Budget Modifications
        { wch: 20 }, // Approved Change Orders
        { wch: 15 }, // Revised Budget
        { wch: 16 }, // Job to Date Cost
        { wch: 12 }, // Direct Costs
        { wch: 15 }, // Pending Changes
        { wch: 15 }, // Committed Costs
        { wch: 18 }, // Forecast to Complete
        { wch: 22 }, // Estimated Cost at Completion
        { wch: 18 }, // Projected Over/Under
      ];
      worksheet['!cols'] = columnWidths;

      // Add worksheet to workbook
      XLSX.utils.book_append_sheet(workbook, worksheet, "Budget Line Items");

      // Add a summary sheet with grand totals
      const grandTotals = exportData.reduce(
        (totals, item) => ({
          "Total Original Budget": totals["Total Original Budget"] + (typeof item["Original Budget"] === 'number' ? item["Original Budget"] : 0),
          "Total Budget Modifications": totals["Total Budget Modifications"] + (typeof item["Budget Modifications"] === 'number' ? item["Budget Modifications"] : 0),
          "Total Approved Change Orders": totals["Total Approved Change Orders"] + (typeof item["Approved Change Orders"] === 'number' ? item["Approved Change Orders"] : 0),
          "Total Revised Budget": totals["Total Revised Budget"] + (typeof item["Revised Budget"] === 'number' ? item["Revised Budget"] : 0),
          "Total Job to Date Cost": totals["Total Job to Date Cost"] + (typeof item["Job to Date Cost"] === 'number' ? item["Job to Date Cost"] : 0),
          "Total Direct Costs": totals["Total Direct Costs"] + (typeof item["Direct Costs"] === 'number' ? item["Direct Costs"] : 0),
          "Total Pending Changes": totals["Total Pending Changes"] + (typeof item["Pending Changes"] === 'number' ? item["Pending Changes"] : 0),
          "Total Committed Costs": totals["Total Committed Costs"] + (typeof item["Committed Costs"] === 'number' ? item["Committed Costs"] : 0),
          "Total Forecast to Complete": totals["Total Forecast to Complete"] + (typeof item["Forecast to Complete"] === 'number' ? item["Forecast to Complete"] : 0),
          "Total Estimated Cost at Completion": totals["Total Estimated Cost at Completion"] + (typeof item["Estimated Cost at Completion"] === 'number' ? item["Estimated Cost at Completion"] : 0),
          "Total Projected Over/Under": totals["Total Projected Over/Under"] + (typeof item["Projected Over/Under"] === 'number' ? item["Projected Over/Under"] : 0),
        }),
        {
          "Total Original Budget": 0,
          "Total Budget Modifications": 0,
          "Total Approved Change Orders": 0,
          "Total Revised Budget": 0,
          "Total Job to Date Cost": 0,
          "Total Direct Costs": 0,
          "Total Pending Changes": 0,
          "Total Committed Costs": 0,
          "Total Forecast to Complete": 0,
          "Total Estimated Cost at Completion": 0,
          "Total Projected Over/Under": 0,
        }
      );

      const summaryData = [
        { Field: "Line Items Count", Value: exportData.length },
        { Field: "Export Date", Value: new Date().toLocaleDateString() },
        { Field: "", Value: "" }, // Empty row
        ...Object.entries(grandTotals).map(([field, value]) => ({
          Field: field,
          Value: typeof value === 'number' ? value.toLocaleString('en-US', {
            style: 'currency',
            currency: 'USD'
          }) : value
        }))
      ];

      const summaryWorksheet = XLSX.utils.json_to_sheet(summaryData);
      summaryWorksheet['!cols'] = [{ wch: 30 }, { wch: 20 }];
      XLSX.utils.book_append_sheet(workbook, summaryWorksheet, "Summary");

      // Generate Excel buffer
      const excelBuffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });

      return new NextResponse(excelBuffer, {
        headers: {
          "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          "Content-Disposition": `attachment; filename="${filename}.xlsx"`,
        },
      });
    }
    },
);
