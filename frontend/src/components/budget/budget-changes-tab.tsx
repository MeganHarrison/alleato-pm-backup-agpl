"use client";

import * as React from "react";
import {
  Ban,
  Check,
  Loader2,
  Send,
  X,
} from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import {
  EmbeddedUnifiedTablePage,
  type FilterValue,
  type TableColumn,
  useUnifiedTableState,
} from "@/components/tables/unified";
import { SectionRuleHeading } from "@/components/layout";
import { StatusBadge } from "@/components/ds";
import { Button } from "@/components/ui/button";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { apiFetch } from "@/lib/api-client";
import {
  type BudgetChangeStatus,
} from "@/lib/budget/budget-change-access";
import { appToast as toast } from "@/lib/toast/app-toast";
import { cn } from "@/lib/utils";
import {
  formatBudgetChangeLineLabel,
  formatBudgetChangeStatus,
  getBudgetChangeEndpoints,
  getBudgetChangeSearchText,
  getBudgetChangeStatusOptions,
  getBudgetChangeTransferAmount,
  getBulkActionSelectionCounts,
  type BudgetChangeAction,
  type BudgetChangeRecord,
} from "./budget-changes-utils";

type BudgetChangesFilterState = {
  status: BudgetChangeStatus | undefined;
};

const EMPTY_FILTERS: BudgetChangesFilterState = {
  status: undefined,
};

const STATUS_OPTIONS = [
  { value: "draft", label: "Draft" },
  { value: "pending", label: "Pending" },
  { value: "approved", label: "Approved" },
  { value: "void", label: "Void" },
] as const;

const DEFAULT_VISIBLE_COLUMNS = [
  "number",
  "status",
  "amount",
  "transferFrom",
  "transferTo",
  "createdAt",
];

interface BudgetChangesTabProps {
  projectId: string;
  onModificationChanged?: () => void;
  toolbarSlotId?: string;
}

function formatCurrency(value: number) {
  const isNegative = value < 0;
  const formatted = new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Math.abs(value));
  return isNegative ? `($${formatted})` : `$${formatted}`;
}

function formatDate(value: string | null) {
  if (!value) return "Not set";
  return new Date(value).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function getActionLabel(action: BudgetChangeAction, count: number) {
  switch (action) {
    case "submit":
      return count > 0 ? `Submit ${count}` : "Submit";
    case "approve":
      return count > 0 ? `Approve ${count}` : "Approve";
    case "reject":
      return count > 0 ? `Return ${count}` : "Return";
    case "void":
      return count > 0 ? `Void ${count}` : "Void";
    default:
      return action;
  }
}

function getActionIcon(action: BudgetChangeAction) {
  switch (action) {
    case "submit":
      return <Send className="h-4 w-4" />;
    case "approve":
      return <Check className="h-4 w-4" />;
    case "reject":
      return <X className="h-4 w-4" />;
    case "void":
      return <Ban className="h-4 w-4" />;
    default:
      return null;
  }
}

function renderBudgetChangeStatusBadge(status: BudgetChangeStatus, className?: string) {
  return (
    <StatusBadge
      status={formatBudgetChangeStatus(status)}
      className={cn("shrink-0", className)}
    />
  );
}

function BudgetChangeDetailContent({
  change,
  actionLoading,
  onStatusChange,
}: {
  change: BudgetChangeRecord;
  actionLoading: boolean;
  onStatusChange: (status: BudgetChangeStatus) => void;
}): React.ReactElement {
  const { from, to } = getBudgetChangeEndpoints(change.lines);
  const transferAmount = getBudgetChangeTransferAmount(change);
  const nextStatuses = (change.editableStatuses ?? []).filter(
    (status) => status !== change.status,
  );
  const detailActions = nextStatuses.map((status) => ({
    status,
    variant:
      status === "approved"
        ? ("default" as const)
        : status === "void"
          ? ("destructive" as const)
          : ("outline" as const),
    label:
      status === "pending"
        ? change.status === "draft"
          ? "Submit for approval"
          : "Mark pending"
        : status === "approved"
          ? "Approve change"
          : status === "draft"
            ? "Return to draft"
            : "Void change",
    icon:
      status === "pending" ? <Send className="h-4 w-4" />
      : status === "approved" ? <Check className="h-4 w-4" />
      : status === "draft" ? <X className="h-4 w-4" />
      : <Ban className="h-4 w-4" />,
  }));

  return (
    <div className="space-y-6 py-5">
      <div className="space-y-2 border-b border-border/60 pb-4">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1">
            <p className="text-lg font-semibold text-foreground">{change.number}</p>
            <p className="text-sm text-muted-foreground">
              {change.reason || change.title}
            </p>
          </div>
          <StatusBadge status={formatBudgetChangeStatus(change.status)} />
        </div>
      </div>

      <section className="space-y-3">
        <SectionRuleHeading label="Summary" className="mb-1 pb-0" />
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Created
            </p>
            <p className="text-sm text-foreground">{formatDate(change.createdAt)}</p>
          </div>
          <div className="space-y-1">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Effective
            </p>
            <p className="text-sm text-foreground">
              {formatDate(change.effectiveDate)}
            </p>
          </div>
          <div className="space-y-1">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Transfer amount
            </p>
            <p className="text-sm font-medium text-foreground">
              {formatCurrency(transferAmount)}
            </p>
          </div>
          <div className="space-y-1">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Workflow rule
            </p>
            <p className="text-sm text-foreground">
              Only approved changes affect budget totals.
            </p>
          </div>
        </div>
      </section>

      <section className="space-y-3">
        <SectionRuleHeading label="Transfer" className="mb-1 pb-0" />
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              From
            </p>
            <p className="text-sm text-foreground">
              {formatBudgetChangeLineLabel(from)}
            </p>
          </div>
          <div className="space-y-1">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              To
            </p>
            <p className="text-sm text-foreground">
              {formatBudgetChangeLineLabel(to)}
            </p>
          </div>
        </div>
      </section>

      <section className="space-y-3">
        <SectionRuleHeading label="Line details" className="mb-1 pb-0" />
        <div className="space-y-3">
          {change.lines.map((line) => (
            <div
              key={line.id}
              className="flex items-start justify-between gap-4 border-b border-border/40 pb-3 last:border-b-0 last:pb-0"
            >
              <div className="min-w-0 space-y-1">
                <p className="text-sm font-medium text-foreground">
                  {formatBudgetChangeLineLabel(line)}
                </p>
                <p className="text-sm text-muted-foreground">
                  {line.description || line.costCodeTitle || "No note"}
                </p>
              </div>
              <p
                className={cn(
                  "shrink-0 text-sm font-medium tabular-nums",
                  line.amount < 0 ? "text-destructive" : "text-foreground",
                )}
              >
                {formatCurrency(line.amount)}
              </p>
            </div>
          ))}
        </div>
      </section>

      <div className="flex flex-wrap justify-end gap-2 border-t border-border/60 pt-4">
        {detailActions.length === 0 ? (
          <Button
            type="button"
            variant="outline"
            disabled
          >
            No actions available
          </Button>
        ) : (
          detailActions.map((action) => (
            <Button
              key={action.status}
              type="button"
              variant={action.variant}
              onClick={() => onStatusChange(action.status)}
              disabled={actionLoading}
            >
              {actionLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                action.icon
              )}
              {action.label}
            </Button>
          ))
        )}
      </div>
    </div>
  );
}

export function BudgetChangesTab({
  projectId,
  onModificationChanged,
  toolbarSlotId,
}: BudgetChangesTabProps): React.ReactElement {
  const didNormalizeVisibleColumns = React.useRef(false);
  const router = useRouter();
  const pathname = usePathname() ?? "";
  const searchParams =
    (useSearchParams() ?? new URLSearchParams()) as NonNullable<
      ReturnType<typeof useSearchParams>
    >;
  const initialFilters: BudgetChangesFilterState = {
    status:
      (searchParams.get("status") as BudgetChangeStatus | null) ?? undefined,
  };

  const tableState = useUnifiedTableState({
    entityKey: "budget-changes",
    searchParams,
    pathname,
    router: {
      replace: (url: string) => router.replace(url),
    },
    defaults: {
      view: "table",
      allowedViews: ["table"],
      page: 1,
      perPage: 25,
      search: "",
      sortBy: "createdAt",
      sortDirection: "desc",
      visibleColumns: DEFAULT_VISIBLE_COLUMNS,
      filters: initialFilters,
    },
  });

  const [changes, setChanges] = React.useState<BudgetChangeRecord[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [rowActionLoadingId, setRowActionLoadingId] = React.useState<string | null>(
    null,
  );
  const [bulkActionLoading, setBulkActionLoading] =
    React.useState<BudgetChangeAction | null>(null);
  const [activeRowId, setActiveRowId] = React.useState<string | null>(
    tableState.detailParam,
  );

  const activeFilters = tableState.activeFilters as BudgetChangesFilterState;

  React.useEffect(() => {
    setActiveRowId(tableState.detailParam);
  }, [tableState.detailParam]);

  React.useEffect(() => {
    if (didNormalizeVisibleColumns.current) return;

    const validCurrentColumns = tableState.visibleColumns.filter((columnId) =>
      DEFAULT_VISIBLE_COLUMNS.includes(columnId),
    );
    const needsNormalization =
      validCurrentColumns.length !== DEFAULT_VISIBLE_COLUMNS.length ||
      validCurrentColumns.some(
        (columnId, index) => columnId !== DEFAULT_VISIBLE_COLUMNS[index],
      );

    if (needsNormalization) {
      tableState.setVisibleColumns(DEFAULT_VISIBLE_COLUMNS);
    }

    didNormalizeVisibleColumns.current = true;
  }, [tableState]);

  const fetchChanges = React.useCallback(async () => {
    try {
      setLoading(true);
      const response = await apiFetch<{ modifications?: BudgetChangeRecord[] }>(
        `/api/projects/${projectId}/budget/modifications`,
      );
      setChanges(response.modifications ?? []);
    } catch (error) {
      toast.error("Failed to load budget changes", {
        description:
          error instanceof Error ? error.message : "Please refresh and try again.",
      });
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  React.useEffect(() => {
    void fetchChanges();
  }, [fetchChanges]);

  const handleFilterChange = React.useCallback(
    (nextFilters: BudgetChangesFilterState) => {
      tableState.setActiveFilters(nextFilters);
      tableState.setSearchParams({
        status:
          typeof nextFilters.status === "string" ? nextFilters.status : null,
        page: "1",
      });
      tableState.setPage(1);
    },
    [tableState],
  );

  const filteredChanges = React.useMemo(() => {
    const normalizedQuery = tableState.searchInput.trim().toLowerCase();
    const statusFilter =
      typeof activeFilters.status === "string" ? activeFilters.status : undefined;

    return changes.filter((change) => {
      const matchesStatus = !statusFilter || change.status === statusFilter;
      const matchesSearch =
        normalizedQuery.length === 0 ||
        getBudgetChangeSearchText(change).includes(normalizedQuery);
      return matchesStatus && matchesSearch;
    });
  }, [activeFilters.status, changes, tableState.searchInput]);

  const selectedChange = React.useMemo(
    () => changes.find((change) => change.id === activeRowId) ?? null,
    [activeRowId, changes],
  );

  const bulkCounts = React.useMemo(
    () => getBulkActionSelectionCounts(changes, tableState.selectedIds),
    [changes, tableState.selectedIds],
  );

  const refreshAfterAction = React.useCallback(
    async (action: BudgetChangeAction) => {
      await fetchChanges();
      if (action === "approve" || action === "void") {
        onModificationChanged?.();
      }
    },
    [fetchChanges, onModificationChanged],
  );

  const runAction = React.useCallback(
    async (
      modificationId: string,
      action: BudgetChangeAction,
      options?: { successMessage?: string },
    ) => {
      setRowActionLoadingId(modificationId);
      try {
        const response = await apiFetch<{ message?: string; warning?: string }>(
          `/api/projects/${projectId}/budget/modifications`,
          {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ modificationId, action }),
          },
        );
        await refreshAfterAction(action);
        toast.success(
          options?.successMessage ?? response.message ?? "Budget change updated",
        );
        if (response.warning) {
          toast.error("Budget change updated with refresh warning", {
            description: response.warning,
          });
        }
      } catch (error) {
        toast.error("Failed to update budget change", {
          description:
            error instanceof Error ? error.message : "The status change did not save.",
        });
      } finally {
        setRowActionLoadingId(null);
      }
    },
    [projectId, refreshAfterAction],
  );

  const runStatusChange = React.useCallback(
    async (
      modificationId: string,
      status: BudgetChangeStatus,
      options?: { successMessage?: string },
    ) => {
      setRowActionLoadingId(modificationId);
      try {
        const response = await apiFetch<{ message?: string; warning?: string }>(
          `/api/projects/${projectId}/budget/modifications`,
          {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ modificationId, status }),
          },
        );

        await fetchChanges();
        if (status === "approved" || status === "void") {
          onModificationChanged?.();
        }

        if (response.warning) {
          toast.warning("Budget change updated with warning", {
            description: response.warning,
          });
        } else if (options?.successMessage || response.message) {
          toast.success(options?.successMessage ?? response.message);
        }
      } catch (error) {
        toast.error("Failed to update budget change", {
          description:
            error instanceof Error ? error.message : "The status change did not save.",
        });
      } finally {
        setRowActionLoadingId(null);
      }
    },
    [fetchChanges, onModificationChanged, projectId],
  );

  const runBulkAction = React.useCallback(
    async (action: BudgetChangeAction) => {
      const eligibleIds = changes
        .filter((change) => tableState.selectedIds.includes(change.id))
        .filter((change) => change.allowedActions?.includes(action))
        .map((change) => change.id);

      if (eligibleIds.length === 0) return;

      setBulkActionLoading(action);
      try {
        const results = await Promise.allSettled(
          eligibleIds.map((modificationId) =>
            apiFetch<{ message?: string }>(
              `/api/projects/${projectId}/budget/modifications`,
              {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ modificationId, action }),
              },
            ),
          ),
        );

        const failed = results.filter((result) => result.status === "rejected");
        const succeeded = results.length - failed.length;

        await refreshAfterAction(action);
        tableState.setSelectedIds((current) =>
          current.filter((id) => !eligibleIds.includes(id)),
        );

        if (failed.length === 0) {
          toast.success(`${getActionLabel(action, succeeded)} complete`);
          return;
        }

        const firstError = failed[0];
        const firstReason =
          firstError.status === "rejected" && firstError.reason instanceof Error
            ? firstError.reason.message
            : "Some changes could not be updated.";

        toast.error(
          `Updated ${succeeded} change${succeeded === 1 ? "" : "s"}, ${failed.length} failed`,
          {
            description: firstReason,
          },
        );
      } finally {
        setBulkActionLoading(null);
      }
    },
    [changes, projectId, refreshAfterAction, tableState],
  );

  const columns = React.useMemo<TableColumn<BudgetChangeRecord>[]>(() => {
    return [
      {
        id: "number",
        label: "Change",
        defaultVisible: true,
        sortable: true,
        align: "left",
        sortValue: (change) => `${change.number} ${change.reason || change.title}`,
        render: (change) => {
          const { from, to } = getBudgetChangeEndpoints(change.lines);
          return (
            <HoverCard openDelay={120} closeDelay={80}>
              <HoverCardTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  className="h-auto w-full justify-start px-0 py-0 text-left hover:bg-transparent"
                  onClick={(event) => {
                    event.stopPropagation();
                    setActiveRowId(change.id);
                    tableState.setSearchParams({ detail: change.id });
                  }}
                >
                  <span className="min-w-0 text-left font-medium text-foreground hover:text-primary">
                    {change.number} {change.reason || change.title}
                  </span>
                </Button>
              </HoverCardTrigger>
              <HoverCardContent align="start" side="right" className="w-96 p-4">
                <div className="space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-1">
                      <p className="text-sm font-semibold text-foreground">
                        {change.number}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {change.reason || change.title}
                      </p>
                    </div>
                    <StatusBadge status={formatBudgetChangeStatus(change.status)} />
                  </div>
                  <div className="grid grid-cols-2 gap-3 text-xs text-muted-foreground">
                    <div>
                      <p className="font-medium text-foreground">From</p>
                      <p>{formatBudgetChangeLineLabel(from)}</p>
                    </div>
                    <div>
                      <p className="font-medium text-foreground">To</p>
                      <p>{formatBudgetChangeLineLabel(to)}</p>
                    </div>
                    <div>
                      <p className="font-medium text-foreground">Created</p>
                      <p>{formatDate(change.createdAt)}</p>
                    </div>
                    <div>
                      <p className="font-medium text-foreground">Amount</p>
                      <p>{formatCurrency(getBudgetChangeTransferAmount(change))}</p>
                    </div>
                  </div>
                </div>
              </HoverCardContent>
            </HoverCard>
          );
        },
      },
      {
        id: "status",
        label: "Status",
        defaultVisible: true,
        sortable: true,
        showSortIcon: false,
        sortValue: (change) => change.status,
        render: (change) => {
          const statusOptions = getBudgetChangeStatusOptions(
            change.status,
            change.editableStatuses,
          );
          const inlineStatusDisabled = statusOptions.length <= 1;

          return (
            <Select
              value={change.status}
              onValueChange={(value) => {
                if (value === change.status) return;
                void runStatusChange(change.id, value as BudgetChangeStatus, {
                  successMessage: "Budget change status updated",
                });
              }}
              disabled={inlineStatusDisabled || rowActionLoadingId === change.id}
            >
              <SelectTrigger
                size="sm"
                variant="inline"
                className="min-w-36 justify-start px-2 text-left"
              >
                {rowActionLoadingId === change.id ? (
                  <span className="flex items-center gap-2 text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Saving
                  </span>
                ) : (
                  <SelectValue>{renderBudgetChangeStatusBadge(change.status)}</SelectValue>
                )}
              </SelectTrigger>
              <SelectContent align="start">
                {statusOptions.map((option) => (
                  <SelectItem key={`${change.id}-${option.value}`} value={option.value}>
                    {renderBudgetChangeStatusBadge(option.value)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          );
        },
      },
      {
        id: "amount",
        label: "Amount",
        defaultVisible: true,
        sortable: true,
        width: 140,
        align: "right",
        sortValue: (change) => getBudgetChangeTransferAmount(change),
        render: (change) => (
          <span className="block text-right text-sm font-medium tabular-nums text-foreground">
            {formatCurrency(getBudgetChangeTransferAmount(change))}
          </span>
        ),
      },
      {
        id: "transferFrom",
        label: "Transfer From",
        defaultVisible: true,
        sortable: false,
        width: 240,
        render: (change) => {
          const { from } = getBudgetChangeEndpoints(change.lines);
          return (
            <span className="block text-xs text-muted-foreground">
              {formatBudgetChangeLineLabel(from)}
            </span>
          );
        },
      },
      {
        id: "transferTo",
        label: "Transfer To",
        defaultVisible: true,
        sortable: false,
        width: 240,
        render: (change) => {
          const { to } = getBudgetChangeEndpoints(change.lines);
          return (
            <span className="block text-xs text-muted-foreground">
              {formatBudgetChangeLineLabel(to)}
            </span>
          );
        },
      },
      {
        id: "createdAt",
        label: "Created",
        defaultVisible: true,
        sortable: true,
        sortValue: (change) => change.createdAt,
        render: (change) => (
          <span className="text-sm text-foreground">{formatDate(change.createdAt)}</span>
        ),
      },
    ];
  }, [rowActionLoadingId, runAction, tableState]);

  const filters = React.useMemo(
    () => [
      {
        id: "status",
        label: "Status",
        type: "select" as const,
        options: STATUS_OPTIONS.map((option) => ({
          value: option.value,
          label: option.label,
        })),
      },
    ],
    [],
  );

  const isFiltered = Boolean(tableState.searchInput) || Boolean(activeFilters.status);

  const toolbarCustomActions =
    tableState.selectedIds.length > 0 ? (
      <div className="flex items-center gap-2">
        {(["submit", "approve", "reject", "void"] as BudgetChangeAction[]).map(
          (action) => {
            const count = bulkCounts[action];
            return (
              <Button
                key={action}
                type="button"
                size="sm"
                variant={
                  action === "approve"
                    ? "default"
                    : action === "void"
                      ? "destructive"
                      : "outline"
                }
                disabled={count === 0 || bulkActionLoading !== null}
                onClick={() => void runBulkAction(action)}
              >
                {bulkActionLoading === action ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  getActionIcon(action)
                )}
                {getActionLabel(action, count)}
              </Button>
            );
          },
        )}
      </div>
    ) : null;

  return (
    <EmbeddedUnifiedTablePage<BudgetChangeRecord>
      title="Budget Changes"
      layout={{
        containerClassName: "pb-0",
      }}
      toolbar={{
        totalItems: changes.length,
        filteredItems: filteredChanges.length,
        selectedCount: tableState.selectedIds.length,
        searchValue: tableState.searchInput,
        onSearchChange: tableState.setSearchInput,
        searchPlaceholder: "Search budget changes...",
        currentView: tableState.currentView,
        onViewChange: (view) => {
          tableState.setCurrentView(view);
          tableState.setSearchParams({ view });
        },
        enabledViews: ["table"],
        filters,
        activeFilters: activeFilters as Record<string, FilterValue>,
        onFilterChange: (nextFilters) =>
          handleFilterChange(nextFilters as BudgetChangesFilterState),
        onClearFilters: () => handleFilterChange(EMPTY_FILTERS),
        columns: columns.map((column) => ({
          id: column.id,
          label: column.label,
          defaultVisible: column.defaultVisible,
          alwaysVisible: column.id === "number",
        })),
        visibleColumns: tableState.visibleColumns,
        onColumnVisibilityChange: tableState.setVisibleColumns,
        customActions: toolbarCustomActions,
        portalContainerId: toolbarSlotId,
      }}
      data={{
        items: filteredChanges,
        isLoading: loading,
      }}
      table={{
        columns,
        getRowId: (item) => item.id,
        onRowClick: (item) => {
          setActiveRowId(item.id);
          tableState.setSearchParams({ detail: item.id });
        },
        activeRowId,
        stickyHeader: true,
      }}
      sorting={{
        sortBy: tableState.sortBy,
        sortDirection: tableState.sortDirection,
        onSortChange: (sortBy, direction) => {
          tableState.setSortBy(sortBy);
          tableState.setSortDirection(direction);
          tableState.setSearchParams({
            sort: sortBy,
            sort_dir: direction,
            page: "1",
          });
          tableState.setPage(1);
        },
      }}
      selection={{
        selectedIds: tableState.selectedIds,
        onSelectAll: (checked) => {
          tableState.setSelectedIds(
            checked ? filteredChanges.map((change) => change.id) : [],
          );
        },
        onSelectRow: (id, checked) => {
          tableState.setSelectedIds((current) =>
            checked
              ? current.includes(id)
                ? current
                : [...current, id]
              : current.filter((itemId) => itemId !== id),
          );
        },
      }}
      sidePanel={
        selectedChange
          ? {
              content: (
                <BudgetChangeDetailContent
                  change={selectedChange}
                  actionLoading={rowActionLoadingId === selectedChange.id}
                  onStatusChange={(status) =>
                    void runStatusChange(selectedChange.id, status)
                  }
                />
              ),
              storageKey: "budget-changes-detail",
              variant: "default",
              onClose: () => {
                setActiveRowId(null);
                tableState.setSearchParams({ detail: null });
              },
            }
          : undefined
      }
      emptyState={{
        title: "No budget changes",
        description: "Budget changes will appear here once they are created.",
        filteredDescription: "No budget changes match the current search or filters.",
        isFiltered,
      }}
      features={{
        enableViews: false,
        enableExport: false,
        enableBulkDelete: false,
        enableRowSelection: true,
      }}
    />
  );
}
