"use client";

import * as React from "react";
import { RefreshCw } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  UnifiedTablePage,
  useUnifiedTableState,
  type FilterValue,
} from "@/components/tables/unified";
import {
  buildDbInventoryTableColumns,
  dbInventoryDefaultVisibleColumns,
  dbInventoryFilters,
} from "@/features/database-inventory/db-inventory-table-config";
import type { SchemaExplorerInventory } from "@/features/database-inventory/schema-explorer.types";
import { apiFetch } from "@/lib/api-client";

const EMPTY_FILTERS: Record<string, FilterValue> = {
  database: undefined,
  ownership: undefined,
  review: undefined,
};
const INVENTORY_ENDPOINT = "/api/admin/db-inventory/refresh";
const DESCRIPTION_ENDPOINT = "/api/admin/db-inventory/descriptions";
const STEWARDSHIP_ENDPOINT = "/api/admin/db-inventory/stewardship";
const REVIEW_STALE_AFTER_DAYS = 90;

export default function DatabaseInventoryPage() {
  const pathname = usePathname()!;
  const router = useRouter();
  const searchParams = useSearchParams();
  const [inventory, setInventory] =
    React.useState<SchemaExplorerInventory | null>(null);
  const [loadError, setLoadError] = React.useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = React.useState(false);
  const [editingMetadataKey, setEditingMetadataKey] = React.useState<
    string | null
  >(null);

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
      sortBy: "name",
      sortDirection: "asc",
      visibleColumns: dbInventoryDefaultVisibleColumns,
      filters: EMPTY_FILTERS,
    },
  });

  const refresh = React.useCallback(async (notify = false) => {
    setIsRefreshing(true);
    setLoadError(null);
    try {
      const nextInventory = await apiFetch<SchemaExplorerInventory>(
        INVENTORY_ENDPOINT,
        { method: "GET" },
      );
      setInventory(nextInventory);
      if (notify)
        toast.success(
          `Loaded ${nextInventory.tables.length} live schema tables`,
        );
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Unable to load live schema metadata.";
      setLoadError(message);
      if (notify) toast.error(message);
    } finally {
      setIsRefreshing(false);
    }
  }, []);

  React.useEffect(() => {
    void refresh();
  }, [refresh]);

  const activeFilters = React.useMemo<Record<string, FilterValue>>(
    () => ({
      database: searchParams?.get("database") || undefined,
      ownership: searchParams?.get("ownership") || undefined,
      review: searchParams?.get("review") || undefined,
    }),
    [searchParams],
  );
  const tables = inventory?.tables ?? [];
  const filteredTables = React.useMemo(() => {
    const search = tableState.debouncedSearch?.toLowerCase() ?? "";
    return tables.filter((table) => {
      if (activeFilters.database && table.database !== activeFilters.database)
        return false;
      if (activeFilters.ownership === "assigned" && !table.ownerName)
        return false;
      if (activeFilters.ownership === "unassigned" && table.ownerName)
        return false;
      const reviewedAt = table.lastReviewedAt
        ? new Date(table.lastReviewedAt).getTime()
        : null;
      const isReviewCurrent =
        reviewedAt !== null &&
        Number.isFinite(reviewedAt) &&
        reviewedAt >=
          Date.now() - REVIEW_STALE_AFTER_DAYS * 24 * 60 * 60 * 1000;
      if (activeFilters.review === "current" && !isReviewCurrent) return false;
      if (activeFilters.review === "needs-review" && isReviewCurrent)
        return false;
      return (
        !search ||
        [
          table.name,
          table.description,
          table.ownerName,
          table.purpose,
          table.primaryKeyColumns.join(" "),
          ...table.foreignKeys.flatMap((foreignKey) => [
            foreignKey.name,
            foreignKey.referencedTable,
            ...foreignKey.columns,
          ]),
        ]
          .join(" ")
          .toLowerCase()
          .includes(search)
      );
    });
  }, [
    activeFilters.database,
    activeFilters.ownership,
    activeFilters.review,
    tableState.debouncedSearch,
    tables,
  ]);
  const hasActiveFilters = Boolean(
    activeFilters.database ||
    activeFilters.ownership ||
    activeFilters.review ||
    tableState.debouncedSearch,
  );

  const handleFilterChange = React.useCallback(
    (updates: Record<string, FilterValue>) => {
      const nextFilters = { ...activeFilters, ...updates };
      tableState.setSearchParams(
        Object.fromEntries(
          Object.entries(nextFilters)
            .filter(([, value]) => Boolean(value))
            .map(([key, value]) => [key, String(value)]),
        ),
      );
    },
    [activeFilters, tableState],
  );

  const handleDescriptionSave = React.useCallback(
    async (
      table: SchemaExplorerInventory["tables"][number],
      description: string,
    ) => {
      try {
        const result = await apiFetch<{ description: string }>(
          DESCRIPTION_ENDPOINT,
          {
            method: "PUT",
            body: JSON.stringify({
              database: table.database,
              tableName: table.name,
              description,
            }),
          },
        );
        setInventory((current) =>
          current
            ? {
                ...current,
                tables: current.tables.map((item) =>
                  item.database === table.database && item.name === table.name
                    ? { ...item, description: result.description }
                    : item,
                ),
              }
            : current,
        );
        return result.description;
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : "The description could not be saved. Refresh and try again.";
        toast.error(message);
        throw error;
      }
    },
    [],
  );

  const updateStewardship = React.useCallback(
    (
      table: SchemaExplorerInventory["tables"][number],
      stewardship: Pick<
        SchemaExplorerInventory["tables"][number],
        "ownerName" | "lastReviewedAt"
      >,
    ) => {
      setInventory((current) =>
        current
          ? {
              ...current,
              tables: current.tables.map((item) =>
                item.database === table.database && item.name === table.name
                  ? { ...item, ...stewardship }
                  : item,
              ),
            }
          : current,
      );
    },
    [],
  );

  const handleOwnerSave = React.useCallback(
    async (
      table: SchemaExplorerInventory["tables"][number],
      ownerName: string,
    ) => {
      try {
        const stewardship = await apiFetch<{
          ownerName: string | null;
          lastReviewedAt: string;
        }>(STEWARDSHIP_ENDPOINT, {
          method: "PUT",
          body: JSON.stringify({
            database: table.database,
            tableName: table.name,
            ownerName,
          }),
        });
        updateStewardship(table, stewardship);
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : "The owner could not be saved. Refresh and try again.";
        toast.error(message);
        throw error;
      }
    },
    [updateStewardship],
  );

  const handleReview = React.useCallback(
    async (table: SchemaExplorerInventory["tables"][number]) => {
      try {
        const stewardship = await apiFetch<{
          ownerName: string | null;
          lastReviewedAt: string;
        }>(STEWARDSHIP_ENDPOINT, {
          method: "POST",
          body: JSON.stringify({
            database: table.database,
            tableName: table.name,
          }),
        });
        updateStewardship(table, stewardship);
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : "The review date could not be saved. Refresh and try again.";
        toast.error(message);
        throw error;
      }
    },
    [updateStewardship],
  );

  const tableColumns = React.useMemo(
    () =>
      buildDbInventoryTableColumns({
        onDescriptionSave: handleDescriptionSave,
        onDescriptionEditingChange: (table, isEditing) => {
          setEditingMetadataKey(
            isEditing ? `${table.database}:${table.name}` : null,
          );
        },
        onOwnerSave: handleOwnerSave,
        onOwnerEditingChange: (table, isEditing) => {
          setEditingMetadataKey(
            isEditing ? `${table.database}:${table.name}` : null,
          );
        },
        onReview: handleReview,
      }),
    [handleDescriptionSave, handleOwnerSave, handleReview],
  );
  const sourceWarning = inventory?.sources.find((source) => !source.available);
  const subtitle = inventory
    ? `Last updated: ${new Date(inventory.generatedAt).toLocaleDateString()}`
    : "Loading live public-schema metadata";

  return (
    <>
      <UnifiedTablePage
        header={{
          title: "Database Inventory",
          description: sourceWarning
            ? `${subtitle}. ${sourceWarning.database} is unavailable: ${sourceWarning.message}`
            : subtitle,
          actions: (
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                void refresh(true);
              }}
              disabled={isRefreshing}
            >
              <RefreshCw
                className={`mr-2 h-4 w-4 ${isRefreshing ? "animate-spin" : ""}`}
              />
              Refresh schema
            </Button>
          ),
        }}
        toolbar={{
          totalItems: tables.length,
          filteredItems: filteredTables.length,
          searchValue: tableState.searchInput,
          onSearchChange: tableState.setSearchInput,
          searchPlaceholder: "Search tables, descriptions, owners, keys...",
          currentView: tableState.currentView,
          onViewChange: tableState.setCurrentView,
          filters: dbInventoryFilters,
          activeFilters,
          onFilterChange: handleFilterChange,
          onClearFilters: () => handleFilterChange(EMPTY_FILTERS),
        }}
        data={{
          items: filteredTables,
          isLoading: !inventory && !loadError,
          error: loadError,
        }}
        table={{
          columns: tableColumns,
          getRowId: (item) => `${item.database}:${item.name}`,
          onRowClick: (item) => {
            if (editingMetadataKey) return;
            router.push(
              `/database-inventory/${encodeURIComponent(item.name)}?database=${encodeURIComponent(item.database)}`,
            );
          },
          stickyHeader: true,
        }}
        emptyState={{
          title: loadError ? "Live schema unavailable" : "No tables found",
          description: loadError ?? "No tables match your search.",
          filteredDescription: "No tables match your current filters.",
          isFiltered: hasActiveFilters,
        }}
        features={{ enablePagination: true }}
      />
    </>
  );
}
