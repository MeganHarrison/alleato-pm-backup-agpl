"use client";

import * as React from "react";
import { Plus } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { Button } from "@/components/ui/button";
import {
  UnifiedTablePage,
  useUnifiedTableState,
  type FilterValue,
} from "@/components/tables/unified";
import { TRAINING_DOC_DEFAULT_COLLECTION } from "@/lib/training-docs/constants";
import type { TrainingDocWithAssets } from "@/lib/training-docs/types";
import {
  useCreateTrainingDoc,
  useDeleteTrainingDoc,
  useTrainingDocs,
  useUpdateTrainingDoc,
} from "@/hooks/use-training-docs";
import {
  buildTrainingDocTableColumns,
  trainingDocDefaultVisibleColumns,
  trainingDocFilters,
  type TrainingDocEditableField,
} from "@/features/training-docs/training-docs-table-config";

const EMPTY_FILTERS: Record<string, FilterValue> = {
  status: undefined,
  audience: undefined,
};

const DEFAULT_BODY = [
  "## Purpose",
  "",
  "Explain when to use this workflow.",
  "",
  "## Steps",
  "",
  "1. Step one.",
  "",
  "## Field Definitions",
  "",
  "- Add dropdown and field explanations here.",
  "",
  "## Reports and Exports",
  "",
  "- Add reporting/export details here.",
].join("\n");

export function TrainingDocsClient() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { data: docs = [], isLoading, error, isFetching } = useTrainingDocs();
  const createDoc = useCreateTrainingDoc();
  const updateDoc = useUpdateTrainingDoc();
  const deleteDoc = useDeleteTrainingDoc();

  const activeFilters = React.useMemo<Record<string, FilterValue>>(
    () => ({
      status: searchParams.get("status") || undefined,
      audience: searchParams.get("audience") || undefined,
    }),
    [searchParams],
  );

  const tableState = useUnifiedTableState({
    entityKey: "training-docs",
    searchParams,
    pathname,
    router,
    defaults: {
      view: "table",
      allowedViews: ["table"],
      page: 1,
      perPage: 25,
      search: "",
      sortBy: "title",
      sortDirection: "asc",
      visibleColumns: trainingDocDefaultVisibleColumns,
      filters: EMPTY_FILTERS,
    },
  });

  const filteredDocs = React.useMemo(() => {
    return docs.filter((doc) => {
      if (activeFilters.status && doc.status !== activeFilters.status) {
        return false;
      }
      if (activeFilters.audience && doc.audience !== activeFilters.audience) {
        return false;
      }
      return true;
    });
  }, [activeFilters.audience, activeFilters.status, docs]);

  const handleFilterChange = React.useCallback(
    (nextFilters: Record<string, FilterValue>) => {
      tableState.setPage(1);
      tableState.setActiveFilters(nextFilters);
      tableState.setSearchParams({
        status: stringFilterValue(nextFilters.status),
        audience: stringFilterValue(nextFilters.audience),
        page: null,
      });
    },
    [tableState],
  );

  const handleCreateDoc = React.useCallback(async () => {
    const now = Date.now();
    const result = await createDoc.mutateAsync({
      title: "Untitled training doc",
      slug: `untitled-training-doc-${now}`,
      body_markdown: DEFAULT_BODY,
      audience: "internal",
      status: "draft",
      target_collection: TRAINING_DOC_DEFAULT_COLLECTION,
    });
    const doc = (result as { doc: TrainingDocWithAssets }).doc;
    router.push(`/training-docs/${doc.id}`);
  }, [createDoc, router]);

  const handleInlineEdit = React.useCallback(
    async (
      doc: TrainingDocWithAssets,
      field: TrainingDocEditableField,
      value: string,
    ) => {
      const trimmedValue = value.trim();
      if (field === "status") {
        await updateDoc.mutateAsync({
          id: doc.id,
          status: value as typeof doc.status,
        });
        return;
      }

      if (field === "audience") {
        await updateDoc.mutateAsync({
          id: doc.id,
          audience: value as typeof doc.audience,
        });
        return;
      }

      if (field === "summary") {
        await updateDoc.mutateAsync({
          id: doc.id,
          summary: trimmedValue || null,
        });
        return;
      }

      if (field === "body_markdown") {
        if (!trimmedValue) return;
        await updateDoc.mutateAsync({
          id: doc.id,
          body_markdown: value,
        });
        return;
      }

      await updateDoc.mutateAsync({
        id: doc.id,
        source_route: trimmedValue || null,
      });
    },
    [updateDoc],
  );

  const columns = React.useMemo(
    () => buildTrainingDocTableColumns(handleInlineEdit),
    [handleInlineEdit],
  );

  const hasActiveFilters = Boolean(
    tableState.searchInput.trim() ||
    activeFilters.status ||
    activeFilters.audience,
  );

  return (
    <UnifiedTablePage
      header={{
        title: "Training Docs",
        description:
          "Draft, review, edit, and publish internal SOPs to the docs site.",
        actions: (
          <Button
            size="sm"
            onClick={handleCreateDoc}
            disabled={createDoc.isPending}
          >
            <Plus className="h-4 w-4" />
            New
          </Button>
        ),
      }}
      toolbar={{
        totalItems: docs.length,
        filteredItems: filteredDocs.length,
        searchValue: tableState.searchInput,
        onSearchChange: tableState.setSearchInput,
        searchPlaceholder: "Search training docs...",
        currentView: tableState.currentView,
        onViewChange: tableState.setCurrentView,
        filters: trainingDocFilters,
        activeFilters,
        onFilterChange: handleFilterChange,
        onClearFilters: () => handleFilterChange(EMPTY_FILTERS),
      }}
      data={{
        items: filteredDocs,
        isLoading,
        isFetching,
        error: error instanceof Error ? error : null,
      }}
      table={{
        columns,
        getRowId: (doc) => doc.id,
        onEdit: (doc) => router.push(`/training-docs/${doc.id}`),
        onDelete: async (doc) => {
          await deleteDoc.mutateAsync(doc.id);
        },
        onRowClick: (doc) => router.push(`/training-docs/${doc.id}`),
        stickyHeader: true,
      }}
      emptyState={{
        title: "No training docs",
        description:
          "Create the first SOP draft and publish it to the docs site.",
        filteredDescription:
          "No training docs match the current search or filters.",
        isFiltered: hasActiveFilters,
        action: (
          <Button onClick={handleCreateDoc} disabled={createDoc.isPending}>
            <Plus className="h-4 w-4" />
            New Training Doc
          </Button>
        ),
      }}
      layout={{ fullBleedTable: true }}
    />
  );
}

function stringFilterValue(value: FilterValue): string | null {
  return typeof value === "string" && value ? value : null;
}
