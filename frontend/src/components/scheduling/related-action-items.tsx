"use client";

import Link from "next/link";
import { format } from "date-fns";
import { CalendarDays, CheckCircle2, Circle, Clock, ArrowRight, ListChecks } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export interface RelatedScheduleActionItem {
  id: string;
  title: string | null;
  description: string;
  status: string;
  priority: string | null;
  due_date: string | null;
  assignee_name: string | null;
  assignee_email: string | null;
  project_id: number | null;
  schedule_task_id: string;
  created_at: string;
}

function formatDate(value: string | null): string | null {
  if (!value) return null;
  try {
    return format(new Date(value), "MMM d");
  } catch {
    return null;
  }
}

function actionItemHref(item: RelatedScheduleActionItem): string {
  const base = item.project_id ? `/${item.project_id}/tasks` : "/tasks";
  return `${base}?task=${item.id}`;
}

function statusIcon(status: string) {
  if (status === "done" || status === "cancelled") return CheckCircle2;
  if (status === "in_progress") return Clock;
  return Circle;
}

function statusLabel(status: string): string {
  return status.replace(/_/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());
}

export function RelatedActionItemsSummary({
  items,
  emptyText = "No related action items",
}: {
  items: RelatedScheduleActionItem[];
  emptyText?: string;
}) {
  if (items.length === 0) {
    return <span className="text-sm text-muted-foreground">{emptyText}</span>;
  }

  const openCount = items.filter((item) => !["done", "cancelled"].includes(item.status)).length;
  return (
    <span className="text-sm text-muted-foreground">
      {openCount} open of {items.length}
    </span>
  );
}

export function RelatedActionItemsList({
  items,
  compact = false,
}: {
  items: RelatedScheduleActionItem[];
  compact?: boolean;
}) {
  if (items.length === 0) {
    return (
      <div className="flex items-center gap-2 py-2 text-sm text-muted-foreground">
        <ListChecks className="h-4 w-4" />
        No action items are linked to this schedule task.
      </div>
    );
  }

  return (
    <div className={cn("divide-y divide-border", compact && "max-h-64 overflow-y-auto")}>
      {items.map((item) => {
        const StatusIcon = statusIcon(item.status);
        const dueDate = formatDate(item.due_date);
        return (
          <Link
            key={item.id}
            href={actionItemHref(item)}
            className="group flex items-start gap-3 py-3 text-sm hover:bg-muted/40"
          >
            <StatusIcon className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
            <span className="min-w-0 flex-1 space-y-1">
              <span className="block truncate font-medium text-foreground">
                {item.title || item.description}
              </span>
              <span className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                <Badge variant="outline" className="h-5 rounded px-1.5 text-[11px] font-normal">
                  {statusLabel(item.status)}
                </Badge>
                {item.priority && <span>{item.priority}</span>}
                {dueDate && (
                  <span className="inline-flex items-center gap-1">
                    <CalendarDays className="h-3 w-3" />
                    {dueDate}
                  </span>
                )}
                {(item.assignee_name || item.assignee_email) && (
                  <span>{item.assignee_name || item.assignee_email}</span>
                )}
              </span>
            </span>
            <ArrowRight className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
          </Link>
        );
      })}
    </div>
  );
}
