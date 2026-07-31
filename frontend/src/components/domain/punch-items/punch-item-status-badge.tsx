"use client";

import { Badge } from "@/components/ui/badge";

const STATUS_CONFIG: Record<string, { label: string; className: string }> = {
  draft: {
    label: "Draft",
    className: "bg-muted text-muted-foreground hover:bg-muted",
  },
  work_required: {
    label: "Work Required",
    className: "bg-orange-500/10 text-orange-600 dark:text-orange-400 hover:bg-orange-500/10",
  },
  initiated: {
    label: "Initiated",
    className: "bg-primary/10 text-primary hover:bg-primary/10",
  },
  closed: {
    label: "Closed",
    className: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/10",
  },
};

const PRIORITY_CONFIG: Record<string, { label: string; className: string }> = {
  low: {
    label: "Low",
    className: "bg-muted text-muted-foreground hover:bg-muted",
  },
  medium: {
    label: "Medium",
    className: "bg-amber-500/10 text-amber-600 dark:text-amber-400 hover:bg-amber-500/10",
  },
  high: {
    label: "High",
    className: "bg-destructive/10 text-destructive hover:bg-destructive/10",
  },
};

interface PunchItemStatusBadgeProps {
  status: string;
}

export function PunchItemStatusBadge({ status }: PunchItemStatusBadgeProps) {
  const config = STATUS_CONFIG[status] || {
    label: status,
    className: "bg-muted text-foreground",
  };

  return <Badge className={config.className}>{config.label}</Badge>;
}

interface PunchItemPriorityBadgeProps {
  priority: string | null;
}

export function PunchItemPriorityBadge({
  priority,
}: PunchItemPriorityBadgeProps) {
  if (!priority) return <span className="text-muted-foreground">-</span>;

  const config = PRIORITY_CONFIG[priority] || {
    label: priority,
    className: "bg-muted text-foreground",
  };

  return <Badge className={config.className}>{config.label}</Badge>;
}
