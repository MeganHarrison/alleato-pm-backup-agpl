"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import {
  bulkUpdateContentGovernanceAction,
  updateContentDisplayAreaAction,
} from "@/app/(main)/content/actions";
import {
  CellDate,
  CellStatus,
  UnifiedTablePage,
  editableSelectColumn,
  type BulkEditField,
  type ColumnConfig,
  type FilterConfig,
  type TableColumn,
  useUnifiedTableState,
} from "@/components/tables/unified";
import { getManagedLearningContentHref } from "@/lib/learning/data-access";
import type {
  ContentManagerOption,
  KnowledgeDisplayArea,
  LearningLibraryItem,
} from "@/lib/learning/types";

import { ContentCreateMenu } from "./content-create-menu";
import {
  buildManagerOptions,
  contentNeedsAttention,
  engagementLabel,
  reviewLabel,
} from "./content-catalog-operations";

const columns: ColumnConfig[] = [
  { id: "title", label: "Title", alwaysVisible: true },
  { id: "owner", label: "Owner", defaultVisible: true },
  { id: "review", label: "Review", defaultVisible: true },
  { id: "engagement", label: "Engagement", defaultVisible: true },
  { id: "displayArea", label: "Displayed in", defaultVisible: true },
  { id: "kind", label: "Type", defaultVisible: true },
  { id: "lifecycle", label: "Status", defaultVisible: true },
  { id: "reviewer", label: "Reviewer", defaultVisible: false },
  { id: "source", label: "Source", defaultVisible: false },
  { id: "updatedAt", label: "Updated", defaultVisible: true },
];

const displayAreas: Array<{
  value: KnowledgeDisplayArea;
  label: string;
}> = [
  { value: "training", label: "Training" },
  { value: "resources", label: "Resources" },
  { value: "sops", label: "SOPs" },
  { value: "documentation", label: "Documentation" },
];

const displayAreaLabels = new Map(
  displayAreas.map((area) => [area.value, area.label]),
);

const lifecycleOptions = [
  { value: "draft", label: "Draft" },
  { value: "in_review", label: "In review" },
  { value: "published", label: "Published" },
  { value: "archived", label: "Archived" },
];

const filters: FilterConfig[] = [
  {
    id: "attention",
    label: "Needs attention",
    type: "boolean",
  },
  {
    id: "ownership",
    label: "Ownership",
    type: "select",
    options: [
      { value: "mine", label: "Mine" },
      { value: "unassigned", label: "Unassigned" },
    ],
  },
  {
    id: "lifecycle",
    label: "Status",
    type: "multiSelect",
    options: lifecycleOptions,
  },
  {
    id: "engagement",
    label: "Engagement",
    type: "select",
    options: [
      { value: "activity", label: "Has activity" },
      { value: "no_activity", label: "No activity yet" },
      { value: "not_tracked", label: "Not tracked" },
    ],
  },
];

const defaultVisibleColumns = columns
  .filter((column) => column.alwaysVisible || column.defaultVisible)
  .map((column) => column.id);

function label(value: string) {
  return value
    .replaceAll("_", " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function hasActiveFilter(value: unknown) {
  if (Array.isArray(value)) return value.length > 0;
  return (
    value !== undefined && value !== null && value !== "" && value !== false
  );
}

function tableColumns(
  onDisplayAreaEdit: (
    item: LearningLibraryItem,
    displayArea: string,
  ) => Promise<void>,
): TableColumn<LearningLibraryItem>[] {
  return [
    {
      id: "title",
      label: "Title",
      alwaysVisible: true,
      sortable: true,
      sortValue: (item) => item.title,
      render: (item) => (
        <Link
          href={getManagedLearningContentHref(item)}
          className="font-medium text-foreground underline-offset-4 hover:underline"
        >
          {item.title}
        </Link>
      ),
      csvValue: (item) => item.title,
      width: 340,
    },
    {
      id: "owner",
      label: "Owner",
      defaultVisible: true,
      sortable: true,
      sortValue: (item) => item.ownerName ?? "",
      render: (item) => (
        <span className="text-sm">{item.ownerName ?? "Unassigned"}</span>
      ),
      csvValue: (item) => item.ownerName ?? "Unassigned",
      width: 170,
    },
    {
      id: "review",
      label: "Review",
      defaultVisible: true,
      sortable: true,
      sortValue: (item) => item.nextReviewAt ?? "",
      render: (item) => <CellStatus value={reviewLabel(item)} />,
      csvValue: reviewLabel,
      width: 155,
    },
    {
      id: "engagement",
      label: "Engagement",
      defaultVisible: true,
      sortable: true,
      sortValue: (item) =>
        item.engagementTrackingSupported ? item.uniqueViewers : -1,
      render: (item) => {
        const value = engagementLabel(item);
        return (
          <span
            className="whitespace-nowrap text-sm text-muted-foreground"
            title={value}
          >
            {value}
          </span>
        );
      },
      csvValue: engagementLabel,
      width: 200,
    },
    editableSelectColumn(
      {
        id: "displayArea",
        label: "Displayed in",
        defaultVisible: true,
        sortable: true,
        sortValue: (item) => item.displayArea,
        render: (item) => (
          <span className="text-sm">
            {displayAreaLabels.get(item.displayArea)}
          </span>
        ),
        csvValue: (item) =>
          displayAreaLabels.get(item.displayArea) ?? item.displayArea,
        width: 145,
      },
      {
        getValue: (item) => item.displayArea,
        onEdit: onDisplayAreaEdit,
        options: displayAreas,
      },
    ),
    {
      id: "kind",
      label: "Type",
      defaultVisible: true,
      sortable: true,
      sortValue: (item) => item.kind,
      render: (item) => (
        <span className="text-sm text-muted-foreground">
          {label(item.kind)}
        </span>
      ),
      csvValue: (item) => label(item.kind),
      width: 145,
    },
    {
      id: "lifecycle",
      label: "Status",
      defaultVisible: true,
      sortable: true,
      sortValue: (item) => item.lifecycle,
      render: (item) => <CellStatus value={label(item.lifecycle)} />,
      csvValue: (item) => label(item.lifecycle),
      width: 125,
    },
    {
      id: "reviewer",
      label: "Reviewer",
      defaultVisible: false,
      sortable: true,
      sortValue: (item) => item.reviewerName ?? "",
      render: (item) => (
        <span className="text-sm">{item.reviewerName ?? "Unassigned"}</span>
      ),
      csvValue: (item) => item.reviewerName ?? "Unassigned",
      width: 170,
    },
    {
      id: "source",
      label: "Source",
      defaultVisible: false,
      sortable: true,
      sortValue: (item) => item.sourceType,
      render: (item) => (
        <span className="text-sm text-muted-foreground">
          {label(item.sourceType)}
        </span>
      ),
      csvValue: (item) => label(item.sourceType),
      width: 155,
    },
    {
      id: "updatedAt",
      label: "Updated",
      defaultVisible: true,
      sortable: true,
      sortValue: (item) => item.updatedAt,
      render: (item) => <CellDate value={item.updatedAt} />,
      csvValue: (item) => item.updatedAt,
      width: 145,
    },
  ];
}

interface ContentCatalogTableProps {
  currentUserId: string;
  items: LearningLibraryItem[];
  managers: ContentManagerOption[];
}

export function ContentCatalogTable({
  currentUserId,
  items,
  managers,
}: ContentCatalogTableProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const requestedArea = searchParams?.get("area") ?? null;
  const activeArea: KnowledgeDisplayArea = displayAreas.some(
    (area) => area.value === requestedArea,
  )
    ? (requestedArea as KnowledgeDisplayArea)
    : "training";
  const tabs = displayAreas.map((area) => ({
    label: area.label,
    href: `/content?area=${area.value}`,
    count: items.filter((item) => item.displayArea === area.value).length,
    isActive: activeArea === area.value,
  }));
  const tableState = useUnifiedTableState({
    entityKey: "content-studio-catalog",
    searchParams,
    pathname,
    router,
    defaults: {
      view: "table",
      allowedViews: ["table"],
      page: 1,
      perPage: 25,
      search: "",
      sortBy: "updatedAt",
      sortDirection: "desc",
      visibleColumns: defaultVisibleColumns,
      filters: {},
    },
  });
  const filtered = React.useMemo(() => {
    const query = tableState.debouncedSearch.trim().toLowerCase();
    const selectedLifecycle = Array.isArray(tableState.activeFilters.lifecycle)
      ? tableState.activeFilters.lifecycle
      : [];
    const ownership = tableState.activeFilters.ownership;
    const engagement = tableState.activeFilters.engagement;
    const attentionOnly = tableState.activeFilters.attention === true;

    return items.filter((item) => {
      if (item.displayArea !== activeArea) return false;
      if (attentionOnly && !contentNeedsAttention(item)) return false;
      if (
        ownership === "mine" &&
        item.ownerUserId !== currentUserId &&
        item.reviewerUserId !== currentUserId
      ) {
        return false;
      }
      if (
        ownership === "unassigned" &&
        item.ownerUserId &&
        item.reviewerUserId
      ) {
        return false;
      }
      if (
        selectedLifecycle.length > 0 &&
        !selectedLifecycle.includes(item.lifecycle)
      ) {
        return false;
      }
      if (engagement === "activity" && item.uniqueViewers === 0) return false;
      if (
        engagement === "no_activity" &&
        (!item.engagementTrackingSupported || item.uniqueViewers > 0)
      ) {
        return false;
      }
      if (engagement === "not_tracked" && item.engagementTrackingSupported) {
        return false;
      }
      if (!query) return true;
      return [
        item.title,
        item.summary,
        item.kind,
        item.lifecycle,
        item.ownerName,
        item.reviewerName,
        reviewLabel(item),
        engagementLabel(item),
        ...item.topics.map((topic) => topic.name),
        ...item.roles.map((role) => role.name),
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(query);
    });
  }, [
    activeArea,
    currentUserId,
    items,
    tableState.activeFilters,
    tableState.debouncedSearch,
  ]);
  const areaItemCount = React.useMemo(
    () => items.filter((item) => item.displayArea === activeArea).length,
    [activeArea, items],
  );
  const resolvedColumns = React.useMemo(
    () =>
      tableColumns(async (item, displayArea) => {
        await updateContentDisplayAreaAction(item.id, displayArea);
        router.refresh();
      }),
    [router],
  );
  const managerOptions = React.useMemo(
    () => buildManagerOptions(managers),
    [managers],
  );
  const bulkEditFields = React.useMemo<BulkEditField[]>(
    () => [
      {
        id: "display_area",
        label: "Display area",
        type: "select",
        options: displayAreas,
        placeholder: "Select display area",
      },
      {
        id: "owner_user_id",
        label: "Owner",
        type: "select",
        searchable: true,
        options: managerOptions,
        placeholder: "Select owner",
      },
      {
        id: "reviewer_user_id",
        label: "Reviewer",
        type: "select",
        searchable: true,
        options: managerOptions,
        placeholder: "Select reviewer",
      },
      {
        id: "next_review_at",
        label: "Next review date",
        type: "text",
        inputType: "date",
      },
    ],
    [managerOptions],
  );
  const isFiltered =
    Boolean(tableState.debouncedSearch.trim()) ||
    Object.values(tableState.activeFilters).some(hasActiveFilter);

  return (
    <UnifiedTablePage
      header={{
        title: "Content Studio",
        description:
          "Create, govern, and publish company knowledge from one catalog.",
        mobileActionsInline: false,
        actions: <ContentCreateMenu />,
      }}
      tabs={tabs}
      toolbar={{
        totalItems: areaItemCount,
        filteredItems: filtered.length,
        searchValue: tableState.searchInput,
        onSearchChange: tableState.setSearchInput,
        searchPlaceholder: "Search content, owners, roles, or topics...",
        currentView: tableState.currentView,
        onViewChange: tableState.setCurrentView,
        enabledViews: ["table"],
        filters,
        activeFilters: tableState.activeFilters,
        onFilterChange: tableState.setActiveFilters,
        onClearFilters: () => tableState.setActiveFilters({}),
        columns,
        visibleColumns: tableState.visibleColumns,
        onColumnVisibilityChange: tableState.setVisibleColumns,
        savedViewsScope: "content-studio-catalog",
        savedViewsDefaults: {
          visibleColumns: defaultVisibleColumns,
          sortBy: "updatedAt",
          sortDirection: "desc",
          filters: {},
        },
      }}
      data={{ items: filtered, isLoading: false }}
      sorting={{
        sortBy: tableState.sortBy,
        sortDirection: tableState.sortDirection,
        onSortChange: (sortBy, direction) => {
          tableState.setSortBy(sortBy);
          tableState.setSortDirection(direction);
        },
      }}
      table={{
        columns: resolvedColumns,
        getRowId: (item) => item.id,
        onRowClick: (item) => router.push(getManagedLearningContentHref(item)),
        bulkEdit: {
          fields: bulkEditFields,
          onApply: async (fieldId, value, selectedIds) => {
            await bulkUpdateContentGovernanceAction(
              selectedIds,
              fieldId,
              value,
            );
            router.refresh();
          },
          itemNoun: "content item",
        },
        stickyHeader: true,
        density: "compact",
      }}
      emptyState={{
        title: `No ${displayAreaLabels.get(activeArea)?.toLowerCase()} content yet`,
        description: "Create content or move an existing item into this area.",
        filteredDescription:
          "No content in this area matches the current search or filters.",
        isFiltered,
      }}
      layout={{
        fullBleedTable: false,
        toolbarInlineWithHeader: false,
        toolbarWithTabs: false,
        minWidth: 1380,
      }}
      features={{
        enableRowSelection: true,
        enableBulkEdit: true,
        enableBulkDelete: false,
        enableRowActions: false,
        enableViews: false,
        enableFilters: true,
        enableColumnToggle: true,
        enableColumnReorder: false,
        enableColumnPinning: false,
        enableExport: false,
        enableInlineEditing: true,
      }}
      reportContext={{
        projectName: "Alleato",
        projectDescription: "Knowledge and learning catalog",
      }}
    />
  );
}
