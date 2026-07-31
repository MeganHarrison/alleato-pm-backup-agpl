"use client";

import * as React from "react";
import type { ReactNode } from "react";

import { EmptyState } from "@/components/ds";
import { SectionRuleHeading } from "@/components/layout/spacing";
import { cn } from "@/lib/utils";

export interface BoardColumnDefinition {
  id: string;
  label: string;
  laneClassName?: string;
  countClassName?: string;
  emptyLabel?: string;
}

interface BoardViewProps<T> {
  columns: BoardColumnDefinition[];
  items: T[];
  getItemId: (item: T) => string;
  getColumnId: (item: T) => string;
  renderCard: (item: T) => ReactNode;
  sortItems?: (items: T[]) => T[];
  className?: string;
  columnsClassName?: string;
}

export function BoardView<T>({
  columns,
  items,
  getItemId,
  getColumnId,
  renderCard,
  sortItems,
  className,
  columnsClassName,
}: BoardViewProps<T>) {
  const groupedItems = React.useMemo(() => {
    const groups = new Map<string, T[]>();

    for (const column of columns) {
      groups.set(column.id, []);
    }

    for (const item of items) {
      const columnId = getColumnId(item);
      const current = groups.get(columnId);
      if (current) current.push(item);
    }

    if (!sortItems) return groups;

    for (const [columnId, columnItems] of groups.entries()) {
      groups.set(columnId, sortItems(columnItems));
    }

    return groups;
  }, [columns, getColumnId, items, sortItems]);

  return (
    <div
      data-board-view
      className={cn(
        "grid gap-4 md:grid-flow-col md:auto-cols-[minmax(18rem,1fr)] md:overflow-x-auto md:pb-2",
        className,
      )}
    >
      {columns.map((column) => {
        const columnItems = groupedItems.get(column.id) ?? [];

        return (
          <section
            key={column.id}
            data-board-column={column.id}
            className={cn("flex min-w-0 flex-col gap-2", columnsClassName)}
          >
            <SectionRuleHeading
              className="mb-0 px-1 pb-0"
              label={column.label}
              actions={
                <span
                  className={cn(
                    "inline-flex min-w-6 items-center justify-center rounded-full bg-background px-2 py-0.5 text-[11px] font-medium tabular-nums text-muted-foreground ring-1 ring-inset ring-border/70",
                    column.countClassName,
                  )}
                >
                  {columnItems.length}
                </span>
              }
            />

            <div
              className={cn(
                "flex min-h-52 flex-col gap-2 rounded-lg p-2",
                column.laneClassName,
              )}
            >
              {columnItems.length > 0 ? (
                columnItems.map((item) => (
                  <React.Fragment key={getItemId(item)}>
                    {renderCard(item)}
                  </React.Fragment>
                ))
              ) : (
                <EmptyState
                  className="flex-1 py-10"
                  title={column.emptyLabel ?? "No items"}
                  description=""
                />
              )}
            </div>
          </section>
        );
      })}
    </div>
  );
}
