"use client";
import { useCallback, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { AlertTriangle, Check, Sparkles } from "lucide-react";

import {
  UnifiedTablePage,
  useUnifiedTableState,
  TableDateValue,
  type FilterValue,
  type TableColumn,
} from "@/components/tables/unified";
import { StatusBadge } from "@/components/ds";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { apiFetch } from "@/lib/api-client";
import { reportNonCriticalFailure } from "@/lib/report-non-critical-failure";
import { appToast as toast } from "@/lib/toast/app-toast";
import { cn } from "@/lib/utils";

import type {
  InboxItem,
  InboxProject,
} from "@/features/assignment-inbox/load-inbox-items";
import {
  CONTENT_TYPE_META,
  INBOX_COLUMNS,
  INBOX_DEFAULT_VISIBLE_COLUMNS,
  buildInboxFilters,
  confidenceStatus,
  formatConfidence,
} from "@/features/assignment-inbox/assignment-inbox-table-config";
import { AssignmentInboxRulesPanel } from "@/features/assignment-inbox/assignment-inbox-rules-panel";

interface AssignmentInboxClientProps {
  initialItems: InboxItem[];
  projects: InboxProject[];
  totalUnassigned: number;
  initialHasMore: boolean;
  initialNextOffset: number;
  errorMessage: string | null;
}

export function AssignmentInboxClient({
  initialItems,
  projects,
  totalUnassigned,
  initialHasMore,
  initialNextOffset,
  errorMessage,
}: AssignmentInboxClientProps) {
  const searchParams = useSearchParams();
  const pathname = usePathname() ?? "";
  const router = useRouter();

  const activeSection = searchParams?.get("section") === "rules" ? "rules" : "queue";

  const [items, setItems] = useState<InboxItem[]>(initialItems);
  const [hasMore, setHasMore] = useState(initialHasMore);
  const [nextOffset, setNextOffset] = useState(initialNextOffset);
  const [loadingMore, setLoadingMore] = useState(false);
  const [assignedKeys, setAssignedKeys] = useState<Set<string>>(new Set());
  const [savingKeys, setSavingKeys] = useState<Set<string>>(new Set());
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const projectNameById = useMemo(
    () => new Map(projects.map((project) => [project.id, project.name])),
    [projects],
  );

  const handleLoadMore = useCallback(async () => {
    if (loadingMore || !hasMore) return;
    setLoadingMore(true);
    try {
      const result = await apiFetch<{
        items: InboxItem[];
        totalUnassigned: number;
        hasMore: boolean;
        nextOffset: number;
      }>(`/api/assignment-inbox?offset=${nextOffset}`);
      setItems((prev) => {
        const seen = new Set(prev.map((item) => item.rowKey));
        const additions = result.items.filter((item) => !seen.has(item.rowKey));
        return [...prev, ...additions];
      });
      setHasMore(result.hasMore);
      setNextOffset(result.nextOffset);
    } catch (error) {
      reportNonCriticalFailure({
        area: "assignment-inbox",
        operation: "load-more",
        error,
        userVisibleFallback: "Could not load more items.",
      });
      toast.error("Could not load more items.");
    } finally {
      setLoadingMore(false);
    }
  }, [loadingMore, hasMore, nextOffset]);

  const assignItem = useCallback(
    async (item: InboxItem, projectId: number): Promise<boolean> => {
      setSavingKeys((prev) => new Set(prev).add(item.rowKey));
      try {
        await apiFetch("/api/assignment-inbox/assign", {
          method: "POST",
          body: JSON.stringify({
            sourceTable: item.sourceTable,
            itemId: item.itemId,
            projectId,
            suggestedProjectId: item.suggestedProjectId,
          }),
        });
        setAssignedKeys((prev) => new Set(prev).add(item.rowKey));
        setSelectedIds((prev) => prev.filter((id) => id !== item.rowKey));
        return true;
      } catch (error) {
        const fallback = "The item could not be assigned to the project.";
        reportNonCriticalFailure({
          area: "assignment-inbox",
          operation: "assign",
          error,
          userVisibleFallback: fallback,
        });
        toast.error(fallback);
        return false;
      } finally {
        setSavingKeys((prev) => {
          const next = new Set(prev);
          next.delete(item.rowKey);
          return next;
        });
      }
    },
    [],
  );

  const handleManualAssign = useCallback(
    async (item: InboxItem, projectId: number) => {
      const ok = await assignItem(item, projectId);
      if (ok) {
        toast.success(`Assigned to ${projectNameById.get(projectId) ?? "project"}`);
      }
    },
    [assignItem, projectNameById],
  );

  const handleAcceptSuggestion = useCallback(
    async (item: InboxItem) => {
      if (item.suggestedProjectId == null) return;
      const ok = await assignItem(item, item.suggestedProjectId);
      if (ok) {
        toast.success(
          `Accepted suggestion — ${item.suggestedProjectName ?? "project"}`,
        );
      }
    },
    [assignItem],
  );

  const visibleItems = useMemo(
    () => items.filter((item) => !assignedKeys.has(item.rowKey)),
    [items, assignedKeys],
  );

  const tabs = useMemo(
    () => [
      {
        label: "Needs project assignment",
        href: pathname,
        count: visibleItems.length,
        isActive: activeSection === "queue",
      },
      {
        label: "Attribution rules",
        href: `${pathname}?section=rules`,
        isActive: activeSection === "rules",
      },
    ],
    [visibleItems.length, activeSection, pathname],
  );

  const filters = useMemo(() => buildInboxFilters(projects), [projects]);

  const tableState = useUnifiedTableState({
    entityKey: "assignment-inbox",
    searchParams,
    pathname,
    router,
    defaults: {
      view: "table",
      allowedViews: ["table"],
      page: 1,
      perPage: 50,
      search: "",
      sortBy: "occurredAt",
      sortDirection: "desc",
      visibleColumns: INBOX_DEFAULT_VISIBLE_COLUMNS,
      filters: (() => {
        const f: Record<string, FilterValue> = {};
        const type = searchParams?.get("type");
        if (type) f.type = type.split(",");
        const suggestion = searchParams?.get("suggestion");
        if (suggestion) f.suggestion = suggestion;
        const suggestedProject = searchParams?.get("suggested_project");
        if (suggestedProject) f.suggested_project = suggestedProject;
        const reviewStatus = searchParams?.get("review_status");
        if (reviewStatus) f.review_status = reviewStatus;
        return f;
      })(),
    },
  });

  const af = tableState.activeFilters;

  const filteredItems = useMemo(() => {
    let result = visibleItems;

    const typeFilter = af.type;
    if (Array.isArray(typeFilter) && typeFilter.length > 0) {
      result = result.filter((item) => typeFilter.includes(item.contentType));
    }

    if (af.suggestion === "has") {
      result = result.filter((item) => item.suggestedProjectId != null);
    } else if (af.suggestion === "none") {
      result = result.filter((item) => item.suggestedProjectId == null);
    }

    if (typeof af.suggested_project === "string" && af.suggested_project) {
      const target = Number(af.suggested_project);
      result = result.filter((item) => item.suggestedProjectId === target);
    }

    if (typeof af.review_status === "string" && af.review_status) {
      result = result.filter((item) => item.reviewStatus === af.review_status);
    }

    const q = tableState.debouncedSearch.trim().toLowerCase();
    if (q) {
      result = result.filter(
        (item) =>
          item.title.toLowerCase().includes(q) ||
          (item.from ?? "").toLowerCase().includes(q) ||
          (item.preview ?? "").toLowerCase().includes(q) ||
          (item.suggestedProjectName ?? "").toLowerCase().includes(q) ||
          item.evidence.some((entry) => entry.toLowerCase().includes(q)) ||
          item.confidenceReasons.some((entry) => entry.toLowerCase().includes(q)) ||
          item.alternativeProjects.some((project) =>
            (project.projectName ?? "").toLowerCase().includes(q),
          ),
      );
    }

    return result;
  }, [visibleItems, af, tableState.debouncedSearch]);

  const sortedItems = useMemo(() => {
    const dir = tableState.sortDirection === "asc" ? 1 : -1;
    return [...filteredItems].sort((a, b) => {
      if (tableState.sortBy === "title") {
        return a.title.localeCompare(b.title) * dir;
      }
      const at = a.occurredAt ? Date.parse(a.occurredAt) : 0;
      const bt = b.occurredAt ? Date.parse(b.occurredAt) : 0;
      return (at - bt) * dir;
    });
  }, [filteredItems, tableState.sortBy, tableState.sortDirection]);

  const totalPages = Math.max(
    1,
    Math.ceil(sortedItems.length / tableState.perPage),
  );
  const paginatedItems = useMemo(() => {
    const start = (tableState.page - 1) * tableState.perPage;
    return sortedItems.slice(start, start + tableState.perPage);
  }, [sortedItems, tableState.page, tableState.perPage]);

  const handleFilterChange = useCallback(
    (next: Record<string, unknown>) => {
      tableState.setActiveFilters(next as Record<string, FilterValue>);
      tableState.setSearchParams(
        Object.fromEntries(
          Object.entries(next).map(([k, v]) => [
            k,
            Array.isArray(v) ? v.join(",") : v == null ? null : String(v),
          ]),
        ),
      );
      tableState.setPage(1);
    },
    [tableState],
  );

  const handleSelectAll = useCallback(
    (checked: boolean) => {
      setSelectedIds(checked ? paginatedItems.map((item) => item.rowKey) : []);
    },
    [paginatedItems],
  );

  const handleSelectRow = useCallback((id: string, checked: boolean) => {
    setSelectedIds((prev) =>
      checked ? [...prev, id] : prev.filter((rowId) => rowId !== id),
    );
  }, []);

  const selectedWithSuggestions = useMemo(
    () =>
      visibleItems.filter(
        (item) =>
          selectedIds.includes(item.rowKey) && item.suggestedProjectId != null,
      ),
    [visibleItems, selectedIds],
  );

  const handleBulkAcceptSuggestions = useCallback(async () => {
    if (selectedWithSuggestions.length === 0) return;
    const results = await Promise.allSettled(
      selectedWithSuggestions.map((item) =>
        assignItem(item, item.suggestedProjectId as number),
      ),
    );
    const accepted = results.filter(
      (result) => result.status === "fulfilled" && result.value,
    ).length;
    if (accepted > 0) {
      toast.success(`Accepted ${accepted} AI suggestion${accepted === 1 ? "" : "s"}`);
    }
    if (accepted < selectedWithSuggestions.length) {
      toast.error(
        `${selectedWithSuggestions.length - accepted} suggestion(s) could not be applied`,
      );
    }
  }, [selectedWithSuggestions, assignItem]);

  const tableColumns = useMemo<TableColumn<InboxItem>[]>(() => {
    const col = (id: string) =>
      INBOX_COLUMNS.find((column) => column.id === id) ?? { id, label: id };

    return [
      {
        ...col("type"),
        render: (item) => (
          <StatusBadge
            status={CONTENT_TYPE_META[item.contentType].label}
            variant="neutral"
          />
        ),
        sortable: false,
        width: 110,
      },
      {
        ...col("title"),
        render: (item) => (
          <div className="min-w-0">
            <div className="truncate font-medium text-foreground">
              {item.title}
            </div>
            {item.preview ? (
              <div className="truncate text-xs text-muted-foreground">
                {item.preview}
              </div>
            ) : null}
          </div>
        ),
        sortable: true,
        sortValue: (item) => item.title,
        width: 360,
      },
      {
        ...col("from"),
        render: (item) => (
          <span className="truncate text-sm text-muted-foreground">
            {item.from ?? "—"}
          </span>
        ),
        sortable: false,
        width: 200,
      },
      {
        ...col("occurredAt"),
        render: (item) => <TableDateValue value={item.occurredAt} />,
        sortable: true,
        sortValue: (item) => (item.occurredAt ? Date.parse(item.occurredAt) : null),
        width: 130,
      },
      {
        ...col("suggestion"),
        render: (item) => {
          const confidence = formatConfidence(item.suggestedConfidence);
          if (item.reviewStatus === "undefined" && item.alternativeProjects.length === 0) {
            return (
              <div className="space-y-1 text-sm">
                <StatusBadge status="Undefined" variant="neutral" />
                <div className="text-xs text-muted-foreground">
                  {item.suggestionReason ?? "No project signal found in this chain."}
                </div>
              </div>
            );
          }

          const badge =
            item.reviewStatus === "suggested"
              ? {
                  label: "Suggested",
                  variant: confidenceStatus(item.suggestedConfidence),
                }
              : item.reviewStatus === "manual_review"
                ? { label: "Manual review", variant: "warning" as const }
                : { label: "Undefined", variant: "neutral" as const };
          const primaryProject =
            item.suggestedProjectName ??
            item.alternativeProjects[0]?.projectName ??
            (item.suggestedProjectId != null
              ? projectNameById.get(item.suggestedProjectId)
              : null);

          return (
            <div className="min-w-0 space-y-1.5" title={item.suggestionReason ?? undefined}>
              <div className="flex flex-wrap items-center gap-2">
                {item.reviewStatus === "suggested" ? (
                  <Sparkles className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                ) : (
                  <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-status-warning" />
                )}
                <StatusBadge status={badge.label} variant={badge.variant} />
                {primaryProject ? (
                  <span className="truncate text-sm font-medium">
                    {primaryProject}
                  </span>
                ) : null}
                {confidence ? (
                  <StatusBadge
                    status={confidence}
                    variant={confidenceStatus(item.suggestedConfidence)}
                  />
                ) : null}
                {item.reviewStatus === "suggested" ? (
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 px-2"
                    disabled={savingKeys.has(item.rowKey)}
                    onClick={(event) => {
                      event.stopPropagation();
                      void handleAcceptSuggestion(item);
                    }}
                  >
                    <Check className="mr-1 h-3.5 w-3.5" />
                    Accept
                  </Button>
                ) : null}
              </div>
              <div className="text-xs text-muted-foreground">
                {item.chainMessageCount > 1
                  ? `${item.chainMessageCount}-message chain`
                  : "Single message"}
                {item.suggestionReason ? ` • ${item.suggestionReason}` : ""}
              </div>
              {item.evidence.length > 0 ? (
                <div className="space-y-0.5 text-xs text-muted-foreground">
                  {item.evidence.slice(0, 2).map((entry) => (
                    <div key={entry} className="truncate">
                      {entry}
                    </div>
                  ))}
                </div>
              ) : null}
              {item.confidenceReasons.length > 0 ? (
                <div className="truncate text-xs text-muted-foreground">
                  {item.confidenceReasons[0]}
                </div>
              ) : null}
              {item.reviewStatus !== "suggested" && item.alternativeProjects.length > 0 ? (
                <div className="truncate text-xs text-muted-foreground">
                  Top candidates:{" "}
                  {item.alternativeProjects
                    .slice(0, 2)
                    .map((project) => project.projectName ?? `Project ${project.projectId}`)
                    .join(", ")}
                </div>
              ) : null}
            </div>
          );
        },
        sortable: false,
        width: 320,
      },
      {
        ...col("assign"),
        render: (item) => (
          <Select
            value=""
            disabled={savingKeys.has(item.rowKey)}
            onValueChange={(value) =>
              void handleManualAssign(item, parseInt(value, 10))
            }
          >
            <SelectTrigger
              className={cn(
                "h-8 w-full max-w-56 border-0 bg-transparent px-1.5 text-sm shadow-none",
                "hover:bg-muted/60 focus:ring-0 data-[state=open]:bg-muted/60",
              )}
              onClick={(event) => event.stopPropagation()}
            >
              <SelectValue>
                <span className="italic text-muted-foreground/50">
                  Select project…
                </span>
              </SelectValue>
            </SelectTrigger>
            <SelectContent className="max-h-72">
              {projects.map((project) => (
                <SelectItem key={project.id} value={String(project.id)}>
                  {project.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ),
        sortable: false,
        width: 240,
      },
    ];
  }, [
    projects,
    projectNameById,
    savingKeys,
    handleAcceptSuggestion,
    handleManualAssign,
  ]);

  if (activeSection === "rules") {
    return <AssignmentInboxRulesPanel active tabs={tabs} />;
  }

  return (
    <UnifiedTablePage<InboxItem>
      header={{
        title: "Project Assignment",
        description: `${totalUnassigned.toLocaleString()} unassigned ${
          totalUnassigned === 1 ? "item" : "items"
        } (${items.length.toLocaleString()} loaded). Assign meetings, emails, Teams messages, and documents to the right project, then use the rules tab to inspect the logic shaping future matches.`,
      }}
      tabs={tabs}
      layout={{ fullBleedTable: true }}
      toolbar={{
        totalItems: visibleItems.length,
        filteredItems: filteredItems.length,
        selectedCount: selectedIds.length,
        searchValue: tableState.searchInput,
        onSearchChange: tableState.setSearchInput,
        searchPlaceholder: "Search by title, sender, content…",
        currentView: tableState.currentView,
        onViewChange: (view) => {
          tableState.setCurrentView(view);
          tableState.setSearchParams({ view });
        },
        filters,
        activeFilters: af,
        onFilterChange: handleFilterChange,
        onClearFilters: () => handleFilterChange({}),
        columns: INBOX_COLUMNS,
        visibleColumns: tableState.visibleColumns,
        onColumnVisibilityChange: tableState.setVisibleColumns,
        customActions: (
          <>
            {selectedWithSuggestions.length > 0 ? (
              <Button
                variant="outline"
                size="sm"
                className="h-8"
                onClick={() => void handleBulkAcceptSuggestions()}
              >
                <Sparkles className="mr-1.5 h-3.5 w-3.5" />
                Accept {selectedWithSuggestions.length} suggestion
                {selectedWithSuggestions.length === 1 ? "" : "s"}
              </Button>
            ) : null}
            {hasMore ? (
              <Button
                variant="outline"
                size="sm"
                className="h-8"
                disabled={loadingMore}
                onClick={() => void handleLoadMore()}
              >
                {loadingMore ? "Loading…" : "Load more"}
              </Button>
            ) : null}
          </>
        ),
      }}
      data={{
        items: paginatedItems,
        isLoading: false,
        isFetching: false,
        error: errorMessage ? new Error(errorMessage) : null,
      }}
      table={{
        columns: tableColumns,
        getRowId: (item) => item.rowKey,
      }}
      sorting={{
        sortBy: tableState.sortBy,
        sortDirection: tableState.sortDirection,
        onSortChange: (column, direction) => {
          tableState.setSortBy(column);
          tableState.setSortDirection(direction);
          tableState.setPage(1);
        },
      }}
      selection={{
        selectedIds,
        onSelectAll: handleSelectAll,
        onSelectRow: handleSelectRow,
      }}
      emptyState={{
        title: "Inbox zero",
        description:
          "Every meeting, email, Teams message, and document has been assigned to a project. New unassigned items will appear here as they sync.",
        filteredDescription: "Try adjusting your search or filters.",
        isFiltered:
          !!tableState.debouncedSearch ||
          Object.keys(af).length > 0,
      }}
      pagination={{
        page: tableState.page,
        totalPages,
        perPage: tableState.perPage,
        onPageChange: (page) => {
          tableState.setPage(page);
          tableState.setSearchParams({ page: String(page) });
        },
        onPerPageChange: (perPage) => {
          tableState.setPerPage(Number(perPage));
          tableState.setPage(1);
        },
      }}
    />
  );
}
