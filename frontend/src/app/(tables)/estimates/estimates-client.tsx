"use client";

import * as React from "react";
import type { ReactElement } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { MoreVertical, Plus } from "lucide-react";
import { toast } from "sonner";
import { apiFetch } from "@/lib/api-client";
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
} from "../../(main)/[projectId]/estimates/estimates-table-utils";
import { GlobalProjectPickerDialog } from "@/components/domain/global-project-picker-dialog";

type EstimateWithProject = EstimateRow & {
  projects: { id: number; name: string | null } | null;
};

const GLOBAL_VISIBLE_COLUMNS = ["title", "project", ...DEFAULT_VISIBLE_COLUMNS];

interface EstimatesGlobalClientProps {
  estimates: EstimateWithProject[];
}

export function EstimatesGlobalClient({
  estimates,
}: EstimatesGlobalClientProps): ReactElement {
  const pathname = usePathname()!;
  const router = useRouter();
  const searchParams = useSearchParams()!;

  const tableState = useUnifiedTableState({
    entityKey: "global-estimates",
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
      visibleColumns: GLOBAL_VISIBLE_COLUMNS,
      filters: {
        status: searchParams.get("status") || undefined,
      },
    },
  });

  const [deleteDialogOpen, setDeleteDialogOpen] = React.useState(false);
  const [estimateToDelete, setEstimateToDelete] =
    React.useState<EstimateWithProject | null>(null);
  const [pickerOpen, setPickerOpen] = React.useState(false);

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
        const projectName = item.projects?.name ?? "";
        const base = getEstimateSearchableText(item);
        return (base + " " + projectName.toLowerCase()).includes(searchValue);
      }

      return true;
    });
  }, [tableState.activeFilters?.status, estimates, tableState.debouncedSearch]);

  const totalPages = Math.max(
    1,
    Math.ceil(filteredItems.length / tableState.perPage)
  );

  const handleDelete = async () => {
    if (!estimateToDelete) return;
    try {
      await apiFetch(
        `/api/projects/${estimateToDelete.project_id}/estimates/${estimateToDelete.estimate_id}`,
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

  const handleBulkDelete = async () => {
    const ids = tableState.selectedIds ?? [];
    if (ids.length === 0) return;

    const byId = new Map(
      estimates.map((e) => [String(e.estimate_id), e])
    );

    try {
      await Promise.all(
        ids.map((id) => {
          const estimate = byId.get(id);
          if (!estimate) return Promise.resolve();
          return apiFetch(
            `/api/projects/${estimate.project_id}/estimates/${estimate.estimate_id}`,
            { method: "DELETE" }
          );
        })
      );
      toast.success(`${ids.length} estimate${ids.length === 1 ? "" : "s"} deleted`);
      tableState.setSelectedIds([]);
      router.refresh();
    } catch {
      toast.error("Failed to delete selected estimates");
    }
  };

  const columns = React.useMemo(
    () => [
      {
        id: "title",
        label: "Title",
        defaultVisible: true,
        render: (item: EstimateWithProject) => (
          <span className="font-medium text-foreground">{item.title}</span>
        ),
        sortValue: (item: EstimateWithProject) => item.title,
      },
      {
        id: "project",
        label: "Project",
        defaultVisible: true,
        render: (item: EstimateWithProject) =>
          item.projects ? (
            <Link
              href={`/${item.project_id}/estimates`}
              className="text-primary hover:underline"
              onClick={(e) => e.stopPropagation()}
            >
              {item.projects.name ?? "—"}
            </Link>
          ) : (
            <span className="text-muted-foreground">—</span>
          ),
        sortValue: (item: EstimateWithProject) => item.projects?.name ?? "",
      },
      {
        id: "estimate_number",
        label: "Estimate #",
        defaultVisible: true,
        render: (item: EstimateWithProject) => (
          <span className="text-muted-foreground">
            {item.estimate_number || "—"}
          </span>
        ),
        sortValue: (item: EstimateWithProject) => item.estimate_number ?? "",
      },
      {
        id: "revision",
        label: "Rev",
        defaultVisible: true,
        render: (item: EstimateWithProject) => (
          <span className="text-muted-foreground">R{item.revision}</span>
        ),
        sortValue: (item: EstimateWithProject) => item.revision,
      },
      {
        id: "status",
        label: "Status",
        defaultVisible: true,
        render: (item: EstimateWithProject) => (
          <div className="flex items-center gap-2">
            <div
              className={`h-2 w-2 rounded-full ${getStatusColor(item.status)}`}
            />
            <span className="text-sm">{getStatusLabel(item.status)}</span>
          </div>
        ),
        sortValue: (item: EstimateWithProject) => item.status,
      },
      {
        id: "estimator",
        label: "Estimator",
        defaultVisible: true,
        render: (item: EstimateWithProject) => (
          <span className="text-muted-foreground">
            {item.estimator || "—"}
          </span>
        ),
        sortValue: (item: EstimateWithProject) => item.estimator ?? "",
      },
      {
        id: "estimate_date",
        label: "Date",
        defaultVisible: true,
        render: (item: EstimateWithProject) => (
          <span className="text-muted-foreground">
            {formatDate(item.estimate_date)}
          </span>
        ),
        sortValue: (item: EstimateWithProject) => item.estimate_date ?? "",
      },
      {
        id: "location",
        label: "Location",
        defaultVisible: false,
        render: (item: EstimateWithProject) => (
          <span className="text-muted-foreground">
            {item.location || "—"}
          </span>
        ),
        sortValue: (item: EstimateWithProject) => item.location ?? "",
      },
      {
        id: "updated_at",
        label: "Last Updated",
        defaultVisible: true,
        render: (item: EstimateWithProject) => (
          <span className="text-muted-foreground">
            {formatDate(item.updated_at)}
          </span>
        ),
        sortValue: (item: EstimateWithProject) => item.updated_at,
      },
    ],
    []
  );

  return (
    <>
      <UnifiedTablePage
        header={{
          title: "Estimates",
          description: "All estimates across projects",
          actions: (
            <Button size="sm" onClick={() => setPickerOpen(true)}>
              <Plus />
              New Estimate
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
          getRowId: (item: EstimateWithProject) => String(item.estimate_id),
          onRowClick: (item: EstimateWithProject) =>
            router.push(`/${item.project_id}/estimates/${item.estimate_id}`),
          rowActions: (item: EstimateWithProject) => (
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
                      `/${item.project_id}/estimates/${item.estimate_id}`
                    );
                  }}
                >
                  View Details
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={(e) => {
                    e.stopPropagation();
                    router.push(
                      `/${item.project_id}/estimates/${item.estimate_id}/edit`
                    );
                  }}
                >
                  Edit
                </DropdownMenuItem>
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
          list: (item: EstimateWithProject) => (
            <div className="flex items-center justify-between p-4">
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium text-foreground">
                  {item.title}
                </p>
                <div className="mt-1 flex items-center gap-2 text-sm text-muted-foreground">
                  {item.projects?.name && (
                    <>
                      <span>{item.projects.name}</span>
                      <span>·</span>
                    </>
                  )}
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
          description: "Create an estimate to start building quantity takeoffs.",
          filteredDescription: "No estimates match your current filters.",
          isFiltered: filteredItems.length < estimates.length,
          action: (
            <Button size="sm" onClick={() => setPickerOpen(true)}>
              <Plus />
              New Estimate
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

      <GlobalProjectPickerDialog
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        toolPath="estimates"
        toolLabel="Estimate"
      />
    </>
  );
}
