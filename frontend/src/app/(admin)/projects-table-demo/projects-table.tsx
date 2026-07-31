"use client";

import * as React from "react";

import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination"
import { DataTablePagination } from "@/components/tables/DataTablePagination";

import {
  Column,
  ColumnDef,
  flexRender,
  getCoreRowModel,
  useReactTable,
  getSortedRowModel,
  SortingState,
  getPaginationRowModel,
  PaginationState,
  getFilteredRowModel,
  ColumnFiltersState,
} from "@tanstack/react-table";
import {
  ArrowRight,
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Pencil,
} from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Project } from "@/types/portfolio";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { EditableCell } from "../../../components/portfolio/editable-cell";
import { EditProjectDialog } from "../../../components/portfolio/edit-project-dialog";
import { toast } from "sonner";
import Link from "next/link";
import { apiFetch } from "@/lib/api-client";

// Canonical phase options — must match EditProjectDialog / DB phase values.
const PHASE_OPTIONS = [
  "Planning",
  "Estimating",
  "Current",
  "Complete",
  "Loss",
  "Archive",
];

interface ProjectsTableProps {
  data: Project[];
  onProjectClick?: (project: Project) => void;
  viewType?: "list" | "grid";
}

export function ProjectsTable({
  data,
  onProjectClick,
  viewType = "list",
}: ProjectsTableProps) {
  const formatCurrency = React.useCallback((value: number | null | undefined) => {
    if (typeof value !== "number" || !Number.isFinite(value)) {
      return "-";
    }

    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      maximumFractionDigits: 0,
    }).format(value);
  }, []);

  const [sorting, setSorting] = React.useState<SortingState>([]);
  const [pagination, setPagination] = React.useState<PaginationState>({
    pageIndex: 0,
    pageSize: viewType === "grid" ? 24 : 50,
  });
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>(
    [],
  );
  const [editingProject, setEditingProject] = React.useState<Project | null>(
    null,
  );
  const [isEditDialogOpen, setIsEditDialogOpen] = React.useState(false);

  // Update page size when view type changes
  React.useEffect(() => {
    setPagination((prev) => ({
      ...prev,
      pageIndex: 0,
      pageSize: viewType === "grid" ? 24 : 50,
    }));
  }, [viewType]);

  // Function to update project field
  // Maps camelCase field names to database column names (with spaces)
  const updateProject = async (
    projectId: string,
    field: string,
    value: string,
  ) => {
    try {
      // Map camelCase to database field names
      const fieldMap: Record<string, string> = {
        jobNumber: "job number",
        client: "client",
        startDate: "start date",
        state: "state",
        phase: "phase",
        category: "category",
        budget: "budget",
      };

      // Fields stored as numbers — send a number or null, never a string.
      const numericFields = new Set(["budget"]);

      const dbField = fieldMap[field] || field;
      const trimmed = value.trim();
      const dbValue: string | number | null = numericFields.has(field)
        ? trimmed === ""
          ? null
          : Number(trimmed.replace(/[$,]/g, ""))
        : value;

      await apiFetch(`/api/projects/${projectId}`, {
        method: "PATCH",
        body: JSON.stringify({ [dbField]: dbValue }),
      });

      toast.success(`Updated ${field}`);

      // Reload the page to show updated data
      window.location.reload();
    } catch (error) {
      toast.error(`Failed to update ${field}`);
      throw error;
    }
  };

  // Column order: name, job number, client, start date, state, phase, category
  const columns: ColumnDef<Project>[] = [
    {
      accessorKey: "name",
      meta: { sticky: true, left: 0 },
      header: ({ column }) => (
        <Button
          variant="ghost"
          className="flex items-center gap-1 hover:text-foreground h-auto p-0"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        >
          Name
          <ArrowUpDown className="w-3.5 h-3.5" />
        </Button>
      ),
      cell: ({ row }) => (
        <Button
          variant="ghost"
          onClick={(e) => {
            e.stopPropagation();
            onProjectClick?.(row.original);
          }}
          className="font-medium text-primary hover:text-primary/90 transition-colors duration-200 text-left group-hover:underline truncate max-w-[180px] h-auto p-0"
        >
          {row.getValue("name")}
        </Button>
      ),
      size: 180,
      minSize: 120,
      maxSize: 200,
    },
    {
      accessorKey: "jobNumber",
      header: ({ column }) => (
        <Button
          variant="ghost"
          className="flex items-center gap-1 hover:text-foreground h-auto p-0"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        >
          Job Number
          <ArrowUpDown className="w-3.5 h-3.5" />
        </Button>
      ),
      cell: ({ row }) => (
        <EditableCell
          value={row.getValue("jobNumber")}
          onSave={(value) => updateProject(row.original.id, "jobNumber", value)}
        />
      ),
      size: 130,
    },
    {
      accessorKey: "client",
      header: ({ column }) => (
        <Button
          variant="ghost"
          className="flex items-center gap-1 hover:text-foreground h-auto p-0"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        >
          Client
          <ArrowUpDown className="w-3.5 h-3.5" />
        </Button>
      ),
      cell: ({ row }) => (
        <EditableCell
          value={row.getValue("client")}
          onSave={(value) => updateProject(row.original.id, "client", value)}
        />
      ),
      size: 180,
    },
    {
      accessorKey: "budget",
      header: ({ column }) => (
        <Button
          variant="ghost"
          className="ml-auto flex h-auto items-center gap-1 p-0 text-right hover:text-foreground"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        >
          Budget
          <ArrowUpDown className="h-3.5 w-3.5" />
        </Button>
      ),
      cell: ({ row }) => (
        <EditableCell
          value={row.original.budget}
          type="number"
          className="text-right tabular-nums"
          formatDisplay={(value) =>
            formatCurrency(typeof value === "number" ? value : row.original.budget)
          }
          onSave={(value) => updateProject(row.original.id, "budget", value)}
        />
      ),
      size: 130,
    },
    {
      accessorKey: "startDate",
      header: ({ column }) => (
        <Button
          variant="ghost"
          className="flex items-center gap-1 hover:text-foreground h-auto p-0"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        >
          Start Date
          <ArrowUpDown className="w-3.5 h-3.5" />
        </Button>
      ),
      cell: ({ row }) => {
        const date = row.getValue("startDate") as string | null;
        const displayDate = date
          ? new Date(date).toISOString().split("T")[0]
          : "";
        return (
          <EditableCell
            value={displayDate}
            type="date"
            onSave={(value) =>
              updateProject(row.original.id, "startDate", value)
            }
          />
        );
      },
      size: 120,
    },
    {
      accessorKey: "state",
      header: ({ column }) => (
        <Button
          variant="ghost"
          className="flex items-center gap-1 hover:text-foreground h-auto p-0"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        >
          State
          <ArrowUpDown className="w-3.5 h-3.5" />
        </Button>
      ),
      cell: ({ row }) => (
        <EditableCell
          value={row.getValue("state")}
          onSave={(value) => updateProject(row.original.id, "state", value)}
        />
      ),
      size: 100,
    },
    {
      accessorKey: "phase",
      header: ({ column }) => (
        <Button
          variant="ghost"
          className="flex items-center gap-1 hover:text-foreground h-auto p-0"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        >
          Phase
          <ArrowUpDown className="w-3.5 h-3.5" />
        </Button>
      ),
      // Case-insensitive filter
      filterFn: (row, id, value) => {
        const cellValue = row.getValue(id) as string;
        return cellValue?.toLowerCase().includes(value.toLowerCase());
      },
      cell: ({ row }) => (
        <EditableCell
          value={row.getValue("phase")}
          type="select"
          placeholder="Select phase"
          options={PHASE_OPTIONS.map((value) => ({ value, label: value }))}
          onSave={(value) => updateProject(row.original.id, "phase", value)}
        />
      ),
      size: 120,
    },
    {
      accessorKey: "category",
      header: ({ column }) => (
        <Button
          variant="ghost"
          className="flex items-center gap-1 hover:text-foreground h-auto p-0"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        >
          Category
          <ArrowUpDown className="w-3.5 h-3.5" />
        </Button>
      ),
      cell: ({ row }) => (
        <EditableCell
          value={row.getValue("category")}
          onSave={(value) => updateProject(row.original.id, "category", value)}
        />
      ),
      size: 150,
    },
    {
      accessorKey: "onedrive",
      header: () => <span>OneDrive</span>,
      cell: ({ row }) => {
        const url = row.getValue("onedrive") as string | null;
        if (!url) return <span className="text-muted-foreground">-</span>;
        return (
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="inline-flex items-center justify-center p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            aria-label="Open OneDrive folder"
            title="Open OneDrive folder"
          >
            <ArrowRight className="w-4 h-4" />
          </a>
        );
      },
      size: 80,
    },
    {
      id: "actions",
      header: () => <span className="sr-only">Actions</span>,
      cell: ({ row }) => (
        <Button
          variant="ghost"
          size="icon"
          onClick={(e) => {
            e.stopPropagation();
            setEditingProject(row.original);
            setIsEditDialogOpen(true);
          }}
          className="p-2 hover:bg-muted rounded-md transition-colors duration-200 hover:scale-105"
          aria-label="Edit project"
        >
          <Pencil className="w-4 h-4 text-foreground" />
        </Button>
      ),
      size: 60,
    },
  ];

  const table = useReactTable({
    data,
    columns,
    state: {
      sorting,
      pagination,
      columnFilters,
    },
    onSortingChange: setSorting,
    onPaginationChange: setPagination,
    onColumnFiltersChange: setColumnFilters,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
  });

  const getStickyStyles = (
    column: Column<Project, unknown>,
    fallbackBg: string,
  ) => {
    const meta =
      (column.columnDef.meta as { sticky?: boolean; left?: number }) || {};
    if (!meta.sticky) {
      return {};
    }
    return {
      position: "sticky",
      left: meta.left ?? 0,
      zIndex: 5,
      backgroundColor: fallbackBg,
    } as React.CSSProperties;
  };

  // Grid view rendering
  if (viewType === "grid") {
    return (
      <div className="flex flex-col h-full">
        <div className="flex-1 overflow-y-auto p-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-6">
            {table.getRowModel().rows?.length ? (
              table.getRowModel().rows.map((row) => {
                const project = row.original;
                const projectHref = `/${project.id}/home`;
                return (
                  <div
                    key={row.id}
                    className="group relative bg-card rounded-lg p-4 hover:-translate-y-1 transition-all duration-300"
                  >
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={(e) => {
                        e.stopPropagation();
                        setEditingProject(project);
                        setIsEditDialogOpen(true);
                      }}
                      className="absolute top-3 right-3 p-1.5 h-auto w-auto rounded-md opacity-0 group-hover:opacity-100 hover:bg-muted transition-all duration-200"
                      aria-label={`Edit ${project.name}`}
                    >
                      <Pencil className="w-3.5 h-3.5 text-muted-foreground" />
                    </Button>
                    <Link
                      href={projectHref}
                      className="block text-left"
                      onClick={() => onProjectClick?.(project)}
                    >
                      <div className="mb-4 flex items-start justify-between gap-4 pr-6">
                        <h3 className="text-base font-semibold text-foreground transition-colors duration-300 line-clamp-2 leading-tight">
                          {project.name}
                        </h3>
                        {project.phase && (
                          <span className="text-xs text-muted-foreground font-medium whitespace-nowrap">
                            {project.phase}
                          </span>
                        )}
                      </div>

                      <div className="space-y-2">
                        <div className="text-xs text-muted-foreground font-medium">
                          Job #{project.jobNumber}
                        </div>

                        {project.client && (
                          <div className="text-sm text-foreground/80 truncate">
                            {project.client}
                          </div>
                        )}

                        <div className="text-sm font-medium tabular-nums text-foreground">
                          {formatCurrency(project.budget)}
                        </div>
                      </div>
                    </Link>
                  </div>
                );
              })
            ) : (
              <div className="col-span-full flex flex-col items-center justify-center py-16">
                <div className="w-16 h-16 rounded-full flex items-center justify-center mb-4">
                  <svg className="w-8 h-8 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012 2v2M7 7h10" />
                  </svg>
                </div>
                <h3 className="text-lg font-semibold text-foreground mb-2">No projects found</h3>
                <p className="text-sm text-muted-foreground text-center max-w-sm">
                  Start by creating your first project or adjust your filters to see more results.
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Pagination Controls for Grid View */}
        <div className="flex flex-col sm:flex-row items-center justify-between px-6 py-4 bg-background border-t border-border gap-4">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span className="hidden sm:inline">Showing</span>
            <select
              value={pagination.pageSize}
              onChange={(e) => {
                table.setPageSize(Number(e.target.value));
              }}
              aria-label="Items per page"
              className="px-4 py-1.5 text-sm border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent bg-background"
            >
              {[12, 24, 48, 96].map((pageSize) => (
                <option key={pageSize} value={pageSize}>
                  {pageSize}
                </option>
              ))}
            </select>
            <span className="text-sm text-muted-foreground whitespace-nowrap">
              <span className="hidden sm:inline">of </span>
              <span className="sm:hidden">/ </span>
              {data.length}
              <span className="hidden sm:inline"> projects</span>
            </span>
          </div>

          <div className="flex items-center gap-1 sm:gap-2">
            <Button
              variant="ghost"
              size="icon"
              aria-label="Go to first page"
              className="p-2 rounded-md hover:bg-muted transition-colors duration-200"
              onClick={() => table.setPageIndex(0)}
              disabled={!table.getCanPreviousPage()}
            >
              <ChevronsLeft className="w-4 h-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              aria-label="Go to previous page"
              className="p-1 rounded-md hover:bg-muted"
              onClick={() => table.previousPage()}
              disabled={!table.getCanPreviousPage()}
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </Button>
            <span className="text-sm text-foreground px-4 py-1">
              {table.getState().pagination.pageIndex + 1} of{" "}
              {table.getPageCount()}
            </span>
            <Button
              variant="ghost"
              size="icon"
              aria-label="Go to next page"
              className="p-1 rounded-md hover:bg-muted"
              onClick={() => table.nextPage()}
              disabled={!table.getCanNextPage()}
            >
              <ChevronRight className="w-3.5 h-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              aria-label="Go to last page"
              className="p-1 rounded-md hover:bg-muted"
              onClick={() => table.setPageIndex(table.getPageCount() - 1)}
              disabled={!table.getCanNextPage()}
            >
              <ChevronsRight className="w-3.5 h-3.5" />
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // List/Table view rendering (default)
  return (
    <div className="flex flex-col h-full">
      {/* Mobile Card View - shown only on small screens */}
      <div className="flex-1 overflow-y-auto md:hidden">
        <div className="divide-y divide-border">
          {table.getRowModel().rows?.length ? (
            table.getRowModel().rows.map((row) => {
              const project = row.original;
              const phaseColors: Record<string, string> = {
                current: "bg-blue-50 text-blue-700",
                bid: "bg-purple-50 text-purple-700",
                preconstruction: "bg-amber-50 text-amber-700",
                complete: "bg-green-50 text-green-700",
              };
              return (
                <div
                  key={row.id}
                  role="button"
                  tabIndex={0}
                  className="w-full p-4 hover:bg-muted/50 transition-colors text-left"
                  onClick={() => onProjectClick?.(project)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      onProjectClick?.(project);
                    }
                  }}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <h3 className="font-medium text-sm text-primary truncate">
                        {project.name}
                      </h3>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Job #{project.jobNumber}
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={(e) => {
                        e.stopPropagation();
                        setEditingProject(project);
                        setIsEditDialogOpen(true);
                      }}
                      className="p-1.5 h-auto w-auto hover:bg-muted rounded-md transition-colors shrink-0"
                      aria-label="Edit project"
                    >
                      <Pencil className="w-3.5 h-3.5 text-muted-foreground" />
                    </Button>
                  </div>
                  <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                    {project.client && (
                      <span className="text-muted-foreground">{project.client}</span>
                    )}
                    {project.phase && (
                      <span
                        className={cn(
                          "px-2 py-0.5 rounded-full font-medium",
                          phaseColors[project.phase.toLowerCase()] || "text-foreground",
                        )}
                      >
                        {project.phase}
                      </span>
                    )}
                    {project.state && (
                      <span className="text-muted-foreground">{project.state}</span>
                    )}
                    <span className="font-medium tabular-nums text-foreground">
                      {formatCurrency(project.budget)}
                    </span>
                  </div>
                </div>
              );
            })
          ) : (
            <div className="flex flex-col items-center justify-center py-12 px-4">
              <div className="w-12 h-12 rounded-full flex items-center justify-center mb-4">
                <svg className="w-6 h-6 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                </svg>
              </div>
              <div className="text-sm font-medium text-foreground">No projects found</div>
              <div className="text-xs text-muted-foreground text-center mt-1">
                Create a project or adjust your filters
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Desktop Table View - hidden on small screens */}
      <div className="flex-1 overflow-x-auto overflow-y-auto hidden md:block">
        <Table>
          <TableHeader className="sticky top-0 z-10">
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow
                key={headerGroup.id}
                className="border-b border-border/60"
              >
                {headerGroup.headers.map((header) => (
                  <TableHead
                    key={header.id}
                    className="text-xs font-semibold text-foreground/90 py-4 px-4"
                    style={{
                      width: header.getSize(),
                      ...getStickyStyles(header.column, "hsl(var(--background))"),
                    }}
                  >
                    {header.isPlaceholder
                      ? null
                      : flexRender(
                          header.column.columnDef.header,
                          header.getContext(),
                        )}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows?.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow
                  key={row.id}
                  className="group border-b border-border hover:bg-muted/60 transition-all duration-200 cursor-pointer hover:shadow-sm"
                  onClick={() => onProjectClick?.(row.original)}
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell
                      key={cell.id}
                      className="py-4 px-4 text-sm transition-colors duration-200"
                      style={{
                        width: cell.column.getSize(),
                        ...getStickyStyles(cell.column, "hsl(var(--card))"),
                      }}
                    >
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext(),
                      )}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell
                  colSpan={columns.length}
                  className="h-32 text-center"
                >
                  <div className="flex flex-col items-center justify-center space-y-4 py-8">
                    <div className="w-12 h-12 rounded-full flex items-center justify-center">
                      <svg className="w-6 h-6 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                      </svg>
                    </div>
                    <div className="text-base font-medium text-foreground">No projects found</div>
                    <div className="text-sm text-muted-foreground">Start by creating your first project or adjusting your filters</div>
                  </div>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination Controls */}
      <DataTablePagination table={table} />


      {/* Edit Project Dialog */}
      {editingProject && (
        <EditProjectDialog
          project={editingProject}
          open={isEditDialogOpen}
          onOpenChange={setIsEditDialogOpen}
          onSuccess={() => {
            // Reload the page to show updated data
            window.location.reload();
          }}
        />
      )}
    </div>
  );
}
