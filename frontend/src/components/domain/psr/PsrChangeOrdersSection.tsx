"use client";

import { StatusBadge } from "@/components/ds/status-badge";
import { EmptyState } from "@/components/ds/empty-state";
import { ClipboardList } from "lucide-react";
import type { PsrChangeOrder } from "@/types/psr.types";

interface PsrChangeOrdersSectionProps {
  changeOrders: PsrChangeOrder[];
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

export function PsrChangeOrdersSection({ changeOrders }: PsrChangeOrdersSectionProps) {
  if (changeOrders.length === 0) {
    return (
      <EmptyState
        icon={<ClipboardList className="h-8 w-8" />}
        title="No change orders"
        description="No contract change orders have been recorded for this project."
      />
    );
  }

  const totalAmount = changeOrders.reduce((s, co) => s + co.amount, 0);

  return (
    <div className="overflow-x-auto rounded-md border border-border">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-muted">
            <th className="px-4 py-2 text-left font-medium text-muted-foreground">Status</th>
            <th className="px-4 py-2 text-left font-medium text-muted-foreground">#</th>
            <th className="px-4 py-2 text-left font-medium text-muted-foreground">Description</th>
            <th className="px-4 py-2 text-right font-medium text-muted-foreground">Amount</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {changeOrders.map((co, i) => (
            <tr key={i} className="hover:bg-muted/30">
              <td className="px-4 py-2">
                <StatusBadge status={co.status} />
              </td>
              <td className="px-4 py-2 tabular-nums text-muted-foreground">
                {co.number ?? "—"}
              </td>
              <td className="px-4 py-2 text-foreground">{co.description ?? "—"}</td>
              <td className="px-4 py-2 text-right tabular-nums font-medium">
                {fmt(co.amount)}
              </td>
            </tr>
          ))}

          {/* Totals row */}
          <tr className="bg-muted font-semibold">
            <td colSpan={3} className="px-4 py-2 text-foreground">
              Total
            </td>
            <td className="px-4 py-2 text-right tabular-nums">{fmt(totalAmount)}</td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}
