"use client";

import { useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import {
  UnifiedTablePage,
  useUnifiedTableState,
  type FilterValue,
  type TableColumn,
} from "@/components/tables/unified";
import { EmptyState } from "@/components/ds";
import { cn } from "@/lib/utils";
import { MessageSquare } from "lucide-react";
import {
  useMyFeedback,
  useEditMyFeedback,
  useRetractMyFeedback,
  type MyFeedbackItem,
  type MyFeedbackFilters,
} from "@/hooks/use-my-feedback";
import { EditFeedbackDialog } from "./_components/edit-feedback-dialog";

const TONE_CLASSES: Record<string, string> = {
  positive: "bg-primary/10 text-primary",
  negative: "bg-destructive/10 text-destructive",
  neutral: "bg-muted text-muted-foreground",
};

function formatWhen(value: string | null): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

function buildColumns(): TableColumn<MyFeedbackItem>[] {
  return [
    {
      id: "createdAt",
      label: "When",
      alwaysVisible: true,
      sortable: true,
      sortValue: (item) => item.createdAt ?? "",
      csvValue: (item) => item.createdAt ?? "",
      width: 140,
      render: (item) => (
        <span className="whitespace-nowrap text-sm text-muted-foreground">
          {formatWhen(item.createdAt)}
        </span>
      ),
    },
    {
      id: "surface",
      label: "Surface",
      defaultVisible: true,
      sortable: true,
      sortValue: (item) => item.surfaceLabel,
      csvValue: (item) => item.surfaceLabel,
      width: 170,
      render: (item) => (
        <span className="text-sm text-foreground">{item.surfaceLabel}</span>
      ),
    },
    {
      id: "item",
      label: "What you rated",
      alwaysVisible: true,
      csvValue: (item) => item.itemTitle,
      render: (item) => (
        <span className="line-clamp-2 max-w-md text-sm text-foreground">
          {item.itemTitle}
        </span>
      ),
    },
    {
      id: "rating",
      label: "Your rating",
      defaultVisible: true,
      sortable: true,
      sortValue: (item) => item.signalTone,
      csvValue: (item) => item.signalLabel,
      width: 130,
      render: (item) => (
        <span
          className={cn(
            "inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium",
            TONE_CLASSES[item.signalTone] ?? TONE_CLASSES.neutral,
          )}
        >
          {item.signalLabel}
        </span>
      ),
    },
    {
      id: "note",
      label: "Reason / note",
      defaultVisible: true,
      csvValue: (item) => item.note ?? item.reasonLabel ?? "",
      render: (item) => {
        const text = item.note ?? item.reasonLabel;
        return text ? (
          <span className="line-clamp-2 max-w-sm text-sm text-muted-foreground">
            {text}
          </span>
        ) : (
          <span className="text-sm text-muted-foreground/50">—</span>
        );
      },
    },
  ];
}

export default function MyFeedbackPage() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const tableState = useUnifiedTableState({
    entityKey: "my-feedback",
    searchParams,
    pathname,
    router,
    defaults: {
      view: "table",
      allowedViews: ["table"],
      page: 1,
      perPage: 25,
      search: "",
      sortBy: "createdAt",
      sortDirection: "desc",
      visibleColumns: ["createdAt", "surface", "item", "rating", "note"],
      filters: { surface: undefined, signal: undefined },
    },
  });

  const filters = useMemo<MyFeedbackFilters>(() => {
    const surface = tableState.activeFilters.surface;
    const signal = tableState.activeFilters.signal;
    return {
      surface: typeof surface === "string" ? surface : undefined,
      signal: signal === "positive" || signal === "negative" ? signal : undefined,
    };
  }, [tableState.activeFilters]);

  const { data, isLoading, isFetching, error } = useMyFeedback(filters);
  const editMutation = useEditMyFeedback();
  const retractMutation = useRetractMyFeedback();

  const [editing, setEditing] = useState<MyFeedbackItem | null>(null);

  const items = data?.items ?? [];
  const surfaceOptions = useMemo(
    () => (data?.surfaces ?? []).map((s) => ({ value: s.key, label: s.label })),
    [data?.surfaces],
  );

  const hasActiveFilters = Boolean(filters.surface || filters.signal);

  const handleFilterChange = (next: Record<string, FilterValue>) => {
    tableState.setActiveFilters(next);
  };

  const handleSave = (input: {
    signal?: "positive" | "negative";
    note: string | null;
  }) => {
    if (!editing) return;
    editMutation.mutate(
      { id: editing.id, signal: input.signal, note: input.note },
      { onSuccess: () => setEditing(null) },
    );
  };

  if (!isLoading && !error && items.length === 0 && !hasActiveFilters) {
    return (
      <div className="mx-auto w-full max-w-3xl px-6 py-16">
        <EmptyState
          icon={<MessageSquare />}
          title="You haven't submitted any feedback yet"
          description="Thumbs-up/down, ratings, and corrections you give the AI anywhere in the app show up here so you can review or fix them."
        />
      </div>
    );
  }

  return (
    <>
      <UnifiedTablePage
        header={{
          title: "My feedback",
          description:
            "Everything you've submitted to the AI — review it, change a rating, or undo a mistake.",
        }}
        toolbar={{
          totalItems: items.length,
          filteredItems: items.length,
          searchValue: tableState.searchInput,
          onSearchChange: tableState.setSearchInput,
          searchPlaceholder: "Search your feedback...",
          currentView: tableState.currentView,
          onViewChange: tableState.setCurrentView,
          filters: [
            {
              id: "surface",
              label: "Surface",
              type: "select",
              options: surfaceOptions,
            },
            {
              id: "signal",
              label: "Rating",
              type: "select",
              options: [
                { value: "positive", label: "Helpful" },
                { value: "negative", label: "Not helpful" },
              ],
            },
          ],
          activeFilters: tableState.activeFilters,
          onFilterChange: handleFilterChange,
          onClearFilters: () => handleFilterChange({}),
        }}
        data={{ items, isLoading, isFetching, error: error ?? undefined }}
        table={{
          columns: buildColumns(),
          getRowId: (item) => item.id,
          onEdit: (item) => setEditing(item),
          onDelete: (item) => retractMutation.mutate(item.id),
        }}
        emptyState={{
          title: "No feedback found",
          description: "Feedback you submit to the AI will appear here.",
          filteredDescription: "No feedback matches your current filters.",
          isFiltered: hasActiveFilters || Boolean(tableState.debouncedSearch),
        }}
      />

      <EditFeedbackDialog
        item={editing}
        isSaving={editMutation.isPending}
        onClose={() => setEditing(null)}
        onSave={handleSave}
      />
    </>
  );
}
