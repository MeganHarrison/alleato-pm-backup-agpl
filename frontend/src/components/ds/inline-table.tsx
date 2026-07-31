"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

/* ------------------------------------------------------------------ */
/*  InlineTable — composable primitives for consistent inline tables  */
/*                                                                    */
/*  Premium table style:                                              */
/*    ✓ No outer border, no border-radius, no shadows                 */
/*    ✓ Horizontal-only dividers between rows                         */
/*    ✓ Small uppercase headers with bottom divider                   */
/*    ✓ Clean, minimal look — content is the star                     */
/*                                                                    */
/*  Two variants:                                                     */
/*    "edit"   — form-embedded editable tables (SOV, line items)      */
/*    "read"   — read-only detail/modal tables (summaries, drilldowns)*/
/* ------------------------------------------------------------------ */

type TableVariant = "edit" | "read";

interface InlineTableContextValue {
  variant: TableVariant;
}

const InlineTableContext = React.createContext<InlineTableContextValue>({
  variant: "edit",
});

function useInlineTable() {
  return React.useContext(InlineTableContext);
}

/* ---- Container ---- */

interface InlineTableProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: TableVariant;
  tableClassName?: string;
  children: React.ReactNode;
}

/**
 * Outer container — horizontal scroll wrapper, no border/radius/shadow.
 *
 * ```tsx
 * <InlineTable variant="edit">
 *   <InlineTableHeader>…</InlineTableHeader>
 *   <InlineTableBody>…</InlineTableBody>
 *   <InlineTableFooter>…</InlineTableFooter>
 * </InlineTable>
 * ```
 */
export function InlineTable({
  variant = "edit",
  className,
  tableClassName,
  children,
  ...props
}: InlineTableProps) {
  const tableRef = React.useRef<HTMLTableElement>(null);
  useColumnIntegrityGuard(tableRef);
  return (
    <InlineTableContext.Provider value={{ variant }}>
      <div
        className={cn("overflow-x-auto", className)}
        {...props}
      >
        <table
          ref={tableRef}
          className={cn(
            "w-full",
            variant === "edit" ? "text-sm" : "text-xs",
            tableClassName,
          )}
        >
          {children}
        </table>
      </div>
    </InlineTableContext.Provider>
  );
}

/* ---- Dev-time column integrity guard ---------------------------------- */

/** Sum the colSpans of every cell in a row (colSpan defaults to 1). */
function sumColSpan(row: HTMLTableRowElement): number {
  let total = 0;
  for (const cell of Array.from(row.cells)) total += cell.colSpan || 1;
  return total;
}

/**
 * In development and tests, verify every body/footer row spans exactly as many
 * columns as the header. A mismatch is *the* cause of "the totals row doesn't
 * line up with its columns" bugs — the footer's `colSpan` math drifted from the
 * header. This surfaces it loudly at render time (console.error) instead of
 * waiting for someone to eyeball the page. Production is a no-op.
 *
 * The check reads the rendered DOM (not React children) so it is immune to
 * conditional cells, fragments, and `.map()` rows.
 */
function useColumnIntegrityGuard(
  ref: React.RefObject<HTMLTableElement | null>,
) {
  React.useEffect(() => {
    if (process.env.NODE_ENV === "production") return;
    const table = ref.current;
    if (!table?.tHead || table.tHead.rows.length === 0) return;

    // Header column count = widest header row (skips narrower group super-headers).
    const headerCols = Math.max(
      ...Array.from(table.tHead.rows).map((row) => sumColSpan(row)),
    );
    if (!headerCols) return;

    const sections = [
      ...Array.from(table.tBodies).map((b) => ["body", b] as const),
      ...(table.tFoot ? [["footer", table.tFoot] as const] : []),
    ];

    for (const [name, section] of sections) {
      Array.from(section.rows).forEach((row, index) => {
        if (row.cells.length === 0) return; // spacer rows
        const span = sumColSpan(row);
        if (span !== headerCols) {
          console.error(
            `[InlineTable] ${name} row ${index} spans ${span} column(s) but ` +
              `the header has ${headerCols}. This misaligns the row with its ` +
              `columns — fix the cell/colSpan count so they match.`,
            row,
          );
        }
      });
    }
  });
}

/* ---- Header (thead) ---- */

interface InlineTableHeaderProps
  extends React.HTMLAttributes<HTMLTableSectionElement> {
  children: React.ReactNode;
}

export function InlineTableHeader({
  className,
  children,
  ...props
}: InlineTableHeaderProps) {
  return (
    <thead className={className} {...props}>
      {children}
    </thead>
  );
}

/* ---- Header Row ---- */

interface InlineTableHeaderRowProps
  extends React.HTMLAttributes<HTMLTableRowElement> {
  /** "group" renders a super-header row (column group labels) */
  type?: "default" | "group";
  children: React.ReactNode;
}

export function InlineTableHeaderRow({
  type = "default",
  className,
  children,
  ...props
}: InlineTableHeaderRowProps) {
  const { variant } = useInlineTable();

  return (
    <tr
      className={cn(
        type === "group"
          ? "bg-muted/30 text-[9px] font-semibold uppercase tracking-wider text-muted-foreground"
          : variant === "edit"
            ? "border-0"
            : "border-b border-border",
        className,
      )}
      {...props}
    >
      {children}
    </tr>
  );
}

/* ---- Header Cell (th) ---- */

interface InlineTableHeaderCellProps
  extends React.ThHTMLAttributes<HTMLTableCellElement> {
  align?: "left" | "right" | "center";
  /** Set true for column-group divider borders */
  divider?: boolean;
  children?: React.ReactNode;
}

export function InlineTableHeaderCell({
  align = "left",
  divider,
  className,
  children,
  ...props
}: InlineTableHeaderCellProps) {
  const { variant } = useInlineTable();
  const px = variant === "edit" ? "px-1" : "px-3";
  return (
    <th
      className={cn(
        px,
        "py-2.5 text-[10px] font-medium uppercase tracking-wider text-muted-foreground",
        align === "right" && "text-right",
        align === "center" && "text-center",
        align === "left" && "text-left",
        divider && "border-l border-border",
        className,
      )}
      {...props}
    >
      {children}
    </th>
  );
}

/* ---- Body (tbody) ---- */

interface InlineTableBodyProps
  extends React.HTMLAttributes<HTMLTableSectionElement> {
  children: React.ReactNode;
}

export function InlineTableBody({
  className,
  children,
  ...props
}: InlineTableBodyProps) {
  return (
    <tbody className={className} {...props}>
      {children}
    </tbody>
  );
}

/* ---- Row (tbody > tr) ---- */

interface InlineTableRowProps
  extends React.HTMLAttributes<HTMLTableRowElement> {
  /** "group" = section/group header row, "markup" = highlighted markup row */
  type?: "default" | "group" | "markup";
  children: React.ReactNode;
}

export const InlineTableRow = React.forwardRef<
  HTMLTableRowElement,
  InlineTableRowProps
>(function InlineTableRow(
  { type = "default", className, children, ...props },
  ref,
) {
  return (
    <tr
      ref={ref}
      className={cn(
        "border-b border-border/60",
        type === "group"
          ? "bg-muted/40"
          : type === "markup"
            ? "border-l-2 border-l-border bg-muted/25 text-muted-foreground"
            : "group transition-colors hover:bg-transparent",
        className,
      )}
      {...props}
    >
      {children}
    </tr>
  );
});

/* ---- Cell (td) ---- */

interface InlineTableCellProps
  extends React.TdHTMLAttributes<HTMLTableCellElement> {
  align?: "left" | "right" | "center";
  /** Tabular-nums for financial values */
  numeric?: boolean;
  /** Column-group divider border */
  divider?: boolean;
  children?: React.ReactNode;
}

export function InlineTableCell({
  align = "left",
  numeric,
  divider,
  className,
  children,
  ...props
}: InlineTableCellProps) {
  const { variant } = useInlineTable();
  const px = variant === "edit" ? "px-1" : "px-3";
  return (
    <td
      className={cn(
        px,
        "py-2.5",
        align === "right" && "text-right",
        align === "center" && "text-center",
        numeric && "tabular-nums whitespace-nowrap font-normal",
        divider && "border-l border-border",
        className,
      )}
      {...props}
    >
      {children}
    </td>
  );
}

/* ---- Footer (tfoot) ---- */

interface InlineTableFooterProps
  extends React.HTMLAttributes<HTMLTableSectionElement> {
  children: React.ReactNode;
}

export function InlineTableFooter({
  className,
  children,
  ...props
}: InlineTableFooterProps) {
  return (
    <tfoot className={className} {...props}>
      {children}
    </tfoot>
  );
}

/* ---- Footer Row ---- */

interface InlineTableFooterRowProps
  extends React.HTMLAttributes<HTMLTableRowElement> {
  /** "action" for inline action links (Add Line Item), "totals" for sum row */
  type?: "action" | "totals";
  children: React.ReactNode;
}

export function InlineTableFooterRow({
  type = "totals",
  className,
  children,
  ...props
}: InlineTableFooterRowProps) {
  return (
    <tr
      className={cn(
        type === "totals" && "font-semibold border-t border-border",
        className,
      )}
      {...props}
    >
      {children}
    </tr>
  );
}

/* ---- Footer Cell (td in tfoot) ---- */

interface InlineTableFooterCellProps
  extends React.TdHTMLAttributes<HTMLTableCellElement> {
  align?: "left" | "right" | "center";
  numeric?: boolean;
  divider?: boolean;
  children?: React.ReactNode;
}

export function InlineTableFooterCell({
  align = "left",
  numeric,
  divider,
  className,
  children,
  ...props
}: InlineTableFooterCellProps) {
  const { variant } = useInlineTable();
  const px = variant === "edit" ? "px-1" : "px-3";
  return (
    <td
      className={cn(
        px,
        "py-2.5",
        align === "right" && "text-right",
        align === "center" && "text-center",
        numeric && "tabular-nums whitespace-nowrap font-mono text-[13px]",
        divider && "border-l border-border",
        "text-sm font-semibold text-foreground/70",
        className,
      )}
      {...props}
    >
      {children}
    </td>
  );
}
