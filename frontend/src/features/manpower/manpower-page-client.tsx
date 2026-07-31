"use client";

import * as React from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { AlertTriangle, Download, Loader2, Upload } from "lucide-react";

import {
  Badge,
  Button,
  EmptyState,
  ErrorState,
  InfoAlert,
} from "@/components/ds";
import {
  InlineSelectEditor,
  UnifiedTablePage,
  useUnifiedTableState,
  type FilterConfig,
  type TableColumn,
  type ViewMode,
} from "@/components/tables/unified";
import { apiFetch } from "@/lib/api-client";
import { cn } from "@/lib/utils";

import { daysUntilAssignmentStart, isAssignmentActive } from "./parser";
import { SAMPLE_MANPOWER_CSV } from "./sample-data";
import type {
  ManpowerAssignment,
  ManpowerAssignmentStatus,
  ManpowerPagePayload,
  ManpowerPersonOption,
  ManpowerProjectStage,
} from "./types";

type TimeFilter = "active" | "next_30" | "all";

type PeopleLoadRow = {
  id: string;
  assignee: string;
  totalAssignments: number;
  activeAssignments: number;
  projects: string[];
};

const TABLE_ONLY_VIEWS: ViewMode[] = ["table"];

const STATUS_VARIANTS: Record<ManpowerAssignmentStatus, string> = {
  filled: "bg-success/10 text-success",
  open: "bg-warning/10 text-warning",
  tbd: "bg-muted text-muted-foreground",
};

const STAGE_VARIANTS: Record<ManpowerProjectStage, string> = {
  active: "bg-success/10 text-success",
  upcoming: "bg-info/10 text-info",
  completed: "bg-muted text-muted-foreground",
  undated: "bg-muted text-muted-foreground",
};

const COVERAGE_OPTIONS: Array<{
  value: string;
  label: string;
  status: ManpowerAssignmentStatus;
  personId: string | null;
}> = [
  { value: "open", label: "New Hire", status: "open", personId: null },
  { value: "tbd", label: "TBD", status: "tbd", personId: null },
  { value: "unassigned", label: "Unassigned", status: "open", personId: null },
];

const ASSIGNMENT_FILTERS: FilterConfig[] = [
  {
    id: "timeWindow",
    label: "Time window",
    type: "select",
    options: [
      { value: "active", label: "Active now" },
      { value: "next_30", label: "Starting in 30 days" },
      { value: "all", label: "All dates" },
    ],
  },
  {
    id: "status",
    label: "Status",
    type: "select",
    options: [
      { value: "all", label: "All status" },
      { value: "filled", label: "Filled" },
      { value: "open", label: "Open" },
      { value: "tbd", label: "TBD" },
    ],
  },
];

function formatWindow(assignment: ManpowerAssignment): string {
  if (assignment.startLabel && assignment.finishLabel) {
    return `${assignment.startLabel} - ${assignment.finishLabel}`;
  }
  if (assignment.startLabel) return `Starts ${assignment.startLabel}`;
  if (assignment.finishLabel) return `Ends ${assignment.finishLabel}`;
  return "No dates";
}

function formatPlanImportedAt(value: string | null | undefined): string {
  if (!value) return "Import time unavailable";

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "Import time unavailable";

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(parsed);
}

function matchesTimeFilter(
  assignment: ManpowerAssignment,
  filter: TimeFilter,
  now: Date,
): boolean {
  if (filter === "all") return true;
  if (filter === "active") return isAssignmentActive(assignment, now);
  const daysUntilStart = daysUntilAssignmentStart(assignment, now);
  return daysUntilStart !== null && daysUntilStart >= 0 && daysUntilStart <= 30;
}

function getCoverageValue(assignment: ManpowerAssignment): string {
  if (assignment.assigneePersonId) return assignment.assigneePersonId;
  if (assignment.status === "tbd") return "tbd";
  if (assignment.assigneeName === "New Hire") return "open";
  return "unassigned";
}

function getStatusLabel(status: ManpowerAssignmentStatus): string {
  if (status === "filled") return "Filled";
  if (status === "open") return "Open";
  return "TBD";
}

function buildAssignmentSearchText(assignment: ManpowerAssignment): string {
  return [
    assignment.projectCode,
    assignment.projectName,
    assignment.role,
    assignment.assigneeName,
    assignment.notes,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

function buildRoleFilterOptions(roles: string[]): FilterConfig {
  return {
    id: "role",
    label: "Role",
    type: "select",
    options: [
      { value: "all", label: "All roles" },
      ...roles.map((role) => ({ value: role, label: role })),
    ],
  };
}

function buildAssigneeFilterOptions(assignees: string[]): FilterConfig {
  return {
    id: "assignee",
    label: "Assignee",
    type: "select",
    options: [
      { value: "all", label: "All assignees" },
      ...assignees.map((assignee) => ({ value: assignee, label: assignee })),
    ],
  };
}

export function ManpowerPageClient() {
  const fileInputRef = React.useRef<HTMLInputElement | null>(null);
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [payload, setPayload] = React.useState<ManpowerPagePayload | null>(null);
  const [loadError, setLoadError] = React.useState<string | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);
  const [isImporting, setIsImporting] = React.useState(false);
  const [rowUpdateId, setRowUpdateId] = React.useState<string | null>(null);
  const now = React.useMemo(() => new Date(), []);

  const tableState = useUnifiedTableState({
    entityKey: "manpower-assignments",
    pathname,
    router,
    searchParams,
    defaults: {
      view: "table",
      allowedViews: TABLE_ONLY_VIEWS,
      page: 1,
      perPage: 25,
      search: "",
      sortBy: "project",
      sortDirection: "asc",
      visibleColumns: ["project", "role", "coverage", "status", "window", "stage", "notes"],
      filters: {
        timeWindow: "active",
        status: "all",
        role: "all",
        assignee: "all",
      },
    },
  });

  const loadPayload = React.useCallback(async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const nextPayload = await apiFetch<ManpowerPagePayload>("/api/manpower");
      setPayload(nextPayload);
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : "Unable to load manpower plan.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void loadPayload();
  }, [loadPayload]);

  const handleImportSample = React.useCallback(async () => {
    setIsImporting(true);
    setLoadError(null);
    try {
      const nextPayload = await apiFetch<ManpowerPagePayload>("/api/manpower/import", {
        method: "POST",
        body: JSON.stringify({
          csvText: SAMPLE_MANPOWER_CSV,
          sourceLabel: "Alleato manpower sample",
        }),
      });
      setPayload(nextPayload);
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : "Unable to import sample manpower plan.");
    } finally {
      setIsImporting(false);
    }
  }, []);

  const handleFileUpload = React.useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsImporting(true);
    setLoadError(null);

    try {
      const formData = new FormData();
      formData.append("file", file);
      const nextPayload = await apiFetch<ManpowerPagePayload>("/api/manpower/import", {
        method: "POST",
        body: formData,
      });
      setPayload(nextPayload);
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : "Unable to import manpower CSV.");
    } finally {
      setIsImporting(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  }, []);

  const handleCoverageChange = React.useCallback(
    async (assignment: ManpowerAssignment, value: string) => {
      setRowUpdateId(assignment.id);
      setLoadError(null);

      try {
        const person = payload?.people.find((candidate) => candidate.id === value) ?? null;
        const preset = COVERAGE_OPTIONS.find((option) => option.value === value) ?? null;

        const nextPayload = await apiFetch<ManpowerPagePayload>(
          `/api/manpower/assignments/${assignment.id}`,
          {
            method: "PATCH",
            body: JSON.stringify({
              assigneePersonId: person?.id ?? preset?.personId ?? null,
              assigneeName: person?.name ?? preset?.label ?? null,
              status: person ? "filled" : preset?.status ?? "open",
              notes: assignment.notes,
            }),
          },
        );
        setPayload(nextPayload);
      } catch (error) {
        setLoadError(error instanceof Error ? error.message : "Unable to update manpower assignment.");
      } finally {
        setRowUpdateId(null);
      }
    },
    [payload?.people],
  );

  const plan = payload?.plan ?? null;
  const people = payload?.people ?? [];

  const assignmentActions = (
    <div className="flex items-center gap-2">
      <input
        ref={fileInputRef}
        type="file"
        accept=".csv,text/csv"
        className="hidden"
        onChange={handleFileUpload}
      />
      <Button type="button" variant="outline" onClick={handleImportSample} disabled={isImporting}>
        <Download className="mr-2 size-4" />
        Load sample
      </Button>
      <Button type="button" onClick={() => fileInputRef.current?.click()} disabled={isImporting}>
        {isImporting ? <Loader2 className="mr-2 size-4 animate-spin" /> : <Upload className="mr-2 size-4" />}
        Upload CSV
      </Button>
    </div>
  );

  const roles = React.useMemo(
    () => Array.from(new Set((plan?.assignments ?? []).map((assignment) => assignment.role))).sort(),
    [plan?.assignments],
  );

  const assignees = React.useMemo(
    () =>
      Array.from(
        new Set(
          (plan?.assignments ?? [])
            .map((assignment) => assignment.assigneeName)
            .filter((value): value is string => Boolean(value)),
        ),
      ).sort(),
    [plan?.assignments],
  );

  const assignmentFilters = React.useMemo(
    () => [...ASSIGNMENT_FILTERS, buildRoleFilterOptions(roles), buildAssigneeFilterOptions(assignees)],
    [assignees, roles],
  );

  const activeTimeFilter = (tableState.activeFilters.timeWindow as TimeFilter | undefined) ?? "active";
  const activeStatusFilter =
    (tableState.activeFilters.status as "all" | ManpowerAssignmentStatus | undefined) ?? "all";
  const activeRoleFilter = (tableState.activeFilters.role as string | undefined) ?? "all";
  const activeAssigneeFilter = (tableState.activeFilters.assignee as string | undefined) ?? "all";

  const filteredAssignments = React.useMemo(() => {
    const assignments = plan?.assignments ?? [];
    const term = tableState.debouncedSearch.trim().toLowerCase();

    return assignments.filter((assignment) => {
      if (activeStatusFilter !== "all" && assignment.status !== activeStatusFilter) return false;
      if (activeRoleFilter !== "all" && assignment.role !== activeRoleFilter) return false;
      if (activeAssigneeFilter !== "all" && (assignment.assigneeName ?? "Unassigned") !== activeAssigneeFilter) {
        return false;
      }
      if (!matchesTimeFilter(assignment, activeTimeFilter, now)) return false;
      if (!term) return true;
      return buildAssignmentSearchText(assignment).includes(term);
    });
  }, [
    activeAssigneeFilter,
    activeRoleFilter,
    activeStatusFilter,
    activeTimeFilter,
    now,
    plan?.assignments,
    tableState.debouncedSearch,
  ]);

  const openAssignments = React.useMemo(
    () => filteredAssignments.filter((assignment) => assignment.status !== "filled"),
    [filteredAssignments],
  );

  const peopleSummary = React.useMemo<PeopleLoadRow[]>(() => {
    const byPerson = new Map<string, PeopleLoadRow>();

    filteredAssignments.forEach((assignment) => {
      if (!assignment.assigneeName || assignment.status !== "filled") return;

      const current = byPerson.get(assignment.assigneeName) ?? {
        id: assignment.assigneeName,
        assignee: assignment.assigneeName,
        totalAssignments: 0,
        activeAssignments: 0,
        projects: [],
      };

      current.totalAssignments += 1;
      if (!current.projects.includes(assignment.projectName)) {
        current.projects.push(assignment.projectName);
      }
      if (isAssignmentActive(assignment, now)) {
        current.activeAssignments += 1;
      }

      byPerson.set(assignment.assigneeName, current);
    });

    return Array.from(byPerson.values()).sort((left, right) => {
      if (right.activeAssignments !== left.activeAssignments) {
        return right.activeAssignments - left.activeAssignments;
      }
      return right.totalAssignments - left.totalAssignments;
    });
  }, [filteredAssignments, now]);

  const assignmentColumns = React.useMemo<TableColumn<ManpowerAssignment>[]>(
    () => [
      {
        id: "project",
        label: "Project",
        alwaysVisible: true,
        sortable: true,
        sortValue: (assignment) => assignment.projectName,
        render: (assignment) => (
          <span className="block truncate font-medium text-foreground">
            {assignment.projectName}
          </span>
        ),
        csvValue: (assignment) => assignment.projectCode ?? assignment.projectName,
        width: 220,
      },
      {
        id: "role",
        label: "Role",
        defaultVisible: true,
        sortable: true,
        sortValue: (assignment) => assignment.role,
        render: (assignment) => assignment.role,
        csvValue: (assignment) => assignment.role,
        width: 180,
      },
      {
        id: "coverage",
        label: "Coverage",
        defaultVisible: true,
        sortable: true,
        sortValue: (assignment) => assignment.assigneeName ?? "",
        render: (assignment) =>
          rowUpdateId === assignment.id ? (
            <span className="inline-flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="size-3 animate-spin" />
              Saving coverage
            </span>
          ) : (
            <div className="min-w-40">
              <InlineSelectEditor
                value={getCoverageValue(assignment)}
                options={[
                  ...COVERAGE_OPTIONS.map((option) => ({
                    value: option.value,
                    label: option.label,
                  })),
                  ...people.map((person: ManpowerPersonOption) => ({
                    value: person.id,
                    label: person.name,
                  })),
                ]}
                placeholder="Choose coverage"
                onChange={() => undefined}
                onCommit={(value) => {
                  if (value) {
                    void handleCoverageChange(assignment, value);
                  }
                }}
              />
            </div>
          ),
        csvValue: (assignment) => assignment.assigneeName ?? "Unassigned",
        width: 220,
      },
      {
        id: "status",
        label: "Status",
        defaultVisible: true,
        sortable: true,
        sortValue: (assignment) => assignment.status,
        render: (assignment) => (
          <Badge className={cn("border-0", STATUS_VARIANTS[assignment.status])}>
            {rowUpdateId === assignment.id ? "Saving" : getStatusLabel(assignment.status)}
          </Badge>
        ),
        csvValue: (assignment) => getStatusLabel(assignment.status),
        width: 120,
      },
      {
        id: "window",
        label: "Window",
        defaultVisible: true,
        sortable: true,
        sortValue: (assignment) => assignment.startDate ?? assignment.finishDate ?? "",
        render: (assignment) => <span className="text-sm text-muted-foreground">{formatWindow(assignment)}</span>,
        csvValue: (assignment) => formatWindow(assignment),
        width: 170,
      },
      {
        id: "stage",
        label: "Project stage",
        defaultVisible: true,
        sortable: true,
        sortValue: (assignment) =>
          plan?.projects.find((project) => project.id === assignment.manpowerProjectId)?.stage ?? "undated",
        render: (assignment) => {
          const stage = plan?.projects.find((project) => project.id === assignment.manpowerProjectId)?.stage ?? "undated";
          return <Badge className={cn("border-0 capitalize", STAGE_VARIANTS[stage])}>{stage}</Badge>;
        },
        csvValue: (assignment) =>
          plan?.projects.find((project) => project.id === assignment.manpowerProjectId)?.stage ?? "undated",
        width: 140,
      },
      {
        id: "notes",
        label: "Notes",
        defaultVisible: true,
        sortable: true,
        sortValue: (assignment) => assignment.notes ?? "",
        render: (assignment) => <span className="text-sm text-muted-foreground">{assignment.notes ?? "—"}</span>,
        csvValue: (assignment) => assignment.notes ?? "",
        width: 260,
      },
    ],
    [handleCoverageChange, people, plan?.projects, rowUpdateId],
  );

  const coverageGapColumns = React.useMemo<TableColumn<ManpowerAssignment>[]>(
    () => [
      assignmentColumns[0],
      assignmentColumns[1],
      {
        id: "gap_coverage",
        label: "Coverage",
        defaultVisible: true,
        sortable: true,
        sortValue: (assignment) => assignment.assigneeName ?? "",
        render: (assignment) => (
          <Badge className={cn("border-0", STATUS_VARIANTS[assignment.status])}>
            {assignment.assigneeName ?? "Unassigned"}
          </Badge>
        ),
        csvValue: (assignment) => assignment.assigneeName ?? "Unassigned",
        width: 160,
      },
      assignmentColumns[4],
      assignmentColumns[6],
    ],
    [assignmentColumns],
  );

  const peopleLoadColumns = React.useMemo<TableColumn<PeopleLoadRow>[]>(
    () => [
      {
        id: "person",
        label: "Person",
        alwaysVisible: true,
        sortable: true,
        sortValue: (person) => person.assignee,
        render: (person) => <span className="font-medium text-foreground">{person.assignee}</span>,
        csvValue: (person) => person.assignee,
        width: 220,
      },
      {
        id: "active_now",
        label: "Active now",
        defaultVisible: true,
        sortable: true,
        sortValue: (person) => person.activeAssignments,
        align: "right",
        render: (person) => (
          <span className={cn("block text-right tabular-nums", person.activeAssignments >= 3 ? "text-warning" : "text-foreground")}>
            {person.activeAssignments}
          </span>
        ),
        csvValue: (person) => String(person.activeAssignments),
        width: 120,
      },
      {
        id: "total_rows",
        label: "Total rows",
        defaultVisible: true,
        sortable: true,
        sortValue: (person) => person.totalAssignments,
        align: "right",
        render: (person) => <span className="block text-right tabular-nums text-muted-foreground">{person.totalAssignments}</span>,
        csvValue: (person) => String(person.totalAssignments),
        width: 120,
      },
      {
        id: "projects",
        label: "Projects",
        defaultVisible: true,
        sortable: true,
        sortValue: (person) => person.projects.length,
        render: (person) => (
          <span className="text-sm text-muted-foreground">
            {person.projects.slice(0, 3).join(", ")}
            {person.projects.length > 3 ? ` +${person.projects.length - 3} more` : ""}
          </span>
        ),
        csvValue: (person) => person.projects.join(", "),
        width: 280,
      },
    ],
    [],
  );

  const handleFilterChange = React.useCallback(
    (filters: Record<string, string | number | boolean | string[] | null | undefined>) => {
      tableState.setActiveFilters(filters);
      tableState.setPage(1);
      tableState.setSearchParams({
        timeWindow: String(filters.timeWindow ?? "active"),
        status: String(filters.status ?? "all"),
        role: String(filters.role ?? "all"),
        assignee: String(filters.assignee ?? "all"),
        page: "1",
      });
    },
    [tableState],
  );

  const clearFilters = React.useCallback(() => {
    handleFilterChange({
      timeWindow: "active",
      status: "all",
      role: "all",
      assignee: "all",
    });
  }, [handleFilterChange]);

  if (isLoading) {
    return (
      <div className="flex min-h-80 items-center justify-center">
        <Loader2 className="size-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <InfoAlert variant="info">
        CSV imports write the active manpower plan to Supabase. Coverage changes here update the stored staffing plan instead of resetting on refresh.
      </InfoAlert>

      {loadError ? <ErrorState title="Manpower system error" error={loadError} /> : null}

      {!plan ? (
        <EmptyState
          title="No persisted manpower plan"
          description="Upload the latest spreadsheet export or load the sample plan to initialize the staffing system."
          action={assignmentActions}
        />
      ) : (
        <>
          <UnifiedTablePage
            header={{
              title: "Coverage gaps",
              description: "Open roles and TBD assignments in the current staffing view.",
              variant: "compact",
            }}
            toolbar={{
              totalItems: openAssignments.length,
              filteredItems: openAssignments.length,
              searchValue: "",
              onSearchChange: () => undefined,
              currentView: "table",
              onViewChange: () => undefined,
              enabledViews: TABLE_ONLY_VIEWS,
              leftContent: (
                <span className="text-sm text-muted-foreground">
                  {openAssignments.length} gap{openAssignments.length === 1 ? "" : "s"}
                </span>
              ),
            }}
            data={{ items: openAssignments, isLoading: false, error: null }}
            table={{
              columns: coverageGapColumns,
              getRowId: (assignment) => assignment.id,
              density: "compact",
              stickyHeader: true,
            }}
            emptyState={{
              title: "No coverage gaps in this view",
              description: "The current filter set only shows filled assignments.",
              filteredDescription: "The current filter set only shows filled assignments.",
              isFiltered: true,
            }}
            features={{
              enableSearch: false,
              enableViews: false,
              enableFilters: false,
              enableColumnToggle: false,
              enableExport: false,
              enablePagination: openAssignments.length > 12,
              enableBulkDelete: false,
              enableRowSelection: false,
              enableRowActions: false,
            }}
            layout={{
              containerPadding: false,
              toolbarInlineWithHeader: true,
              minWidth: 840,
            }}
          />

          <UnifiedTablePage
            header={{
              title: "People load",
              description: "Assignment volume ranked so staffing pressure is visible without scanning every project.",
              variant: "compact",
            }}
            toolbar={{
              totalItems: peopleSummary.length,
              filteredItems: peopleSummary.length,
              searchValue: "",
              onSearchChange: () => undefined,
              currentView: "table",
              onViewChange: () => undefined,
              enabledViews: TABLE_ONLY_VIEWS,
              leftContent: (
                <span className="text-sm text-muted-foreground">
                  {peopleSummary.length} staffed people in the current view
                </span>
              ),
            }}
            data={{ items: peopleSummary, isLoading: false, error: null }}
            table={{
              columns: peopleLoadColumns,
              getRowId: (person) => person.id,
              density: "compact",
              stickyHeader: true,
            }}
            emptyState={{
              title: "No assigned people in this view",
              description: "Broaden the filters to see staffed roles.",
              filteredDescription: "Broaden the filters to see staffed roles.",
              isFiltered: true,
            }}
            features={{
              enableSearch: false,
              enableViews: false,
              enableFilters: false,
              enableColumnToggle: false,
              enableExport: false,
              enablePagination: peopleSummary.length > 12,
              enableBulkDelete: false,
              enableRowSelection: false,
              enableRowActions: false,
            }}
            layout={{
              containerPadding: false,
              toolbarInlineWithHeader: true,
              minWidth: 780,
            }}
          />

          <UnifiedTablePage
            header={{
              title: "Assignments",
              description: "Filter the active staffing plan and update assignment coverage in place.",
              actions: assignmentActions,
              variant: "compact",
            }}
            toolbar={{
              totalItems: plan.assignments.length,
              filteredItems: filteredAssignments.length,
              searchValue: tableState.searchInput,
              onSearchChange: tableState.setSearchInput,
              searchPlaceholder: "Search project, role, assignee, or notes",
              currentView: tableState.currentView,
              onViewChange: (view) => {
                tableState.setCurrentView(view);
                tableState.setSearchParams({ view });
              },
              enabledViews: TABLE_ONLY_VIEWS,
              filters: assignmentFilters,
              activeFilters: tableState.activeFilters,
              onFilterChange: handleFilterChange,
              onClearFilters: clearFilters,
              visibleColumns: tableState.visibleColumns,
              onColumnVisibilityChange: tableState.setVisibleColumns,
              leftContent: (
                <span className="text-sm text-muted-foreground">
                  Imported {formatPlanImportedAt(plan.importedAt)} ·{" "}
                  {new Set(filteredAssignments.map((assignment) => assignment.manpowerProjectId)).size} projects ·{" "}
                  {plan.warningCount} import warning{plan.warningCount === 1 ? "" : "s"}
                </span>
              ),
            }}
            data={{ items: filteredAssignments, isLoading: false, error: null }}
            table={{
              columns: assignmentColumns,
              getRowId: (assignment) => assignment.id,
              density: "compact",
              stickyHeader: true,
            }}
            sorting={{
              sortBy: tableState.sortBy,
              sortDirection: tableState.sortDirection,
              onSortChange: (sortBy, sortDirection) => {
                tableState.setSortBy(sortBy);
                tableState.setSortDirection(sortDirection);
                tableState.setPage(1);
                tableState.setSearchParams({
                  sort: sortBy,
                  sort_dir: sortDirection,
                  page: "1",
                });
              },
            }}
            pagination={{
              page: tableState.page,
              totalPages: Math.max(1, Math.ceil(filteredAssignments.length / tableState.perPage)),
              perPage: tableState.perPage,
              clientSide: true,
              onPageChange: (page) => {
                tableState.setPage(page);
                tableState.setSearchParams({ page: String(page) });
              },
              onPerPageChange: (perPage) => {
                const parsed = Number(perPage);
                if (!Number.isFinite(parsed) || parsed <= 0) return;
                tableState.setPerPage(parsed);
                tableState.setPage(1);
                tableState.setSearchParams({ per_page: String(parsed), page: "1" });
              },
            }}
            emptyState={{
              title: "No manpower rows match these filters",
              description: "Adjust the search, horizon, or staffing filters to recover the stored plan.",
              filteredDescription: "Adjust the search, horizon, or staffing filters to recover the stored plan.",
              isFiltered: Boolean(tableState.debouncedSearch) || filteredAssignments.length !== plan.assignments.length,
            }}
            features={{
              enableViews: false,
              enableBulkDelete: false,
              enableRowSelection: false,
              enableRowActions: false,
            }}
            layout={{
              containerPadding: false,
              toolbarInlineWithHeader: true,
              minWidth: 1180,
            }}
            reportContext={{
              projectName: "Company-wide manpower plan",
              exportedBy: plan.importedByName ?? undefined,
              extra: {
                source: plan.sourceLabel,
                imported_at: formatPlanImportedAt(plan.importedAt),
              },
            }}
          />

          <InfoAlert variant="warning">
            <span className="font-medium">CSV drift fails loudly.</span> Missing required columns or unmappable rows return an import error instead of silently dropping staffing data.
          </InfoAlert>
        </>
      )}
    </div>
  );
}
