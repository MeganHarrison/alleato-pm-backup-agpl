"use client";

import { KpiBlock } from "@/components/ds/kpi";
import { EmptyState } from "@/components/ds/empty-state";
import { Calendar } from "lucide-react";
import type { PsrScheduleTask } from "@/types/psr.types";

interface PsrScheduleSectionProps {
  scheduleTasks: PsrScheduleTask[];
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

export function PsrScheduleSection({ scheduleTasks }: PsrScheduleSectionProps) {
  if (scheduleTasks.length === 0) {
    return (
      <EmptyState
        icon={<Calendar className="h-8 w-8" />}
        title="No schedule tasks"
        description="No schedule tasks have been created for this project."
      />
    );
  }

  // Compute summary stats
  const total = scheduleTasks.length;
  const completed = scheduleTasks.filter(
    (t) => t.status === "Complete",
  ).length;
  const inProgress = scheduleTasks.filter(
    (t) => t.status === "In Progress",
  ).length;
  const milestones = scheduleTasks.filter((t) => t.isMilestone).length;
  const avgComplete =
    total > 0
      ? Math.round(
          scheduleTasks.reduce((s, t) => s + (t.percentComplete ?? 0), 0) /
            total,
        )
      : 0;

  return (
    <div className="space-y-6">
      {/* Summary KPIs */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-5">
        <KpiBlock label="Total Tasks" value={String(total)} size="small" />
        <KpiBlock label="Completed" value={String(completed)} size="small" />
        <KpiBlock label="In Progress" value={String(inProgress)} size="small" />
        <KpiBlock label="Milestones" value={String(milestones)} size="small" />
        <KpiBlock label="Avg % Complete" value={`${avgComplete}%`} size="small" />
      </div>

      {/* Task list */}
      <div className="overflow-x-auto rounded-md border border-border">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-muted">
              <th className="px-4 py-2 text-left font-medium text-muted-foreground">Task Name</th>
              <th className="px-4 py-2 text-right font-medium text-muted-foreground">Duration</th>
              <th className="px-4 py-2 text-left font-medium text-muted-foreground">Start</th>
              <th className="px-4 py-2 text-left font-medium text-muted-foreground">Finish</th>
              <th className="px-4 py-2 text-right font-medium text-muted-foreground">% Complete</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {scheduleTasks.map((t) => (
              <tr
                key={t.id}
                className={`hover:bg-muted/30 ${t.isMilestone ? "font-medium" : ""}`}
              >
                <td className="px-4 py-2 text-foreground">
                  {t.isMilestone && (
                    <span className="mr-1 text-primary">◆</span>
                  )}
                  {t.name}
                </td>
                <td className="px-4 py-2 text-right tabular-nums text-muted-foreground">
                  {t.duration != null ? `${t.duration}d` : "—"}
                </td>
                <td className="px-4 py-2 text-muted-foreground tabular-nums">
                  {formatDate(t.startDate)}
                </td>
                <td className="px-4 py-2 text-muted-foreground tabular-nums">
                  {formatDate(t.finishDate)}
                </td>
                <td className="px-4 py-2 text-right tabular-nums text-muted-foreground">
                  {t.percentComplete != null ? `${t.percentComplete}%` : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
