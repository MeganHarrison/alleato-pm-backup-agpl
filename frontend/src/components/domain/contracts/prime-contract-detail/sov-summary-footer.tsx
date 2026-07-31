import type { ReactNode } from "react";

import { InlineTableRow } from "@/components/ds/inline-table";

export interface SovSummaryValues {
  subtotal: number;
  originalContract: number;
  approvedChanges: number;
  contractTotal: number;
  billedToDate: number;
  amountRemaining: number;
}

interface BuildSovSummaryValuesParams {
  subtotal: number;
  originalContract?: number | null;
  approvedChanges?: number | null;
  billedToDate?: number | null;
}

export function buildSovSummaryValues({
  subtotal,
  originalContract,
  approvedChanges,
  billedToDate,
}: BuildSovSummaryValuesParams): SovSummaryValues {
  const normalizedSubtotal = Number(subtotal) || 0;
  const normalizedOriginal =
    originalContract == null ? normalizedSubtotal : Number(originalContract) || 0;
  const normalizedApprovedChanges = Number(approvedChanges) || 0;
  const normalizedBilledToDate = Number(billedToDate) || 0;
  const contractTotal = normalizedOriginal + normalizedApprovedChanges;

  return {
    subtotal: normalizedSubtotal,
    originalContract: normalizedOriginal,
    approvedChanges: normalizedApprovedChanges,
    contractTotal,
    billedToDate: normalizedBilledToDate,
    amountRemaining: contractTotal - normalizedBilledToDate,
  };
}

interface SovSummaryFooterRowsProps {
  summary: SovSummaryValues;
  formatCurrency: (value: number | null | undefined) => string;
  labelColSpan: number;
  valueColSpan?: number;
  trailingColSpan?: number;
  renderRow?: (children: ReactNode, key: string) => ReactNode;
}

export function SovSummaryFooterRows({
  summary,
  formatCurrency,
  labelColSpan,
  valueColSpan = 1,
  trailingColSpan = 1,
  renderRow,
}: SovSummaryFooterRowsProps) {
  const rows = [
    { key: "subtotal", label: "Subtotal", value: summary.subtotal },
    { key: "original-contract", label: "Original Contract", value: summary.originalContract },
    { key: "approved-changes", label: "Approved Changes", value: summary.approvedChanges },
    { key: "contract-total", label: "Contract Total", value: summary.contractTotal, bold: true },
    { key: "billed-to-date", label: "Billed to Date", value: summary.billedToDate },
    { key: "amount-remaining", label: "Amount Remaining", value: summary.amountRemaining, bold: true, large: true },
  ];

  return (
    <>
      {rows.map((row, index) => {
        const isLarge = "large" in row && row.large;
        const isFirst = index === 0;
        const content = (
          <>
            <td
              colSpan={labelColSpan}
              className={`border-r border-border/70 px-1 py-2 text-right ${isLarge ? "text-sm" : "text-xs"} ${row.bold ? "font-semibold" : "font-medium"} text-foreground`}
            >
              {row.label}:
            </td>
            <td
              colSpan={valueColSpan}
              className={`px-1 py-2 text-right ${isLarge ? "text-sm" : "text-xs"} ${row.bold ? "font-semibold" : "font-normal"} tabular-nums ${row.key === "approved-changes" || row.key === "billed-to-date" ? "text-primary" : "text-foreground"}`}
            >
              {formatCurrency(row.value)}
            </td>
            {trailingColSpan > 0 ? (
              <td colSpan={trailingColSpan} className="px-1 py-2" />
            ) : null}
          </>
        );

        if (renderRow) {
          return renderRow(content, row.key);
        }

        return (
          <InlineTableRow
            key={`sov-summary-${row.key}`}
            className={`bg-background hover:bg-background${isFirst ? " border-t border-border/50" : ""}`}
          >
            {content}
          </InlineTableRow>
        );
      })}
    </>
  );
}
