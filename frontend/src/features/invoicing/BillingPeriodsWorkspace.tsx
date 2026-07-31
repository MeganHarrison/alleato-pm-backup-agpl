"use client";

import * as React from "react";
import { format as formatDateValue } from "date-fns";
import { MoreVertical, Pencil, Plus, Trash2 } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DateField } from "@/components/forms";
import { PageTabs } from "@/components/layout/PageTabs";
import { StatusBadge } from "@/components/ds";
import {
  UnifiedTablePage,
  useUnifiedTableState,
  type ColumnConfig,
  type FilterConfig,
  type FilterValue,
  type TableColumn,
} from "@/components/tables/unified";
import {
  useBillingPeriodsList,
  useConfigureAutomaticBillingPeriods,
  useCreateBillingPeriod,
  useDeleteBillingPeriod,
  useInvoicingSettings,
  useUpdateBillingPeriod,
  type BillingPeriod,
  type BillingPeriodFrequency,
} from "@/hooks/use-billing-periods";
import { formatDate } from "@/lib/format";
import { validateBillingPeriodDraft } from "@/lib/invoicing/billing-period-validation";
import { toast } from "sonner";

type FilterState = Record<string, FilterValue>;

interface BillingPeriodsWorkspaceProps {
  projectId: string;
  tabs: Array<{ label: string; href: string; isActive: boolean }>;
}

const COLUMN_CONFIG: ColumnConfig[] = [
  { id: "period_number", label: "Period #", alwaysVisible: true },
  { id: "start_date", label: "From", defaultVisible: true },
  { id: "end_date", label: "To", defaultVisible: true },
  { id: "due_date", label: "Due Date", defaultVisible: true },
  { id: "status", label: "Status", defaultVisible: true },
];

const DEFAULT_VISIBLE_COLUMNS = COLUMN_CONFIG.filter(
  (column) => column.defaultVisible !== false || column.alwaysVisible,
).map((column) => column.id);

const FILTERS: FilterConfig[] = [
  {
    id: "status",
    label: "Status",
    type: "select",
    options: [
      { value: "open", label: "Open" },
      { value: "closed", label: "Closed" },
    ],
  },
];

function parseIsoDate(value: string): Date | undefined {
  const parts = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!parts) return undefined;
  return new Date(Number(parts[1]), Number(parts[2]) - 1, Number(parts[3]));
}

function toIsoDate(value: Date | undefined): string {
  return value ? formatDateValue(value, "yyyy-MM-dd") : "";
}

function sortPeriods(
  periods: BillingPeriod[],
  columns: TableColumn<BillingPeriod>[],
  sortBy: string | null,
  sortDirection: "asc" | "desc",
) {
  if (!sortBy) return periods;
  const getSortValue = columns.find(
    (column) => column.id === sortBy,
  )?.sortValue;
  if (!getSortValue) return periods;

  return [...periods].sort((left, right) => {
    const leftValue = getSortValue(left);
    const rightValue = getSortValue(right);
    const comparison = String(leftValue ?? "").localeCompare(
      String(rightValue ?? ""),
    );
    return sortDirection === "asc" ? comparison : -comparison;
  });
}

function suggestNextPeriod(periods: BillingPeriod[]) {
  const current = periods.find((period) => !period.is_closed);
  if (!current) return { start: "", end: "", due: "" };
  const currentEnd = parseIsoDate(current.end_date);
  if (!currentEnd) return { start: "", end: "", due: "" };

  const start = new Date(currentEnd);
  start.setDate(start.getDate() + 1);
  const end = new Date(start);
  end.setMonth(end.getMonth() + 1);
  end.setDate(end.getDate() - 1);

  return {
    start: toIsoDate(start),
    end: toIsoDate(end),
    due: toIsoDate(end),
  };
}

interface DateFieldsProps {
  startDate: string;
  endDate: string;
  dueDate: string;
  onStartDateChange: (value: string) => void;
  onEndDateChange: (value: string) => void;
  onDueDateChange: (value: string) => void;
}

function BillingPeriodDateFields({
  startDate,
  endDate,
  dueDate,
  onStartDateChange,
  onEndDateChange,
  onDueDateChange,
}: DateFieldsProps) {
  return (
    <div className="space-y-4 py-2">
      <div className="grid gap-4 sm:grid-cols-2">
        <DateField
          label="From"
          value={parseIsoDate(startDate)}
          onChange={(value) => onStartDateChange(toIsoDate(value))}
        />
        <DateField
          label="To"
          value={parseIsoDate(endDate)}
          onChange={(value) => onEndDateChange(toIsoDate(value))}
        />
      </div>
      <DateField
        label="Due Date"
        value={parseIsoDate(dueDate)}
        onChange={(value) => onDueDateChange(toIsoDate(value))}
      />
    </div>
  );
}

export function BillingPeriodsWorkspace({
  projectId,
  tabs,
}: BillingPeriodsWorkspaceProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const tableState = useUnifiedTableState({
    entityKey: "project-billing-periods",
    searchParams,
    pathname,
    router,
    defaults: {
      view: "table",
      allowedViews: ["table"],
      page: 1,
      perPage: 25,
      search: "",
      sortBy: "start_date",
      sortDirection: "desc",
      visibleColumns: DEFAULT_VISIBLE_COLUMNS,
      filters: { status: searchParams?.get("status") ?? undefined },
    },
  });

  const [visibleColumns, setVisibleColumns] = React.useState(
    DEFAULT_VISIBLE_COLUMNS,
  );
  const [createOpen, setCreateOpen] = React.useState(false);
  const [createMode, setCreateMode] = React.useState<"manual" | "automatic">(
    "manual",
  );
  const [startDate, setStartDate] = React.useState("");
  const [endDate, setEndDate] = React.useState("");
  const [dueDate, setDueDate] = React.useState("");
  const [frequency, setFrequency] =
    React.useState<BillingPeriodFrequency>("never");
  const [editing, setEditing] = React.useState<BillingPeriod | null>(null);
  const [editStartDate, setEditStartDate] = React.useState("");
  const [editEndDate, setEditEndDate] = React.useState("");
  const [editDueDate, setEditDueDate] = React.useState("");
  const [editStatus, setEditStatus] = React.useState<"open" | "closed">(
    "closed",
  );
  const [deleting, setDeleting] = React.useState<BillingPeriod | null>(null);

  const {
    data: periods = [],
    isLoading,
    isFetching,
    error,
  } = useBillingPeriodsList(projectId);
  const { data: settings } = useInvoicingSettings(projectId);
  const createMutation = useCreateBillingPeriod(projectId);
  const updateMutation = useUpdateBillingPeriod(projectId);
  const deleteMutation = useDeleteBillingPeriod(projectId);
  const configureMutation = useConfigureAutomaticBillingPeriods(projectId);

  React.useEffect(() => {
    if (!settings) return;
    setFrequency(settings.automatic_billing_frequency);
  }, [settings]);

  const columns = React.useMemo<TableColumn<BillingPeriod>[]>(
    () => [
      {
        id: "period_number",
        label: "Period #",
        alwaysVisible: true,
        sortable: true,
        sortValue: (period) => period.period_number,
        render: (period) => (
          <span className="flex items-center gap-2 font-medium text-primary tabular-nums">
            BP-{String(period.period_number).padStart(3, "0")}
            <span className="sm:hidden">
              <StatusBadge status={period.is_closed ? "closed" : "open"} />
            </span>
          </span>
        ),
      },
      {
        id: "start_date",
        label: "From",
        defaultVisible: true,
        sortable: true,
        sortValue: (period) => period.start_date,
        render: (period) => formatDate(period.start_date),
      },
      {
        id: "end_date",
        label: "To",
        defaultVisible: true,
        sortable: true,
        sortValue: (period) => period.end_date,
        render: (period) => formatDate(period.end_date),
      },
      {
        id: "due_date",
        label: "Due Date",
        defaultVisible: true,
        sortable: true,
        sortValue: (period) => period.due_date ?? "",
        render: (period) =>
          period.due_date ? (
            formatDate(period.due_date)
          ) : (
            <span className="text-muted-foreground">Not set</span>
          ),
      },
      {
        id: "status",
        label: "Status",
        defaultVisible: true,
        sortable: true,
        sortValue: (period) => (period.is_closed ? 1 : 0),
        render: (period) => (
          <StatusBadge status={period.is_closed ? "closed" : "open"} />
        ),
      },
    ],
    [],
  );

  const activeFilters = tableState.activeFilters as FilterState;
  const filteredPeriods = React.useMemo(() => {
    const status =
      typeof activeFilters.status === "string" ? activeFilters.status : "";
    const search = tableState.debouncedSearch.toLowerCase().trim();
    return periods.filter((period) => {
      if (status === "open" && period.is_closed) return false;
      if (status === "closed" && !period.is_closed) return false;
      if (!search) return true;
      return [
        `BP-${String(period.period_number).padStart(3, "0")}`,
        period.name ?? "",
        period.start_date,
        period.end_date,
        period.due_date ?? "",
      ].some((value) => value.toLowerCase().includes(search));
    });
  }, [activeFilters.status, periods, tableState.debouncedSearch]);

  const sortedPeriods = React.useMemo(
    () =>
      sortPeriods(
        filteredPeriods,
        columns,
        tableState.sortBy,
        tableState.sortDirection,
      ),
    [columns, filteredPeriods, tableState.sortBy, tableState.sortDirection],
  );
  const totalPages = Math.max(
    1,
    Math.ceil(sortedPeriods.length / tableState.perPage),
  );
  const pageItems = sortedPeriods.slice(
    (tableState.page - 1) * tableState.perPage,
    tableState.page * tableState.perPage,
  );

  const openCreate = () => {
    const suggestion = suggestNextPeriod(periods);
    setStartDate(suggestion.start);
    setEndDate(suggestion.end);
    setDueDate(suggestion.due);
    setCreateMode("manual");
    setCreateOpen(true);
  };

  const openEdit = (period: BillingPeriod) => {
    setEditing(period);
    setEditStartDate(period.start_date);
    setEditEndDate(period.end_date);
    setEditDueDate(period.due_date ?? "");
    setEditStatus(period.is_closed ? "closed" : "open");
  };

  const validateDates = (draft: {
    start_date: string;
    end_date: string;
    due_date: string;
  }) => {
    const message = validateBillingPeriodDraft(draft);
    if (message) toast.error(message);
    return !message;
  };

  const saveManual = () => {
    if (
      !validateDates({
        start_date: startDate,
        end_date: endDate,
        due_date: dueDate,
      })
    ) {
      return;
    }
    createMutation.mutate(
      { start_date: startDate, end_date: endDate, due_date: dueDate },
      {
        onSuccess: () => {
          setCreateOpen(false);
          setStartDate("");
          setEndDate("");
          setDueDate("");
        },
      },
    );
  };

  const saveAutomatic = () => {
    if (
      frequency !== "never" &&
      !validateDates({
        start_date: startDate,
        end_date: endDate,
        due_date: dueDate,
      })
    ) {
      return;
    }
    configureMutation.mutate(
      {
        automatic_billing_frequency: frequency,
        automatic_anchor_start_date: frequency === "never" ? null : startDate,
        automatic_anchor_end_date: frequency === "never" ? null : endDate,
        automatic_anchor_due_date: frequency === "never" ? null : dueDate,
      },
      { onSuccess: () => setCreateOpen(false) },
    );
  };

  const saveEdit = () => {
    if (
      !editing ||
      !validateDates({
        start_date: editStartDate,
        end_date: editEndDate,
        due_date: editDueDate,
      })
    ) {
      return;
    }
    updateMutation.mutate(
      {
        periodId: editing.id,
        start_date: editStartDate,
        end_date: editEndDate,
        due_date: editDueDate,
        is_closed: editStatus === "closed",
      },
      { onSuccess: () => setEditing(null) },
    );
  };

  const frequencyLabel =
    settings?.automatic_billing_frequency === "monthly"
      ? "Monthly"
      : settings?.automatic_billing_frequency === "weekly"
        ? "Weekly"
        : "Off";

  return (
    <>
      <UnifiedTablePage
        header={{
          title: "Invoices",
          description: `Opening a billing period closes the current one. Automatic creation: ${frequencyLabel}.`,
          actions: (
            <Button size="sm" onClick={openCreate}>
              <Plus />
              Create Billing Period
            </Button>
          ),
        }}
        tabs={tabs}
        toolbar={{
          totalItems: periods.length,
          filteredItems: filteredPeriods.length,
          searchValue: tableState.searchInput,
          onSearchChange: tableState.setSearchInput,
          searchPlaceholder: "Search billing periods...",
          currentView: "table",
          onViewChange: () => undefined,
          enabledViews: ["table"],
          filters: FILTERS,
          activeFilters,
          onFilterChange: (nextFilters) => {
            tableState.setActiveFilters(nextFilters);
            tableState.setSearchParams({
              status:
                typeof nextFilters.status === "string"
                  ? nextFilters.status
                  : null,
              page: "1",
            });
            tableState.setPage(1);
          },
          onClearFilters: () => {
            tableState.setActiveFilters({ status: undefined });
            tableState.setSearchParams({ status: null, page: "1" });
            tableState.setPage(1);
          },
          columns: COLUMN_CONFIG,
          visibleColumns,
          onColumnVisibilityChange: setVisibleColumns,
        }}
        data={{
          items: pageItems,
          isLoading,
          isFetching,
          error: error instanceof Error ? error : undefined,
        }}
        table={{
          columns,
          getRowId: (period) => period.id,
          onRowClick: (period) =>
            router.push(`/${projectId}/billing-periods/${period.id}`),
          rowActions: (period) => (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-11 w-11 p-0 xl:h-8 xl:w-8"
                  aria-label={`Actions for BP-${String(period.period_number).padStart(3, "0")}`}
                >
                  <MoreVertical />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => openEdit(period)}>
                  <Pencil className="mr-2 h-4 w-4" />
                  Edit
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  className="text-destructive focus:text-destructive"
                  onClick={() => setDeleting(period)}
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ),
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
        emptyState={{
          title: "No billing periods yet",
          description:
            "Use Create Billing Period to add the first billing cycle.",
          filteredDescription: "Try adjusting your search or status filter.",
          isFiltered: Boolean(tableState.searchInput || activeFilters.status),
        }}
        pagination={{
          page: tableState.page,
          totalPages,
          perPage: tableState.perPage,
          onPageChange: (page) => {
            tableState.setPage(page);
            tableState.setSearchParams({ page: String(page) });
          },
          onPerPageChange: (value) => {
            const perPage = Number(value);
            if (!Number.isFinite(perPage) || perPage <= 0) return;
            tableState.setPerPage(perPage);
            tableState.setPage(1);
            tableState.setSearchParams({
              per_page: String(perPage),
              page: "1",
            });
          },
        }}
        features={{ enableViews: false, enableRowSelection: false }}
      />

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Billing Period Setup</DialogTitle>
            <DialogDescription>
              Add one period now or configure the next automatic cycle.
            </DialogDescription>
          </DialogHeader>
          <PageTabs
            variant="inline"
            onTabClick={(href) => {
              const mode = href as "manual" | "automatic";
              setCreateMode(mode);
              if (mode === "automatic" && settings) {
                setFrequency(settings.automatic_billing_frequency);
                setStartDate(settings.automatic_anchor_start_date ?? startDate);
                setEndDate(settings.automatic_anchor_end_date ?? endDate);
                setDueDate(settings.automatic_anchor_due_date ?? dueDate);
              }
            }}
            tabs={[
              {
                label: "Manual",
                href: "manual",
                isActive: createMode === "manual",
              },
              {
                label: "Automatic",
                href: "automatic",
                isActive: createMode === "automatic",
              },
            ]}
          />

          {createMode === "manual" ? (
            <>
              <p className="text-sm text-muted-foreground">
                The new period opens immediately and the current period closes.
              </p>
              <BillingPeriodDateFields
                startDate={startDate}
                endDate={endDate}
                dueDate={dueDate}
                onStartDateChange={setStartDate}
                onEndDateChange={setEndDate}
                onDueDateChange={setDueDate}
              />
            </>
          ) : (
            <div className="space-y-4 py-2">
              <div className="space-y-2">
                <label
                  className="text-sm font-medium"
                  htmlFor="automatic-frequency"
                >
                  Frequency
                </label>
                <Select
                  value={frequency}
                  onValueChange={(value) =>
                    setFrequency(value as BillingPeriodFrequency)
                  }
                >
                  <SelectTrigger id="automatic-frequency">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="never">Never</SelectItem>
                    <SelectItem value="monthly">Monthly</SelectItem>
                    <SelectItem value="weekly">Weekly</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {frequency === "never" ? (
                <p className="text-sm text-muted-foreground">
                  No future billing periods will be created automatically.
                </p>
              ) : (
                <>
                  {periods.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      Create the first period manually before enabling automatic
                      creation.
                    </p>
                  ) : null}
                  <BillingPeriodDateFields
                    startDate={startDate}
                    endDate={endDate}
                    dueDate={dueDate}
                    onStartDateChange={setStartDate}
                    onEndDateChange={setEndDate}
                    onDueDateChange={setDueDate}
                  />
                </>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>
              Cancel
            </Button>
            <Button
              disabled={createMutation.isPending || configureMutation.isPending}
              onClick={createMode === "manual" ? saveManual : saveAutomatic}
            >
              {createMutation.isPending || configureMutation.isPending
                ? "Saving..."
                : createMode === "manual"
                  ? "Create"
                  : "Save Schedule"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(editing)}
        onOpenChange={(open) => !open && setEditing(null)}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              Edit BP-{String(editing?.period_number ?? 0).padStart(3, "0")}
            </DialogTitle>
            <DialogDescription>
              Opening this period closes any other open billing period.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <label
              className="text-sm font-medium"
              htmlFor="billing-period-status"
            >
              Status
            </label>
            <Select
              value={editStatus}
              onValueChange={(value) =>
                setEditStatus(value as "open" | "closed")
              }
            >
              <SelectTrigger id="billing-period-status">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="open">Open</SelectItem>
                <SelectItem value="closed">Closed</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <BillingPeriodDateFields
            startDate={editStartDate}
            endDate={editEndDate}
            dueDate={editDueDate}
            onStartDateChange={setEditStartDate}
            onEndDateChange={setEditEndDate}
            onDueDateChange={setEditDueDate}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>
              Cancel
            </Button>
            <Button disabled={updateMutation.isPending} onClick={saveEdit}>
              {updateMutation.isPending ? "Saving..." : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={Boolean(deleting)}
        onOpenChange={(open) => !open && setDeleting(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this billing period?</AlertDialogTitle>
            <AlertDialogDescription>
              A period linked to invoice or payment history cannot be deleted.
              This action permanently removes an unlinked period.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={deleteMutation.isPending}
              onClick={(event) => {
                event.preventDefault();
                if (!deleting) return;
                deleteMutation.mutate(deleting.id, {
                  onSuccess: () => setDeleting(null),
                });
              }}
            >
              {deleteMutation.isPending ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
