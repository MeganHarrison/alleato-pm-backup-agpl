"use client";

import type { ReactNode } from "react";
import { ChevronRight, Eye, MoreVertical, Pencil, Trash2 } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

import type { TableColumn } from "./unified-table-page";

/* ────────────────────────────────────────────────────────────────────────────
 * MobileCardList — renders table rows as touch-friendly cards on small screens.
 *
 * Shown below the `sm` breakpoint (< 640px); the desktop <Table> takes over at
 * ≥ sm. Each row becomes a card:
 *   - First column → the identity block (rendered as-authored, e.g. avatar + name)
 *   - Next 2-3 columns → a clean label / value metadata list
 *   - Row actions via a "…" menu (if provided), else a chevron for clickable rows
 *
 * Motion: intentionally NONE on entrance. Cards render instantly at full
 * opacity. An earlier version used a staggered fade/slide entrance (first via a
 * JS animation loop, then via CSS) and BOTH stranded rows at opacity:0 when the
 * animation was throttled — leaving most of the list invisible. Content must
 * never depend on an animation completing to be seen. The only motion here is
 * interaction-triggered (press / hover / focus), which can never hide a row.
 * ──────────────────────────────────────────────────────────────────────────── */

interface MobileCardListProps<T> {
  items: T[];
  columns: TableColumn<T>[];
  getRowId: (item: T) => string;
  activeRowId?: string | null;
  onRowClick?: (item: T) => void;
  isFetching?: boolean;
  /** Custom row actions renderer (same as the desktop table) */
  rowActions?: (item: T) => ReactNode;
  /** Default view handler — renders a simple "…" > View menu item when no custom rowActions */
  onView?: (item: T) => void;
  /** Default edit handler — renders a simple "…" > Edit menu item when no custom rowActions */
  onEdit?: (item: T) => void;
  /** Default delete handler — renders a simple "…" > Delete menu when no custom rowActions */
  onDelete?: (item: T) => void;
  hasRowActions: boolean;
}

export function MobileCardList<T>({
  items,
  columns,
  getRowId,
  activeRowId,
  onRowClick,
  isFetching,
  rowActions,
  onView,
  onEdit,
  onDelete,
  hasRowActions,
}: MobileCardListProps<T>) {
  return (
    <div
      className={cn(
        "sm:hidden [&_button]:min-h-11 [&_button]:min-w-11",
        isFetching && "opacity-70 transition-opacity",
      )}
    >
      <div className="flex flex-col gap-3">
        {items.map((item) => {
          const rowId = getRowId(item);
          const isActive = activeRowId === rowId;
          const isClickable = Boolean(onRowClick);

          // First column → identity block. Next 2-3 → metadata rows.
          const titleCol = columns[0];
          const detailCols = columns.slice(1, 4);

          return (
            <div
              key={rowId}
              role={isClickable ? "button" : undefined}
              tabIndex={isClickable ? 0 : undefined}
              className={cn(
                "rounded-2xl bg-card px-4 py-4 shadow-sm",
                "transition-[background-color,box-shadow,transform] duration-200",
                isClickable &&
                  "cursor-pointer hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background active:scale-[0.99] active:bg-muted/40",
                isActive && "ring-2 ring-primary/60",
              )}
              onClick={isClickable ? () => onRowClick?.(item) : undefined}
              onKeyDown={
                isClickable
                  ? (event) => {
                      if (event.key !== "Enter" && event.key !== " ") return;
                      event.preventDefault();
                      onRowClick?.(item);
                    }
                  : undefined
              }
            >
              {/* Identity row: title (as authored) + actions/chevron */}
              <div className="flex min-w-0 items-center gap-3">
                <div className="min-w-0 flex-1 text-[15px] font-semibold leading-tight text-foreground [&_p]:truncate">
                  {titleCol?.render(item)}
                </div>

                {hasRowActions ? (
                  <div
                    className="-mr-1.5 shrink-0"
                    onClick={(event) => event.stopPropagation()}
                    onKeyDown={(event) => event.stopPropagation()}
                  >
                    {rowActions ? (
                      rowActions(item)
                    ) : onView || onEdit || onDelete ? (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-9 w-9 text-muted-foreground"
                          >
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          {onView && (
                            <DropdownMenuItem onClick={() => onView(item)}>
                              <Eye className="mr-2 h-4 w-4" />
                              View
                            </DropdownMenuItem>
                          )}
                          {onView && (onEdit || onDelete) ? (
                            <DropdownMenuSeparator />
                          ) : null}
                          {onEdit && (
                            <DropdownMenuItem onClick={() => onEdit(item)}>
                              <Pencil className="mr-2 h-4 w-4" />
                              Edit
                            </DropdownMenuItem>
                          )}
                          {onEdit && onDelete ? <DropdownMenuSeparator /> : null}
                          {onDelete && (
                            <DropdownMenuItem
                              className="text-destructive"
                              onClick={() => onDelete(item)}
                            >
                              <Trash2 className="mr-2 h-4 w-4" />
                              Delete
                            </DropdownMenuItem>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    ) : null}
                  </div>
                ) : isClickable ? (
                  <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground/40" />
                ) : null}
              </div>

              {/* Metadata: quiet label on the left, the value carries the
                  weight on the right. Labels recede (low contrast, no shouting
                  uppercase) so the values read as the content and the block
                  stops looking like a shrunken table. Labels never wrap; long
                  values truncate. */}
              {detailCols.length > 0 && (
                <div className="mt-3.5 space-y-2.5">
                  {detailCols.map((col) => (
                    <div
                      key={col.id}
                      className="flex min-w-0 items-baseline justify-between gap-4"
                    >
                      <span className="shrink-0 whitespace-nowrap text-xs font-normal text-muted-foreground">
                        {col.label}
                      </span>
                      <span className="min-w-0 flex-1 truncate text-right text-sm font-medium text-foreground [&_*]:truncate">
                        {col.render(item)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
