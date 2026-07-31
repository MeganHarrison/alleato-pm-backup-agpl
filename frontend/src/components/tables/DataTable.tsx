"use client";

import * as React from "react";
import {
  ColumnDef,
  ColumnFiltersState,
  SortingState,
  VisibilityState,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table";
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { DataTablePagination } from "./DataTablePagination";
import { DataTableToolbar } from "./DataTableToolbar";
import { cn } from "@/lib/utils";
import { useIsMobile } from "@/hooks/use-mobile";
import { Card } from "@/components/ui/card";
import { ChevronRight } from "lucide-react";

/**
 * A single footer cell definition for the totals row.
 * - `colSpan` merges cells (e.g. a "Totals" label spanning the first few columns).
 * - `align` controls text alignment (default "right").
 * - `value` is the rendered content (string, number, ReactNode).
 */
export interface DataTableFooterCell {
  value?: React.ReactNode;
  colSpan?: number;
  align?: "left" | "center" | "right";
  className?: string;
}

interface DataTableProps<TData, TValue> {
  columns: ColumnDef<TData, TValue>[];
  data: TData[];
  showToolbar?: boolean;
  showPagination?: boolean;
  rowHover?: boolean;
  onRowClick?: (row: TData) => void;
  className?: string;
  searchKey?: string;
  searchPlaceholder?: string;
  emptyMessage?: React.ReactNode | null;
  /** Optional totals/footer row rendered as a `<tfoot>`. Cells align to columns. */
  footerRow?: DataTableFooterCell[];
}

export function DataTable<TData, TValue>({
  columns,
  data,
  showToolbar = true,
  showPagination = true,
  rowHover = true,
  onRowClick,
  className,
  searchKey,
  searchPlaceholder,
  emptyMessage = "No results.",
  footerRow,
}: DataTableProps<TData, TValue>) {
  const isMobile = useIsMobile();
  const [sorting, setSorting] = React.useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>(
    [],
  );
  const [columnVisibility, setColumnVisibility] =
    React.useState<VisibilityState>({});
  const [rowSelection, setRowSelection] = React.useState({});

  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    onSortingChange: setSorting,
    getSortedRowModel: getSortedRowModel(),
    onColumnFiltersChange: setColumnFilters,
    getFilteredRowModel: getFilteredRowModel(),
    onColumnVisibilityChange: setColumnVisibility,
    onRowSelectionChange: setRowSelection,
    state: {
      sorting,
      columnFilters,
      columnVisibility,
      rowSelection,
    },
  });
  const rows = table.getRowModel().rows;

  return (
    <div className={cn("space-y-4", className)}>
      {showToolbar && (
        <DataTableToolbar
          table={table}
          searchKey={searchKey}
          searchPlaceholder={searchPlaceholder}
        />
      )}

      {isMobile ? (
        <div className="space-y-3">
          {rows.length ? (
            rows.map((row) => {
              const visibleCells = row.getVisibleCells();
              const [primaryCell, ...restCells] = visibleCells;

              return (
                <Card
                  key={row.id}
                  className={cn(
                    "border px-4 py-3 [contain-intrinsic-size:auto_96px] [content-visibility:auto]",
                    onRowClick && "cursor-pointer active:bg-muted/50",
                  )}
                  onClick={() => onRowClick?.(row.original)}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1 space-y-2">
                      <div className="text-sm font-medium text-foreground truncate">
                        {primaryCell
                          ? flexRender(
                              primaryCell.column.columnDef.cell,
                              primaryCell.getContext(),
                            )
                          : "-"}
                      </div>
                      <div className="space-y-1.5">
                        {restCells.slice(0, 3).map((cell) => {
                          const headerLabel =
                            typeof cell.column.columnDef.header === "string"
                              ? cell.column.columnDef.header
                              : cell.column.id;

                          return (
                            <div
                              key={cell.id}
                              className="flex items-center justify-between gap-3"
                            >
                              <span className="text-xs text-muted-foreground truncate">
                                {headerLabel}
                              </span>
                              <span className="text-xs font-medium text-foreground truncate text-right">
                                {flexRender(
                                  cell.column.columnDef.cell,
                                  cell.getContext(),
                                )}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                    {onRowClick && (
                      <ChevronRight className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                    )}
                  </div>
                </Card>
              );
            })
          ) : (
            emptyMessage !== null && (
              <Card className="border px-4 py-10 text-center text-sm text-muted-foreground">
                {emptyMessage}
              </Card>
            )
          )}
        </div>
      ) : (
        <div className="overflow-x-auto">
          <Table>
            <TableHeader className="[&_tr]:hover:bg-transparent">
              {table.getHeaderGroups().map((headerGroup) => (
                <TableRow key={headerGroup.id}>
                  {headerGroup.headers.map((header) => {
                    const width = header.column.columnDef.size;
                    return (
                      <TableHead
                        key={header.id}
                        colSpan={header.colSpan}
                        style={typeof width === "number" ? { width, minWidth: width } : undefined}
                      >
                        {header.isPlaceholder
                          ? null
                          : flexRender(
                              header.column.columnDef.header,
                              header.getContext(),
                            )}
                      </TableHead>
                    );
                  })}
                </TableRow>
              ))}
            </TableHeader>
            <TableBody>
              {rows.length ? (
                rows.map((row) => (
                  <TableRow
                    key={row.id}
                    data-state={row.getIsSelected() && "selected"}
                    className={cn(
                      onRowClick && "cursor-pointer hover:bg-muted/50",
                      !rowHover && "hover:bg-transparent",
                    )}
                    onClick={() => onRowClick?.(row.original)}
                  >
                    {row.getVisibleCells().map((cell) => {
                      const width = cell.column.columnDef.size;
                      return (
                        <TableCell
                          key={cell.id}
                          style={typeof width === "number" ? { width, minWidth: width } : undefined}
                        >
                          {flexRender(
                            cell.column.columnDef.cell,
                            cell.getContext(),
                          )}
                        </TableCell>
                      );
                    })}
                  </TableRow>
                ))
              ) : (
                emptyMessage !== null && (
                  <TableRow>
                    <TableCell
                      colSpan={columns.length}
                      className="h-24 text-center"
                    >
                      {emptyMessage}
                    </TableCell>
                  </TableRow>
                )
              )}
            </TableBody>
            {footerRow && footerRow.length > 0 && (
              <TableFooter className="bg-muted/40">
                <TableRow className="font-semibold">
                  {footerRow.map((cell, i) => (
                    <TableCell
                      key={i}
                      colSpan={cell.colSpan}
                      className={cn(
                        "tabular-nums",
                        cell.align === "left"
                          ? "text-left"
                          : cell.align === "center"
                            ? "text-center"
                            : "text-right",
                        cell.className,
                      )}
                    >
                      {cell.value}
                    </TableCell>
                  ))}
                </TableRow>
              </TableFooter>
            )}
          </Table>
        </div>
      )}
      {showPagination && <DataTablePagination table={table} />}
    </div>
  );
}
