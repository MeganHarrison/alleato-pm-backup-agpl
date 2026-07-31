"use client";

import { StatusBadge } from "@/components/ds/status-badge";
import { EmptyState } from "@/components/ds/empty-state";
import { MessageCircle } from "lucide-react";
import type { PsrRfi } from "@/types/psr.types";

interface PsrRfisSectionProps {
  rfis: PsrRfi[];
}

function formatDate(d: string | null): string {
  if (!d) return "—";
  try {
    return new Date(d + "T00:00:00").toLocaleDateString("en-US", {
      month: "numeric",
      day: "numeric",
      year: "numeric",
    });
  } catch {
    return d;
  }
}

export function PsrRfisSection({ rfis }: PsrRfisSectionProps) {
  if (rfis.length === 0) {
    return (
      <EmptyState
        icon={<MessageCircle className="h-8 w-8" />}
        title="No RFIs"
        description="No RFIs have been created for this project."
      />
    );
  }

  return (
    <div className="overflow-x-auto rounded-md border border-border">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-muted">
            <th className="px-4 py-2 text-left font-medium text-muted-foreground">#</th>
            <th className="px-4 py-2 text-left font-medium text-muted-foreground">Subject</th>
            <th className="px-4 py-2 text-left font-medium text-muted-foreground">Status</th>
            <th className="px-4 py-2 text-left font-medium text-muted-foreground">Due Date</th>
            <th className="px-4 py-2 text-left font-medium text-muted-foreground">Ball in Court</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {rfis.map((r, i) => (
            <tr key={i} className="hover:bg-muted/30">
              <td className="px-4 py-2 tabular-nums text-muted-foreground">{r.number}</td>
              <td className="px-4 py-2 text-foreground">{r.subject}</td>
              <td className="px-4 py-2">
                <StatusBadge status={r.status} />
              </td>
              <td className="px-4 py-2 text-muted-foreground tabular-nums">
                {formatDate(r.dueDate)}
              </td>
              <td className="px-4 py-2 text-muted-foreground">{r.ballInCourt ?? "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
