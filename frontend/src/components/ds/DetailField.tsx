import * as React from "react";
import { formatCurrency, formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// DetailField — a single label + value pair for read-only detail views
// ---------------------------------------------------------------------------

export interface DetailFieldProps {
  label: string;
  children?: React.ReactNode;
  /** Backward-compatible alias for children. Prefer children for new usage. */
  value?: React.ReactNode;
  /** Render a primitive value as currency. */
  currency?: boolean;
  /** Render a primitive value as a date. */
  date?: boolean;
  /** Span multiple columns in a DetailFieldGrid. */
  span?: 1 | 2 | 3;
  /** Show a dash when value is empty/null/undefined */
  emptyPlaceholder?: string;
  className?: string;
}

const spanClass: Record<1 | 2 | 3, string> = {
  1: "",
  2: "sm:col-span-2",
  3: "sm:col-span-2 lg:col-span-3",
};

function isEmptyValue(value: React.ReactNode): boolean {
  return value === null || value === undefined || value === "";
}

function formatDetailValue({
  value,
  currency,
  date,
}: {
  value: React.ReactNode;
  currency?: boolean;
  date?: boolean;
}): React.ReactNode {
  if (currency && (typeof value === "number" || typeof value === "string")) {
    return formatCurrency(value);
  }

  if (date && (typeof value === "string" || value instanceof Date)) {
    return formatDate(value);
  }

  return value;
}

export function DetailField({
  label,
  children,
  value,
  currency,
  date,
  span = 1,
  emptyPlaceholder = "—",
  className,
}: DetailFieldProps) {
  const rawValue = children ?? value;
  const isEmpty = isEmptyValue(rawValue);
  const displayValue = isEmpty
    ? emptyPlaceholder
    : formatDetailValue({ value: rawValue, currency, date });

  return (
    <div
      className={cn(
        "grid min-w-0 grid-cols-[8rem_minmax(0,1fr)] items-start gap-4 sm:grid-cols-[9rem_minmax(0,1fr)]",
        spanClass[span],
        className,
      )}
    >
      <p className="min-w-0 pt-0.5 text-xs text-muted-foreground">{label}</p>
      <div className="min-w-0 flex-1 break-words text-sm text-foreground">
        {isEmpty ? (
          <span className="text-muted-foreground/50">{displayValue}</span>
        ) : (
          displayValue
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// DetailFieldGrid — responsive grid layout for DetailField groups
// ---------------------------------------------------------------------------

export interface DetailFieldGridProps {
  children: React.ReactNode;
  columns?: 1 | 2 | 3 | 4;
  /** Backward-compatible alias for columns. Prefer columns for new usage. */
  cols?: 1 | 2 | 3 | 4;
  className?: string;
}

const colClass: Record<1 | 2 | 3 | 4, string> = {
  1: "",
  2: "sm:grid-cols-2",
  3: "sm:grid-cols-2 lg:grid-cols-3",
  4: "sm:grid-cols-2 lg:grid-cols-4",
};

export function DetailFieldGrid({
  children,
  columns,
  cols,
  className,
}: DetailFieldGridProps) {
  const resolvedColumns = columns ?? cols ?? 3;

  return (
    <div
      className={cn(
        "grid grid-cols-1 gap-x-8 gap-y-6",
        colClass[resolvedColumns],
        className,
      )}
    >
      {children}
    </div>
  );
}
