"use client";

import * as React from "react";
import type { ReactElement, ReactNode } from "react";
import { useParams, usePathname, useRouter, useSearchParams } from "next/navigation";
import { Plus } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { apiFetch, summarizeBulkResults } from "@/lib/api-client";
import { useConfirmationDialog } from "@/components/common/ConfirmationDialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { ChangeEventExpandedRow } from "@/components/domain/change-events/ChangeEventExpandedRow";
import { ChangeEventSelectionBar } from "@/components/domain/change-events/ChangeEventSelectionBar";
import { AddToCommitmentCODialog } from "@/components/domain/change-events/AddToCommitmentCODialog";
import {
  UnifiedTablePage,
  useUnifiedTableState,
  type FilterValue,
} from "@/components/tables/unified";
import type { ChangeEvent } from "@/hooks/use-change-events";
import { useProjectChangeEvents } from "@/hooks/use-change-events";
import {
  buildChangeEventTableColumns,
  changeEventColumns,
  changeEventDefaultVisibleColumns,
  changeEventFilters,
  formatMoney,
  renderChangeEventCard,
  renderChangeEventList,
  renderChangeEventRowActions,
} from "@/features/change-events/change-events-table-config";
import { useProject } from "@/contexts/project-context";
import { ChangeEventRfqForm } from "@/components/domain/change-events/ChangeEventRfqForm";
import type { ChangeEventRfqFormValues } from "@/components/domain/change-events/ChangeEventRfqForm";
import { PageShell, PageTabs } from "@/components/layout";
import { ErrorState } from "@/components/ds";
import { PermissionGate } from "@/components/domain/permissions/PermissionGate";
import { ChangeEventsSettingsTab } from "@/features/change-events/change-events-settings-tab";

type ChangeEventFilterState = Record<string, FilterValue>;
type ChangeEventsSettingsSection = "change-events-settings" | "permissions";

function normalizeSettingsSection(value: string | null): ChangeEventsSettingsSection {
  return value === "permissions" ? "permissions" : "change-events-settings";
}

// Normalize scope values for comparison: "Out of Scope" and "out_of_scope" both → "out_of_scope".
// The DB stores human-readable scope ("Out of Scope") but filter options use snake_case.
const normalizeScope = (s: string) => s.trim().toLowerCase().replace(/[\s-]+/g, "_");

const EMPTY_FILTERS: ChangeEventFilterState = {
  status: undefined,
  scope: undefined,
  conversion_state: undefined,
  over_under: undefined,
  budget: undefined,
  budget_code_segments: undefined,
};
const CHANGE_EVENTS_VISIBLE_COLUMNS_MIGRATION_KEY =
  "change-events:visibleColumns:migrate-2026-04-17-all-default";
const CHANGE_EVENTS_COLUMN_ORDER_MIGRATION_KEY =
  "change-events:visibleColumns:migrate-2026-06-16-change-event-column-order";

function formatDateValue(dateValue: string | null | undefined): string {
  if (!dateValue) return "";
  const parsed = new Date(dateValue);
  if (Number.isNaN(parsed.getTime())) return "";
  return parsed.toLocaleDateString();
}

function escapeCsvField(field: string): string {
  if (field.includes(",") || field.includes('"') || field.includes("\n")) {
    return `"${field.replace(/"/g, '""')}"`;
  }
  return field;
}

export default function ProjectChangeEventsPage(): ReactElement {
  const params = useParams<{ projectId: string }>()!;
  const pathname = usePathname()!;
  const router = useRouter();
  const searchParams = useSearchParams()!;

  const projectIdParamRaw = params.projectId;
  const parsedProjectId = projectIdParamRaw ? parseInt(projectIdParamRaw, 10) : NaN;
  const hasValidProjectId = Number.isFinite(parsedProjectId) && parsedProjectId > 0;
  const projectId = hasValidProjectId ? parsedProjectId : 0;

  const { selectedProject } = useProject();

  // Tab state — All | Line Items | No Line Items | RFQs | Recycle Bin | Settings
  const activeTab = searchParams.get("tab") ?? "all";
  const settingsSection = normalizeSettingsSection(searchParams.get("settings_tab"));
  const activeDataTab =
    activeTab === "line_items" ||
    activeTab === "no_line_items" ||
    activeTab === "rfqs" ||
    activeTab === "recycle_bin"
      ? activeTab
      : "all";

  const initialStatus = searchParams.get("status") ?? "";
  const initialScope = searchParams.get("scope") ?? "";
  const initialConversionState = searchParams.get("conversion_state") ?? "";
  const initialFilters: ChangeEventFilterState = {
    status: initialStatus || undefined,
    scope: initialScope || undefined,
    conversion_state: initialConversionState || undefined,
  };

  const tableState = useUnifiedTableState({
    entityKey: "change-events",
    searchParams,
    pathname,
    router,
    defaults: {
      view: "table",
      allowedViews: ["table", "card", "list"],
      page: 1,
      perPage: 25,
      search: "",
      sortBy: "number_title",
      sortDirection: "asc",
      visibleColumns: changeEventDefaultVisibleColumns,
      filters: initialFilters,
    },
  });

  React.useEffect(() => {
    if (typeof window === "undefined") return;
    if (!tableState.visibleColumns.length) return;

    const hasMigrated = window.localStorage.getItem(
      CHANGE_EVENTS_VISIBLE_COLUMNS_MIGRATION_KEY,
    );
    if (hasMigrated === "1") return;

    tableState.setVisibleColumns(changeEventDefaultVisibleColumns);
    window.localStorage.setItem(
      CHANGE_EVENTS_VISIBLE_COLUMNS_MIGRATION_KEY,
      "1",
    );
  }, [tableState.visibleColumns.length, tableState.setVisibleColumns]);

  React.useEffect(() => {
    if (typeof window === "undefined") return;
    const hasMigrated = window.localStorage.getItem(
      CHANGE_EVENTS_COLUMN_ORDER_MIGRATION_KEY,
    );
    if (hasMigrated === "1") return;

    tableState.setVisibleColumns(changeEventDefaultVisibleColumns);
    window.localStorage.setItem(
      CHANGE_EVENTS_COLUMN_ORDER_MIGRATION_KEY,
      "1",
    );
  }, [tableState.setVisibleColumns]);

  React.useEffect(() => {
    const nextStatus = searchParams.get("status") ?? "";
    const nextScope = searchParams.get("scope") ?? "";
    const nextConversionState = searchParams.get("conversion_state") ?? "";

    tableState.setActiveFilters((prev) => {
      const normalizedStatus = nextStatus || undefined;
      const normalizedScope = nextScope || undefined;
      const normalizedConversionState = nextConversionState || undefined;
      if (
        prev.status === normalizedStatus &&
        prev.scope === normalizedScope &&
        prev.conversion_state === normalizedConversionState
      ) {
        return prev;
      }
      return {
        status: normalizedStatus,
        scope: normalizedScope,
        conversion_state: normalizedConversionState,
      };
    });
  }, [searchParams, tableState.setActiveFilters]);

  const activeFilters = tableState.activeFilters as ChangeEventFilterState;
  const statusParam =
    searchParams.get("status") ??
    (typeof activeFilters.status === "string" ? activeFilters.status : "");
  const scopeParam =
    searchParams.get("scope") ??
    (typeof activeFilters.scope === "string" ? activeFilters.scope : "");

  // Server-side pagination: pass page + perPage + tab + scope to the API.
  // The API handles tab/scope filtering and returns paginated results + tab counts in meta.
  const {
    changeEvents: tabFilteredEvents,
    isLoading,
    error,
    total: serverTotal,
    tabSummary,
    refetch: refetchChangeEvents,
  } = useProjectChangeEvents(projectId, {
    status: statusParam || undefined,
    scope: scopeParam || undefined,
    page: tableState.page,
    perPage: tableState.perPage,
    tab: activeDataTab,
    enabled: hasValidProjectId,
  });

  // Tab counts come from the API's tabSummary meta field
  const lineItemsCount = tabSummary?.lineItems ?? 0;
  const noLineItemsCount = tabSummary?.noLineItems ?? 0;
  const rfqsCount = tabSummary?.rfqs ?? 0;

  // Row expansion state
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

  const deleteDialog = useConfirmationDialog({
    title: "Delete Change Event",
    description: "Move this change event to the recycle bin? You can restore it later manually.",
    confirmLabel: "Delete",
    variant: "destructive",
  });

  const restoreDialog = useConfirmationDialog({
    title: "Restore Change Event",
    description: "Restore this change event to the active list?",
    confirmLabel: "Restore",
  });

  const bulkDeleteDialog = useConfirmationDialog({
    title: "Delete Change Events",
    description: "Move the selected change events to the recycle bin? You can restore them later manually.",
    confirmLabel: "Delete All",
    variant: "destructive",
  });

  const [showRfqSheet, setShowRfqSheet] = React.useState(false);
  const [isCreatingRfq, setIsCreatingRfq] = React.useState(false);
  const [showCommitmentCODialog, setShowCommitmentCODialog] = React.useState(false);

  const handleView = React.useCallback(
    (item: ChangeEvent) => {
      router.push(`/${projectId}/change-events/${item.id}`);
    },
    [projectId, router],
  );

  const handleEdit = React.useCallback(
    (item: ChangeEvent) => {
      router.push(`/${projectId}/change-events/${item.id}?edit=1`);
    },
    [projectId, router],
  );

  const handleDelete = React.useCallback(
    (item: ChangeEvent) => {
      deleteDialog.confirm(async () => {
        try {
          await apiFetch(`/api/projects/${projectId}/change-events/${item.id}`, {
            method: "DELETE",
          });
          toast.success("Change event moved to recycle bin");
          refetchChangeEvents();
        } catch (err) {
          toast.error("Failed to delete change event");
        }
      });
    },
    [projectId, refetchChangeEvents, deleteDialog],
  );

  const handleRestore = React.useCallback(
    (item: ChangeEvent) => {
      restoreDialog.confirm(async () => {
        try {
          await apiFetch(`/api/projects/${projectId}/change-events/${item.id}/restore`, {
            method: "POST",
          });
          toast.success("Change event restored");
          refetchChangeEvents();
        } catch (err) {
          const message = err instanceof Error ? err.message : "Failed to restore change event";
          toast.error(message);
        }
      });
    },
    [projectId, refetchChangeEvents, restoreDialog],
  );

  const handleSendRfqsForItem = React.useCallback(
    (item: ChangeEvent) => {
      tableState.setSelectedIds([String(item.id)]);
      setShowRfqSheet(true);
    },
    [tableState],
  );

  const handleBulkDelete = React.useCallback(() => {
    const selectedIds = tableState.selectedIds;
    if (selectedIds.length === 0) {
      toast.info("Select at least one change event to delete.");
      return;
    }

    bulkDeleteDialog.confirm(async () => {
      try {
        const results = await Promise.allSettled(
          selectedIds.map((id) =>
            apiFetch(`/api/projects/${projectId}/change-events/${id}`, {
              method: "DELETE",
            }),
          ),
        );

        const { succeeded, failed, firstError } = summarizeBulkResults(results);

        if (succeeded > 0) {
          toast.success(
            `${succeeded} change event${succeeded === 1 ? "" : "s"} moved to recycle bin`,
          );
        }

        if (failed > 0) {
          toast.error(
            failed === 1
              ? firstError
              : `Failed to delete ${failed} change event${failed === 1 ? "" : "s"}: ${firstError}`,
          );
        }

        tableState.setSelectedIds([]);
        refetchChangeEvents();
      } catch (err) {
        toast.error("Failed to bulk delete change events");
      }
    });
  }, [projectId, refetchChangeEvents, tableState, bulkDeleteDialog]);

  const handleSendRfq = React.useCallback(
    async (values: ChangeEventRfqFormValues) => {
      setIsCreatingRfq(true);
      try {
        const selectedIds = tableState.selectedIds;
        if (selectedIds.length === 0) {
          throw new Error("Select at least one change event before sending an RFQ.");
        }

        const selectedChangeEvents = tabFilteredEvents.filter((event) =>
          selectedIds.includes(String(event.id)),
        );
        if (selectedChangeEvents.length === 0) {
          throw new Error("Selected change event(s) could not be found.");
        }

        const results = await Promise.allSettled(
          selectedChangeEvents.map((changeEvent) =>
            apiFetch<unknown>(`/api/projects/${projectId}/change-events/rfqs`, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                changeEventId: String(changeEvent.id),
                title: values.title.trim() || undefined,
                dueDate: values.dueDate || undefined,
                includeAttachments: values.includeAttachments,
                notes: values.requestDetails.trim() || undefined,
                assignedContactId: values.distributionPersonId || undefined,
              }),
            }),
          ),
        );

        const succeeded = results.filter((r) => r.status === "fulfilled");
        const failed = results.filter((r) => r.status === "rejected");

        if (succeeded.length > 0) {
          toast.success(
            succeeded.length === 1
              ? "RFQ sent successfully"
              : `${succeeded.length} RFQs sent successfully`,
          );
        }

        if (failed.length > 0) {
          const reasons = failed
            .map((r) => (r as PromiseRejectedResult).reason?.message)
            .filter(Boolean)
            .join("; ");
          toast.error(
            failed.length === 1
              ? `Failed to send RFQ: ${reasons}`
              : `Failed to send ${failed.length} RFQ(s): ${reasons}`,
          );
        }

        if (failed.length === 0) {
          setShowRfqSheet(false);
          tableState.setSelectedIds([]);
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : "Failed to send RFQ";
        toast.error(message);
      } finally {
        setIsCreatingRfq(false);
      }
    },
    [tabFilteredEvents, projectId, tableState],
  );

  const handleFilterChange = React.useCallback(
    (nextFilters: ChangeEventFilterState) => {
      tableState.setActiveFilters(nextFilters);
      tableState.setSearchParams({
        status: typeof nextFilters.status === "string" ? nextFilters.status : null,
        scope: typeof nextFilters.scope === "string" ? nextFilters.scope : null,
        conversion_state:
          typeof nextFilters.conversion_state === "string"
            ? nextFilters.conversion_state
            : null,
        page: "1",
      });
      tableState.setPage(1);
    },
    [tableState],
  );

  // Apply search filter on top of tab-filtered events
  const filteredEvents = React.useMemo(() => {
    const searchTerm = tableState.debouncedSearch.trim().toLowerCase();
    const scopeFilter =
      typeof activeFilters.scope === "string" ? normalizeScope(activeFilters.scope) : "";
    const conversionStateFilter =
      typeof activeFilters.conversion_state === "string"
        ? activeFilters.conversion_state
        : "";
    const overUnderFilter =
      typeof activeFilters.over_under === "string" ? activeFilters.over_under : "";
    const budgetFilter =
      typeof activeFilters.budget === "string" ? activeFilters.budget.toLowerCase() : "";
    const budgetCodeFilter =
      typeof activeFilters.budget_code_segments === "string"
        ? activeFilters.budget_code_segments.toLowerCase()
        : "";

    return tabFilteredEvents.filter((event) => {
      if (scopeFilter && normalizeScope(event.scope ?? "") !== scopeFilter) {
        return false;
      }

      if (conversionStateFilter) {
        const sentToPrime = Boolean(event.sent_to_prime_pco);
        const sentToCommitment = Boolean(event.sent_to_commitment_pco);
        const linkedCount = Number(sentToPrime) + Number(sentToCommitment);

        if (conversionStateFilter === "unlinked" && linkedCount !== 0) return false;
        if (conversionStateFilter === "partially_linked" && linkedCount !== 1) return false;
        if (conversionStateFilter === "fully_linked" && linkedCount !== 2) return false;
      }

      if (overUnderFilter) {
        const costRom = Number(event.cost_rom ?? 0);
        const rom = Number(event.rom ?? 0);
        if (overUnderFilter === "over" && costRom <= rom) return false;
        if (overUnderFilter === "under" && costRom >= rom) return false;
      }

      if (budgetFilter) {
        // budget_code text field not yet on ChangeEvent — no-op filter until enriched
        void budgetFilter;
      }

      if (budgetCodeFilter) {
        // budget_code_segments text field not yet on ChangeEvent — no-op filter until enriched
        void budgetCodeFilter;
      }

      if (!searchTerm) {
        return true;
      }

      const eventNumber = event.number ?? `CE-${event.id}`;
      return (
        eventNumber.toLowerCase().includes(searchTerm) ||
        event.title?.toLowerCase().includes(searchTerm) ||
        (event.reason ?? "").toLowerCase().includes(searchTerm)
      );
    });
  }, [
    activeFilters.scope,
    activeFilters.conversion_state,
    activeFilters.over_under,
    activeFilters.budget,
    activeFilters.budget_code_segments,
    tabFilteredEvents,
    tableState.debouncedSearch,
  ]);

  const handleExport = React.useCallback(() => {
    // Columns mirror the on-screen table 1:1 so the export contains every
    // detail the user can see. Order matches the table left-to-right.
    const headers = [
      "#",
      "Title",
      "Status",
      "Scope",
      "Type",
      "Change Reason",
      "Origin",
      "Prime PCO",
      "Prime PCO Title",
      "Cost ROM",
      "RFQ Title",
      "Commitment",
      "Commitment Title",
      "Created",
      // Additional detail not in the table but valuable in CSV form.
      "Description",
      "Expecting Revenue",
      "Conversion State",
      "Line Items",
    ];

    const scopeDisplayMap: Record<string, string> = {
      tbd: "TBD",
      in_scope: "In Scope",
      out_of_scope: "Out of Scope",
    };
    const statusDisplayMap: Record<string, string> = {
      pending_approval: "Pending Approval",
      open: "Open",
      approved: "Approved",
      rejected: "Rejected",
      closed: "Closed",
      pending: "Pending",
    };

    const conversionStateLabel = (event: ChangeEvent): string => {
      const sentPrime = Boolean(event.sent_to_prime_pco);
      const sentCommitment = Boolean(event.sent_to_commitment_pco);
      const linked = Number(sentPrime) + Number(sentCommitment);
      if (linked === 0) return "Unlinked";
      if (linked === 1) return "Partially Linked";
      return "Fully Linked";
    };

    const rows = filteredEvents.map((event) => {
      const number = event.number ?? `CE-${event.id}`;
      const title = event.title ?? "";
      const status = statusDisplayMap[(event.status ?? "").toLowerCase()] ?? (event.status ?? "");
      const scope = scopeDisplayMap[(event.scope ?? "").toLowerCase()] ?? (event.scope ?? "");
      const type = event.type ?? "";
      const reason = event.reason ?? "";
      const origin = event.origin ?? "";
      const primePco = String(event.rom ?? 0);
      // Matches table: prefer the title, fall back to the PCO number, else "".
      const primePcoTitle = event.prime_pco_title ?? event.prime_pco ?? "";
      const costRom = String(event.cost_rom ?? 0);
      const rfqTitle = event.rfq_title ?? "";
      const commitment = String(event.commitment ?? 0);
      const commitmentTitle = event.commitment_title ?? "";
      const createdAt = formatDateValue(event.created_at);
      const description = event.description ?? "";
      const expectingRevenue = event.expecting_revenue === false ? "No" : "Yes";
      const conversionState = conversionStateLabel(event);
      const lineItemsCount = String(event.lineItemsCount ?? 0);

      return [
        number,
        title,
        status,
        scope,
        type,
        reason,
        origin,
        primePco,
        primePcoTitle,
        costRom,
        rfqTitle,
        commitment,
        commitmentTitle,
        createdAt,
        description,
        expectingRevenue,
        conversionState,
        lineItemsCount,
      ]
        .map(escapeCsvField)
        .join(",");
    });

    // Metadata block — project context + applied filters so the CSV is
    // self-describing when opened standalone.
    const exportedAt = new Date();
    const projectLabel =
      selectedProject?.name && selectedProject?.number
        ? `${selectedProject.number} — ${selectedProject.name}`
        : selectedProject?.name ?? `Project ${projectId}`;

    const metaPair = (label: string, value: string) =>
      `${escapeCsvField(label)},${escapeCsvField(value)}`;

    const tabLabelMap: Record<string, string> = {
      all: "All",
      line_items: "Line Items",
      no_line_items: "No Line Items",
      rfqs: "RFQs",
      recycle_bin: "Recycle Bin",
    };

    const filterParts: string[] = [];
    if (statusParam) filterParts.push(`status=${statusDisplayMap[statusParam.toLowerCase()] ?? statusParam}`);
    if (scopeParam) filterParts.push(`scope=${scopeDisplayMap[scopeParam.toLowerCase()] ?? scopeParam}`);
    if (tableState.debouncedSearch) filterParts.push(`search="${tableState.debouncedSearch}"`);

    const metaLines = [
      metaPair("Report", "Change Event Log"),
      metaPair("Project", projectLabel),
      metaPair("Tab", tabLabelMap[activeTab] ?? activeTab),
      metaPair("Exported", exportedAt.toISOString()),
      metaPair("Rows", String(filteredEvents.length)),
    ];
    if (filterParts.length > 0) {
      metaLines.push(metaPair("Filters", filterParts.join("; ")));
    }
    // Blank separator row between metadata and the data table.
    metaLines.push("");

    const csvContent = [
      ...metaLines,
      headers.map(escapeCsvField).join(","),
      ...rows,
    ].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    const exportedIso = exportedAt.toISOString().slice(0, 10);
    const projectToken = selectedProject?.number
      ? `${selectedProject.number}-`
      : `${projectId}-`;
    link.href = url;
    link.download = `${projectToken}change-events-${exportedIso}.csv`;
    link.style.display = "none";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    toast.success(
      `Exported ${filteredEvents.length} change event${filteredEvents.length === 1 ? "" : "s"} to CSV`,
    );
  }, [
    filteredEvents,
    selectedProject,
    projectId,
    activeTab,
    statusParam,
    scopeParam,
    tableState.debouncedSearch,
  ]);

  // Inline cell edits (Scope / Type / Change Reason / Origin in table view).
  // Persists directly via PATCH and refreshes the list. No toast here —
  // UnifiedTablePage shows its own per-cell "<field> updated" confirmation on commit.
  const handleInlineUpdate = React.useCallback(
    async (changeEventId: string, data: Record<string, unknown>) => {
      await apiFetch(
        `/api/projects/${projectId}/change-events/${changeEventId}`,
        {
          method: "PATCH",
          body: JSON.stringify(data),
        },
      );
      await refetchChangeEvents();
    },
    [projectId, refetchChangeEvents],
  );

  const tableColumns = React.useMemo(
    () =>
      buildChangeEventTableColumns(expandedIds, handleToggleExpand, {
        onUpdate: handleInlineUpdate,
      }),
    [expandedIds, handleToggleExpand, handleInlineUpdate],
  );

  // serverTotal is the authoritative count for the active tab from the server.
  // filteredItems reflects any additional client-side filtering on the current page.
  const totalItems = serverTotal;
  const filteredItems = filteredEvents.length;

  // Tabs: All | Line Items | No Line Items | RFQs | Recycle Bin | Settings
  const tabs = React.useMemo(
    () => [
      {
        label: "All",
        href: `/${projectId}/change-events?tab=all`,
        count: lineItemsCount + noLineItemsCount,
        isActive: activeTab === "all",
        testId: "change-events-tab-all",
        countTestId: "change-events-count-all",
      },
      {
        label: "Line Items",
        href: `/${projectId}/change-events?tab=line_items`,
        count: lineItemsCount,
        isActive: activeTab === "line_items",
        testId: "change-events-tab-line-items",
        countTestId: "change-events-count-line-items",
      },
      {
        label: "No Line Items",
        href: `/${projectId}/change-events?tab=no_line_items`,
        count: noLineItemsCount,
        isActive: activeTab === "no_line_items",
        testId: "change-events-tab-no-line-items",
        countTestId: "change-events-count-no-line-items",
      },
      {
        label: "RFQs",
        href: `/${projectId}/change-events?tab=rfqs`,
        count: rfqsCount,
        isActive: activeTab === "rfqs",
        testId: "change-events-tab-rfqs",
        countTestId: "change-events-count-rfqs",
      },
      {
        label: "Recycle Bin",
        href: `/${projectId}/change-events?tab=recycle_bin`,
        count: tabSummary?.recycleBin,
        isActive: activeTab === "recycle_bin",
        testId: "change-events-tab-recycle-bin",
      },
      {
        label: "Settings",
        href: `/${projectId}/change-events?tab=settings&settings_tab=change-events-settings`,
        isActive: activeTab === "settings",
        testId: "change-events-tab-settings",
      },
    ],
    [projectId, activeTab, lineItemsCount, noLineItemsCount, rfqsCount, tabSummary],
  );

  const settingsTabs = React.useMemo(
    () => [
      {
        label: "Change Events Settings",
        href: `/${projectId}/change-events?tab=settings&settings_tab=change-events-settings`,
        isActive: settingsSection === "change-events-settings",
        testId: "change-events-settings-tab-general",
      },
      {
        label: "Permissions Table",
        href: `/${projectId}/change-events?tab=settings&settings_tab=permissions`,
        isActive: settingsSection === "permissions",
        testId: "change-events-settings-tab-permissions",
      },
    ],
    [projectId, settingsSection],
  );

  // Grand Totals — sum monetary columns
  const grandTotals = React.useMemo(() => {
    let revenuePrimePco = 0;
    let costRom = 0;
    let commitmentTotal = 0;

    for (const event of filteredEvents) {
      revenuePrimePco += Number(event.rom ?? 0);
      costRom += Number(event.cost_rom ?? 0);
      commitmentTotal += Number(event.commitment ?? 0);
    }

    return {
      revenue_prime_pco: formatMoney(revenuePrimePco),
      cost_rom: formatMoney(costRom),
      commitment: formatMoney(commitmentTotal),
    };
  }, [filteredEvents]);

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      tableState.setSelectedIds(filteredEvents.map((item) => String(item.id)));
      return;
    }
    tableState.setSelectedIds([]);
  };

  const handleSelectRow = (id: string, checked: boolean) => {
    if (checked) {
      tableState.setSelectedIds((prev) => [...prev, id]);
      return;
    }
    tableState.setSelectedIds((prev) => prev.filter((itemId) => itemId !== id));
  };

  const isFiltered =
    Boolean(tableState.searchInput) ||
    Boolean(activeFilters.status) ||
    Boolean(activeFilters.scope) ||
    Boolean(activeFilters.conversion_state) ||
    Boolean(activeFilters.over_under) ||
    Boolean(activeFilters.budget) ||
    Boolean(activeFilters.budget_code_segments);

  // Render expanded row content — fetches line items + markups from API
  const renderExpandedRow = React.useCallback(
    (
      item: ChangeEvent,
      colSpan: number,
      context?: { columns: Array<{ id: string; width?: number }>; hasSelection: boolean; hasActions: boolean },
    ): ReactNode | null => {
      if (!expandedIds.has(String(item.id))) return null;

      return (
        <ChangeEventExpandedRow
          changeEventId={item.id}
          projectId={projectId}
          colSpan={colSpan}
          context={context}
          onEditLineItem={(lineItemId) => {
            router.push(`/${projectId}/change-events/${item.id}?edit=1&lineItem=${lineItemId}`);
          }}
        />
      );
    },
    [expandedIds, projectId, router],
  );

  if (!hasValidProjectId) {
    return (
      <PageShell
        variant="table"
        title="Change Events"
        description="Provide a valid project identifier to access change events."
      >
        <ErrorState
          title="Invalid Project"
          error="Change events require a numeric project identifier. Navigate through the project workspace to continue."
        />
      </PageShell>
    );
  }

  const selectedChangeEvents = filteredEvents.filter((e) =>
    tableState.selectedIds.includes(String(e.id)),
  );

  if (activeTab === "settings") {
    return (
      <PageShell
        variant="table"
        title="Change Events"
        description="Track scope changes, approvals, and financial impact."
      >
        <PageTabs tabs={tabs} variant="inline" className="mb-0" />
        <PageTabs tabs={settingsTabs} variant="inline" className="mb-6" />
        <ChangeEventsSettingsTab
          projectId={projectId}
          section={settingsSection}
        />
      </PageShell>
    );
  }

  return (
    <>
    <UnifiedTablePage
      header={{
        title: "Change Events",
        description: "Track scope changes, approvals, and financial impact.",
        actions: (
          <PermissionGate projectId={projectId} module="change_orders" level="write">
            <Button
              size="sm"
              onClick={() => router.push(`/${projectId}/change-events/new`)}
              className="gap-2"
              data-testid="change-events-new-button"
            >
              <Plus />
              Create
            </Button>
          </PermissionGate>
        ),
      }}
      tabs={tabs}
      topContent={
        tableState.selectedIds.length > 0 && activeTab !== "recycle_bin" ? (
          <ChangeEventSelectionBar
            selectedCount={tableState.selectedIds.length}
            hasItems={filteredEvents.length > 0}
            onSendRfq={() => setShowRfqSheet(true)}
            selectedChangeEventIds={tableState.selectedIds}
            projectId={projectId}
            onSuccess={() => {
              tableState.setSelectedIds([]);
              refetchChangeEvents();
            }}
            onAddToCommitmentChangeOrder={() => setShowCommitmentCODialog(true)}
          />
        ) : undefined
      }
      toolbar={{
        totalItems,
        filteredItems,
        selectedCount: tableState.selectedIds.length,
        searchValue: tableState.searchInput,
        onSearchChange: tableState.setSearchInput,
        searchPlaceholder: "Search change events...",
        currentView: tableState.currentView,
        onViewChange: (view) => {
          tableState.setCurrentView(view);
          tableState.setSearchParams({ view });
        },
        enabledViews: ["table", "card", "list"],
        filters: changeEventFilters,
        activeFilters,
        onFilterChange: handleFilterChange,
        onClearFilters: () => handleFilterChange(EMPTY_FILTERS),
        columns: changeEventColumns,
        visibleColumns: tableState.visibleColumns,
        onColumnVisibilityChange: tableState.setVisibleColumns,
        onExport: handleExport,
        onBulkDelete: activeTab !== "recycle_bin" ? handleBulkDelete : undefined,
      }}
      data={{
        items: filteredEvents,
        isLoading,
        isFetching: false,
        error,
      }}
      table={{
        columns: tableColumns,
        getRowId: (item) => String(item.id),
        onRowClick: handleView,
        rowActions: (item) =>
          renderChangeEventRowActions(item, handleView, handleEdit, handleDelete, handleSendRfqsForItem, activeTab === "recycle_bin" ? handleRestore : undefined),
        renderExpandedRow,
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
          });
        },
      }}
      selection={{
        selectedIds: tableState.selectedIds,
        onSelectAll: handleSelectAll,
        onSelectRow: handleSelectRow,
      }}
      views={{
        card: (item) => renderChangeEventCard(item, handleView),
        list: (item) => renderChangeEventList(item, handleView),
      }}
      emptyState={{
        title: activeTab === "recycle_bin" ? "Recycle bin is empty" : "No change events found",
        description: activeTab === "recycle_bin"
          ? "Deleted change events will appear here."
          : activeTab === "all"
            ? "Create your first change event to start tracking scope changes."
            : "No change events match this filter.",
        filteredDescription: "Try adjusting your search or filters.",
        isFiltered,
        action: activeTab !== "recycle_bin" ? (
          <Button size="sm" onClick={() => router.push(`/${projectId}/change-events/new`)}>
            Add change event
          </Button>
        ) : undefined,
      }}
      footerTotals={{
        label: "Grand Totals",
        // Only the monetary columns get a total — non-monetary columns
        // render nothing rather than a placeholder dash (noise gate).
        values: {
          revenue_prime_pco: <span className="tabular-nums">{grandTotals.revenue_prime_pco}</span>,
          cost_rom: <span className="tabular-nums">{grandTotals.cost_rom}</span>,
          commitment: <span className="tabular-nums">{grandTotals.commitment}</span>,
        },
      }}
      columnGroups={[
        { label: "", columnIds: ["number_title"] },
        { label: "Revenue", columnIds: ["revenue_prime_pco", "prime_pco_title"] },
        { label: "Cost", columnIds: ["cost_rom", "rfq_title", "commitment", "commitment_title"] },
        { label: "Change Event", columnIds: ["status", "scope", "type", "reason", "origin"] },
        { label: "", columnIds: ["created_at"] },
      ]}
      pagination={{
        page: tableState.page,
        totalPages: Math.max(1, Math.ceil(serverTotal / tableState.perPage)),
        perPage: tableState.perPage,
        onPageChange: (newPage) => {
          tableState.setPage(newPage);
          tableState.setSearchParams({ page: String(newPage) });
        },
        onPerPageChange: (newPerPage) => {
          tableState.setPerPage(Number(newPerPage));
          tableState.setPage(1);
          tableState.setSearchParams({ perPage: newPerPage, page: "1" });
        },
      }}
      features={{
        enableExport: true,
        enableBulkDelete: activeTab !== "recycle_bin",
        enableColumnPinning: false,
      }}
      reportContext={{
        projectId,
        projectName: selectedProject?.name,
        projectNumber: selectedProject?.number,
      }}
      layout={{
        fullBleedTable: true,
        removeTableFrame: true,
        plainFooterTotals: true,
      }}
    />
    {deleteDialog.dialog}
    {restoreDialog.dialog}
    {bulkDeleteDialog.dialog}
    <AddToCommitmentCODialog
      open={showCommitmentCODialog}
      onClose={() => setShowCommitmentCODialog(false)}
      selectedChangeEventIds={tableState.selectedIds}
      projectId={projectId}
      onSuccess={() => {
        setShowCommitmentCODialog(false);
        tableState.setSelectedIds([]);
        refetchChangeEvents();
      }}
    />
    <Sheet open={showRfqSheet} onOpenChange={setShowRfqSheet}>
      <SheetContent className="overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Send Requests for Quote</SheetTitle>
        </SheetHeader>
        <div className="px-6 pb-5">
          {selectedChangeEvents.length > 0 && selectedChangeEvents[0] !== undefined && (
            <ChangeEventRfqForm
              changeEvent={selectedChangeEvents[0]}
              isSubmitting={isCreatingRfq}
              onSubmit={handleSendRfq}
              onCancel={() => setShowRfqSheet(false)}
            />
          )}
        </div>
      </SheetContent>
    </Sheet>
    </>
  );
}
