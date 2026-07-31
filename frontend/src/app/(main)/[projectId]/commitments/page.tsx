"use client";

import * as React from "react";
import type { ReactElement, ReactNode } from "react";
import {
  useParams,
  usePathname,
  useRouter,
  useSearchParams,
} from "next/navigation";
import {
  ChevronDown,
  FileSignature,
  MoreVertical,
  Plus,
  RotateCcw,
  ShoppingCart,
  Trash2,
  Trash,
} from "lucide-react";
import { toast } from "sonner";

import { reportNonCriticalFailure } from "@/lib/report-non-critical-failure";
import { PermissionGate } from "@/components/domain/permissions/PermissionGate";
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { ExportDialog } from "@/components/commitments/ExportDialog";
import { CommitmentsHelpSheet } from "@/components/commitments/CommitmentsHelpSheet";
import {
  DetailPanel,
  TableExpandedRow,
  UnifiedTablePage,
  useUnifiedTableState,
  type FilterValue,
} from "@/components/tables/unified";
import { useQueryClient } from "@tanstack/react-query";
import {
  commitmentKeys,
  useCommitmentsList,
  useDeleteCommitment,
} from "@/hooks/use-commitments-query";
import type { CommitmentListItem } from "@/lib/validation/commitments";
import { formatCurrency } from "@/lib/utils";
import { apiFetch } from "@/lib/api-client";
import {
  buildCommitmentDetailFields,
  buildCommitmentTableColumns,
  commitmentColumns,
  commitmentDefaultVisibleColumns,
  commitmentFilters,
  renderCommitmentCard,
  renderCommitmentList,
  renderCommitmentRowActions,
} from "@/features/commitments/commitments-table-config";
import {
  InlineTable,
  InlineTableBody,
  InlineTableCell,
  InlineTableHeader,
  InlineTableHeaderCell,
  InlineTableHeaderRow,
  InlineTableRow,
} from "@/components/ds/inline-table";
import { Skeleton } from "@/components/ui/skeleton";

const EMPTY_FILTERS: Record<string, FilterValue> = {
  status: undefined,
  type: undefined,
  tab: undefined,
};

// ─── Commitment Change Orders expanded sub-row ───────────────────────────────

interface CommitmentChangeOrder {
  id: string;
  number: string;
  title: string;
  status: string;
  amount: number;
  requested_date: string | null;
  approved_date: string | null;
}

interface CommitmentChangeOrdersRowProps {
  commitmentId: string;
  colSpan: number;
}

function CommitmentChangeOrdersRow({
  commitmentId,
  colSpan,
}: CommitmentChangeOrdersRowProps): ReactNode {
  const [changeOrders, setChangeOrders] = React.useState<
    CommitmentChangeOrder[]
  >([]);
  const [isLoading, setIsLoading] = React.useState(true);

  React.useEffect(() => {
    let cancelled = false;
    setIsLoading(true);

    apiFetch<{ data?: CommitmentChangeOrder[] }>(
      `/api/commitments/${commitmentId}/change-orders`,
    )
      .then((json) => {
        if (!cancelled) {
          setChangeOrders(json.data ?? []);
          setIsLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setIsLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [commitmentId]);

  const formatAmt = (value: number) =>
    new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      maximumFractionDigits: 0,
    }).format(value);

  if (!isLoading && changeOrders.length === 0) {
    return null;
  }

  return (
    <TableExpandedRow colSpan={colSpan}>
      <div className="px-6 py-3">
        {isLoading ? (
          <div className="space-y-1.5 py-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="flex items-center gap-6">
                <Skeleton className="h-3.5 w-8" />
                <Skeleton className="h-3.5 w-40" />
                <Skeleton className="h-3.5 w-16" />
                <Skeleton className="h-3.5 w-20 ml-auto" />
                <Skeleton className="h-3.5 w-20" />
              </div>
            ))}
          </div>
        ) : (
          <InlineTable variant="read">
            <InlineTableHeader>
              <InlineTableHeaderRow>
                <InlineTableHeaderCell>#</InlineTableHeaderCell>
                <InlineTableHeaderCell>Description</InlineTableHeaderCell>
                <InlineTableHeaderCell>Status</InlineTableHeaderCell>
                <InlineTableHeaderCell align="right">
                  Amount
                </InlineTableHeaderCell>
                <InlineTableHeaderCell>Requested</InlineTableHeaderCell>
              </InlineTableHeaderRow>
            </InlineTableHeader>
            <InlineTableBody>
              {changeOrders.map((co) => (
                <InlineTableRow key={co.id}>
                  <InlineTableCell className="font-mono text-muted-foreground">
                    {co.number}
                  </InlineTableCell>
                  <InlineTableCell className="max-w-xs truncate">
                    {co.title}
                  </InlineTableCell>
                  <InlineTableCell className="capitalize">
                    {co.status}
                  </InlineTableCell>
                  <InlineTableCell align="right" numeric>
                    {formatAmt(co.amount)}
                  </InlineTableCell>
                  <InlineTableCell className="text-muted-foreground">
                    {co.requested_date
                      ? new Date(co.requested_date).toLocaleDateString()
                      : "—"}
                  </InlineTableCell>
                </InlineTableRow>
              ))}
            </InlineTableBody>
          </InlineTable>
        )}
      </div>
    </TableExpandedRow>
  );
}

// ─── Project-level Change Orders tab table ────────────────────────────────────

interface ProjectCORow extends CommitmentChangeOrder {
  commitment_id?: string;
  commitment_number?: string;
}

interface ProjectChangeOrdersTableProps {
  changeOrders: ProjectCORow[];
  isLoading: boolean;
}

function ProjectChangeOrdersTable({
  changeOrders,
  isLoading,
}: ProjectChangeOrdersTableProps): ReactNode {
  const formatAmt = (value: number) =>
    new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      maximumFractionDigits: 0,
    }).format(value);

  if (isLoading) {
    return (
      <div className="space-y-2 py-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="flex items-center gap-6">
            <Skeleton className="h-4 w-8" />
            <Skeleton className="h-4 w-48" />
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-4 w-24 ml-auto" />
          </div>
        ))}
      </div>
    );
  }

  if (changeOrders.length === 0) {
    return (
      <div className="py-8 text-sm text-muted-foreground">
        No commitment change orders for this project.
      </div>
    );
  }

  return (
    <InlineTable variant="read">
      <InlineTableHeader>
        <InlineTableHeaderRow>
          <InlineTableHeaderCell>#</InlineTableHeaderCell>
          <InlineTableHeaderCell>Description</InlineTableHeaderCell>
          <InlineTableHeaderCell>Status</InlineTableHeaderCell>
          <InlineTableHeaderCell>Commitment</InlineTableHeaderCell>
          <InlineTableHeaderCell align="right">Amount</InlineTableHeaderCell>
          <InlineTableHeaderCell>Requested</InlineTableHeaderCell>
        </InlineTableHeaderRow>
      </InlineTableHeader>
      <InlineTableBody>
        {changeOrders.map((co) => (
          <InlineTableRow key={co.id}>
            <InlineTableCell className="font-mono text-muted-foreground">
              {co.number}
            </InlineTableCell>
            <InlineTableCell className="max-w-xs truncate">
              {co.title}
            </InlineTableCell>
            <InlineTableCell className="capitalize">
              {co.status}
            </InlineTableCell>
            <InlineTableCell className="text-muted-foreground">
              {co.commitment_number ?? "—"}
            </InlineTableCell>
            <InlineTableCell align="right" numeric>
              {formatAmt(co.amount)}
            </InlineTableCell>
            <InlineTableCell className="text-muted-foreground">
              {co.requested_date
                ? new Date(co.requested_date).toLocaleDateString()
                : "—"}
            </InlineTableCell>
          </InlineTableRow>
        ))}
      </InlineTableBody>
    </InlineTable>
  );
}

type FilterState = Record<string, FilterValue>;

export default function ProjectCommitmentsPage(): ReactElement {
  const params = useParams<{ projectId: string }>()! ?? { projectId: "" };
  const pathname = usePathname()!;
  const router = useRouter();
  const searchParams = (useSearchParams() ??
    new URLSearchParams()) as NonNullable<ReturnType<typeof useSearchParams>>;
  const projectId = params.projectId ?? "";
  const queryClient = useQueryClient();

  const [isExportDialogOpen, setIsExportDialogOpen] = React.useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = React.useState(false);
  const [bulkDeleteDialogOpen, setBulkDeleteDialogOpen] = React.useState(false);
  const [isDeleting, setIsDeleting] = React.useState(false);
  const [isBulkDeleting, setIsBulkDeleting] = React.useState(false);
  const [commitmentToDelete, setCommitmentToDelete] =
    React.useState<CommitmentListItem | null>(null);

  // ─── Project-level change orders (Change Orders tab) ──────────────────────
  const [projectChangeOrders, setProjectChangeOrders] = React.useState<
    CommitmentChangeOrder[]
  >([]);
  const [isLoadingProjectCOs, setIsLoadingProjectCOs] = React.useState(false);

  const initialStatus = searchParams.get("status") ?? "";
  const initialType = searchParams.get("type") ?? "";
  const initialTab = searchParams.get("tab") ?? "";
  const initialFilters: FilterState = {
    status: initialStatus || undefined,
    type: initialType || undefined,
    tab: initialTab || undefined,
  };

  const tableState = useUnifiedTableState({
    entityKey: "commitments-v4",
    searchParams,
    pathname,
    router,
    defaults: {
      view: "table",
      allowedViews: ["table", "card", "list"],
      page: 1,
      perPage: 25,
      search: "",
      sortBy: "number",
      sortDirection: "asc",
      visibleColumns: commitmentDefaultVisibleColumns,
      filters: initialFilters,
    },
  });

  // Derive activeFilters directly from the URL so they are always in sync with
  // the current searchParams on every render — no useEffect lag, no TDZ risk.
  const activeFilters = React.useMemo<FilterState>(
    () => ({
      status: searchParams.get("status") || undefined,
      type: searchParams.get("type") || undefined,
      tab: searchParams.get("tab") || undefined,
    }),
    [searchParams],
  );

  // Fetch project-level change orders when the Change Orders tab is active
  React.useEffect(() => {
    if (activeFilters.tab !== "change-orders") return;
    let cancelled = false;
    setIsLoadingProjectCOs(true);

    apiFetch<{ data?: CommitmentChangeOrder[] }>(
      `/api/projects/${projectId}/commitment-change-orders`,
    )
      .then((json) => {
        if (!cancelled) {
          setProjectChangeOrders(json.data ?? []);
          setIsLoadingProjectCOs(false);
        }
      })
      .catch(() => {
        if (!cancelled) setIsLoadingProjectCOs(false);
      });

    return () => {
      cancelled = true;
    };
  }, [activeFilters.tab, projectId]);

  const isRecycleBinTab = activeFilters.tab === "recycle-bin";
  const isChangeOrdersTab = activeFilters.tab === "change-orders";

  const effectiveVisibleColumns = tableState.visibleColumns;

  // Internal page modes still use the `tab` query param. Keep that state out of
  // the filter badge and clear action so the toolbar reflects only user-applied
  // filters.
  const toolbarActiveFilters = React.useMemo(() => {
    const { tab: _tab, ...rest } = activeFilters;
    return rest;
  }, [activeFilters]);

  const {
    data: response,
    isLoading,
    isFetching,
    error,
    refetch,
  } = useCommitmentsList(projectId, {
    page: tableState.page,
    limit: tableState.perPage,
    status:
      typeof activeFilters.status === "string"
        ? activeFilters.status
        : undefined,
    type:
      typeof activeFilters.type === "string" ? activeFilters.type : undefined,
    search:
      (searchParams.get("search") ?? tableState.debouncedSearch) || undefined,
    deleted: isRecycleBinTab ? "only" : "exclude",
  });
  const resolvedError =
    error instanceof Error
      ? error
      : error
        ? new Error("Failed to load commitments")
        : undefined;

  const deleteCommitment = useDeleteCommitment(projectId);

  // ─── Acumatica Sync ──────────────────────────────────────────────────────

  const handleStatusChange = React.useCallback(
    async (id: string, status: string) => {
      try {
        await apiFetch(`/api/commitments/${id}`, {
          method: "PATCH",
          body: JSON.stringify({ status }),
        });
        toast.success("Status updated");
        // Must use the list key factory (["commitments","list",...]). A bare
        // ["commitments", projectId] never prefix-matches, so the cell would
        // silently show stale data until a manual reload.
        await queryClient.invalidateQueries({
          queryKey: commitmentKeys.lists(),
        });
      } catch (err) {
        toast.error("Failed to update status");
      }
    },
    [projectId, queryClient],
  );

  // Inline cell edits (title / description / executed). The table's own
  // commitInlineEdit shows the success/error toast and reverts the cell if this
  // throws — so we deliberately do NOT swallow errors or toast here. apiFetch
  // throws on a non-2xx response, which is exactly the revert signal the table
  // wants.
  const handleInlineEdit = React.useCallback(
    async (
      id: string,
      field: "title" | "description" | "executed",
      value: string | boolean,
    ) => {
      await apiFetch(`/api/commitments/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ [field]: value }),
      });
      await queryClient.invalidateQueries({ queryKey: commitmentKeys.lists() });
    },
    [queryClient],
  );

  const commitments = response?.data ?? [];

  const totalItems = response?.meta.total ?? commitments.length;
  const totalPages = response?.meta.totalPages ?? 1;

  const financialTotals = React.useMemo(() => {
    return commitments.reduce(
      (acc, item) => ({
        original_amount: acc.original_amount + item.original_amount,
        approved_change_orders:
          acc.approved_change_orders + item.approved_change_orders,
        pending_change_orders:
          acc.pending_change_orders + item.pending_change_orders,
        draft_change_orders: acc.draft_change_orders + item.draft_change_orders,
        revised_contract_amount:
          acc.revised_contract_amount + item.revised_contract_amount,
        invoiced_amount: acc.invoiced_amount + item.invoiced_amount,
        billed_to_date: acc.billed_to_date + item.billed_to_date,
        payments_issued: acc.payments_issued + item.payments_issued,
        remaining_balance: acc.remaining_balance + item.remaining_balance,
        balance_to_finish: acc.balance_to_finish + item.balance_to_finish,
      }),
      {
        original_amount: 0,
        approved_change_orders: 0,
        pending_change_orders: 0,
        draft_change_orders: 0,
        revised_contract_amount: 0,
        invoiced_amount: 0,
        billed_to_date: 0,
        payments_issued: 0,
        remaining_balance: 0,
        balance_to_finish: 0,
      },
    );
  }, [commitments]);

  // Row expansion state — collapsed by default
  const [expandedIds, setExpandedIds] = React.useState<Set<string>>(new Set());
  const handleToggleExpand = React.useCallback((id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const tableColumns = React.useMemo(
    () =>
      buildCommitmentTableColumns(
        projectId,
        expandedIds,
        handleToggleExpand,
        handleStatusChange,
        // No inline editing in the recycle bin — deleted rows are read-only.
        isRecycleBinTab ? undefined : handleInlineEdit,
      ),
    [
      projectId,
      expandedIds,
      handleToggleExpand,
      handleStatusChange,
      handleInlineEdit,
      isRecycleBinTab,
    ],
  );
  const sortedCommitments = React.useMemo(() => {
    if (!tableState.sortBy) return commitments;
    const sortColumn = tableColumns.find(
      (column) => column.id === tableState.sortBy,
    );
    const getSortValue = sortColumn?.sortValue;
    if (!getSortValue) return commitments;

    const sorted = [...commitments].sort((a, b) => {
      const valueA = getSortValue(a);
      const valueB = getSortValue(b);

      if (valueA == null && valueB == null) return 0;
      if (valueA == null) return tableState.sortDirection === "asc" ? -1 : 1;
      if (valueB == null) return tableState.sortDirection === "asc" ? 1 : -1;

      if (typeof valueA === "number" && typeof valueB === "number") {
        return tableState.sortDirection === "asc"
          ? valueA - valueB
          : valueB - valueA;
      }

      const comparison = String(valueA).localeCompare(String(valueB));
      return tableState.sortDirection === "asc" ? comparison : -comparison;
    });

    return sorted;
  }, [commitments, tableColumns, tableState.sortBy, tableState.sortDirection]);

  const handleFilterChange = (nextFilters: FilterState) => {
    tableState.setSearchParams({
      status:
        typeof nextFilters.status === "string" ? nextFilters.status : null,
      type: typeof nextFilters.type === "string" ? nextFilters.type : null,
      tab: typeof nextFilters.tab === "string" ? nextFilters.tab : null,
      page: "1",
    });
    tableState.setPage(1);
  };

  // ─── Same-page slide-over editor ──────────────────────────────────────────
  // Editing happens in a slide-over panel on the list page — no navigation to a
  // separate edit route. The list row only carries a few fields, so we fetch the
  // full record on open to edit dates/etc. too.
  const [editId, setEditId] = React.useState<string | null>(null);
  const [editDetail, setEditDetail] = React.useState<Record<
    string,
    unknown
  > | null>(null);

  const editIndex = React.useMemo(
    () => (editId ? sortedCommitments.findIndex((c) => c.id === editId) : -1),
    [editId, sortedCommitments],
  );

  const openEdit = React.useCallback(async (item: CommitmentListItem) => {
    setEditId(item.id);
    setEditDetail(null);
    try {
      const res = await apiFetch<{ data: Record<string, unknown> }>(
        `/api/commitments/${item.id}`,
      );
      setEditDetail(res.data);
    } catch (err) {
      toast.error("Could not open commitment for editing", {
        description: err instanceof Error ? err.message : "Unexpected error",
      });
      setEditId(null);
    }
  }, []);

  // DetailPanel binds <input type="date"> which needs YYYY-MM-DD, not full ISO.
  const panelItem = React.useMemo(() => {
    if (!editDetail) return null;
    const toDateInput = (value: unknown) =>
      typeof value === "string" && value.length >= 10
        ? value.slice(0, 10)
        : (value ?? "");
    return {
      ...editDetail,
      start_date: toDateInput(editDetail.start_date),
      estimated_completion_date: toDateInput(
        editDetail.estimated_completion_date,
      ),
      contract_date: toDateInput(editDetail.contract_date),
      signed_contract_received_date: toDateInput(
        editDetail.signed_contract_received_date,
      ),
      signed_po_received_date: toDateInput(editDetail.signed_po_received_date),
      delivery_date: toDateInput(editDetail.delivery_date),
    };
  }, [editDetail]);

  const EDITABLE_DETAIL_KEYS = React.useMemo(
    () =>
      [
        "title",
        "status",
        "description",
        "executed",
        "start_date",
        "estimated_completion_date",
        "contract_date",
        "signed_contract_received_date",
        "signed_po_received_date",
        "delivery_date",
      ] as const,
    [],
  );

  const handleDetailSave = React.useCallback(
    async (formData: Partial<Record<string, unknown>>) => {
      if (!editId) return;
      const payload: Record<string, unknown> = {};
      for (const key of EDITABLE_DETAIL_KEYS) {
        if (!(key in formData)) continue;
        let value = formData[key];
        if (key === "executed") {
          value = value === true || value === "true";
        } else if (value === "") {
          value = null; // empty date/text → clear
        }
        payload[key] = value;
      }

      // PUT validates against the full edit schema and ignores readonly fields.
      await apiFetch(`/api/commitments/${editId}`, {
        method: "PUT",
        body: JSON.stringify(payload),
      });
      toast.success("Commitment updated");
      await queryClient.invalidateQueries({ queryKey: commitmentKeys.lists() });
      // Re-pull the record so the panel reflects any server-side normalization.
      const res = await apiFetch<{ data: Record<string, unknown> }>(
        `/api/commitments/${editId}`,
      );
      setEditDetail(res.data);
    },
    [editId, queryClient, EDITABLE_DETAIL_KEYS],
  );

  const handleDetailDelete = React.useCallback(async () => {
    if (!editId) return;
    await apiFetch(`/api/commitments/${editId}`, { method: "DELETE" });
    toast.success("Commitment deleted");
    await queryClient.invalidateQueries({ queryKey: commitmentKeys.lists() });
    await refetch();
    setEditId(null);
    setEditDetail(null);
  }, [editId, queryClient, refetch]);

  const navigateEdit = React.useCallback(
    (direction: "prev" | "next") => {
      const nextIndex = direction === "prev" ? editIndex - 1 : editIndex + 1;
      const next = sortedCommitments[nextIndex];
      if (next) void openEdit(next);
    },
    [editIndex, sortedCommitments, openEdit],
  );

  const handleRowClick = (item: CommitmentListItem) => {
    router.push(`/${projectId}/commitments/${item.id}`);
  };

  const handleEdit = (item: CommitmentListItem) => {
    router.push(`/${projectId}/commitments/${item.id}`);
  };

  const handleDeleteIntent = (item: CommitmentListItem) => {
    setCommitmentToDelete(item);
    setDeleteDialogOpen(true);
  };
  const [recycleDeleteDialogOpen, setRecycleDeleteDialogOpen] =
    React.useState(false);
  const [recycleCommitmentToDelete, setRecycleCommitmentToDelete] =
    React.useState<CommitmentListItem | null>(null);
  const [isPermanentlyDeleting, setIsPermanentlyDeleting] =
    React.useState(false);

  const handleRestoreIntent = async (item: CommitmentListItem) => {
    try {
      await apiFetch(`/api/commitments/${item.id}/restore`, { method: "POST" });
      toast.success(`"${item.number}" restored`);
      tableState.setSelectedIds((prev) =>
        prev.filter((selectedId) => selectedId !== item.id),
      );
      await refetch();
    } catch (err) {
      toast.error("Could not restore commitment", {
        description: err instanceof Error ? err.message : "Unexpected error",
      });
    }
  };

  const handlePermanentDeleteIntent = (item: CommitmentListItem) => {
    setRecycleCommitmentToDelete(item);
    setRecycleDeleteDialogOpen(true);
  };

  const handlePermanentDeleteConfirm = async () => {
    if (!recycleCommitmentToDelete) return;
    setIsPermanentlyDeleting(true);
    try {
      await apiFetch(
        `/api/commitments/${recycleCommitmentToDelete.id}/permanent-delete`,
        {
          method: "DELETE",
        },
      );
      toast.success(
        `"${recycleCommitmentToDelete.number}" permanently deleted`,
      );
      tableState.setSelectedIds((prev) =>
        prev.filter(
          (selectedId) => selectedId !== recycleCommitmentToDelete.id,
        ),
      );
      await refetch();
    } catch (err) {
      toast.error("Could not permanently delete commitment", {
        description: err instanceof Error ? err.message : "Unexpected error",
      });
    } finally {
      setIsPermanentlyDeleting(false);
      setRecycleDeleteDialogOpen(false);
      setRecycleCommitmentToDelete(null);
    }
  };

  const handleDeleteConfirm = async () => {
    if (!commitmentToDelete) return;

    setIsDeleting(true);
    try {
      await deleteCommitment.mutateAsync(commitmentToDelete.id);
    } catch (error) {
      reportNonCriticalFailure({
        area: "commitments",
        operation: "delete-commitment-confirm",
        error,
        userVisibleFallback:
          "Commitment deletion failed and the row remains visible.",
        metadata: { commitmentId: commitmentToDelete.id, projectId },
      });
    } finally {
      setIsDeleting(false);
      setDeleteDialogOpen(false);
      setCommitmentToDelete(null);
    }
  };

  const handleBulkDeleteConfirm = async () => {
    const ids = tableState.selectedIds;
    if (ids.length === 0) return;

    setIsBulkDeleting(true);
    try {
      const commitmentMap = new Map(commitments.map((item) => [item.id, item]));
      const failures: string[] = [];

      for (const id of ids) {
        try {
          await apiFetch(`/api/commitments/${id}`, {
            method: "DELETE",
          });
        } catch (err) {
          const item = commitmentMap.get(id);
          const label = item?.number || item?.title || id;
          failures.push(
            `${label}: ${err instanceof Error ? err.message : "Failed to delete commitment"}`,
          );
        }
      }

      const successCount = ids.length - failures.length;

      if (successCount > 0) {
        await refetch();
        tableState.setSelectedIds([]);
      }

      if (failures.length > 0) {
        toast.error(
          `${successCount} deleted, ${failures.length} failed.\n${failures.slice(0, 3).join("\n")}`,
        );
      } else {
        toast.success(
          `${successCount} commitment${successCount === 1 ? "" : "s"} deleted`,
        );
      }
    } finally {
      setIsBulkDeleting(false);
      setBulkDeleteDialogOpen(false);
    }
  };

  const handleExport = () => {
    setIsExportDialogOpen(true);
  };

  const handleCreateSubcontract = () => {
    router.push(`/${projectId}/commitments/new?type=subcontract`);
  };

  const handleCreatePurchaseOrder = () => {
    router.push(`/${projectId}/commitments/new?type=purchase_order`);
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      tableState.setSelectedIds(sortedCommitments.map((item) => item.id));
    } else {
      tableState.setSelectedIds([]);
    }
  };

  const handleSelectRow = (id: string, checked: boolean) => {
    if (checked) {
      // Guard against duplicate IDs (e.g. from event bubbling firing onCheckedChange twice).
      // A duplicate in selectedIds causes bulk-delete to attempt the same commitment twice:
      // the first DELETE succeeds and sets deleted_at; the second hits the ALREADY_DELETED guard
      // and returns 400, creating a false "failed" toast even though both rows are gone.
      tableState.setSelectedIds((prev) =>
        prev.includes(id) ? prev : [...prev, id],
      );
    } else {
      tableState.setSelectedIds((prev) =>
        prev.filter((itemId) => itemId !== id),
      );
    }
  };

  const isFiltered =
    Boolean(tableState.searchInput) ||
    Boolean(activeFilters.status) ||
    Boolean(activeFilters.type);

  return (
    <>
      <UnifiedTablePage
        header={{
          title: "Commitments",

          mobileActionsInline: true,
          actions: (
            <div className="flex items-center gap-1">
              <CommitmentsHelpSheet buttonVariant="ghost" />
              <PermissionGate
                projectId={projectId}
                module="contracts"
                level="write"
              >
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      size="sm"
                      className="max-sm:h-11 max-sm:w-11 max-sm:p-0"
                      aria-label="Create commitment"
                    >
                      <Plus />
                      <span className="max-sm:sr-only">Create</span>
                      <ChevronDown className="max-sm:hidden" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onSelect={handleCreateSubcontract}>
                      <FileSignature className="mr-2 h-4 w-4 text-muted-foreground" />
                      Subcontract
                    </DropdownMenuItem>
                    <DropdownMenuItem onSelect={handleCreatePurchaseOrder}>
                      <ShoppingCart className="mr-2 h-4 w-4 text-muted-foreground" />
                      Purchase Order
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </PermissionGate>
            </div>
          ),
        }}
        layout={{
          fullBleedTable: true,
          hideTableBody: isChangeOrdersTab,
          cardGridClassName:
            "grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5 md:gap-6",
        }}
        features={{
          // Click a cell to edit title / description / executed in place.
          // Disabled in the recycle bin (deleted rows are read-only).
          enableInlineEditing: !isRecycleBinTab,
        }}
        toolbar={{
          totalItems,
          filteredItems: totalItems,
          selectedCount: tableState.selectedIds.length,
          searchValue: tableState.searchInput,
          onSearchChange: tableState.setSearchInput,
          searchPlaceholder: "Search commitments...",
          currentView: tableState.currentView,
          onViewChange: (view) => {
            tableState.setCurrentView(view);
            tableState.setSearchParams({ view });
          },
          filters: commitmentFilters,
          activeFilters: toolbarActiveFilters,
          onFilterChange: handleFilterChange,
          onClearFilters: () => handleFilterChange(EMPTY_FILTERS),
          columns: commitmentColumns,
          visibleColumns: effectiveVisibleColumns,
          onColumnVisibilityChange: tableState.setVisibleColumns,
          onExport: handleExport,
          onBulkDelete:
            !isRecycleBinTab && tableState.selectedIds.length > 0
              ? () => setBulkDeleteDialogOpen(true)
              : undefined,
          customActions: (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant={isRecycleBinTab ? "secondary" : "ghost"}
                    size="icon"
                    className="h-8 w-8 shrink-0"
                    onClick={() =>
                      router.push(
                        isRecycleBinTab
                          ? `/${projectId}/commitments`
                          : `/${projectId}/commitments?tab=recycle-bin`,
                      )
                    }
                    aria-label="Recycle bin"
                  >
                    <Trash className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  {isRecycleBinTab ? "Exit recycle bin" : "Recycle bin"}
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          ),
        }}
        data={{
          items: isChangeOrdersTab ? [] : sortedCommitments,
          isLoading: isChangeOrdersTab ? false : isLoading,
          isFetching: isChangeOrdersTab ? false : isFetching,
          error: isChangeOrdersTab ? undefined : resolvedError,
        }}
        table={{
          columns: tableColumns,
          getRowId: (item) => item.id,
          onRowClick: isRecycleBinTab ? undefined : handleRowClick,
          rowActions: (item) =>
            isRecycleBinTab ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    aria-label="Row actions"
                  >
                    <MoreVertical />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem
                    onClick={() => void handleRestoreIntent(item)}
                  >
                    <RotateCcw className="mr-2 h-4 w-4" />
                    Restore
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    className="text-destructive"
                    onClick={() => handlePermanentDeleteIntent(item)}
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    Delete Forever
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              renderCommitmentRowActions(item, handleEdit, handleDeleteIntent)
            ),
          renderExpandedRow: (item, colSpan) => {
            if (isRecycleBinTab || !expandedIds.has(item.id)) return null;
            return (
              <CommitmentChangeOrdersRow
                commitmentId={item.id}
                colSpan={colSpan}
              />
            );
          },
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
          onSelectAll: handleSelectAll,
          onSelectRow: handleSelectRow,
        }}
        views={{
          card: (item) =>
            renderCommitmentCard(
              item,
              isRecycleBinTab ? () => undefined : handleRowClick,
            ),
          list: (item) =>
            renderCommitmentList(
              item,
              isRecycleBinTab ? () => undefined : handleRowClick,
            ),
        }}
        emptyState={{
          title: isRecycleBinTab
            ? "Recycle Bin is empty"
            : "No commitments found",
          description: isRecycleBinTab
            ? "Deleted commitments will appear here."
            : "You have not added any commitments yet.",
          filteredDescription: "Try adjusting your search or filters",
          isFiltered,
        }}
        footerTotals={{
          label: "Totals",
          values: {
            original_amount: (
              <span className="font-semibold">
                {formatCurrency(financialTotals.original_amount)}
              </span>
            ),
            approved_change_orders: (
              <span className="font-semibold">
                {formatCurrency(financialTotals.approved_change_orders)}
              </span>
            ),
            pending_change_orders: (
              <span className="font-semibold">
                {formatCurrency(financialTotals.pending_change_orders)}
              </span>
            ),
            draft_change_orders: (
              <span className="font-semibold">
                {formatCurrency(financialTotals.draft_change_orders)}
              </span>
            ),
            revised_contract_amount: (
              <span className="font-semibold">
                {formatCurrency(financialTotals.revised_contract_amount)}
              </span>
            ),
            invoiced_amount: (
              <span className="font-semibold">
                {formatCurrency(financialTotals.invoiced_amount)}
              </span>
            ),
            // Note: billed_to_date is intentionally omitted — there is no column with that ID
            // in commitmentColumns, so the value would be silently dropped by UnifiedTablePage.
            // The invoiced_amount column above covers the "Invoiced" total shown in the table.
            payments_issued: (
              <span className="font-semibold">
                {formatCurrency(financialTotals.payments_issued)}
              </span>
            ),
            remaining_balance: (
              <span className="font-semibold">
                {formatCurrency(financialTotals.remaining_balance)}
              </span>
            ),
          },
        }}
        pagination={
          isChangeOrdersTab
            ? undefined
            : {
                page: tableState.page,
                totalPages,
                perPage: tableState.perPage,
                onPageChange: (nextPage) => {
                  tableState.setPage(nextPage);
                  tableState.setSearchParams({ page: String(nextPage) });
                },
                onPerPageChange: (nextPerPage) => {
                  const parsed = Number(nextPerPage);
                  if (!Number.isFinite(parsed) || parsed <= 0) return;
                  tableState.setPerPage(parsed);
                  tableState.setSearchParams({
                    per_page: String(parsed),
                    page: "1",
                  });
                  tableState.setPage(1);
                },
              }
        }
        topContent={
          isChangeOrdersTab ? (
            <ProjectChangeOrdersTable
              changeOrders={projectChangeOrders}
              isLoading={isLoadingProjectCOs}
            />
          ) : undefined
        }
      />

      <DetailPanel
        open={Boolean(editId)}
        onOpenChange={(open) => {
          if (!open) {
            setEditId(null);
            setEditDetail(null);
          }
        }}
        item={panelItem}
        title={
          editDetail
            ? [editDetail.contract_number, editDetail.title]
                .filter(Boolean)
                .join(" — ") || "Commitment"
            : "Loading…"
        }
        fields={buildCommitmentDetailFields(
          editDetail?.type as string | undefined,
        )}
        onSave={handleDetailSave}
        onDelete={editDetail ? handleDetailDelete : undefined}
        onNavigate={navigateEdit}
        canNavigatePrev={editIndex > 0}
        canNavigateNext={
          editIndex >= 0 && editIndex < sortedCommitments.length - 1
        }
      />

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Commitment</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete commitment{" "}
              <strong>{commitmentToDelete?.number}</strong> -{" "}
              <strong>{commitmentToDelete?.title}</strong>?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? "Deleting..." : "Delete Commitment"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={bulkDeleteDialogOpen}
        onOpenChange={setBulkDeleteDialogOpen}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Delete {tableState.selectedIds.length} Commitment
              {tableState.selectedIds.length === 1 ? "" : "s"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete{" "}
              <strong>{tableState.selectedIds.length}</strong> selected
              commitment
              {tableState.selectedIds.length === 1 ? "" : "s"}?
              <br />
              <br />
              This action moves selected commitments to the recycle bin.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isBulkDeleting}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleBulkDeleteConfirm}
              disabled={isBulkDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isBulkDeleting
                ? "Deleting..."
                : `Delete ${tableState.selectedIds.length} Commitment${tableState.selectedIds.length === 1 ? "" : "s"}`}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={recycleDeleteDialogOpen}
        onOpenChange={setRecycleDeleteDialogOpen}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Permanently Delete Commitment</AlertDialogTitle>
            <AlertDialogDescription>
              Permanently delete{" "}
              <strong>{recycleCommitmentToDelete?.number}</strong>? This cannot
              be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isPermanentlyDeleting}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handlePermanentDeleteConfirm}
              disabled={isPermanentlyDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isPermanentlyDeleting ? "Deleting..." : "Delete Forever"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <ExportDialog
        open={isExportDialogOpen}
        onOpenChange={setIsExportDialogOpen}
        projectId={projectId}
        selectedCommitmentIds={tableState.selectedIds}
      />

    </>
  );
}
