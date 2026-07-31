"use client";

import * as React from "react";
import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { BudgetDrilldownRecordLink } from "@/components/budget/modals/BudgetDrilldownRecordLink";
import { EmptyState } from "@/components/ds";
import { ExpandableSearch } from "@/components/tables/unified/table-toolbar";
import { cn } from "@/lib/utils";

export type DetailType =
  | "original_budget"
  | "budget_changes"
  | "forecast_to_complete"
  | "prime_contract_change_orders"
  | "commitments"
  | "commitment_change_orders"
  | "change_events"
  | "direct_costs";

export interface BudgetDetailLineItem {
  id: string;
  budgetCode: string;
  budgetCodeDescription: string;
  vendor?: string;
  item?: string;
  detailType: DetailType;
  description?: string;
  status?: string;
  detailHref?: string | null;
  originalBudgetAmount?: number;
  budgetChanges?: number;
  pendingBudgetChanges?: number;
  approvedCOs?: number;
  committedCosts?: number;
  pendingCostChanges?: number;
  directCosts?: number;
  forecastToComplete?: number;
  variance?: number;
}

interface BudgetDetailsTableProps {
  data: BudgetDetailLineItem[];
  loading?: boolean;
}

type SortConfig = {
  key: SortKey | null;
  direction: "asc" | "desc";
};

type SortKey =
  | "budgetCode"
  | "vendor"
  | "item"
  | "detailType"
  | "status"
  | "approvedCOs"
  | "budgetChanges"
  | "committedCosts"
  | "directCosts"
  | "forecastToComplete"
  | "originalBudgetAmount"
  | "pendingBudgetChanges"
  | "pendingCostChanges";

type BudgetDetailsColumn = {
  key: SortKey;
  label: string;
  tooltip: string;
  align?: "left" | "right";
  isCurrency?: boolean;
};

const ALL_FILTER_VALUE = "__all";

const columnWidthClasses: Record<SortKey, string> = {
  budgetCode: "w-[220px] min-w-[220px]",
  vendor: "w-[160px] min-w-[160px]",
  item: "w-[170px] min-w-[170px]",
  detailType: "w-[190px] min-w-[190px]",
  status: "w-[140px] min-w-[140px]",
  approvedCOs: "w-[140px] min-w-[140px]",
  budgetChanges: "w-[140px] min-w-[140px]",
  committedCosts: "w-[140px] min-w-[140px]",
  directCosts: "w-[140px] min-w-[140px]",
  forecastToComplete: "w-[160px] min-w-[160px]",
  originalBudgetAmount: "w-[160px] min-w-[160px]",
  pendingBudgetChanges: "w-[180px] min-w-[180px]",
  pendingCostChanges: "w-[170px] min-w-[170px]",
};

const columns: BudgetDetailsColumn[] = [
  {
    key: "budgetCode",
    label: "Budget Code",
    tooltip: "The budget code or cost code associated with this detail row.",
  },
  {
    key: "vendor",
    label: "Vendor",
    tooltip: "The company or vendor tied to the source record, when available.",
  },
  {
    key: "item",
    label: "Item",
    tooltip: "The source item number or title. Linked values open the source record.",
  },
  {
    key: "detailType",
    label: "Detail Type",
    tooltip: "The source category contributing to this budget detail row.",
  },
  {
    key: "status",
    label: "Status",
    tooltip: "The current workflow status from the source record, when available.",
  },
  {
    key: "approvedCOs",
    label: "Approved COs",
    tooltip: "Approved prime or commitment change order amounts for this row.",
    align: "right",
    isCurrency: true,
  },
  {
    key: "budgetChanges",
    label: "Budget Changes",
    tooltip: "Approved budget modification amounts.",
    align: "right",
    isCurrency: true,
  },
  {
    key: "committedCosts",
    label: "Committed Costs",
    tooltip: "Approved or complete subcontract, purchase order, and commitment change order costs.",
    align: "right",
    isCurrency: true,
  },
  {
    key: "directCosts",
    label: "Direct Costs",
    tooltip: "Approved direct cost amounts posted to the budget code.",
    align: "right",
    isCurrency: true,
  },
  {
    key: "forecastToComplete",
    label: "Forecast to Complete",
    tooltip: "Projected budget less committed and direct costs for the budget code.",
    align: "right",
    isCurrency: true,
  },
  {
    key: "originalBudgetAmount",
    label: "Original Budget Amount",
    tooltip: "Original budget amount entered for the budget line item.",
    align: "right",
    isCurrency: true,
  },
  {
    key: "pendingBudgetChanges",
    label: "Pending Budget Changes",
    tooltip: "Budget modifications or prime change order impacts that are not approved yet.",
    align: "right",
    isCurrency: true,
  },
  {
    key: "pendingCostChanges",
    label: "Pending Cost Changes",
    tooltip: "Commitment-side cost changes that are not approved yet.",
    align: "right",
    isCurrency: true,
  },
];

const getWidthClass = (id: SortKey) => columnWidthClasses[id];

const formatCurrency = (value?: number): string => {
  if (value === undefined || value === null) return "-";
  if (value === 0) return "$0.00";

  const isNegative = value < 0;
  const formatted = new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Math.abs(value));

  if (isNegative) return `($${formatted})`;
  return `$${formatted}`;
};

const getDetailTypeLabel = (type: DetailType): string => {
  const labels: Record<DetailType, string> = {
    original_budget: "Original Budget",
    budget_changes: "Budget Changes",
    forecast_to_complete: "Forecast to Complete",
    prime_contract_change_orders: "Prime Contract Change Orders",
    commitments: "Commitments",
    commitment_change_orders: "Commitment Change Orders",
    change_events: "Change Events",
    direct_costs: "Direct Costs",
  };
  return labels[type];
};

const normalizeFilterValue = (value?: string | null) =>
  value?.trim() ? value.trim() : "Not specified";

const CurrencyCell = ({ value }: { value?: number }) => {
  const numericValue = value ?? 0;
  const isEmpty = value === undefined || value === null;
  const isNegative = numericValue < 0;

  if (isEmpty) {
    return <span className="tabular-nums text-muted-foreground">-</span>;
  }

  return (
    <span className={cn("tabular-nums", isNegative && "text-destructive")}>
      {formatCurrency(numericValue)}
    </span>
  );
};

const BudgetDetailsEmptyState = ({ filtered }: { filtered: boolean }) => (
  <EmptyState
    title={filtered ? "No matching budget details" : "No budget details found"}
    description={
      filtered
        ? "Clear or adjust the current filters to see more budget detail rows."
        : "Budget detail rows will appear here once this project has budget activity."
    }
    className="py-8"
  />
);

const SortableHeader = ({
  column,
  currentSort,
  onSort,
}: {
  column: BudgetDetailsColumn;
  currentSort: SortConfig;
  onSort: (key: SortKey) => void;
}) => {
  const isSorted = currentSort.key === column.key;
  const isRightAligned = column.align === "right";

  return (
    <TableHead
      className={cn(
        "bg-background px-1.5 py-2 text-[11px] font-semibold text-foreground",
        getWidthClass(column.key),
        isRightAligned ? "text-right" : "text-left",
      )}
    >
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => onSort(column.key)}
            className={cn(
              "h-8 w-full gap-1.5 whitespace-nowrap px-0 text-[11px] font-semibold leading-tight text-foreground hover:bg-transparent hover:text-primary",
              isRightAligned ? "justify-end" : "justify-start",
            )}
          >
            <span>{column.label}</span>
            {isSorted ? (
              currentSort.direction === "asc" ? (
                <ArrowUp className="h-3 w-3" />
              ) : (
                <ArrowDown className="h-3 w-3" />
              )
            ) : (
              <ArrowUpDown className="h-3 w-3 opacity-30" />
            )}
          </Button>
        </TooltipTrigger>
        <TooltipContent
          side="bottom"
          align={isRightAligned ? "end" : "start"}
          className="max-w-xs text-xs"
        >
          {column.tooltip}
        </TooltipContent>
      </Tooltip>
    </TableHead>
  );
};

export function BudgetDetailsTable({ data, loading }: BudgetDetailsTableProps) {
  const [searchQuery, setSearchQuery] = React.useState("");
  const [detailTypeFilter, setDetailTypeFilter] = React.useState(ALL_FILTER_VALUE);
  const [statusFilter, setStatusFilter] = React.useState(ALL_FILTER_VALUE);
  const [sortConfig, setSortConfig] = React.useState<SortConfig>({
    key: null,
    direction: "asc",
  });

  const detailTypeOptions = React.useMemo(() => {
    return Array.from(new Set(data.map((item) => item.detailType))).sort((a, b) =>
      getDetailTypeLabel(a).localeCompare(getDetailTypeLabel(b)),
    );
  }, [data]);

  const statusOptions = React.useMemo(() => {
    return Array.from(new Set(data.map((item) => normalizeFilterValue(item.status)))).sort(
      (a, b) => a.localeCompare(b),
    );
  }, [data]);

  const filteredData = React.useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    return data.filter((item) => {
      const matchesSearch =
        !query ||
        item.budgetCode?.toLowerCase().includes(query) ||
        item.budgetCodeDescription?.toLowerCase().includes(query) ||
        item.vendor?.toLowerCase().includes(query) ||
        item.item?.toLowerCase().includes(query) ||
        item.description?.toLowerCase().includes(query);
      const matchesDetailType =
        detailTypeFilter === ALL_FILTER_VALUE || item.detailType === detailTypeFilter;
      const matchesStatus =
        statusFilter === ALL_FILTER_VALUE ||
        normalizeFilterValue(item.status) === statusFilter;

      return matchesSearch && matchesDetailType && matchesStatus;
    });
  }, [data, detailTypeFilter, searchQuery, statusFilter]);

  const grandTotals = React.useMemo(() => {
    return filteredData.reduce(
      (acc, item) => ({
        originalBudgetAmount:
          acc.originalBudgetAmount + (item.originalBudgetAmount || 0),
        budgetChanges: acc.budgetChanges + (item.budgetChanges || 0),
        pendingBudgetChanges:
          acc.pendingBudgetChanges + (item.pendingBudgetChanges || 0),
        approvedCOs: acc.approvedCOs + (item.approvedCOs || 0),
        committedCosts: acc.committedCosts + (item.committedCosts || 0),
        pendingCostChanges: acc.pendingCostChanges + (item.pendingCostChanges || 0),
        directCosts: acc.directCosts + (item.directCosts || 0),
        forecastToComplete:
          acc.forecastToComplete + (item.forecastToComplete || 0),
      }),
      {
        originalBudgetAmount: 0,
        budgetChanges: 0,
        pendingBudgetChanges: 0,
        approvedCOs: 0,
        committedCosts: 0,
        pendingCostChanges: 0,
        directCosts: 0,
        forecastToComplete: 0,
      },
    );
  }, [filteredData]);

  const sortedAndFilteredData = React.useMemo(() => {
    const sortKey = sortConfig.key;
    if (!sortKey) return filteredData;

    return [...filteredData].sort((a, b) => {
      let aVal: string | number | undefined;
      let bVal: string | number | undefined;

      if (sortKey === "detailType") {
        aVal = getDetailTypeLabel(a.detailType);
        bVal = getDetailTypeLabel(b.detailType);
      } else if (sortKey === "status") {
        aVal = normalizeFilterValue(a.status);
        bVal = normalizeFilterValue(b.status);
      } else {
        aVal = a[sortKey];
        bVal = b[sortKey];
      }

      if (typeof aVal === "number" && typeof bVal === "number") {
        return sortConfig.direction === "asc" ? aVal - bVal : bVal - aVal;
      }

      const aStr = String(aVal || "");
      const bStr = String(bVal || "");
      const comparison = aStr.localeCompare(bStr);
      return sortConfig.direction === "asc" ? comparison : -comparison;
    });
  }, [filteredData, sortConfig]);

  const handleSort = (key: SortKey) => {
    setSortConfig((prev) => ({
      key,
      direction: prev.key === key && prev.direction === "asc" ? "desc" : "asc",
    }));
  };

  const resetFilters = () => {
    setSearchQuery("");
    setDetailTypeFilter(ALL_FILTER_VALUE);
    setStatusFilter(ALL_FILTER_VALUE);
  };

  const hasRows = sortedAndFilteredData.length > 0;
  const hasActiveFilters =
    Boolean(searchQuery) ||
    detailTypeFilter !== ALL_FILTER_VALUE ||
    statusFilter !== ALL_FILTER_VALUE;

  const getCellValue = (item: BudgetDetailLineItem, key: SortKey) => {
    if (key === "detailType") return getDetailTypeLabel(item.detailType);
    if (key === "status") return normalizeFilterValue(item.status);
    return item[key];
  };

  const renderTextCell = (item: BudgetDetailLineItem, key: SortKey) => {
    const value = getCellValue(item, key);
    const displayValue = value ? String(value) : "-";
    const shouldLink =
      item.detailHref &&
      ((key === "item" && displayValue !== "-") ||
        (key === "budgetCode" && !item.item));

    if (shouldLink) {
      return (
        <BudgetDrilldownRecordLink href={item.detailHref} className="truncate">
          {displayValue}
        </BudgetDrilldownRecordLink>
      );
    }

    return <span className={cn(!value && "text-muted-foreground")}>{displayValue}</span>;
  };

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center bg-background">
        <div className="text-sm text-muted-foreground">Loading budget details...</div>
      </div>
    );
  }

  return (
    <TooltipProvider delayDuration={200}>
      <div className="flex min-h-0 flex-col bg-background">
        <div className="space-y-3 border-b border-border px-4 py-3">
          <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
            <div className="min-w-0">
              <div className="text-sm font-medium text-foreground">
                Procore Standard Budget
              </div>
              <div className="text-xs text-muted-foreground">
                Read-only budget detail report
              </div>
            </div>
            <Select value="procore-standard" onValueChange={() => undefined}>
              <SelectTrigger
                className="h-9 w-full sm:w-56"
                aria-label="Budget details view"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="procore-standard">Procore Standard Budget</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-2 md:grid-cols-[minmax(16rem,1fr)_12rem_12rem_auto]">
            <div className="flex items-center">
              <ExpandableSearch
                placeholder="Filter budget code, vendor, or item"
                ariaLabel="Filter budget details"
                value={searchQuery}
                onChange={setSearchQuery}
                defaultExpanded
              />
            </div>
            <Select value={detailTypeFilter} onValueChange={setDetailTypeFilter}>
              <SelectTrigger className="h-9" aria-label="Filter detail type">
                <SelectValue placeholder="Detail type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL_FILTER_VALUE}>All detail types</SelectItem>
                {detailTypeOptions.map((detailType) => (
                  <SelectItem key={detailType} value={detailType}>
                    {getDetailTypeLabel(detailType)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="h-9" aria-label="Filter status">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL_FILTER_VALUE}>All statuses</SelectItem>
                {statusOptions.map((status) => (
                  <SelectItem key={status} value={status}>
                    {status}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="flex items-center gap-2">
              {hasActiveFilters ? (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={resetFilters}
                  className="h-9 min-w-11"
                >
                  Clear
                </Button>
              ) : null}
              <span className="whitespace-nowrap text-sm text-muted-foreground">
                {sortedAndFilteredData.length} of {data.length}
              </span>
            </div>
          </div>
        </div>

        <div className="block divide-y divide-border sm:hidden">
          {!hasRows ? (
            <div className="px-4">
              <BudgetDetailsEmptyState filtered={hasActiveFilters} />
            </div>
          ) : (
            sortedAndFilteredData.map((item) => (
              <div key={item.id} className="space-y-2 px-4 py-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium text-foreground">
                      {renderTextCell(item, "budgetCode")}
                    </div>
                    {item.budgetCodeDescription ? (
                      <div className="truncate text-xs text-muted-foreground">
                        {item.budgetCodeDescription}
                      </div>
                    ) : null}
                  </div>
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {getDetailTypeLabel(item.detailType)}
                  </span>
                </div>
                {(item.vendor || item.item || item.status) ? (
                  <div className="text-xs text-muted-foreground">
                    {[item.vendor, item.item, item.status].filter(Boolean).join(" / ")}
                  </div>
                ) : null}
                <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Approved COs</span>
                    <span className="tabular-nums">
                      <CurrencyCell value={item.approvedCOs} />
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Budget Changes</span>
                    <span className="tabular-nums">
                      <CurrencyCell value={item.budgetChanges} />
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Committed</span>
                    <span className="tabular-nums">
                      <CurrencyCell value={item.committedCosts} />
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Direct Costs</span>
                    <span className="tabular-nums">
                      <CurrencyCell value={item.directCosts} />
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Forecast</span>
                    <span className="tabular-nums">
                      <CurrencyCell value={item.forecastToComplete} />
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Original</span>
                    <span className="tabular-nums">
                      <CurrencyCell value={item.originalBudgetAmount} />
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Pending Budget</span>
                    <span className="tabular-nums">
                      <CurrencyCell value={item.pendingBudgetChanges} />
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Pending Cost</span>
                    <span className="tabular-nums">
                      <CurrencyCell value={item.pendingCostChanges} />
                    </span>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        <div className="hidden overflow-x-auto sm:block">
          <Table className="w-max min-w-full table-fixed bg-background">
            <TableHeader className="sticky top-0 z-10 bg-background">
              <TableRow className="border-b border-border">
                {columns.map((column) => (
                  <SortableHeader
                    key={column.key}
                    column={column}
                    currentSort={sortConfig}
                    onSort={handleSort}
                  />
                ))}
              </TableRow>
            </TableHeader>

            <TableBody>
              {!hasRows ? (
                <TableRow className="border-b border-border">
                  <TableCell
                    colSpan={columns.length}
                    className="px-4"
                  >
                    <BudgetDetailsEmptyState filtered={hasActiveFilters} />
                  </TableCell>
                </TableRow>
              ) : (
                sortedAndFilteredData.map((item) => (
                  <TableRow
                    key={item.id}
                    className="border-b border-border transition-colors hover:bg-muted/20"
                  >
                    {columns.map((column) => (
                      <TableCell
                        key={column.key}
                        className={cn(
                          "px-1.5 py-2 text-sm",
                          getWidthClass(column.key),
                          column.align === "right" && "text-right",
                        )}
                      >
                        {column.key === "budgetCode" ? (
                          <div className="min-w-0">
                            <div className="truncate font-medium text-foreground">
                              {renderTextCell(item, column.key)}
                            </div>
                            {item.budgetCodeDescription ? (
                              <div className="truncate text-xs text-muted-foreground">
                                {item.budgetCodeDescription}
                              </div>
                            ) : null}
                          </div>
                        ) : column.isCurrency ? (
                          <CurrencyCell value={item[column.key] as number | undefined} />
                        ) : (
                          renderTextCell(item, column.key)
                        )}
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              )}
            </TableBody>

            <TableFooter>
              <TableRow className="border-t-2 border-border bg-muted/30 font-semibold">
                <TableCell colSpan={5} className="px-1.5 py-2 text-sm">
                  Total
                </TableCell>
                <TableCell
                  className={cn(
                    "px-1.5 py-2 text-right text-sm",
                    getWidthClass("approvedCOs"),
                  )}
                >
                  <CurrencyCell value={grandTotals.approvedCOs} />
                </TableCell>
                <TableCell
                  className={cn(
                    "px-1.5 py-2 text-right text-sm",
                    getWidthClass("budgetChanges"),
                  )}
                >
                  <CurrencyCell value={grandTotals.budgetChanges} />
                </TableCell>
                <TableCell
                  className={cn(
                    "px-1.5 py-2 text-right text-sm",
                    getWidthClass("committedCosts"),
                  )}
                >
                  <CurrencyCell value={grandTotals.committedCosts} />
                </TableCell>
                <TableCell
                  className={cn(
                    "px-1.5 py-2 text-right text-sm",
                    getWidthClass("directCosts"),
                  )}
                >
                  <CurrencyCell value={grandTotals.directCosts} />
                </TableCell>
                <TableCell
                  className={cn(
                    "px-1.5 py-2 text-right text-sm",
                    getWidthClass("forecastToComplete"),
                  )}
                >
                  <CurrencyCell value={grandTotals.forecastToComplete} />
                </TableCell>
                <TableCell
                  className={cn(
                    "px-1.5 py-2 text-right text-sm",
                    getWidthClass("originalBudgetAmount"),
                  )}
                >
                  <CurrencyCell value={grandTotals.originalBudgetAmount} />
                </TableCell>
                <TableCell
                  className={cn(
                    "px-1.5 py-2 text-right text-sm",
                    getWidthClass("pendingBudgetChanges"),
                  )}
                >
                  <CurrencyCell value={grandTotals.pendingBudgetChanges} />
                </TableCell>
                <TableCell
                  className={cn(
                    "px-1.5 py-2 text-right text-sm",
                    getWidthClass("pendingCostChanges"),
                  )}
                >
                  <CurrencyCell value={grandTotals.pendingCostChanges} />
                </TableCell>
              </TableRow>
            </TableFooter>
          </Table>
        </div>
      </div>
    </TooltipProvider>
  );
}
