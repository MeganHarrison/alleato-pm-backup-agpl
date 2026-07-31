import * as React from "react";
import { cn } from "@/lib/utils";

interface StatProps {
  label: string;
  value: React.ReactNode;
  change?: {
    value: string;
    positive: boolean;
  };
  className?: string;
}

export function Stat({ label, value, change, className }: StatProps) {
  return (
    <div className={cn("space-y-0.5", className)}>
      <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
        {label}
      </p>
      <p className="text-2xl font-semibold tabular-nums text-foreground">{value}</p>
      {change && (
        <p className={cn(
          "text-xs font-medium",
          change.positive ? "text-status-success" : "text-destructive",
        )}>
          {change.positive ? "↑" : "↓"} {change.value}
        </p>
      )}
    </div>
  );
}

interface StatRowProps {
  children: React.ReactNode;
  className?: string;
  dividers?: boolean;
}

export function StatRow({ children, className, dividers = true }: StatRowProps) {
  return (
    <div className={cn(
      "flex flex-wrap gap-x-8 gap-y-4",
      dividers && "[&>*:not(:first-child)]:border-l [&>*:not(:first-child)]:border-border [&>*:not(:first-child)]:pl-8",
      className,
    )}>
      {children}
    </div>
  );
}
