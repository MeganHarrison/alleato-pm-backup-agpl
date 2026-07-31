"use client";

import { cn } from "@/lib/utils";

type DataQualitySeverity = "warning" | "info";

interface DataQualityCellIssue {
  id: string;
  label: string;
  severity: DataQualitySeverity;
}

interface DataQualityCellProps {
  issues: DataQualityCellIssue[];
}

export function DataQualityCell({ issues }: DataQualityCellProps) {
  if (issues.length === 0) {
    return <span className="text-xs text-muted-foreground">Ready</span>;
  }

  const primaryIssue = issues[0];
  const hiddenIssueCount = issues.length - 1;
  const summary = issues.map((issue) => issue.label).join(", ");

  return (
    <span
      className="inline-flex min-w-0 max-w-48 items-center gap-1 text-xs"
      title={summary}
      aria-label={`Data quality issues: ${summary}`}
    >
      <span
        className={cn(
          "truncate",
          primaryIssue.severity === "warning"
            ? "text-amber-700 dark:text-amber-300"
            : "text-muted-foreground",
        )}
      >
        {primaryIssue.label}
      </span>
      {hiddenIssueCount > 0 && (
        <span className="text-xs text-muted-foreground">+{hiddenIssueCount}</span>
      )}
    </span>
  );
}
