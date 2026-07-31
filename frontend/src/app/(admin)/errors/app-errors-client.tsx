"use client";

import { useCallback, useMemo, useState, useTransition } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import {
  ArrowRight,
  Copy,
  FileText,
  Loader2,
  Send,
} from "lucide-react";
import { toast } from "sonner";
import { ErrorState } from "@/components/ds";
import { StatusBadge } from "@/components/ds/status-badge";
import {
  UnifiedTablePage,
  useUnifiedTableState,
  TableRowActionsMenu,
  type FilterValue,
  type TableColumn,
} from "@/components/tables/unified";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import type {
  AppErrorClassification,
  AppErrorEventForPacket,
} from "@/lib/app-error-classification";
import { apiFetch } from "@/lib/api-client";

import {
  appErrorColumnConfig,
  appErrorDefaultVisibleColumns,
  appErrorFilters,
} from "@/features/app-errors/app-errors-table-config";

type ErrorStatus = "new" | "triaged" | "in_progress" | "fixed" | "ignored" | "needs_human";

export interface AppErrorGroupRow {
  id: string;
  created_at: string;
  first_seen_at: string;
  last_seen_at: string;
  signature: string;
  source: string;
  severity: string;
  status: string;
  event_count: number;
  affected_user_count: number;
  affected_project_count: number;
  latest_message: string;
  latest_route: string | null;
  latest_action: string | null;
  latest_error_code: string | null;
  latest_request_id: string | null;
  latest_user_id: string | null;
  latest_project_id: number | null;
  linear_issue_id: string | null;
  linear_issue_url: string | null;
}

interface AppErrorsClientProps {
  rows: AppErrorGroupRow[];
  loadError: string | null;
}

interface AppErrorGroupDetail {
  group: AppErrorGroupRow;
  events: AppErrorEventForPacket[];
  classification: AppErrorClassification;
  fixPacket: string;
}

interface CreateLinearIssueResponse {
  group: AppErrorGroupRow;
  issue: {
    identifier: string;
    url: string;
    created: boolean;
  };
}

const STATUS_OPTIONS: { value: ErrorStatus; label: string }[] = [
  { value: "new", label: "New" },
  { value: "triaged", label: "Triaged" },
  { value: "in_progress", label: "In Progress" },
  { value: "needs_human", label: "Needs Human" },
  { value: "fixed", label: "Fixed" },
  { value: "ignored", label: "Ignored" },
];

function relativeTime(value: string): string {
  const diffMs = Date.now() - new Date(value).getTime();
  const minutes = Math.floor(diffMs / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export function AppErrorsClient({ rows, loadError }: AppErrorsClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const pathname = usePathname();

  const [items, setItems] = useState(rows);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
  const [detail, setDetail] = useState<AppErrorGroupDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [linearIssueId, setLinearIssueId] = useState("");
  const [linearIssueUrl, setLinearIssueUrl] = useState("");
  const [linearCreating, setLinearCreating] = useState(false);
  const [isPending, startTransition] = useTransition();

  const tableState = useUnifiedTableState({
    entityKey: "app-errors",
    searchParams,
    pathname,
    router,
    defaults: {
      view: "table",
      allowedViews: ["table"],
      page: 1,
      perPage: 50,
      search: "",
      sortBy: "last_seen",
      sortDirection: "desc",
      visibleColumns: appErrorDefaultVisibleColumns,
      filters: { status: "active", severity: undefined, source: undefined },
    },
  });

  const activeFilters = useMemo<Record<string, FilterValue>>(
    () => ({
      status: searchParams?.get("status") || "active",
      severity: searchParams?.get("severity") || undefined,
      source: searchParams?.get("source") || undefined,
    }),
    [searchParams],
  );

  const hasActiveFilters = Boolean(
    (activeFilters.status && activeFilters.status !== "active") ||
      activeFilters.severity ||
      activeFilters.source,
  );

  const filtered = useMemo(() => {
    const q = tableState.debouncedSearch.trim().toLowerCase();
    const statusFilter = activeFilters.status as string | undefined;
    const severityFilter = activeFilters.severity as string | undefined;
    const sourceFilter = activeFilters.source as string | undefined;

    return items.filter((item) => {
      const statusMatches =
        !statusFilter ||
        statusFilter === "all" ||
        (statusFilter === "active"
          ? !["fixed", "ignored"].includes(item.status)
          : item.status === statusFilter);

      if (!statusMatches) return false;
      if (severityFilter && item.severity !== severityFilter) return false;
      if (sourceFilter && item.source !== sourceFilter) return false;

      if (!q) return true;
      return [
        item.latest_message,
        item.latest_route,
        item.latest_action,
        item.latest_error_code,
        item.latest_request_id,
        item.signature,
      ]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(q));
    });
  }, [items, tableState.debouncedSearch, activeFilters]);

  const sortedItems = useMemo(() => {
    const { sortBy, sortDirection } = tableState;
    const dir = sortDirection === "asc" ? 1 : -1;
    return [...filtered].sort((a, b) => {
      if (sortBy === "events") return dir * (a.event_count - b.event_count);
      if (sortBy === "last_seen")
        return dir * (new Date(a.last_seen_at).getTime() - new Date(b.last_seen_at).getTime());
      if (sortBy === "severity") return dir * a.severity.localeCompare(b.severity);
      if (sortBy === "status") return dir * a.status.localeCompare(b.status);
      if (sortBy === "route") return dir * (a.latest_route ?? "").localeCompare(b.latest_route ?? "");
      return 0;
    });
  }, [filtered, tableState]);

  const paginatedItems = useMemo(() => {
    const start = (tableState.page - 1) * tableState.perPage;
    return sortedItems.slice(start, start + tableState.perPage);
  }, [sortedItems, tableState.page, tableState.perPage]);

  const totalPages = Math.max(1, Math.ceil(sortedItems.length / tableState.perPage));


  function handleFilterChange(updates: Record<string, FilterValue>) {
    const merged = { ...activeFilters, ...updates };
    tableState.setSearchParams(
      Object.fromEntries(
        Object.entries(merged).filter(([, v]) => v !== undefined && v !== ""),
      ) as Record<string, string>,
    );
    tableState.setPage(1);
  }

  function handleSelectAll(allIds: string[]) {
    tableState.setSelectedIds(
      tableState.selectedIds.length === allIds.length ? [] : allIds,
    );
  }

  function handleSelectRow(id: string) {
    tableState.setSelectedIds(
      tableState.selectedIds.includes(id)
        ? tableState.selectedIds.filter((i) => i !== id)
        : [...tableState.selectedIds, id],
    );
  }

  const refreshItem = useCallback((group: AppErrorGroupRow) => {
    setItems((current) =>
      current.map((item) => (item.id === group.id ? { ...item, ...group } : item)),
    );
    setDetail((current) => (current?.group.id === group.id ? { ...current, group } : current));
  }, []);

  const updateStatus = useCallback((id: string, status: ErrorStatus) => {
    setPendingId(id);
    startTransition(() => {
      apiFetch<{ group: AppErrorGroupRow }>(`/api/admin/app-errors/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ status }),
      })
        .then(({ group }) => {
          refreshItem(group);
          toast.success("Error status updated");
        })
        .catch((error) => {
          toast.error("Failed to update error status");
        })
        .finally(() => setPendingId(null));
    });
  }, [refreshItem]);

  function openDetails(id: string) {
    setSelectedGroupId(id);
    setDetailLoading(true);
    apiFetch<AppErrorGroupDetail>(`/api/admin/app-errors/${id}`)
      .then((payload) => {
        setDetail(payload);
        setLinearIssueId(payload.group.linear_issue_id ?? "");
        setLinearIssueUrl(payload.group.linear_issue_url ?? "");
      })
      .catch((error) => {
        toast.error("Failed to load error details");
      })
      .finally(() => setDetailLoading(false));
  }

  function closeDetails(open: boolean) {
    if (open) return;
    setSelectedGroupId(null);
    setDetail(null);
    setDetailLoading(false);
  }

  function copyFixPacket() {
    if (!detail?.fixPacket) return;
    navigator.clipboard
      .writeText(detail.fixPacket)
      .then(() => toast.success("Fix packet copied"))
      .catch(() => toast.error("Unable to copy fix packet"));
  }

  function saveLinearLink() {
    if (!detail) return;
    setPendingId(detail.group.id);
    apiFetch<{ group: AppErrorGroupRow }>(`/api/admin/app-errors/${detail.group.id}`, {
      method: "PATCH",
      body: JSON.stringify({
        linearIssueId: linearIssueId.trim() || null,
        linearIssueUrl: linearIssueUrl.trim() || null,
      }),
    })
      .then(({ group }) => {
        refreshItem(group);
        toast.success("Linear link saved");
      })
      .catch((error) => {
        toast.error("Failed to save Linear link");
      })
      .finally(() => setPendingId(null));
  }

  function createLinearIssue() {
    if (!detail) return;
    setLinearCreating(true);
    apiFetch<CreateLinearIssueResponse>(`/api/admin/app-errors/${detail.group.id}`, {
      method: "POST",
    })
      .then(({ group, issue }) => {
        refreshItem(group);
        setLinearIssueId(group.linear_issue_id ?? issue.identifier);
        setLinearIssueUrl(group.linear_issue_url ?? issue.url);
        toast.success(issue.created ? `Created ${issue.identifier}` : `${issue.identifier} is already linked`);
      })
      .catch((error) => {
        toast.error("Failed to create Linear issue");
      })
      .finally(() => setLinearCreating(false));
  }

  const tableColumns: TableColumn<AppErrorGroupRow>[] = useMemo(
    () => [
      {
        id: "severity",
        label: "Severity",
        alwaysVisible: true,
        sortable: true,
        sortValue: (item) => item.severity,
        render: (item) => <StatusBadge status={item.severity} />,
        csvValue: (item) => item.severity,
      },
      {
        id: "source",
        label: "Source",
        defaultVisible: true,
        sortable: true,
        sortValue: (item) => item.source,
        render: (item) => (
          <Badge variant="outline" className="capitalize">{item.source}</Badge>
        ),
        csvValue: (item) => item.source,
      },
      {
        id: "message",
        label: "Message",
        alwaysVisible: true,
        sortable: false,
        render: (item) => (
          <span className="text-sm text-foreground line-clamp-1">{item.latest_message}</span>
        ),
        csvValue: (item) => item.latest_message,
      },
      {
        id: "route",
        label: "Route",
        defaultVisible: true,
        sortable: true,
        sortValue: (item) => item.latest_route ?? "",
        render: (item) => (
          <span className="truncate font-mono text-xs text-muted-foreground">
            {item.latest_route ?? "-"}
          </span>
        ),
        csvValue: (item) => item.latest_route ?? "",
      },
      {
        id: "events",
        label: "Events",
        defaultVisible: true,
        sortable: true,
        sortValue: (item) => item.event_count,
        render: (item) => (
          <span className="tabular-nums font-medium">{item.event_count}</span>
        ),
        csvValue: (item) => String(item.event_count),
      },
      {
        id: "last_seen",
        label: "Last Seen",
        defaultVisible: true,
        sortable: true,
        sortValue: (item) => new Date(item.last_seen_at).getTime(),
        render: (item) => (
          <span className="text-sm text-muted-foreground">{relativeTime(item.last_seen_at)}</span>
        ),
        csvValue: (item) => item.last_seen_at,
      },
      {
        id: "status",
        label: "Status",
        defaultVisible: true,
        sortable: true,
        sortValue: (item) => item.status,
        render: (item) => (
          <DropdownMenu>
            <DropdownMenuTrigger
              disabled={isPending && pendingId === item.id}
              className="cursor-pointer"
              asChild
            >
              <span>
                <StatusBadge status={item.status} />
              </span>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuRadioGroup
                value={item.status}
                onValueChange={(value) => updateStatus(item.id, value as ErrorStatus)}
              >
                {STATUS_OPTIONS.map((s) => (
                  <DropdownMenuRadioItem key={s.value} value={s.value}>
                    {s.label}
                  </DropdownMenuRadioItem>
                ))}
              </DropdownMenuRadioGroup>
            </DropdownMenuContent>
          </DropdownMenu>
        ),
        csvValue: (item) => item.status,
      },
    ],
    [isPending, pendingId, updateStatus],
  );

  if (loadError) {
    return (
      <ErrorState title="Unable to load application errors" description={loadError} />
    );
  }

  return (
    <>

      <UnifiedTablePage
        header={{
          title: "Application Errors",
          description: "Grouped runtime failures captured from browser, API, and server guardrails.",
        }}
        toolbar={{
          totalItems: items.length,
          filteredItems: filtered.length,
          selectedCount: tableState.selectedIds.length,
          searchValue: tableState.searchInput,
          onSearchChange: tableState.setSearchInput,
          searchPlaceholder: "Search route, message, request ID, or signature…",
          currentView: tableState.currentView,
          onViewChange: (view) => {
            tableState.setCurrentView(view);
            tableState.setSearchParams({ view });
          },
          filters: appErrorFilters,
          activeFilters,
          onFilterChange: handleFilterChange,
          onClearFilters: () =>
            handleFilterChange({ status: "active", severity: undefined, source: undefined }),
          columns: appErrorColumnConfig,
          visibleColumns: tableState.visibleColumns,
          onColumnVisibilityChange: tableState.setVisibleColumns,
        }}
        data={{
          items: paginatedItems,
          isLoading: false,
          isFetching: false,
          error: null,
        }}
        table={{
          columns: tableColumns,
          getRowId: (item) => item.id,
          onRowClick: (item) => openDetails(item.id),
          activeRowId: selectedGroupId,
          stickyHeader: true,
          rowActions: (item) => (
            <TableRowActionsMenu
              items={[
                {
                  key: "view",
                  label: "View details",
                  icon: FileText,
                  onSelect: () => openDetails(item.id),
                },
                ...(item.linear_issue_url
                  ? [
                      {
                        key: "linear",
                        label: "Open Linear issue",
                        icon: ArrowRight,
                        onSelect: () => window.open(item.linear_issue_url ?? "", "_blank"),
                      },
                    ]
                  : []),
              ]}
            />
          ),
        }}
        sorting={{
          sortBy: tableState.sortBy,
          sortDirection: tableState.sortDirection,
          onSortChange: (col) => tableState.setSortBy(col),
        }}
        selection={{
          selectedIds: tableState.selectedIds,
          onSelectAll: () => handleSelectAll(paginatedItems.map((i) => i.id)),
          onSelectRow: handleSelectRow,
        }}
        emptyState={{
          title: "No matching error groups",
          description: "Captured application failures will appear here once they are grouped.",
          filteredDescription: "No error groups match your current filters.",
          isFiltered: Boolean(tableState.debouncedSearch) || hasActiveFilters,
        }}
        pagination={{
          page: tableState.page,
          totalPages,
          perPage: tableState.perPage,
          onPageChange: tableState.setPage,
          onPerPageChange: (val) => tableState.setPerPage(Number(val)),
        }}
        layout={{ fullBleedTable: true }}
        features={{
          enableSearch: true,
          enableFilters: true,
          enableColumnToggle: true,
          enableExport: true,
          enableBulkDelete: false,
          enableRowSelection: true,
          enableRowActions: true,
        }}
      />

      <Sheet open={Boolean(selectedGroupId)} onOpenChange={closeDetails}>
        <SheetContent className="overflow-y-auto sm:max-w-none lg:w-1/2">
          <SheetHeader>
            <SheetTitle>Error Detail</SheetTitle>
            <SheetDescription>
              Recent events, classification, and a copy-ready Linear/Codex fix packet.
            </SheetDescription>
          </SheetHeader>

          {detailLoading ? (
            <div className="flex items-center gap-2 px-8 py-6 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading error details
            </div>
          ) : detail ? (
            <div className="space-y-6 px-8 pb-8">
              <section className="space-y-3">
                <div className="flex flex-wrap items-center gap-2">
                  <StatusBadge status={detail.group.severity} />
                  <Badge variant="outline" className="capitalize">
                    {detail.group.source}
                  </Badge>
                  <Badge variant="outline">{detail.classification.category}</Badge>
                </div>
                <p className="text-sm font-medium text-foreground">
                  {detail.group.latest_message}
                </p>
                <div className="grid gap-3 text-xs text-muted-foreground sm:grid-cols-2">
                  <DetailValue label="Route" value={detail.group.latest_route} />
                  <DetailValue label="Action" value={detail.group.latest_action} />
                  <DetailValue label="Request ID" value={detail.group.latest_request_id} />
                  <DetailValue label="Signature" value={detail.group.signature} />
                </div>
              </section>

              <section className="grid gap-3 sm:grid-cols-3">
                <MiniTile label="Events" value={detail.group.event_count} />
                <MiniTile label="Users" value={detail.group.affected_user_count} />
                <MiniTile label="Projects" value={detail.group.affected_project_count} />
              </section>

              <section className="space-y-3">
                <h3 className="text-sm font-semibold text-foreground">Diagnosis</h3>
                <div className="space-y-3 text-sm">
                  <DiagnosisRow label="Likely owner" value={detail.classification.likelyOwner} />
                  <DiagnosisRow label="Likely cause" value={detail.classification.likelyCause} />
                  <DiagnosisRow label="Detection gap" value={detail.classification.detectionGap} />
                  <DiagnosisRow
                    label="Prevention step"
                    value={detail.classification.preventionStep}
                  />
                  <DiagnosisRow
                    label="Verification"
                    value={detail.classification.suggestedVerification}
                  />
                </div>
              </section>

              <section className="space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <h3 className="text-sm font-semibold text-foreground">Fix Packet</h3>
                  <Button size="sm" variant="outline" onClick={copyFixPacket}>
                    <Copy className="h-3.5 w-3.5" />
                    Copy
                  </Button>
                </div>
                <Textarea readOnly value={detail.fixPacket} className="min-h-64 font-mono text-xs" />
              </section>

              <section className="space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <h3 className="text-sm font-semibold text-foreground">Linear Link</h3>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={createLinearIssue}
                    disabled={linearCreating || Boolean(detail.group.linear_issue_url)}
                  >
                    {linearCreating ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Send className="h-3.5 w-3.5" />
                    )}
                    Create Issue
                  </Button>
                </div>
                <div className="grid gap-3 sm:grid-cols-[160px_1fr_auto]">
                  <Input
                    value={linearIssueId}
                    onChange={(e) => setLinearIssueId(e.target.value)}
                    placeholder="AAI-123"
                  />
                  <Input
                    value={linearIssueUrl}
                    onChange={(e) => setLinearIssueUrl(e.target.value)}
                    placeholder="https://linear.app/…"
                  />
                  <Button
                    variant="outline"
                    onClick={saveLinearLink}
                    disabled={pendingId === detail.group.id}
                  >
                    {pendingId === detail.group.id ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : null}
                    Save
                  </Button>
                </div>
              </section>

              <section className="space-y-3">
                <h3 className="text-sm font-semibold text-foreground">Recent Events</h3>
                <div className="divide-y divide-border">
                  {detail.events.map((event) => (
                    <div key={event.id} className="space-y-2 p-3 text-xs">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="font-medium text-foreground">
                          {new Date(event.created_at).toLocaleString()}
                        </span>
                        <span className="font-mono text-muted-foreground">
                          {event.request_id ?? event.id}
                        </span>
                      </div>
                      <p className="text-muted-foreground">
                        {event.route ?? event.page_path ?? "Unknown route"} ·{" "}
                        {event.action ?? "Unknown action"}
                      </p>
                      {event.stack ? (
                        <pre className="max-h-32 overflow-auto whitespace-pre-wrap rounded bg-muted p-2 font-mono text-[11px] text-muted-foreground">
                          {event.stack}
                        </pre>
                      ) : null}
                    </div>
                  ))}
                </div>
              </section>
            </div>
          ) : (
            <div className="px-8 py-6 text-sm text-muted-foreground">
              Select an error group to see details.
            </div>
          )}
        </SheetContent>
      </Sheet>
    </>
  );
}

function MiniTile({ label, value }: { label: string; value: number }) {
  return (
    <div className="space-y-1 rounded-md bg-muted px-4 py-3">
      <p className="text-xs font-medium uppercase text-muted-foreground">{label}</p>
      <p className="text-2xl font-semibold tabular-nums text-foreground">{value}</p>
    </div>
  );
}

function DetailValue({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="min-w-0 space-y-1">
      <p className="font-medium uppercase text-muted-foreground">{label}</p>
      <p className="truncate font-mono text-foreground">{value ?? "-"}</p>
    </div>
  );
}

function DiagnosisRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="space-y-1">
      <p className="text-xs font-medium uppercase text-muted-foreground">{label}</p>
      <p className="text-foreground">{value}</p>
    </div>
  );
}
