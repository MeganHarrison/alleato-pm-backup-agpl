"use client";

import * as React from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { RefreshCw } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  UnifiedTablePage,
  useUnifiedTableState,
  type FilterValue,
} from "@/components/tables/unified";

import {
  DB_INVENTORY,
  type DbInventoryTable,
} from "@/components/dev-tools/db-inventory.generated";
import {
  buildDbInventoryTableColumns,
  dbInventoryDefaultVisibleColumns,
  dbInventoryFilters,
} from "@/features/database-inventory/db-inventory-table-config";
import { DbInventoryDetailPanel } from "@/features/database-inventory/db-inventory-detail-panel";
import { apiFetch } from "@/lib/api-client";

const EMPTY_FILTERS: Record<string, FilterValue> = {
  db: undefined,
  domain: undefined,
  status: undefined,
  owner: undefined,
  hasGotchas: undefined,
};

// ─── Refresh response type ────────────────────────────────────────────────────

interface RefreshUpdate {
  name: string;
  db: "MAIN" | "RAG";
  approxRows: number;
  totalSize: string;
  lastAutoanalyze: string | null;
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function DatabaseInventoryPage() {
  const pathname = usePathname()!;
  const router = useRouter();
  const searchParams = useSearchParams();

  // ─── Overlay row counts from the live refresh API (merges with static data) ──
  const [liveOverrides, setLiveOverrides] = React.useState<Map<string, RefreshUpdate>>(new Map());
  const [isRefreshing, setIsRefreshing] = React.useState(false);
  const [selectedTable, setSelectedTable] = React.useState<DbInventoryTable | null>(null);

  // Merge static inventory with any live overrides
  const tables = React.useMemo<DbInventoryTable[]>(() => {
    if (liveOverrides.size === 0) return DB_INVENTORY.tables;
    return DB_INVENTORY.tables.map((t) => {
      const override = liveOverrides.get(t.name);
      if (!override) return t;
      return {
        ...t,
        liveStats: {
          ...t.liveStats,
          approxRows: override.approxRows,
          totalSize: override.totalSize,
          lastAutoanalyze: override.lastAutoanalyze,
          refreshedAt: new Date().toISOString(),
        },
      };
    });
  }, [liveOverrides]);

  // ─── Table state ──────────────────────────────────────────────────────────────
  const tableState = useUnifiedTableState({
    entityKey: "db-inventory",
    searchParams,
    pathname,
    router,
    defaults: {
      view: "table",
      allowedViews: ["table"],
      page: 1,
      perPage: 50,
      search: "",
      sortBy: "approxRows",
      sortDirection: "desc",
      visibleColumns: dbInventoryDefaultVisibleColumns,
      filters: EMPTY_FILTERS,
    },
  });

  // ─── Active filters from URL ──────────────────────────────────────────────────
  const activeFilters = React.useMemo<Record<string, FilterValue>>(
    () => ({
      db: searchParams?.get("db") || undefined,
      domain: searchParams?.get("domain") || undefined,
      status: searchParams?.get("status") || undefined,
      owner: searchParams?.get("owner") || undefined,
      hasGotchas: searchParams?.get("hasGotchas") === "true" ? true : undefined,
    }),
    [searchParams],
  );

  const hasActiveFilters =
    Object.values(activeFilters).some(Boolean) || Boolean(tableState.debouncedSearch);

  // ─── Client-side filter + search ─────────────────────────────────────────────
  const filteredTables = React.useMemo(() => {
    const search = tableState.debouncedSearch?.toLowerCase() ?? "";
    return tables.filter((t) => {
      if (activeFilters.db && t.db !== activeFilters.db) return false;
      if (activeFilters.domain && t.domain !== activeFilters.domain) return false;
      if (activeFilters.status && t.status !== activeFilters.status) return false;
      if (activeFilters.owner && t.owner !== activeFilters.owner) return false;
      if (activeFilters.hasGotchas === true && !t.gotchas) return false;
      if (search) {
        const matches =
          t.name.toLowerCase().includes(search) ||
          t.purpose.toLowerCase().includes(search) ||
          (t.gotchas?.toLowerCase().includes(search) ?? false) ||
          t.domain.toLowerCase().includes(search) ||
          t.owner.toLowerCase().includes(search);
        if (!matches) return false;
      }
      return true;
    });
  }, [tables, activeFilters, tableState.debouncedSearch]);

  // ─── Filter change handler ────────────────────────────────────────────────────
  const handleFilterChange = React.useCallback(
    (updates: Record<string, FilterValue>) => {
      const merged = { ...activeFilters, ...updates };
      const params: Record<string, string> = {};
      if (merged.db) params.db = String(merged.db);
      if (merged.domain) params.domain = String(merged.domain);
      if (merged.status) params.status = String(merged.status);
      if (merged.owner) params.owner = String(merged.owner);
      if (merged.hasGotchas) params.hasGotchas = "true";
      tableState.setSearchParams(params);
    },
    [activeFilters, tableState],
  );

  // ─── Refresh row counts ───────────────────────────────────────────────────────
  const handleRefresh = React.useCallback(async () => {
    setIsRefreshing(true);
    try {
      const data = await apiFetch<{ refreshedAt: string; updates: RefreshUpdate[] }>(
        "/api/admin/db-inventory/refresh",
        { method: "POST" },
      );
      const map = new Map<string, RefreshUpdate>();
      for (const update of data.updates) {
        map.set(update.name, update);
      }
      setLiveOverrides(map);
      toast.success(`Refreshed ${data.updates.length} table counts`);
    } catch {
      toast.error("Failed to refresh row counts");
    } finally {
      setIsRefreshing(false);
    }
  }, []);

  // ─── Table columns ────────────────────────────────────────────────────────────
  const tableColumns = React.useMemo(
    () => buildDbInventoryTableColumns((t) => setSelectedTable(t)),
    [],
  );

  // ─── Navigate to related table ────────────────────────────────────────────────
  const handleNavigateToTable = React.useCallback((name: string) => {
    const found = tables.find((t) => t.name === name);
    if (found) setSelectedTable(found);
  }, [tables]);

  // ─── Subtitle ─────────────────────────────────────────────────────────────────
  const subtitle = React.useMemo(() => {
    const total = tables.length;
    const main = tables.filter((t) => t.db === "MAIN").length;
    const rag = tables.filter((t) => t.db === "RAG").length;
    const gen = DB_INVENTORY.generatedAt.startsWith("(stub")
      ? "not yet generated — run npm run db:inventory"
      : `generated ${new Date(DB_INVENTORY.generatedAt).toLocaleDateString()}`;
    return `${total} tables (${main} MAIN · ${rag} RAG) · ${gen}`;
  }, [tables]);

  return (
    <>
      <UnifiedTablePage
        header={{
          title: "Database Inventory",
          description: subtitle,
          actions: (
            <Button
              size="sm"
              variant="outline"
              onClick={() => { void handleRefresh(); }}
              disabled={isRefreshing}
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${isRefreshing ? "animate-spin" : ""}`} />
              Refresh Counts
            </Button>
          ),
        }}
        toolbar={{
          totalItems: tables.length,
          filteredItems: filteredTables.length,
          searchValue: tableState.searchInput,
          onSearchChange: tableState.setSearchInput,
          searchPlaceholder: "Search tables, purpose, gotchas...",
          currentView: tableState.currentView,
          onViewChange: tableState.setCurrentView,
          filters: dbInventoryFilters,
          activeFilters,
          onFilterChange: handleFilterChange,
          onClearFilters: () => handleFilterChange(EMPTY_FILTERS),
        }}
        data={{
          items: filteredTables,
          isLoading: false,
          error: null,
        }}
        table={{
          columns: tableColumns,
          getRowId: (item) => `${item.db}:${item.name}`,
          onRowClick: (item) => setSelectedTable(item),
          stickyHeader: true,
        }}
        emptyState={{
          title: "No tables found",
          description:
            DB_INVENTORY.tables.length === 0
              ? "Run npm run db:inventory to generate the inventory file."
              : "No tables match your search.",
          filteredDescription: "No tables match your current filters.",
          isFiltered: hasActiveFilters,
        }}
        features={{
          enablePagination: true,
        }}
      />

      <DbInventoryDetailPanel
        table={selectedTable}
        onClose={() => setSelectedTable(null)}
        onNavigateToTable={handleNavigateToTable}
      />
    </>
  );
}
