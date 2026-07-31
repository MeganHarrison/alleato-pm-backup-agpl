"use client";

import * as React from "react";
import { Eye, MoreVertical, Pencil, Trash2 } from "lucide-react";
import { TableCell, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { apiFetch } from "@/lib/api-client";
import { reportNonCriticalFailure } from "@/lib/report-non-critical-failure";

/* ── Types ────────────────────────────────────────────────────────── */

interface LineItem {
  id: string;
  description: string | null;
  costRom: number | null;
  revenueRom: number | null;
  nonCommittedCost: number | null;
  quantity: number | null;
  unitCost: number | null;
  unitOfMeasure: string | null;
  contractId: number | string | null;
  commitmentId?: string | null;
  commitment?: {
    id: string;
    contract_number: string | null;
    title: string | null;
    company_name: string | null;
  } | null;
  vendor?: { id: string; name: string } | null;
  budgetLine?: {
    id: string;
    description: string | null;
    cost_code?: {
      id: string;
      title: string | null;
      division_id?: string | null;
      division_title?: string | null;
    } | null;
  } | null;
}

interface ExpandedRowContext {
  columns: Array<{
    id: string;
    width?: number;
    align?: "left" | "center" | "right";
  }>;
  hasSelection: boolean;
  hasActions: boolean;
}

interface ChangeEventExpandedRowProps {
  changeEventId: string | number;
  projectId: number;
  colSpan: number;
  context?: ExpandedRowContext;
  onEditLineItem?: (lineItemId: string) => void;
}

/* ── Helpers ──────────────────────────────────────────────────────── */

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;
function safeDescription(desc: string | null | undefined): string | null {
  if (!desc) return null;
  return UUID_RE.test(desc) ? null : desc;
}

function formatMoney(value: number | null | undefined): string {
  const numeric = typeof value === "number" ? value : 0;
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  }).format(numeric);
}

function formatBudgetCode(li: LineItem): string {
  const cc = li.budgetLine?.cost_code;
  if (cc?.title) {
    return cc.division_title ? `${cc.division_title} - ${cc.title}` : cc.title;
  }
  return li.budgetLine?.description || "--";
}

/**
 * Map a line item value to a parent column id. Returns `null` for columns
 * that don't have a meaningful line-item equivalent (rendered as dash).
 */
function lineItemValueForColumn(li: LineItem, columnId: string): React.ReactNode {
  const dash = <span className="text-muted-foreground">--</span>;

  switch (columnId) {
    case "number_title":
      return (
        <span className="pl-6 truncate block">
          {safeDescription(li.description) || formatBudgetCode(li) || "Untitled"}
        </span>
      );
    case "status":
      return dash;
    case "scope":
      return dash;
    case "type":
      return <span className="truncate block">{formatBudgetCode(li)}</span>;
    case "reason":
      return li.vendor?.name ? <span className="truncate block">{li.vendor.name}</span> : dash;
    case "origin":
      return dash;
    case "revenue_prime_pco":
      return (
        <span className="tabular-nums">{formatMoney(li.revenueRom)}</span>
      );
    case "prime_pco_title":
      return dash;
    case "cost_rom":
      return <span className="tabular-nums">{formatMoney(li.costRom)}</span>;
    case "rfq_title":
      return dash;
    case "commitment":
      return li.nonCommittedCost != null && li.nonCommittedCost !== 0 ? (
        <span className="tabular-nums">{formatMoney(li.nonCommittedCost)}</span>
      ) : (
        dash
      );
    case "commitment_title": {
      const c = li.commitment;
      if (!c) return dash;
      const label = [c.contract_number, c.title].filter(Boolean).join(" - ");
      return label ? <span className="truncate block">{label}</span> : dash;
    }
    case "created_at":
      return dash;
    default:
      return dash;
  }
}

/* ── Main component ───────────────────────────────────────────────── */

export function ChangeEventExpandedRow({
  changeEventId,
  projectId,
  colSpan,
  context,
  onEditLineItem,
}: ChangeEventExpandedRowProps) {
  const [lineItems, setLineItems] = React.useState<LineItem[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);

  React.useEffect(() => {
    let cancelled = false;

    async function fetchData() {
      // Guard: do not fire if changeEventId is missing or is the nil UUID.
      // The parent table can render expanded rows before the real ID is known
      // (e.g. while the list is still loading), which floods the API with
      // 404s for a non-existent change event.
      const NIL_UUID = "00000000-0000-0000-0000-000000000000";
      const ceId = String(changeEventId ?? "");
      if (!ceId || ceId === NIL_UUID) {
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      try {
        const lineItemsData = await apiFetch<{ data?: LineItem[] }>(
          `/api/projects/${projectId}/change-events/${ceId}/line-items`,
        ).catch(() => null);

        if (cancelled) return;

        if (lineItemsData) {
          setLineItems(lineItemsData.data || []);
        }
      } catch (error) {
        reportNonCriticalFailure({
          area: "change-event-expanded-row",
          operation: "load-line-items",
          error,
          userVisibleFallback:
            "Change event detail rows could not be fully loaded.",
          metadata: { changeEventId },
        });
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    fetchData();
    return () => {
      cancelled = true;
    };
  }, [projectId, changeEventId]);

  if (isLoading) {
    return (
      <TableRow className="bg-primary/5 hover:bg-primary/5">
        <TableCell colSpan={colSpan} className="py-1 px-8">
          <Skeleton className="h-3 w-48" />
        </TableCell>
      </TableRow>
    );
  }

  if (lineItems.length === 0) {
    return (
      <TableRow className="bg-primary/5 hover:bg-primary/5">
        <TableCell colSpan={colSpan} className="py-1 px-8">
          <p className="text-[10px] text-muted-foreground">
            No line items for this change event.
          </p>
        </TableCell>
      </TableRow>
    );
  }

  // Fallback: if no context (older caller), render as a single colSpan row
  if (!context) {
    return (
      <TableRow className="bg-muted/10">
        <TableCell colSpan={colSpan} className="py-1 px-8 text-[10px] text-muted-foreground">
          {lineItems.length} line item{lineItems.length === 1 ? "" : "s"}
        </TableCell>
      </TableRow>
    );
  }

  const renderRow = (
    key: string,
    getValue: (columnId: string) => React.ReactNode,
    actions?: React.ReactNode,
  ) => (
    <TableRow
      key={key}
      className="compact-subrow !bg-muted/10 hover:!bg-muted/20 border-b border-border/40 even:!bg-muted/10"
    >
      {context.hasSelection && <TableCell className="py-1 px-2" />}
      {context.columns.map((col) => (
        <TableCell
          key={col.id}
          className={`!py-1.5 !px-4 text-xs text-foreground/80 leading-4 [&_*]:!text-xs [&_*]:!leading-4 ${
            col.align === "right"
              ? "text-right"
              : col.align === "center"
                ? "text-center"
                : "text-left"
          }`}
          style={
            col.width
              ? { width: col.width, minWidth: col.width, maxWidth: col.width }
              : undefined
          }
        >
          {getValue(col.id)}
        </TableCell>
      ))}
      {context.hasActions && (
        <TableCell className="py-1 px-2 text-right" onClick={(e) => e.stopPropagation()}>
          {actions}
        </TableCell>
      )}
    </TableRow>
  );

  return (
    <>
      {lineItems.map((li) =>
        renderRow(
          `li-${li.id}`,
          (columnId) => lineItemValueForColumn(li, columnId),
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-4 w-4"
                onClick={(e) => e.stopPropagation()}
              >
                <MoreVertical className="h-3 w-3" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                onClick={(e) => {
                  e.stopPropagation();
                  onEditLineItem?.(li.id);
                }}
              >
                <Eye className="mr-2 h-4 w-4" />
                View
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={(e) => {
                  e.stopPropagation();
                  onEditLineItem?.(li.id);
                }}
              >
                <Pencil className="mr-2 h-4 w-4" />
                Edit
              </DropdownMenuItem>
              <DropdownMenuItem
                className="text-destructive"
                onClick={(e) => e.stopPropagation()}
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>,
        ),
      )}
    </>
  );
}
