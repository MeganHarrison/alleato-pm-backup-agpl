"use client";

import type { PsrBudgetLine, PsrBudgetGrandTotals } from "@/types/psr.types";

interface PsrBudgetTableProps {
  budgetLines: PsrBudgetLine[];
  grandTotals: PsrBudgetGrandTotals;
}

function fmt(n: number): string {
  if (n === 0) return "$0.00";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n);
}

interface Column {
  key: keyof PsrBudgetLine;
  label: string;
  align: "left" | "right";
  sticky: boolean;
}

const COLUMNS: Column[] = [
  { key: "budgetCode", label: "Budget Code", align: "left", sticky: true },
  { key: "originalBudget", label: "Original Budget", align: "right", sticky: false },
  { key: "budgetModifications", label: "Budget Modifications", align: "right", sticky: false },
  { key: "contractChangeOrders", label: "Contract Change Orders", align: "right", sticky: false },
  { key: "revisedBudget", label: "Revised Budget", align: "right", sticky: false },
  { key: "actualAmount", label: "Actual Amount", align: "right", sticky: false },
  { key: "pendingBudgetChanges", label: "Pending Budget Changes", align: "right", sticky: false },
  { key: "projectedBudget", label: "Projected Budget", align: "right", sticky: false },
  { key: "directCosts", label: "Direct Costs", align: "right", sticky: false },
  { key: "commitments", label: "Commitments", align: "right", sticky: false },
  { key: "commitmentChangeOrders", label: "Commitment Change Orders", align: "right", sticky: false },
  { key: "committedCosts", label: "Committed Costs", align: "right", sticky: false },
  { key: "projectedCosts", label: "Projected Costs", align: "right", sticky: false },
  { key: "committedInvoicedAmount", label: "Committed Invoiced Amount", align: "right", sticky: false },
  { key: "pendingCostChanges", label: "Pending Cost Changes", align: "right", sticky: false },
  { key: "forecastToComplete", label: "Forecast To Complete", align: "right", sticky: false },
  { key: "estimatedCostAtCompletion", label: "Estimated Cost at Completion", align: "right", sticky: false },
  { key: "projectOverUnder", label: "Project Over/Under", align: "right", sticky: false },
];

function getCellValue(line: PsrBudgetLine, key: keyof PsrBudgetLine): string {
  if (key === "budgetCode") return line.budgetCode;
  const v = line[key];
  return typeof v === "number" ? fmt(v) : String(v);
}

export function PsrBudgetTable({ budgetLines, grandTotals }: PsrBudgetTableProps) {
  if (budgetLines.length === 0) {
    return (
      <p className="text-sm text-muted-foreground py-4">No budget lines found.</p>
    );
  }

  return (
    <div className="overflow-x-auto rounded-md border border-border">
      <table className="w-full text-xs whitespace-nowrap">
        <thead>
          <tr className="bg-muted">
            {COLUMNS.map((col) => (
              <th
                key={col.key}
                className={`px-3 py-2 font-semibold text-muted-foreground ${
                  col.align === "right" ? "text-right" : "text-left"
                } ${col.sticky ? "sticky left-0 bg-muted z-10 min-w-[200px]" : ""}`}
              >
                {col.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {budgetLines.map((line, i) => (
            <tr key={i} className="hover:bg-muted/30">
              {COLUMNS.map((col) => (
                <td
                  key={col.key}
                  className={`px-3 py-1.5 tabular-nums ${
                    col.align === "right" ? "text-right" : "text-left"
                  } ${
                    col.sticky
                      ? "sticky left-0 bg-card z-10 font-medium text-foreground"
                      : "text-muted-foreground"
                  }`}
                >
                  {getCellValue(line, col.key)}
                </td>
              ))}
            </tr>
          ))}

          {/* Grand totals row */}
          <tr className="bg-muted font-semibold">
            <td className="sticky left-0 bg-muted z-10 px-3 py-2 text-foreground">
              Grand Total
            </td>
            <td className="px-3 py-2 text-right tabular-nums">{fmt(grandTotals.originalBudget)}</td>
            <td className="px-3 py-2" />
            <td className="px-3 py-2" />
            <td className="px-3 py-2 text-right tabular-nums">{fmt(grandTotals.revisedBudget)}</td>
            <td className="px-3 py-2 text-right tabular-nums">{fmt(grandTotals.actualAmount)}</td>
            <td className="px-3 py-2" />
            <td className="px-3 py-2" />
            <td className="px-3 py-2" />
            <td className="px-3 py-2" />
            <td className="px-3 py-2" />
            <td className="px-3 py-2 text-right tabular-nums">{fmt(grandTotals.committedCosts)}</td>
            <td className="px-3 py-2" />
            <td className="px-3 py-2" />
            <td className="px-3 py-2" />
            <td className="px-3 py-2 text-right tabular-nums">{fmt(grandTotals.forecastToComplete)}</td>
            <td className="px-3 py-2 text-right tabular-nums">{fmt(grandTotals.estimatedCostAtCompletion)}</td>
            <td
              className={`px-3 py-2 text-right tabular-nums ${
                grandTotals.projectOverUnder < 0 ? "text-red-600" : "text-green-700"
              }`}
            >
              {fmt(grandTotals.projectOverUnder)}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}
