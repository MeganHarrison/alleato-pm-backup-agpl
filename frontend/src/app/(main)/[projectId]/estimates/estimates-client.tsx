"use client";

import * as React from "react";
import type { ReactElement } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { MoreVertical, Plus } from "lucide-react";
import { toast } from "sonner";
import { apiFetch } from "@/lib/api-client";
import { SeedBudgetFromEstimateModal } from "@/components/domain/estimates/SeedBudgetFromEstimateModal";
import {
  UnifiedTablePage,
  useUnifiedTableState,
} from "@/components/tables/unified";
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
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { EstimateRow } from "@/lib/schemas/estimates";
import {
  DEFAULT_VISIBLE_COLUMNS,
  ESTIMATE_FILTERS,
  formatDate,
  getEstimateSearchableText,
  getStatusColor,
  getStatusLabel,
} from "./estimates-table-utils";

interface EstimatesClientProps {
  projectId: string;
  projectName: string;
  estimates: EstimateRow[];
}

export function EstimatesClient({
  projectId,
  estimates,
}: EstimatesClientProps): ReactElement {
  const pathname = usePathname()!;
  const router = useRouter();
  const searchParams = useSearchParams()!;

  const tableState = useUnifiedTableState({
    entityKey: "estimates",
    searchParams,
    pathname,
    router,
    defaults: {
      view: "table",
      allowedViews: ["table", "list"],
      page: 1,
      perPage: 25,
      search: "",
      sortBy: "updated_at",
      sortDirection: "desc",
      visibleColumns: DEFAULT_VISIBLE_COLUMNS,
      filters: {
        status: searchParams.get("status") || undefined,
      },
    },
  });

  const [deleteDialogOpen, setDeleteDialogOpen] = React.useState(false);
  const [estimateToDelete, setEstimateToDelete] =
    React.useState<EstimateRow | null>(null);
  const [bulkDeleteDialogOpen, setBulkDeleteDialogOpen] = React.useState(false);
  const [seedBudgetEstimate, setSeedBudgetEstimate] =
    React.useState<EstimateRow | null>(null);

  const filteredItems = React.useMemo(() => {
    const searchValue = tableState.debouncedSearch.trim().toLowerCase();
    const statusFilter =
      typeof tableState.activeFilters?.status === "string"
        ? (tableState.activeFilters.status as string).toLowerCase()
        : "";

    return estimates.filter((item) => {
      if (statusFilter && statusFilter !== "all" && item.status !== statusFilter)
        return false;

      if (searchValue) {
        return getEstimateSearchableText(item).includes(searchValue);
      }

      return true;
    });
  }, [tableState.activeFilters?.status, estimates, tableState.debouncedSearch]);

  const totalPages = Math.max(
    1,
    Math.ceil(filteredItems.length / tableState.perPage)
  );

  const [isCreating, setIsCreating] = React.useState(false);

  const handleCreateEstimate = async () => {
    setIsCreating(true);
    try {
      const today = new Date().toISOString().split("T")[0];
      const result = await apiFetch<{ estimate_id: number }>(
        `/api/projects/${projectId}/estimates`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: "New Estimate",
            revision: 1,
            status: "draft",
            estimate_date: today,
            insurance_rate: 0.0125,
            fee_rate: 0.1,
            contingency_amount: 0,
          }),
        }
      );
      router.push(`/${projectId}/estimates/${result.estimate_id}`);
    } catch (err) {
      toast.error("Failed to create estimate");
      setIsCreating(false);
    }
  };

  const handleDelete = async () => {
    if (!estimateToDelete) return;
    try {
      await apiFetch(
        `/api/projects/${projectId}/estimates/${estimateToDelete.estimate_id}`,
        { method: "DELETE" }
      );
      toast.success("Estimate deleted");
      router.refresh();
    } catch {
      toast.error("Failed to delete estimate");
    } finally {
      setDeleteDialogOpen(false);
      setEstimateToDelete(null);
    }
  };

  const handleBulkDelete = () => {
    if ((tableState.selectedIds?.length ?? 0) === 0) return;
    setBulkDeleteDialogOpen(true);
  };

  const executeBulkDelete = async () => {
    const ids = tableState.selectedIds ?? [];
    setBulkDeleteDialogOpen(false);
    if (ids.length === 0) return;

    const results = await Promise.allSettled(
      ids.map((id) =>
        apiFetch(`/api/projects/${projectId}/estimates/${id}`, {
          method: "DELETE",
        })
      )
    );

    const succeeded = results.filter((r) => r.status === "fulfilled").length;
    const failed = results.filter((r) => r.status === "rejected").length;

    if (failed === 0) {
      toast.success(
        `${succeeded} estimate${succeeded === 1 ? "" : "s"} deleted`
      );
    } else if (succeeded === 0) {
      toast.error("Failed to delete selected estimates");
    } else {
      toast.warning(
        `${succeeded} estimate${succeeded === 1 ? "" : "s"} deleted, ${failed} failed`
      );
    }

    tableState.setSelectedIds([]);
    router.refresh();
  };

  const columns = React.useMemo(
    () => [
      {
        id: "title",
        label: "Title",
        defaultVisible: true,
        render: (item: EstimateRow) => (
          <span className="font-medium text-foreground">{item.title}</span>
        ),
        sortValue: (item: EstimateRow) => item.title,
      },
      {
        id: "estimate_number",
        label: "Estimate #",
        defaultVisible: true,
        render: (item: EstimateRow) => (
          <span className="text-muted-foreground">
            {item.estimate_number || "—"}
          </span>
        ),
        sortValue: (item: EstimateRow) => item.estimate_number ?? "",
      },
      {
        id: "revision",
        label: "Rev",
        defaultVisible: true,
        render: (item: EstimateRow) => (
          <span className="text-muted-foreground">R{item.revision}</span>
        ),
        sortValue: (item: EstimateRow) => item.revision,
      },
      {
        id: "status",
        label: "Status",
        defaultVisible: true,
        render: (item: EstimateRow) => (
          <div className="flex items-center gap-2">
            <div
              className={`h-2 w-2 rounded-full ${getStatusColor(item.status)}`}
            />
            <span className="text-sm">{getStatusLabel(item.status)}</span>
          </div>
        ),
        sortValue: (item: EstimateRow) => item.status,
      },
      {
        id: "estimator",
        label: "Estimator",
        defaultVisible: true,
        render: (item: EstimateRow) => (
          <span className="text-muted-foreground">
            {item.estimator || "—"}
          </span>
        ),
        sortValue: (item: EstimateRow) => item.estimator ?? "",
      },
      {
        id: "estimate_date",
        label: "Date",
        defaultVisible: true,
        render: (item: EstimateRow) => (
          <span className="text-muted-foreground">
            {formatDate(item.estimate_date)}
          </span>
        ),
        sortValue: (item: EstimateRow) => item.estimate_date ?? "",
      },
      {
        id: "location",
        label: "Location",
        defaultVisible: false,
        render: (item: EstimateRow) => (
          <span className="text-muted-foreground">
            {item.location || "—"}
          </span>
        ),
        sortValue: (item: EstimateRow) => item.location ?? "",
      },
      {
        id: "updated_at",
        label: "Last Updated",
        defaultVisible: true,
        render: (item: EstimateRow) => (
          <span className="text-muted-foreground">
            {formatDate(item.updated_at)}
          </span>
        ),
        sortValue: (item: EstimateRow) => item.updated_at,
      },
    ],
    []
  );

  return (
    <>
      <UnifiedTablePage
        header={{
          title: "Estimates",
          description: "Manage project estimates and quantity takeoffs",
          actions: (
            <Button
              size="sm"
              onClick={() => void handleCreateEstimate()}
              disabled={isCreating}
            >
              <Plus />
              {isCreating ? "Creating..." : "New Estimate"}
            </Button>
          ),
        }}
        toolbar={{
          totalItems: estimates.length,
          filteredItems: filteredItems.length,
          selectedCount: tableState.selectedIds?.length ?? 0,
          onBulkDelete: handleBulkDelete,
          searchValue: tableState.searchInput,
          onSearchChange: tableState.setSearchInput,
          searchPlaceholder: "Search estimates...",
          currentView: tableState.currentView,
          onViewChange: tableState.setCurrentView,
          enabledViews: ["table", "list"],
          filters: ESTIMATE_FILTERS,
          activeFilters: tableState.activeFilters,
          onFilterChange: tableState.setActiveFilters,
          columns,
          visibleColumns: tableState.visibleColumns,
          onColumnVisibilityChange: tableState.setVisibleColumns,
        }}
        data={{
          items: filteredItems,
          isLoading: false,
        }}
        table={{
          columns,
          getRowId: (item: EstimateRow) => String(item.estimate_id),
          onRowClick: (item: EstimateRow) =>
            router.push(
              `/${projectId}/estimates/${item.estimate_id}`
            ),
          rowActions: (item: EstimateRow) => (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8">
                  <MoreVertical />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem
                  onClick={(e) => {
                    e.stopPropagation();
                    router.push(
                      `/${projectId}/estimates/${item.estimate_id}`
                    );
                  }}
                >
                  View Details
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={(e) => {
                    e.stopPropagation();
                    router.push(
                      `/${projectId}/estimates/${item.estimate_id}/edit`
                    );
                  }}
                >
                  Edit
                </DropdownMenuItem>
                {item.status === "approved" && (
                  <DropdownMenuItem
                    onClick={(e) => {
                      e.stopPropagation();
                      setSeedBudgetEstimate(item);
                    }}
                  >
                    Seed Budget
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem
                  className="text-destructive"
                  onClick={(e) => {
                    e.stopPropagation();
                    setEstimateToDelete(item);
                    setDeleteDialogOpen(true);
                  }}
                >
                  Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ),
        }}
        views={{
          list: (item: EstimateRow) => (
            <div className="flex items-center justify-between p-4">
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium text-foreground">
                  {item.title}
                </p>
                <div className="mt-1 flex items-center gap-2 text-sm text-muted-foreground">
                  <span>{item.estimator || "No estimator"}</span>
                  <span>·</span>
                  <span>R{item.revision}</span>
                  <span>·</span>
                  <span>{formatDate(item.estimate_date)}</span>
                </div>
              </div>
              <div className="ml-4 flex items-center gap-2">
                <Badge variant="outline">{getStatusLabel(item.status)}</Badge>
              </div>
            </div>
          ),
        }}
        sorting={{
          sortBy: tableState.sortBy ?? "updated_at",
          sortDirection: tableState.sortDirection ?? "desc",
          onSortChange: (sortBy: string, direction: "asc" | "desc") => {
            tableState.setSortBy(sortBy);
            tableState.setSortDirection(direction);
          },
        }}
        selection={{
          selectedIds: tableState.selectedIds ?? [],
          onSelectAll: (checked: boolean) => {
            if (checked) {
              tableState.setSelectedIds(
                filteredItems.map((item) => String(item.estimate_id))
              );
            } else {
              tableState.setSelectedIds([]);
            }
          },
          onSelectRow: (id: string, checked: boolean) => {
            tableState.setSelectedIds((prev) =>
              checked ? [...prev, id] : prev.filter((i) => i !== id)
            );
          },
        }}
        emptyState={{
          title: "No estimates yet",
          description:
            "Create your first estimate to start building quantity takeoffs for this project.",
          filteredDescription: "No estimates match your current filters.",
          isFiltered: filteredItems.length < estimates.length,
          action: (
            <Button
              size="sm"
              onClick={() => void handleCreateEstimate()}
              disabled={isCreating}
            >
              <Plus />
              {isCreating ? "Creating..." : "New Estimate"}
            </Button>
          ),
        }}
        pagination={{
          page: tableState.page,
          totalPages,
          perPage: tableState.perPage,
          onPageChange: tableState.setPage,
          onPerPageChange: (val: string) => tableState.setPerPage(Number(val)),
          clientSide: true,
        }}
      />

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Estimate</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete &quot;{estimateToDelete?.title}
              &quot;? This action can be undone by an administrator.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={bulkDeleteDialogOpen} onOpenChange={setBulkDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Estimates</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete{" "}
              {tableState.selectedIds?.length ?? 0} estimate
              {(tableState.selectedIds?.length ?? 0) === 1 ? "" : "s"}? This
              action can be undone by an administrator.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => void executeBulkDelete()}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <SeedBudgetFromEstimateModal
        open={seedBudgetEstimate != null}
        onOpenChange={(open) => {
          if (!open) setSeedBudgetEstimate(null);
        }}
        projectId={projectId}
        estimateId={seedBudgetEstimate?.estimate_id ?? 0}
        estimateTitle={seedBudgetEstimate?.title}
      />
    </>
  );
}
