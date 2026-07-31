"use client";

import * as React from "react";
import { Plus } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  UnifiedTablePage,
  useUnifiedTableState,
  type FilterValue,
} from "@/components/tables/unified";
import {
  useCreateTrainingAdminRecord,
  useDeleteTrainingAdminRecord,
  useTrainingAdminTable,
  useUpdateTrainingAdminRecord,
} from "@/hooks/use-training-admin";

import {
  TRAINING_ADMIN_TABLES,
  TRAINING_ADMIN_TABS,
} from "./training-admin-config";
import {
  buildTrainingAdminColumns,
  buildTrainingAdminFilters,
  recordMatchesTrainingAdminFilters,
  recordMatchesTrainingAdminSearch,
  trainingAdminDefaultVisibleColumns,
} from "./training-admin-table-config";
import { TrainingAdminRecordModal } from "./training-admin-record-modal";
import type {
  TrainingAdminRecord,
  TrainingAdminTableKey,
} from "./types";

export function TrainingAdminTablePage({
  tableKey,
}: {
  tableKey: TrainingAdminTableKey;
}) {
  const definition = TRAINING_ADMIN_TABLES[tableKey];
  const pathname = usePathname()!;
  const router = useRouter();
  const searchParams = useSearchParams()!;
  const tableQuery = useTrainingAdminTable(tableKey);
  const createRecord = useCreateTrainingAdminRecord(tableKey);
  const updateRecord = useUpdateTrainingAdminRecord(tableKey);
  const deleteRecord = useDeleteTrainingAdminRecord(tableKey);
  const [editorOpen, setEditorOpen] = React.useState(false);
  const [editingRecord, setEditingRecord] =
    React.useState<TrainingAdminRecord | null>(null);

  const emptyFilters = React.useMemo<Record<string, FilterValue>>(
    () =>
      Object.fromEntries(
        (definition.filters ?? []).map((filter) => [filter.key, undefined]),
      ),
    [definition.filters],
  );

  const activeFilters = React.useMemo<Record<string, FilterValue>>(
    () =>
      Object.fromEntries(
        (definition.filters ?? []).map((filter) => [
          filter.key,
          searchParams.get(filter.key) || undefined,
        ]),
      ),
    [definition.filters, searchParams],
  );

  const tableState = useUnifiedTableState({
    entityKey: `training-admin-${tableKey}`,
    searchParams,
    pathname,
    router,
    defaults: {
      view: "table",
      allowedViews: ["table"],
      page: 1,
      perPage: 25,
      search: "",
      sortBy: definition.columns[0]?.key ?? "_rowKey",
      sortDirection: "asc",
      visibleColumns: trainingAdminDefaultVisibleColumns(definition),
      filters: emptyFilters,
    },
  });

  const records = tableQuery.data?.records ?? [];
  const references = tableQuery.data?.references ?? {};
  const filteredRecords = React.useMemo(
    () =>
      records.filter(
        (record) =>
          recordMatchesTrainingAdminFilters(record, activeFilters) &&
          recordMatchesTrainingAdminSearch(
            record,
            definition,
            references,
            tableState.debouncedSearch,
          ),
      ),
    [
      activeFilters,
      definition,
      records,
      references,
      tableState.debouncedSearch,
    ],
  );

  const filters = React.useMemo(
    () => buildTrainingAdminFilters(definition, references),
    [definition, references],
  );
  const columns = React.useMemo(
    () => buildTrainingAdminColumns(definition, references),
    [definition, references],
  );
  const tabs = React.useMemo(
    () =>
      TRAINING_ADMIN_TABS.map((tab) => ({
        label: tab.label,
        href: tab.href,
        isActive: tab.key === tableKey,
      })),
    [tableKey],
  );

  const handleFilterChange = React.useCallback(
    (nextFilters: Record<string, FilterValue>) => {
      tableState.setPage(1);
      tableState.setActiveFilters(nextFilters);
      tableState.setSearchParams({
        ...Object.fromEntries(
          Object.entries(nextFilters).map(([key, value]) => [
            key,
            typeof value === "string" && value ? value : null,
          ]),
        ),
        page: null,
      });
    },
    [tableState],
  );

  function openCreate() {
    setEditingRecord(null);
    setEditorOpen(true);
  }

  function openEdit(record: TrainingAdminRecord) {
    setEditingRecord(record);
    setEditorOpen(true);
  }

  async function saveRecord(payload: Record<string, unknown>) {
    if (editingRecord) {
      await updateRecord.mutateAsync({
        recordId: editingRecord._rowKey,
        payload,
      });
      toast.success(`${definition.singularLabel} updated`);
      return;
    }
    await createRecord.mutateAsync(payload);
    toast.success(`${definition.singularLabel} added`);
  }

  const hasActiveFilters = Boolean(
    tableState.debouncedSearch ||
      Object.values(activeFilters).some((value) => Boolean(value)),
  );

  return (
    <>
      <UnifiedTablePage
        header={{
          title: definition.label,
          description: definition.description,
          actions: (
            <Button size="sm" onClick={openCreate}>
              <Plus className="h-4 w-4" />
              Add
            </Button>
          ),
        }}
        tabs={tabs}
        toolbar={{
          totalItems: records.length,
          filteredItems: filteredRecords.length,
          searchValue: tableState.searchInput,
          onSearchChange: tableState.setSearchInput,
          searchPlaceholder: `Search ${definition.label.toLowerCase()}…`,
          currentView: tableState.currentView,
          onViewChange: tableState.setCurrentView,
          filters,
          activeFilters,
          onFilterChange: handleFilterChange,
          onClearFilters: () => handleFilterChange(emptyFilters),
        }}
        data={{
          items: filteredRecords,
          isLoading: tableQuery.isLoading,
          isFetching: tableQuery.isFetching,
          error: tableQuery.error,
        }}
        table={{
          columns,
          getRowId: (record) => record._rowKey,
          onEdit: openEdit,
          onDelete: async (record) => {
            await deleteRecord.mutateAsync(record._rowKey);
            toast.success(`${definition.singularLabel} deleted`);
          },
          stickyHeader: true,
        }}
        emptyState={{
          title: `No ${definition.label.toLowerCase()}`,
          description: `Add the first ${definition.singularLabel.toLowerCase()} record.`,
          filteredDescription: "No records match the current search or filters.",
          isFiltered: hasActiveFilters,
          action: (
            <Button size="sm" onClick={openCreate}>
              <Plus className="h-4 w-4" />
              Add
            </Button>
          ),
        }}
        layout={{ fullBleedTable: true }}
      />

      <TrainingAdminRecordModal
        definition={definition}
        references={references}
        record={editingRecord}
        open={editorOpen}
        isSaving={createRecord.isPending || updateRecord.isPending}
        onOpenChange={setEditorOpen}
        onSave={saveRecord}
      />
    </>
  );
}
