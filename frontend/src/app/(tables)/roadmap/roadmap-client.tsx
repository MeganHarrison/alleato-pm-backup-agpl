"use client";

import { useMemo } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import {
  UnifiedTablePage,
  useUnifiedTableState,
  type TableColumn,
} from "@/components/tables/unified";
import { StatusBadge } from "@/components/ds";
import {
  EFFORT_RANK,
  FREQUENCY_RANK,
  PRIORITY_RANK,
  frequencyVariant,
  oneTimeItems,
  ongoingItems,
  priorityVariant,
  statusVariant,
  type OneTimeItem,
  type OngoingItem,
} from "@/features/roadmap/roadmap-data";

const ISSUE_BASE = "https://github.com/MeganHarrison/alleato-pm/issues";

function IssueLink({ issue }: { issue?: number }) {
  if (!issue) return null;
  return (
    <a
      href={`${ISSUE_BASE}/${issue}`}
      target="_blank"
      rel="noreferrer"
      className="text-sm text-primary hover:underline"
    >
      #{issue}
    </a>
  );
}

function matchesSearch(haystack: string[], search: string) {
  if (!search) return true;
  const needle = search.toLowerCase();
  return haystack.some((value) => value.toLowerCase().includes(needle));
}

type TabItem = { label: string; href: string; isActive?: boolean };

function buildTabs(activeTab: "one-time" | "ongoing"): TabItem[] {
  return [
    { label: "One-time", href: "/roadmap?tab=one-time", isActive: activeTab === "one-time" },
    { label: "Ongoing maintenance", href: "/roadmap?tab=ongoing", isActive: activeTab === "ongoing" },
  ];
}

const oneTimeColumns: TableColumn<OneTimeItem>[] = [
  {
    id: "priority",
    label: "Priority",
    alwaysVisible: true,
    sortable: true,
    width: 90,
    sortValue: (item) => PRIORITY_RANK[item.priority],
    csvValue: (item) => item.priority,
    render: (item) => <StatusBadge status={item.priority} variant={priorityVariant(item.priority)} />,
  },
  {
    id: "title",
    label: "Item",
    alwaysVisible: true,
    sortable: true,
    sortValue: (item) => item.title,
    csvValue: (item) => item.title,
    render: (item) => <span className="text-sm text-foreground">{item.title}</span>,
  },
  {
    id: "category",
    label: "Category",
    defaultVisible: true,
    sortable: true,
    width: 110,
    sortValue: (item) => item.category,
    csvValue: (item) => item.category,
    render: (item) => <span className="text-sm text-muted-foreground">{item.category}</span>,
  },
  {
    id: "area",
    label: "Area",
    defaultVisible: true,
    sortable: true,
    width: 120,
    sortValue: (item) => item.area,
    csvValue: (item) => item.area,
    render: (item) => <span className="text-sm text-muted-foreground">{item.area}</span>,
  },
  {
    id: "effort",
    label: "Effort",
    defaultVisible: true,
    sortable: true,
    width: 80,
    sortValue: (item) => EFFORT_RANK[item.effort],
    csvValue: (item) => item.effort,
    render: (item) => <span className="text-sm text-muted-foreground">{item.effort}</span>,
  },
  {
    id: "status",
    label: "Status",
    defaultVisible: true,
    sortable: true,
    width: 120,
    sortValue: (item) => item.status,
    csvValue: (item) => item.status,
    render: (item) => <StatusBadge status={item.status} variant={statusVariant(item.status)} />,
  },
  {
    id: "issue",
    label: "Issue",
    defaultVisible: true,
    width: 80,
    csvValue: (item) => (item.issue ? `#${item.issue}` : ""),
    render: (item) => <IssueLink issue={item.issue} />,
  },
];

const ongoingColumns: TableColumn<OngoingItem>[] = [
  {
    id: "frequency",
    label: "Frequency",
    alwaysVisible: true,
    sortable: true,
    width: 110,
    sortValue: (item) => FREQUENCY_RANK[item.frequency],
    csvValue: (item) => item.frequency,
    render: (item) => <StatusBadge status={item.frequency} variant={frequencyVariant(item.frequency)} />,
  },
  {
    id: "task",
    label: "Task",
    alwaysVisible: true,
    sortable: true,
    sortValue: (item) => item.task,
    csvValue: (item) => item.task,
    render: (item) => <span className="text-sm text-foreground">{item.task}</span>,
  },
  {
    id: "area",
    label: "Area",
    defaultVisible: true,
    sortable: true,
    width: 130,
    sortValue: (item) => item.area,
    csvValue: (item) => item.area,
    render: (item) => <span className="text-sm text-muted-foreground">{item.area}</span>,
  },
  {
    id: "status",
    label: "Status",
    defaultVisible: true,
    sortable: true,
    width: 120,
    sortValue: (item) => item.status,
    csvValue: (item) => item.status,
    render: (item) => <StatusBadge status={item.status} variant={statusVariant(item.status)} />,
  },
  {
    id: "issue",
    label: "Issue",
    defaultVisible: true,
    width: 80,
    csvValue: (item) => (item.issue ? `#${item.issue}` : ""),
    render: (item) => <IssueLink issue={item.issue} />,
  },
];

function OneTimeTable({ tabs }: { tabs: TabItem[] }) {
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();

  const tableState = useUnifiedTableState({
    entityKey: "roadmap-one-time",
    searchParams,
    pathname,
    router,
    defaults: {
      view: "table",
      allowedViews: ["table"],
      page: 1,
      perPage: 50,
      search: "",
      sortBy: "priority",
      sortDirection: "asc",
      visibleColumns: oneTimeColumns.map((c) => c.id),
      filters: {},
    },
  });

  const filtered = useMemo(
    () =>
      oneTimeItems.filter((item) =>
        matchesSearch([item.title, item.category, item.area, item.priority, item.status], tableState.debouncedSearch),
      ),
    [tableState.debouncedSearch],
  );

  return (
    <UnifiedTablePage
      header={{
        title: "Improvement roadmap",
        description: "Everything that should be done to Alleato PM — sort by priority, group by category or area.",
      }}
      tabs={tabs}
      toolbar={{
        totalItems: oneTimeItems.length,
        filteredItems: filtered.length,
        searchValue: tableState.searchInput,
        onSearchChange: tableState.setSearchInput,
        searchPlaceholder: "Search items...",
        currentView: tableState.currentView,
        onViewChange: tableState.setCurrentView,
      }}
      data={{ items: filtered, isLoading: false }}
      table={{
        columns: oneTimeColumns,
        getRowId: (item) => item.id,
      }}
      emptyState={{
        title: "Nothing here",
        description: "No one-time items yet.",
        filteredDescription: "No items match your search.",
        isFiltered: Boolean(tableState.debouncedSearch),
      }}
      layout={{ fullBleedTable: true, toolbarWithTabs: true }}
    />
  );
}

function OngoingTable({ tabs }: { tabs: TabItem[] }) {
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();

  const tableState = useUnifiedTableState({
    entityKey: "roadmap-ongoing",
    searchParams,
    pathname,
    router,
    defaults: {
      view: "table",
      allowedViews: ["table"],
      page: 1,
      perPage: 50,
      search: "",
      sortBy: "frequency",
      sortDirection: "asc",
      visibleColumns: ongoingColumns.map((c) => c.id),
      filters: {},
    },
  });

  const filtered = useMemo(
    () =>
      ongoingItems.filter((item) =>
        matchesSearch([item.task, item.area, item.frequency, item.status], tableState.debouncedSearch),
      ),
    [tableState.debouncedSearch],
  );

  return (
    <UnifiedTablePage
      header={{
        title: "Improvement roadmap",
        description: "Recurring maintenance — sort by frequency to see the daily / weekly / monthly cadence.",
      }}
      tabs={tabs}
      toolbar={{
        totalItems: ongoingItems.length,
        filteredItems: filtered.length,
        searchValue: tableState.searchInput,
        onSearchChange: tableState.setSearchInput,
        searchPlaceholder: "Search tasks...",
        currentView: tableState.currentView,
        onViewChange: tableState.setCurrentView,
      }}
      data={{ items: filtered, isLoading: false }}
      table={{
        columns: ongoingColumns,
        getRowId: (item) => item.id,
      }}
      emptyState={{
        title: "Nothing here",
        description: "No ongoing tasks yet.",
        filteredDescription: "No tasks match your search.",
        isFiltered: Boolean(tableState.debouncedSearch),
      }}
      layout={{ fullBleedTable: true, toolbarWithTabs: true }}
    />
  );
}

export function RoadmapClient() {
  const searchParams = useSearchParams();
  const activeTab = searchParams.get("tab") === "ongoing" ? "ongoing" : "one-time";
  const tabs = buildTabs(activeTab);

  return activeTab === "ongoing" ? <OngoingTable tabs={tabs} /> : <OneTimeTable tabs={tabs} />;
}
