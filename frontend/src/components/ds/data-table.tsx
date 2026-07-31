"use client";

import type * as React from "react";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// DataTable — The ONE table component. Correct styling baked in.
//
// - 11px uppercase tracking-wider headers
// - Primary column in font-medium text-foreground
// - Subtle dividers (divide-border)
// - Row hover (hover:bg-muted)
// - Tabular nums on right-aligned columns
// ---------------------------------------------------------------------------

interface TableColumn<T> {
  key: string;
  header: string;
  align?: "left" | "right";
  render: (row: T) => React.ReactNode;
  /** Mark the identifier/name column — renders in font-medium text-foreground */
  primary?: boolean;
  /** Optional width class (e.g. "w-48", "w-24") */
  width?: string;
}

interface DataTableProps<T> {
  columns: TableColumn<T>[];
  rows: T[];
  onRowClick?: (row: T) => void;
  emptyMessage?: string;
  className?: string;
}

export type { TableColumn, DataTableProps };

export function DataTable<T extends { id: string | number }>({
  columns,
  rows,
  onRowClick,
  emptyMessage = "No data available",
  className,
}: DataTableProps<T>) {
  if (rows.length === 0) {
    return (
      <div className="py-16 text-center">
        <p className="text-sm text-muted-foreground">{emptyMessage}</p>
      </div>
    );
  }

  return (
    <div className={cn("w-full overflow-x-auto", className)}>
      <table className="w-full">
        <thead>
          <tr className="border-b border-border">
            {columns.map((col) => (
              <th
                key={col.key}
                className={cn(
                  "py-2 px-3 text-[10px] font-semibold uppercase tracking-[0.04em] text-muted-foreground whitespace-nowrap",
                  col.align === "right" ? "text-right" : "text-left",
                  col.width
                )}
              >
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {rows.map((row) => (
            <tr
              key={row.id}
              onClick={() => onRowClick?.(row)}
              className={cn(
                "transition-colors",
                onRowClick && "cursor-pointer hover:bg-muted"
              )}
            >
              {columns.map((col) => (
                <td
                  key={col.key}
                  className={cn(
                    "px-3 py-3 text-sm",
                    col.primary
                      ? "font-medium text-foreground"
                      : "text-muted-foreground",
                    col.align === "right" && "text-right tabular-nums",
                    col.width
                  )}
                >
                  {col.render(row)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
