"use client";

import { StatusBadge } from "@/components/ds/status-badge";
import { EmptyState } from "@/components/ds/empty-state";
import { Clock } from "lucide-react";
import type { PsrChangeRequest } from "@/types/psr.types";

interface PsrChangeRequestsSectionProps {
  changeRequests: PsrChangeRequest[];
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

export function PsrChangeRequestsSection({
  changeRequests,
}: PsrChangeRequestsSectionProps) {
  if (changeRequests.length === 0) {
    return (
      <EmptyState
        icon={<Clock className="h-8 w-8" />}
        title="No change requests"
        description="No change requests have been created for this project."
      />
    );
  }

  const totalCost = changeRequests.reduce((s, cr) => s + cr.cost, 0);
  const totalMarkup = changeRequests.reduce((s, cr) => s + cr.markup, 0);
  const totalTotal = changeRequests.reduce((s, cr) => s + cr.total, 0);

  return (
    <div className="overflow-x-auto rounded-md border border-border">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-muted">
            <th className="px-4 py-2 text-left font-medium text-muted-foreground">Number</th>
            <th className="px-4 py-2 text-left font-medium text-muted-foreground">Title</th>
            <th className="px-4 py-2 text-left font-medium text-muted-foreground">Scope</th>
            <th className="px-4 py-2 text-left font-medium text-muted-foreground">Status</th>
            <th className="px-4 py-2 text-right font-medium text-muted-foreground">Cost</th>
            <th className="px-4 py-2 text-right font-medium text-muted-foreground">Markup</th>
            <th className="px-4 py-2 text-right font-medium text-muted-foreground">Total</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {changeRequests.map((cr, i) => (
            <tr key={i} className="hover:bg-muted/30">
              <td className="px-4 py-2 tabular-nums text-muted-foreground">{cr.number}</td>
              <td className="px-4 py-2 text-foreground">{cr.title}</td>
              <td className="px-4 py-2 text-muted-foreground">{cr.scope}</td>
              <td className="px-4 py-2">
                <StatusBadge status={cr.status} />
              </td>
              <td className="px-4 py-2 text-right tabular-nums text-muted-foreground">
                {fmt(cr.cost)}
              </td>
              <td className="px-4 py-2 text-right tabular-nums text-muted-foreground">
                {fmt(cr.markup)}
              </td>
              <td className="px-4 py-2 text-right tabular-nums text-foreground font-medium">
                {fmt(cr.total)}
              </td>
            </tr>
          ))}

          {/* Totals row */}
          <tr className="bg-muted font-semibold">
            <td colSpan={4} className="px-4 py-2 text-foreground">
              Total
            </td>
            <td className="px-4 py-2 text-right tabular-nums">{fmt(totalCost)}</td>
            <td className="px-4 py-2 text-right tabular-nums">{fmt(totalMarkup)}</td>
            <td className="px-4 py-2 text-right tabular-nums">{fmt(totalTotal)}</td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}
