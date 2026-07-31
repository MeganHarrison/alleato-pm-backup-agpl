"use client";

import { StatusBadge } from "@/components/ds/status-badge";
import { EmptyState } from "@/components/ds/empty-state";
import { Package } from "lucide-react";
import type { PsrSubmittal } from "@/types/psr.types";

interface PsrSubmittalsSectionProps {
  submittals: PsrSubmittal[];
}

export function PsrSubmittalsSection({ submittals }: PsrSubmittalsSectionProps) {
  if (submittals.length === 0) {
    return (
      <EmptyState
        icon={<Package className="h-8 w-8" />}
        title="No submittals"
        description="No submittals have been created for this project."
      />
    );
  }

  return (
    <div className="overflow-x-auto rounded-md border border-border">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-muted">
            <th className="px-4 py-2 text-left font-medium text-muted-foreground">Number</th>
            <th className="px-4 py-2 text-left font-medium text-muted-foreground">Title</th>
            <th className="px-4 py-2 text-left font-medium text-muted-foreground">Status</th>
            <th className="px-4 py-2 text-left font-medium text-muted-foreground">Ball in Court</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {submittals.map((s, i) => (
            <tr key={i} className="hover:bg-muted/30">
              <td className="px-4 py-2 tabular-nums text-muted-foreground">{s.submittalNumber}</td>
              <td className="px-4 py-2 text-foreground">{s.title}</td>
              <td className="px-4 py-2">
                <StatusBadge status={s.status} />
              </td>
              <td className="px-4 py-2 text-muted-foreground">{s.ballInCourt ?? "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
