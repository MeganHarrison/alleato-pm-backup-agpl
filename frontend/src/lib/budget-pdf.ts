import type {
  BudgetLineItem,
  GrandTotals,
} from "@/lib/budget/compute-grand-totals";

function esc(value: string | number | null | undefined): string {
  if (value == null) return "";
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function fmtCurrency(value: number | null | undefined): string {
  const amount = value ?? 0;
  const formatted = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(Math.abs(amount));
  return amount < 0 ? `(${formatted})` : formatted;
}

export interface BudgetPdfData {
  projectName: string | null;
  projectNumber: string | null;
  lineItems: BudgetLineItem[];
  grandTotals: GrandTotals;
}

interface DivisionGroup {
  code: string;
  title: string;
  items: BudgetLineItem[];
  totals: Record<NumericColumnKey, number>;
}

const NUMERIC_COLUMNS = [
  ["originalBudgetAmount", "Original"],
  ["budgetModifications", "Budget Mods"],
  ["approvedCOs", "Approved COs"],
  ["revisedBudget", "Revised Budget"],
  ["committedCosts", "Committed Costs"],
  ["directCosts", "Direct Costs"],
  ["pendingCostChanges", "Pending Cost Changes"],
  ["forecastToComplete", "Forecast to Complete"],
  ["estimatedCostAtCompletion", "Est. at Completion"],
  ["projectedOverUnder", "Over / Under"],
] as const;

type NumericColumnKey = (typeof NUMERIC_COLUMNS)[number][0];

function groupByDivision(lineItems: BudgetLineItem[]): DivisionGroup[] {
  const groups = new Map<string, DivisionGroup>();
  for (const item of lineItems) {
    const code = item.costCode.split("-")[0] || item.costCode;
    let group = groups.get(code);
    if (!group) {
      group = {
        code,
        title: "",
        items: [],
        totals: {
          originalBudgetAmount: 0,
          budgetModifications: 0,
          approvedCOs: 0,
          revisedBudget: 0,
          committedCosts: 0,
          directCosts: 0,
          pendingCostChanges: 0,
          forecastToComplete: 0,
          estimatedCostAtCompletion: 0,
          projectedOverUnder: 0,
        },
      };
      groups.set(code, group);
    }
    if (!group.title && item.divisionTitle) {
      group.title = item.divisionTitle;
    }
    group.items.push(item);
    for (const [key] of NUMERIC_COLUMNS) {
      group.totals[key] += item[key] || 0;
    }
  }
  return Array.from(groups.values()).sort((a, b) =>
    a.code.localeCompare(b.code),
  );
}

/** Builds the printable HTML for the project budget (rendered to PDF). */
export function buildBudgetPdfHtml(data: BudgetPdfData): string {
  const printedOn = new Date().toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  const groups = groupByDivision(data.lineItems);

  const numericCells = (source: Record<NumericColumnKey, number>) =>
    NUMERIC_COLUMNS.map(
      ([key]) => `<td class="amount">${fmtCurrency(source[key])}</td>`,
    ).join("");

  const bodyRows = groups
    .map((group) => {
      const header = `
        <tr class="division">
          <td>${esc(group.title && !group.title.startsWith(group.code) ? `${group.code} ${group.title}` : group.title || group.code)}</td>
          ${numericCells(group.totals)}
        </tr>`;
      const lines = group.items
        .map((item) => {
          const label = `${item.costCode}${item.costCodeDescription ? ` - ${item.costCodeDescription}` : ""}${item.costType ? `.${item.costType}` : ""}`;
          return `
        <tr>
          <td class="line">${esc(label)}</td>
          ${numericCells(item)}
        </tr>`;
        })
        .join("");
      return header + lines;
    })
    .join("");

  const grandTotalRow = `
    <tr class="grand-total">
      <td>Grand Totals</td>
      ${numericCells(data.grandTotals)}
    </tr>`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>Budget — ${esc(data.projectName || "Project")}</title>
  <style>
    * { box-sizing: border-box; }
    body {
      margin: 0;
      font-family: Arial, Helvetica, sans-serif;
      color: #1f2937;
      background: #ffffff;
      font-size: 9px;
    }
    .header {
      display: flex;
      justify-content: space-between;
      align-items: flex-end;
      gap: 24px;
      margin-bottom: 14px;
      border-bottom: 2px solid #e5e7eb;
      padding-bottom: 10px;
    }
    .header h1 {
      margin: 0 0 4px;
      font-size: 20px;
      font-weight: 600;
      color: #111827;
    }
    .eyebrow { color: #6b7280; font-size: 10px; }
    .meta { text-align: right; color: #4b5563; line-height: 1.5; }
    table { width: 100%; border-collapse: collapse; }
    th, td {
      padding: 4px 6px;
      border-bottom: 1px solid #e5e7eb;
      text-align: left;
      vertical-align: top;
    }
    th {
      font-size: 8px;
      letter-spacing: 0.04em;
      text-transform: uppercase;
      color: #6b7280;
      font-weight: 600;
      white-space: nowrap;
    }
    th.amount, td.amount { text-align: right; white-space: nowrap; }
    tr.division td {
      font-weight: 700;
      background: #f3f4f6;
      color: #111827;
    }
    td.line { padding-left: 14px; }
    tr.grand-total td {
      font-weight: 700;
      border-top: 2px solid #111827;
      border-bottom: none;
      color: #111827;
    }
  </style>
</head>
<body>
  <div class="header">
    <div>
      <div class="eyebrow">Budget</div>
      <h1>${esc(data.projectName || "Project Budget")}</h1>
      <div class="eyebrow">${esc(data.projectNumber || "")}</div>
    </div>
    <div class="meta">
      <div>Printed ${esc(printedOn)}</div>
      <div>${data.lineItems.length} budget line${data.lineItems.length === 1 ? "" : "s"}</div>
    </div>
  </div>

  <table>
    <thead>
      <tr>
        <th>Description</th>
        ${NUMERIC_COLUMNS.map(([, label]) => `<th class="amount">${esc(label)}</th>`).join("")}
      </tr>
    </thead>
    <tbody>
      ${bodyRows || `<tr><td colspan="${NUMERIC_COLUMNS.length + 1}" style="text-align:center;color:#6b7280;padding:16px;">No budget line items</td></tr>`}
      ${grandTotalRow}
    </tbody>
  </table>
</body>
</html>`;
}
