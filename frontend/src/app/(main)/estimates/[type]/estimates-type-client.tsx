"use client";

import * as React from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { MoreVertical, Plus, ChevronLeft } from "lucide-react";
import { toast } from "sonner";
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
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  EstimateTypeLabels,
  type EstimateType,
  type CompanyEstimateRow,
} from "@/lib/schemas/estimates";

interface Props {
  estimateType: EstimateType;
  typeSlug: string;
  estimates: CompanyEstimateRow[];
}

function formatDate(value: string | null | undefined): string {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function getStatusColor(status: string | null): string {
  switch (status) {
    case "approved": return "bg-success";
    case "pending_review": return "bg-warning";
    case "rejected": return "bg-destructive";
    default: return "bg-muted-foreground";
  }
}

function getStatusLabel(status: string | null): string {
  switch (status) {
    case "approved": return "Approved";
    case "pending_review": return "Pending Review";
    case "rejected": return "Rejected";
    default: return "Draft";
  }
}

import type { FilterConfig } from "@/components/tables/unified";

const STATUS_FILTERS: FilterConfig[] = [
  {
    id: "status",
    label: "Status",
    type: "select",
    options: [
      { value: "all", label: "All Statuses" },
      { value: "draft", label: "Draft" },
      { value: "pending_review", label: "Pending Review" },
      { value: "approved", label: "Approved" },
      { value: "rejected", label: "Rejected" },
    ],
  },
];

export function EstimatesTypeClient({ estimateType, typeSlug, estimates }: Props) {
  const pathname = usePathname()!;
  const router = useRouter();
  const searchParams = useSearchParams()!;

  const typeLabel = EstimateTypeLabels[estimateType];

  const tableState = useUnifiedTableState({
    entityKey: `estimates-${estimateType}`,
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
      visibleColumns: [
        "title",
        "project",
        "estimate_number",
        "revision",
        "status",
        "estimator",
        "estimate_date",
        "updated_at",
      ],
      filters: {
        status: searchParams.get("status") || undefined,
      },
    },
  });

  const [deleteDialogOpen, setDeleteDialogOpen] = React.useState(false);
  const [estimateToDelete, setEstimateToDelete] =
    React.useState<CompanyEstimateRow | null>(null);

  const filteredItems = React.useMemo(() => {
    const searchValue = tableState.debouncedSearch.trim().toLowerCase();
    const statusFilter =
      typeof tableState.activeFilters?.status === "string"
        ? (tableState.activeFilters.status as string).toLowerCase()
        : "";

    return estimates.filter((item) => {
      if (
        statusFilter &&
        statusFilter !== "all" &&
        item.status !== statusFilter
      )
        return false;

      if (searchValue) {
        const text = [
          item.title,
          item.estimate_number,
          item.estimator,
          item.location,
          item.project_name,
          item.project_number,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        return text.includes(searchValue);
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
      const response = await fetch(
        `/api/projects/${estimateToDelete.project_id}/estimates/${estimateToDelete.estimate_id}`,
        { method: "DELETE" }
      );
      if (!response.ok) throw new Error("Failed to delete estimate");
      toast.success("Estimate deleted");
      router.refresh();
    } catch {
      toast.error("Failed to delete estimate");
    } finally {
      setDeleteDialogOpen(false);
      setEstimateToDelete(null);
    }
  };

  const columns = React.useMemo(
    () => [
      {
        id: "title",
        label: "Title",
        defaultVisible: true,
        render: (item: CompanyEstimateRow) => (
          <span className="font-medium text-foreground">{item.title}</span>
        ),
        sortValue: (item: CompanyEstimateRow) => item.title,
      },
      {
        id: "project",
        label: "Project",
        defaultVisible: true,
        render: (item: CompanyEstimateRow) => (
          <Button
            variant="link"
            className="text-sm text-primary hover:underline h-auto p-0"
            onClick={(e) => {
              e.stopPropagation();
              router.push(`/${item.project_id}/estimates`);
            }}
          >
            {item.project_name || "—"}
          </Button>
        ),
        sortValue: (item: CompanyEstimateRow) => item.project_name ?? "",
      },
      {
        id: "estimate_number",
        label: "Estimate #",
        defaultVisible: true,
        render: (item: CompanyEstimateRow) => (
          <span className="text-muted-foreground">
            {item.estimate_number || "—"}
          </span>
        ),
        sortValue: (item: CompanyEstimateRow) => item.estimate_number ?? "",
      },
      {
        id: "revision",
        label: "Rev",
        defaultVisible: true,
        render: (item: CompanyEstimateRow) => (
          <span className="text-muted-foreground">R{item.revision}</span>
        ),
        sortValue: (item: CompanyEstimateRow) => item.revision,
      },
      {
        id: "status",
        label: "Status",
        defaultVisible: true,
        render: (item: CompanyEstimateRow) => (
          <div className="flex items-center gap-2">
            <div
              className={`h-2 w-2 rounded-full ${getStatusColor(item.status)}`}
            />
            <span className="text-sm">{getStatusLabel(item.status)}</span>
          </div>
        ),
        sortValue: (item: CompanyEstimateRow) => item.status,
      },
      {
        id: "estimator",
        label: "Estimator",
        defaultVisible: true,
        render: (item: CompanyEstimateRow) => (
          <span className="text-muted-foreground">
            {item.estimator || "—"}
          </span>
        ),
        sortValue: (item: CompanyEstimateRow) => item.estimator ?? "",
      },
      {
        id: "estimate_date",
        label: "Date",
        defaultVisible: true,
        render: (item: CompanyEstimateRow) => (
          <span className="text-muted-foreground">
            {formatDate(item.estimate_date)}
          </span>
        ),
        sortValue: (item: CompanyEstimateRow) => item.estimate_date ?? "",
      },
      {
        id: "updated_at",
        label: "Last Updated",
        defaultVisible: true,
        render: (item: CompanyEstimateRow) => (
          <span className="text-muted-foreground">
            {formatDate(item.updated_at)}
          </span>
        ),
        sortValue: (item: CompanyEstimateRow) => item.updated_at,
      },
    ],
    [router]
  );

  return (
    <>
      <UnifiedTablePage
        header={{
          title: typeLabel,
          description: `All ${typeLabel} estimates across all projects`,
          actions: (
            <Button variant="outline" size="sm" onClick={() => router.push("/estimates")}>
              <ChevronLeft />
              All Types
            </Button>
          ),
        }}
        toolbar={{
          totalItems: estimates.length,
          filteredItems: filteredItems.length,
          selectedCount: tableState.selectedIds?.length ?? 0,
          searchValue: tableState.searchInput,
          onSearchChange: tableState.setSearchInput,
          searchPlaceholder: `Search ${typeLabel} estimates...`,
          currentView: tableState.currentView,
          onViewChange: tableState.setCurrentView,
          enabledViews: ["table", "list"],
          filters: STATUS_FILTERS,
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
          getRowId: (item: CompanyEstimateRow) => String(item.estimate_id),
          onRowClick: (item: CompanyEstimateRow) =>
            router.push(
              `/${item.project_id}/estimates/${item.estimate_id}`
            ),
          rowActions: (item: CompanyEstimateRow) => (
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
                    router.push(`/${item.project_id}/estimates`);
                  }}
                >
                  Go to Project
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
          list: (item: CompanyEstimateRow) => (
            <div className="flex items-center justify-between p-4">
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium text-foreground">
                  {item.title}
                </p>
                <div className="mt-1 flex items-center gap-2 text-sm text-muted-foreground">
                  <span>{item.project_name || "No project"}</span>
                  <span>·</span>
                  <span>{item.estimator || "No estimator"}</span>
                  <span>·</span>
                  <span>R{item.revision}</span>
                </div>
              </div>
              <div className="ml-4 flex items-center gap-2">
                <div
                  className={`h-2 w-2 rounded-full ${getStatusColor(item.status)}`}
                />
                <span className="text-sm text-muted-foreground">
                  {getStatusLabel(item.status)}
                </span>
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
          title: `No ${typeLabel} estimates yet`,
          description: `Estimates tagged as "${typeLabel}" will appear here once created on a project.`,
          filteredDescription: "No estimates match your current filters.",
          isFiltered: filteredItems.length < estimates.length,
        }}
        pagination={{
          page: tableState.page,
          totalPages,
          perPage: tableState.perPage,
          onPageChange: tableState.setPage,
          onPerPageChange: (val: string) =>
            tableState.setPerPage(Number(val)),
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
    </>
  );
}
