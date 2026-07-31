"use client";

import { useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { UnifiedTablePage, useUnifiedTableState, type FilterValue } from "@/components/tables/unified";
import { PageShell } from "@/components/layout";
import {
  auditLogDefaultVisibleColumns,
  auditLogFilters,
  buildAuditLogTableColumns,
  type AuditLogItem,
} from "@/features/db-audit-log/db-audit-log-table-config";
import { useAuditLogList } from "@/hooks/use-db-audit-log-query";
import { useQueryClient } from "@tanstack/react-query";
import { auditLogKeys } from "@/hooks/use-db-audit-log-query";

const OP_STYLES: Record<string, string> = {
  INSERT: "bg-success/10 text-success border border-success/20",
  UPDATE: "bg-primary/10 text-primary border border-primary/20",
  DELETE: "bg-destructive/10 text-destructive border border-destructive/20",
};

function JsonBlock({ label, data }: { label: string; data: Record<string, unknown> | null }) {
  if (!data) return null;
  return (
    <div className="space-y-1">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <pre className="overflow-x-auto rounded bg-muted p-3 font-mono text-xs leading-relaxed text-foreground">
        {JSON.stringify(data, null, 2)}
      </pre>
    </div>
  );
}

export default function DbAuditLogPage() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const [selected, setSelected] = useState<AuditLogItem | null>(null);

  const tableState = useUnifiedTableState({
    entityKey: "db-audit-log",
    searchParams,
    pathname,
    router,
    defaults: {
      view: "table",
      allowedViews: ["table"],
      page: 1,
      perPage: 50,
      search: "",
      sortBy: "changed_at",
      sortDirection: "desc",
      visibleColumns: auditLogDefaultVisibleColumns,
      filters: { operation: undefined, table_name: undefined },
    },
  });

  const activeFilters = useMemo<Record<string, FilterValue>>(
    () => ({
      operation: searchParams?.get("operation") ?? undefined,
      table_name: searchParams?.get("table_name") ?? undefined,
    }),
    [searchParams],
  );

  const hasActiveFilters = Boolean(activeFilters.operation || activeFilters.table_name);

  const { data, isLoading, error, isFetching } = useAuditLogList({
    page: tableState.page,
    perPage: tableState.perPage,
    search: tableState.debouncedSearch,
    operation: (activeFilters.operation as string) ?? "",
    table_name: (activeFilters.table_name as string) ?? "",
  });

  const items = data?.items ?? [];
  const total = data?.total ?? 0;

  function handleFilterChange(filters: Record<string, FilterValue>) {
    tableState.setActiveFilters(filters);
    tableState.setSearchParams({
      operation: (filters.operation as string) ?? "",
      table_name: (filters.table_name as string) ?? "",
      page: "1",
    });
  }

  function handleRefresh() {
    queryClient.invalidateQueries({ queryKey: auditLogKeys.all });
  }

  const columns = useMemo(() => buildAuditLogTableColumns(), []);

  return (
    <>
      <UnifiedTablePage
        header={{
          title: "Database Audit Log",
          description: "Every INSERT, UPDATE, and DELETE across key business tables.",
          actions: (
            <Button variant="outline" size="sm" onClick={handleRefresh} disabled={isFetching}>
              <RefreshCw className={`h-3.5 w-3.5 ${isFetching ? "animate-spin" : ""}`} />
            </Button>
          ),
        }}
        toolbar={{
          totalItems: total,
          filteredItems: total,
          searchValue: tableState.searchInput,
          onSearchChange: tableState.setSearchInput,
          searchPlaceholder: "Search table or record ID…",
          currentView: tableState.currentView,
          onViewChange: tableState.setCurrentView,
          filters: auditLogFilters,
          activeFilters,
          onFilterChange: handleFilterChange,
          onClearFilters: () =>
            handleFilterChange({ operation: undefined, table_name: undefined }),
        }}
        data={{ items, isLoading, isFetching, error: error ?? undefined }}
        table={{
          columns,
          getRowId: (item) => item.id,
          onRowClick: setSelected,
          stickyHeader: true,
        }}
        pagination={{
          page: tableState.page,
          perPage: tableState.perPage,
          totalPages: Math.max(1, Math.ceil(total / tableState.perPage)),
          onPageChange: (p) => {
            tableState.setPage(p);
            tableState.setSearchParams({ page: String(p) });
          },
          onPerPageChange: (pp) => {
            tableState.setPerPage(Number(pp));
            tableState.setSearchParams({ perPage: pp, page: "1" });
          },
        }}
        emptyState={{
          title: "No audit entries",
          description: "Changes to business entity tables will appear here.",
          filteredDescription: "No entries match the current filters.",
          isFiltered: Boolean(tableState.debouncedSearch) || hasActiveFilters,
        }}
        layout={{ fullBleedTable: true }}
      />

      <Sheet open={Boolean(selected)} onOpenChange={(open) => !open && setSelected(null)}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-xl">
          {selected && (
            <>
              <SheetHeader className="mb-4">
                <SheetTitle className="flex items-center gap-2 text-base">
                  <span
                    className={`inline-flex items-center rounded px-1.5 py-0.5 font-mono text-xs font-medium ${OP_STYLES[selected.operation] ?? ""}`}
                  >
                    {selected.operation}
                  </span>
                  <span className="font-mono text-sm">{selected.table_name}</span>
                </SheetTitle>
              </SheetHeader>

              <div className="space-y-5">
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      When
                    </p>
                    <p className="mt-0.5 text-foreground">
                      {new Date(selected.changed_at).toLocaleString()}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      Actor
                    </p>
                    <p className="mt-0.5 text-foreground">
                      {selected.changed_by_name ?? (
                        <span className="text-muted-foreground">system / cron</span>
                      )}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      Record ID
                    </p>
                    <p className="mt-0.5 break-all font-mono text-xs text-foreground">
                      {selected.record_id}
                    </p>
                  </div>
                  {selected.changed_columns?.length ? (
                    <div>
                      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                        Changed Fields
                      </p>
                      <p className="mt-0.5 font-mono text-xs text-foreground">
                        {selected.changed_columns.join(", ")}
                      </p>
                    </div>
                  ) : null}
                </div>

                {selected.operation === "UPDATE" &&
                  selected.old_data &&
                  selected.new_data && (
                    <div className="space-y-3">
                      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                        Diff
                      </p>
                      {(selected.changed_columns ?? []).map((col) => {
                        const before = selected.old_data?.[col];
                        const after = selected.new_data?.[col];
                        return (
                          <div key={col} className="rounded border p-2 text-xs">
                            <p className="mb-1 font-mono font-medium text-foreground">{col}</p>
                            <div className="grid grid-cols-2 gap-2">
                              <div>
                                <p className="text-muted-foreground">Before</p>
                                <pre className="mt-0.5 break-all whitespace-pre-wrap text-destructive">
                                  {JSON.stringify(before, null, 2)}
                                </pre>
                              </div>
                              <div>
                                <p className="text-muted-foreground">After</p>
                                <pre className="mt-0.5 break-all whitespace-pre-wrap text-success">
                                  {JSON.stringify(after, null, 2)}
                                </pre>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}

                {selected.operation !== "UPDATE" && (
                  <JsonBlock
                    label={selected.operation === "INSERT" ? "New Data" : "Deleted Data"}
                    data={selected.operation === "INSERT" ? selected.new_data : selected.old_data}
                  />
                )}

                {selected.operation === "UPDATE" && (
                  <div className="grid gap-4">
                    <JsonBlock label="Before" data={selected.old_data} />
                    <JsonBlock label="After" data={selected.new_data} />
                  </div>
                )}
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </>
  );
}
